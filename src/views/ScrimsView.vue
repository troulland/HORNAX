<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { RefreshCw, Swords } from 'lucide-vue-next'
import { useRiotStore, type ScrimStats, type ScrimSeries } from '@/stores/riot'
import { fmtDur, fmtAgo, wrColor } from '@/utils/lol'

const riot = useRiotStore()
const router = useRouter()

const stats = ref<ScrimStats | null>(null)
const series = ref<ScrimSeries[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  const data = await riot.fetchScrims()
  stats.value = data.stats
  series.value = data.series
  loading.value = false
}

async function sync() {
  const r = await riot.sync(true)
  if (r) await load()
}

const boLabel = (n: number) => (n <= 1 ? 'Game' : `BO${n}`)
const openGame = (id: string) => router.push(`/game/${id}`)

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">SCRIMS</h1>
        <p class="page__sub">Parties custom / codes de tournoi de la team</p>
      </div>
      <button class="hx-btn-primary sync-btn" :disabled="riot.syncing" @click="sync">
        <RefreshCw :size="15" :class="{ spin: riot.syncing }" />
        {{ riot.syncing ? 'Synchro…' : 'Synchroniser' }}
      </button>
    </header>

    <!-- KPIs -->
    <div v-if="stats && stats.games" class="stat-bar">
      <div class="stat"><span class="stat__val">{{ stats.games }}</span><span class="stat__lbl">Matchs joués</span></div>
      <div class="stat">
        <span class="stat__val" :style="{ color: wrColor(stats.winRate) }">{{ stats.winRate }}%</span>
        <span class="stat__lbl">Winrate · {{ stats.wins }}V {{ stats.losses }}D</span>
      </div>
      <div class="stat"><span class="stat__val">{{ fmtDur(stats.avgDurationSec) }}</span><span class="stat__lbl">Durée moyenne</span></div>
      <div class="stat">
        <span class="stat__val" style="color:#3B82F6">{{ stats.blue.winRate }}%</span>
        <span class="stat__lbl">Côté bleu · {{ stats.blue.games }}g</span>
      </div>
      <div class="stat">
        <span class="stat__val" style="color:#EF4444">{{ stats.red.winRate }}%</span>
        <span class="stat__lbl">Côté rouge · {{ stats.red.games }}g</span>
      </div>
    </div>

    <!-- Séries / BO -->
    <section class="panel">
      <div class="panel__head"><span class="eyebrow">Derniers scrims</span></div>

      <div v-if="loading" class="empty">Chargement…</div>
      <div v-else-if="!series.length" class="empty">
        <Swords :size="28" />
        <p>Aucun scrim importé pour l'instant.</p>
        <span>Clique sur <strong>Synchroniser</strong> pour importer depuis l'historique des joueurs.</span>
      </div>

      <div v-else class="series">
        <div v-for="s in series" :key="s.seriesId" class="bo">
          <div class="bo__top">
            <span class="bo__tag" :class="s.seriesWin ? 'win' : 'loss'">{{ boLabel(s.total) }}</span>
            <span class="bo__score">{{ s.wins }} — {{ s.losses }}</span>
            <span class="bo__res" :class="s.seriesWin ? 'win' : 'loss'">{{ s.seriesWin ? 'VICTOIRE' : 'DÉFAITE' }}</span>
            <span class="bo__date">{{ fmtAgo(s.gameStart) }}</span>
          </div>
          <div class="bo__games">
            <button
              v-for="(m, i) in s.matches" :key="m.matchId"
              class="game" :class="m.win ? 'win' : 'loss'"
              @click="openGame(m.matchId)"
            >
              <span class="game__n">G{{ i + 1 }}</span>
              <span class="game__side" :style="{ color: m.side === 100 ? '#3B82F6' : '#EF4444' }">
                {{ m.side === 100 ? 'BLEU' : 'ROUGE' }}
              </span>
              <span class="game__res">{{ m.win ? 'V' : 'D' }}</span>
              <span class="game__dur">{{ fmtDur(m.duration) }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 20px; animation: pageIn .3s ease; }
@keyframes pageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.page__head { display: flex; align-items: center; justify-content: space-between; }
.page__title { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: 3px; color: #EEF2FF; }
.page__sub { font-size: 13px; color: #8892B0; margin-top: 2px; }
.sync-btn { display: inline-flex; align-items: center; gap: 8px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.stat-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.stat { background: #111520; border: 1px solid #1A1F2E; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.stat__val { font-family: 'Rajdhani', sans-serif; font-size: 28px; font-weight: 700; color: #EEF2FF; line-height: 1; }
.stat__lbl { font-size: 11px; color: #8892B0; text-transform: uppercase; letter-spacing: 1px; }

.panel { background: #111520; border: 1px solid #1A1F2E; border-radius: 10px; overflow: hidden; }
.panel__head { padding: 16px 18px; border-bottom: 1px solid #1A1F2E; }
.eyebrow { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: var(--accent); text-transform: uppercase; }

.empty { padding: 48px 20px; text-align: center; color: #8892B0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty p { color: #EEF2FF; font-weight: 600; }
.empty span { font-size: 13px; }

.series { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.bo { background: #0D1018; border: 1px solid #1A1F2E; border-radius: 8px; padding: 12px 14px; }
.bo__top { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.bo__tag { font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: 1px; font-size: 12px; padding: 3px 8px; border-radius: 4px; }
.bo__tag.win { color: #10B981; background: rgba(16,185,129,.12); }
.bo__tag.loss { color: #EF4444; background: rgba(239,68,68,.12); }
.bo__score { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; color: #EEF2FF; }
.bo__res { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
.bo__res.win { color: #10B981; } .bo__res.loss { color: #EF4444; }
.bo__date { margin-left: auto; font-size: 12px; color: #8892B0; }

.bo__games { display: flex; flex-wrap: wrap; gap: 8px; }
.game {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; cursor: pointer;
  background: #111520; border: 1px solid #1A1F2E; border-left-width: 3px; font-family: inherit; transition: all .15s;
}
.game:hover { background: #161B28; transform: translateX(2px); }
.game.win { border-left-color: #10B981; } .game.loss { border-left-color: #EF4444; }
.game__n { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 12px; color: #8892B0; }
.game__side { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
.game__res { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 13px; color: #EEF2FF; }
.game__dur { font-size: 12px; color: #8892B0; }

@media (max-width: 768px) { .stat-bar { grid-template-columns: repeat(2, 1fr); } }
</style>
