<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { API_BASE as API } from '@/config'
import { champIcon, itemIcon, fmtDur } from '@/utils/lol'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const info = ref<any>(null)
const loading = ref(true)
const error = ref('')

const QUEUE: Record<number, string> = { 420: 'SoloQ', 440: 'Flex', 0: 'Custom / Scrim', 400: 'Normal', 430: 'Normal', 700: 'Clash' }

onMounted(async () => {
  try {
    const res = await fetch(`${API}/game/${route.params.matchId}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (!res.ok) { error.value = 'Match introuvable dans le cache.'; return }
    const data = await res.json()
    info.value = data.info
  } catch { error.value = 'Erreur de chargement.' } finally { loading.value = false }
})

const blue = computed(() => (info.value?.participants ?? []).filter((p: any) => p.teamId === 100))
const red  = computed(() => (info.value?.participants ?? []).filter((p: any) => p.teamId === 200))
const blueWin = computed(() => blue.value[0]?.win)
const cs = (p: any) => (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)
const pname = (p: any) => p.riotIdGameName || p.summonerName || '—'
const items = (p: any) => [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((i: number) => i > 0)
</script>

<template>
  <div class="page">
    <button class="back" @click="router.back()"><ArrowLeft :size="16" /> Retour</button>

    <div v-if="loading" class="empty">Chargement…</div>
    <div v-else-if="error" class="empty">{{ error }}</div>

    <template v-else-if="info">
      <header class="head">
        <span class="head__queue">{{ QUEUE[info.queueId] ?? 'Partie' }}</span>
        <span class="head__dur">{{ fmtDur(info.gameDuration) }}</span>
      </header>

      <div class="teams">
        <div v-for="(side, idx) in [{ label: 'ÉQUIPE BLEUE', players: blue, win: blueWin, color: '#3B82F6' },
                                     { label: 'ÉQUIPE ROUGE', players: red, win: !blueWin, color: '#EF4444' }]"
             :key="idx" class="team">
          <div class="team__head" :style="{ color: side.color }">
            {{ side.label }}
            <span class="team__res" :class="side.win ? 'win' : 'loss'">{{ side.win ? 'VICTOIRE' : 'DÉFAITE' }}</span>
          </div>
          <div v-for="p in side.players" :key="p.puuid" class="pl">
            <img class="pl__champ" :src="champIcon(p.championName)" :alt="p.championName" />
            <div class="pl__id">
              <span class="pl__name">{{ pname(p) }}</span>
              <span class="pl__champname">{{ p.championName }}</span>
            </div>
            <span class="pl__kda">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
            <span class="pl__cs">{{ cs(p) }} CS</span>
            <span class="pl__dmg">{{ Math.round((p.totalDamageDealtToChampions ?? 0) / 1000) }}k</span>
            <div class="pl__items">
              <img v-for="(it, i) in items(p)" :key="i" :src="itemIcon(it)" alt="" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; animation: pageIn .3s ease; }
@keyframes pageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.back { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: #8892B0; cursor: pointer; font-family: inherit; font-size: 13px; width: fit-content; }
.back:hover { color: #EEF2FF; }
.empty { padding: 48px; text-align: center; color: #8892B0; }

.head { display: flex; align-items: center; gap: 14px; }
.head__queue { font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 2px; color: #EEF2FF; }
.head__dur { font-size: 14px; color: #8892B0; }

.teams { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.team { background: #111520; border: 1px solid #1A1F2E; border-radius: 10px; overflow: hidden; }
.team__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #1A1F2E; font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: 2px; font-size: 13px; }
.team__res { font-size: 11px; }
.team__res.win { color: #10B981; } .team__res.loss { color: #EF4444; }

.pl { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid #14181f; }
.pl:last-child { border-bottom: none; }
.pl__champ { width: 36px; height: 36px; border-radius: 6px; border: 1px solid #2A2F40; }
.pl__id { display: flex; flex-direction: column; min-width: 90px; }
.pl__name { font-size: 12px; color: #EEF2FF; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
.pl__champname { font-size: 11px; color: #8892B0; }
.pl__kda { font-family: 'Rajdhani', sans-serif; font-weight: 700; color: #EEF2FF; min-width: 56px; }
.pl__cs, .pl__dmg { font-size: 12px; color: #8892B0; min-width: 44px; }
.pl__items { display: flex; gap: 2px; margin-left: auto; }
.pl__items img { width: 22px; height: 22px; border-radius: 3px; background: #0D1018; }

@media (max-width: 768px) { .teams { grid-template-columns: 1fr; } }
</style>
