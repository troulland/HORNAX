import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { API_BASE as API } from '@/config'

export interface ScrimPlayer {
  userId: number
  username: string
  champion: string
  kills: number
  deaths: number
  assists: number
  cs: number
}
export interface ScrimGameLite {
  matchId: string
  gameStart: number
  duration: number
  side: 100 | 200
  win: boolean
  ours: ScrimPlayer[]
  enemies: string[]
}
export interface ScrimSeries {
  seriesId: string
  total: number
  wins: number
  losses: number
  seriesWin: boolean
  gameStart: number
  matches: ScrimGameLite[]
}
export interface ScrimStats {
  games: number
  wins: number
  losses: number
  winRate: number
  avgDurationSec: number
  blue: { games: number; wins: number; winRate: number }
  red: { games: number; wins: number; winRate: number }
}
export interface RankedGame {
  match_id: string
  game_start: number
  duration: number
  user_id: number
  champion: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  allies: string[]
  enemies: string[]
}

export const useRiotStore = defineStore('riot', () => {
  const auth = useAuthStore()
  const syncing = ref(false)

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` })

  async function sync(force = false): Promise<{ players: number; added: number; skipped: boolean } | null> {
    if (!auth.isAuthenticated) return null
    syncing.value = true
    try {
      const res = await fetch(`${API}/sync${force ? '?force=1' : ''}`, { method: 'POST', headers: headers() })
      return res.ok ? await res.json() : null
    } catch { return null } finally { syncing.value = false }
  }

  async function fetchScrims(): Promise<{ stats: ScrimStats | null; series: ScrimSeries[] }> {
    const res = await fetch(`${API}/scrims`, { headers: headers() })
    return res.ok ? await res.json() : { stats: null, series: [] }
  }

  async function fetchSoloq(userId: number): Promise<RankedGame[]> {
    const res = await fetch(`${API}/ranked/soloq?userId=${userId}`, { headers: headers() })
    return res.ok ? (await res.json()).games : []
  }

  async function fetchFlex(): Promise<RankedGame[]> {
    const res = await fetch(`${API}/ranked/flex`, { headers: headers() })
    return res.ok ? (await res.json()).games : []
  }

  return { syncing, sync, fetchScrims, fetchSoloq, fetchFlex }
})
