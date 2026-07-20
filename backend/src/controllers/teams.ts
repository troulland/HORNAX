import { Request, Response } from 'express'
import db from '../db'
import type { Team } from '../types'

export async function getTeams(_req: Request, res: Response): Promise<void> {
  const teams = await db.prepare(`
    SELECT
      t.id, t.name, t.slug, t.max_players, t.created_at,
      COUNT(u.id) as current_players
    FROM teams t
    LEFT JOIN users u ON u.team_id = t.id AND u.is_active = 1
    GROUP BY t.id
  `).all<Team & { current_players: number }>()

  res.json(teams.map(t => ({
    ...t,
    availableSlots: t.max_players - t.current_players,
  })))
}

export async function getTeamRoster(req: Request, res: Response): Promise<void> {
  const team = await db.prepare('SELECT * FROM teams WHERE id = ?').get<Team>(req.params.id)
  if (!team) { res.status(404).json({ message: 'Équipe introuvable' }); return }

  const players = await db.prepare(`
    SELECT id, username, game_role, is_starter, created_at
    FROM users
    WHERE team_id = ? AND is_active = 1
    ORDER BY CASE game_role
      WHEN 'top' THEN 1 WHEN 'jgl' THEN 2 WHEN 'mid' THEN 3
      WHEN 'adc' THEN 4 WHEN 'sup' THEN 5 WHEN 'sub' THEN 6
      WHEN 'coach' THEN 7 WHEN 'manager' THEN 8 ELSE 9 END
  `).all(req.params.id)

  res.json({ team, players })
}
