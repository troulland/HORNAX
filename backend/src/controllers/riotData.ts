import { Request, Response } from 'express'
import db from '../db'
import { syncTeam } from '../services/riotSync'
import { groupBOs, aggregateScrims, type ScrimGame } from '../utils/scrims'

/** Récupère les user_id + puuid des joueurs actifs d'une team. */
async function teamPlayers(teamId: number): Promise<Array<{ id: number; username: string; puuid: string | null }>> {
  return db.prepare(
    'SELECT id, username, puuid FROM users WHERE team_id = ? AND is_active = 1'
  ).all<{ id: number; username: string; puuid: string | null }>(teamId)
}

/** POST /api/sync — déclenche une synchro (debounce 15 min sauf ?force=1). */
export async function syncNow(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  if (!teamId) { res.json({ players: 0, added: 0, skipped: false }); return }
  const force = req.query.force === '1'
  const result = await syncTeam(teamId, { force })
  res.json(result)
}

/** GET /api/scrims — BOs regroupés + agrégats (winrate, durée, WR bleu/rouge). */
export async function getScrims(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  if (!teamId) { res.json({ stats: null, series: [] }); return }

  const players = await teamPlayers(teamId)
  const puuidToUser = new Map(players.filter(p => p.puuid).map(p => [p.puuid!, p]))

  const rows = await db.prepare(`
    SELECT rm.match_id, rm.game_start, rm.duration, rm.data
    FROM riot_match rm
    WHERE rm.category = 'scrim'
      AND rm.match_id IN (SELECT match_id FROM riot_match_user WHERE user_id IN
        (SELECT id FROM users WHERE team_id = ? AND is_active = 1))
    ORDER BY rm.game_start DESC
  `).all<{ match_id: string; game_start: number; duration: number; data: string }>(teamId)

  const games: ScrimGame[] = []
  for (const r of rows) {
    let parsed: any
    try { parsed = JSON.parse(r.data) } catch { continue }
    const parts: any[] = parsed?.info?.participants ?? []
    const ours = parts.filter(p => puuidToUser.has(p.puuid))
    if (ours.length === 0) continue
    const side = ours[0].teamId as 100 | 200
    games.push({
      matchId: r.match_id,
      gameStart: r.game_start,
      duration: r.duration,
      ourUserIds: ours.map(p => puuidToUser.get(p.puuid)!.id),
      side,
      win: !!ours[0].win,
      enemyPuuids: parts.filter(p => p.teamId !== side).map(p => p.puuid),
    })
  }

  const series = groupBOs(games).map(s => ({
    seriesId: s.seriesId,
    total: s.total, wins: s.wins, losses: s.losses, seriesWin: s.seriesWin, gameStart: s.gameStart,
    matches: s.matches.map(m => ({
      matchId: m.matchId, gameStart: m.gameStart, duration: m.duration, side: m.side, win: m.win,
    })),
  }))

  res.json({ stats: aggregateScrims(games), series })
}

/** Construit la liste de games ranked (soloq/flex) depuis le cache pour un set de users. */
async function rankedGames(category: 'soloq' | 'flex', userIds: number[]) {
  if (userIds.length === 0) return []
  const ph = userIds.map(() => '?').join(',')
  const rows = await db.prepare(`
    SELECT rm.match_id, rm.game_start, rm.duration, rmu.user_id, rmu.champion, rmu.win
    FROM riot_match rm
    JOIN riot_match_user rmu ON rmu.match_id = rm.match_id
    WHERE rm.category = ? AND rmu.user_id IN (${ph})
    ORDER BY rm.game_start DESC
  `).all<{ match_id: string; game_start: number; duration: number; user_id: number; champion: string; win: number }>(category, ...userIds)
  return rows.map(r => ({ ...r, win: !!r.win }))
}

/** GET /api/ranked/soloq?userId= — games soloq d'UN joueur (de sa propre team). */
export async function getSoloq(req: Request, res: Response): Promise<void> {
  const userId = Number(req.query.userId)
  if (!userId) { res.status(400).json({ error: 'userId requis' }); return }

  // Autorisation : le joueur demandé doit appartenir à la team du demandeur
  const teamId = req.user!.teamId
  const target = await db.prepare('SELECT id FROM users WHERE id = ? AND team_id = ?').get(userId, teamId)
  if (!target) { res.status(403).json({ error: 'Joueur hors de ta team' }); return }

  res.json({ games: await rankedGames('soloq', [userId]) })
}

/** GET /api/ranked/flex — games flex de toute la team. */
export async function getFlex(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  if (!teamId) { res.json({ games: [] }); return }
  const players = await teamPlayers(teamId)
  res.json({ games: await rankedGames('flex', players.map(p => p.id)) })
}

/** GET /api/game/:matchId — match brut (cache), uniquement si un joueur de la team y a participé. */
export async function getGame(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  const matchId = req.params.matchId

  // Autorisation : le match doit impliquer au moins un joueur de la team du demandeur
  const link = await db.prepare(`
    SELECT 1 FROM riot_match_user rmu
    JOIN users u ON u.id = rmu.user_id
    WHERE rmu.match_id = ? AND u.team_id = ? LIMIT 1
  `).get(matchId, teamId)
  if (!link) { res.status(404).json({ error: 'Match introuvable' }); return }

  const row = await db.prepare('SELECT data FROM riot_match WHERE match_id = ?').get<{ data: string }>(matchId)
  if (!row) { res.status(404).json({ error: 'Match introuvable dans le cache' }); return }
  res.json(JSON.parse(row.data))
}
