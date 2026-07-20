import 'dotenv/config'
import bcrypt from 'bcryptjs'
import db, { client, initDb } from './db'

/**
 * Seeder des comptes HORNAX.
 *
 *   npm run seed            → crée les comptes de ACCOUNTS[] (ignore ceux qui existent)
 *   npm run seed:reset      → SUPPRIME tous les membres puis recrée ACCOUNTS[]
 *
 * Cible la base pointée par les variables d'env (voir .env / .env.example) :
 *   - rien de défini            → base locale  data/hornax.db
 *   - DATABASE_URL + TOKEN      → base Turso (prod)
 *
 * Édite simplement le tableau ACCOUNTS ci-dessous, puis lance la commande.
 */

type Role = 'top' | 'jgl' | 'mid' | 'adc' | 'sup' | 'sub' | 'coach' | 'manager'

interface Account {
  team: 'hornax' | 'hornax-royalty'
  username: string
  role: Role
  password?: string   // défaut : DEFAULT_PASSWORD
  email?: string      // défaut : <pseudo>@<team>.gg
  starter?: boolean   // défaut : true pour top/jgl/mid/adc/sup
}

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? 'hornax2026'

// ─────────────────────────────────────────────────────────────
//  👉  ÉDITE CETTE LISTE avec tes comptes, puis lance `npm run seed`
// ─────────────────────────────────────────────────────────────
const ACCOUNTS: Account[] = [
  // === HORNAX ===
  // { team: 'hornax', username: 'Kaishi',   role: 'mid', password: 'monMdp' },
  // { team: 'hornax', username: 'TopLaner', role: 'top' },
  // { team: 'hornax', username: 'Jungler',  role: 'jgl' },
  // { team: 'hornax', username: 'AdCarry',  role: 'adc' },
  // { team: 'hornax', username: 'Support',  role: 'sup' },

  // === HORNAX ROYALTY ===
  // { team: 'hornax-royalty', username: 'RoyalTop', role: 'top' },
  // { team: 'hornax-royalty', username: 'RoyalMid', role: 'mid' },
]

const RESET = process.argv.includes('--reset') || process.env.SEED_RESET === '1'

async function resetMembers(): Promise<void> {
  await client.execute('DELETE FROM availability')
  await client.execute('UPDATE matches SET created_by = NULL')
  await client.execute('DELETE FROM users')
  console.log('🗑  Reset : tous les membres ont été supprimés.\n')
}

async function seed(): Promise<void> {
  await initDb()               // s'assure que le schéma + les 2 équipes existent
  if (RESET) await resetMembers()

  if (ACCOUNTS.length === 0) {
    console.log('⚠  ACCOUNTS[] est vide — édite src/seed.ts puis relance.')
    return
  }

  let created = 0
  for (const a of ACCOUNTS) {
    const team = await db.prepare('SELECT id FROM teams WHERE slug = ?').get<{ id: number }>(a.team)
    if (!team) { console.error(`❌  Équipe "${a.team}" introuvable — ignoré ${a.username}`); continue }

    const dup = await db.prepare('SELECT id FROM users WHERE username = ?').get(a.username)
    if (dup) { console.log(`⏭  ${a.username} existe déjà — ignoré`); continue }

    const email    = a.email ?? `${a.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@${a.team}.gg`
    const starter  = a.starter ?? ['top', 'jgl', 'mid', 'adc', 'sup'].includes(a.role)
    const password = a.password ?? DEFAULT_PASSWORD
    const hash     = await bcrypt.hash(password, 12)

    await db.prepare(
      'INSERT INTO users (username, email, password_hash, team_id, game_role, is_starter) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(a.username, email, hash, team.id, a.role, starter ? 1 : 0)

    console.log(`✓  ${a.username.padEnd(18)} ${a.role.toUpperCase().padEnd(4)} → ${a.team}   [login: ${email} | pass: ${password}]`)
    created++
  }

  console.log(`\n✅  Terminé — ${created} compte(s) créé(s).`)
}

seed()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => client.close())
