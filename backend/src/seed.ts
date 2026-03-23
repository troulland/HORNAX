import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import bcrypt from 'bcryptjs'
import path from 'path'

const dbPath = path.resolve(__dirname, '../../data/hornax.db')
const db     = new DatabaseSync(dbPath)

const PLAYERS = [
  { username: 'Inuripse', email: 'inuripse@hornax.gg', game_role: 'top' },
  { username: '222',      email: '222@hornax.gg',      game_role: 'jgl' },
  { username: 'Souzz',    email: 'souzz@hornax.gg',    game_role: 'adc' },
  { username: 'MaxGZ',    email: 'maxgz@hornax.gg',    game_role: 'sup' },
] as const

;(async () => {
  console.log('\n🌱 HORNAX — seed des comptes joueurs\n')

  const team = db.prepare("SELECT id FROM teams WHERE slug = 'hornax'").get() as { id: number } | undefined
  if (!team) {
    console.error('❌  Team HORNAX introuvable. Lance le backend une fois d\'abord (npm run dev) pour créer les tables.')
    process.exit(1)
  }

  const hash = await bcrypt.hash('azerty', 12)
  let created = 0

  for (const p of PLAYERS) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(p.username)
    if (existing) {
      console.log(`  ⚠  ${p.username} existe déjà, ignoré`)
      continue
    }
    const isStarter = ['top', 'jgl', 'mid', 'adc', 'sup'].includes(p.game_role) ? 1 : 0
    db.prepare(
      'INSERT INTO users (username, email, password_hash, team_id, game_role, is_starter) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(p.username, p.email, hash, team.id, p.game_role, isStarter)
    console.log(`  ✓  ${p.username} (${p.game_role.toUpperCase()}) créé`)
    created++
  }

  console.log(`\n✅  Terminé — ${created} compte(s) créé(s)`)
  console.log('   Identifiants : username = ign, mot de passe = azerty\n')
})()
