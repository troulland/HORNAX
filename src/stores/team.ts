import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TeamStats } from '@/types'

import { API_BASE as API } from '@/config'

export interface RosterPlayer {
  id: number
  username: string
  game_role: string
  is_starter: number
}

export const useTeamStore = defineStore('team', () => {
  const roster   = ref<RosterPlayer[]>([])
  const loading  = ref(false)

  const teamStats = ref<TeamStats>({
    winRate: 62,
    totalGames: 45,
    avgKda: 4.3,
    currentStreak: 3,
    streakType: 'win',
  })

  async function fetchRoster(teamId: number) {
    if (!teamId) return
    loading.value = true
    try {
      const token = localStorage.getItem('hx_token')
      const res = await fetch(`${API}/teams/${teamId}/roster`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const data = await res.json()
      roster.value = (data.players ?? []) as RosterPlayer[]
    } finally {
      loading.value = false
    }
  }

  // Keep legacy getPlayerByRole for any callers that still use it
  function getPlayerByRole(role: string) {
    return roster.value.find(p => p.game_role === role && p.is_starter === 1) ?? null
  }

  return { roster, loading, teamStats, fetchRoster, getPlayerByRole }
})
