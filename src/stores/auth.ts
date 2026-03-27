import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { API_BASE as API } from '@/config'

export interface AuthUser {
  id: number
  username: string
  email: string
  game_role: string
  is_starter: number
  team_id: number
  team_name: string
  team_slug: string
  riot_id?: string | null
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('hx_user')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Reject legacy plain-string values (old mock auth stored just the username)
    if (typeof parsed !== 'object' || parsed === null) throw new Error('legacy')
    return parsed as AuthUser
  } catch {
    localStorage.removeItem('hx_user')
    localStorage.removeItem('hx_token')
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token    = ref<string | null>(localStorage.getItem('hx_token'))
  const user     = ref<AuthUser | null>(loadUser())

  const isAuthenticated = computed(() => !!token.value)
  const username = computed(() => user.value?.username ?? null)

  async function login(identifier: string, password: string): Promise<string | null> {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })
    const data = await res.json()
    if (!res.ok) return data.error ?? 'Identifiants incorrects.'
    _persist(data.token, data.user)
    return null
  }

  async function register(payload: {
    username: string
    email: string
    password: string
    team_id: number
    game_role: string
  }): Promise<string | null> {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) return data.error ?? 'Erreur lors de l\'inscription.'
    _persist(data.token, data.user)
    return null
  }

  function _persist(t: string, u: AuthUser) {
    token.value = t
    user.value  = u
    localStorage.setItem('hx_token', t)
    localStorage.setItem('hx_user', JSON.stringify(u))
  }

  function logout() {
    token.value = null
    user.value  = null
    localStorage.removeItem('hx_token')
    localStorage.removeItem('hx_user')
  }

  return { token, user, username, isAuthenticated, login, register, logout }
})
