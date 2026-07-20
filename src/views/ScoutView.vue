<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { API_BASE as API } from '@/config'
import { champIcon } from '@/utils/lol'
import { Search, X, RefreshCw, Crosshair, Save } from 'lucide-vue-next'

const auth = useAuthStore()

const REGIONS = [
  { value: 'euw', label: 'EUW' }, { value: 'eune', label: 'EUNE' },
  { value: 'na',  label: 'NA'  }, { value: 'kr',   label: 'KR'  },
  { value: 'br',  label: 'BR'  }, { value: 'jp',   label: 'JP'  },
]

const TIER_COLOR: Record<string, string> = {
  IRON: '#7A6651', BRONZE: '#A07354', SILVER: '#A0AABE',
  GOLD: '#F0B429', PLATINUM: '#4DD0A0', EMERALD: '#00C896',
  DIAMOND: '#6BAEE8', MASTER: '#C084FC', GRANDMASTER: '#F87171', CHALLENGER: '#F0B429',
}
const RANK_IMGS = new Set(['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master'])
function rankImg(tier: string): string | null {
  const t = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
  return RANK_IMGS.has(t) ? `/ranks lol/Season_2023_-_${t}.webp` : null
}
function rankNoDiv(tier: string) { return ['MASTER','GRANDMASTER','CHALLENGER'].includes(tier) }
function wrColor(v: number) { return v >= 60 ? '#00C896' : v >= 50 ? '#F0B429' : '#EF4444' }
function kdaColor(v: string) {
  const n = parseFloat(v)
  return n >= 5 ? '#00C896' : n >= 3 ? '#F0B429' : n >= 1.5 ? '#EEF2FF' : '#EF4444'
}

interface ScoutResult {
  id: string
  riotId: string
  region: string
  state: 'loading' | 'ok' | 'error'
  error?: string
  gameName?: string
  tagLine?: string
  ddVersion?: string
  soloQ?: { tier: string; rank: string; lp: number; wins: number; losses: number; winRate: number } | null
  flexQ?:  { tier: string; rank: string; lp: number; wins: number; losses: number; winRate: number } | null
  champPool?: { name: string; games: number; winRate: number; kda: string }[]
}

const inputId     = ref('')
const inputReg    = ref('euw')
const scouts      = ref<ScoutResult[]>([])
const scoutIndex  = ref(0)

const currentScout = computed(() => scouts.value[scoutIndex.value] ?? null)

function prevScout() { if (scoutIndex.value > 0) scoutIndex.value-- }
function nextScout() { if (scoutIndex.value < scouts.value.length - 1) scoutIndex.value++ }

let touchStartX = 0
function onTouchStart(e: TouchEvent) { touchStartX = e.touches[0].clientX }
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (dx > 50) prevScout()
  else if (dx < -50) nextScout()
}

function parseOpGGUrl(url: string): { summoners: string[]; region: string } | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('op.gg')) return null
    // Extract region from path e.g. /fr/lol/multisearch/euw
    const pathMatch = u.pathname.match(/multisearch\/([a-z0-9]+)/i)
    const region = pathMatch ? pathMatch[1].toLowerCase() : 'euw'
    const raw = u.searchParams.get('summoners')
    if (!raw) return null
    // Decode + split by comma
    const summoners = raw.split(',').map(s => s.trim().replace(/\+/g, ' ')).filter(s => s.includes('#'))
    return summoners.length ? { summoners, region } : null
  } catch { return null }
}

async function addScout() {
  const id = inputId.value.trim()
  if (!id) return

  // Check if it's an op.gg multisearch URL
  const parsed = parseOpGGUrl(id)
  if (parsed) {
    inputId.value = ''
    inputReg.value = parsed.region
    const firstIdx = scouts.value.length
    for (const summoner of parsed.summoners) {
      if (scouts.value.length >= 5) break
      const key = `${summoner}__${parsed.region}`
      if (scouts.value.some(s => s.id === key)) continue
      const entry: ScoutResult = { id: key, riotId: summoner, region: parsed.region, state: 'loading' }
      scouts.value.push(entry)
      fetchScout(entry)
    }
    if (scouts.value.length > firstIdx) scoutIndex.value = firstIdx
    return
  }

  if (!id.includes('#')) return
  const key = `${id}__${inputReg.value}`
  if (scouts.value.some(s => s.id === key)) return

  const entry: ScoutResult = { id: key, riotId: id, region: inputReg.value, state: 'loading' }
  scouts.value.push(entry)
  scoutIndex.value = scouts.value.length - 1
  inputId.value = ''
  await fetchScout(entry)
}

async function refetchScout(entry: ScoutResult) {
  entry.state = 'loading'
  await fetchScout(entry)
}

async function fetchScout(entry: ScoutResult) {
  try {
    const params = new URLSearchParams({ riotId: entry.riotId, region: entry.region })
    const res = await fetch(`${API}/riot/scout?${params}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    const data = await res.json()
    if (!res.ok) { entry.state = 'error'; entry.error = data.error; return }
    Object.assign(entry, { state: 'ok', ...data })
  } catch {
    entry.state = 'error'
    entry.error = 'Erreur réseau'
  }
}

function removeScout(id: string) {
  scouts.value = scouts.value.filter(s => s.id !== id)
}

// ── Équipes sauvegardées (historique partagé équipe) ──────────────
interface SavedTeam {
  id: number
  name: string
  category: 'scrim' | 'tournoi' | 'autre'
  region: string
  players: { riotId: string; gameName: string | null; tagLine: string | null }[]
  created_at: string
}
const savedTeams = ref<SavedTeam[]>([])
const showSave = ref(false)
const saveName = ref('')
const saveCat = ref<'scrim' | 'tournoi' | 'autre'>('autre')

async function loadSavedTeams() {
  const res = await fetch(`${API}/scout/teams`, { headers: { Authorization: `Bearer ${auth.token}` } })
  if (res.ok) savedTeams.value = await res.json()
}
async function saveCurrentTeam() {
  if (!saveName.value.trim() || scouts.value.length === 0) return
  const players = scouts.value.map(s => ({ riotId: s.riotId, gameName: s.gameName ?? null, tagLine: s.tagLine ?? null }))
  const res = await fetch(`${API}/scout/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ name: saveName.value.trim(), category: saveCat.value, region: scouts.value[0]?.region ?? 'euw', players }),
  })
  if (res.ok) { showSave.value = false; saveName.value = ''; await loadSavedTeams() }
}
function loadSavedTeam(t: SavedTeam) {
  scouts.value = []
  for (const p of t.players) {
    const entry: ScoutResult = { id: `${p.riotId}__${t.region}`, riotId: p.riotId, region: t.region, state: 'loading' }
    scouts.value.push(entry)
    fetchScout(entry)
  }
}
async function deleteSavedTeam(id: number) {
  const res = await fetch(`${API}/scout/teams/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } })
  if (res.ok) savedTeams.value = savedTeams.value.filter(t => t.id !== id)
}

onMounted(loadSavedTeams)
</script>

<template>
  <div class="scout">
    <!-- Header -->
    <div class="scout__header">
      <div>
        <span class="scout__eye">ANALYSE ADVERSAIRES</span>
        <h1 class="scout__title">SCOUTING</h1>
      </div>
    </div>

    <!-- Input -->
    <div class="scout__form-card">
      <div class="scout__form">
        <div class="scout__field scout__field--wide">
          <label class="hx-label">Riot ID du joueur</label>
          <input
            v-model="inputId"
            class="hx-input"
            placeholder="Faker#KR1 ou lien op.gg multisearch"
            @keyup.enter="addScout"
          />
        </div>
        <div class="scout__field">
          <label class="hx-label">Région</label>
          <select v-model="inputReg" class="hx-input scout__select">
            <option v-for="r in REGIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
        <button class="scout__add-btn" @click="addScout" :disabled="!inputId.trim().includes('#') && !inputId.trim().includes('op.gg')">
          <Search :size="15" />
          ANALYSER
        </button>
      </div>
      <p class="scout__hint">
        <Crosshair :size="11" style="display:inline;vertical-align:middle;margin-right:4px"/>
        Ajoute jusqu'à 5 joueurs (Riot ID ou colle directement un lien op.gg multisearch pour importer les 5 d'un coup).
      </p>
    </div>

    <!-- Barre de sauvegarde -->
    <div v-if="scouts.length > 0" class="scout__savebar">
      <template v-if="!showSave">
        <span class="scout__savebar-info">{{ scouts.length }} joueur(s) chargé(s)</span>
        <button class="scout__save-btn" @click="showSave = true"><Save :size="14" /> Sauvegarder cette équipe</button>
      </template>
      <template v-else>
        <input v-model="saveName" class="hx-input scout__save-name" placeholder="Nom de l'équipe adverse" @keyup.enter="saveCurrentTeam" />
        <select v-model="saveCat" class="hx-input scout__save-cat">
          <option value="scrim">Scrim</option>
          <option value="tournoi">Tournoi</option>
          <option value="autre">Autre</option>
        </select>
        <button class="scout__save-btn" :disabled="!saveName.trim()" @click="saveCurrentTeam">Enregistrer</button>
        <button class="scout__save-cancel" @click="showSave = false"><X :size="14" /></button>
      </template>
    </div>

    <!-- Historique des équipes scoutées -->
    <div v-if="savedTeams.length" class="scout__history">
      <span class="scout__history-title">ÉQUIPES SAUVEGARDÉES</span>
      <div class="scout__history-list">
        <div v-for="t in savedTeams" :key="t.id" class="scout__saved">
          <button class="scout__saved-main" @click="loadSavedTeam(t)">
            <span class="scout__saved-cat" :class="'cat-' + t.category">{{ t.category }}</span>
            <span class="scout__saved-name">{{ t.name }}</span>
            <span class="scout__saved-count">{{ t.players.length }} joueurs · {{ t.region.toUpperCase() }}</span>
          </button>
          <button class="scout__saved-del" @click="deleteSavedTeam(t.id)" title="Supprimer"><X :size="13" /></button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="scouts.length === 0" class="scout__empty">
      <Crosshair :size="40" class="scout__empty-icon" />
      <span class="scout__empty-title">Aucun joueur analysé</span>
      <span class="scout__empty-sub">Entre un Riot ID ci-dessus pour commencer le scouting</span>
    </div>

    <!-- Grille de cartes -->
    <div v-if="scouts.length > 0" class="scout__grid">
          <div
            v-for="s in scouts" :key="s.id"
            class="scout__card"
            :class="{ 'scout__card--loading': s.state === 'loading', 'scout__card--error': s.state === 'error' }"
          >
        <!-- Card header -->
        <div class="scout__card-head">
          <div class="scout__card-id">
            <span class="scout__card-name">{{ s.gameName ?? s.riotId.split('#')[0] }}</span>
            <span class="scout__card-tag">#{{ s.tagLine ?? s.riotId.split('#')[1] }}</span>
            <span class="scout__card-region">{{ s.region.toUpperCase() }}</span>
          </div>
          <div class="scout__card-actions">
            <button v-if="s.state === 'error'" class="scout__icon-btn" @click="refetchScout(s)" title="Réessayer">
              <RefreshCw :size="13" />
            </button>
            <button class="scout__icon-btn scout__icon-btn--remove" @click="removeScout(s.id)" title="Supprimer">
              <X :size="13" />
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="s.state === 'loading'" class="scout__card-loader">
          <div class="scout__loader-bar" />
          <span class="scout__loader-text">Récupération des données Riot…</span>
        </div>

        <!-- Error -->
        <div v-else-if="s.state === 'error'" class="scout__card-err">
          {{ s.error }}
        </div>

        <!-- Data -->
        <template v-else-if="s.state === 'ok'">
          <!-- Ranks -->
          <div class="scout__ranks">
            <div
              v-for="(qData, qKey) in { 'SOLO/DUO': s.soloQ, 'FLEX': s.flexQ }"
              :key="qKey"
              class="scout__rank-block"
              :style="qData ? { '--tc': TIER_COLOR[qData.tier] } : { '--tc': '#3D4460' }"
            >
              <span class="scout__rank-label">{{ qKey }}</span>
              <div v-if="qData" class="scout__rank-body">
                <img v-if="rankImg(qData.tier)"
                  :src="rankImg(qData.tier)!"
                  class="scout__rank-img"
                  :alt="qData.tier"
                  @error="($event.target as HTMLImageElement).style.display='none'" />
                <span v-else class="scout__rank-letter" :style="{ color: TIER_COLOR[qData.tier] }">
                  {{ qData.tier.charAt(0) }}
                </span>
                <div class="scout__rank-info">
                  <span class="scout__rank-tier" :style="{ color: TIER_COLOR[qData.tier] }">
                    {{ qData.tier }}{{ rankNoDiv(qData.tier) ? '' : ' ' + qData.rank }}
                  </span>
                  <span class="scout__rank-lp">{{ qData.lp }} LP</span>
                  <span class="scout__rank-wr" :style="{ color: wrColor(qData.winRate) }">
                    {{ qData.winRate }}% WR
                  </span>
                </div>
              </div>
              <div v-else class="scout__rank-unranked">Unranked</div>
            </div>
          </div>

          <!-- Champion pool -->
          <div v-if="s.champPool?.length" class="scout__champs">
            <div class="scout__champs-title">CHAMPION POOL <span class="scout__champs-sub">(ranked)</span></div>
            <div class="scout__champs-list">
              <div
                v-for="c in s.champPool" :key="c.name"
                class="scout__champ"
              >
                <img
                  :src="champIcon(c.name)"
                  :alt="c.name"
                  class="scout__champ-img"
                  @error="($event.target as HTMLImageElement).src='/logo.png'"
                />
                <div class="scout__champ-body">
                  <span class="scout__champ-name">{{ c.name }}</span>
                  <span class="scout__champ-games">{{ c.games }} partie{{ c.games > 1 ? 's' : '' }}</span>
                </div>
                <span class="scout__champ-wr" :style="{ color: wrColor(c.winRate) }">{{ c.winRate }}%</span>
                <span class="scout__champ-kda" :style="{ color: kdaColor(c.kda) }">{{ c.kda }}</span>
              </div>
            </div>
          </div>
          <div v-else class="scout__no-champs">Pas assez de ranked récents pour le champion pool.</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scout { display: flex; flex-direction: column; gap: 16px; animation: fadeIn .3s ease-out both; }

/* Header */
.scout__eye { display: block; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 4px; color: var(--accent); margin-bottom: 4px; }
.scout__title { font-family: 'Rajdhani', sans-serif; font-size: 30px; font-weight: 700; letter-spacing: 4px; color: #EEF2FF; margin: 0; }

/* Form card */
.scout__form-card { background: #111520; border: 1px solid #1A1F2E; border-radius: 10px; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
.scout__form { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
.scout__field { display: flex; flex-direction: column; gap: 5px; }
.scout__field--wide { flex: 1; min-width: 200px; }
.scout__select { min-width: 90px; }
.scout__add-btn {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px;
  background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 0 18px; height: 38px; cursor: pointer; transition: opacity .15s; white-space: nowrap; flex-shrink: 0;
}
.scout__add-btn:disabled { opacity: .4; cursor: not-allowed; }
.scout__add-btn:not(:disabled):hover { opacity: .85; }
.scout__hint { font-family: 'Inter', sans-serif; font-size: 11px; color: #3D4460; margin: 0; }

/* Empty */
.scout__empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 80px 20px; text-align: center; }
.scout__empty-icon { color: #1A1F2E; }
.scout__empty-title { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #3D4460; }
.scout__empty-sub { font-family: 'Inter', sans-serif; font-size: 12px; color: #2A3050; }

/* Grille de cartes (≈ 3 par ligne, responsive) */
.scout__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; align-items: start; }

/* Barre de sauvegarde */
.scout__savebar { display: flex; align-items: center; gap: 10px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; flex-wrap: wrap; }
.scout__savebar-info { font-family: 'Inter', sans-serif; font-size: 12px; color: var(--t-dim); flex: 1; }
.scout__save-btn { display: inline-flex; align-items: center; gap: 7px; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 9px 16px; cursor: pointer; transition: opacity .15s; }
.scout__save-btn:disabled { opacity: .4; cursor: not-allowed; }
.scout__save-btn:not(:disabled):hover { opacity: .85; }
.scout__save-name { flex: 1; min-width: 160px; }
.scout__save-cat { max-width: 130px; }
.scout__save-cancel { background: transparent; border: 1px solid var(--border); color: var(--t-dim); border-radius: 6px; padding: 8px; cursor: pointer; display: flex; }
.scout__save-cancel:hover { color: #EF4444; border-color: #EF4444; }

/* Historique */
.scout__history { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.scout__history-title { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: var(--accent); }
.scout__history-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; margin-top: 10px; }
.scout__saved { display: flex; align-items: stretch; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.scout__saved-main { flex: 1; display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; background: transparent; border: none; cursor: pointer; text-align: left; font-family: inherit; transition: background .15s; }
.scout__saved-main:hover { background: var(--bg-hover); }
.scout__saved-cat { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; width: fit-content; padding: 1px 6px; border-radius: 3px; }
.scout__saved-cat.cat-scrim   { color: var(--accent); background: color-mix(in srgb,var(--accent) 12%,transparent); }
.scout__saved-cat.cat-tournoi { color: #3B82F6; background: rgba(59,130,246,.12); }
.scout__saved-cat.cat-autre   { color: var(--t-dim); background: color-mix(in srgb,var(--t-dim) 12%,transparent); }
.scout__saved-name { font-family: 'Rajdhani', sans-serif; font-weight: 700; color: var(--t-primary); letter-spacing: .5px; }
.scout__saved-count { font-size: 11px; color: var(--t-dim); }
.scout__saved-del { background: transparent; border: none; border-left: 1px solid var(--border); color: var(--t-muted); padding: 0 10px; cursor: pointer; display: flex; align-items: center; transition: all .15s; }
.scout__saved-del:hover { color: #EF4444; background: rgba(239,68,68,.08); }

/* Carousel */
.scout__carousel-wrap { display: flex; flex-direction: column; gap: 10px; }
.scout__carousel-nav {
  display: flex; align-items: center; gap: 10px;
  background: #111520; border: 1px solid #1A1F2E; border-radius: 8px;
  padding: 8px 12px;
}
.scout__nav-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  background: #0D1018; border: 1px solid #1A1F2E; border-radius: 5px;
  color: #8892B0; cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.scout__nav-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.scout__nav-btn:disabled { opacity: .3; cursor: not-allowed; }
.scout__dots { display: flex; gap: 6px; flex: 1; justify-content: center; flex-wrap: wrap; }
.scout__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #1A1F2E; border: none; cursor: pointer; transition: all .2s; padding: 0;
}
.scout__dot--active { background: var(--accent); transform: scale(1.3); }
.scout__dot:hover:not(.scout__dot--active) { background: #3D4460; }
.scout__carousel-counter { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #3D4460; flex-shrink: 0; }
.scout__carousel-viewport { overflow: hidden; border-radius: 10px; }
.scout__carousel-track {
  display: flex; transition: transform .35s cubic-bezier(.4,0,.2,1);
}
.scout__carousel-track .scout__card { flex: 0 0 100%; min-width: 0; }

/* Card */
.scout__card {
  background: #111520; border: 1px solid #1A1F2E; border-radius: 10px;
  overflow: hidden; display: flex; flex-direction: column; transition: border-color .2s;
}
.scout__card:hover { border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
.scout__card--error { border-color: rgba(239,68,68,.3); }

.scout__card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border-bottom: 1px solid #1A1F2E;
  background: #0D1018;
}
.scout__card-id { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.scout__card-name { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; color: #EEF2FF; letter-spacing: 1px; }
.scout__card-tag  { font-family: 'Rajdhani', sans-serif; font-size: 12px; color: #3D4460; }
.scout__card-region { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: var(--accent); background: color-mix(in srgb,var(--accent) 10%,transparent); border: 1px solid color-mix(in srgb,var(--accent) 25%,transparent); border-radius: 3px; padding: 1px 5px; }
.scout__card-actions { display: flex; gap: 4px; flex-shrink: 0; }

.scout__icon-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: #1A1F2E; border: 1px solid #2A3050; border-radius: 5px;
  color: #3D4460; cursor: pointer; transition: all .15s;
}
.scout__icon-btn:hover { border-color: var(--accent); color: var(--accent); }
.scout__icon-btn--remove:hover { border-color: #EF4444; color: #EF4444; }

/* Loader */
.scout__card-loader { padding: 20px 16px; display: flex; flex-direction: column; gap: 8px; }
.scout__loader-bar { height: 2px; background: #1A1F2E; border-radius: 1px; overflow: hidden; position: relative; }
.scout__loader-bar::after { content: ''; position: absolute; inset-y: 0; width: 40%; background: var(--accent); animation: slide 1.2s ease-in-out infinite; }
@keyframes slide { 0% { left: -40%; } 100% { left: 100%; } }
.scout__loader-text { font-family: 'Inter', sans-serif; font-size: 11px; color: #3D4460; }

/* Error */
.scout__card-err { padding: 16px; font-family: 'Inter', sans-serif; font-size: 12px; color: #EF4444; }

/* Ranks */
.scout__ranks { display: flex; gap: 1px; background: #1A1F2E; }
.scout__rank-block {
  flex: 1; padding: 12px 14px; background: #111520;
  display: flex; flex-direction: column; gap: 8px;
}
.scout__rank-label { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; color: #3D4460; }
.scout__rank-body { display: flex; align-items: center; gap: 10px; }
.scout__rank-img { width: 52px; height: 52px; object-fit: contain; filter: drop-shadow(0 2px 6px color-mix(in srgb, var(--tc, #3D4460) 50%, transparent)); flex-shrink: 0; }
.scout__rank-letter { font-family: 'Rajdhani', sans-serif; font-size: 36px; font-weight: 900; flex-shrink: 0; }
.scout__rank-info { display: flex; flex-direction: column; gap: 2px; }
.scout__rank-tier { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 1px; line-height: 1; }
.scout__rank-lp   { font-family: 'Rajdhani', sans-serif; font-size: 11px; color: #8892B0; }
.scout__rank-wr   { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; }
.scout__rank-unranked { font-family: 'Rajdhani', sans-serif; font-size: 13px; color: #2A3050; padding: 10px 0; }

/* Champs */
.scout__champs { padding: 12px 14px; border-top: 1px solid #1A1F2E; }
.scout__champs-title { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; color: #3D4460; margin-bottom: 10px; }
.scout__champs-sub { text-transform: none; font-size: 8px; color: #2A3050; }
.scout__champs-list { display: flex; flex-direction: column; gap: 6px; }
.scout__champ {
  display: grid; grid-template-columns: 32px 1fr auto auto;
  align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px;
  background: #0D1018; border: 1px solid rgba(255,255,255,.03);
}
.scout__champ-img  { width: 32px; height: 32px; border-radius: 5px; object-fit: cover; border: 1px solid #1A1F2E; flex-shrink: 0; }
.scout__champ-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; overflow: hidden; }
.scout__champ-name { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #EEF2FF; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scout__champ-games { font-family: 'Inter', sans-serif; font-size: 10px; color: #8892B0; white-space: nowrap; }
.scout__champ-wr   { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; white-space: nowrap; }
.scout__champ-kda  { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; white-space: nowrap; min-width: 52px; text-align: right; }

.scout__no-champs { padding: 14px 16px; font-family: 'Inter', sans-serif; font-size: 11px; color: #3D4460; border-top: 1px solid #1A1F2E; }

/* Light theme */
html[data-theme="light"] .scout__form-card { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .scout__title { color: #0D1220; }
html[data-theme="light"] .scout__card { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .scout__card-head { background: #F7F8FC; border-bottom-color: #E0E3EF; }
html[data-theme="light"] .scout__card-name { color: #0D1220; }
html[data-theme="light"] .scout__rank-block { background: #FFFFFF; }
html[data-theme="light"] .scout__ranks { background: #E0E3EF; }
html[data-theme="light"] .scout__champ { background: #F0F3FF; border-color: #E0E3EF; }
html[data-theme="light"] .scout__champ-name { color: #0D1220; }
html[data-theme="light"] .scout__loader-bar { background: #E0E3EF; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 768px) {
  .scout__title { font-size: 22px; }
  .scout__form { flex-direction: column; }
  .scout__field--wide, .scout__field { width: 100%; }
  .scout__add-btn { width: 100%; justify-content: center; }
  .scout__grid { grid-template-columns: 1fr; }
  .scout__ranks { flex-direction: column; }
  .scout__rank-block { padding: 10px 12px; }
}
</style>
