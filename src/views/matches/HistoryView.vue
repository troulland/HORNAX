<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useMatchStore, type Match } from '@/stores/matches'
import { useAuthStore } from '@/stores/auth'
import { Trash2, Trophy, Pencil, Upload, X, Layers, CheckSquare } from 'lucide-vue-next'
import { API_BASE as API, STATIC_BASE } from '@/config'

const store  = useMatchStore()
const auth   = useAuthStore()
const filter = ref<'all' | 'scrim' | 'tournament' | 'official'>('all')
const deleting = ref<number | null>(null)
const saving   = ref(false)
const expanded = ref<Set<number>>(new Set())
function toggleExpand(id: number) {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  expanded.value = s
}

onMounted(() => store.fetchHistory())

const filtered = computed(() =>
  filter.value === 'all'
    ? store.history
    : store.history.filter(m => m.type === filter.value)
)

const TYPE_LABEL: Record<string, string> = { scrim: 'SCRIM', tournament: 'TOURNOI', official: 'OFFICIEL' }
const TYPE_COLOR: Record<string, string> = { scrim: '#8892B0', tournament: '#C084FC', official: 'var(--accent)' }
const TYPE_OPTS = [
  { key: 'scrim',      label: 'SCRIM',    color: '#8892B0' },
  { key: 'tournament', label: 'TOURNOI',  color: '#C084FC' },
  { key: 'official',   label: 'OFFICIEL', color: 'var(--accent)' },
] as const

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function logoSrc(m: Match) {
  if (!m.opponent_logo) return null
  return m.opponent_logo.startsWith('/logos/') ? `${STATIC_BASE}${m.opponent_logo}` : m.opponent_logo
}

/* ── Riot game helpers ───────────────────────────── */
const DD_VER = '15.6.1'
const SUMMONER_KEY: Record<number, string> = {
  1: 'SummonerBoost', 3: 'SummonerExhaust', 4: 'SummonerFlash',
  6: 'SummonerHaste', 7: 'SummonerHeal', 11: 'SummonerSmite',
  12: 'SummonerTeleport', 13: 'SummonerMana', 14: 'SummonerIgnite',
  21: 'SummonerBarrier', 32: 'SummonerSnowball',
}
const RUNE_PATH: Record<number, string> = {
  8005: 'precision/presstheattack/presstheattack',
  8008: 'precision/lethaltempo/lethaltempoTemp',
  8021: 'precision/fleetfootwork/fleetfootwork',
  8010: 'precision/conqueror/conqueror',
  8112: 'domination/electrocute/electrocute',
  8124: 'domination/predator/predator',
  8128: 'domination/darkharvest/darkharvest',
  9923: 'domination/hailofblades/hailofblades',
  8214: 'sorcery/summonaery/summonaery',
  8229: 'sorcery/arcanecomet/arcanecomet',
  8230: 'sorcery/phaserush/phaserush',
  8437: 'resolve/graspoftheundying/graspoftheundying',
  8439: 'resolve/veteranaftershock/aftershock',
  8465: 'resolve/guardian/guardian',
  8351: 'inspiration/glacialaugment/glacialaugment',
  8360: 'inspiration/unsealedspellbook/unsealedspellbook',
  8369: 'inspiration/firststrike/firststrike',
}
function itemIcon(id: number) {
  if (!id) return ''
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VER}/img/item/${id}.png`
}
function spellIcon(id: number) {
  const name = SUMMONER_KEY[id]; if (!name) return ''
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VER}/img/spell/${name}.png`
}
function runeIcon(id: number) {
  const path = RUNE_PATH[id]; if (!path) return ''
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/${path}.png`
}
function fmtDur(sec: number | undefined, minOnly: number) {
  if (sec) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`
  return `${minOnly}m`
}
function pKillColor(v: number) { return v >= 70 ? '#10B981' : v >= 50 ? '#F0B429' : '#8892B0' }
function dmgColor(v: number) { return v >= 30 ? '#F87171' : v >= 20 ? '#F0B429' : '#8892B0' }
function teamPKill(m: any) {
  const rd = getRiotData(m); const p = getPersonalParticipant(m)
  if (!rd?.participants || !p) return null
  const myId = p.teamId ?? 100
  const teamKills = rd.participants.filter((x: any) => x.teamId === myId).reduce((s: number, x: any) => s + x.kills, 0)
  return Math.round((p.kills + p.assists) / Math.max(teamKills, 1) * 100)
}
function teamDmgShare(m: any) {
  const rd = getRiotData(m); const p = getPersonalParticipant(m)
  if (!rd?.participants || !p) return null
  const myId = p.teamId ?? 100
  const teamDmg = rd.participants.filter((x: any) => x.teamId === myId).reduce((s: number, x: any) => s + (x.damage ?? 0), 0)
  return Math.round((p.damage ?? 0) / Math.max(teamDmg, 1) * 100)
}
function fmtDateAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 3600000)
  if (diff < 1) return "Récemment"
  if (diff < 24) return `il y a ${diff}h`
  const days = Math.floor(diff / 24)
  return `il y a ${days}j`
}
const CHAMP_SPECIAL: Record<string, string> = {
  "Nunu & Willump": "Nunu", "Renata Glasc": "Renata",
  "K'Sante": "KSante", "Bel'Veth": "Belveth", "Wukong": "MonkeyKing",
}
function champIcon(name: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VER}/img/champion/${CHAMP_SPECIAL[name] ?? name}.png`
}

interface RiotParticipantBasic {
  champion: string; kills: number; deaths: number; assists: number
  damage: number; cs: number; vision: number; win: boolean; isUser: boolean
  teamId?: number; role?: string; champLevel?: number
  items?: number[]; trinket?: number; summoner1Id?: number; summoner2Id?: number; primaryRune?: number
}
interface RiotData {
  matchId: string; duration: number; durationSec?: number; queueLabel: string
  participants: RiotParticipantBasic[]
}
function getRiotData(m: Match): RiotData | null {
  if (!m.riot_data) return null
  try { return JSON.parse(m.riot_data) } catch { return null }
}
function getPersonalParticipant(m: Match): RiotParticipantBasic | null {
  return getRiotData(m)?.participants?.find(p => p.isUser) ?? null
}
function fmtKda(p: RiotParticipantBasic) {
  return p.deaths === 0 ? 'Perfect' : ((p.kills + p.assists) / p.deaths).toFixed(2)
}
function kdaColorHist(kda: string) {
  const n = parseFloat(kda)
  return n >= 4 ? '#10B981' : n >= 2.5 ? 'var(--accent)' : n >= 1.5 ? '#EEF2FF' : '#EF4444'
}
function getTeams(m: Match) {
  const rd = getRiotData(m)
  if (!rd?.participants) return { myTeam: [], enemyTeam: [] }
  const me = rd.participants.find(p => p.isUser)
  const myTeamId = me?.teamId ?? 100
  return {
    myTeam:    rd.participants.filter(p => p.teamId === myTeamId).map(p => p.champion),
    enemyTeam: rd.participants.filter(p => p.teamId !== myTeamId).map(p => p.champion),
  }
}
const ROLE_ABBR: Record<string, string> = { TOP: 'TOP', JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' }

const QUEUE_MAP: Record<string, string> = {
  'Ranked Solo/Duo': 'RANKED', 'Ranked Flex': 'RANKED FLEX',
  'Normal': 'NORMAL', 'Normal Draft': 'NORMAL',
  'Custom': 'PERSO', 'Custom Game': 'PERSO',
  'ARAM': 'ARAM',
}
function queueLabel(m: Match): string {
  if (!m.riot_data) return m.type.toUpperCase()
  try {
    const ql: string = JSON.parse(m.riot_data).queueLabel ?? ''
    return (QUEUE_MAP[ql] ?? ql.toUpperCase().slice(0, 12)) || m.type.toUpperCase()
  } catch { return m.type.toUpperCase() }
}

/* ── Selection ───────────────────────────────────── */
const selectedIds = ref<number[]>([])

watch(filter, () => { selectedIds.value = [] })

const isSelected  = (id: number) => selectedIds.value.includes(id)
const allSelected = computed(() => filtered.value.length > 0 && selectedIds.value.length === filtered.value.length)
const someSelected = computed(() => selectedIds.value.length > 0 && selectedIds.value.length < filtered.value.length)

function toggleSelect(id: number) {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}
function toggleAll() {
  if (allSelected.value) selectedIds.value = []
  else selectedIds.value = filtered.value.map(m => m.id)
}
function clearSelection() { selectedIds.value = [] }

/* ── Groupe modal ────────────────────────────────── */
const groupModalOpen  = ref(false)
const grouping        = ref(false)
const groupForm       = ref({ opponent: '', seriesId: '', context: 'team' as 'team' | 'perso' })
const groupLogoFile    = ref<File | null>(null)
const groupLogoPreview = ref<string | null>(null)

const selectedCount   = computed(() => selectedIds.value.length)
const isBo = computed(() => selectedCount.value >= 3 && selectedCount.value <= 5)

const groupValidationMsg = computed(() => {
  const n = selectedCount.value
  if (n === 0) return ''
  if (n === 1 || n === 2) return `${n} partie${n > 1 ? 's' : ''} — envoyées comme games individuelles`
  if (n <= 5) return `BO${n} — ${n} parties groupées en série`
  return `${n} parties — trop pour un BO, envoyées comme games individuelles`
})

function onGroupLogoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  groupLogoFile.value = file
  groupLogoPreview.value = URL.createObjectURL(file)
}
function clearGroupLogo() { groupLogoFile.value = null; groupLogoPreview.value = null }

async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('logo', file)
  try {
    const res = await fetch(`${API}/matches/upload-logo`, {
      method: 'POST', headers: { Authorization: `Bearer ${auth.token}` }, body: fd,
    })
    return res.ok ? (await res.json()).url as string : null
  } catch { return null }
}

function openGroupModal() {
  const matches = store.history.filter(m => selectedIds.value.includes(m.id))
  const opponents = [...new Set(matches.map(m => m.opponent))]
  groupForm.value.opponent = opponents.length === 1 ? opponents[0] : ''
  groupForm.value.seriesId = ''
  groupForm.value.context  = 'team'
  groupLogoFile.value    = null
  groupLogoPreview.value = null
  groupModalOpen.value = true
}
function closeGroupModal() { groupModalOpen.value = false; groupLogoFile.value = null; groupLogoPreview.value = null }

async function submitGroup() {
  if (!groupForm.value.opponent.trim()) return
  grouping.value = true
  const logoUrl = groupLogoFile.value ? await uploadFile(groupLogoFile.value) : null
  const n = selectedIds.value.length
  const isBoFlag = n >= 3 && n <= 5
  const seriesId = isBoFlag
    ? (groupForm.value.seriesId.trim() || `bo${n}-${groupForm.value.opponent.trim().toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`)
    : null
  await store.groupMatches(selectedIds.value, {
    series_id:     seriesId,
    opponent:      groupForm.value.opponent.trim(),
    opponent_logo: logoUrl,
    context:       groupForm.value.context,
  })
  grouping.value = false
  closeGroupModal()
  clearSelection()
}

/* ── Suppression ─────────────────────────────────── */
async function remove(m: Match) {
  if (!confirm(`Supprimer la partie contre ${m.opponent} ?`)) return
  deleting.value = m.id
  await store.deleteMatch(m.id)
  deleting.value = null
}

async function deleteSelected() {
  const n = selectedIds.value.length
  if (!confirm(`Supprimer ${n} partie${n > 1 ? 's' : ''} ? Cette action est irréversible.`)) return
  for (const id of [...selectedIds.value]) {
    await store.deleteMatch(id)
  }
  clearSelection()
}

/* ── Modale d'édition ────────────────────────────── */
const modalOpen   = ref(false)
const editId      = ref<number | null>(null)
const logoFile    = ref<File | null>(null)
const logoPreview = ref<string | null>(null)
const uploading   = ref(false)
const form        = ref({
  opponent:  '',
  date:      '',
  time:      '',
  type:      'scrim' as 'scrim' | 'tournament' | 'official',
  result:    'win' as 'win' | 'loss',
  series_id: '',
  notes:     '',
  opponent_logo: null as string | null,
})

function openEdit(m: Match) {
  editId.value = m.id
  logoFile.value    = null
  logoPreview.value = logoSrc(m)
  form.value = {
    opponent:     m.opponent,
    date:         m.date,
    time:         m.time ?? '',
    type:         m.type,
    result:       m.result ?? 'win',
    series_id:    m.series_id ?? '',
    notes:        m.notes ?? '',
    opponent_logo: m.opponent_logo,
  }
  modalOpen.value = true
}

function closeModal() { modalOpen.value = false; editId.value = null }

function onLogoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  logoFile.value = file
  logoPreview.value = URL.createObjectURL(file)
}

function clearLogo() {
  logoFile.value    = null
  logoPreview.value = null
  form.value.opponent_logo = null
}

async function uploadLogoFile(): Promise<string | null> {
  if (!logoFile.value) return form.value.opponent_logo
  uploading.value = true
  const fd = new FormData()
  fd.append('logo', logoFile.value)
  try {
    const res = await fetch(`${API}/matches/upload-logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: fd,
    })
    if (!res.ok) return form.value.opponent_logo
    const data = await res.json()
    return data.url as string
  } finally {
    uploading.value = false
  }
}

async function saveEdit() {
  if (!form.value.opponent.trim() || !form.value.date) return
  saving.value = true
  const logoUrl = await uploadLogoFile()
  await store.updateMatch(editId.value!, {
    opponent:     form.value.opponent.trim(),
    date:         form.value.date,
    time:         form.value.time || null,
    type:         form.value.type,
    result:       form.value.result,
    series_id:    form.value.series_id.trim() || null,
    notes:        form.value.notes.trim() || null,
    opponent_logo: logoUrl,
  })
  saving.value = false
  closeModal()
}
</script>

<template>
  <div class="hist">
    <!-- Filtres + action bar -->
    <div class="hist__top">
      <div class="hist__filters">
        <button
          v-for="f in ['all','scrim','tournament','official']" :key="f"
          class="hist__filter"
          :class="{ 'hist__filter--active': filter === f }"
          @click="filter = (f as typeof filter)"
        >{{ f === 'all' ? 'TOUS' : TYPE_LABEL[f] }}</button>
      </div>

      <!-- Selection action bar -->
      <Transition name="actbar">
        <div v-if="selectedIds.length > 0" class="hist__actbar">
          <span class="hist__actbar-count">
            <CheckSquare :size="13" />
            {{ selectedIds.length }} sélectionné{{ selectedIds.length > 1 ? 's' : '' }}
          </span>
          <span class="hist__actbar-hint">{{ groupValidationMsg }}</span>
          <div class="hist__actbar-btns">
            <button class="hist__actbar-clear" @click="clearSelection">Désélectionner</button>
            <button class="hist__actbar-group" @click="openGroupModal">
              <Layers :size="13" />
              {{ isBo ? 'Former un BO' : 'Grouper / Envoyer' }}
            </button>
            <button class="hist__actbar-delete" @click="deleteSelected">
              <Trash2 :size="13" />
              SUPPRIMER ({{ selectedIds.length }})
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Empty -->
    <div v-if="store.loading" class="hist__empty">Chargement…</div>
    <div v-else-if="filtered.length === 0" class="hist__empty">
      <Trophy :size="32" class="hist__empty-icon" />
      <span>Aucun résultat encore enregistré.</span>
      <span style="font-size:11px;color:#3D4460;letter-spacing:1px">Importe tes parties depuis l'onglet Import Riot</span>
    </div>

    <!-- Table -->
    <div v-else class="hist__table">
      <div class="hist__head">
        <span class="hist__cb-col">
          <button class="hist__cb hist__cb--all"
            :class="{ 'hist__cb--checked': allSelected, 'hist__cb--partial': someSelected }"
            @click="toggleAll"
            title="Tout sélectionner"
          />
        </span>
        <span>RÉS.</span>
        <span>DATE</span>
        <span>ADVERSAIRE</span>
        <span>SÉRIE</span>
        <span>TYPE</span>
        <span></span>
      </div>
      <template v-for="m in filtered" :key="m.id">
        <!-- ── Game card OP.GG style ── -->
<div
  v-if="getPersonalParticipant(m)"
  class="og-card"
  :class="[getPersonalParticipant(m)!.win ? 'og-card--win' : 'og-card--loss', { 'og-card--selected': isSelected(m.id) }]"
>
  <div class="og-card__main">
    <!-- Checkbox -->
    <div class="og-card__cb">
      <button class="hist__cb" :class="{ 'hist__cb--checked': isSelected(m.id) }" @click.stop="toggleSelect(m.id)" />
    </div>

    <!-- 1. Info zone -->
    <div class="og-card__info">
      <div class="og-card__info-top">
        <span class="og-card__queue">{{ queueLabel(m) }}</span>
        <span class="og-card__date">{{ fmtDateAgo(m.date) }}</span>
      </div>
      <div class="og-card__info-bot">
        <span class="og-card__vd" :class="getPersonalParticipant(m)!.win ? 'og-card__vd--win' : 'og-card__vd--loss'">
          {{ getPersonalParticipant(m)!.win ? 'Victoire' : 'Défaite' }}
        </span>
        <span class="og-card__dur">{{ fmtDur(getRiotData(m)?.durationSec, getRiotData(m)?.duration ?? 0) }}</span>
      </div>
    </div>

    <!-- 2. Champion zone -->
    <div class="og-card__champ-zone">
      <div class="og-card__champ-top">
        <div class="og-card__portrait-wrap">
          <img :src="champIcon(getPersonalParticipant(m)!.champion)"
            :alt="getPersonalParticipant(m)!.champion" class="og-card__portrait"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
          <span v-if="getPersonalParticipant(m)!.champLevel" class="og-card__level">{{ getPersonalParticipant(m)!.champLevel }}</span>
        </div>
        <div class="og-card__spells-col">
          <img v-if="spellIcon(getPersonalParticipant(m)!.summoner1Id ?? 0)" class="og-card__spell"
            :src="spellIcon(getPersonalParticipant(m)!.summoner1Id ?? 0)"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
          <div v-else class="og-card__spell og-card__slot-empty" />
          <img v-if="spellIcon(getPersonalParticipant(m)!.summoner2Id ?? 0)" class="og-card__spell"
            :src="spellIcon(getPersonalParticipant(m)!.summoner2Id ?? 0)"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
          <div v-else class="og-card__spell og-card__slot-empty" />
          <img v-if="runeIcon(getPersonalParticipant(m)!.primaryRune ?? 0)" class="og-card__rune"
            :src="runeIcon(getPersonalParticipant(m)!.primaryRune ?? 0)"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
          <div v-else class="og-card__rune og-card__slot-empty og-card__slot-empty--round" />
        </div>
      </div>
      <div class="og-card__items-row">
        <div v-for="(itemId, i) in (getPersonalParticipant(m)!.items ?? [0,0,0,0,0,0])" :key="i" class="og-card__item-slot">
          <img v-if="itemId" class="og-card__item" :src="itemIcon(itemId)"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
        </div>
        <div class="og-card__item-slot og-card__item-slot--trinket">
          <img v-if="getPersonalParticipant(m)!.trinket" class="og-card__item"
            :src="itemIcon(getPersonalParticipant(m)!.trinket ?? 0)"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
        </div>
      </div>
    </div>

    <!-- 3. KDA zone -->
    <div class="og-card__kda">
      <span class="og-card__score">
        {{ getPersonalParticipant(m)!.kills }}<span class="og-card__sep"> / </span><span class="og-card__deaths">{{ getPersonalParticipant(m)!.deaths }}</span><span class="og-card__sep"> / </span>{{ getPersonalParticipant(m)!.assists }}
      </span>
      <span class="og-card__ratio" :style="{ color: kdaColorHist(fmtKda(getPersonalParticipant(m)!)) }">
        {{ fmtKda(getPersonalParticipant(m)!) }} KDA
      </span>
    </div>

    <!-- 4. Stats zone -->
    <div class="og-card__stats">
      <div v-if="teamPKill(m) !== null" class="og-card__stat-row">
        <span class="og-card__stat-label">P/Kill</span>
        <span class="og-card__stat-val" :style="{ color: pKillColor(teamPKill(m)!) }">{{ teamPKill(m) }}%</span>
      </div>
      <div class="og-card__stat-row">
        <span class="og-card__stat-label">CS</span>
        <span class="og-card__stat-val">{{ getPersonalParticipant(m)!.cs }}<span class="og-card__stat-sub"> ({{ getRiotData(m)?.duration ? (getPersonalParticipant(m)!.cs / Math.max(getRiotData(m)!.duration, 1)).toFixed(1) : '?' }}/m)</span></span>
      </div>
      <div class="og-card__stat-row">
        <span class="og-card__stat-label">Dégâts</span>
        <span class="og-card__stat-val">{{ (getPersonalParticipant(m)!.damage / 1000).toFixed(1) }}k<span v-if="teamDmgShare(m) !== null" class="og-card__stat-sub" :style="{ color: dmgColor(teamDmgShare(m)!) }"> ({{ teamDmgShare(m) }}%)</span></span>
      </div>
    </div>

    <!-- 5. Team comp: two vertical columns -->
    <div class="og-card__teams">
      <div class="og-card__team-side">
        <span class="og-card__team-label og-card__team-label--ally">ALLIÉS</span>
        <div class="og-card__team-col">
          <img v-for="c in getTeams(m).myTeam" :key="c" :src="champIcon(c)" :alt="c"
            class="og-card__team-icon" :class="{ 'og-card__team-icon--me': c === getPersonalParticipant(m)!.champion }"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
        </div>
      </div>
      <div class="og-card__team-vs">VS</div>
      <div class="og-card__team-side">
        <span class="og-card__team-label og-card__team-label--enemy">ENNEMIS</span>
        <div class="og-card__team-col">
          <img v-for="c in getTeams(m).enemyTeam" :key="c" :src="champIcon(c)" :alt="c"
            class="og-card__team-icon"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
        </div>
      </div>
    </div>

    <!-- 6. Actions -->
    <div class="og-card__actions">
      <button v-if="getRiotData(m)?.participants?.length"
        class="og-card__expand-btn" :class="{ 'og-card__expand-btn--open': expanded.has(m.id) }"
        @click.stop="toggleExpand(m.id)" title="Détails">
        <span class="og-card__expand-arrow">▼</span>
      </button>
      <button class="hist__action-btn hist__action-btn--del" :disabled="deleting === m.id" @click="remove(m)" title="Supprimer"><Trash2 :size="12" /></button>
    </div>
  </div>

  <!-- Scoreboard (expanded) -->
  <div v-if="expanded.has(m.id)" class="og-card__scoreboard">
    <div class="og-card__sb-grid">
      <div class="og-card__sb-col">
        <div v-for="p in getRiotData(m)!.participants.filter(x => (x.teamId ?? 100) === 100)"
          :key="p.champion" class="og-card__sb-row"
          :class="{ 'og-card__sb-row--me': p.isUser, 'og-card__sb-row--win': p.win }">
          <img :src="champIcon(p.champion)" :alt="p.champion" class="og-card__sb-icon"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
          <span class="og-card__sb-kda">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
          <span class="og-card__sb-cs">{{ p.cs }} cs</span>
          <span class="og-card__sb-dmg">{{ (p.damage / 1000).toFixed(1) }}k</span>
        </div>
      </div>
      <div class="og-card__sb-divider" />
      <div class="og-card__sb-col">
        <div v-for="p in getRiotData(m)!.participants.filter(x => (x.teamId ?? 200) === 200)"
          :key="p.champion" class="og-card__sb-row"
          :class="{ 'og-card__sb-row--win': p.win }">
          <img :src="champIcon(p.champion)" :alt="p.champion" class="og-card__sb-icon"
            @error="($event.target as HTMLImageElement).src='/logo.png'" />
          <span class="og-card__sb-kda">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
          <span class="og-card__sb-cs">{{ p.cs }} cs</span>
          <span class="og-card__sb-dmg">{{ (p.damage / 1000).toFixed(1) }}k</span>
        </div>
      </div>
    </div>
  </div>
</div>

        <!-- ── Regular row ── -->
        <div
          v-else
          class="hist__row"
          :class="{ 'hist__row--selected': isSelected(m.id) }"
        >
          <span class="hist__cb-col">
            <button class="hist__cb" :class="{ 'hist__cb--checked': isSelected(m.id) }" @click.stop="toggleSelect(m.id)" />
          </span>
          <span class="hist__badge" :class="m.result === 'win' ? 'hist__badge--win' : 'hist__badge--loss'">
            {{ m.result === 'win' ? 'V' : 'D' }}
          </span>
          <span class="hist__date">{{ fmtDate(m.date) }}</span>
          <span class="hist__opp">
            <img v-if="logoSrc(m)" :src="logoSrc(m)!" :alt="m.opponent" class="hist__opp-logo" />
            <span class="hist__opp-letter" v-else>{{ m.opponent.charAt(0).toUpperCase() }}</span>
            {{ m.opponent }}
          </span>
          <span class="hist__series" :title="m.series_id ?? ''">{{ m.series_id ?? '—' }}</span>
          <span class="hist__type" :style="{ color: TYPE_COLOR[m.type], borderColor: TYPE_COLOR[m.type] + '44', background: TYPE_COLOR[m.type] + '14' }">
            {{ TYPE_LABEL[m.type] }}
          </span>
          <span class="hist__actions">
            <button class="hist__action-btn hist__action-btn--del" :disabled="deleting === m.id" @click="remove(m)" title="Supprimer"><Trash2 :size="12" /></button>
          </span>
        </div>
      </template>
    </div>

    <!-- ══ Modale groupement ══ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="groupModalOpen" class="modal-backdrop" @click.self="closeGroupModal">
          <div class="modal">
            <div class="modal__head">
              <div>
                <span class="modal__title">{{ isBo ? `FORMER UN BO${selectedCount}` : 'GROUPER LES PARTIES' }}</span>
                <p class="modal__subtitle">{{ groupValidationMsg }}</p>
              </div>
              <button class="modal__close" @click="closeGroupModal">✕</button>
            </div>
            <div class="modal__body">

              <!-- Adversaire + Logo + Série : BO seulement (3–5 games) -->
              <template v-if="isBo">
                <div class="modal__field">
                  <label class="hx-label">Adversaire *</label>
                  <input v-model="groupForm.opponent" class="hx-input" placeholder="Nom de l'équipe" />
                </div>

                <div class="modal__field">
                  <label class="hx-label">Logo adversaire <span class="modal__field-hint">(optionnel)</span></label>
                  <div class="logo-upload">
                    <div class="logo-upload__preview">
                      <img v-if="groupLogoPreview" :src="groupLogoPreview" class="logo-upload__img" />
                      <span v-else class="logo-upload__placeholder">{{ groupForm.opponent.charAt(0).toUpperCase() || '?' }}</span>
                      <button v-if="groupLogoPreview" class="logo-upload__clear" @click="clearGroupLogo"><X :size="10"/></button>
                    </div>
                    <label class="logo-upload__btn">
                      <Upload :size="13" />
                      {{ groupLogoPreview ? 'Changer' : 'Uploader un logo' }}
                      <input type="file" accept="image/*" class="logo-upload__input" @change="onGroupLogoChange" />
                    </label>
                  </div>
                </div>

                <div class="modal__field">
                  <label class="hx-label">Nom de la série <span class="modal__field-hint">(optionnel — auto-généré si vide)</span></label>
                  <input v-model="groupForm.seriesId" class="hx-input"
                    :placeholder="`bo${selectedCount}-${groupForm.opponent.trim().toLowerCase().replace(/\s+/g,'_') || 'adversaire'}-${new Date().toISOString().split('T')[0]}`" />
                </div>
              </template>

              <!-- Destination -->
              <div class="modal__field">
                <label class="hx-label">Destination Analytics</label>
                <div class="modal__dest-row">
                  <button
                    type="button"
                    class="modal__dest-btn"
                    :class="{ 'modal__dest-btn--active': groupForm.context === 'team' }"
                    @click="groupForm.context = 'team'"
                  >
                    <span class="modal__dest-icon">⚔</span>
                    <span class="modal__dest-label">ÉQUIPE</span>
                    <span class="modal__dest-desc">Visible dans l'onglet Équipe</span>
                  </button>
                  <button
                    type="button"
                    class="modal__dest-btn"
                    :class="{ 'modal__dest-btn--active': groupForm.context === 'perso' }"
                    @click="groupForm.context = 'perso'"
                  >
                    <span class="modal__dest-icon">👤</span>
                    <span class="modal__dest-label">PERSO</span>
                    <span class="modal__dest-desc">Visible dans ton onglet Perso</span>
                  </button>
                </div>
              </div>

            </div>
            <div class="modal__footer">
              <button class="modal__btn modal__btn--cancel" @click="closeGroupModal">ANNULER</button>
              <button
                class="modal__btn modal__btn--save"
                :disabled="grouping || (isBo && !groupForm.opponent.trim())"
                @click="submitGroup"
              >
                <span v-if="!grouping">{{ isBo ? 'FORMER LE BO' : 'ENVOYER' }}</span>
                <span v-else class="modal__spinner" />
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modale édition -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
          <div class="modal">
            <div class="modal__head">
              <span class="modal__title">MODIFIER LE MATCH</span>
              <button class="modal__close" @click="closeModal">✕</button>
            </div>

            <div class="modal__body">
              <!-- Logo adversaire -->
              <div class="modal__field">
                <label class="hx-label">Logo adversaire</label>
                <div class="logo-upload">
                  <div class="logo-upload__preview">
                    <img v-if="logoPreview" :src="logoPreview" class="logo-upload__img" />
                    <span v-else class="logo-upload__placeholder">{{ form.opponent.charAt(0).toUpperCase() || '?' }}</span>
                    <button v-if="logoPreview" class="logo-upload__clear" @click="clearLogo"><X :size="10"/></button>
                  </div>
                  <label class="logo-upload__btn">
                    <Upload :size="13" />
                    {{ logoPreview ? 'Changer' : 'Uploader un logo' }}
                    <input type="file" accept="image/*" class="logo-upload__input" @change="onLogoChange" />
                  </label>
                </div>
              </div>

              <!-- Adversaire -->
              <div class="modal__field">
                <label class="hx-label">Adversaire</label>
                <input v-model="form.opponent" class="hx-input" placeholder="Nom de l'équipe" />
              </div>

              <!-- Date + Heure -->
              <div class="modal__row2">
                <div class="modal__field">
                  <label class="hx-label">Date</label>
                  <input v-model="form.date" class="hx-input" type="date" />
                </div>
                <div class="modal__field">
                  <label class="hx-label">Heure</label>
                  <input v-model="form.time" class="hx-input" type="time" />
                </div>
              </div>

              <!-- Type -->
              <div class="modal__field">
                <label class="hx-label">Type</label>
                <div class="modal__btns">
                  <button
                    v-for="opt in TYPE_OPTS" :key="opt.key"
                    class="modal__opt-btn"
                    :style="form.type === opt.key ? { borderColor: opt.color, color: opt.color, background: opt.color + '18' } : {}"
                    @click="form.type = opt.key"
                  >{{ opt.label }}</button>
                </div>
              </div>

              <!-- Résultat -->
              <div class="modal__field">
                <label class="hx-label">Résultat</label>
                <div class="modal__btns">
                  <button class="modal__opt-btn" :style="form.result === 'win' ? { borderColor:'#10B981',color:'#10B981',background:'rgba(16,185,129,.1)' } : {}" @click="form.result='win'">VICTOIRE</button>
                  <button class="modal__opt-btn" :style="form.result === 'loss' ? { borderColor:'#EF4444',color:'#EF4444',background:'rgba(239,68,68,.1)' } : {}" @click="form.result='loss'">DÉFAITE</button>
                </div>
              </div>

              <!-- Tag série -->
              <div class="modal__field">
                <label class="hx-label">Tag série / BO <span class="modal__field-hint">(optionnel — ex: bo3-devils-mars)</span></label>
                <input v-model="form.series_id" class="hx-input" placeholder="bo3-devils-mars" />
              </div>

              <!-- Notes -->
              <div class="modal__field">
                <label class="hx-label">Notes</label>
                <textarea v-model="form.notes" class="hx-input modal__textarea" placeholder="Observations, VOD, …" />
              </div>
            </div>

            <div class="modal__footer">
              <button class="modal__btn modal__btn--cancel" @click="closeModal">ANNULER</button>
              <button class="modal__btn modal__btn--save" :disabled="saving || uploading" @click="saveEdit">
                <span v-if="!saving && !uploading">ENREGISTRER</span>
                <span v-else class="modal__spinner" />
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.hist { display: flex; flex-direction: column; gap: 16px; }

.hist__top { display: flex; flex-direction: column; gap: 10px; }
.hist__filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hist__filter {
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px;
  background: #111520; border: 1px solid #1A1F2E; border-radius: 4px;
  color: #3D4460; padding: 5px 14px; cursor: pointer; transition: all .15s;
}
.hist__filter:hover { border-color: #2A2F40; color: #8892B0; }
.hist__filter--active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb,var(--accent) 8%,transparent); }

/* Action bar */
.hist__actbar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  background: color-mix(in srgb, var(--accent) 8%, #111520);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: 8px; padding: 10px 16px;
}
.hist__actbar-count {
  display: flex; align-items: center; gap: 6px;
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1px;
  color: var(--accent); flex-shrink: 0;
}
.hist__actbar-hint {
  font-family: 'Inter', sans-serif; font-size: 11px; color: #8892B0; flex: 1; min-width: 0;
}
.hist__actbar-btns { display: flex; gap: 8px; margin-left: auto; flex-shrink: 0; }
.hist__actbar-clear {
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px;
  background: transparent; border: 1px solid #2A2F40; border-radius: 5px;
  color: #3D4460; padding: 6px 12px; cursor: pointer; transition: all .15s;
}
.hist__actbar-clear:hover { border-color: #8892B0; color: #8892B0; }
.hist__actbar-group {
  display: flex; align-items: center; gap: 6px;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
  background: var(--accent); border: 1px solid var(--accent); border-radius: 5px;
  color: white; padding: 6px 16px; cursor: pointer; transition: all .15s;
}
.hist__actbar-group:hover { background: var(--accent-2); box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 30%, transparent); }
.hist__actbar-delete {
  display: flex; align-items: center; gap: 6px;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); border-radius: 5px;
  color: #EF4444; padding: 6px 16px; cursor: pointer; transition: all .15s;
}
.hist__actbar-delete:hover { background: rgba(239,68,68,.2); border-color: #EF4444; }

/* Checkbox */
.hist__cb-col { display: flex; align-items: center; justify-content: center; }
.hist__cb {
  width: 16px; height: 16px; border-radius: 3px;
  border: 1.5px solid #2A2F40; background: transparent;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .12s; flex-shrink: 0; padding: 0;
}
.hist__cb:hover { border-color: var(--accent); }
.hist__cb--checked {
  background: var(--accent); border-color: var(--accent);
}
.hist__cb--checked::after {
  content: ''; display: block;
  width: 5px; height: 8px;
  border: 2px solid white; border-top: none; border-left: none;
  transform: rotate(45deg) translate(-1px, -1px);
}
.hist__cb--partial {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
  border-color: var(--accent);
}
.hist__cb--partial::after {
  content: ''; display: block;
  width: 8px; height: 2px; background: var(--accent); border-radius: 1px;
}

.hist__empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 60px 20px; background: #111520; border: 1px solid #1A1F2E;
  border-radius: 10px; font-family: 'Rajdhani', sans-serif; font-size: 14px;
  font-weight: 600; letter-spacing: 2px; color: #3D4460;
}
.hist__empty-icon { color: #1A1F2E; }

.hist__table { background: #111520; border: 1px solid #1A1F2E; border-radius: 10px; overflow: hidden; }
.hist__head {
  display: grid; grid-template-columns: 36px 52px 110px 1fr 130px 100px 72px;
  padding: 10px 20px; border-bottom: 1px solid #1A1F2E; gap: 0 8px;
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #3D4460;
}
.hist__row {
  display: grid; grid-template-columns: 36px 52px 110px 1fr 130px 100px 72px;
  padding: 12px 20px; border-bottom: 1px solid #1A1F2E; align-items: center;
  gap: 0 8px; transition: background .12s; min-height: 56px;
}
.hist__row:last-child { border-bottom: none; }
.hist__row:hover { background: rgba(255,255,255,.03); }
.hist__row--selected { background: color-mix(in srgb, var(--accent) 5%, transparent) !important; }

.hist__badge {
  width: 28px; height: 28px; border-radius: 5px; display: flex; align-items: center;
  justify-content: center; font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700;
}
.hist__badge--win  { background: rgba(16,185,129,.15); color: #10B981; border: 1px solid rgba(16,185,129,.3); }
.hist__badge--loss { background: rgba(239,68,68,.15);  color: #EF4444; border: 1px solid rgba(239,68,68,.3); }

.hist__date { font-family: 'Inter', sans-serif; font-size: 12px; color: #8892B0; }
.hist__opp  {
  display: flex; align-items: center; gap: 8px;
  font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 600; letter-spacing: 1px; color: #EEF2FF;
}
.hist__opp-logo { width: 22px; height: 22px; border-radius: 4px; object-fit: contain; flex-shrink: 0; }
.hist__opp-letter {
  width: 22px; height: 22px; border-radius: 4px; background: #1A1F2E; border: 1px solid #2A2F40;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; color: #3D4460; flex-shrink: 0;
}
.hist__series {
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1px;
  color: #3D4460; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hist__type {
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
  padding: 3px 10px; border-radius: 4px; border: 1px solid; display: inline-block;
}
.hist__actions { display: flex; justify-content: flex-end; gap: 6px; }
.hist__action-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  background: #0D1018; border: 1px solid #1A1F2E; border-radius: 5px;
  color: #3D4460; cursor: pointer; transition: all .15s;
}
.hist__action-btn:hover { border-color: var(--accent); color: var(--accent); }
.hist__action-btn--del:hover { border-color: #EF4444 !important; color: #EF4444 !important; }

/* ── Game detail rows (riot_data) ────────────────── */
.hist__game-row {
  display: grid;
  grid-template-columns: 36px 180px 42px 130px 100px 1fr 72px;
  padding: 8px 16px; border-bottom: 1px solid #1A1F2E; align-items: center;
  gap: 0; transition: background .12s;
}
.hist__game-row:last-child { border-bottom: none; }
.hist__game-row:hover { background: rgba(255,255,255,.02); }
.hist__game-row--selected { background: color-mix(in srgb, var(--accent) 5%, transparent) !important; }

.hist__game-champ { display: flex; align-items: center; gap: 9px; overflow: hidden; }
.hist__game-champ-wrap {
  width: 38px; height: 38px; border-radius: 7px; overflow: hidden; flex-shrink: 0;
  border: 2px solid transparent;
}
.hist__game-champ-wrap--win  { border-color: rgba(16,185,129,.4); }
.hist__game-champ-wrap--loss { border-color: rgba(239,68,68,.4); }
.hist__game-champ-img { width: 100%; height: 100%; object-fit: cover; }
.hist__game-champ-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.hist__game-champ-name { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #EEF2FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hist__game-champ-role {
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1.5px;
  color: #3D4460; background: #1A1F2E; border-radius: 3px; padding: 1px 5px; width: fit-content;
}

.hist__game-kda { display: flex; flex-direction: column; gap: 1px; }
.hist__game-kda-score { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; color: #EEF2FF; }
.hist__game-kda-ratio { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; }
.hist__game-champ-kda { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600; color: #8892B0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.hist__game-stats { display: flex; flex-direction: column; gap: 2px; }
.hist__game-stat { display: flex; align-items: center; gap: 4px; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: #8892B0; }
.hist__game-stat-label { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #3D4460; }
.hist__game-stats-inline { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: #8892B0; display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
.hist__game-meta { display: flex; flex-direction: column; gap: 2px; }
.hist__game-vs { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: #8892B0; }

/* ── OP.GG style game cards ── */
.og-card {
  display: flex; flex-direction: column;
  background: #111520; border: 1px solid #1A1F2E; border-left: 4px solid transparent;
  border-radius: 8px; margin-bottom: 6px; overflow: hidden;
}
.og-card:hover > .og-card__main { background: #131828; }
.og-card--win  { border-left-color: #10B981; }
.og-card--loss { border-left-color: #EF4444; }
.og-card--selected { outline: 1px solid color-mix(in srgb,var(--accent) 50%,transparent); }

.og-card__main {
  display: grid;
  grid-template-columns: 32px 115px 185px 110px 145px 1fr 40px;
  align-items: stretch; min-height: 90px;
}

/* 0. Checkbox */
.og-card__cb { display: flex; align-items: center; justify-content: center; padding: 0 4px; flex-shrink: 0; }

/* 1. Info zone */
.og-card__info {
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 10px 10px 10px 6px; border-right: 1px solid rgba(255,255,255,.04);
}
.og-card__info-top { display: flex; flex-direction: column; gap: 2px; }
.og-card__info-bot { display: flex; flex-direction: column; gap: 2px; }
.og-card__queue { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #8892B0; }
.og-card__date  { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; }
.og-card__vd    { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: .5px; }
.og-card__vd--win  { color: #10B981; }
.og-card__vd--loss { color: #EF4444; }
.og-card__dur   { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }

/* 2. Champion zone */
.og-card__champ-zone {
  display: flex; flex-direction: column; justify-content: center; gap: 6px;
  padding: 8px 10px; border-right: 1px solid rgba(255,255,255,.04);
}
.og-card__champ-top { display: flex; align-items: center; gap: 5px; }
.og-card__portrait-wrap { position: relative; flex-shrink: 0; }
.og-card__portrait { width: 58px; height: 58px; border-radius: 6px; object-fit: cover; border: 2px solid rgba(255,255,255,.1); display: block; }
.og-card__level {
  position: absolute; bottom: -2px; left: -2px;
  background: #0D1018; border: 1px solid #2A3050;
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700;
  color: #8892B0; padding: 0 3px; border-radius: 3px; line-height: 15px; z-index: 1;
}
.og-card__spells-col { display: flex; flex-direction: column; gap: 3px; align-self: center; }
.og-card__spell {
  width: 20px; height: 20px; border-radius: 4px; object-fit: cover;
  border: 1px solid rgba(255,255,255,.1); display: block;
}
.og-card__rune {
  width: 20px; height: 20px; border-radius: 50%; object-fit: contain;
  background: #0D1018; border: 1px solid rgba(255,255,255,.08); display: block;
}
.og-card__slot-empty { background: #0D1018 !important; }
.og-card__slot-empty--round { border-radius: 50% !important; }
.og-card__items-row { display: flex; gap: 2px; align-items: center; }
.og-card__item-slot {
  width: 20px; height: 20px; border-radius: 4px; overflow: hidden;
  background: #0A0E18; border: 1px solid #1A1F2E; flex-shrink: 0;
}
.og-card__item-slot--trinket { border-radius: 50%; margin-left: 3px; }
.og-card__item { width: 100%; height: 100%; object-fit: cover; display: block; }

/* 3. KDA zone */
.og-card__kda {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  padding: 10px 8px; border-right: 1px solid rgba(255,255,255,.04);
}
.og-card__score  { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; line-height: 1; color: #EEF2FF; white-space: nowrap; }
.og-card__sep    { color: #3D4460; font-size: 16px; }
.og-card__deaths { color: #EF4444; }
.og-card__ratio  { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; }

/* 4. Stats zone */
.og-card__stats {
  display: flex; flex-direction: column; justify-content: center; gap: 6px;
  padding: 10px 14px; border-right: 1px solid rgba(255,255,255,.04);
}
.og-card__stat-row   { display: flex; align-items: baseline; gap: 6px; }
.og-card__stat-label { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #3D4460; min-width: 40px; }
.og-card__stat-val   { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #EEF2FF; }
.og-card__stat-sub   { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; }

/* 5. Team comp: two vertical columns */
.og-card__teams {
  display: flex; gap: 6px; align-items: center; justify-content: center;
  padding: 8px 10px; border-right: 1px solid rgba(255,255,255,.04);
}
.og-card__team-side  { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.og-card__team-label {
  font-family: 'Rajdhani', sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 1px;
}
.og-card__team-label--ally  { color: #10B981; }
.og-card__team-label--enemy { color: #EF4444; }
.og-card__team-vs {
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1px;
  color: #2A3050; align-self: center; margin-top: 12px;
}
.og-card__team-col  { display: flex; flex-direction: column; gap: 2px; }
.og-card__team-icon {
  width: 22px; height: 22px; border-radius: 3px; object-fit: cover;
  border: 1px solid rgba(255,255,255,.06); opacity: .7; display: block;
}
.og-card__team-icon--me { border-color: var(--accent) !important; opacity: 1; }

/* 6. Actions */
.og-card__actions {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 8px 6px;
}
.og-card__expand-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: #0D1018; border: 1px solid #1A1F2E; border-radius: 4px;
  color: #3D4460; cursor: pointer; font-size: 9px; transition: all .15s;
}
.og-card__expand-btn:hover { border-color: var(--accent); color: var(--accent); }
.og-card__expand-btn--open { border-color: color-mix(in srgb,var(--accent) 50%,transparent); color: var(--accent); }
.og-card__expand-arrow { display: inline-block; transition: transform .2s ease; line-height: 1; }
.og-card__expand-btn--open .og-card__expand-arrow { transform: rotate(180deg); }

/* Scoreboard */
.og-card__scoreboard { border-top: 1px solid #1A1F2E; padding: 8px 52px; background: #0A0E18; }
.og-card__sb-grid    { display: grid; grid-template-columns: 1fr 1px 1fr; }
.og-card__sb-divider { background: #1A1F2E; margin: 2px 8px; }
.og-card__sb-col     { display: flex; flex-direction: column; gap: 1px; padding: 0 8px; }
.og-card__sb-col:first-child { padding-left: 0; }
.og-card__sb-col:last-child  { padding-right: 0; }
.og-card__sb-row {
  display: grid; grid-template-columns: 24px 1fr 50px 44px;
  align-items: center; gap: 6px; padding: 3px 5px; border-radius: 4px; transition: background .1s;
}
.og-card__sb-row:hover { background: rgba(255,255,255,.03); }
.og-card__sb-row--me  { background: color-mix(in srgb, var(--accent) 7%, transparent) !important; }
.og-card__sb-icon { width: 24px; height: 24px; border-radius: 4px; object-fit: cover; border: 1px solid rgba(255,255,255,.06); }
.og-card__sb-kda  { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: #3D4460; }
.og-card__sb-cs   { font-family: 'Rajdhani', sans-serif; font-size: 11px; color: #2A3050; text-align: right; }
.og-card__sb-dmg  { font-family: 'Rajdhani', sans-serif; font-size: 11px; color: #2A3050; text-align: right; }
.og-card__sb-row--win .og-card__sb-kda { color: #8892B0; }
.og-card__sb-row--me  .og-card__sb-kda { color: var(--accent); }

/* ── Logo upload ──────────────────────────────────── */
.logo-upload { display: flex; align-items: center; gap: 12px; }
.logo-upload__preview {
  width: 48px; height: 48px; border-radius: 8px; border: 1px solid #1A1F2E;
  background: #0D1018; display: flex; align-items: center; justify-content: center;
  position: relative; flex-shrink: 0; overflow: hidden;
}
.logo-upload__img { width: 100%; height: 100%; object-fit: contain; }
.logo-upload__placeholder {
  font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; color: #3D4460;
}
.logo-upload__clear {
  position: absolute; top: 2px; right: 2px; width: 16px; height: 16px;
  background: rgba(0,0,0,.7); border: none; border-radius: 3px;
  color: #EEF2FF; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.logo-upload__btn {
  display: flex; align-items: center; gap: 7px; cursor: pointer;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px;
  background: #111520; border: 1px solid #1A1F2E; border-radius: 5px;
  color: #8892B0; padding: 8px 14px; transition: all .15s;
}
.logo-upload__btn:hover { border-color: var(--accent); color: var(--accent); }
.logo-upload__input { display: none; }

/* ── Modales ──────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.65);
  backdrop-filter: blur(4px); z-index: 200;
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  background: #0D1018; border: 1px solid #1A1F2E; border-radius: 10px;
  width: 100%; max-width: 480px; display: flex; flex-direction: column;
  max-height: 90vh; overflow: hidden;
}
.modal__head {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #1A1F2E; flex-shrink: 0; gap: 12px;
}
.modal__title { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #EEF2FF; }
.modal__subtitle { font-family: 'Inter', sans-serif; font-size: 11px; color: #8892B0; margin: 4px 0 0 0; }
.modal__close { background: none; border: none; color: #3D4460; font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: color .15s; flex-shrink: 0; }
.modal__close:hover { color: #EEF2FF; }
.modal__body { padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
.modal__field { display: flex; flex-direction: column; gap: 6px; }
.modal__field-hint { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 400; letter-spacing: 0; color: #3D4460; text-transform: none; }
.modal__row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.modal__btns { display: flex; gap: 8px; flex-wrap: wrap; }
.modal__opt-btn {
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px;
  background: #111520; border: 1px solid #1A1F2E; border-radius: 5px;
  color: #3D4460; padding: 7px 16px; cursor: pointer; transition: all .15s;
}
.modal__opt-btn:hover { border-color: #2A2F40; color: #8892B0; }
.modal__textarea { resize: vertical; min-height: 70px; font-family: 'Inter', sans-serif; }

/* Destination selector */
.modal__dest-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.modal__dest-btn {
  display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 14px 12px;
  background: #0D1018; border: 2px solid #1A1F2E; border-radius: 8px; cursor: pointer;
  transition: all .15s; text-align: center; position: relative;
}
.modal__dest-btn:hover:not(.modal__dest-btn--active) { border-color: #2A2F40; background: #111520; }
.modal__dest-btn--active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, #0D1018);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent), inset 0 0 18px color-mix(in srgb, var(--accent) 6%, transparent);
}
.modal__dest-btn--active::after {
  content: '✓';
  position: absolute; top: 6px; right: 8px;
  font-size: 11px; font-weight: 700; color: var(--accent);
}
.modal__dest-icon { font-size: 22px; line-height: 1; }
.modal__dest-label {
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2px;
  color: #4A5280; transition: color .15s;
}
.modal__dest-btn--active .modal__dest-label { color: var(--accent); }
.modal__dest-desc { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; transition: color .15s; }
.modal__dest-btn--active .modal__dest-desc { color: color-mix(in srgb, var(--accent) 60%, #8892B0); }

.modal__footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 20px; border-top: 1px solid #1A1F2E; flex-shrink: 0;
}
.modal__btn {
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px;
  padding: 9px 20px; border-radius: 5px; cursor: pointer; transition: all .15s;
  display: flex; align-items: center; justify-content: center; min-width: 100px;
}
.modal__btn--cancel { background: #111520; border: 1px solid #1A1F2E; color: #8892B0; }
.modal__btn--cancel:hover { border-color: #3D4460; color: #EEF2FF; }
.modal__btn--save { background: var(--accent); border: 1px solid var(--accent); color: white; }
.modal__btn--save:hover:not(:disabled) { background: var(--accent-2); box-shadow: 0 0 16px color-mix(in srgb,var(--accent) 35%,transparent); }
.modal__btn--save:disabled { opacity: .6; cursor: not-allowed; }
.modal__spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .6s linear infinite; }

/* Light */
html[data-theme="light"] .hist__game-row { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .hist__game-row:hover { background: color-mix(in srgb,var(--accent) 3%,transparent); }
html[data-theme="light"] .hist__game-row--selected { background: color-mix(in srgb,var(--accent) 8%,transparent) !important; }
html[data-theme="light"] .hist__game-champ-name { color: #0D1220; }
html[data-theme="light"] .hist__game-champ-role { background: #F0F3FF; color: #8892B0; }
html[data-theme="light"] .hist__game-kda-score { color: #0D1220; }
html[data-theme="light"] .hist__game-vs { color: #4A5280; }
html[data-theme="light"] .og-card { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .og-card:hover > .og-card__main { background: #F7F8FC; }
html[data-theme="light"] .og-card__info    { border-right-color: #E0E3EF; }
html[data-theme="light"] .og-card__champ-zone { border-right-color: #E0E3EF; }
html[data-theme="light"] .og-card__kda     { border-right-color: #E0E3EF; }
html[data-theme="light"] .og-card__stats   { border-right-color: #E0E3EF; }
html[data-theme="light"] .og-card__teams   { border-right-color: #E0E3EF; }
html[data-theme="light"] .og-card__portrait { border-color: #C8CDDF; }
html[data-theme="light"] .og-card__spell   { border-color: #C8CDDF; }
html[data-theme="light"] .og-card__rune    { border-color: #C8CDDF; background: #F0F3FF; }
html[data-theme="light"] .og-card__item-slot { background: #F0F3FF; border-color: #E0E3EF; }
html[data-theme="light"] .og-card__score   { color: #0D1220; }
html[data-theme="light"] .og-card__stat-val { color: #0D1220; }
html[data-theme="light"] .og-card__team-icon { border-color: #C8CDDF; opacity: .85; }
html[data-theme="light"] .og-card__team-vs { color: #C8CDDF; }
html[data-theme="light"] .og-card__expand-btn { background: #F7F8FC; border-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .og-card__scoreboard { background: #F0F3FF; border-top-color: #E0E3EF; }
html[data-theme="light"] .og-card__sb-divider { background: #E0E3EF; }
html[data-theme="light"] .og-card__sb-row:hover { background: rgba(0,0,0,.03); }
html[data-theme="light"] .og-card__sb-row--win .og-card__sb-kda { color: #4A5280; }
html[data-theme="light"] .hist__table { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .hist__head { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .hist__row { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .hist__row:hover { background: color-mix(in srgb,var(--accent) 3%,transparent); }
html[data-theme="light"] .hist__row--selected { background: color-mix(in srgb,var(--accent) 8%,transparent) !important; }
html[data-theme="light"] .hist__opp { color: #0D1220; }
html[data-theme="light"] .hist__opp-letter { background: #F0F3FF; border-color: #E0E3EF; }
html[data-theme="light"] .hist__filter { background: #F7F8FC; border-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .hist__filter:hover { border-color: #C8CDDF; color: #4A5280; }
html[data-theme="light"] .hist__filter--active { border-color: var(--accent); color: var(--accent); }
html[data-theme="light"] .hist__empty { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .hist__action-btn { background: #F7F8FC; border-color: #E0E3EF; }
html[data-theme="light"] .hist__action-btn:hover { background: #EEF0F8; border-color: var(--accent); color: var(--accent); }
html[data-theme="light"] .hist__actbar { background: color-mix(in srgb, var(--accent) 6%, #FFFFFF); border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
html[data-theme="light"] .hist__actbar-hint { color: #4A5280; }
html[data-theme="light"] .hist__cb { border-color: #C8CDDF; }
html[data-theme="light"] .modal { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .modal__head { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .modal__footer { border-top-color: #E0E3EF; }
html[data-theme="light"] .modal__title { color: #0D1220; }
html[data-theme="light"] .modal__subtitle { color: #4A5280; }
html[data-theme="light"] .modal__opt-btn { background: #F7F8FC; border-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .modal__opt-btn:hover { background: #EEF0F8; border-color: #C8CDDF; color: #4A5280; }
html[data-theme="light"] .modal__dest-btn { background: #F7F8FC; border-color: #E0E3EF; }
html[data-theme="light"] .modal__dest-btn:hover:not(.modal__dest-btn--active) { background: #EEF0F8; border-color: #C8CDDF; }
html[data-theme="light"] .modal__dest-btn--active { background: color-mix(in srgb,var(--accent) 10%,#FFFFFF); border-color: var(--accent); }
html[data-theme="light"] .modal__dest-label { color: #4A5280; }
html[data-theme="light"] .modal__dest-btn--active .modal__dest-label { color: var(--accent); }
html[data-theme="light"] .modal__dest-desc { color: #8892B0; }
html[data-theme="light"] .modal__dest-btn--active .modal__dest-desc { color: color-mix(in srgb,var(--accent) 70%,#4A5280); }
html[data-theme="light"] .modal__btn--cancel { background: #F7F8FC; border-color: #E0E3EF; color: #4A5280; }
html[data-theme="light"] .logo-upload__preview { background: #F7F8FC; border-color: #E0E3EF; }
html[data-theme="light"] .logo-upload__btn { background: #F7F8FC; border-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .logo-upload__btn:hover { background: #EEF0F8; border-color: var(--accent); color: var(--accent); }
html[data-theme="light"] .logo-upload__preview { background: #F0F3FF; border-color: #E0E3EF; }
html[data-theme="light"] .hist__actbar-clear { border-color: #C8CDDF; color: #8892B0; }
html[data-theme="light"] .hist__actbar-clear:hover { border-color: #4A5280; color: #4A5280; }

.actbar-enter-active, .actbar-leave-active { transition: all .2s ease; }
.actbar-enter-from, .actbar-leave-to { opacity: 0; transform: translateY(-6px); }
.modal-enter-active, .modal-leave-active { transition: all .2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal, .modal-leave-to .modal { transform: scale(.97) translateY(6px); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
