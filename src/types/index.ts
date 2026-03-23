export type Role = 'top' | 'jgl' | 'mid' | 'adc' | 'sup' | 'sub'

export interface Player {
  id: string
  ign: string
  role: Role
  realName?: string
  avatar?: string
  isStarter: boolean
  stats: PlayerStats
  status: 'available' | 'unavailable' | 'uncertain'
}

export interface PlayerStats {
  kda: number
  winRate: number
  gamesPlayed: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  mostPlayedChamps: string[]
}

export interface Match {
  id: string
  type: 'scrim' | 'tournament' | 'ranked'
  opponent: string
  result: 'win' | 'loss' | 'upcoming'
  score?: string
  date: string
  duration?: string
  notes?: string
}

export interface TeamStats {
  winRate: number
  totalGames: number
  avgKda: number
  currentStreak: number
  streakType: 'win' | 'loss'
}

export interface CalendarEvent {
  id: string
  title: string
  type: 'scrim' | 'tournament' | 'training' | 'meeting'
  date: string
  opponent?: string
  notes?: string
}
