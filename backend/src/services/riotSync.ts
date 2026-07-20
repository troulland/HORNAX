import db from '../db'
import { riotGet, RiotNotFound } from './riotLimiter'
import { classifyQueue } from '../utils/scrims'

/**
 * Synchronisation des matchs Riot vers le cache (riot_match / riot_match_user).
 * Incrémental (ne re-fetch jamais un match connu) + debounce 15 min + PUUID caché.
 */

const ROUTING: Record<string, string> = {
  euw: 'europe', eune: 'europe', tr: 'europe', ru: 'europe',
  na: 'americas', br: 'americas', lan: 'americas', las: 'americas',
  kr: 'asia', jp: 'asia', oce: 'sea',
}

const enc = encodeURIComponent
const DEBOUNCE_MS = 15 * 60 * 1_000

interface UserRow {
  id: number
  riot_id: string | null
  puuid: string | null
  team_id: number | null
  last_synced_at: string | null
}

/** Résout et met en cache le PUUID d'un joueur (1 seul appel Riot par joueur, jamais répété). */
export async function resolvePuuid(user: UserRow, region = 'euw'): Promise<string | null> {
  if (user.puuid) return user.puuid
  if (!user.riot_id) return null
  const [gameName, tagLine] = user.riot_id.split('#')
  if (!gameName || !tagLine) return null

  const routing = ROUTING[region] ?? 'europe'
  try {
    const acc = await riotGet<{ puuid: string }>(
      `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${enc(gameName)}/${enc(tagLine)}`
    )
    await db.prepare('UPDATE users SET puuid = ? WHERE id = ?').run(acc.puuid, user.id)
    return acc.puuid
  } catch (e) {
    if (e instanceof RiotNotFound) return null
    throw e
  }
}

async function upsertMatch(m: any, matchId: string, region: string, puuidToUser: Map<string, number>): Promise<void> {
  const cat = classifyQueue(m.info.queueId)
  await db.prepare(
    `INSERT OR REPLACE INTO riot_match (match_id, queue_id, category, game_start, duration, region, data)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(matchId, m.info.queueId, cat, m.info.gameStartTimestamp, m.info.gameDuration, region, JSON.stringify(m))

  for (const p of m.info.participants) {
    const uid = puuidToUser.get(p.puuid)
    if (uid !== undefined) {
      await db.prepare(
        `INSERT OR REPLACE INTO riot_match_user (match_id, user_id, puuid, champion, win, team_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(matchId, uid, p.puuid, p.championName, p.win ? 1 : 0, p.teamId)
    }
  }
}

export interface SyncResult { players: number; added: number; skipped: boolean }

/**
 * Synchronise tous les joueurs actifs d'une team.
 * @param opts.force  ignore le debounce
 * @param opts.count  nb de matchs récents à examiner par joueur (défaut 20)
 */
export async function syncTeam(
  teamId: number,
  opts: { force?: boolean; count?: number; region?: string } = {}
): Promise<SyncResult> {
  const region  = opts.region ?? 'euw'
  const routing = ROUTING[region] ?? 'europe'
  const count   = opts.count ?? 20

  const users = await db.prepare(
    'SELECT id, riot_id, puuid, team_id, last_synced_at FROM users WHERE team_id = ? AND is_active = 1 AND riot_id IS NOT NULL'
  ).all<UserRow>(teamId)

  if (users.length === 0) return { players: 0, added: 0, skipped: false }

  // Debounce : si tous les joueurs ont été sync il y a < 15 min → on lit le cache
  if (!opts.force) {
    const now = Date.now()
    const fresh = users.every(
      (u) => u.last_synced_at && now - Date.parse(u.last_synced_at.replace(' ', 'T') + 'Z') < DEBOUNCE_MS
    )
    if (fresh) return { players: users.length, added: 0, skipped: true }
  }

  // Résout les PUUID → map puuid → userId (pour tagger nos joueurs dans chaque match)
  const puuidToUser = new Map<string, number>()
  for (const u of users) {
    const p = await resolvePuuid(u, region)
    if (p) puuidToUser.set(p, u.id)
  }

  const cached = new Set(
    (await db.prepare('SELECT match_id FROM riot_match').all<{ match_id: string }>()).map((r) => r.match_id)
  )

  let added = 0
  for (const puuid of puuidToUser.keys()) {
    const ids = await riotGet<string[]>(
      `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`
    )
    for (const id of ids) {
      if (cached.has(id)) continue
      const m = await riotGet<any>(`https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`)
      cached.add(id)
      if (classifyQueue(m.info.queueId) === 'other') continue  // on ignore ARAM/URF/etc.
      await upsertMatch(m, id, region, puuidToUser)
      added++
    }
  }

  await db.prepare(
    "UPDATE users SET last_synced_at = datetime('now') WHERE team_id = ? AND is_active = 1 AND riot_id IS NOT NULL"
  ).run(teamId)

  return { players: users.length, added, skipped: false }
}
