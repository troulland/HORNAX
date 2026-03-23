/**
 * Seed HORNAX ROYALTY accounts
 * Run: npx ts-node src/seed-royalty.ts
 */
import bcrypt from 'bcryptjs'
import db from './db'

const PASSWORD = 'azerty'

const players: Array<{ username: string; role: string }> = [
  { username: 'Custøm Name ld', role: 'top'  },
  { username: 'math1S',         role: 'jgl'  },
  { username: 'MILF Gourmande', role: 'mid'  },
  { username: 'Divergent Star', role: 'adc'  },
  { username: 'T1KK',           role: 'sup'  },
]

async function seed() {
  const team = db.prepare("SELECT id FROM teams WHERE slug = 'hornax-royalty'").get() as { id: number } | undefined
  if (!team) {
    console.error('❌  Team hornax-royalty not found. Start the server once to seed teams first.')
    process.exit(1)
  }

  const hash = await bcrypt.hash(PASSWORD, 12)

  for (const p of players) {
    const email = `${p.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@hornax-royalty.gg`
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(p.username)
    if (existing) {
      console.log(`⏭  ${p.username} already exists — skipped`)
      continue
    }
    db.prepare(
      'INSERT INTO users (username, email, password_hash, team_id, game_role, is_starter) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(p.username, email, hash, team.id, p.role)
    console.log(`✓  Created ${p.username} (${p.role.toUpperCase()})`)
  }

  console.log('\nDone. Password for all accounts: azerty')
}

seed().catch(console.error)
