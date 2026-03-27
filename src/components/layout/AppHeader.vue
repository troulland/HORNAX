<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, Search, Sun, Moon } from 'lucide-vue-next'
import { useAuthStore }  from '@/stores/auth'
import { useMatchStore } from '@/stores/matches'
import { useThemeStore } from '@/stores/theme'

const auth       = useAuthStore()
const matchStore = useMatchStore()
const theme      = useThemeStore()
const router     = useRouter()

const now = new Date()
const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const dateFormatted = computed(() => dateStr.charAt(0).toUpperCase() + dateStr.slice(1))

const nextEvent     = computed(() => matchStore.upcoming[0] ?? null)
const nextEventDate = computed(() => {
  if (!nextEvent.value) return null
  const d    = new Date(nextEvent.value.date)
  const diff = d.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 24) return `Dans ${hours}h`
  return `Dans ${Math.floor(hours / 24)}j`
})
</script>

<template>
  <header class="header">
    <!-- Gauche : date + prochain event -->
    <div class="header__left">
      <span class="header__date">{{ dateFormatted }}</span>
      <div v-if="nextEvent" class="header__next">
        <span class="header__next-dot" />
        <span class="header__next-text">vs {{ nextEvent.opponent }}</span>
        <span class="header__next-time">{{ nextEventDate }}</span>
      </div>
    </div>

    <!-- Droite : actions + user -->
    <div class="header__right">
      <button class="header__icon-btn">
        <Search :size="16" />
      </button>
      <button class="header__icon-btn header__notif">
        <Bell :size="16" />
        <span class="header__notif-badge" />
      </button>

      <!-- Toggle thème -->
      <button class="header__icon-btn header__theme-btn" @click="theme.toggle()" :title="theme.isDark ? 'Mode clair' : 'Mode sombre'">
        <Transition name="icon-swap" mode="out-in">
          <Sun  v-if="!theme.isDark" :size="16" key="sun" />
          <Moon v-else               :size="16" key="moon" />
        </Transition>
      </button>

      <!-- User (cliquable → profil) -->
      <div class="header__user" @click="router.push('/profile')">
        <div class="header__avatar">
          {{ auth.username?.charAt(0).toUpperCase() ?? 'H' }}
        </div>
        <div class="header__user-info">
          <span class="header__user-name">{{ auth.username ?? 'Admin' }}</span>
          <span class="header__user-role">{{ auth.user?.game_role?.toUpperCase() ?? 'MANAGER' }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  height: 60px;
  border-bottom: 1px solid rgba(238,242,255,.1);
  background: rgba(13,16,24,.4);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 28px; flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(0,0,0,.15);
}
.header__left  { display: flex; align-items: center; gap: 20px; }
.header__right { display: flex; align-items: center; gap: 8px; }

.header__date { font-family: 'Inter', sans-serif; font-size: 13px; color: #8892B0; }

.header__next { display: flex; align-items: center; gap: 6px; background: #111520; border: 1px solid #1A1F2E; border-radius: 20px; padding: 4px 12px; }
.header__next-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px color-mix(in srgb,var(--accent) 80%,transparent); flex-shrink: 0; animation: dotPulse 2s ease-in-out infinite; }
.header__next-text { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 1px; color: #EEF2FF; }
.header__next-time { font-family: 'Rajdhani', sans-serif; font-size: 11px; color: var(--accent); font-weight: 600; }

.header__icon-btn { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #1A1F2E; background: transparent; color: #8892B0; cursor: pointer; }
.header__icon-btn:hover { background: #111520; color: #EEF2FF; border-color: var(--accent); }
.header__notif { position: relative; }
.header__notif-badge { position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); border: 1px solid #0D1018; }
.header__theme-btn { color: #8892B0; }

.header__user { display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 6px; border: 1px solid #1A1F2E; background: #111520; margin-left: 4px; cursor: pointer; }
.header__user:hover { border-color: var(--accent); }
.header__avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-2)); display: flex; align-items: center; justify-content: center; font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: white; flex-shrink: 0; }
.header__user-info { display: flex; flex-direction: column; }
.header__user-name { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; color: #EEF2FF; letter-spacing: 1px; line-height: 1.2; }
.header__user-role { font-family: 'Inter', sans-serif; font-size: 10px; color: #8892B0; line-height: 1.2; }

.icon-swap-enter-active, .icon-swap-leave-active { transition: opacity .15s, transform .15s; }
.icon-swap-enter-from { opacity: 0; transform: rotate(-30deg) scale(.7); }
.icon-swap-leave-to   { opacity: 0; transform: rotate(30deg)  scale(.7); }

@keyframes dotPulse {
  0%,100% { opacity: 1; box-shadow: 0 0 6px color-mix(in srgb,var(--accent) 80%,transparent); }
  50% { opacity: .7; box-shadow: 0 0 12px color-mix(in srgb,var(--accent) 100%,transparent); }
}

@media (max-width: 768px) {
  .header { padding: 0 16px; height: 54px; }
  .header__date { display: none; }
  .header__next { display: none; }
  .header__icon-btn:not(.header__theme-btn) { display: none; }
  .header__user-info { display: none; }
  .header__user { padding: 4px; border: none; background: transparent; }
}
</style>
