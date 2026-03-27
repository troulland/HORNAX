import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'

const dbPath = process.env.DB_PATH ?? path.join(path.resolve(__dirname, '../../data'), 'hornax.db')
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(dbPath)

// WAL mode + foreign keys via exec (node:sqlite has no .pragma())
db.exec("PRAGMA journal_mode = WAL")
db.exec("PRAGMA foreign_keys = ON")

db.exec(`
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
;['opponent_logo TEXT', 'series_id TEXT', 'riot_data TEXT', "context TEXT DEFAULT 'team'"].forEach(col => {
  try { db.exec(`ALTER TABLE matches ADD COLUMN ${col}`) } catch {}
})

// Users table migrations
;['riot_id TEXT'].forEach(col => {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`) } catch {}
})

const row = db.prepare('SELECT COUNT(*) as c FROM teams').get() as { c: number }
if (row.c === 0) {
  const insert = db.prepare('INSERT INTO teams (name, slug, max_players) VALUES (?, ?, ?)')
  insert.run('HORNAX', 'hornax', 8)
  insert.run('HORNAX ROYALTY', 'hornax-royalty', 8)
  console.log('✓ Teams seeded: HORNAX, HORNAX ROYALTY')
}

export default db
