import { riotGet, RiotNotFound } from './riotLimiter'
import { classifyQueue } from '../utils/scrims'

/**
 * Analyse d'une équipe adverse scoutée : va chercher l'historique récent des
 * joueurs (throttlé via riotLimiter), puis agrège :
 *  - priorités de pick/ban (champions les plus joués + winrate)
 *  - champions joués ENSEMBLE (mêmes joueurs, même équipe, même game)
 *  - parties custom / tournoi détectées
 *
 * Échantillon borné pour rester raisonnable en temps & quota.
 */

const ROUTING: Record<string, string> = {
  euw: 'europe', eune: 'europe', tr: 'europe', ru: 'europe',
  na: 'americas', br: 'americas', lan: 'americas', las: 'americas',
  kr: 'asia', jp: 'asia', oce: 'sea',
}
const QUEUE_LABEL: Record<number, string> = { 0: 'Custom', 420: 'SoloQ', 440: 'Flex', 400: 'Normal', 430: 'Normal', 700: 'Clash' }

const enc = encodeURIComponent
const PER_PLAYER = 12       // matchs récents (toutes files) par joueur
const PER_TOURNEY = 8       // matchs de tournoi par joueur
const MAX_DETAILS = 70      // plafond de fetch détaillés (borne temps/quota)

export interface ChampStat { champion: string; games: number; wins: number; winRate: number }
export interface Duo { players: string[]; games: number; combos: { champs: string[]; count: number }[] }
export interface CustomGame { matchId: string; date: string; queue: string; win: boolean; players: { name: string; champion: string }[] }
export interface ScoutAnalysis {
  players: { name: string; puuid: string }[]
  pickPriorities: ChampStat[]
  duos: Duo[]
  customs: CustomGame[]
  sampledMatches: number
  truncated: boolean
}

async function resolvePuuid(riotId: string, routing: string): Promise<{ puuid: string; name: string } | null> {
  const [gameName, tagLine] = riotId.split('#')
  if (!gameName || !tagLine) return null
  try {
    const acc = await riotGet<{ puuid: string; gameName: string }>(
      `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${enc(gameName)}/${enc(tagLine)}`
    )
    return { puuid: acc.puuid, name: acc.gameName || gameName }
  } catch (e) {
    if (e instanceof RiotNotFound) return null
    throw e
  }
}

export async function analyzeScoutTeam(riotIds: string[], region = 'euw'): Promise<ScoutAnalysis> {
  const routing = ROUTING[region] ?? 'europe'

  // 1) PUUID des joueurs
  const resolved: { puuid: string; name: string }[] = []
  for (const rid of riotIds) {
    const r = await resolvePuuid(rid, routing)
    if (r) resolved.push(r)
  }
  const puuidToName = new Map(resolved.map(r => [r.puuid, r.name]))
  const puuidSet = new Set(resolved.map(r => r.puuid))

  // 2) IDs de matchs (récents + tournoi), dédupliqués
  const tourneyIds = new Set<string>()
  const allIds = new Set<string>()
  for (const { puuid } of resolved) {
    const base = `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`
    const [general, tourney] = await Promise.all([
      riotGet<string[]>(`${base}?count=${PER_PLAYER}`),
      riotGet<string[]>(`${base}?type=tourney&count=${PER_TOURNEY}`),
    ])
    general.forEach(id => allIds.add(id))
    tourney.forEach(id => { allIds.add(id); tourneyIds.add(id) })
  }

  // 3) Détails (bornés)
  const ids = [...allIds].slice(0, MAX_DETAILS)
  const truncated = allIds.size > MAX_DETAILS

  const champ = new Map<string, { games: number; wins: number }>()
  const duoMap = new Map<string, { players: string[]; games: number; combos: Map<string, number> }>()
  const customs: CustomGame[] = []
  let sampled = 0

  for (const id of ids) {
    let m: any
    try { m = await riotGet<any>(`https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`) } catch { continue }
    const parts: any[] = m?.info?.participants ?? []
    const ours = parts.filter(p => puuidSet.has(p.puuid))
    if (ours.length === 0) continue
    sampled++
    const cat = tourneyIds.has(id) ? 'scrim' : classifyQueue(m.info.queueId)

    // Priorités de pick
    for (const p of ours) {
      const c = champ.get(p.championName) ?? { games: 0, wins: 0 }
      c.games++; if (p.win) c.wins++
      champ.set(p.championName, c)
    }

    // Joués ensemble : joueurs scoutés sur la MÊME équipe
    const byTeam = new Map<number, any[]>()
    for (const p of ours) { const arr = byTeam.get(p.teamId) ?? []; arr.push(p); byTeam.set(p.teamId, arr) }
    for (const group of byTeam.values()) {
      if (group.length < 2) continue
      // toutes les paires du groupe
      for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j]
        const names = [puuidToName.get(a.puuid)!, puuidToName.get(b.puuid)!].sort()
        const key = names.join(' + ')
        const entry = duoMap.get(key) ?? { players: names, games: 0, combos: new Map<string, number>() }
        entry.games++
        const combo = [a.championName, b.championName].sort().join(' + ')
        entry.combos.set(combo, (entry.combos.get(combo) ?? 0) + 1)
        duoMap.set(key, entry)
      }
    }

    // Customs / tournois
    if (cat === 'scrim') {
      customs.push({
        matchId: id,
        date: new Date(m.info.gameStartTimestamp).toISOString().slice(0, 10),
        queue: tourneyIds.has(id) ? 'Tournoi' : (QUEUE_LABEL[m.info.queueId] ?? 'Custom'),
        win: !!ours[0].win,
        players: ours.map(p => ({ name: puuidToName.get(p.puuid)!, champion: p.championName })),
      })
    }
  }

  const pickPriorities: ChampStat[] = [...champ.entries()]
    .map(([champion, s]) => ({ champion, games: s.games, wins: s.wins, winRate: Math.round((s.wins / s.games) * 100) }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 12)

  const duos: Duo[] = [...duoMap.values()]
    .map(d => ({
      players: d.players,
      games: d.games,
      combos: [...d.combos.entries()].map(([c, count]) => ({ champs: c.split(' + '), count })).sort((a, b) => b.count - a.count).slice(0, 3),
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 6)

  return {
    players: resolved,
    pickPriorities,
    duos,
    customs: customs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15),
    sampledMatches: sampled,
    truncated,
  }
}
