import { Request, Response } from 'express'
import db from '../db'

interface AvailRow { username: string; date: string; status: string }

// GET /api/availability?weekStart=YYYY-MM-DD
export function getWeekAvailability(req: Request, res: Response): void {
  const weekStart = req.query.weekStart as string
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    res.status(400).json({ error: 'weekStart requis (YYYY-MM-DD)' })
    return
  }

  const teamId = req.user!.teamId
  if (!teamId) { res.json([]); return }

  const dates: string[] = []
  const base = new Date(weekStart + 'T12:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }

  const ph   = dates.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT u.username, a.date, a.status
    FROM availability a
    JOIN users u ON u.id = a.user_id
    WHERE a.team_id = ? AND a.date IN (${ph})
  `).all(teamId, ...dates) as unknown as AvailRow[]

  res.json(rows)
}

// PUT /api/availability  { date, status }
export function setAvailability(req: Request, res: Response): void {
  const { date, status } = req.body
  const userId = req.user!.userId

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date invalide (YYYY-MM-DD)' })
    return
  }
  if (!['available', 'unavailable', 'uncertain'].includes(status)) {
    res.status(400).json({ error: 'status invalide' })
    return
  }

  const user = db.prepare('SELECT team_id FROM users WHERE id = ?').get(userId) as { team_id: number } | undefined
  if (!user?.team_id) { res.status(400).json({ error: 'Utilisateur sans équipe' }); return }

  db.prepare(`
    INSERT INTO availability (user_id, date, status, team_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET status = excluded.status, updated_at = datetime('now')
  `).run(userId, date, status, user.team_id)

  res.json({ ok: true })
}
