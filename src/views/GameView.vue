<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Crown, TrendingDown, Zap } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { API_BASE as API } from '@/config'

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()

// ── types ────────────────────────────────────────────────────────────────────

interface P {
  name: string; tag: string; champion: string; teamId: number; role: string
  kills: number; deaths: number; assists: number
  gold: number; cs: number; damage: number; vision: number
  win: boolean; isUser: boolean
  wardsPlaced: number; wardsKilled: number; controlWards: number; turretKills: number
}
interface TeamObj { baron: number; dragon: number; horde: number; riftHerald: number; tower: number; inhibitor: number }
interface RiotTeam { teamId: number; win: boolean; dragonTypes?: string[]; objectives: TeamObj }
interface RiotData { matchId: string; duration: number; queueLabel: string; participants: P[]; teams: RiotTeam[] }

// ── data (cache Riot via /api/game/:matchId, normalisé côté back) ──────────────

const rd = ref<RiotData | null>(null)
const match = ref<{ date: string; result: 'win' | 'loss' | null } | null>(null)
const loading = ref(true)

onMounted(async () => {
  const focus = route.query.focus ? `?focus=${route.query.focus}` : ''
  try {
    const res = await fetch(`${API}/game/${route.params.matchId}${focus}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      const d = await res.json()
      rd.value = { matchId: d.matchId, duration: d.duration, queueLabel: d.queueLabel, participants: d.participants, teams: d.teams }
      match.value = { date: d.date, result: d.result }
    }
  } finally { loading.value = false }
})

const all   = computed(() => rd.value?.participants ?? [])
const user  = computed(() => all.value.find(p => p.isUser) ?? null)
const myTid = computed(() => user.value?.teamId ?? 100)
const myTeam = computed(() => all.value.filter(p => p.teamId === myTid.value))
const enemy  = computed(() => all.value.filter(p => p.teamId !== myTid.value))

// ── performance score ─────────────────────────────────────────────────────────

function getWeights(role: string) {
  if (role === 'SUP')
    return { kda: 0.22, dmg: 0.10, kp: 0.28, cs: 0.02, vis: 0.38 }
  if (role === 'JGL')
    return { kda: 0.26, dmg: 0.22, kp: 0.30, cs: 0.12, vis: 0.10 }
  // TOP / MID / ADC / default
  return { kda: 0.28, dmg: 0.34, kp: 0.20, cs: 0.12, vis: 0.06 }
}

function score(p: P): number {
  const w = getWeights(p.role)
  const maxDmg  = Math.max(...all.value.map(x => x.damage), 1)
  const maxCS   = Math.max(...all.value.map(x => x.cs), 1)
  const maxVis  = Math.max(...all.value.map(x => x.vision), 1)
  const teamKills = myTeam.value.reduce((s, x) => s + x.kills, 0)
  const kda = p.deaths === 0 ? (p.kills + p.assists) * 2.5 : (p.kills + p.assists) / p.deaths
  const kp  = teamKills > 0 ? (p.kills + p.assists) / teamKills : 0
  // No cap on KDA — exceptional games can score above 10
  return (kda / 8)            * w.kda
       + (p.damage / maxDmg)  * w.dmg
       + kp                   * w.kp
       + (p.cs / maxCS)       * w.cs
       + (p.vision / maxVis)  * w.vis
}

function rating(p: P) { return (score(p) * 10).toFixed(1) }

const ranked = computed(() => [...myTeam.value].sort((a, b) => score(b) - score(a)))
const mvp    = computed(() => ranked.value[0] ?? null)
const weak   = computed(() => ranked.value[ranked.value.length - 1] ?? null)
const myScore = computed(() => user.value ? score(user.value) : 0)

// ── radar (6 axes, SVG 240×240) ───────────────────────────────────────────────

const CX = 120, CY = 120, R = 82, N = 6

function angle(i: number) { return (i * 2 * Math.PI / N) - Math.PI / 2 }
function pt(i: number, v: number): string {
  return `${(CX + v * R * Math.cos(angle(i))).toFixed(1)},${(CY + v * R * Math.sin(angle(i))).toFixed(1)}`
}
function axisEnd(i: number) { return pt(i, 1) }
function labelPos(i: number): [number, number] {
  const r = R + 20
  return [+(CX + r * Math.cos(angle(i))).toFixed(1), +(CY + r * Math.sin(angle(i))).toFixed(1)]
}
function ring(frac: number) {
  return Array.from({ length: N }, (_, i) => pt(i, frac)).join(' ')
}

const radarData = computed(() => {
  const u = user.value
  if (!u) return Array(6).fill(0)
  const maxDmg  = Math.max(...all.value.map(x => x.damage), 1)
  const maxCS   = Math.max(...all.value.map(x => x.cs), 1)
  const maxVis  = Math.max(...all.value.map(x => x.vision), 1)
  const maxGold = Math.max(...all.value.map(x => x.gold), 1)
  const teamKills = myTeam.value.reduce((s, x) => s + x.kills, 0)
  const kda = u.deaths === 0 ? (u.kills + u.assists) * 2 : (u.kills + u.assists) / u.deaths
  const maxKDA = 10
  return [
    Math.min(kda / maxKDA, 1),
    u.damage / maxDmg,
    teamKills > 0 ? (u.kills + u.assists) / teamKills : 0,
    u.cs / maxCS,
    u.gold / maxGold,
    u.vision / maxVis,
  ]
})

const radarLabels = ['KDA', 'DÉGÂTS', 'PARTICIP.', 'CS', 'OR', 'VISION']

const radarPolygon = computed(() =>
  radarData.value.map((v, i) => pt(i, v)).join(' ')
)

// team avg radar
const avgData = computed(() => {
  if (!myTeam.value.length) return Array(6).fill(0)
  const maxDmg  = Math.max(...all.value.map(x => x.damage), 1)
  const maxCS   = Math.max(...all.value.map(x => x.cs), 1)
  const maxVis  = Math.max(...all.value.map(x => x.vision), 1)
  const maxGold = Math.max(...all.value.map(x => x.gold), 1)
  const teamKills = myTeam.value.reduce((s, x) => s + x.kills, 0)
  const avg = (fn: (p: P) => number) => myTeam.value.reduce((s, p) => s + fn(p), 0) / myTeam.value.length
  return [
    Math.min(avg(p => p.deaths === 0 ? (p.kills + p.assists) * 2 : (p.kills + p.assists) / p.deaths) / 10, 1),
    avg(p => p.damage / maxDmg),
    avg(p => teamKills > 0 ? (p.kills + p.assists) / teamKills : 0),
    avg(p => p.cs / maxCS),
    avg(p => p.gold / maxGold),
    avg(p => p.vision / maxVis),
  ]
})
const avgPolygon = computed(() => avgData.value.map((v, i) => pt(i, v)).join(' '))

// ── helpers ───────────────────────────────────────────────────────────────────

const DD_VER = '15.6.1'
const CHAMP_MAP: Record<string, string> = {
  "Nunu & Willump": "Nunu", "Renata Glasc": "Renata",
  "K'Sante": "KSante", "Bel'Veth": "Belveth", "Wukong": "MonkeyKing",
}
function champIcon(n: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VER}/img/champion/${CHAMP_MAP[n] ?? n}.png`
}
function fmtGold(g: number) { return g >= 1000 ? (g / 1000).toFixed(1) + 'k' : String(g) }
function kdaRatio(p: P) { return p.deaths === 0 ? 'Perfect' : ((p.kills + p.assists) / p.deaths).toFixed(2) }
function kdaColor(p: P) {
  if (p.deaths === 0) return '#10B981'
  const r = (p.kills + p.assists) / p.deaths
  return r >= 3 ? '#10B981' : r >= 2 ? 'var(--accent)' : '#EF4444'
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function kp(p: P) {
  const tk = myTeam.value.reduce((s, x) => s + x.kills, 0)
  return tk > 0 ? Math.round((p.kills + p.assists) / tk * 100) : 0
}

const maxDmgAll  = computed(() => Math.max(...all.value.map(p => p.damage), 1))
const maxGoldAll = computed(() => Math.max(...all.value.map(p => p.gold), 1))

const myTeamData   = computed(() => rd.value?.teams.find(t => t.teamId === myTid.value) ?? null)
const enemyTeamData= computed(() => rd.value?.teams.find(t => t.teamId !== myTid.value) ?? null)
const myTeamObj    = computed(() => myTeamData.value?.objectives ?? null)
const enemyTeamObj = computed(() => enemyTeamData.value?.objectives ?? null)

const DRAKE_IMG: Record<string, string> = {
  FIRE:     '/logo%20drake/icons8-drake-infernal-de-league-of-legends-1200.png',
  EARTH:    '/logo%20drake/icons8-drake-des-montagnes-de-league-of-legends-1200.png',
  WATER:    '/logo%20drake/icons8-drake-oc%C3%A9anique-de-league-of-legends-1200.png',
  AIR:      '/logo%20drake/icons8-cloud-drake-de-league-of-legends-1200.png',
  HEXTECH:  '/logo%20drake/icons8-drake-infernal-de-league-of-legends-1200.png',
  CHEMTECH: '/logo%20drake/icons8-drake-infernal-de-league-of-legends-1200.png',
  ELDER:    '/logo%20drake/icons8-drake-infernal-de-league-of-legends-1200.png',
}
const DRAKE_LABEL: Record<string, string> = {
  FIRE: 'INFERNAL', EARTH: 'MONTAGNE', WATER: 'OCÉAN', AIR: 'NUAGE',
  HEXTECH: 'HEXTECH', CHEMTECH: 'CHEMTECH', ELDER: 'ANCIEN',
}
const myDrakes   = computed(() => myTeamData.value?.dragonTypes ?? [])
const enemyDrakes= computed(() => enemyTeamData.value?.dragonTypes ?? [])

function ratingColor(r: string) {
  const v = parseFloat(r)
  if (v >= 7.5) return '#10B981'
  if (v >= 5.5) return 'var(--accent)'
  return '#EF4444'
}

const teamBlue = computed(() => all.value.filter(p => p.teamId === 100))
const teamRed  = computed(() => all.value.filter(p => p.teamId === 200))
</script>

<template>
  <div class="gv">
    <!-- Nav -->
    <div class="gv__nav">
      <button class="gv__back" @click="router.back()">
        <ArrowLeft :size="15" />
        <span>Retour</span>
      </button>
      <div v-if="match && rd" class="gv__nav-info">
        <span class="gv__nav-queue">{{ rd.queueLabel }}</span>
        <span class="gv__nav-dur">{{ rd.duration }} min</span>
        <span class="gv__nav-date">{{ fmtDate(match.date) }}</span>
      </div>
    </div>

    <!-- No data -->
    <div v-if="!rd" class="gv__empty">
      <Zap :size="32" />
      <p>Aucune donnée Riot pour cette partie.<br>Réimporte-la depuis l'onglet Import Riot.</p>
    </div>

    <template v-else-if="user">

      <!-- ── ROW 1 : Hero + Radar + Highlights ───────────────────── -->
      <div class="gv__row1">

        <!-- Hero card -->
        <div class="gv__hero">
          <!-- HUD corners -->
          <span class="hud hud--tl"/><span class="hud hud--tr"/>
          <span class="hud hud--bl"/><span class="hud hud--br"/>

          <div class="gv__hero-bg">
            <img :src="champIcon(user.champion)" class="gv__hero-blur" />
          </div>

          <!-- Top section: portrait + infos -->
          <div class="gv__hero-content">
            <img
              :src="champIcon(user.champion)" :alt="user.champion"
              class="gv__hero-champ"
              @error="($event.target as HTMLImageElement).src = '/logo.png'"
            />
            <div class="gv__hero-info">
              <div class="gv__hero-result" :class="match?.result === 'win' ? 'gv__result--win' : 'gv__result--loss'">
                {{ match?.result === 'win' ? 'VICTOIRE' : 'DÉFAITE' }}
              </div>
              <span class="gv__hero-name">{{ user.name }}</span>
              <div class="gv__hero-meta">
                <span class="gv__hero-champ-name">{{ user.champion }}</span>
                <span v-if="user.role" class="gv__hero-role">{{ user.role }}</span>
              </div>
            </div>
            <div class="gv__hero-right">
              <div class="gv__hero-score" :style="{ color: ratingColor(rating(user)) }">
                {{ rating(user) }}<span class="gv__hero-score-label">/10</span>
              </div>
              <span class="gv__hero-score-sub">SCORE</span>
            </div>
          </div>

          <!-- Kill participation bar -->
          <div class="gv__hero-kp">
            <div class="gv__hero-kp-label">
              <span>KILL PARTICIPATION</span>
              <span class="gv__hero-kp-val">{{ kp(user) }}%</span>
            </div>
            <div class="gv__hero-kp-track">
              <div class="gv__hero-kp-fill" :style="{ width: kp(user) + '%' }" />
            </div>
          </div>

          <!-- Stats grid: 3+3 -->
          <div class="gv__hero-stats">
            <div class="gv__hero-stat">
              <span class="gv__hero-stat-val">{{ user.kills }}/{{ user.deaths }}/{{ user.assists }}</span>
              <span class="gv__hero-stat-lbl">K / D / A</span>
            </div>
            <div class="gv__hero-stat-sep" />
            <div class="gv__hero-stat">
              <span class="gv__hero-stat-val" :style="{ color: kdaColor(user) }">{{ kdaRatio(user) }}</span>
              <span class="gv__hero-stat-lbl">KDA RATIO</span>
            </div>
            <div class="gv__hero-stat-sep" />
            <div class="gv__hero-stat">
              <span class="gv__hero-stat-val">{{ user.cs }}</span>
              <span class="gv__hero-stat-lbl">CS TOTAL</span>
            </div>
          </div>
          <div class="gv__hero-stats gv__hero-stats--bot">
            <div class="gv__hero-stat">
              <span class="gv__hero-stat-val" style="color:#F59E0B">{{ fmtGold(user.gold) }}</span>
              <span class="gv__hero-stat-lbl">OR GAGNÉ</span>
            </div>
            <div class="gv__hero-stat-sep" />
            <div class="gv__hero-stat">
              <span class="gv__hero-stat-val">{{ (user.damage / 1000).toFixed(1) }}k</span>
              <span class="gv__hero-stat-lbl">DÉGÂTS</span>
            </div>
            <div class="gv__hero-stat-sep" />
            <div class="gv__hero-stat">
              <span class="gv__hero-stat-val">{{ user.vision }}</span>
              <span class="gv__hero-stat-lbl">VISION</span>
            </div>
          </div>
        </div>

        <!-- Radar -->
        <div class="gv__radar-card">
          <span class="gv__card-title">RADAR DE PERFORMANCE</span>
          <svg :viewBox="`0 0 240 240`" class="gv__radar-svg">
            <!-- Grid rings -->
            <polygon v-for="l in [0.25,0.5,0.75,1]" :key="l" :points="ring(l)"
              fill="none" stroke="var(--border)" stroke-width="1" />
            <!-- Axes -->
            <line v-for="i in 6" :key="i"
              :x1="CX" :y1="CY" :x2="axisEnd(i-1).split(',')[0]" :y2="axisEnd(i-1).split(',')[1]"
              stroke="var(--border)" stroke-width="1" />
            <!-- Team avg -->
            <polygon :points="avgPolygon" fill="rgba(100,116,139,0.15)" stroke="var(--t-muted)" stroke-width="1.5" stroke-dasharray="3,2" />
            <!-- User -->
            <polygon :points="radarPolygon" fill="color-mix(in srgb,var(--accent) 18%,transparent)" stroke="var(--accent)" stroke-width="2" />
            <!-- Dots -->
            <circle v-for="(v, i) in radarData" :key="i"
              :cx="parseFloat(pt(i, v).split(',')[0])"
              :cy="parseFloat(pt(i, v).split(',')[1])"
              r="3" fill="var(--accent)" />
            <!-- Labels -->
            <text v-for="(lbl, i) in radarLabels" :key="lbl"
              :x="labelPos(i)[0]" :y="labelPos(i)[1]"
              text-anchor="middle" dominant-baseline="middle"
              font-family="Rajdhani, sans-serif" font-size="9" font-weight="700"
              letter-spacing="1" fill="var(--t-dim)"
            >{{ lbl }}</text>
          </svg>
          <div class="gv__radar-legend">
            <span class="gv__legend-item gv__legend-item--user">MOI</span>
            <span class="gv__legend-item gv__legend-item--avg">MOY. ÉQUIPE</span>
          </div>
        </div>

        <!-- Highlights -->
        <div class="gv__highlights">
          <!-- MVP -->
          <div class="gv__highlight gv__highlight--mvp" v-if="mvp">
            <div class="gv__highlight-head">
              <Crown :size="13" />
              <span>MVP</span>
            </div>
            <div class="gv__highlight-body">
              <img :src="champIcon(mvp.champion)" class="gv__highlight-champ"
                @error="($event.target as HTMLImageElement).src = '/logo.png'" />
              <div class="gv__highlight-info">
                <span class="gv__highlight-name" :class="{ 'gv__highlight-name--user': mvp.isUser }">
                  {{ mvp.isUser ? 'TOI 🔥' : mvp.name }}
                </span>
                <span class="gv__highlight-champ-name">{{ mvp.champion }}</span>
              </div>
              <div class="gv__highlight-score gv__highlight-score--mvp">{{ rating(mvp) }}</div>
            </div>
            <div class="gv__highlight-stats">
              <span>{{ mvp.kills }}/{{ mvp.deaths }}/{{ mvp.assists }}</span>
              <span>{{ (mvp.damage/1000).toFixed(1) }}k dmg</span>
              <span>{{ kp(mvp) }}% KP</span>
            </div>
          </div>

          <!-- Weakest -->
          <div class="gv__highlight gv__highlight--weak" v-if="weak && weak !== mvp">
            <div class="gv__highlight-head">
              <TrendingDown :size="13" />
              <span>À AMÉLIORER</span>
            </div>
            <div class="gv__highlight-body">
              <img :src="champIcon(weak.champion)" class="gv__highlight-champ"
                @error="($event.target as HTMLImageElement).src = '/logo.png'" />
              <div class="gv__highlight-info">
                <span class="gv__highlight-name" :class="{ 'gv__highlight-name--user': weak.isUser }">
                  {{ weak.isUser ? 'TOI' : weak.name }}
                </span>
                <span class="gv__highlight-champ-name">{{ weak.champion }}</span>
              </div>
              <div class="gv__highlight-score gv__highlight-score--weak">{{ rating(weak) }}</div>
            </div>
            <div class="gv__highlight-stats">
              <span>{{ weak.kills }}/{{ weak.deaths }}/{{ weak.assists }}</span>
              <span>{{ (weak.damage/1000).toFixed(1) }}k dmg</span>
              <span>{{ kp(weak) }}% KP</span>
            </div>
          </div>

          <!-- Team scores -->
          <div class="gv__team-scores">
            <span class="gv__card-title">SCORES ÉQUIPE</span>
            <div v-for="p in ranked" :key="p.name" class="gv__tscore-row">
              <img :src="champIcon(p.champion)" class="gv__tscore-champ"
                @error="($event.target as HTMLImageElement).src = '/logo.png'" />
              <span class="gv__tscore-name" :class="{ 'gv__tscore-name--user': p.isUser }">{{ p.isUser ? '▶ ' + p.name : p.name }}</span>
              <div class="gv__tscore-bar-wrap">
                <div class="gv__tscore-bar" :style="{ width: (score(p) * 100) + '%', background: ratingColor(rating(p)) }" />
              </div>
              <span class="gv__tscore-val" :style="{ color: ratingColor(rating(p)) }">{{ rating(p) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── ROW 2 : Objectives + Wards ─────────────────────────── -->
      <div class="gv__row2" v-if="myTeamObj && enemyTeamObj">

        <!-- Objectives grid -->
        <div class="gv__chart-card gv__chart-card--obj">
          <span class="gv__card-title">OBJECTIFS</span>
          <div class="obj-grid">

            <!-- DRAKES — individual type icons -->
            <div class="obj-card obj-card--drakes">
              <span class="obj-label">DRAKES</span>
              <div class="obj-score" style="margin-bottom:4px">
                <span class="obj-score-my" :class="myTeamObj!.dragon > enemyTeamObj!.dragon ? 'obj-score--win' : myTeamObj!.dragon < enemyTeamObj!.dragon ? 'obj-score--loss' : 'obj-score--even'">{{ myTeamObj!.dragon }}</span>
                <span class="obj-sep">—</span>
                <span class="obj-score-en" :class="enemyTeamObj!.dragon > myTeamObj!.dragon ? 'obj-score--win' : enemyTeamObj!.dragon < myTeamObj!.dragon ? 'obj-score--loss' : 'obj-score--even'">{{ enemyTeamObj!.dragon }}</span>
              </div>
              <!-- Individual drake icons if timeline data present -->
              <template v-if="myDrakes.length || enemyDrakes.length">
                <div class="drake-icons-row" v-if="myDrakes.length">
                  <div v-for="(type, i) in myDrakes" :key="'md'+i" class="drake-chip drake-chip--my" :title="DRAKE_LABEL[type] ?? type">
                    <img :src="DRAKE_IMG[type] ?? DRAKE_IMG.FIRE" class="drake-chip-img" />
                  </div>
                </div>
                <div class="drake-icons-row drake-icons-row--enemy" v-if="enemyDrakes.length">
                  <div v-for="(type, i) in enemyDrakes" :key="'ed'+i" class="drake-chip drake-chip--en" :title="DRAKE_LABEL[type] ?? type">
                    <img :src="DRAKE_IMG[type] ?? DRAKE_IMG.FIRE" class="drake-chip-img drake-chip-img--en" />
                  </div>
                </div>
              </template>
              <div class="obj-bar" v-else>
                <div class="obj-bar__my" :style="{ width: (myTeamObj!.dragon / Math.max(myTeamObj!.dragon + enemyTeamObj!.dragon, 1) * 100) + '%' }" />
              </div>
            </div>

            <!-- BARON -->
            <div class="obj-card">
              <div class="obj-icon-wrap">
                <span class="obj-icon">👹</span>
              </div>
              <span class="obj-label">BARON</span>
              <div class="obj-score">
                <span class="obj-score-my" :class="myTeamObj!.baron > enemyTeamObj!.baron ? 'obj-score--win' : myTeamObj!.baron < enemyTeamObj!.baron ? 'obj-score--loss' : 'obj-score--even'">{{ myTeamObj!.baron }}</span>
                <span class="obj-sep">—</span>
                <span class="obj-score-en" :class="enemyTeamObj!.baron > myTeamObj!.baron ? 'obj-score--win' : enemyTeamObj!.baron < myTeamObj!.baron ? 'obj-score--loss' : 'obj-score--even'">{{ enemyTeamObj!.baron }}</span>
              </div>
              <div class="obj-bar">
                <div class="obj-bar__my" :style="{ width: (myTeamObj!.baron / Math.max(myTeamObj!.baron + enemyTeamObj!.baron, 1) * 100) + '%' }" />
              </div>
            </div>

            <!-- VOID GRUBS -->
            <div class="obj-card">
              <div class="obj-icon-wrap obj-icon-wrap--sq">
                <img src="/logo%20drake/grubs.jpg" class="obj-img-sq" />
              </div>
              <span class="obj-label">VOID GRUBS</span>
              <div class="obj-score">
                <span class="obj-score-my" :class="myTeamObj!.horde > enemyTeamObj!.horde ? 'obj-score--win' : myTeamObj!.horde < enemyTeamObj!.horde ? 'obj-score--loss' : 'obj-score--even'">{{ myTeamObj!.horde }}</span>
                <span class="obj-sep">—</span>
                <span class="obj-score-en" :class="enemyTeamObj!.horde > myTeamObj!.horde ? 'obj-score--win' : enemyTeamObj!.horde < myTeamObj!.horde ? 'obj-score--loss' : 'obj-score--even'">{{ enemyTeamObj!.horde }}</span>
              </div>
              <div class="obj-bar">
                <div class="obj-bar__my" :style="{ width: (myTeamObj!.horde / Math.max(myTeamObj!.horde + enemyTeamObj!.horde, 1) * 100) + '%' }" />
              </div>
            </div>

          </div>
        </div>

        <!-- Wards / vision per player -->
        <div class="gv__chart-card">
          <span class="gv__card-title">VISION · WARDS</span>
          <div class="wards-table">
            <div class="wards-header">
              <span class="w-col-p"></span>
              <span class="w-col-n">POSÉS</span>
              <span class="w-col-n">DÉTRUITS</span>
              <span class="w-col-n">CONTROL</span>
              <span class="w-col-n">VIS. SCORE</span>
            </div>
            <div v-for="p in [...myTeam].sort((a,b) => b.vision - a.vision)" :key="p.name + '-w'" class="wards-row" :class="{ 'wards-row--user': p.isUser }">
              <div class="w-col-p">
                <img :src="champIcon(p.champion)" class="w-champ"
                  @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                <span class="w-name" :class="{ 'w-name--user': p.isUser }">{{ p.name }}</span>
              </div>
              <span class="w-col-n w-val">{{ p.wardsPlaced }}</span>
              <span class="w-col-n w-val">{{ p.wardsKilled }}</span>
              <span class="w-col-n w-val w-val--ctrl">{{ p.controlWards }}</span>
              <span class="w-col-n w-val w-val--vis">{{ p.vision }}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- fallback row2 if no team data yet (old imports) -->
      <div v-else class="gv__row2">
        <div class="gv__chart-card">
          <span class="gv__card-title">DÉGÂTS AUX CHAMPIONS</span>
          <div class="gv__bars">
            <div v-for="p in [...myTeam, ...enemy].sort((a,b) => b.damage - a.damage)" :key="p.name + '-dmg'" class="gv__bar-row">
              <img :src="champIcon(p.champion)" class="gv__bar-champ" @error="($event.target as HTMLImageElement).src = '/logo.png'" />
              <span class="gv__bar-name" :class="{ 'gv__bar-name--user': p.isUser, 'gv__bar-name--enemy': p.teamId !== myTid }">{{ p.name }}</span>
              <div class="gv__bar-track"><div class="gv__bar-fill" :style="{ width: (p.damage / maxDmgAll * 100) + '%', background: p.teamId === myTid ? (p.isUser ? 'var(--accent)' : '#3B82F6') : '#6B7280' }" /></div>
              <span class="gv__bar-val">{{ (p.damage / 1000).toFixed(1) }}k</span>
            </div>
          </div>
        </div>
        <div class="gv__chart-card">
          <span class="gv__card-title">OR GAGNÉ</span>
          <div class="gv__bars">
            <div v-for="p in [...myTeam, ...enemy].sort((a,b) => b.gold - a.gold)" :key="p.name + '-gold'" class="gv__bar-row">
              <img :src="champIcon(p.champion)" class="gv__bar-champ" @error="($event.target as HTMLImageElement).src = '/logo.png'" />
              <span class="gv__bar-name" :class="{ 'gv__bar-name--user': p.isUser, 'gv__bar-name--enemy': p.teamId !== myTid }">{{ p.name }}</span>
              <div class="gv__bar-track"><div class="gv__bar-fill" :style="{ width: (p.gold / maxGoldAll * 100) + '%', background: p.teamId === myTid ? (p.isUser ? '#F59E0B' : '#3B82F6') : '#6B7280' }" /></div>
              <span class="gv__bar-val gv__bar-val--gold">{{ fmtGold(p.gold) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── ROW 3 : Full scoreboard ─────────────────────────────── -->
      <div class="gv__scoreboard">
        <div v-for="(team, ti) in [teamBlue, teamRed]" :key="ti" class="gv__team-block">
          <div class="gv__team-head" :class="ti === 0 ? 'gv__team-head--blue' : 'gv__team-head--red'">
            <span>{{ ti === 0 ? 'ÉQUIPE BLEUE' : 'ÉQUIPE ROUGE' }}</span>
            <span :class="team[0]?.win ? 'res--win' : 'res--loss'">{{ team[0]?.win ? 'VICTOIRE' : 'DÉFAITE' }}</span>
          </div>
          <div class="gv__sb-table">
            <div class="gv__sb-header">
              <span class="sb-col-p">JOUEUR</span>
              <span class="sb-col-k">K/D/A</span>
              <span class="sb-col-r">KDA</span>
              <span class="sb-col-c">CS</span>
              <span class="sb-col-g">OR</span>
              <span class="sb-col-d">DÉGÂTS</span>
              <span class="sb-col-v">VIS</span>
              <span class="sb-col-s">SCORE</span>
            </div>
            <div v-for="p in team" :key="p.name"
              class="gv__sb-row"
              :class="{ 'gv__sb-row--user': p.isUser }"
            >
              <div class="sb-col-p">
                <img :src="champIcon(p.champion)" class="sb-champ"
                  @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                <div class="sb-pinfo">
                  <span class="sb-pname" :class="{ 'sb-pname--user': p.isUser }">{{ p.name }}</span>
                  <span class="sb-cname">{{ p.champion }}</span>
                </div>
                <span v-if="p.role" class="sb-role">{{ p.role }}</span>
              </div>
              <span class="sb-col-k sb-kda">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
              <span class="sb-col-r sb-ratio" :style="{ color: kdaColor(p) }">{{ kdaRatio(p) }}</span>
              <span class="sb-col-c sb-num">{{ p.cs }}</span>
              <span class="sb-col-g sb-num sb-gold">{{ fmtGold(p.gold) }}</span>
              <div class="sb-col-d">
                <span class="sb-dmg">{{ (p.damage/1000).toFixed(1) }}k</span>
                <div class="sb-dmg-bar">
                  <div class="sb-dmg-fill"
                    :style="{
                      width: (p.damage / maxDmgAll * 100) + '%',
                      background: ti === 0 ? '#3B82F6' : '#EF4444'
                    }"
                  />
                </div>
              </div>
              <span class="sb-col-v sb-num">{{ p.vision }}</span>
              <span class="sb-col-s sb-score" :style="{ color: ratingColor(rating(p)) }">{{ rating(p) }}</span>
            </div>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.gv {
  display: flex; flex-direction: column; gap: 16px;
  animation: pageIn .4s ease-out both;
}

/* Nav */
.gv__nav { display: flex; align-items: center; justify-content: space-between; }
.gv__back {
  display: flex; align-items: center; gap: 6px;
  background: none; border: 1px solid var(--border); border-radius: 6px;
  color: var(--t-dim); font-family: 'Rajdhani', sans-serif; font-size: 12px;
  font-weight: 700; letter-spacing: 1.5px; padding: 6px 12px;
  cursor: pointer; transition: all .15s;
}
.gv__back:hover { border-color: var(--accent); color: var(--accent); }
.gv__nav-info { display: flex; align-items: center; gap: 12px; }
.gv__nav-queue { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: var(--t-dim); background: var(--border); border-radius: 4px; padding: 3px 8px; }
.gv__nav-dur, .gv__nav-date { font-family: 'Inter', sans-serif; font-size: 11px; color: var(--t-muted); }

/* Empty */
.gv__empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px; color: var(--t-muted); text-align: center; }

/* Row 1 */
.gv__row1 { display: grid; grid-template-columns: 1fr 240px 280px; gap: 16px; }

/* Hero card */
/* Hero card — full HORNAX orange branding */
.gv__hero {
  border-radius: 10px;
  border: 1px solid color-mix(in srgb,var(--accent) 35%,transparent);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 0 0 1px color-mix(in srgb,var(--accent) 8%,transparent), inset 0 1px 0 color-mix(in srgb,var(--accent) 12%,transparent);
}
/* Orange gradient corner accent */
.gv__hero::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent 0%, var(--accent) 40%, var(--accent-2) 60%, transparent 100%);
  z-index: 2;
}
.gv__hero-bg {
  position: absolute; inset: 0; overflow: hidden;
}
.gv__hero-blur {
  width: 100%; height: 100%; object-fit: cover;
  filter: blur(28px) brightness(.18) saturate(1.8);
  transform: scale(1.25);
}
/* Orange tint overlay over the blurred bg */
.gv__hero-bg::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(135deg, color-mix(in srgb,var(--accent) 18%,transparent) 0%, rgba(255,60,0,.08) 50%, transparent 100%);
}
/* HUD corners */
.hud { position: absolute; width: 10px; height: 10px; border-color: var(--accent); border-style: solid; opacity: .6; z-index: 3; pointer-events: none; }
.hud--tl { top: 6px;  left: 6px;  border-width: 2px 0 0 2px; }
.hud--tr { top: 6px;  right: 6px; border-width: 2px 2px 0 0; }
.hud--bl { bottom: 6px; left: 6px;  border-width: 0 0 2px 2px; }
.hud--br { bottom: 6px; right: 6px; border-width: 0 2px 2px 0; }

.gv__hero-content { position: relative; z-index: 1; display: flex; align-items: flex-start; gap: 16px; padding: 18px 20px 14px; }
.gv__hero-champ {
  width: 88px; height: 88px; border-radius: 10px; object-fit: cover; flex-shrink: 0;
  border: 2px solid var(--accent);
  box-shadow: 0 0 28px color-mix(in srgb,var(--accent) 55%,transparent), 0 0 0 4px color-mix(in srgb,var(--accent) 10%,transparent);
}
.gv__hero-info { flex: 1; display: flex; flex-direction: column; gap: 5px; padding-top: 2px; }
.gv__hero-meta { display: flex; align-items: center; gap: 8px; }
.gv__hero-name {
  font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700;
  letter-spacing: 3px; text-transform: uppercase; line-height: 1;
  background: linear-gradient(90deg, #FFFFFF 0%, var(--accent-2) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.gv__hero-champ-name { font-family: 'Rajdhani', sans-serif; font-size: 12px; color: color-mix(in srgb,var(--accent) 65%,transparent); letter-spacing: 1px; }
.gv__hero-role {
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px;
  color: var(--accent); background: color-mix(in srgb,var(--accent) 12%,transparent); border: 1px solid color-mix(in srgb,var(--accent) 30%,transparent);
  border-radius: 4px; padding: 2px 6px;
}
.gv__hero-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.gv__hero-score {
  font-family: 'Rajdhani', sans-serif; font-size: 46px; font-weight: 700; line-height: 1;
  text-shadow: 0 0 24px currentColor;
}
.gv__hero-score-label { font-size: 18px; color: color-mix(in srgb,var(--accent) 35%,transparent); }
.gv__hero-score-sub { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; color: color-mix(in srgb,var(--accent) 40%,transparent); text-align: right; }
.gv__hero-result {
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px;
  padding: 3px 8px; border-radius: 4px; align-self: flex-start;
}
.gv__result--win  { color: #10B981; background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.3); }
.gv__result--loss { color: #EF4444; background: rgba(239,68,68,.12);   border: 1px solid rgba(239,68,68,.3);  }

/* KP bar */
.gv__hero-kp { position: relative; z-index: 1; padding: 0 20px 12px; display: flex; flex-direction: column; gap: 5px; }
.gv__hero-kp-label { display: flex; justify-content: space-between; font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; color: color-mix(in srgb,var(--accent) 55%,transparent); }
.gv__hero-kp-val { color: var(--accent); }
.gv__hero-kp-track { height: 4px; background: color-mix(in srgb,var(--accent) 12%,transparent); border-radius: 2px; overflow: hidden; }
.gv__hero-kp-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); border-radius: 2px; transition: width .5s ease; box-shadow: 0 0 8px color-mix(in srgb,var(--accent) 60%,transparent); }

/* Stats rows */
.gv__hero-stats {
  position: relative; z-index: 1; display: flex;
  background: rgba(0,0,0,.45);
  border-top: 1px solid color-mix(in srgb,var(--accent) 18%,transparent);
}
.gv__hero-stats--bot { border-top: 1px solid rgba(255,255,255,.04); }
.gv__hero-stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 11px 8px; }
.gv__hero-stat-sep { width: 1px; background: color-mix(in srgb,var(--accent) 12%,transparent); margin: 8px 0; flex-shrink: 0; }
.gv__hero-stat-val { font-family: 'Rajdhani', sans-serif; font-size: 17px; font-weight: 700; color: #FFFFFF; letter-spacing: 1px; }
.gv__hero-stat-lbl { font-family: 'Rajdhani', sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 1.5px; color: color-mix(in srgb,var(--accent) 50%,transparent); }

/* Radar */
.gv__radar-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.gv__card-title { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: var(--t-muted); align-self: flex-start; }
.gv__radar-svg { width: 100%; }
.gv__radar-legend { display: flex; gap: 14px; }
.gv__legend-item { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px; display: flex; align-items: center; gap: 5px; }
.gv__legend-item::before { content: ''; display: inline-block; width: 14px; height: 2px; border-radius: 1px; }
.gv__legend-item--user { color: var(--accent); }
.gv__legend-item--user::before { background: var(--accent); }
.gv__legend-item--avg { color: var(--t-muted); }
.gv__legend-item--avg::before { background: var(--t-muted); border-style: dashed; }

/* Highlights */
.gv__highlights { display: flex; flex-direction: column; gap: 10px; }
.gv__highlight { border-radius: 8px; border: 1px solid; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.gv__highlight--mvp  { background: rgba(16,185,129,.05); border-color: rgba(16,185,129,.25); }
.gv__highlight--weak { background: rgba(239,68,68,.05);  border-color: rgba(239,68,68,.2); }
.gv__highlight-head { display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; }
.gv__highlight--mvp  .gv__highlight-head { color: #10B981; }
.gv__highlight--weak .gv__highlight-head { color: #EF4444; }
.gv__highlight-body { display: flex; align-items: center; gap: 10px; }
.gv__highlight-champ { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.gv__highlight-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.gv__highlight-name { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; color: var(--t-primary); letter-spacing: 1px; }
.gv__highlight-name--user { color: var(--accent); }
.gv__highlight-champ-name { font-family: 'Inter', sans-serif; font-size: 10px; color: var(--t-muted); }
.gv__highlight-score { font-family: 'Rajdhani', sans-serif; font-size: 24px; font-weight: 700; }
.gv__highlight-score--mvp  { color: #10B981; }
.gv__highlight-score--weak { color: #EF4444; }
.gv__highlight-stats { display: flex; gap: 10px; font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: .5px; color: var(--t-dim); }

/* Team scores */
.gv__team-scores { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.gv__tscore-row { display: flex; align-items: center; gap: 8px; }
.gv__tscore-champ { width: 24px; height: 24px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.gv__tscore-name { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: var(--t-dim); letter-spacing: .5px; width: 80px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gv__tscore-name--user { color: var(--accent); }
.gv__tscore-bar-wrap { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
.gv__tscore-bar { height: 100%; border-radius: 3px; transition: width .4s ease; }
.gv__tscore-val { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; width: 30px; text-align: right; flex-shrink: 0; }

/* Row 2 */
.gv__row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.gv__chart-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.gv__bars { display: flex; flex-direction: column; gap: 7px; }
.gv__bar-row { display: flex; align-items: center; gap: 8px; }
.gv__bar-champ { width: 24px; height: 24px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.gv__bar-name { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; color: var(--t-dim); width: 76px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gv__bar-name--user   { color: var(--accent); }
.gv__bar-name--enemy  { color: var(--t-muted); }
.gv__bar-track { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.gv__bar-fill { height: 100%; border-radius: 3px; transition: width .4s ease; }
.gv__bar-val { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: var(--t-dim); width: 36px; text-align: right; flex-shrink: 0; }
.gv__bar-val--gold { color: #F59E0B; }

/* Row 3 - Scoreboard */
.gv__scoreboard { display: flex; flex-direction: column; gap: 12px; }
.gv__team-block { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.gv__team-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
.gv__team-head--blue { background: rgba(59,130,246,.08); color: #60A5FA; border-bottom: 1px solid rgba(59,130,246,.15); }
.gv__team-head--red  { background: rgba(239,68,68,.08);  color: #F87171; border-bottom: 1px solid rgba(239,68,68,.15); }
.res--win  { color: #10B981; }
.res--loss { color: #EF4444; }

.gv__sb-table { display: flex; flex-direction: column; }
.gv__sb-header {
  display: grid; grid-template-columns: 1fr 90px 58px 48px 52px 110px 40px 52px;
  padding: 6px 16px;
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: var(--t-muted);
  border-bottom: 1px solid var(--border);
}
.gv__sb-row {
  display: grid; grid-template-columns: 1fr 90px 58px 48px 52px 110px 40px 52px;
  align-items: center; padding: 8px 16px; border-bottom: 1px solid rgba(26,31,46,.5);
  transition: background .1s;
}
.gv__sb-row:last-child { border-bottom: none; }
.gv__sb-row:hover { background: rgba(255,255,255,.02); }
.gv__sb-row--user { background: color-mix(in srgb,var(--accent) 5%,transparent); }
.gv__sb-row--user:hover { background: color-mix(in srgb,var(--accent) 8%,transparent); }

.sb-col-p { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sb-champ { width: 32px; height: 32px; border-radius: 5px; object-fit: cover; flex-shrink: 0; }
.sb-pinfo { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.sb-pname { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: var(--t-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-pname--user { color: var(--accent); }
.sb-cname { font-family: 'Inter', sans-serif; font-size: 9px; color: var(--t-muted); white-space: nowrap; }
.sb-role { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1px; color: var(--t-dim); background: var(--border); border-radius: 3px; padding: 1px 5px; flex-shrink: 0; }
.sb-kda { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: var(--t-primary); }
.sb-ratio { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; }
.sb-num { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; color: var(--t-dim); text-align: center; }
.sb-gold { color: #F59E0B; }
.sb-col-d { display: flex; flex-direction: column; gap: 3px; padding-right: 8px; }
.sb-dmg { font-family: 'Rajdhani', sans-serif; font-size: 12px; color: var(--t-dim); }
.sb-dmg-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.sb-dmg-fill { height: 100%; border-radius: 2px; transition: width .3s ease; }
.sb-score { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; text-align: right; }

/* Row 2 objectives */
.gv__chart-card--obj { grid-column: 1; }

.obj-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 10px;
}
/* drakes spans both columns on top row */
.obj-card--drakes {
  grid-column: 1 / -1;
}

.obj-card {
  background: linear-gradient(160deg, #0F1219 0%, #0A0D14 100%);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: border-color .15s, box-shadow .15s;
  position: relative;
  overflow: hidden;
}
.obj-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% -20%, color-mix(in srgb,var(--accent) 6%,transparent) 0%, transparent 70%);
  pointer-events: none;
}
.obj-card:hover { border-color: color-mix(in srgb,var(--accent) 35%,transparent); box-shadow: 0 0 16px color-mix(in srgb,var(--accent) 8%,transparent); }

/* Icon wrappers */
.obj-icon-wrap {
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb,var(--accent) 8%,transparent);
  border: 1px solid color-mix(in srgb,var(--accent) 15%,transparent);
  border-radius: 50%;
}
/* Square wrapper for grubs */
.obj-icon-wrap--sq {
  border-radius: 8px;
  overflow: hidden;
  padding: 0;
}
.obj-img-sq {
  width: 44px; height: 44px;
  object-fit: cover;
}
.obj-img {
  width: 30px; height: 30px;
  object-fit: contain;
  filter: drop-shadow(0 0 6px color-mix(in srgb,var(--accent) 50%,transparent));
}
.obj-icon { font-size: 22px; line-height: 1; }

/* Drake individual icons */
.drake-icons-row {
  display: flex; flex-wrap: wrap; gap: 5px; justify-content: center;
  padding: 2px 0;
}
.drake-icons-row--enemy { opacity: .55; }
.drake-chip {
  width: 30px; height: 30px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb,var(--accent) 30%,transparent);
  flex-shrink: 0;
}
.drake-chip--en { border-color: rgba(150,60,60,.4); }
.drake-chip-img {
  width: 100%; height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 4px color-mix(in srgb,var(--accent) 50%,transparent));
}
.drake-chip-img--en { filter: drop-shadow(0 0 3px rgba(200,80,80,.4)) saturate(0.6); }
.obj-label {
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 1.5px; color: #6B7499; text-align: center;
}
.obj-score {
  display: flex; align-items: center; gap: 5px;
  font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 1px;
  margin-top: 2px;
}
.obj-sep { color: var(--border); font-size: 14px; }
.obj-score--win  { color: var(--accent); }
.obj-score--loss { color: var(--t-muted); }
.obj-score--even { color: var(--t-dim); }

.obj-bar {
  width: 100%; height: 3px;
  background: var(--border); border-radius: 2px; overflow: hidden; margin-top: 2px;
}
.obj-bar__my {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  border-radius: 2px;
  transition: width .4s ease;
}

/* Wards table */
.wards-table { display: flex; flex-direction: column; gap: 0; }
.wards-header {
  display: grid; grid-template-columns: 1fr 56px 72px 62px 80px;
  padding: 5px 8px;
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 1.5px; color: var(--t-muted);
  border-bottom: 1px solid var(--border);
}
.wards-row {
  display: grid; grid-template-columns: 1fr 56px 72px 62px 80px;
  align-items: center; padding: 7px 8px;
  border-bottom: 1px solid rgba(26,31,46,.5);
  transition: background .1s;
}
.wards-row:last-child { border-bottom: none; }
.wards-row:hover { background: rgba(255,255,255,.02); }
.wards-row--user { background: color-mix(in srgb,var(--accent) 5%,transparent); }
.wards-row--user:hover { background: color-mix(in srgb,var(--accent) 8%,transparent); }

.w-col-p { display: flex; align-items: center; gap: 7px; min-width: 0; }
.w-col-n { text-align: center; }
.w-champ { width: 26px; height: 26px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.w-name {
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700;
  color: var(--t-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.w-name--user { color: var(--accent); }
.w-val { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; color: var(--t-primary); }
.w-val--ctrl { color: #F59E0B; }
.w-val--vis  { color: var(--accent); }

/* Light mode objectives/wards */
html[data-theme="light"] .obj-card { background: #FAFBFE; border-color: #E0E3EF; }
html[data-theme="light"] .obj-bar  { background: #E0E3EF; }
html[data-theme="light"] .wards-header { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .wards-row { border-bottom-color: #E8EAEF; }
html[data-theme="light"] .wards-row:hover { background: color-mix(in srgb,var(--accent) 3%,transparent); }
html[data-theme="light"] .wards-row--user { background: color-mix(in srgb,var(--accent) 6%,transparent); }
html[data-theme="light"] .w-val { color: #0D1220; }

/* Light mode */
html[data-theme="light"] .gv__back { border-color: #E0E3EF; color: #4A5280; }
html[data-theme="light"] .gv__radar-card { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .gv__team-scores { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .gv__chart-card { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .gv__team-block { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .gv__sb-header { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .gv__sb-row { border-bottom-color: #E8EAEF; }
html[data-theme="light"] .gv__sb-row--user { background: color-mix(in srgb,var(--accent) 6%,transparent); }
html[data-theme="light"] .gv__sb-row:hover { background: color-mix(in srgb,var(--accent) 3%,transparent); }
html[data-theme="light"] .sb-pname { color: #0D1220; }
html[data-theme="light"] .sb-kda { color: #0D1220; }
html[data-theme="light"] .sb-role { background: #E8EAEF; }
html[data-theme="light"] .sb-dmg-bar { background: #E0E3EF; }
html[data-theme="light"] .gv__hero { border-color: color-mix(in srgb,var(--accent) 30%,transparent); box-shadow: 0 0 0 1px color-mix(in srgb,var(--accent) 6%,transparent); }
html[data-theme="light"] .gv__hero-stats { background: color-mix(in srgb,var(--accent) 4%,transparent); border-top-color: color-mix(in srgb,var(--accent) 15%,transparent); }
html[data-theme="light"] .gv__hero-stat-sep { background: color-mix(in srgb,var(--accent) 12%,transparent); }
html[data-theme="light"] .gv__hero-name { -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
html[data-theme="light"] .gv__tscore-bar-wrap { background: #E0E3EF; }
html[data-theme="light"] .gv__bar-track { background: #E0E3EF; }
html[data-theme="light"] .gv__empty { background: #FFFFFF; border-color: #E0E3EF; }

@keyframes pageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
