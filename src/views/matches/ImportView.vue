<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMatchStore } from '@/stores/matches'
import { Search, RefreshCw, CheckCircle, Trophy, Swords, AlertTriangle } from 'lucide-vue-next'
import { API_BASE as API } from '@/config'
const auth = useAuthStore()
const matchStore = useMatchStore()

interface RiotParticipant {
  name: string
  tag: string
  champion: string
  teamId: number
  role: string
  kills: number
  deaths: number
  assists: number
  gold: number
  cs: number
  damage: number
  vision: number
  win: boolean
  isUser: boolean
}

interface RiotMatch {
  matchId: string
  date: string
  duration: number
  champion: string
  kills: number
  deaths: number
  assists: number
  kda: string
  win: boolean
  cs: number
  csMin: string
  role: string
  queueId: number
  queueLabel: string
  riotData?: {
    matchId: string
    duration: number
    queueLabel: string
    participants: RiotParticipant[]
  }
}

const riotId    = ref(auth.user?.riot_id ?? '')
const region    = ref('euw')
const count     = ref(10)
const matchType = ref('')

const loading   = ref(false)
const error     = ref<string | null>(null)
const ddVersion = ref('15.6.1')
const results   = ref<RiotMatch[]>([])
const imported  = ref<Set<string>>(new Set())
const importing = ref<string | null>(null)
const riotSaved = ref(false)

async function saveRiotId(id: string) {
  if (!id.trim() || !auth.token) return
  if (id.trim() === (auth.user?.riot_id ?? '')) return
  try {
    const res = await fetch(`${API}/players/me/riot-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ riot_id: id.trim() }),
    })
    if (res.ok) {
      if (auth.user) {
        auth.user = { ...auth.user, riot_id: id.trim() }
        localStorage.setItem('hx_user', JSON.stringify(auth.user))
      }
      riotSaved.value = true
      setTimeout(() => { riotSaved.value = false }, 2000)
    }
  } catch { /* silently ignore */ }
}

const REGIONS = [
  { value: 'euw',  label: 'EUW' },
  { value: 'eune', label: 'EUNE' },
  { value: 'na',   label: 'NA' },
  { value: 'kr',   label: 'KR' },
  { value: 'br',   label: 'BR' },
  { value: 'jp',   label: 'JP' },
  { value: 'oce',  label: 'OCE' },
]

const TYPES = [
  { value: '',        label: 'TOUS' },
  { value: 'ranked',  label: 'RANKED' },
  { value: 'normal',  label: 'NORMAL' },
]

function champIcon(name: string) {
  // Quelques noms de champions avec espaces/apostrophes ont des noms de fichier spéciaux
  const special: Record<string, string> = {
    "Nunu & Willump": "Nunu",
    "Renata Glasc": "Renata",
    "K'Sante": "KSante",
    "Bel'Veth": "Belveth",
    "Wukong": "MonkeyKing",
  }
  return `https://ddragon.leagueoflegends.com/cdn/${ddVersion.value}/img/champion/${special[name] ?? name}.png`
}

async function search() {
  if (!riotId.value.trim()) return
  error.value = null
  results.value = []
  loading.value = true
  await saveRiotId(riotId.value)
  try {
    const params = new URLSearchParams({
      riotId: riotId.value.trim(),
      region: region.value,
      count: String(count.value),
      ...(matchType.value ? { type: matchType.value } : {}),
    })
    const res = await fetch(`${API}/riot/matches?${params}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    const data = await res.json()
    if (!res.ok) { error.value = data.error; return }
    ddVersion.value = data.ddVersion ?? ddVersion.value
    results.value   = data.matches
    imported.value  = new Set()
  } catch {
    error.value = 'Erreur réseau — vérifie que le backend est démarré.'
  } finally {
    loading.value = false
  }
}

function queueToType(queueId: number): 'scrim' | 'tournament' | 'official' {
  if ([420, 440].includes(queueId)) return 'official'    // Ranked Solo/Duo, Ranked Flex
  if (queueId === 0)                return 'tournament'  // Custom
  return 'scrim'                                         // Normal, ARAM, etc.
}

async function importAsMatch(m: RiotMatch) {
  importing.value = m.matchId
  const created = await matchStore.createMatch({
    opponent:   'Adversaire inconnu',
    date:       m.date,
    time:       null,
    type:       queueToType(m.queueId),
    result:     m.win ? 'win' : 'loss',
    notes:      `Import Riot — ${m.champion} ${m.kills}/${m.deaths}/${m.assists} (${m.queueLabel}, ${m.duration}min)`,
    riot_data:  m.riotData ? JSON.stringify(m.riotData) : null,
  })
  if (created) imported.value = new Set([...imported.value, m.matchId])
  importing.value = null
}
</script>

<template>
  <div class="import">
    <!-- Formulaire de recherche -->
    <div class="import__card">
      <div class="import__head">
        <span class="import__head-title">IMPORT RIOT GAMES</span>
        <span class="import__head-note">Application personnelle Riot Games</span>
      </div>
      <div class="import__body">
        <div class="import__form">
          <!-- Riot ID -->
          <div class="import__field import__field--wide">
            <label class="hx-label">
              Riot ID
              <span v-if="riotSaved" class="import__saved-badge">✓ sauvegardé</span>
            </label>
            <input
              v-model="riotId"
              class="hx-input"
              placeholder="Kaishi#EUW"
              @keyup.enter="search"
            />
          </div>

          <!-- Région -->
          <div class="import__field">
            <label class="hx-label">Région</label>
            <select v-model="region" class="hx-input import__select">
              <option v-for="r in REGIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>

          <!-- Nb de parties -->
          <div class="import__field">
            <label class="hx-label">Nombre</label>
            <select v-model.number="count" class="hx-input import__select">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
            </select>
          </div>

          <!-- Type -->
          <div class="import__field">
            <label class="hx-label">Type</label>
            <div class="import__types">
              <button
                v-for="t in TYPES" :key="t.value"
                class="import__type-btn"
                :class="{ 'import__type-btn--active': matchType === t.value }"
                @click="matchType = t.value"
              >{{ t.label }}</button>
            </div>
          </div>
        </div>

        <button class="import__search-btn" :disabled="loading" @click="search">
          <component :is="loading ? RefreshCw : Search" :size="15" :class="{ 'spin': loading }" />
          {{ loading ? 'Récupération…' : 'RECHERCHER' }}
        </button>
      </div>
    </div>

    <!-- Erreur -->
    <div v-if="error" class="import__error">
      <AlertTriangle :size="14" />
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-if="!loading && results.length === 0 && !error" class="import__empty">
      <Swords :size="36" class="import__empty-icon" />
      <span>Entre ton Riot ID et clique Rechercher</span>
    </div>

    <!-- Résultats -->
    <div v-if="results.length > 0" class="import__results">
      <div class="import__results-head">
        <span>{{ results.length }} partie{{ results.length > 1 ? 's' : '' }} trouvée{{ results.length > 1 ? 's' : '' }}</span>
      </div>

      <div v-for="m in results" :key="m.matchId" class="match-row" :class="m.win ? 'match-row--win' : 'match-row--loss'">
        <!-- Champion portrait -->
        <div class="match-row__champ">
          <img
            :src="champIcon(m.champion)"
            :alt="m.champion"
            class="match-row__champ-img"
            @error="($event.target as HTMLImageElement).src = '/logo.png'"
          />
          <span class="match-row__result-badge" :class="m.win ? 'match-row__result-badge--win' : 'match-row__result-badge--loss'">
            {{ m.win ? 'V' : 'D' }}
          </span>
        </div>

        <!-- Infos -->
        <div class="match-row__info">
          <div class="match-row__top">
            <span class="match-row__champ-name">{{ m.champion }}</span>
            <span class="match-row__queue">{{ m.queueLabel }}</span>
          </div>
          <div class="match-row__bottom">
            <span class="match-row__kda">{{ m.kills }}/{{ m.deaths }}/{{ m.assists }}</span>
            <span class="match-row__kda-ratio" :class="parseFloat(m.kda) >= 3 ? 'kda--good' : parseFloat(m.kda) >= 2 ? 'kda--ok' : 'kda--bad'">
              {{ m.kda }} KDA
            </span>
            <span class="match-row__sep">·</span>
            <span class="match-row__cs">{{ m.cs }} CS ({{ m.csMin }}/min)</span>
          </div>
        </div>

        <!-- Meta -->
        <div class="match-row__meta">
          <span class="match-row__date">{{ new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }}</span>
          <span class="match-row__dur">{{ m.duration }} min</span>
        </div>

        <!-- Action import -->
        <div class="match-row__action">
          <button
            v-if="!imported.has(m.matchId)"
            class="match-row__import-btn"
            :disabled="importing === m.matchId"
            @click="importAsMatch(m)"
          >
            <component :is="importing === m.matchId ? RefreshCw : Trophy" :size="12" :class="{ 'spin': importing === m.matchId }" />
            {{ importing === m.matchId ? '…' : 'Importer' }}
          </button>
          <span v-else class="match-row__imported">
            <CheckCircle :size="14" /> Importé
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import { display: flex; flex-direction: column; gap: 16px; }

/* Card recherche */
.import__card { background: #111520; border: 1px solid #1A1F2E; border-radius: 10px; overflow: hidden; }
.import__head { padding: 12px 20px; border-bottom: 1px solid #1A1F2E; display: flex; align-items: center; justify-content: space-between; }
.import__head-title { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #3D4460; }
.import__head-note { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }
.import__body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }

.import__form { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
.import__field { display: flex; flex-direction: column; gap: 6px; }
.import__field--wide { flex: 1; min-width: 180px; }
.import__select { padding: 10px 12px; cursor: pointer; }

.import__types { display: flex; gap: 6px; }
.import__type-btn {
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
  background: #0D1018; border: 1px solid #1A1F2E; border-radius: 4px;
  color: #3D4460; padding: 6px 12px; cursor: pointer; transition: all .15s;
}
.import__type-btn:hover { border-color: #2A2F40; color: #8892B0; }
.import__type-btn--active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb,var(--accent) 8%,transparent); }

.import__saved-badge {
  margin-left: 8px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600;
  color: #10B981; letter-spacing: 0;
}

.import__search-btn {
  display: flex; align-items: center; gap: 8px; align-self: flex-end;
  background: var(--accent); border: none; border-radius: 5px; color: white;
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2px;
  padding: 10px 20px; cursor: pointer; transition: background .15s; white-space: nowrap;
}
.import__search-btn:hover:not(:disabled) { background: var(--accent-2); }
.import__search-btn:disabled { opacity: .6; cursor: not-allowed; }

/* Error */
.import__error {
  display: flex; align-items: center; gap: 8px;
  background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.25); border-radius: 6px;
  padding: 10px 16px; font-family: 'Inter', sans-serif; font-size: 13px; color: #EF4444;
}

/* Empty */
.import__empty {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 50px 20px; background: #111520; border: 1px solid #1A1F2E; border-radius: 10px;
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600;
  letter-spacing: 2px; color: #3D4460;
}
.import__empty-icon { color: #1A1F2E; }

/* Résultats */
.import__results { background: #111520; border: 1px solid #1A1F2E; border-radius: 10px; overflow: hidden; }
.import__results-head {
  padding: 10px 16px; border-bottom: 1px solid #1A1F2E;
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #3D4460;
}

.match-row {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 16px; border-bottom: 1px solid #1A1F2E;
  border-left: 3px solid transparent; transition: background .12s;
}
.match-row:last-child { border-bottom: none; }
.match-row--win  { border-left-color: #10B981; }
.match-row--loss { border-left-color: #EF4444; }
.match-row:hover { background: rgba(255,255,255,.02); }

/* Champion */
.match-row__champ { position: relative; flex-shrink: 0; }
.match-row__champ-img { width: 46px; height: 46px; border-radius: 6px; object-fit: cover; border: 1px solid #1A1F2E; display: block; }
.match-row__result-badge {
  position: absolute; bottom: -4px; right: -4px;
  width: 18px; height: 18px; border-radius: 4px; border: 1px solid;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700;
}
.match-row__result-badge--win  { background: #0D1018; color: #10B981; border-color: #10B981; }
.match-row__result-badge--loss { background: #0D1018; color: #EF4444; border-color: #EF4444; }

/* Info */
.match-row__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.match-row__top { display: flex; align-items: center; gap: 10px; }
.match-row__champ-name { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 1px; color: #EEF2FF; }
.match-row__queue { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #3D4460; background: #1A1F2E; padding: 2px 7px; border-radius: 3px; }
.match-row__bottom { display: flex; align-items: center; gap: 8px; }
.match-row__kda { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; color: #EEF2FF; }
.match-row__kda-ratio { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; }
.kda--good { color: #10B981; }
.kda--ok   { color: var(--accent); }
.kda--bad  { color: #EF4444; }
.match-row__sep { color: #1A1F2E; }
.match-row__cs { font-family: 'Inter', sans-serif; font-size: 11px; color: #8892B0; }

/* Meta */
.match-row__meta { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.match-row__date { font-family: 'Inter', sans-serif; font-size: 11px; color: #8892B0; }
.match-row__dur  { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; color: #3D4460; }

/* Action */
.match-row__action { flex-shrink: 0; }
.match-row__import-btn {
  display: flex; align-items: center; gap: 6px;
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
  background: color-mix(in srgb,var(--accent) 8%,transparent); border: 1px solid color-mix(in srgb,var(--accent) 25%,transparent); border-radius: 5px;
  color: var(--accent); padding: 6px 12px; cursor: pointer; transition: all .15s; white-space: nowrap;
}
.match-row__import-btn:hover:not(:disabled) { background: color-mix(in srgb,var(--accent) 18%,transparent); border-color: var(--accent); }
.match-row__import-btn:disabled { opacity: .5; cursor: not-allowed; }
.match-row__imported {
  display: flex; align-items: center; gap: 5px;
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px;
  color: #10B981;
}

/* Light */
html[data-theme="light"] .import__card { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .import__head { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .import__type-btn { background: #F7F8FC; border-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .import__type-btn:hover { border-color: #C8CDDF; color: #4A5280; }
html[data-theme="light"] .import__type-btn--active { border-color: var(--accent); color: var(--accent); }
html[data-theme="light"] .import__empty { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .import__results { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .import__results-head { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .match-row { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .match-row:hover { background: color-mix(in srgb,var(--accent) 3%,transparent); }
html[data-theme="light"] .match-row__champ-img { border-color: #E0E3EF; }
html[data-theme="light"] .match-row__result-badge--win,
html[data-theme="light"] .match-row__result-badge--loss { background: #FFFFFF; }
html[data-theme="light"] .match-row__champ-name { color: #0D1220; }
html[data-theme="light"] .match-row__queue { background: #F0F3FF; color: #8892B0; }
html[data-theme="light"] .match-row__kda { color: #0D1220; }

.spin { animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .import__form { flex-direction: column; }
  .import__field--wide { min-width: unset; width: 100%; }
  .import__field { width: 100%; }
  .import__search-btn { width: 100%; justify-content: center; }
  .match-row { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
  .match-row__meta { width: 100%; flex-direction: row; justify-content: space-between; }
}
</style>
