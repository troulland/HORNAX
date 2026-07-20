<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-vue-next'
import { API_BASE as API } from '@/config'
const auth = useAuthStore()

type Status = 'available' | 'unavailable' | 'uncertain'
const DAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']

/* ── Joueurs réels depuis l'API ───────────────────── */
interface ApiPlayer { id: number; username: string; game_role: string; is_starter: number }
const players = ref<ApiPlayer[]>([])

async function loadRoster() {
  if (!auth.isAuthenticated || !auth.user?.team_id) return
  try {
    const res = await fetch(`${API}/teams/${auth.user.team_id}/roster`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) { const d = await res.json(); players.value = d.players }
  } catch {}
}

/* ── Semaine ──────────────────────────────────────── */
function getWeekStart(offset = 0): Date {
  const now = new Date()
  const dow = now.getDay()
  const diff = (dow === 0 ? -6 : 1 - dow) + offset * 7
  const d = new Date(now)
  d.setDate(now.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const weekOffset = ref(0)
const weekStart  = computed(() => getWeekStart(weekOffset.value))
const weekDates  = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.value)
    d.setDate(d.getDate() + i)
    return d
  })
)

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const todayMidnight = (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()
function isToday(d: Date) { return d.getTime() === todayMidnight.getTime() }
function isPast(d: Date)  { return d < todayMidnight }

const weekLabel = computed(() => {
  const s = weekDates.value[0], e = weekDates.value[6]
  return `${s.getDate()} ${s.toLocaleDateString('fr-FR',{month:'short'})} — ${e.getDate()} ${e.toLocaleDateString('fr-FR',{month:'short',year:'numeric'})}`
})

/* ── Auth / permissions ───────────────────────────── */
function isOwnRow(username: string) {
  return (auth.user?.username ?? '').toLowerCase() === username.toLowerCase()
}

/* ── Grille locale ────────────────────────────────── */
// Clé : ign → dateStr (YYYY-MM-DD) → Status
// (fix du bug : plus d'index jour dans la semaine)
const grid = ref<Record<string, Record<string, Status>>>({})

function getStatus(ign: string, dateStr: string): Status {
  return grid.value[ign]?.[dateStr] ?? 'uncertain'
}

/* ── API ──────────────────────────────────────────── */
const loading = ref(false)

async function loadWeek() {
  if (!auth.isAuthenticated) return
  loading.value = true
  try {
    const ws  = toDateStr(weekDates.value[0])
    const res = await fetch(`${API}/availability?weekStart=${ws}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (!res.ok) return
    const rows: { username: string; date: string; status: Status }[] = await res.json()
    for (const row of rows) {
      if (!grid.value[row.username]) grid.value[row.username] = {}
      grid.value[row.username][row.date] = row.status
    }
  } catch { /* API hors ligne — état local conservé */ }
  finally { loading.value = false }
}

async function saveStatus(dateStr: string, status: Status) {
  if (!auth.isAuthenticated) return
  try {
    await fetch(`${API}/availability`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ date: dateStr, status }),
    })
  } catch { /* silencieux — état local déjà mis à jour */ }
}

/* ── Cycle de statut ──────────────────────────────── */
function cycleStatus(ign: string, dateStr: string, date: Date) {
  if (isPast(date))        return   // jour passé
  if (!isOwnRow(ign))      return   // pas son propre rang
  if (!grid.value[ign]) grid.value[ign] = {}
  const cur  = getStatus(ign, dateStr)
  const next: Status = cur === 'uncertain' ? 'available' : cur === 'available' ? 'unavailable' : 'uncertain'
  grid.value[ign][dateStr] = next
  saveStatus(dateStr, next)
}

/* ── Résumé journalier ────────────────────────────── */
const STATUS: Record<Status, { bg: string; label: string; color: string }> = {
  available:   { bg: 'rgba(16,185,129,.15)',  label: '✓', color: '#10B981' },
  unavailable: { bg: 'rgba(239,68,68,.12)',   label: '✗', color: '#EF4444' },
  uncertain:   { bg: 'rgba(255,255,255,.02)', label: '?', color: '#3D4460' },
}

const ROLE_COLOR: Record<string, string> = {
  top:'#FBBF24', jgl:'#34D399', mid:'#60A5FA', adc:'#F87171', sup:'#C084FC', sub:'#8892B0',
  coach:'#F59E0B', manager:'#F59E0B'
}

const daySummary = computed(() =>
  weekDates.value.map(d => ({
    avail: players.value.filter(p => getStatus(p.username, toDateStr(d)) === 'available').length,
    total: players.value.length,
    past:  isPast(d),
  }))
)

/* ── Chargement à l'init et au changement de semaine ─ */
onMounted(() => { loadRoster(); loadWeek() })
watch(weekOffset, loadWeek)
</script>

<template>
  <div class="avail">
    <!-- nav -->
    <div class="avail__nav">
      <button class="avail__btn" @click="weekOffset--"><ChevronLeft :size="16"/></button>
      <span class="avail__week">{{ weekLabel }}</span>
      <button class="avail__btn" @click="weekOffset++"><ChevronRight :size="16"/></button>
      <button v-if="weekOffset !== 0" class="avail__today" @click="weekOffset=0">Aujourd'hui</button>
      <span v-if="loading" class="avail__loading">…</span>
    </div>

    <!-- info bannière si pas connecté -->
    <div v-if="!auth.isAuthenticated" class="avail__banner">
      Connecte-toi pour enregistrer tes disponibilités.
    </div>

    <div class="grid-wrap">
    <div class="grid" :class="{ 'grid--loading': loading }">
      <!-- header -->
      <div class="grid__row grid__row--head">
        <div class="grid__player-col">JOUEUR</div>
        <div
          v-for="(date, i) in weekDates" :key="i"
          class="grid__day-col"
          :class="{ 'grid__day-col--today': isToday(date), 'grid__day-col--past': isPast(date) }"
        >
          <span class="grid__day-name">{{ DAYS[i] }}</span>
          <span class="grid__day-num">{{ date.getDate() }}</span>
        </div>
      </div>

      <!-- joueurs -->
      <div
        v-for="player in players" :key="player.id"
        class="grid__row"
        :class="{ 'grid__row--own': isOwnRow(player.username) }"
      >
        <div class="grid__player-col">
          <span class="grid__role" :style="{ color: ROLE_COLOR[player.game_role] }">{{ player.game_role.toUpperCase() }}</span>
          <span class="grid__ign">{{ player.username }}</span>
          <span v-if="!player.is_starter" class="grid__sub">SUB</span>
          <Lock v-if="!isOwnRow(player.username) && auth.isAuthenticated" :size="9" class="grid__lock-icon" />
        </div>

        <div
          v-for="(date, dayIdx) in weekDates" :key="dayIdx"
          class="grid__cell"
          :class="{
            'grid__cell--today':    isToday(date),
            'grid__cell--past':     isPast(date),
            'grid__cell--editable': isOwnRow(player.username) && !isPast(date),
            'grid__cell--locked':   !isOwnRow(player.username) && auth.isAuthenticated,
          }"
          :style="(!isPast(date) && getStatus(player.username, toDateStr(date)) !== 'uncertain')
            ? { background: STATUS[getStatus(player.username, toDateStr(date))].bg }
            : isPast(date) ? {} : { background: STATUS.uncertain.bg }"
          @click="cycleStatus(player.username, toDateStr(date), date)"
        >
          <span
            v-if="!isPast(date)"
            class="grid__cell-icon"
            :style="{ color: STATUS[getStatus(player.username, toDateStr(date))].color }"
          >{{ STATUS[getStatus(player.username, toDateStr(date))].label }}</span>
          <span v-else class="grid__cell-lock">—</span>
        </div>
      </div>

      <!-- résumé -->
      <div class="grid__row grid__row--summary">
        <div class="grid__player-col" style="color:#3D4460;font-size:10px;letter-spacing:2px;">DISPO</div>
        <div v-for="(s, i) in daySummary" :key="i" class="grid__summary-cell" :class="{ 'grid__summary-cell--past': s.past }">
          <span v-if="!s.past" :style="{ color: s.avail >= 5 ? '#10B981' : s.avail >= 4 ? 'var(--accent)' : '#EF4444' }">{{ s.avail }}/{{ s.total }}</span>
          <span v-else style="color:#1A1F2E">—</span>
        </div>
      </div>
    </div>
    </div>

    <!-- légende -->
    <div class="legend">
      <span class="legend__item"><span class="legend__dot" style="background:#10B981"/>Disponible</span>
      <span class="legend__item"><span class="legend__dot" style="background:#EF4444"/>Indisponible</span>
      <span class="legend__item"><span class="legend__dot" style="background:#3D4460"/>Non renseigné</span>
      <span class="legend__item legend__item--past">
        <span class="legend__dot legend__dot--past"/>Passé
      </span>
      <span class="legend__hint">
        <Lock :size="10" style="display:inline;vertical-align:middle;margin-right:3px"/>
        Tu ne peux modifier que ta propre ligne
      </span>
    </div>
  </div>
</template>

<style scoped>
.avail { display: flex; flex-direction: column; gap: 16px; }
.avail__nav { display: flex; align-items: center; gap: 10px; }
.avail__btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: #111520; border: 1px solid #1A1F2E; border-radius: 6px; color: #8892B0; cursor: pointer; transition: all .15s; }
.avail__btn:hover { border-color: var(--accent); color: #EEF2FF; }
.avail__week { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 2px; color: #EEF2FF; flex: 1; text-align: center; }
.avail__today { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 2px; color: var(--accent); background: color-mix(in srgb,var(--accent) 8%,transparent); border: 1px solid color-mix(in srgb,var(--accent) 25%,transparent); border-radius: 4px; padding: 5px 12px; cursor: pointer; }
.avail__loading { font-family: 'Rajdhani', sans-serif; font-size: 11px; color: #3D4460; letter-spacing: 2px; animation: pulse 1s infinite; }
@keyframes pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }

.avail__banner { font-family: 'Inter', sans-serif; font-size: 12px; color: var(--accent); background: color-mix(in srgb,var(--accent) 8%,transparent); border: 1px solid color-mix(in srgb,var(--accent) 20%,transparent); border-radius: 6px; padding: 10px 16px; }

.grid-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.grid { background: #111520; border: 1px solid #1A1F2E; border-radius: 8px; overflow: hidden; transition: opacity .2s; min-width: 640px; }
.grid--loading { opacity: .6; pointer-events: none; }

.grid__row { display: grid; grid-template-columns: 160px repeat(7,1fr); border-bottom: 1px solid #1A1F2E; }
.grid__row:last-child { border-bottom: none; }
.grid__row--head, .grid__row--summary { background: #0D1018; }
.grid__row--own { background: color-mix(in srgb,var(--accent) 3%,transparent); }

.grid__player-col { padding: 10px 14px; display: flex; align-items: center; gap: 8px; border-right: 1px solid #1A1F2E; }
.grid__role { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; flex-shrink: 0; }
.grid__ign  { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 1px; color: #EEF2FF; }
.grid__sub  { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; color: #3D4460; background: #1A1F2E; padding: 1px 5px; border-radius: 3px; }
.grid__lock-icon { color: #2A3050; margin-left: auto; flex-shrink: 0; }

.grid__day-col { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 4px; border-right: 1px solid #1A1F2E; gap: 2px; }
.grid__day-col:last-child { border-right: none; }
.grid__day-col--today { background: color-mix(in srgb,var(--accent) 5%,transparent); }
.grid__day-col--past  { opacity: .35; }
.grid__day-name { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #3D4460; }
.grid__day-num  { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; color: #EEF2FF; line-height: 1; }
.grid__day-col--today .grid__day-num { color: var(--accent); }

.grid__cell {
  display: flex; align-items: center; justify-content: center;
  padding: 10px 4px; border-right: 1px solid rgba(255,255,255,.02);
  min-height: 48px; transition: background .1s, opacity .1s;
}
.grid__cell:last-child { border-right: none; }
.grid__cell--editable { cursor: pointer; }
.grid__cell--editable:hover { opacity: .7; }
.grid__cell--locked { cursor: not-allowed; }
.grid__cell--today { outline: 1px solid color-mix(in srgb,var(--accent) 12%,transparent); outline-offset: -1px; }
.grid__cell--past {
  cursor: not-allowed;
  background: repeating-linear-gradient(
    -45deg,
    rgba(255,255,255,.018) 0px, rgba(255,255,255,.018) 1px,
    transparent 1px, transparent 7px
  ) !important;
}
.grid__cell-icon { font-size: 16px; font-weight: 700; font-family: 'Rajdhani', sans-serif; }
.grid__cell-lock { font-size: 13px; color: #1E2436; font-family: 'Rajdhani', sans-serif; font-weight: 700; }

.grid__summary-cell { display: flex; align-items: center; justify-content: center; padding: 8px 4px; border-right: 1px solid rgba(255,255,255,.02); font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; }
.grid__summary-cell:last-child { border-right: none; }
.grid__summary-cell--past { opacity: .35; }

.legend { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.legend__item { display: flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif; font-size: 11px; color: #8892B0; }
.legend__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.legend__dot--past {
  background: repeating-linear-gradient(-45deg, #1E2436 0px, #1E2436 1px, #111520 1px, #111520 4px);
  border: 1px solid #1A1F2E;
}
.legend__hint { font-family: 'Inter', sans-serif; font-size: 11px; color: #3D4460; margin-left: auto; font-style: italic; display: flex; align-items: center; gap: 4px; }

@media (max-width: 768px) {
  .avail__week { font-size: 12px; letter-spacing: 1px; }
  .legend { gap: 10px; }
  .legend__hint { margin-left: 0; width: 100%; }
}
</style>
