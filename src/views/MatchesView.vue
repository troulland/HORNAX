<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
const tabs = [
  { label: 'Historique',  path: '/matches/history' },
  { label: 'Import Riot', path: '/matches/import' },
]
</script>

<template>
  <div class="matches-layout">
    <div>
      <span class="matches-eye">COMPÉTITION · RÉSULTATS</span>
      <h1 class="matches-title">PARTIES</h1>
    </div>
    <div class="matches-tabs">
      <RouterLink
        v-for="tab in tabs" :key="tab.path"
        :to="tab.path"
        class="matches-tab"
        :class="{ 'matches-tab--active': route.path === tab.path }"
      >{{ tab.label }}</RouterLink>
    </div>
    <RouterView />
  </div>
</template>

<style scoped>
.matches-layout { display: flex; flex-direction: column; gap: 20px; animation: pageIn .4s ease-out both; }
.matches-eye { display: block; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 4px; color: var(--accent); margin-bottom: 4px; }
.matches-title { font-family: 'Rajdhani', sans-serif; font-size: 30px; font-weight: 700; letter-spacing: 4px; color: #EEF2FF; margin: 0; }
.matches-tabs { display: flex; gap: 0; border-bottom: 1px solid #1A1F2E; }
.matches-tab {
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px;
  color: #8892B0; text-decoration: none; padding: 10px 24px;
  border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .15s;
}
.matches-tab:hover { color: #EEF2FF; }
.matches-tab--active { color: var(--accent); border-bottom-color: var(--accent); }
html[data-theme="light"] .matches-title { color: #0D1220; }
html[data-theme="light"] .matches-tabs { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .matches-tab { color: #4A5280; }
html[data-theme="light"] .matches-tab:hover { color: #0D1220; }
@keyframes pageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
