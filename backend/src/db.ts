import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'
import { createClient, type Client, type InValue } from '@libsql/client'

/**
 * Base de données via libSQL (@libsql/client).
 *
 * - En local  : DATABASE_URL non défini → fichier SQLite local (file://…/data/hornax.db)
 * - En prod   : DATABASE_URL = libsql://<db>.turso.io  +  DATABASE_AUTH_TOKEN
 *
 * L'API (.prepare().get/all/run) reproduit celle de node:sqlite mais en ASYNCHRONE :
 * chaque appel renvoie une Promise et doit être `await`.
 */

function resolveUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const localPath = process.env.DB_PATH ?? path.resolve(__dirname, '../../data/hornax.db')
  const dir = path.dirname(localPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return pathToFileURL(localPath).href
}

const DB_URL = resolveUrl()

export const client: Client = createClient({
  url: DB_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
  intMode: 'number',
})

/** undefined → null, boolean → 0/1 (libSQL n'accepte ni undefined ni boolean). */
function sanitize(args: unknown[]): InValue[] {
  return args.map((a) => {
    if (a === undefined) return null
    if (typeof a === 'boolean') return a ? 1 : 0
    return a as InValue
  })
}

/** Convertit chaque Row libSQL en objet simple {col: valeur} (comme node:sqlite). */
function toPlain<T>(columns: string[], rows: readonly Record<string, unknown>[]): T[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = {}
    for (const c of columns) o[c] = r[c]
    return o as T
  })
}

function prepare(sql: string) {
  return {
    async get<T = any>(...args: unknown[]): Promise<T | undefined> {
      const rs = await client.execute({ sql, args: sanitize(args) })
      return toPlain<T>(rs.columns, rs.rows)[0]
    },
    async all<T = any>(...args: unknown[]): Promise<T[]> {
      const rs = await client.execute({ sql, args: sanitize(args) })
      return toPlain<T>(rs.columns, rs.rows)
    },
    async run(...args: unknown[]): Promise<{ lastInsertRowid: number; changes: number }> {
      const rs = await client.execute({ sql, args: sanitize(args) })
      return {
        lastInsertRowid: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : 0,
        changes: rs.rowsAffected,
      }
    },
  }
}

const db = { prepare }
export default db

/** Crée le schéma + les 2 équipes (aucun membre). À appeler avant app.listen(). */
export async function initDb(): Promise<void> {
  const usingTurso = !DB_URL.startsWith('file:')
  console.log(`🗄️  Base de données : ${usingTurso ? 'Turso → ' + DB_URL : 'fichier local (' + DB_URL + ')'}`)
  if (!usingTurso && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  DATABASE_URL absent en production → base locale ÉPHÉMÈRE (données perdues au redéploiement) !')
  }

  // PRAGMA best-effort : ignoré / non applicable côté Turso distant.
  try { await client.execute('PRAGMA journal_mode = WAL') } catch { /* noop */ }
  try { await client.execute('PRAGMA foreign_keys = ON') } catch { /* noop */ }

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      max_players INTEGER NOT NULL DEFAULT 8,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      team_id INTEGER REFERENCES teams(id),
      game_role TEXT CHECK(game_role IN ('top','jgl','mid','adc','sup','sub','coach','manager')),
      is_starter INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      team_id INTEGER NOT NULL REFERENCES teams(id),
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'uncertain'
        CHECK(status IN ('available','unavailable','uncertain')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL REFERENCES teams(id),
      opponent TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      type TEXT NOT NULL DEFAULT 'scrim' CHECK(type IN ('scrim','tournament','official')),
      result TEXT CHECK(result IN ('win','loss')),
      score_us INTEGER,
      score_them INTEGER,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Migrations — colonnes ajoutées après création initiale
  for (const col of ['opponent_logo TEXT', 'series_id TEXT', 'riot_data TEXT', "context TEXT DEFAULT 'team'"]) {
    try { await client.execute(`ALTER TABLE matches ADD COLUMN ${col}`) } catch { /* déjà présente */ }
  }
  for (const col of ['riot_id TEXT', 'puuid TEXT', 'last_synced_at TEXT']) {
    try { await client.execute(`ALTER TABLE users ADD COLUMN ${col}`) } catch { /* déjà présente */ }
  }

  // Cache des matchs Riot (import throttlé + incrémental)
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS riot_match (
      match_id   TEXT PRIMARY KEY,
      queue_id   INTEGER,
      category   TEXT,               -- 'soloq' | 'flex' | 'scrim' | 'other'
      game_start INTEGER,            -- timestamp ms (gameStartTimestamp)
      duration   INTEGER,            -- secondes (gameDuration)
      region     TEXT,
      data       TEXT NOT NULL,      -- JSON brut match-v5 (info + metadata)
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS riot_match_user (
      match_id TEXT NOT NULL,
      user_id  INTEGER NOT NULL,
      puuid    TEXT,
      champion TEXT,
      win      INTEGER,              -- 0/1
      team_id  INTEGER,              -- 100 bleu / 200 rouge
      PRIMARY KEY (match_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_rmu_user     ON riot_match_user(user_id);
    CREATE INDEX IF NOT EXISTS idx_rm_category  ON riot_match(category);
  `)

  const row = await client.execute('SELECT COUNT(*) as c FROM teams')
  if (Number(row.rows[0].c) === 0) {
    await client.execute({ sql: 'INSERT INTO teams (name, slug, max_players) VALUES (?, ?, ?)', args: ['HORNAX', 'hornax', 8] })
    await client.execute({ sql: 'INSERT INTO teams (name, slug, max_players) VALUES (?, ?, ?)', args: ['HORNAX ROYALTY', 'hornax-royalty', 8] })
    console.log('✓ Teams seeded: HORNAX, HORNAX ROYALTY')
  }
}
