/**
 * Logique pure (sans I/O) pour les scrims :
 *  - classification de la file Riot
 *  - regroupement des games en BO (mêmes joueurs de la team vs même adversaire)
 *  - agrégats du dashboard (winrate, durée moyenne, WR côté bleu/rouge)
 *
 * Testable directement avec des données mockées.
 */

export type Category = 'soloq' | 'flex' | 'scrim' | 'other'

export function classifyQueue(queueId: number): Category {
  if (queueId === 420) return 'soloq'
  if (queueId === 440) return 'flex'
  if (queueId === 0) return 'scrim'   // parties custom / codes de tournoi
  return 'other'
}

export interface ScrimGame {
  matchId: string
  gameStart: number      // timestamp ms
  duration: number       // secondes
  ourUserIds: number[]   // ids des joueurs de NOTRE team présents
  side: 100 | 200        // côté de notre team (100 = bleu, 200 = rouge)
  win: boolean
  enemyPuuids: string[]  // puuids de l'équipe adverse (identité du BO)
}

const setKey = (arr: (string | number)[]) => [...arr].map(String).sort().join('|')

export interface BoSeries {
  seriesId: string
  matches: ScrimGame[]
  total: number
  wins: number
  losses: number
  seriesWin: boolean
  gameStart: number
}

/**
 * Regroupe des games en BO : mêmes joueurs de la team + même équipe adverse,
 * jouées dans une fenêtre de temps rapprochée (défaut 3 h).
 */
export function groupBOs(games: ScrimGame[], windowMs = 3 * 60 * 60 * 1_000): BoSeries[] {
  const sorted = [...games].sort((a, b) => a.gameStart - b.gameStart)
  const series: BoSeries[] = []

  for (const g of sorted) {
    const last = series[series.length - 1]
    const sameMatchup =
      last &&
      setKey(last.matches[0].ourUserIds) === setKey(g.ourUserIds) &&
      setKey(last.matches[0].enemyPuuids) === setKey(g.enemyPuuids) &&
      g.gameStart - last.matches[last.matches.length - 1].gameStart <= windowMs

    if (sameMatchup) {
      last!.matches.push(g)
    } else {
      series.push({ seriesId: '', matches: [g], total: 0, wins: 0, losses: 0, seriesWin: false, gameStart: g.gameStart })
    }
  }

  for (const s of series) {
    s.total = s.matches.length
    s.wins = s.matches.filter((m) => m.win).length
    s.losses = s.total - s.wins
    s.seriesWin = s.wins > s.losses
    s.gameStart = s.matches[0].gameStart
    s.seriesId = `bo-${s.matches[0].matchId}`
  }
  return series.sort((a, b) => b.gameStart - a.gameStart)
}

export interface ScrimStats {
  games: number
  wins: number
  losses: number
  winRate: number          // 0-100
  avgDurationSec: number
  blue: { games: number; wins: number; winRate: number }
  red:  { games: number; wins: number; winRate: number }
}

const rate = (w: number, n: number) => (n === 0 ? 0 : Math.round((w / n) * 100))

export function aggregateScrims(games: ScrimGame[]): ScrimStats {
  const n = games.length
  const wins = games.filter((g) => g.win).length
  const blueG = games.filter((g) => g.side === 100)
  const redG  = games.filter((g) => g.side === 200)
  const blueW = blueG.filter((g) => g.win).length
  const redW  = redG.filter((g) => g.win).length
  const totalDur = games.reduce((s, g) => s + g.duration, 0)

  return {
    games: n,
    wins,
    losses: n - wins,
    winRate: rate(wins, n),
    avgDurationSec: n === 0 ? 0 : Math.round(totalDur / n),
    blue: { games: blueG.length, wins: blueW, winRate: rate(blueW, blueG.length) },
    red:  { games: redG.length,  wins: redW,  winRate: rate(redW, redG.length) },
  }
}
