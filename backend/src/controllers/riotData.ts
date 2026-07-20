import { Request, Response } from 'express'
import db from '../db'
import { syncTeam } from '../services/riotSync'
import { groupBOs, aggregateScrims, type ScrimGame } from '../utils/scrims'

const ROLE: Record<string, string> = { TOP: 'TOP', JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' }
const QUEUE: Record<number, string> = { 420: 'SoloQ', 440: 'Flex', 0: 'Scrim / Custom', 400: 'Normal', 430: 'Normal', 700: 'Clash', 450: 'ARAM' }

async function teamPlayers(teamId: number): Promise<Array<{ id: number; username: string; puuid: string | null }>> {
  return db.prepare(
    'SELECT id, username, puuid FROM users WHERE team_id = ? AND is_active = 1'
  ).all<{ id: number; username: string; puuid: string | null }>(teamId)
}

const cs = (p: any) => (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)

/** POST /api/sync — déclenche une synchro (debounce 15 min sauf ?force=1). */
export async function syncNow(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  if (!teamId) { res.json({ players: 0, added: 0, skipped: false }); return }
  const result = await syncTeam(teamId, { force: req.query.force === '1' })
  res.json(result)
}

/** GET /api/scrims — BOs regroupés + agrégats + comps par game (nos joueurs / adversaires). */
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
  const detail = new Map<string, { ours: any[]; enemies: string[] }>()

  for (const r of rows) {
    let parsed: any
    try { parsed = JSON.parse(r.data) } catch { continue }
    const parts: any[] = parsed?.info?.participants ?? []
    const ours = parts.filter(p => puuidToUser.has(p.puuid))
    if (ours.length === 0) continue
    const side = ours[0].teamId as 100 | 200
    games.push({
      matchId: r.match_id, gameStart: r.game_start, duration: r.duration,
      ourUserIds: ours.map(p => puuidToUser.get(p.puuid)!.id),
      side, win: !!ours[0].win,
      enemyPuuids: parts.filter(p => p.teamId !== side).map(p => p.puuid),
    })
    detail.set(r.match_id, {
      ours: ours.map(p => ({
        userId: puuidToUser.get(p.puuid)!.id,
        username: puuidToUser.get(p.puuid)!.username,
        champion: p.championName, kills: p.kills, deaths: p.deaths, assists: p.assists, cs: cs(p),
      })),
      enemies: parts.filter(p => p.teamId !== side).map(p => p.championName),
    })
  }

  const series = groupBOs(games).map(s => ({
    seriesId: s.seriesId,
    total: s.total, wins: s.wins, losses: s.losses, seriesWin: s.seriesWin, gameStart: s.gameStart,
    matches: s.matches.map(m => ({
      matchId: m.matchId, gameStart: m.gameStart, duration: m.duration, side: m.side, win: m.win,
      ...(detail.get(m.matchId) ?? { ours: [], enemies: [] }),
    })),
  }))

  res.json({ stats: aggregateScrims(games), series })
}

/** Games ranked (soloq/flex) enrichies (KDA + comps) depuis le cache. */
async function rankedGames(category: 'soloq' | 'flex', userIds: number[]) {
  if (userIds.length === 0) return []
  const ph = userIds.map(() => '?').join(',')
  const rows = await db.prepare(`
    SELECT rm.match_id, rm.game_start, rm.duration, rm.data, rmu.user_id, rmu.puuid, rmu.champion, rmu.win
    FROM riot_match rm
    JOIN riot_match_user rmu ON rmu.match_id = rm.match_id
    WHERE rm.category = ? AND rmu.user_id IN (${ph})
    ORDER BY rm.game_start DESC
  `).all<{ match_id: string; game_start: number; duration: number; data: string; user_id: number; puuid: string; champion: string; win: number }>(category, ...userIds)

  return rows.map(r => {
    let kills = 0, deaths = 0, assists = 0, csv = 0
    let allies: string[] = [], enemies: string[] = []
    try {
      const parts: any[] = JSON.parse(r.data)?.info?.participants ?? []
      const me = parts.find(p => p.puuid === r.puuid)
      if (me) {
        kills = me.kills; deaths = me.deaths; assists = me.assists; csv = cs(me)
        allies = parts.filter(p => p.teamId === me.teamId).map(p => p.championName)
        enemies = parts.filter(p => p.teamId !== me.teamId).map(p => p.championName)
      }
    } catch { /* données illisibles */ }
    return {
      match_id: r.match_id, game_start: r.game_start, duration: r.duration,
      user_id: r.user_id, champion: r.champion, win: !!r.win,
      kills, deaths, assists, cs: csv, allies, enemies,
    }
  })
}

/** GET /api/ranked/soloq?userId= — games soloq d'UN joueur (de sa propre team). */
export async function getSoloq(req: Request, res: Response): Promise<void> {
  const userId = Number(req.query.userId)
  if (!userId) { res.status(400).json({ error: 'userId requis' }); return }
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

/**
 * GET /api/game/:matchId?focus=<userId>
 * Renvoie le match NORMALISÉ pour la page d'analyse (participants + objectifs + vision).
 * `isUser` marque le joueur "focus" (param focus, sinon le demandeur). Scopé à la team.
 */
export async function getGame(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  const matchId = req.params.matchId

  const link = await db.prepare(`
    SELECT rmu.puuid FROM riot_match_user rmu
    JOIN users u ON u.id = rmu.user_id
    WHERE rmu.match_id = ? AND u.team_id = ?
  `).all<{ puuid: string }>(matchId, teamId)
  if (link.length === 0) { res.status(404).json({ error: 'Match introuvable' }); return }

  const row = await db.prepare('SELECT data FROM riot_match WHERE match_id = ?').get<{ data: string }>(matchId)
  if (!row) { res.status(404).json({ error: 'Match introuvable dans le cache' }); return }
  const info = JSON.parse(row.data).info

  // Joueur "focus" : ?focus=userId → son puuid, sinon le demandeur, sinon un joueur de la team
  let focusPuuid: string | null = null
  const focusUserId = Number(req.query.focus) || req.user!.userId
  const fu = await db.prepare('SELECT puuid FROM users WHERE id = ?').get<{ puuid: string | null }>(focusUserId)
  focusPuuid = fu?.puuid ?? link[0].puuid

  const participants = info.participants.map((p: any) => ({
    name: p.riotIdGameName || p.summonerName || '?',
    tag: p.riotIdTagline || '',
    champion: p.championName,
    teamId: p.teamId,
    role: ROLE[p.teamPosition] ?? (p.teamPosition || ''),
    kills: p.kills, deaths: p.deaths, assists: p.assists,
    gold: p.goldEarned, cs: cs(p),
    damage: p.totalDamageDealtToChampions, vision: p.visionScore,
    win: p.win, isUser: p.puuid === focusPuuid,
    wardsPlaced: p.wardsPlaced ?? 0, wardsKilled: p.wardsKilled ?? 0,
    controlWards: p.visionWardsBoughtInGame ?? 0, turretKills: p.turretKills ?? 0,
  }))

  const teams = (info.teams ?? []).map((t: any) => ({
    teamId: t.teamId, win: t.win, dragonTypes: [],
    objectives: {
      baron: t.objectives?.baron?.kills ?? 0,
      dragon: t.objectives?.dragon?.kills ?? 0,
      horde: t.objectives?.horde?.kills ?? 0,
      riftHerald: t.objectives?.riftHerald?.kills ?? 0,
      tower: t.objectives?.tower?.kills ?? 0,
      inhibitor: t.objectives?.inhibitor?.kills ?? 0,
    },
  }))

  const focusP = participants.find((p: any) => p.isUser)
  res.json({
    matchId,
    duration: Math.round(info.gameDuration / 60),
    queueLabel: QUEUE[info.queueId] ?? info.gameMode,
    participants, teams,
    date: new Date(info.gameStartTimestamp).toISOString().slice(0, 10),
    result: focusP ? (focusP.win ? 'win' : 'loss') : null,
  })
}
