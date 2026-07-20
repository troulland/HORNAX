import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'splash',
      component: () => import('@/views/SplashView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/dashboard',
      component: () => import('@/components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
        { path: '/scrims', name: 'scrims', component: () => import('@/views/ScrimsView.vue') },
        { path: '/ranked', name: 'ranked', component: () => import('@/views/RankedView.vue') },
        { path: '/game/:matchId', name: 'game', component: () => import('@/views/GameDetailView.vue') },
        { path: '/players/:userId',   name: 'player-profile', component: () => import('@/views/PlayerProfileView.vue') },
        { path: '/scout', name: 'scout', component: () => import('@/views/ScoutView.vue') },
        { path: '/draft',     name: 'draft',     component: () => import('@/views/DraftView.vue') },
        {
          path: '/calendar',
          component: () => import('@/views/CalendarView.vue'),
          children: [
            { path: '', redirect: '/calendar/availability' },
            { path: '/calendar/availability', name: 'availability', component: () => import('@/views/calendar/AvailabilityView.vue') },
            { path: '/calendar/matches',      name: 'cal-matches',  component: () => import('@/views/calendar/CalendarMatchesView.vue') },
          ],
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'login' }
})

export default router
