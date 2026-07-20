import { Request, Response } from 'express'
import db from '../db'

/**
 * Équipes adverses scoutées, sauvegardées et PARTAGÉES au niveau team
 * (owner_team_id) — n'importe quel membre voit l'historique.
 */

const CATEGORIES = ['scrim', 'tournoi', 'autre']

interface ScoutPlayerInput { riotId: string; gameName?: string; tagLine?: string }

/** POST /api/scout/teams — sauvegarde une équipe scoutée. */
export async function saveScoutTeam(req: Request, res: Response): Promise<void> {
  const ownerTeamId = req.user!.teamId
  if (!ownerTeamId) { res.status(400).json({ error: 'Aucune team' }); return }

  const { name, category, region, players } = req.body as {
    name?: string; category?: string; region?: string; players?: ScoutPlayerInput[]
  }
  if (!name?.trim()) { res.status(400).json({ error: 'Nom requis' }); return }
  if (!Array.isArray(players) || players.length === 0) { res.status(400).json({ error: 'Au moins un joueur requis' }); return }

  const cat = CATEGORIES.includes(category ?? '') ? category : 'autre'
  const cleanPlayers = players
    .filter(p => p?.riotId)
    .map(p => ({ riotId: p.riotId, gameName: p.gameName ?? null, tagLine: p.tagLine ?? null }))

  const r = await db.prepare(
    'INSERT INTO scout_team (owner_team_id, name, category, region, players) VALUES (?, ?, ?, ?, ?)'
  ).run(ownerTeamId, name.trim(), cat, region ?? 'euw', JSON.stringify(cleanPlayers))

  const row = await db.prepare('SELECT * FROM scout_team WHERE id = ?').get<any>(r.lastInsertRowid)
  res.status(201).json({ ...row, players: JSON.parse(row.players) })
}

/** GET /api/scout/teams — liste des équipes scoutées de la team (par catégorie optionnelle). */
export async function listScoutTeams(req: Request, res: Response): Promise<void> {
  const ownerTeamId = req.user!.teamId
  if (!ownerTeamId) { res.json([]); return }

  const cat = req.query.category as string | undefined
  const rows = cat && CATEGORIES.includes(cat)
    ? await db.prepare('SELECT * FROM scout_team WHERE owner_team_id = ? AND category = ? ORDER BY created_at DESC').all<any>(ownerTeamId, cat)
    : await db.prepare('SELECT * FROM scout_team WHERE owner_team_id = ? ORDER BY created_at DESC').all<any>(ownerTeamId)

  res.json(rows.map(r => ({ ...r, players: safeParse(r.players) })))
}

/** DELETE /api/scout/teams/:id */
export async function deleteScoutTeam(req: Request, res: Response): Promise<void> {
  const ownerTeamId = req.user!.teamId
  const r = await db.prepare('DELETE FROM scout_team WHERE id = ? AND owner_team_id = ?').run(req.params.id, ownerTeamId)
  if (r.changes === 0) { res.status(404).json({ error: 'Introuvable' }); return }
  res.json({ ok: true })
}

function safeParse(s: string): unknown[] {
  try { return JSON.parse(s) } catch { return [] }
}
