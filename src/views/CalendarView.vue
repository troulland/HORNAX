<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
const tabs = [
  { label: 'Disponibilités', path: '/calendar/availability' },
  { label: 'Matchs & Scrims', path: '/calendar/matches' },
]
</script>

<template>
  <div class="cal-layout">
    <div>
      <span class="cal-eye">ORGANISATION · PLANNING</span>
      <h1 class="cal-title">CALENDRIER</h1>
    </div>
    <div class="cal-tabs">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="cal-tab"
        :class="{ 'cal-tab--active': route.path === tab.path }"
      >{{ tab.label }}</RouterLink>
    </div>
    <RouterView />
  </div>
</template>

<style scoped>
.cal-layout { display: flex; flex-direction: column; gap: 20px; animation: pageIn .4s ease-out both; }
.cal-eye { display: block; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 4px; color: var(--accent); margin-bottom: 4px; }
.cal-title { font-family: 'Rajdhani', sans-serif; font-size: 30px; font-weight: 700; letter-spacing: 4px; color: #EEF2FF; margin: 0; }
.cal-tabs { display: flex; gap: 0; border-bottom: 1px solid #2B3346; }
.cal-tab {
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px;
  color: #8892B0; text-decoration: none; padding: 10px 24px;
  border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .15s;
}
.cal-tab:hover { color: #EEF2FF; }
.cal-tab--active { color: var(--accent); border-bottom-color: var(--accent); }
@keyframes pageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
