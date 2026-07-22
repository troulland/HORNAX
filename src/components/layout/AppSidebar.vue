<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  LayoutDashboard, Swords, TrendingUp,
  Map, Calendar, User, LogOut, ChevronRight, ChevronDown, Crosshair,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-vue-next'

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()
const calOpen = ref(route.path.startsWith('/calendar'))

const collapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true')
function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem('sidebar-collapsed', String(collapsed.value))
}

const isRoyalty  = computed(() => auth.user?.team_slug === 'hornax-royalty')
const logoSrc    = computed(() => isRoyalty.value ? '/hornax-royalty.png' : '/logo.png')
const teamLabel  = computed(() => isRoyalty.value ? 'ROYALTY' : 'HORNAX')

const navItems = [
  { label: 'Dashboard',    path: '/dashboard', icon: LayoutDashboard },
  { label: 'Scrims',       path: '/scrims',    icon: Swords },
  { label: 'SoloQ / Flex', path: '/ranked',    icon: TrendingUp },
  { label: 'Scout',        path: '/scout',     icon: Crosshair },
  { label: 'Draft',        path: '/draft',     icon: Map,        soon: true },
]

const calSub = [
  { label: 'Disponibilités', path: '/calendar/availability' },
  { label: 'Matchs & Scrims', path: '/calendar/matches' },
]

const isActive = (path: string) => route.path === path
function logout() {
  auth.logout()
  // rechargement complet → vide tout l'état en mémoire (stores) pour éviter
  // de garder les données du compte précédent au changement de compte
  window.location.href = '/login'
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <RouterLink to="/dashboard" class="sidebar__logo" :title="collapsed ? teamLabel : ''">
      <img :src="logoSrc" alt="HORNAX" class="sidebar__logo-img" />
      <span v-show="!collapsed" class="sidebar__logo-text">{{ teamLabel }}</span>
    </RouterLink>
    <div class="sidebar__divider" />

    <nav class="sidebar__nav">
      <template v-for="item in navItems" :key="item.path">
        <div
          v-if="item.soon"
          class="sidebar__item sidebar__item--soon"
          :title="collapsed ? item.label : ''"
        >
          <component :is="item.icon" :size="17" class="sidebar__icon" />
          <span v-show="!collapsed" class="sidebar__label">{{ item.label }}</span>
          <span v-show="!collapsed" class="sidebar__soon-tag">SOON</span>
        </div>
        <RouterLink
          v-else
          :to="item.path"
          class="sidebar__item"
          :class="{ 'sidebar__item--active': isActive(item.path) }"
          :title="collapsed ? item.label : ''"
        >
          <component :is="item.icon" :size="17" class="sidebar__icon" />
          <span v-show="!collapsed" class="sidebar__label">{{ item.label }}</span>
          <ChevronRight v-if="isActive(item.path) && !collapsed" :size="13" class="sidebar__arrow" />
        </RouterLink>
      </template>

      <!-- Calendar collapsible -->
      <button
        class="sidebar__item sidebar__item--cal"
        :class="{ 'sidebar__item--active': route.path.startsWith('/calendar') }"
        :title="collapsed ? 'Calendrier' : ''"
        @click="collapsed ? router.push('/calendar/availability') : (calOpen = !calOpen)"
      >
        <Calendar :size="17" class="sidebar__icon" />
        <span v-show="!collapsed" class="sidebar__label">Calendrier</span>
        <component v-if="!collapsed" :is="calOpen ? ChevronDown : ChevronRight" :size="13" class="sidebar__arrow" />
      </button>
      <Transition name="sub">
        <div v-if="calOpen && !collapsed" class="sidebar__sub">
          <RouterLink
            v-for="sub in calSub" :key="sub.path"
            :to="sub.path"
            class="sidebar__sub-item"
            :class="{ 'sidebar__sub-item--active': route.path === sub.path }"
          >{{ sub.label }}</RouterLink>
        </div>
      </Transition>
    </nav>

    <div class="sidebar__bottom">
      <div class="sidebar__divider" />
      <RouterLink to="/profile" class="sidebar__item" :class="{ 'sidebar__item--active': isActive('/profile') }" :title="collapsed ? 'Mon Profil' : ''">
        <User :size="17" class="sidebar__icon" />
        <span v-show="!collapsed" class="sidebar__label">Mon Profil</span>
        <ChevronRight v-if="isActive('/profile') && !collapsed" :size="13" class="sidebar__arrow" />
      </RouterLink>
      <button class="sidebar__item sidebar__item--logout" @click="logout" :title="collapsed ? 'Déconnexion' : ''">
        <LogOut :size="17" class="sidebar__icon" />
        <span v-show="!collapsed" class="sidebar__label">Déconnexion</span>
      </button>
      <button class="sidebar__item sidebar__collapse-btn" @click="toggleCollapse" :title="collapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'">
        <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" :size="17" class="sidebar__icon" />
        <span v-show="!collapsed" class="sidebar__label">Réduire</span>
      </button>
    </div>
  </aside>

  <Teleport to="body">
    <nav class="mobile-nav">
      <RouterLink to="/dashboard" class="mobile-nav__item" :class="{ 'mobile-nav__item--active': route.path === '/dashboard' }">
        <LayoutDashboard :size="20" />
        <span>Dashboard</span>
      </RouterLink>
      <RouterLink to="/scrims" class="mobile-nav__item" :class="{ 'mobile-nav__item--active': route.path === '/scrims' }">
        <Swords :size="20" />
        <span>Scrims</span>
      </RouterLink>
      <RouterLink to="/ranked" class="mobile-nav__item" :class="{ 'mobile-nav__item--active': route.path === '/ranked' }">
        <TrendingUp :size="20" />
        <span>SoloQ/Flex</span>
      </RouterLink>
      <RouterLink to="/scout" class="mobile-nav__item" :class="{ 'mobile-nav__item--active': route.path === '/scout' }">
        <Crosshair :size="20" />
        <span>Scout</span>
      </RouterLink>
      <RouterLink to="/calendar/availability" class="mobile-nav__item" :class="{ 'mobile-nav__item--active': route.path.startsWith('/calendar') }">
        <Calendar :size="20" />
        <span>Calendrier</span>
      </RouterLink>
      <RouterLink to="/profile" class="mobile-nav__item" :class="{ 'mobile-nav__item--active': route.path === '/profile' }">
        <User :size="20" />
        <span>Profil</span>
      </RouterLink>
    </nav>
  </Teleport>
</template>

<style scoped>
.sidebar { width: 220px; flex-shrink: 0; background: #151A27; border-right: 1px solid #2B3346; display: flex; flex-direction: column; height: 100vh; transition: width .2s ease; overflow: hidden; }
.sidebar__logo { display: flex; align-items: center; gap: 10px; padding: 22px 20px; text-decoration: none; cursor: pointer; transition: opacity .15s; }
.sidebar__logo:hover { opacity: .8; }
.sidebar__logo-img { width: 28px; height: 28px; object-fit: contain; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 70%, transparent)); }
.sidebar__logo-text { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 4px; color: #EEF2FF; }
.sidebar__divider { height: 1px; background: #2B3346; margin: 0 16px; }
.sidebar__nav { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }

.sidebar__item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 6px;
  text-decoration: none; color: #8892B0; transition: all .15s; cursor: pointer;
  border: none; background: transparent; width: 100%; text-align: left; font-family: inherit;
}
.sidebar__item:hover { background: #1B2030; color: #EEF2FF; }
.sidebar__item--active { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); border-left: 2px solid var(--accent); padding-left: 10px; }
.sidebar__item--active:hover { background: color-mix(in srgb, var(--accent) 15%, transparent); }
.sidebar__item--soon { opacity: .45; cursor: not-allowed; pointer-events: none; }
.sidebar__item--logout:hover { color: #EF4444; background: rgba(239,68,68,.08); }

.sidebar__icon { flex-shrink: 0; }
.sidebar__label { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; flex: 1; }
.sidebar__arrow { opacity: .6; }
.sidebar__soon-tag { font-family: 'Rajdhani', sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 2px; color: #616C8A; background: #2B3346; padding: 2px 5px; border-radius: 3px; }

.sidebar__sub { padding-left: 36px; display: flex; flex-direction: column; gap: 1px; margin-top: 1px; }
.sidebar__sub-item { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 1px; color: #8892B0; text-decoration: none; padding: 7px 12px; border-radius: 5px; transition: all .15s; }
.sidebar__sub-item:hover { color: #EEF2FF; background: #1B2030; }
.sidebar__sub-item--active { color: var(--accent); }

.sub-enter-active, .sub-leave-active { transition: all .2s ease; }
.sub-enter-from, .sub-leave-to { opacity: 0; transform: translateY(-6px); }

.sidebar__bottom { padding: 10px 10px 16px; display: flex; flex-direction: column; gap: 2px; }
.sidebar__collapse-btn { color: #2A3050; }
.sidebar__collapse-btn:hover { color: #8892B0; background: #1B2030; }

/* Collapsed state */
.sidebar--collapsed { width: 60px; transition: width .2s ease; }
.sidebar--collapsed .sidebar__logo { justify-content: center; padding: 22px 0; }
.sidebar--collapsed .sidebar__divider { margin: 0 10px; }
.sidebar--collapsed .sidebar__item { justify-content: center; padding: 10px 0; }
.sidebar--collapsed .sidebar__item--active { padding-left: 0; border-left: none; border-bottom: 2px solid var(--accent); }

/* Hide sidebar on mobile */
@media (max-width: 768px) {
  .sidebar { display: none; }
}

/* Mobile bottom nav */
.mobile-nav {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
  height: 64px;
  background: #151A27;
  border-top: 1px solid #2B3346;
  flex-direction: row;
  align-items: stretch;
  padding: 0 4px;
  padding-bottom: env(safe-area-inset-bottom);
}
.mobile-nav__item {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; text-decoration: none; color: #616C8A;
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1px;
  transition: color .15s; border-radius: 8px; margin: 4px 2px;
}
.mobile-nav__item:hover,
.mobile-nav__item--active { color: var(--accent); }
.mobile-nav__item--active { background: color-mix(in srgb, var(--accent) 10%, transparent); }

@media (max-width: 768px) {
  .mobile-nav { display: flex; }
}

html[data-theme="light"] .mobile-nav { background: #FFFFFF; border-top-color: #E0E3EF; }
html[data-theme="light"] .mobile-nav__item--active { background: color-mix(in srgb, var(--accent) 8%, transparent); }
</style>
