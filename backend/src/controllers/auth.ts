import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db'
import type { User, Team } from '../types'

const MAX_PER_ROLE: Record<string, number> = {
  top: 1, jgl: 1, mid: 1, adc: 1, sup: 1,
  sub: 2, coach: 2, manager: 2,
}

function signToken(user: User): string {
  return jwt.sign(
    { userId: user.id, username: user.username, teamId: user.team_id, gameRole: user.game_role },
    process.env.JWT_SECRET ?? 'fallback',
    { expiresIn: '7d' }
  )
}

function userPayload(user: User, teamName: string | null) {
  return {
    id:        user.id,
    username:  user.username,
    email:     user.email,
    game_role: user.game_role,
    is_starter: user.is_starter,
    team_id:   user.team_id,
    team_name: teamName ?? null,
    team_slug: null as string | null,  // populated below
    riot_id:   user.riot_id ?? null,
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  const { username, email, password, team_id, game_role } = req.body

  if (!username || !email || !password || !team_id || !game_role) {
    res.status(400).json({ error: 'Tous les champs sont requis' })
    return
  }

  const existing = await db.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  ).get(username, email)
  if (existing) {
    res.status(409).json({ error: 'Pseudo ou email déjà utilisé' })
    return
  }

  const team = await db.prepare('SELECT * FROM teams WHERE id = ?').get<Team>(team_id)
  if (!team) {
    res.status(404).json({ error: 'Équipe introuvable' })
    return
  }

  const roleCount = (await db.prepare(
    'SELECT COUNT(*) as c FROM users WHERE team_id = ? AND game_role = ? AND is_active = 1'
  ).get<{ c: number }>(team_id, game_role))!.c

  if (roleCount >= (MAX_PER_ROLE[game_role] ?? 1)) {
    res.status(409).json({ error: `Le rôle ${game_role.toUpperCase()} est complet dans ${team.name}` })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const is_starter = ['top', 'jgl', 'mid', 'adc', 'sup'].includes(game_role) ? 1 : 0

  const result = await db.prepare(
    'INSERT INTO users (username, email, password_hash, team_id, game_role, is_starter) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(username, email, passwordHash, team_id, game_role, is_starter)

  const user = (await db.prepare('SELECT * FROM users WHERE id = ?').get<User>(result.lastInsertRowid))!

  const payload = userPayload(user, team.name)
  payload.team_slug = team.slug ?? null

  res.status(201).json({ token: signToken(user), user: payload })
}

export async function login(req: Request, res: Response): Promise<void> {
  const { identifier, password } = req.body

  if (!identifier || !password) {
    res.status(400).json({ error: 'Identifiants requis' })
    return
  }

  const user = await db.prepare(
    'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1'
  ).get<User>(identifier, identifier)

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Identifiants incorrects' })
    return
  }

  const team = user.team_id
    ? await db.prepare('SELECT * FROM teams WHERE id = ?').get<Team>(user.team_id)
    : null

  const payload = userPayload(user, team?.name ?? null)
  payload.team_slug = team?.slug ?? null

  res.json({ token: signToken(user), user: payload })
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { username, email, currentPassword, newPassword, riot_id } = req.body

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get<User>(userId)
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return }

  // Changement de mot de passe
  if (newPassword) {
    if (!currentPassword) { res.status(400).json({ error: 'Mot de passe actuel requis' }); return }
    const ok = await bcrypt.compare(currentPassword, user.password_hash)
    if (!ok) { res.status(401).json({ error: 'Mot de passe actuel incorrect' }); return }
    if (newPassword.length < 6) { res.status(400).json({ error: 'Nouveau mot de passe trop court (6 car. min.)' }); return }
    const hash = await bcrypt.hash(newPassword, 12)
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId)
  }

  // Changement username
  if (username && username !== user.username) {
    const exists = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId)
    if (exists) { res.status(409).json({ error: 'Ce pseudo est déjà pris' }); return }
    await db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId)
  }

  // Changement email
  if (email && email !== user.email) {
    const exists = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId)
    if (exists) { res.status(409).json({ error: 'Cet email est déjà utilisé' }); return }
    await db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, userId)
  }

  // Changement riot_id
  if (riot_id !== undefined) {
    await db.prepare('UPDATE users SET riot_id = ? WHERE id = ?').run(riot_id, userId)
  }

  // Retourne le profil mis à jour
  const updated = await db.prepare(`
    SELECT u.id, u.username, u.email, u.team_id, u.game_role, u.is_starter, u.riot_id,
           t.name as team_name, t.slug as team_slug
    FROM users u LEFT JOIN teams t ON t.id = u.team_id WHERE u.id = ?
  `).get(userId)

  res.json(updated)
}

export async function me(req: Request, res: Response): Promise<void> {
  const row = await db.prepare(`
    SELECT u.id, u.username, u.email, u.team_id, u.game_role, u.is_starter, u.riot_id,
           t.name as team_name, t.slug as team_slug
    FROM users u
    LEFT JOIN teams t ON t.id = u.team_id
    WHERE u.id = ?
  `).get(req.user!.userId)

  if (!row) { res.status(404).json({ error: 'Utilisateur introuvable' }); return }
  res.json(row)
}
