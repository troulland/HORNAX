<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RefreshCw, TrendingUp } from 'lucide-vue-next'
import { useRiotStore, type RankedGame } from '@/stores/riot'
import { useAuthStore } from '@/stores/auth'
import { useTeamStore } from '@/stores/team'
import { champIcon, fmtAgo, wrColor } from '@/utils/lol'

const riot = useRiotStore()
const auth = useAuthStore()
const team = useTeamStore()
const router = useRouter()

const tab = ref<'soloq' | 'flex'>('soloq')
const selectedUser = ref<number | null>(null)
const games = ref<RankedGame[]>([])
const loading = ref(false)

const roster = computed(() => team.roster)

async function loadSoloq() {
  if (!selectedUser.value) { games.value = []; return }
  loading.value = true
  games.value = await riot.fetchSoloq(selectedUser.value)
  loading.value = false
}
async function loadFlex() {
  loading.value = true
  games.value = await riot.fetchFlex()
  loading.value = false
}
function reload() { tab.value === 'soloq' ? loadSoloq() : loadFlex() }

async function sync() {
  const r = await riot.sync(true)
  if (r) reload()
}

// Stats client-side sur la liste courante
const wr = computed(() => {
  if (!games.value.length) return 0
  return Math.round((games.value.filter(g => g.win).length / games.value.length) * 100)
})
const champPool = computed(() => {
  const map: Record<string, { games: number; wins: number }> = {}
  for (const g of games.value) {
    map[g.champion] ??= { games: 0, wins: 0 }
    map[g.champion].games++
    if (g.win) map[g.champion].wins++
  }
  return Object.entries(map)
    .map(([name, s]) => ({ name, games: s.games, winRate: Math.round((s.wins / s.games) * 100) }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 6)
})
const playerName = (id: number) => roster.value.find(r => r.id === id)?.username ?? '—'
const openGame = (id: string, focus: number) => router.push(`/game/${id}?focus=${focus}`)

watch(tab, reload)
watch(selectedUser, () => { if (tab.value === 'soloq') loadSoloq() })

onMounted(async () => {
  if (auth.user?.team_id) await team.fetchRoster(auth.user.team_id)
  selectedUser.value = auth.user?.id ?? roster.value[0]?.id ?? null
  reload()
  // synchro auto en arrière-plan (espace partagé équipe, debounce 15 min serveur)
  riot.sync(false).then(r => { if (r && !r.skipped) reload() })
})
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">SOLOQ / FLEX</h1>
        <p class="page__sub">Suivi ranked des joueurs de la team</p>
      </div>
      <button class="hx-btn-primary sync-btn" :disabled="riot.syncing" @click="sync">
        <RefreshCw :size="15" :class="{ spin: riot.syncing }" />
        {{ riot.syncing ? 'Synchro…' : 'Synchroniser' }}
      </button>
    </header>

    <!-- Onglets -->
    <div class="tabs">
      <button class="tab" :class="{ 'tab--active': tab === 'soloq' }" @click="tab = 'soloq'">SoloQ</button>
      <button class="tab" :class="{ 'tab--active': tab === 'flex' }" @click="tab = 'flex'">Flex</button>
    </div>

    <!-- Sélecteur joueur (SoloQ uniquement) -->
    <div v-if="tab === 'soloq'" class="players">
      <button
        v-for="p in roster" :key="p.id"
        class="player" :class="{ 'player--active': selectedUser === p.id }"
        @click="selectedUser = p.id"
      >
        {{ p.username }}
        <span class="player__role">{{ p.game_role?.toUpperCase() }}</span>
      </button>
    </div>

    <!-- Résumé -->
    <div v-if="games.length" class="stat-bar">
      <div class="stat"><span class="stat__val">{{ games.length }}</span><span class="stat__lbl">Games</span></div>
      <div class="stat">
        <span class="stat__val" :style="{ color: wrColor(wr) }">{{ wr }}%</span>
        <span class="stat__lbl">Winrate</span>
      </div>
      <div class="stat champs">
        <span class="stat__lbl">Champions</span>
        <div class="champs__row">
          <div v-for="c in champPool" :key="c.name" class="champ" :title="`${c.name} · ${c.games}g · ${c.winRate}%`">
            <img :src="champIcon(c.name)" :alt="c.name" />
            <span :style="{ color: wrColor(c.winRate) }">{{ c.winRate }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Liste -->
    <section class="panel">
      <div class="panel__head"><span class="eyebrow">{{ tab === 'soloq' ? 'Parties SoloQ' : 'Parties Flex' }}</span></div>

      <div v-if="loading" class="empty">Chargement…</div>
      <div v-else-if="!games.length" class="empty">
        <TrendingUp :size="28" />
        <p>Aucune partie {{ tab === 'soloq' ? 'SoloQ' : 'Flex' }} importée.</p>
        <span>Clique sur <strong>Synchroniser</strong> pour lancer l'import.</span>
      </div>

      <div v-else class="list">
        <button
          v-for="g in games" :key="g.match_id"
          class="row" :class="g.win ? 'win' : 'loss'"
          @click="openGame(g.match_id, g.user_id)"
        >
          <img class="row__champ" :src="champIcon(g.champion)" :alt="g.champion" />
          <div class="row__main">
            <span class="row__champname">{{ g.champion }}</span>
            <span v-if="tab === 'flex'" class="row__player">{{ playerName(g.user_id) }}</span>
          </div>
          <div class="row__comp">
            <div class="mini-team">
              <img v-for="(c, ci) in g.allies" :key="'a' + ci" class="mini" :src="champIcon(c)" :alt="c" />
            </div>
            <span class="vsx">VS</span>
            <div class="mini-team">
              <img v-for="(c, ci) in g.enemies" :key="'e' + ci" class="mini" :src="champIcon(c)" :alt="c" />
            </div>
          </div>
          <div class="row__kda">
            <span class="row__kdanum">{{ g.kills }} / {{ g.deaths }} / {{ g.assists }}</span>
            <span class="row__cs">{{ g.cs }} CS</span>
          </div>
          <span class="row__res" :class="g.win ? 'win' : 'loss'">{{ g.win ? 'Victoire' : 'Défaite' }}</span>
          <span class="row__date">{{ fmtAgo(g.game_start) }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 20px; animation: pageIn .3s ease; }
@keyframes pageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.page__head { display: flex; align-items: center; justify-content: space-between; }
.page__title { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: 3px; color: var(--t-primary); }
.page__sub { font-size: 13px; color: var(--t-dim); margin-top: 2px; }
.sync-btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; font-size: 13px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.tabs { display: flex; gap: 4px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 4px; width: fit-content; }
.tab {
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
  padding: 8px 22px; border-radius: 6px; border: none; background: transparent; color: var(--t-dim); cursor: pointer; transition: all .15s;
}
.tab:hover { color: var(--t-primary); }
.tab--active { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }

.players { display: flex; flex-wrap: wrap; gap: 8px; }
.player {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 6px; cursor: pointer;
  background: var(--bg-card); border: 1px solid var(--border); color: var(--t-dim); font-family: 'Rajdhani', sans-serif; font-weight: 600; letter-spacing: 1px; transition: all .15s;
}
.player:hover { color: var(--t-primary); background: var(--bg-hover); }
.player--active { color: var(--accent); border-color: var(--accent); }
.player__role { font-size: 10px; opacity: .7; }

.stat-bar { display: grid; grid-template-columns: 1fr 1fr 3fr; gap: 12px; }
.stat { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.stat__val { font-family: 'Rajdhani', sans-serif; font-size: 28px; font-weight: 700; color: var(--t-primary); line-height: 1; }
.stat__lbl { font-size: 11px; color: var(--t-dim); text-transform: uppercase; letter-spacing: 1px; }
.champs__row { display: flex; gap: 10px; flex-wrap: wrap; }
.champ { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.champ img { width: 34px; height: 34px; border-radius: 6px; border: 1px solid var(--border-2); }
.champ span { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; }

.panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.panel__head { padding: 16px 18px; border-bottom: 1px solid var(--border); }
.eyebrow { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: var(--accent); text-transform: uppercase; }
.empty { padding: 48px 20px; text-align: center; color: var(--t-dim); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty p { color: var(--t-primary); font-weight: 600; }
.empty span { font-size: 13px; }

.list { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.row {
  display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--border); border-left: 3px solid transparent; font-family: inherit; transition: all .15s; text-align: left;
}
.row.win  { background: color-mix(in srgb, #10B981 7%, var(--bg-card)); border-left-color: #10B981; }
.row.loss { background: color-mix(in srgb, #EF4444 7%, var(--bg-card)); border-left-color: #EF4444; }
.row:hover { filter: brightness(1.08); }
.row__comp { display: flex; align-items: center; gap: 6px; }
.mini-team { display: flex; gap: 2px; }
.mini { width: 22px; height: 22px; border-radius: 4px; border: 1px solid var(--border-2); }
.vsx { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; color: var(--t-muted); }
.row__champ { width: 40px; height: 40px; border-radius: 6px; border: 1px solid var(--border-2); }
.row__main { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.row__champname { font-family: 'Rajdhani', sans-serif; font-weight: 700; color: var(--t-primary); letter-spacing: .5px; }
.row__player { font-size: 11px; color: var(--t-dim); }
.row__kda { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; min-width: 90px; }
.row__kdanum { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 14px; color: var(--t-primary); }
.row__cs { font-size: 11px; color: var(--t-dim); }
.row__res { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 13px; min-width: 66px; text-align: right; }
.row__res.win { color: #10B981; } .row__res.loss { color: #EF4444; }
.row__date { font-size: 12px; color: var(--t-dim); min-width: 70px; text-align: right; }

@media (max-width: 768px) { .stat-bar { grid-template-columns: 1fr; } }
</style>
