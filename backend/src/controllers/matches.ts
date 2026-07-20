import { Request, Response } from 'express'
import db from '../db'

export async function getMatches(req: Request, res: Response): Promise<void> {
  const teamId  = req.user!.teamId
  const upcoming = req.query.upcoming === '1'
  const limit   = Number(req.query.limit ?? 100)

  const userId = req.user!.userId

  const rows = upcoming
    ? await db.prepare(`
        SELECT * FROM matches
        WHERE team_id = ? AND result IS NULL AND date >= date('now')
          AND (context = 'team' OR created_by = ?)
        ORDER BY date ASC, time ASC LIMIT ?
      `).all(teamId, userId, limit)
    : await db.prepare(`
        SELECT * FROM matches
        WHERE team_id = ? AND result IS NOT NULL
          AND (context = 'team' OR created_by = ?)
        ORDER BY date DESC LIMIT ?
      `).all(teamId, userId, limit)

  res.json(rows)
}

export async function createMatch(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  const userId = req.user!.userId
  const { opponent, date, time, type, result, notes, opponent_logo, series_id, riot_data } = req.body

  if (!opponent || !date) {
    res.status(400).json({ error: 'Adversaire et date requis' }); return
  }

  // Imported games (riot_data present) have no context until user assigns them manually
  const context = riot_data ? null : 'team'

  const r = await db.prepare(`
    INSERT INTO matches (team_id, opponent, date, time, type, result, notes, created_by, opponent_logo, series_id, riot_data, context)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(teamId, opponent.trim(), date, time ?? null, type ?? 'scrim',
         result ?? null, notes ?? null, userId, opponent_logo ?? null, series_id ?? null,
         riot_data ?? null, context)

  res.status(201).json(await db.prepare('SELECT * FROM matches WHERE id = ?').get(r.lastInsertRowid))
}

export async function updateMatch(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  const { id } = req.params
  const existing = await db.prepare('SELECT * FROM matches WHERE id = ? AND team_id = ?').get(id, teamId)
  if (!existing) { res.status(404).json({ error: 'Match introuvable' }); return }

  const { opponent, date, time, type, result, notes, opponent_logo, series_id } = req.body
  await db.prepare(`
    UPDATE matches SET
      opponent      = COALESCE(?, opponent),
      date          = COALESCE(?, date),
      time          = ?,
      type          = COALESCE(?, type),
      result        = ?,
      notes         = ?,
      opponent_logo = ?,
      series_id     = ?
    WHERE id = ?
  `).run(
    opponent ?? null, date ?? null, time ?? null, type ?? null,
    result ?? null, notes ?? null, opponent_logo ?? null, series_id ?? null,
    id
  )

  res.json(await db.prepare('SELECT * FROM matches WHERE id = ?').get(id))
}

export async function deleteMatch(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  const { id } = req.params
  const r = await db.prepare('DELETE FROM matches WHERE id = ? AND team_id = ?').run(id, teamId)
  if (r.changes === 0) { res.status(404).json({ error: 'Match introuvable' }); return }
  res.json({ ok: true })
}

export async function groupMatches(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  const { ids, series_id, opponent, opponent_logo, context } = req.body
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids requis' }); return
  }
  const placeholders = ids.map(() => '?').join(',')
  await db.prepare(`
    UPDATE matches
    SET series_id     = ?,
        opponent      = COALESCE(?, opponent),
        opponent_logo = COALESCE(?, opponent_logo),
        context       = ?
    WHERE id IN (${placeholders}) AND team_id = ?
  `).run(
    series_id ?? null,
    opponent?.trim() ?? null,
    opponent_logo ?? null,
    context ?? 'team',
    ...ids, teamId,
  )
  const updated = await db.prepare(`SELECT * FROM matches WHERE id IN (${placeholders}) AND team_id = ?`).all(...ids, teamId)
  res.json(updated)
}
