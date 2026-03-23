<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMatchStore, type Match } from '@/stores/matches'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { X, ChevronRight, Users, User } from 'lucide-vue-next'
import { useCssVar } from '@vueuse/core'
import { Line, Doughnut } from 'vue-chartjs'
import { STATIC_BASE } from '@/config'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, Tooltip, Legend, Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler)

const router     = useRouter()
const matchStore = useMatchStore()
const auth       = useAuthStore()

const tab = ref<'team' | 'perso'>('team')

onMounted(() => matchStore.fetchHistory(200))

// Reactive accent color for Chart.js (follows brand theme)
const accentCss = useCssVar('--accent', document.documentElement)
const accent    = computed(() => accentCss.value.trim() || '#FF6B1A')

// ── helpers ───────────────────────────────────────────────────────────────────

function logoSrc(logo: string | null) {
  if (!logo) return null
  return logo.startsWith('/logos/') ? `${STATIC_BASE}${logo}` : logo
}
function boFormat(n: number) { return n <= 1 ? 'BO1' : n <= 3 ? 'BO3' : 'BO5' }
function fmtDate(d: string)  { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
function fmtDateShort(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }

const TYPE_LABELS: Record<string, string> = { scrim: 'SCRIM', tournament: 'TOURNOI', official: 'OFFICIEL' }

const CHAMP_SPECIAL: Record<string, string> = {
  "Nunu & Willump": "Nunu", "Renata Glasc": "Renata",
  "K'Sante": "KSante", "Bel'Veth": "Belveth", "Wukong": "MonkeyKing",
}
const DD_VER = '15.6.1'
function champIcon(name: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VER}/img/champion/${CHAMP_SPECIAL[name] ?? name}.png`
}

interface RiotParticipant {
  name: string; tag: string; champion: string; teamId: number; role: string
  kills: number; deaths: number; assists: number; gold: number; cs: number
  damage: number; vision: number; win: boolean; isUser: boolean
}
interface RiotData { matchId: string; duration: number; queueLabel: string; participants: RiotParticipant[] }

function parseNotes(notes: string | null) {
  if (!notes) return null
  const m = notes.match(/^Import Riot — (\S+) (\d+)\/(\d+)\/(\d+) \((.+), (\d+)min\)/)
  if (!m) return null
  const [, champion, k, d, a, queue, dur] = m
  const kills = +k, deaths = +d, assists = +a
  return { champion, kills, deaths, assists, kda: deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2), queue, duration: +dur }
}
function parseRiotData(raw: string | null): RiotData | null {
  if (!raw) return null
  try { return JSON.parse(raw) as RiotData } catch { return null }
}

// ── TEAM TAB ──────────────────────────────────────────────────────────────────

interface BoGroup {
  key: string; seriesId: string | null; matches: Match[]
  wins: number; losses: number; total: number
  opponent: string; logo: string | null; date: string
  isSolo: boolean; seriesWin: boolean
}

const boGroups = computed<BoGroup[]>(() => {
  const grouped = new Map<string, Match[]>()
  const solos: Match[] = []
  for (const m of matchStore.history.filter(m => m.context === 'team')) {
    if (m.series_id) {
      if (!grouped.has(m.series_id)) grouped.set(m.series_id, [])
      grouped.get(m.series_id)!.push(m)
    } else solos.push(m)
  }
  const result: BoGroup[] = []
  for (const [seriesId, matches] of grouped) {
    const wins = matches.filter(m => m.result === 'win').length
    const losses = matches.filter(m => m.result === 'loss').length
    const dates = matches.map(m => m.date).sort()
    result.push({ key: seriesId, seriesId, matches, wins, losses, total: matches.length,
      opponent: matches[0].opponent, logo: matches[0].opponent_logo,
      date: dates[dates.length - 1], isSolo: false, seriesWin: wins > losses })
  }
  for (const m of solos) {
    result.push({ key: String(m.id), seriesId: null, matches: [m],
      wins: m.result === 'win' ? 1 : 0, losses: m.result === 'loss' ? 1 : 0, total: 1,
      opponent: m.opponent, logo: m.opponent_logo, date: m.date,
      isSolo: true, seriesWin: m.result === 'win' })
  }
  result.sort((a, b) => b.date.localeCompare(a.date))
  return result
})

const teamStats = computed(() => {
  const all = boGroups.value
  const wins = all.filter(g => g.seriesWin).length
  const losses = all.filter(g => !g.seriesWin).length
  return { wins, losses, total: all.length, wr: all.length ? Math.round(wins / all.length * 100) : 0 }
})

// modal
const selected = ref<BoGroup | null>(null)
function openBo(group: BoGroup) { selected.value = group }
function closeBo() { selected.value = null }
function openGame(match: Match) { closeBo(); router.push({ name: 'analytics-game', params: { id: match.id } }) }
const modalStats = computed(() => {
  if (!selected.value) return null
  const { wins, losses, total } = selected.value
  return { wins, losses, wr: total ? Math.round(wins / total * 100) : 0 }
})

// ── PERSO TAB ─────────────────────────────────────────────────────────────────

// All matches that have riot_data with an isUser participant
interface PersonalGame {
  match: Match
  player: RiotParticipant
  rd: RiotData
}

const personalGames = computed<PersonalGame[]>(() =>
  matchStore.history
    .filter(m => m.context === 'perso')
    .flatMap(m => {
      const rd = parseRiotData(m.riot_data ?? null)
      const player = rd?.participants.find(p => p.isUser)
      if (player && rd) return [{ match: m, player, rd }]
      if (m.context === 'perso' && !player) {
        // Manually grouped as perso without riot data — show as basic entry
        return [{ match: m, player: null as unknown as RiotParticipant, rd: null as unknown as RiotData }]
      }
      return []
    })
    .sort((a, b) => b.match.date.localeCompare(a.match.date))
)

const persoStats = computed(() => {
  const games = personalGames.value.filter(g => g.player !== null)
  if (!games.length) return null
  const wins  = games.filter(g => g.player.win).length
  const kdaSum = games.reduce((s, g) => {
    const { kills, deaths, assists } = g.player
    return s + (deaths === 0 ? (kills + assists) * 2 : (kills + assists) / deaths)
  }, 0)
  const avgKda  = (kdaSum / games.length).toFixed(2)
  const avgDmg  = Math.round(games.reduce((s, g) => s + g.player.damage, 0) / games.length)
  const avgCs   = Math.round(games.reduce((s, g) => s + g.player.cs, 0) / games.length)
  const avgVis  = Math.round(games.reduce((s, g) => s + g.player.vision, 0) / games.length)
  return { total: games.length, wins, losses: games.length - wins,
    wr: Math.round(wins / games.length * 100), avgKda, avgDmg, avgCs, avgVis }
})

// Champion pool
interface ChampStat { name: string; games: number; wins: number; kdaSum: number }
const champPool = computed(() => {
  const map = new Map<string, ChampStat>()
  for (const g of personalGames.value.filter(g => g.player !== null)) {
    const { champion, kills, deaths, assists, win } = g.player
    const kda = deaths === 0 ? (kills + assists) * 2 : (kills + assists) / deaths
    if (!map.has(champion)) map.set(champion, { name: champion, games: 0, wins: 0, kdaSum: 0 })
    const s = map.get(champion)!
    s.games++
    if (win) s.wins++
    s.kdaSum += kda
  }
  return [...map.values()]
    .sort((a, b) => b.games - a.games)
    .slice(0, 8)
    .map(s => ({ ...s, wr: Math.round(s.wins / s.games * 100), avgKda: (s.kdaSum / s.games).toFixed(1) }))
})

// ── CHARTS ────────────────────────────────────────────────────────────────────

const CHART_PALETTE = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#FFB347']

// KDA Trend line (chronological = reversed)
const kdaTrendData = computed(() => {
  const games = [...personalGames.value].reverse()
  const col   = accent.value
  return {
    labels: games.map((_, i) => `G${i + 1}`),
    datasets: [{
      label: 'KDA',
      data: games.map(g => {
        const { kills, deaths, assists } = g.player
        return deaths === 0 ? +((kills + assists) * 2).toFixed(2) : +((kills + assists) / deaths).toFixed(2)
      }),
      borderColor: col,
      backgroundColor: col + '22',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: games.map(g => g.player.win ? '#10B981' : '#EF4444'),
      pointBorderColor:     games.map(g => g.player.win ? '#10B981' : '#EF4444'),
      pointRadius: 5,
      pointHoverRadius: 7,
    }],
  }
})

const lineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0D1018',
      borderColor: '#2A2F40',
      borderWidth: 1,
      titleColor: '#EEF2FF',
      bodyColor: '#8892B0',
      padding: 10,
      callbacks: { label: (ctx: any) => ` ${ctx.raw} KDA` },
    },
  },
  scales: {
    x: {
      ticks: { color: '#3D4460', font: { family: 'Rajdhani', size: 10 } },
      grid:  { color: 'rgba(26,31,46,0.5)' },
      border:{ color: '#1A1F2E' },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#3D4460', font: { family: 'Rajdhani', size: 10 } },
      grid:  { color: 'rgba(26,31,46,0.5)' },
      border:{ color: '#1A1F2E' },
    },
  },
}))

// Champion pool doughnut
const champDoughnutData = computed(() => ({
  labels: champPool.value.map(c => c.name),
  datasets: [{
    data: champPool.value.map(c => c.games),
    backgroundColor: CHART_PALETTE.slice(0, champPool.value.length),
    borderColor: '#111520',
    borderWidth: 3,
    hoverOffset: 6,
  }],
}))

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600 },
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: '#8892B0',
        font: { family: 'Rajdhani', size: 10 },
        boxWidth: 10,
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: '#0D1018',
      borderColor: '#2A2F40',
      borderWidth: 1,
      titleColor: '#EEF2FF',
      bodyColor: '#8892B0',
      padding: 10,
      callbacks: { label: (ctx: any) => ` ${ctx.raw} partie${ctx.raw > 1 ? 's' : ''}` },
    },
  },
}


</script>

<template>
  <div class="analytics">
    <!-- Page header -->
    <div class="analytics__header">
      <div>
        <span class="analytics__eye">PERFORMANCE · DONNÉES</span>
        <h1 class="analytics__title">ANALYTICS</h1>
      </div>

      <!-- Tab switcher -->
      <div class="analytics__tabs">
        <button class="analytics__tab" :class="{ 'analytics__tab--active': tab === 'team' }" @click="tab = 'team'">
          <Users :size="14" />
          <span>ÉQUIPE</span>
        </button>
        <button class="analytics__tab" :class="{ 'analytics__tab--active': tab === 'perso' }" @click="tab = 'perso'">
          <User :size="14" />
          <span>PERSO</span>
        </button>
      </div>
    </div>

    <!-- ══════════════ TEAM TAB ══════════════ -->
    <template v-if="tab === 'team'">
      <div class="stat-bar">
        <div class="stat-bar__item">
          <span class="stat-bar__label">SÉRIES JOUÉES</span>
          <span class="stat-bar__value">{{ teamStats.total }}</span>
        </div>
        <div class="stat-bar__sep" />
        <div class="stat-bar__item">
          <span class="stat-bar__label">VICTOIRES</span>
          <span class="stat-bar__value stat-bar__value--win">{{ teamStats.wins }}</span>
        </div>
        <div class="stat-bar__sep" />
        <div class="stat-bar__item">
          <span class="stat-bar__label">DÉFAITES</span>
          <span class="stat-bar__value stat-bar__value--loss">{{ teamStats.losses }}</span>
        </div>
        <div class="stat-bar__sep" />
        <div class="stat-bar__item">
          <span class="stat-bar__label">WIN RATE</span>
          <span class="stat-bar__value" :style="{ color: teamStats.wr >= 50 ? '#10B981' : '#EF4444' }">{{ teamStats.wr }}%</span>
        </div>
      </div>

      <section class="series-section">
        <div class="series-section__head">
          <span class="series-section__title">SÉRIES · ANALYSE</span>
          <span class="series-section__hint">Cliquez sur une série pour l'analyser</span>
        </div>
        <div v-if="matchStore.loading" class="series-empty">Chargement…</div>
        <div v-else-if="boGroups.length === 0" class="series-empty">Aucun résultat enregistré.</div>
        <div v-else class="series-list">
          <button
            v-for="group in boGroups" :key="group.key"
            class="series-row" :class="group.seriesWin ? 'series-row--win' : 'series-row--loss'"
            @click="openBo(group)"
          >
            <div class="series-row__logo-wrap">
              <img v-if="logoSrc(group.logo)" :src="logoSrc(group.logo)!" class="series-row__logo" :alt="group.opponent" />
              <div v-else class="series-row__letter">{{ group.opponent.charAt(0).toUpperCase() }}</div>
            </div>
            <div class="series-row__body">
              <div class="series-row__top">
                <span class="series-row__opponent">{{ group.opponent }}</span>
                <span class="series-row__format">{{ boFormat(group.total) }}</span>
                <span class="series-row__type">{{ TYPE_LABELS[group.matches[0].type] }}</span>
              </div>
              <div class="series-row__games">
                <span v-for="(m, i) in group.matches" :key="i"
                  class="series-row__dot"
                  :class="m.result === 'win' ? 'series-row__dot--win' : 'series-row__dot--loss'"
                >{{ m.result === 'win' ? 'V' : 'D' }}</span>
              </div>
            </div>
            <div class="series-row__right">
              <div v-if="!group.isSolo" class="series-row__score">
                <span class="series-row__score-win">{{ group.wins }}</span>
                <span class="series-row__score-sep">—</span>
                <span class="series-row__score-loss">{{ group.losses }}</span>
              </div>
              <span class="series-row__result" :class="group.seriesWin ? 'series-row__result--win' : 'series-row__result--loss'">
                {{ group.seriesWin ? 'VICTOIRE' : 'DÉFAITE' }}
              </span>
              <span class="series-row__date">{{ fmtDateShort(group.date) }}</span>
            </div>
            <ChevronRight :size="14" class="series-row__chevron" />
          </button>
        </div>
      </section>
    </template>

    <!-- ══════════════ PERSO TAB ══════════════ -->
    <template v-else>
      <div v-if="!personalGames.length" class="perso-empty">
        <span>Aucune donnée personnelle — importe des matchs avec Riot Data pour voir tes stats.</span>
      </div>
      <template v-else>

        <!-- Personal stats bar -->
        <div class="stat-bar">
          <div class="stat-bar__item">
            <span class="stat-bar__label">PARTIES</span>
            <span class="stat-bar__value">{{ persoStats!.total }}</span>
          </div>
          <div class="stat-bar__sep" />
          <div class="stat-bar__item">
            <span class="stat-bar__label">WIN RATE</span>
            <span class="stat-bar__value" :style="{ color: persoStats!.wr >= 50 ? '#10B981' : '#EF4444' }">{{ persoStats!.wr }}%</span>
          </div>
          <div class="stat-bar__sep" />
          <div class="stat-bar__item">
            <span class="stat-bar__label">KDA MOY.</span>
            <span class="stat-bar__value" style="color:var(--accent)">{{ persoStats!.avgKda }}</span>
          </div>
          <div class="stat-bar__sep" />
          <div class="stat-bar__item">
            <span class="stat-bar__label">DMG MOY.</span>
            <span class="stat-bar__value">{{ (persoStats!.avgDmg / 1000).toFixed(1) }}k</span>
          </div>
          <div class="stat-bar__sep" />
          <div class="stat-bar__item">
            <span class="stat-bar__label">CS MOY.</span>
            <span class="stat-bar__value">{{ persoStats!.avgCs }}</span>
          </div>
          <div class="stat-bar__sep" />
          <div class="stat-bar__item">
            <span class="stat-bar__label">VISION MOY.</span>
            <span class="stat-bar__value">{{ persoStats!.avgVis }}</span>
          </div>
        </div>

        <!-- Charts row -->
        <div class="perso-charts">
          <!-- KDA Trend -->
          <section class="perso-section perso-section--chart">
            <div class="perso-section__head">
              <span class="perso-section__title">ÉVOLUTION KDA</span>
              <span class="perso-section__hint">point vert = victoire · rouge = défaite</span>
            </div>
            <div class="perso-chart-body">
              <Line :data="kdaTrendData" :options="lineOptions" />
            </div>
          </section>
          <!-- Champion pool doughnut -->
          <section class="perso-section perso-section--chart">
            <div class="perso-section__head">
              <span class="perso-section__title">CHAMPION POOL</span>
              <span class="perso-section__hint">parties jouées</span>
            </div>
            <div class="perso-chart-body">
              <Doughnut :data="champDoughnutData" :options="doughnutOptions" />
            </div>
          </section>
        </div>

        <!-- Champion pool chips -->
        <section class="perso-section">
          <div class="perso-section__head">
            <span class="perso-section__title">DÉTAIL CHAMPIONS</span>
          </div>
          <div class="champ-pool">
            <div v-for="c in champPool" :key="c.name" class="champ-chip">
              <img :src="champIcon(c.name)" :alt="c.name" class="champ-chip__img"
                @error="($event.target as HTMLImageElement).src = '/logo.png'" />
              <span class="champ-chip__name">{{ c.name }}</span>
              <div class="champ-chip__stats">
                <span class="champ-chip__games">{{ c.games }}G</span>
                <span class="champ-chip__wr" :style="{ color: c.wr >= 50 ? '#10B981' : '#EF4444' }">{{ c.wr }}%</span>
                <span class="champ-chip__kda" style="color:var(--accent)">{{ c.avgKda }} KDA</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Personal match history -->
        <section class="perso-section">
          <div class="perso-section__head">
            <span class="perso-section__title">HISTORIQUE PERSONNEL</span>
            <span class="perso-section__hint">{{ auth.username }} · {{ personalGames.length }} parties</span>
          </div>
          <div class="perso-list">
            <button
              v-for="g in personalGames" :key="g.match.id"
              class="perso-row"
              :class="g.player.win ? 'perso-row--win' : 'perso-row--loss'"
              @click="router.push({ name: 'analytics-game', params: { id: g.match.id } })"
            >
              <!-- Champ icon -->
              <div class="perso-row__champ">
                <img :src="champIcon(g.player.champion)" :alt="g.player.champion" class="perso-row__champ-img"
                  @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                <div class="perso-row__champ-info">
                  <span class="perso-row__champ-name">{{ g.player.champion }}</span>
                  <span class="perso-row__role">{{ g.player.role }}</span>
                </div>
              </div>

              <!-- Result badge -->
              <div class="perso-row__result" :class="g.player.win ? 'perso-row__result--win' : 'perso-row__result--loss'">
                {{ g.player.win ? 'V' : 'D' }}
              </div>

              <!-- KDA -->
              <div class="perso-row__kda-block">
                <span class="perso-row__kda">{{ g.player.kills }}/{{ g.player.deaths }}/{{ g.player.assists }}</span>
                <span class="perso-row__kda-ratio"
                  :style="{ color: g.player.deaths === 0 || (g.player.kills + g.player.assists) / g.player.deaths >= 3 ? '#10B981'
                    : (g.player.kills + g.player.assists) / g.player.deaths >= 2 ? 'var(--accent)' : '#EF4444' }"
                >
                  {{ g.player.deaths === 0 ? 'Perfect' : ((g.player.kills + g.player.assists) / g.player.deaths).toFixed(2) }} KDA
                </span>
              </div>

              <!-- Stats -->
              <div class="perso-row__stats">
                <span class="perso-row__stat"><span class="perso-row__stat-label">CS</span> {{ g.player.cs }}</span>
                <span class="perso-row__stat"><span class="perso-row__stat-label">DMG</span> {{ (g.player.damage / 1000).toFixed(1) }}k</span>
                <span class="perso-row__stat"><span class="perso-row__stat-label">VIS</span> {{ g.player.vision }}</span>
              </div>

              <!-- Meta -->
              <div class="perso-row__meta">
                <span class="perso-row__opponent">vs {{ g.match.opponent }}</span>
                <span class="perso-row__date">{{ fmtDateShort(g.match.date) }}</span>
                <span class="perso-row__dur">{{ g.rd.duration }}min</span>
              </div>

              <ChevronRight :size="13" class="series-row__chevron" />
            </button>
          </div>
        </section>

      </template>
    </template>
  </div>

  <!-- BO Modal (team tab) -->
  <Teleport to="body">
    <div v-if="selected" class="modal-overlay" @click.self="closeBo">
      <div class="modal">
        <div class="modal__head">
          <div class="modal__head-left">
            <div class="modal__logo-wrap">
              <img v-if="logoSrc(selected.logo)" :src="logoSrc(selected.logo)!" class="modal__logo" :alt="selected.opponent" />
              <div v-else class="modal__letter">{{ selected.opponent.charAt(0).toUpperCase() }}</div>
            </div>
            <div class="modal__head-info">
              <span class="modal__head-eye">{{ boFormat(selected.total) }} · {{ TYPE_LABELS[selected.matches[0].type] }}</span>
              <h2 class="modal__head-title">vs {{ selected.opponent }}</h2>
              <span class="modal__head-date">{{ fmtDate(selected.date) }}</span>
            </div>
          </div>
          <div class="modal__head-right">
            <div v-if="modalStats" class="modal__mini-stats">
              <div class="modal__mini-stat">
                <span class="modal__mini-label">GAMES</span>
                <span class="modal__mini-value">{{ selected.total }}</span>
              </div>
              <div v-if="!selected.isSolo" class="modal__mini-stat">
                <span class="modal__mini-label">SCORE</span>
                <span class="modal__mini-value">
                  <span style="color:#10B981">{{ selected.wins }}</span>
                  <span style="color:#3D4460"> — </span>
                  <span style="color:#EF4444">{{ selected.losses }}</span>
                </span>
              </div>
              <div class="modal__mini-stat">
                <span class="modal__mini-label">WIN RATE</span>
                <span class="modal__mini-value" :style="{ color: modalStats.wr >= 50 ? '#10B981' : '#EF4444' }">{{ modalStats.wr }}%</span>
              </div>
            </div>
            <button class="modal__close" @click="closeBo"><X :size="18" /></button>
          </div>
        </div>
        <div class="modal__body">
          <div
            v-for="(match, idx) in selected.matches" :key="match.id"
            class="game-card"
            :class="[match.result === 'win' ? 'game-card--win' : 'game-card--loss', parseRiotData(match.riot_data) ? 'game-card--clickable' : '']"
            @click="parseRiotData(match.riot_data) ? openGame(match) : undefined"
          >
            <div class="game-card__left">
              <span class="game-card__num">G{{ idx + 1 }}</span>
              <div class="game-card__result" :class="match.result === 'win' ? 'game-card__result--win' : 'game-card__result--loss'">
                {{ match.result === 'win' ? 'V' : 'D' }}
              </div>
            </div>
            <template v-if="parseNotes(match.notes)">
              <div class="game-card__champ">
                <img :src="champIcon(parseNotes(match.notes)!.champion)" :alt="parseNotes(match.notes)!.champion"
                  class="game-card__champ-img" @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                <span class="game-card__champ-name">{{ parseNotes(match.notes)!.champion }}</span>
              </div>
              <div class="game-card__stats">
                <div class="game-card__kda-line">
                  <span class="game-card__kda">{{ parseNotes(match.notes)!.kills }}/{{ parseNotes(match.notes)!.deaths }}/{{ parseNotes(match.notes)!.assists }}</span>
                  <span class="game-card__kda-ratio" :class="parseNotes(match.notes)!.kda === 'Perfect' || parseFloat(parseNotes(match.notes)!.kda) >= 3 ? 'kda--good' : parseFloat(parseNotes(match.notes)!.kda) >= 2 ? 'kda--ok' : 'kda--bad'">
                    {{ parseNotes(match.notes)!.kda }} KDA
                  </span>
                </div>
                <div class="game-card__meta">
                  <span class="game-card__queue">{{ parseNotes(match.notes)!.queue }}</span>
                  <span class="game-card__dur">{{ parseNotes(match.notes)!.duration }} min</span>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="game-card__notes">{{ match.notes ?? '—' }}</div>
            </template>
            <div class="game-card__right">
              <span class="game-card__date">{{ fmtDateShort(match.date) }}</span>
              <span v-if="parseRiotData(match.riot_data)" class="game-card__detail-hint">
                Voir détails <ChevronRight :size="11" />
              </span>
            </div>
          </div>
          <div v-if="selected.seriesId" class="modal__footer">
            <span class="modal__tag">{{ selected.seriesId }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.analytics { display: flex; flex-direction: column; gap: 20px; animation: pageIn .4s ease-out both; }

/* Header + tabs */
.analytics__header { display: flex; align-items: flex-end; justify-content: space-between; }
.analytics__eye { display: block; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 4px; color: var(--accent); margin-bottom: 4px; }
.analytics__title { font-family: 'Rajdhani', sans-serif; font-size: 30px; font-weight: 700; letter-spacing: 4px; color: #EEF2FF; margin: 0; }

.analytics__tabs { display: flex; gap: 4px; background: #0D1018; border: 1px solid #1A1F2E; border-radius: 8px; padding: 4px; }
.analytics__tab {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 18px; border: none; background: transparent; cursor: pointer;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #3D4460;
  border-radius: 6px; transition: all .15s;
}
.analytics__tab:hover { color: #8892B0; }
.analytics__tab--active {
  background: color-mix(in srgb, var(--accent) 10%, #111520);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
}

/* Stat bar */
.stat-bar { display: flex; align-items: center; background: #111520; border: 1px solid #1A1F2E; border-radius: 8px; overflow: hidden; }
.stat-bar__item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 16px; }
.stat-bar__sep { width: 1px; height: 36px; background: #1A1F2E; flex-shrink: 0; }
.stat-bar__label { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #3D4460; }
.stat-bar__value { font-family: 'Rajdhani', sans-serif; font-size: 24px; font-weight: 700; color: #EEF2FF; letter-spacing: 1px; }
.stat-bar__value--win  { color: #10B981; }
.stat-bar__value--loss { color: #EF4444; }

/* Series (team tab) */
.series-section { background: #111520; border: 1px solid #1A1F2E; border-radius: 8px; overflow: hidden; }
.series-section__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid #1A1F2E; }
.series-section__title { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #3D4460; }
.series-section__hint  { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }
.series-empty { padding: 36px; text-align: center; font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 1.5px; color: #3D4460; }
.series-list { display: flex; flex-direction: column; }
.series-row {
  display: flex; align-items: center; gap: 14px; padding: 12px 18px;
  border: none; border-bottom: 1px solid #1A1F2E; border-left: 3px solid transparent;
  background: transparent; cursor: pointer; text-align: left; transition: background .12s; width: 100%;
}
.series-row:last-child { border-bottom: none; }
.series-row--win  { border-left-color: #10B981; }
.series-row--loss { border-left-color: #EF4444; }
.series-row:hover { background: rgba(255,255,255,.02); }
.series-row__logo-wrap { width: 40px; height: 40px; border-radius: 8px; background: #1A1F2E; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.series-row__logo { width: 100%; height: 100%; object-fit: contain; }
.series-row__letter { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; color: var(--accent); }
.series-row__body { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.series-row__top { display: flex; align-items: center; gap: 8px; }
.series-row__opponent { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; color: #EEF2FF; letter-spacing: 1px; text-transform: uppercase; }
.series-row__format { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: var(--accent); background: color-mix(in srgb,var(--accent) 10%,transparent); border: 1px solid color-mix(in srgb,var(--accent) 25%,transparent); border-radius: 4px; padding: 1px 6px; }
.series-row__type { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #3D4460; background: #1A1F2E; border-radius: 4px; padding: 1px 6px; }
.series-row__games { display: flex; gap: 4px; }
.series-row__dot { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px; }
.series-row__dot--win  { background: rgba(16,185,129,.15); color: #10B981; }
.series-row__dot--loss { background: rgba(239,68,68,.15);  color: #EF4444; }
.series-row__right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.series-row__score { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 2px; }
.series-row__score-win  { color: #10B981; }
.series-row__score-sep  { color: #3D4460; margin: 0 2px; }
.series-row__score-loss { color: #EF4444; }
.series-row__result { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; }
.series-row__result--win  { color: #10B981; }
.series-row__result--loss { color: #EF4444; }
.series-row__date { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }
.series-row__chevron { color: #3D4460; flex-shrink: 0; }

/* ── Perso tab ─────────────────────────────────────────────────────────────── */
.perso-empty {
  padding: 60px 20px; text-align: center;
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600;
  letter-spacing: 1.5px; color: #3D4460;
  background: #111520; border: 1px solid #1A1F2E; border-radius: 8px;
}

.perso-section { background: #111520; border: 1px solid #1A1F2E; border-radius: 8px; overflow: hidden; }
.perso-section__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid #1A1F2E; }
.perso-section__title { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: var(--accent); }
.perso-section__hint  { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }

/* Charts */
.perso-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.perso-section--chart {}
.perso-chart-body { height: 220px; padding: 14px 18px 10px; }
.perso-section--chart-bar {}
.perso-chart-body--bar {
  height: calc(var(--bar-count, 8) * 36px + 32px);
  min-height: 100px;
  max-height: 340px;
  padding: 14px 18px 10px;
}

/* Champion pool */
.champ-pool { display: flex; flex-wrap: wrap; gap: 10px; padding: 16px 18px; }
.champ-chip {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: #0D1018; border: 1px solid #1A1F2E; border-radius: 8px;
  padding: 12px 14px; min-width: 88px;
  transition: border-color .15s;
}
.champ-chip:hover { border-color: color-mix(in srgb,var(--accent) 35%,transparent); }
.champ-chip__img { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; border: 1px solid #1A1F2E; }
.champ-chip__name { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #EEF2FF; text-align: center; }
.champ-chip__stats { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.champ-chip__games { font-family: 'Rajdhani', sans-serif; font-size: 10px; color: #3D4460; letter-spacing: 1px; }
.champ-chip__wr   { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; }
.champ-chip__kda  { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; }

/* Personal match list */
.perso-list { display: flex; flex-direction: column; }
.perso-row {
  display: flex; align-items: center; gap: 14px; padding: 11px 18px;
  border: none; border-bottom: 1px solid #1A1F2E; border-left: 3px solid transparent;
  background: transparent; cursor: pointer; text-align: left; width: 100%;
  transition: background .12s;
}
.perso-row:last-child { border-bottom: none; }
.perso-row--win  { border-left-color: #10B981; }
.perso-row--loss { border-left-color: #EF4444; }
.perso-row:hover { background: rgba(255,255,255,.025); }

.perso-row__champ { display: flex; align-items: center; gap: 8px; flex-shrink: 0; width: 150px; }
.perso-row__champ-img { width: 38px; height: 38px; border-radius: 6px; object-fit: cover; border: 1px solid #1A1F2E; flex-shrink: 0; }
.perso-row__champ-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.perso-row__champ-name { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #EEF2FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.perso-row__role { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #8892B0; background: #1A1F2E; border-radius: 3px; padding: 1px 5px; width: fit-content; }

.perso-row__result { width: 26px; height: 26px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.perso-row__result--win  { background: rgba(16,185,129,.15); color: #10B981; }
.perso-row__result--loss { background: rgba(239,68,68,.15);  color: #EF4444; }

.perso-row__kda-block { display: flex; flex-direction: column; gap: 2px; width: 120px; flex-shrink: 0; }
.perso-row__kda { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; color: #EEF2FF; }
.perso-row__kda-ratio { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; }

.perso-row__stats { display: flex; gap: 14px; flex: 1; }
.perso-row__stat { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.perso-row__stat-label { font-family: 'Rajdhani', sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 1.5px; color: #3D4460; }
.perso-row__stat { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #8892B0; }

.perso-row__meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.perso-row__opponent { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: #8892B0; letter-spacing: .5px; }
.perso-row__date { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }
.perso-row__dur  { font-family: 'Rajdhani', sans-serif; font-size: 10px; color: #3D4460; }

/* ── Modal ─────────────────────────────────────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(5,7,14,.82); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { background: #111520; border: 1px solid #1A1F2E; border-radius: 12px; width: 100%; max-width: 700px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.6); }
.modal__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px 14px; border-bottom: 1px solid #1A1F2E; flex-shrink: 0; }
.modal__head-left { display: flex; align-items: center; gap: 12px; }
.modal__logo-wrap { width: 46px; height: 46px; border-radius: 8px; background: #1A1F2E; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.modal__logo { width: 100%; height: 100%; object-fit: contain; }
.modal__letter { font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; color: var(--accent); }
.modal__head-info { display: flex; flex-direction: column; gap: 1px; }
.modal__head-eye { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 3px; color: var(--accent); }
.modal__head-title { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #EEF2FF; margin: 0; }
.modal__head-date { font-family: 'Inter', sans-serif; font-size: 11px; color: #8892B0; }
.modal__head-right { display: flex; align-items: flex-start; gap: 14px; flex-shrink: 0; }
.modal__mini-stats { display: flex; gap: 16px; }
.modal__mini-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.modal__mini-label { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #3D4460; }
.modal__mini-value { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; color: #EEF2FF; letter-spacing: 1px; }
.modal__close { background: #1A1F2E; border: 1px solid #2A2F40; border-radius: 6px; color: #8892B0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; flex-shrink: 0; }
.modal__close:hover { background: #2A2F40; color: #EEF2FF; }
.modal__body { overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.game-card { display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: #0D1018; border: 1px solid #1A1F2E; border-radius: 8px; border-left: 3px solid transparent; }
.game-card--win  { border-left-color: #10B981; }
.game-card--loss { border-left-color: #EF4444; }
.game-card--clickable { cursor: pointer; transition: background .12s; }
.game-card--clickable:hover { background: #111828; }
.game-card__left { display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; width: 32px; }
.game-card__num { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #3D4460; }
.game-card__result { width: 26px; height: 26px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; }
.game-card__result--win  { background: rgba(16,185,129,.15); color: #10B981; }
.game-card__result--loss { background: rgba(239,68,68,.15);  color: #EF4444; }
.game-card__champ { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.game-card__champ-img { width: 42px; height: 42px; border-radius: 6px; object-fit: cover; border: 1px solid #1A1F2E; }
.game-card__champ-name { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; color: #EEF2FF; letter-spacing: 1px; white-space: nowrap; }
.game-card__stats { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.game-card__kda-line { display: flex; align-items: center; gap: 10px; }
.game-card__kda { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; color: #EEF2FF; }
.game-card__kda-ratio { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; }
.kda--good { color: #10B981; }
.kda--ok   { color: var(--accent); }
.kda--bad  { color: #EF4444; }
.game-card__meta { display: flex; gap: 8px; }
.game-card__queue { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #8892B0; background: #1A1F2E; border-radius: 3px; padding: 2px 6px; }
.game-card__dur { font-family: 'Rajdhani', sans-serif; font-size: 12px; color: #3D4460; }
.game-card__notes { flex: 1; font-family: 'Inter', sans-serif; font-size: 12px; color: #8892B0; }
.game-card__right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.game-card__date { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }
.game-card__detail-hint { display: flex; align-items: center; gap: 2px; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px; color: var(--accent); }
.modal__footer { padding: 10px 0 2px; border-top: 1px solid #1A1F2E; margin-top: 4px; }
.modal__tag { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #3D4460; background: #0D1018; border: 1px solid #1A1F2E; border-radius: 4px; padding: 3px 10px; }

/* ── Light theme ──────────────────────────────────────────────────────────── */
html[data-theme="light"] .analytics__title { color: var(--t-primary); }
html[data-theme="light"] .analytics__tabs { background: var(--bg-card); border-color: var(--border); }
html[data-theme="light"] .analytics__tab { color: var(--t-muted); }
html[data-theme="light"] .analytics__tab:hover { color: var(--t-dim); }
html[data-theme="light"] .stat-bar { background: var(--bg-surface); border-color: var(--border); }
html[data-theme="light"] .stat-bar__sep { background: var(--border); }
html[data-theme="light"] .stat-bar__label { color: var(--t-muted); }
html[data-theme="light"] .stat-bar__value { color: var(--t-primary); }
html[data-theme="light"] .series-section { background: var(--bg-surface); border-color: var(--border); }
html[data-theme="light"] .series-section__head { border-bottom-color: var(--border); }
html[data-theme="light"] .series-section__title,
html[data-theme="light"] .series-section__hint { color: var(--t-muted); }
html[data-theme="light"] .series-empty { color: var(--t-muted); }
html[data-theme="light"] .series-row { border-bottom-color: var(--border); }
html[data-theme="light"] .series-row:hover { background: color-mix(in srgb, var(--t-primary) 4%, transparent); }
html[data-theme="light"] .series-row__logo-wrap { background: var(--bg-hover); }
html[data-theme="light"] .series-row__opponent { color: var(--t-primary); }
html[data-theme="light"] .series-row__type { color: var(--t-muted); background: var(--bg-hover); border-color: var(--border); }
html[data-theme="light"] .series-row__date { color: var(--t-muted); }
html[data-theme="light"] .series-row__chevron { color: var(--t-muted); }
html[data-theme="light"] .series-row__score-sep { color: var(--t-muted); }
html[data-theme="light"] .perso-empty { background: var(--bg-surface); border-color: var(--border); color: var(--t-muted); }
html[data-theme="light"] .perso-section { background: var(--bg-surface); border-color: var(--border); }
html[data-theme="light"] .perso-section__head { border-bottom-color: var(--border); }
html[data-theme="light"] .perso-section__hint { color: var(--t-muted); }
html[data-theme="light"] .champ-chip { background: var(--bg-card); border-color: var(--border); }
html[data-theme="light"] .champ-chip__img { border-color: var(--border); }
html[data-theme="light"] .champ-chip__name { color: var(--t-primary); }
html[data-theme="light"] .champ-chip__games { color: var(--t-muted); }
html[data-theme="light"] .perso-row { border-bottom-color: var(--border); }
html[data-theme="light"] .perso-row:hover { background: color-mix(in srgb, var(--t-primary) 4%, transparent); }
html[data-theme="light"] .perso-row__champ-img { border-color: var(--border); }
html[data-theme="light"] .perso-row__champ-name { color: var(--t-primary); }
html[data-theme="light"] .perso-row__role { background: var(--bg-hover); color: var(--t-dim); }
html[data-theme="light"] .perso-row__kda { color: var(--t-primary); }
html[data-theme="light"] .perso-row__opponent { color: var(--t-dim); }
html[data-theme="light"] .perso-row__date,
html[data-theme="light"] .perso-row__dur { color: var(--t-muted); }
html[data-theme="light"] .modal-overlay { background: rgba(200,210,240,.75); }
html[data-theme="light"] .modal { background: var(--bg-surface); border-color: var(--border); }
html[data-theme="light"] .modal__head { border-bottom-color: var(--border); }
html[data-theme="light"] .modal__head-title { color: var(--t-primary); }
html[data-theme="light"] .modal__head-date { color: var(--t-dim); }
html[data-theme="light"] .modal__mini-label { color: var(--t-muted); }
html[data-theme="light"] .modal__mini-value { color: var(--t-primary); }
html[data-theme="light"] .modal__close { background: var(--bg-card); border-color: var(--border); color: var(--t-dim); }
html[data-theme="light"] .modal__close:hover { background: var(--bg-hover); color: var(--t-primary); }
html[data-theme="light"] .game-card { background: var(--bg-card); border-color: var(--border); }
html[data-theme="light"] .game-card--clickable:hover { background: var(--bg-hover); }
html[data-theme="light"] .game-card__num { color: var(--t-muted); }
html[data-theme="light"] .game-card__champ-name { color: var(--t-primary); }
html[data-theme="light"] .game-card__kda { color: var(--t-primary); }
html[data-theme="light"] .game-card__queue { color: var(--t-dim); background: var(--bg-hover); }
html[data-theme="light"] .game-card__dur { color: var(--t-muted); }
html[data-theme="light"] .game-card__notes { color: var(--t-dim); }
html[data-theme="light"] .game-card__date { color: var(--t-muted); }
html[data-theme="light"] .modal__footer { border-top-color: var(--border); }
html[data-theme="light"] .modal__tag { color: var(--t-muted); background: var(--bg-card); border-color: var(--border); }

@keyframes pageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
