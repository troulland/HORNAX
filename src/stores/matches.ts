import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

export interface Match {
  id: number
  team_id: number
  opponent: string
  date: string
  time: string | null
  type: 'scrim' | 'tournament' | 'official'
  result: 'win' | 'loss' | null
  notes: string | null
  opponent_logo: string | null
  series_id: string | null
  riot_data: string | null
  context: 'team' | 'perso' | null
  created_at: string
}

import { API_BASE as API } from '@/config'

export const useMatchStore = defineStore('matches', () => {
  const auth = useAuthStore()
  const history  = ref<Match[]>([])
  const upcoming = ref<Match[]>([])
  const loading  = ref(false)

  function headers() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }
  }

  async function fetchHistory(limit = 50) {
    if (!auth.isAuthenticated) return
    loading.value = true
    try {
      const res = await fetch(`${API}/matches?limit=${limit}`, { headers: headers() })
      if (res.ok) history.value = await res.json()
    } finally { loading.value = false }
  }

  async function fetchUpcoming(limit = 10) {
    if (!auth.isAuthenticated) return
    try {
      const res = await fetch(`${API}/matches?upcoming=1&limit=${limit}`, { headers: headers() })
      if (res.ok) upcoming.value = await res.json()
    } catch {}
  }

  async function createMatch(data: Partial<Match>): Promise<Match | null> {
    const res = await fetch(`${API}/matches`, { method: 'POST', headers: headers(), body: JSON.stringify(data) })
    if (!res.ok) return null
    const match: Match = await res.json()
    if (match.result) history.value.unshift(match)
    else upcoming.value.push(match)
    return match
  }

  async function updateMatch(id: number, data: Partial<Match>): Promise<boolean> {
    const res = await fetch(`${API}/matches/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) })
    if (!res.ok) return false
    const updated: Match = await res.json()
    const hi = history.value.findIndex(m => m.id === id)
    const ui = upcoming.value.findIndex(m => m.id === id)
    if (hi >= 0) { if (updated.result) history.value[hi] = updated; else history.value.splice(hi, 1) }
    if (ui >= 0) { if (!updated.result) upcoming.value[ui] = updated; else { upcoming.value.splice(ui, 1); history.value.unshift(updated) } }
    return true
  }

  async function deleteMatch(id: number): Promise<boolean> {
    const res = await fetch(`${API}/matches/${id}`, { method: 'DELETE', headers: headers() })
    if (!res.ok) return false
    history.value  = history.value.filter(m => m.id !== id)
    upcoming.value = upcoming.value.filter(m => m.id !== id)
    return true
  }

  async function deleteSeriesMatches(seriesId: string): Promise<boolean> {
    const ids = history.value.filter(m => m.series_id === seriesId).map(m => m.id)
    for (const id of ids) {
      await fetch(`${API}/matches/${id}`, { method: 'DELETE', headers: headers() })
    }
    history.value = history.value.filter(m => m.series_id !== seriesId)
    return true
  }

  async function groupMatches(ids: number[], data: {
    series_id: string | null
    opponent?: string
    opponent_logo?: string | null
    context: 'team' | 'perso'
  }): Promise<boolean> {
    const res = await fetch(`${API}/matches/group`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ ids, ...data }),
    })
    if (!res.ok) return false
    const updated: Match[] = await res.json()
    for (const m of updated) {
      const i = history.value.findIndex(h => h.id === m.id)
      if (i >= 0) history.value[i] = m
    }
    return true
  }

  return { history, upcoming, loading, fetchHistory, fetchUpcoming, createMatch, updateMatch, deleteMatch, groupMatches, deleteSeriesMatches }
})
