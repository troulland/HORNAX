import { Request, Response } from 'express'
import db from '../db'

export async function updateRiotId(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { riot_id } = req.body
  if (riot_id === undefined) { res.status(400).json({ error: 'riot_id requis' }); return }
  db.prepare('UPDATE users SET riot_id = ? WHERE id = ?').run(riot_id || null, userId)
  res.json({ riot_id: riot_id || null })
}

const ROUTING: Record<string, string> = {
  euw: 'europe', eune: 'europe', tr: 'europe', ru: 'europe',
  na: 'americas', br: 'americas', lan: 'americas', las: 'americas',
  kr: 'asia', jp: 'asia',
  oce: 'sea',
}

const PLATFORM: Record<string, string> = {
  euw: 'euw1', eune: 'eun1', tr: 'tr1', ru: 'ru1',
  na: 'na1', br: 'br1', lan: 'la1', las: 'la2',
  kr: 'kr', jp: 'jp1', oce: 'oc1',
}

async function riotFetch(url: string): Promise<any> {
  const key = process.env.RIOT_API_KEY
  if (!key || key.startsWith('RGAPI-REMPLACE')) throw new Error('Clé API Riot non configurée')
  const res = await fetch(url, { headers: { 'X-Riot-Token': key } })
  if (res.status === 429) throw new Error('Rate limit Riot')
  if (res.status === 404) throw new Error('Compte Riot introuvable')
  if (res.status === 403) throw new Error('Clé API expirée')
  if (!res.ok) throw new Error(`Erreur Riot API (${res.status})`)
  return res.json()
}

const QUEUE_LABEL: Record<number, string> = {
  420: 'Solo/Duo', 440: 'Flex', 400: 'Normal', 430: 'Normal', 450: 'ARAM', 490: 'Quickplay',
}

export async function getPlayerProfile(req: Request, res: Response): Promise<void> {
  const userId = parseInt(req.params.userId)
  if (isNaN(userId)) { res.status(400).json({ error: 'userId invalide' }); return }

  const user = db.prepare(`
    SELECT u.id, u.username, u.game_role, u.is_starter, u.riot_id, t.name as team_name
    FROM users u LEFT JOIN teams t ON t.id = u.team_id
    WHERE u.id = ? AND u.is_active = 1
  `).get(userId) as any

  if (!user) { res.status(404).json({ error: 'Joueur introuvable' }); return }

  const profile: any = {
    id: user.id,
    username: user.username,
    game_role: user.game_role,
    is_starter: user.is_starter,
    riot_id: user.riot_id ?? null,
    team_name: user.team_name,
    riot_stats: null,
    riot_error: null,
  }

  if (!user.riot_id) { res.json(profile); return }

  const parts = (user.riot_id as string).split('#')
  if (parts.length !== 2) { res.json(profile); return }

  const [gameName, tagLine] = parts
  const region = ((req.query.region as string) ?? 'euw').toLowerCase()
  const routing = ROUTING[region] ?? 'europe'
  const platform = PLATFORM[region] ?? 'euw1'

  try {
    const account = await riotFetch(
      `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    )
    const ranked: any[] = await riotFetch(
      `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`
    )
    const ddVersion: string = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json()).then((v: unknown) => (v as string[])[0])

    const matchIds: string[] = await riotFetch(
      `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?count=10`
    )

    const recentGames: any[] = []
    const champCount: Record<string, { games: number; wins: number; kills: number; deaths: number; assists: number }> = {}

    for (const id of matchIds.slice(0, 10)) {
      const m = await riotFetch(`https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`)
      const p = m.info.participants.find((x: any) => x.puuid === account.puuid)
      if (!p) continue
      const duration = Math.max(m.info.gameDuration / 60, 1)
      const myTeamId = p.teamId
      const allParts = m.info.participants as any[]
      const team1 = allParts.filter(x => x.teamId === 100).map(x => x.championName)
      const team2 = allParts.filter(x => x.teamId === 200).map(x => x.championName)
      const myTeamParts = allParts.filter(x => x.teamId === myTeamId)
      const teamKills = myTeamParts.reduce((s: number, x: any) => s + x.kills, 0)
      const teamDmg   = myTeamParts.reduce((s: number, x: any) => s + x.totalDamageDealtToChampions, 0)

      recentGames.push({
        matchId: m.metadata.matchId,
        date: new Date(m.info.gameStartTimestamp).toISOString().split('T')[0],
        champion: p.championName,
        kills: p.kills, deaths: p.deaths, assists: p.assists,
        kda: p.deaths === 0 ? 'Perfect' : ((p.kills + p.assists) / p.deaths).toFixed(2),
        win: p.win,
        cs: p.totalMinionsKilled + p.neutralMinionsKilled,
        csMin: ((p.totalMinionsKilled + p.neutralMinionsKilled) / duration).toFixed(1),
        damage: p.totalDamageDealtToChampions,
        vision: p.visionScore,
        role: p.teamPosition || p.individualPosition || '',
        duration: Math.round(duration),
        durationSec: m.info.gameDuration,
        queueId: m.info.queueId,
        queueLabel: QUEUE_LABEL[m.info.queueId] ?? m.info.gameMode,
        champLevel: p.champLevel ?? 0,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5],
        trinket: p.item6 ?? 0,
        summoners: [p.summoner1Id ?? 0, p.summoner2Id ?? 0],
        primaryRune: p.perks?.styles?.[0]?.selections?.[0]?.perk ?? 0,
        pKill: Math.round((p.kills + p.assists) / Math.max(teamKills, 1) * 100),
        dmgShare: Math.round(p.totalDamageDealtToChampions / Math.max(teamDmg, 1) * 100),
        myTeam:    myTeamId === 100 ? team1 : team2,
        enemyTeam: myTeamId === 100 ? team2 : team1,
        participants: allParts.map((x: any) => ({
          champion: x.championName,
          kills: x.kills, deaths: x.deaths, assists: x.assists,
          cs: x.totalMinionsKilled + x.neutralMinionsKilled,
          damage: x.totalDamageDealtToChampions,
          teamId: x.teamId,
          isMe: x.puuid === account.puuid,
          champLevel: x.champLevel ?? 0,
          items: [x.item0, x.item1, x.item2, x.item3, x.item4, x.item5],
          trinket: x.item6 ?? 0,
          summoner1Id: x.summoner1Id ?? 0,
          summoner2Id: x.summoner2Id ?? 0,
          primaryRune: x.perks?.styles?.[0]?.selections?.[0]?.perk ?? 0,
        })),
      })
      if (!champCount[p.championName]) champCount[p.championName] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 }
      champCount[p.championName].games++
      if (p.win) champCount[p.championName].wins++
      champCount[p.championName].kills += p.kills
      champCount[p.championName].deaths += p.deaths
      champCount[p.championName].assists += p.assists
    }

    const champPool = Object.entries(champCount)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 5)
      .map(([name, s]) => ({
        name,
        games: s.games,
        winRate: Math.round(s.wins / s.games * 100),
        kda: s.deaths === 0 ? 'Perfect' : ((s.kills + s.assists) / s.deaths).toFixed(2),
      }))

    const soloQ = ranked.find(e => e.queueType === 'RANKED_SOLO_5x5')
    const flexQ = ranked.find(e => e.queueType === 'RANKED_FLEX_SR')

    function rankEntry(e: any) {
      return e ? { tier: e.tier, rank: e.rank, lp: e.leaguePoints, wins: e.wins, losses: e.losses, winRate: Math.round(e.wins / (e.wins + e.losses) * 100) } : null
    }

    profile.riot_stats = {
      gameName, tagLine, ddVersion,
      soloQ: rankEntry(soloQ),
      flexQ: rankEntry(flexQ),
      recentGames,
      champPool,
    }
    res.json(profile)
  } catch (err: any) {
    profile.riot_error = err.message
    res.json(profile)
  }
}
