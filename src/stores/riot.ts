import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { API_BASE as API } from '@/config'

export interface ScrimSlot {
  champion: string
  name: string
  kills: number
  deaths: number
  assists: number
  cs: number
  userId: number | null
  username: string | null
}
export interface ScrimGameLite {
  matchId: string
  gameStart: number
  duration: number
  side: 100 | 200
  win: boolean
  allies: ScrimSlot[]
  enemies: ScrimSlot[]
}
export interface ScrimSeries {
  seriesId: string
  total: number
  wins: number
  losses: number
  seriesWin: boolean
  gameStart: number
  opponent: string | null
  opponentLogo: string | null
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
export interface TournamentCodeOptions {
  count?: number
  teamSize?: number
  mapType?: string
  pickType?: string
  spectatorType?: string
  metadata?: string | null
}
export interface StoredTournamentCode {
  code: string
  map_type: string
  pick_type: string
  spectator_type: string
  team_size: number
  metadata: string | null
  created_at: string
  created_by_name: string | null
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

  async function editSeries(seriesId: string, data: { opponent: string | null; opponent_logo: string | null }): Promise<boolean> {
    const res = await fetch(`${API}/scrims/${encodeURIComponent(seriesId)}`, {
      method: 'PATCH', headers: headers(), body: JSON.stringify(data),
    })
    return res.ok
  }

  /** Génère des codes de tournoi. Renvoie { codes } ou { error } (message lisible). */
  async function generateTournamentCode(
    opts: TournamentCodeOptions,
  ): Promise<{ codes?: string[]; error?: string }> {
    try {
      const res = await fetch(`${API}/scrims/tournament-code`, {
        method: 'POST', headers: headers(), body: JSON.stringify(opts),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { error: data.error || 'Échec de génération' }
      return { codes: data.codes ?? [] }
    } catch {
      return { error: 'Serveur injoignable' }
    }
  }

  async function fetchTournamentCodes(): Promise<StoredTournamentCode[]> {
    const res = await fetch(`${API}/scrims/tournament-codes`, { headers: headers() })
    return res.ok ? (await res.json()).codes : []
  }

  /**
   * Convertit le logo en data URL (base64), redimensionné petit, pour le stocker
   * DIRECTEMENT en base (Turso). Le disque de Render (gratuit) étant éphémère,
   * un fichier uploadé serait perdu au redéploiement — la data URL, elle, persiste.
   */
  function uploadLogo(file: File, max = 128): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const img = new Image()
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height))
          const w = Math.max(1, Math.round(img.width * scale))
          const h = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) { resolve(dataUrl); return }
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/webp', 0.85))
        }
        img.onerror = () => resolve(dataUrl)
        img.src = dataUrl
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  }

  return { syncing, sync, fetchScrims, fetchSoloq, fetchFlex, editSeries, uploadLogo, generateTournamentCode, fetchTournamentCodes }
})
