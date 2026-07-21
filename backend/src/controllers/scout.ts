import { Request, Response } from 'express'
import db from '../db'
import { analyzeScoutTeam } from '../services/scoutAnalyze'

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

  const { name, category, region, players, analysis, cards } = req.body as {
    name?: string; category?: string; region?: string; players?: ScoutPlayerInput[]; analysis?: unknown; cards?: unknown
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

  // Persiste l'analyse + les cartes joueurs (pas de recalcul ni re-fetch au rechargement)
  if (analysis || cards) {
    await db.prepare("UPDATE scout_team SET analysis = ?, cards = ?, analyzed_at = datetime('now') WHERE id = ?")
      .run(analysis ? JSON.stringify(analysis) : null, cards ? JSON.stringify(cards) : null, r.lastInsertRowid)
  }

  const row = await db.prepare('SELECT * FROM scout_team WHERE id = ?').get<any>(r.lastInsertRowid)
  res.status(201).json({
    ...row,
    players: JSON.parse(row.players),
    analysis: row.analysis ? parseJson(row.analysis) : null,
    cards: row.cards ? parseJson(row.cards) : null,
  })
}

/** GET /api/scout/teams — liste des équipes scoutées de la team (par catégorie optionnelle). */
export async function listScoutTeams(req: Request, res: Response): Promise<void> {
  const ownerTeamId = req.user!.teamId
  if (!ownerTeamId) { res.json([]); return }

  const cat = req.query.category as string | undefined
  const rows = cat && CATEGORIES.includes(cat)
    ? await db.prepare('SELECT * FROM scout_team WHERE owner_team_id = ? AND category = ? ORDER BY created_at DESC').all<any>(ownerTeamId, cat)
    : await db.prepare('SELECT * FROM scout_team WHERE owner_team_id = ? ORDER BY created_at DESC').all<any>(ownerTeamId)

  res.json(rows.map(r => ({
    ...r,
    players: safeParse(r.players),
    analysis: r.analysis ? parseJson(r.analysis) : null,
    cards: r.cards ? parseJson(r.cards) : null,
  })))
}

/** DELETE /api/scout/teams/:id */
export async function deleteScoutTeam(req: Request, res: Response): Promise<void> {
  const ownerTeamId = req.user!.teamId
  const r = await db.prepare('DELETE FROM scout_team WHERE id = ? AND owner_team_id = ?').run(req.params.id, ownerTeamId)
  if (r.changes === 0) { res.status(404).json({ error: 'Introuvable' }); return }
  res.json({ ok: true })
}

/**
 * POST /api/scout/analyze — analyse une équipe (picks/bans, duos, customs).
 * Body : { riotIds?: string[], region?, scoutTeamId? }. Si scoutTeamId fourni,
 * le résultat est mis en cache sur la ligne (partagé équipe).
 */
export async function analyzeScout(req: Request, res: Response): Promise<void> {
  const ownerTeamId = req.user!.teamId
  const { riotIds, region, scoutTeamId } = req.body as { riotIds?: string[]; region?: string; scoutTeamId?: number }

  let ids: string[] = Array.isArray(riotIds) ? riotIds.filter(Boolean) : []
  let reg = region ?? 'euw'

  if (scoutTeamId) {
    const row = await db.prepare('SELECT players, region FROM scout_team WHERE id = ? AND owner_team_id = ?')
      .get<{ players: string; region: string }>(scoutTeamId, ownerTeamId)
    if (!row) { res.status(404).json({ error: 'Équipe introuvable' }); return }
    ids = (safeParse(row.players) as { riotId?: string }[]).map(p => p.riotId).filter((x): x is string => !!x)
    reg = row.region ?? reg
  }
  if (ids.length === 0) { res.status(400).json({ error: 'Aucun joueur à analyser' }); return }

  const analysis = await analyzeScoutTeam(ids, reg)

  if (scoutTeamId) {
    await db.prepare("UPDATE scout_team SET analysis = ?, analyzed_at = datetime('now') WHERE id = ? AND owner_team_id = ?")
      .run(JSON.stringify(analysis), scoutTeamId, ownerTeamId)
  }
  res.json(analysis)
}

function safeParse(s: string): unknown[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}
function parseJson(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}
