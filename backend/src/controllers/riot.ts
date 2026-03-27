import { Request, Response } from 'express'

const ROUTING: Record<string, string> = {
  euw: 'europe', eune: 'europe', tr: 'europe', ru: 'europe',
  na: 'americas', br: 'americas', lan: 'americas', las: 'americas',
  kr: 'asia', jp: 'asia',
  oce: 'sea', sg: 'sea', ph: 'sea', th: 'sea', tw: 'sea', vn: 'sea',
}

const QUEUE_LABEL: Record<number, string> = {
  420: 'Ranked Solo/Duo', 440: 'Ranked Flex',
  400: 'Normal Draft', 430: 'Normal Blind',
  450: 'ARAM', 700: 'Clash', 490: 'Quickplay',
}

const ROLE_LABEL: Record<string, string> = {
  TOP: 'TOP', JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP',
}

async function riotFetch(url: string): Promise<any> {
  const key = process.env.RIOT_API_KEY
  if (!key || key.startsWith('RGAPI-REMPLACE')) {
    throw new Error('Clé API Riot non configurée. Ajoute RIOT_API_KEY dans le fichier .env')
  }
  const res = await fetch(url, { headers: { 'X-Riot-Token': key } })
  if (res.status === 429) throw new Error('Rate limit Riot — réessaie dans quelques secondes')
  if (res.status === 404) throw new Error('Compte Riot introuvable. Vérifie le Riot ID')
  if (res.status === 403) throw new Error('Clé API expirée. Renouvelle-la sur developer.riotgames.com')
  if (!res.ok) throw new Error(`Erreur Riot API (${res.status})`)
  return res.json()
}

export async function fetchRiotMatches(req: Request, res: Response): Promise<void> {
  const { riotId, count = '10', region = 'euw', type } = req.query

  if (!riotId || typeof riotId !== 'string') {
    res.status(400).json({ error: 'riotId requis. Exemple : Kaishi#EUW' }); return
  }
  const parts = riotId.split('#')
  if (parts.length !== 2) {
    res.status(400).json({ error: 'Format invalide. Exemple : Kaishi#EUW' }); return
  }

  const [gameName, tagLine] = parts
  const routing = ROUTING[(region as string).toLowerCase()] ?? 'europe'
  const n = Math.min(Number(count) || 10, 20)

  try {
    // 1. PUUID
    const account = await riotFetch(
      `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    )

    // 2. DDragon version
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r => r.json()) as string[]
    const ddVersion = versions[0]

    // 3. Match IDs
    const typeParam = type ? `&type=${type}` : ''
    const matchIds = await riotFetch(
      `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?count=${n}${typeParam}`
    )

    if (matchIds.length === 0) {
      res.json({ account: { gameName, tagLine }, ddVersion, matches: [] }); return
    }

    // 4. Match details
    const matches = []
    for (const id of matchIds) {
      const m = await riotFetch(`https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`)
      const p = m.info.participants.find((x: any) => x.puuid === account.puuid)
      if (!p) continue

      const duration = Math.max(m.info.gameDuration / 60, 1)
      const queueLabel = QUEUE_LABEL[m.info.queueId as number] ?? m.info.gameMode

      // Full scoreboard for all participants
      const participants = m.info.participants.map((x: any) => ({
        name:     x.riotIdGameName || x.summonerName || '?',
        tag:      x.riotIdTagline  || '',
        champion: x.championName,
        teamId:   x.teamId,
        role:     ROLE_LABEL[x.teamPosition] ?? (x.teamPosition || ''),
        kills:    x.kills,
        deaths:   x.deaths,
        assists:  x.assists,
        gold:     x.goldEarned,
        cs:       x.totalMinionsKilled + x.neutralMinionsKilled,
        damage:   x.totalDamageDealtToChampions,
        vision:   x.visionScore,
        win:      x.win,
        isUser:   x.puuid === account.puuid,
        wardsPlaced:  x.wardsPlaced  ?? 0,
        wardsKilled:  x.wardsKilled  ?? 0,
        controlWards: x.visionWardsBoughtInGame ?? 0,
        turretKills:  x.turretKills  ?? 0,
        champLevel: x.champLevel ?? 0,
        items:  [x.item0, x.item1, x.item2, x.item3, x.item4, x.item5],
        trinket: x.item6 ?? 0,
        summoner1Id: x.summoner1Id ?? 0,
        summoner2Id: x.summoner2Id ?? 0,
        primaryRune: x.perks?.styles?.[0]?.selections?.[0]?.perk ?? 0,
      }))

      // Fetch timeline to get individual drake types
      let drakesByTeam: Record<number, string[]> = { 100: [], 200: [] }
      try {
        const timeline = await riotFetch(
          `https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}/timeline`
        )
        // Build participantId → teamId map
        const pidTeam: Record<number, number> = {}
        for (const x of m.info.participants) pidTeam[x.participantId] = x.teamId

        for (const frame of (timeline.info?.frames ?? [])) {
          for (const ev of (frame.events ?? [])) {
            if (ev.type === 'ELITE_MONSTER_KILL' && ev.monsterType === 'DRAGON') {
              const sub: string = ev.monsterSubType ?? 'FIRE_DRAGON'
              // monsterSubType: FIRE_DRAGON, EARTH_DRAGON, WATER_DRAGON, AIR_DRAGON,
              //                 HEXTECH_DRAGON, CHEMTECH_DRAGON, ELDER_DRAGON
              const typeKey = sub.replace('_DRAGON', '')  // FIRE / EARTH / WATER / AIR …
              const team = pidTeam[ev.killerId] ?? 100
              if (!drakesByTeam[team]) drakesByTeam[team] = []
              drakesByTeam[team].push(typeKey)
            }
          }
        }
      } catch { /* timeline fetch failed — gracefully omit drake types */ }

      const myTeamId  = p.teamId
      const myTeamParts = m.info.participants.filter((x: any) => x.teamId === myTeamId)
      const teamKills = myTeamParts.reduce((s: number, x: any) => s + x.kills, 0)
      const teamDmg   = myTeamParts.reduce((s: number, x: any) => s + x.totalDamageDealtToChampions, 0)

      matches.push({
        matchId:    m.metadata.matchId,
        date:       new Date(m.info.gameStartTimestamp).toISOString().split('T')[0],
        duration:   Math.round(duration),
        durationSec: m.info.gameDuration,
        champion:   p.championName,
        kills:      p.kills,
        deaths:     p.deaths,
        assists:    p.assists,
        kda:        p.deaths === 0 ? 'Perfect' : ((p.kills + p.assists) / p.deaths).toFixed(2),
        win:        p.win,
        cs:         p.totalMinionsKilled + p.neutralMinionsKilled,
        csMin:      ((p.totalMinionsKilled + p.neutralMinionsKilled) / duration).toFixed(1),
        role:       ROLE_LABEL[p.teamPosition] ?? (p.teamPosition || p.individualPosition || ''),
        queueId:    m.info.queueId,
        queueLabel,
        champLevel: p.champLevel ?? 0,
        items:      [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5],
        trinket:    p.item6 ?? 0,
        summoners:  [p.summoner1Id ?? 0, p.summoner2Id ?? 0],
        primaryRune: p.perks?.styles?.[0]?.selections?.[0]?.perk ?? 0,
        pKill:      Math.round((p.kills + p.assists) / Math.max(teamKills, 1) * 100),
        dmgShare:   Math.round(p.totalDamageDealtToChampions / Math.max(teamDmg, 1) * 100),
        participants,
        riotData: {
          matchId:    m.metadata.matchId,
          duration:   Math.round(duration),
          durationSec: m.info.gameDuration,
          queueLabel,
          participants,
          teams: (m.info.teams as any[]).map((t: any) => ({
            teamId: t.teamId,
            win:    t.win,
            dragonTypes: drakesByTeam[t.teamId] ?? [],
            objectives: {
              baron:      t.objectives?.baron?.kills      ?? 0,
              dragon:     t.objectives?.dragon?.kills     ?? 0,
              horde:      t.objectives?.horde?.kills      ?? 0,
              riftHerald: t.objectives?.riftHerald?.kills ?? 0,
              tower:      t.objectives?.tower?.kills      ?? 0,
              inhibitor:  t.objectives?.inhibitor?.kills  ?? 0,
            },
          })),
        },
      })
    }

    res.json({ account: { gameName, tagLine }, ddVersion, matches })
  } catch (err: any) {
    const msg: string = err.message ?? 'Erreur inconnue'
    const status = msg.includes('expirée') || msg.includes('configurée') ? 503
                 : msg.includes('introuvable') ? 404 : 502
    res.status(status).json({ error: msg })
  }
}
