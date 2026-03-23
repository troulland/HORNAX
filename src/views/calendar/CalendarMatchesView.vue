<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Upload, X } from 'lucide-vue-next'
import { useMatchStore, type Match } from '@/stores/matches'
import { useAuthStore } from '@/stores/auth'
import { API_BASE as API, STATIC_BASE } from '@/config'

const matchStore = useMatchStore()
const auth       = useAuthStore()
const today = new Date()
const currentYear  = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())

onMounted(() => matchStore.fetchUpcoming(100))

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS   = ['L','M','M','J','V','S','D']

function prevMonth() { if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- } else currentMonth.value-- }
function nextMonth() { if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ } else currentMonth.value++ }

const calDays = computed(() => {
  const first    = new Date(currentYear.value, currentMonth.value, 1)
  const last     = new Date(currentYear.value, currentMonth.value + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const days: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(currentYear.value, currentMonth.value, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
})

const EVENT_COLOR: Record<string, string> = {
  scrim:      '#2196F3',
  tournament: '#C084FC',
  official:   'var(--accent)',
}
const EVENT_LABEL: Record<string, string> = {
  scrim:      'SCRIM',
  tournament: 'TOURNOI',
  official:   'OFFICIEL',
}
const EVENT_TYPES = [
  { value: 'scrim',      label: 'SCRIM' },
  { value: 'tournament', label: 'TOURNOI' },
  { value: 'official',   label: 'OFFICIEL' },
]

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function eventsOn(d: Date): Match[] {
  const ds = toDateStr(d)
  return matchStore.upcoming.filter(m => m.date === ds)
}

const upcomingList = computed(() =>
  [...matchStore.upcoming].sort((a, b) => {
    const da = a.date + (a.time ? 'T' + a.time : 'T00:00')
    const db = b.date + (b.time ? 'T' + b.time : 'T00:00')
    return da.localeCompare(db)
  })
)

function isToday(d: Date) {
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
}

function fmtEvent(m: Match): string {
  const [y, mo, dd] = m.date.split('-')
  const date = `${dd}/${mo}/${y}`
  return m.time ? `${date} · ${m.time}` : date
}

/* ── Modal CRUD ──────────────────────────────────────── */
const modalOpen   = ref(false)
const editingId   = ref<number | null>(null)
const saving      = ref(false)
const logoFile    = ref<File | null>(null)
const logoPreview = ref<string | null>(null)
const form = ref({
  opponent:      '',
  type:          'scrim' as 'scrim' | 'tournament' | 'official',
  dateStr:       '',
  timeStr:       '18:00',
  opponent_logo: null as string | null,
})

// Auto-detect HORNAX ROYALTY opponent
watch(() => form.value.opponent, (name) => {
  if (!logoFile.value && name.toLowerCase().includes('royalty')) {
    logoPreview.value = '/hornax-royalty.png'
  } else if (!logoFile.value && !name.toLowerCase().includes('royalty') && logoPreview.value === '/hornax-royalty.png') {
    logoPreview.value = null
  }
})

function onLogoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  logoFile.value = file
  logoPreview.value = URL.createObjectURL(file)
}
function clearLogo() { logoFile.value = null; logoPreview.value = null; form.value.opponent_logo = null }

async function uploadLogoFile(): Promise<string | null> {
  if (!logoFile.value) return form.value.opponent_logo
  const fd = new FormData()
  fd.append('logo', logoFile.value)
  try {
    const res = await fetch(`${API}/matches/upload-logo`, {
      method: 'POST', headers: { Authorization: `Bearer ${auth.token}` }, body: fd,
    })
    return res.ok ? (await res.json()).url as string : form.value.opponent_logo
  } catch { return form.value.opponent_logo }
}

function openCreate(day: Date) {
  editingId.value = null
  logoFile.value = null; logoPreview.value = null
  form.value = { opponent: '', type: 'scrim', dateStr: toDateStr(day), timeStr: '18:00', opponent_logo: null }
  modalOpen.value = true
}

function openEdit(m: Match) {
  editingId.value = m.id
  logoFile.value = null
  logoPreview.value = m.opponent_logo
    ? (m.opponent_logo.startsWith('/logos/') ? `${STATIC_BASE}${m.opponent_logo}` : m.opponent_logo)
    : (m.opponent.toLowerCase().includes('royalty') ? '/hornax-royalty.png' : null)
  form.value = { opponent: m.opponent, type: m.type, dateStr: m.date, timeStr: m.time ?? '18:00', opponent_logo: m.opponent_logo }
  modalOpen.value = true
}

function closeModal() { modalOpen.value = false; editingId.value = null; logoFile.value = null; logoPreview.value = null }

async function saveEvent() {
  if (!form.value.opponent.trim() || !form.value.dateStr) return
  saving.value = true
  // If royalty auto-detected and no file uploaded, store the path directly
  const logoUrl = logoFile.value
    ? await uploadLogoFile()
    : (logoPreview.value === '/hornax-royalty.png' ? '/hornax-royalty.png' : form.value.opponent_logo)
  if (editingId.value !== null) {
    await matchStore.updateMatch(editingId.value, {
      opponent:      form.value.opponent.trim(),
      date:          form.value.dateStr,
      time:          form.value.timeStr || null,
      type:          form.value.type,
      opponent_logo: logoUrl,
    })
  } else {
    await matchStore.createMatch({
      opponent:      form.value.opponent.trim(),
      date:          form.value.dateStr,
      time:          form.value.timeStr || null,
      type:          form.value.type,
      result:        null,
      opponent_logo: logoUrl,
    })
  }
  saving.value = false
  closeModal()
}

async function deleteEvent(id: number) {
  await matchStore.deleteMatch(id)
  closeModal()
}
</script>

<template>
  <div class="cal-matches">
    <div class="layout">
      <!-- ── CALENDAR ─────────────────────────────────── -->
      <div class="cal-main">
        <div class="cal-nav">
          <button class="cal-nav-btn" @click="prevMonth"><ChevronLeft :size="16"/></button>
          <span class="cal-month">{{ MONTHS[currentMonth] }} {{ currentYear }}</span>
          <button class="cal-nav-btn" @click="nextMonth"><ChevronRight :size="16"/></button>
        </div>
        <div class="cal-grid">
          <div v-for="d in DAYS" :key="d" class="cal-grid__hdr">{{ d }}</div>
          <div
            v-for="(day, i) in calDays" :key="i"
            class="cal-grid__cell"
            :class="{
              'cal-grid__cell--empty':  !day,
              'cal-grid__cell--today':  day && isToday(day),
              'cal-grid__cell--has-ev': day && eventsOn(day).length > 0,
            }"
            @click="day && openCreate(day)"
          >
            <span v-if="day" class="cal-grid__num">{{ day.getDate() }}</span>
            <div v-if="day" class="cal-grid__cards">
              <div
                v-for="m in eventsOn(day).slice(0, 2)" :key="m.id"
                class="ev-chip"
                :style="{ '--ec': EVENT_COLOR[m.type] }"
                @click.stop="openEdit(m)"
              >
                <span class="ev-chip__badge">{{ EVENT_LABEL[m.type] }}</span>
                <span class="ev-chip__title">{{ m.opponent }}</span>
              </div>
              <div v-if="eventsOn(day).length > 2" class="ev-chip ev-chip--more">
                +{{ eventsOn(day).length - 2 }} autre{{ eventsOn(day).length - 2 > 1 ? 's' : '' }}
              </div>
            </div>
            <div v-if="day" class="cal-grid__add-hint"><Plus :size="10"/></div>
          </div>
        </div>
      </div>

      <!-- ── SIDEBAR ─────────────────────────────────── -->
      <div class="panel">
        <div class="panel__head">
          <span>À VENIR</span>
          <button class="panel__add-btn" @click="openCreate(new Date())">
            <Plus :size="14"/> AJOUTER
          </button>
        </div>
        <div class="panel__list">
          <div v-if="upcomingList.length === 0" class="panel__empty">Aucune partie prévue</div>
          <div
            v-for="m in upcomingList" :key="m.id"
            class="ev-row"
            :style="{ '--ec': EVENT_COLOR[m.type] }"
          >
            <div class="ev-row__type">{{ EVENT_LABEL[m.type] }}</div>
            <div class="ev-row__body">
              <span class="ev-row__title">vs {{ m.opponent }}</span>
              <span class="ev-row__date">{{ fmtEvent(m) }}</span>
            </div>
            <div class="ev-row__actions">
              <button class="ev-row__btn" @click="openEdit(m)"><Pencil :size="12"/></button>
              <button class="ev-row__btn ev-row__btn--del" @click="deleteEvent(m.id)"><Trash2 :size="12"/></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── MODAL ──────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
          <div class="modal">
            <div class="modal__head">
              <span class="modal__title">{{ editingId !== null ? 'MODIFIER' : 'PLANIFIER' }} UNE PARTIE</span>
              <button class="modal__close" @click="closeModal">✕</button>
            </div>

            <!-- Type -->
            <div class="modal__field">
              <label class="modal__label">TYPE</label>
              <div class="modal__types">
                <button
                  v-for="t in EVENT_TYPES" :key="t.value"
                  type="button"
                  class="modal__type-btn"
                  :class="{ 'modal__type-btn--active': form.type === t.value }"
                  :style="form.type === t.value ? { '--tc': EVENT_COLOR[t.value] } : {}"
                  @click="form.type = t.value as typeof form.type"
                >{{ t.label }}</button>
              </div>
            </div>

            <!-- Adversaire -->
            <div class="modal__field">
              <label class="modal__label">ADVERSAIRE *</label>
              <input v-model="form.opponent" class="hx-input" placeholder="Nom de l'équipe adverse" />
            </div>

            <!-- Logo adversaire -->
            <div class="modal__field">
              <label class="modal__label">LOGO ADVERSAIRE <span style="font-weight:400;font-size:9px;letter-spacing:0;text-transform:none;color:#3D4460">(optionnel)</span></label>
              <div class="logo-upload">
                <div class="logo-upload__preview">
                  <img v-if="logoPreview" :src="logoPreview" class="logo-upload__img" @error="($event.target as HTMLImageElement).style.display='none'" />
                  <span v-else class="logo-upload__placeholder">{{ form.opponent.charAt(0).toUpperCase() || '?' }}</span>
                  <button v-if="logoPreview" class="logo-upload__clear" @click="clearLogo"><X :size="10"/></button>
                </div>
                <label class="logo-upload__btn">
                  <Upload :size="13" />
                  {{ logoPreview ? 'Changer' : 'Uploader' }}
                  <input type="file" accept="image/*" class="logo-upload__input" @change="onLogoChange" />
                </label>
              </div>
            </div>

            <!-- Date + Time -->
            <div class="modal__row">
              <div class="modal__field">
                <label class="modal__label">DATE</label>
                <input v-model="form.dateStr" type="date" class="hx-input hx-input--native" />
              </div>
              <div class="modal__field">
                <label class="modal__label">HEURE</label>
                <input v-model="form.timeStr" type="time" class="hx-input hx-input--native" />
              </div>
            </div>

            <!-- Actions -->
            <div class="modal__actions">
              <button v-if="editingId !== null" class="modal__btn modal__btn--del" @click="deleteEvent(editingId!)">
                <Trash2 :size="14"/> SUPPRIMER
              </button>
              <div class="modal__actions-right">
                <button class="modal__btn modal__btn--cancel" @click="closeModal">ANNULER</button>
                <button class="modal__btn modal__btn--save" :disabled="saving || !form.opponent.trim()" @click="saveEvent">
                  <span v-if="!saving">{{ editingId !== null ? 'ENREGISTRER' : 'PLANIFIER' }}</span>
                  <span v-else class="modal__spinner" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }

/* ── Calendar ──────────────────────────────────────── */
.cal-main { background: #111520; border: 1px solid #1A1F2E; border-radius: 8px; overflow: hidden; }
.cal-nav { display: flex; align-items: center; padding: 14px 16px; border-bottom: 1px solid #1A1F2E; gap: 12px; }
.cal-nav-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: #0D1018; border: 1px solid #1A1F2E; border-radius: 4px; color: #8892B0; cursor: pointer; transition: all .15s; }
.cal-nav-btn:hover { border-color: var(--accent); color: #EEF2FF; }
.cal-month { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 3px; color: #EEF2FF; flex: 1; text-align: center; }

.cal-grid { display: grid; grid-template-columns: repeat(7,1fr); }
.cal-grid__hdr { padding: 8px 4px; text-align: center; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #3D4460; border-bottom: 1px solid #1A1F2E; }
.cal-grid__cell {
  min-height: 96px; padding: 6px 5px;
  border-right: 1px solid #1A1F2E; border-bottom: 1px solid #1A1F2E;
  cursor: pointer; transition: background .1s;
  position: relative; display: flex; flex-direction: column; gap: 3px;
}
.cal-grid__cell:nth-child(7n) { border-right: none; }
.cal-grid__cell:hover:not(.cal-grid__cell--empty) { background: #161B28; }
.cal-grid__cell:hover:not(.cal-grid__cell--empty) .cal-grid__add-hint { opacity: 1; }
.cal-grid__cell--empty { cursor: default; }
.cal-grid__cell--today { background: color-mix(in srgb,var(--accent) 6%,transparent); }
.cal-grid__cell--today .cal-grid__num { color: var(--accent); font-weight: 700; }
.cal-grid__num { font-family: 'Rajdhani', sans-serif; font-size: 13px; color: #8892B0; flex-shrink: 0; }
.cal-grid__cards { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.cal-grid__add-hint { position: absolute; bottom: 4px; right: 5px; color: #1E2436; opacity: 0; transition: opacity .15s; pointer-events: none; }

.ev-chip {
  background: color-mix(in srgb, var(--ec) 12%, #0D1018);
  border-left: 2px solid var(--ec); border-radius: 3px;
  padding: 2px 5px; display: flex; align-items: center; gap: 4px;
  cursor: pointer; transition: background .1s; overflow: hidden;
}
.ev-chip:hover { background: color-mix(in srgb, var(--ec) 22%, #0D1018); }
.ev-chip__badge { font-family: 'Rajdhani', sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 1.5px; color: var(--ec); flex-shrink: 0; }
.ev-chip__title { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; color: #EEF2FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-chip--more { background: rgba(255,255,255,.03); border-left: 2px solid #1A1F2E; }
.ev-chip--more .ev-chip__title { color: #3D4460; font-size: 9px; }

/* ── Sidebar panel ──────────────────────────────────── */
.panel { background: #111520; border: 1px solid #1A1F2E; border-radius: 8px; overflow: hidden; }
.panel__head { padding: 12px 16px; border-bottom: 1px solid #1A1F2E; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 3px; color: #3D4460; display: flex; align-items: center; justify-content: space-between; }
.panel__add-btn { display: flex; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: var(--accent); background: color-mix(in srgb,var(--accent) 8%,transparent); border: 1px solid color-mix(in srgb,var(--accent) 20%,transparent); border-radius: 4px; padding: 4px 10px; cursor: pointer; transition: all .15s; }
.panel__add-btn:hover { background: color-mix(in srgb,var(--accent) 15%,transparent); border-color: var(--accent); }
.panel__list { overflow-y: auto; max-height: 520px; }
.panel__empty { padding: 24px 16px; font-family: 'Inter', sans-serif; font-size: 12px; color: #3D4460; text-align: center; }

.ev-row { padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.03); border-left: 2px solid var(--ec); display: flex; gap: 10px; align-items: flex-start; transition: background .15s; }
.ev-row:hover { background: #0D1018; }
.ev-row:last-child { border-bottom: none; }
.ev-row__type { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; color: var(--ec); background: color-mix(in srgb, var(--ec) 12%, transparent); border: 1px solid color-mix(in srgb, var(--ec) 25%, transparent); padding: 2px 6px; border-radius: 3px; flex-shrink: 0; margin-top: 2px; }
.ev-row__body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.ev-row__title { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: .5px; color: #EEF2FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-row__date  { font-family: 'Inter', sans-serif; font-size: 10px; color: #8892B0; }
.ev-row__actions { display: flex; gap: 4px; flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.ev-row:hover .ev-row__actions { opacity: 1; }
.ev-row__btn { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: #0D1018; border: 1px solid #1A1F2E; border-radius: 4px; color: #8892B0; cursor: pointer; transition: all .15s; }
.ev-row__btn:hover { border-color: var(--accent); color: #EEF2FF; }
.ev-row__btn--del:hover { border-color: #EF4444 !important; color: #EF4444 !important; }

/* ── Modal ──────────────────────────────────────────── */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.65); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal { background: #0D1018; border: 1px solid #1A1F2E; border-radius: 10px; width: 100%; max-width: 460px; padding: 24px; display: flex; flex-direction: column; gap: 18px; }
.modal__head { display: flex; align-items: center; justify-content: space-between; }
.modal__title { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 3px; color: #EEF2FF; }
.modal__close { background: none; border: none; color: #3D4460; font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: color .15s; }
.modal__close:hover { color: #EEF2FF; }
.modal__field { display: flex; flex-direction: column; gap: 6px; }
.modal__label { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #3D4460; }
.modal__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.modal__types { display: flex; gap: 6px; }
.modal__type-btn {
  flex: 1; padding: 8px; border-radius: 5px; cursor: pointer;
  border: 1px solid #1A1F2E; background: #111520;
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #8892B0;
  transition: all .15s;
}
.modal__type-btn:hover { border-color: var(--accent); color: #EEF2FF; }
.modal__type-btn--active {
  border-color: var(--tc, var(--accent));
  background: color-mix(in srgb, var(--tc, var(--accent)) 10%, transparent);
  color: var(--tc, var(--accent));
}
.hx-input--native { color-scheme: dark; }

/* Logo upload */
.logo-upload { display: flex; align-items: center; gap: 12px; }
.logo-upload__preview {
  width: 44px; height: 44px; border-radius: 8px; border: 1px solid #1A1F2E;
  background: #111520; display: flex; align-items: center; justify-content: center;
  position: relative; flex-shrink: 0; overflow: hidden;
}
.logo-upload__img { width: 100%; height: 100%; object-fit: contain; }
.logo-upload__placeholder { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; color: #3D4460; }
.logo-upload__clear {
  position: absolute; top: 2px; right: 2px; width: 16px; height: 16px;
  background: rgba(0,0,0,.7); border: none; border-radius: 3px;
  color: #EEF2FF; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.logo-upload__btn {
  display: flex; align-items: center; gap: 7px; cursor: pointer;
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px;
  background: #111520; border: 1px solid #1A1F2E; border-radius: 5px;
  color: #8892B0; padding: 7px 12px; transition: all .15s;
}
.logo-upload__btn:hover { border-color: var(--accent); color: var(--accent); }
.logo-upload__input { display: none; }
.modal__actions { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.modal__actions-right { display: flex; gap: 8px; margin-left: auto; }
.modal__btn {
  display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 5px; cursor: pointer;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px;
  transition: all .15s; border: 1px solid transparent;
}
.modal__btn--cancel { background: #111520; border-color: #1A1F2E; color: #8892B0; }
.modal__btn--cancel:hover { color: #EEF2FF; border-color: #3D4460; }
.modal__btn--save { background: var(--accent); color: white; border-color: var(--accent); }
.modal__btn--save:hover:not(:disabled) { background: var(--accent-2); box-shadow: 0 0 16px color-mix(in srgb,var(--accent) 35%,transparent); }
.modal__btn--save:disabled { opacity: .6; cursor: not-allowed; }
.modal__btn--del { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.25); color: #EF4444; }
.modal__btn--del:hover { background: rgba(239,68,68,.15); border-color: #EF4444; }
.modal__spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .6s linear infinite; display: block; }

.modal-enter-active, .modal-leave-active { transition: all .2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal, .modal-leave-to .modal { transform: scale(.96) translateY(8px); }

/* Light theme */
html[data-theme="light"] .cal-main { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .cal-nav { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .cal-month { color: #0D1220; }
html[data-theme="light"] .cal-grid__hdr { border-bottom-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .cal-grid__cell { border-color: #E0E3EF; }
html[data-theme="light"] .cal-grid__cell:hover:not(.cal-grid__cell--empty) { background: color-mix(in srgb,var(--accent) 4%,transparent); }
html[data-theme="light"] .cal-grid__cell--today { background: color-mix(in srgb,var(--accent) 7%,transparent); }
html[data-theme="light"] .cal-grid__num { color: #4A5280; }
html[data-theme="light"] .panel { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .panel__head { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .ev-row { border-bottom-color: rgba(0,0,0,.07); }
html[data-theme="light"] .ev-row:hover { background: #F7F8FC; }
html[data-theme="light"] .ev-row__title { color: #0D1220; }
html[data-theme="light"] .modal { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .modal__title { color: #0D1220; }
html[data-theme="light"] .modal__type-btn { background: #F7F8FC; border-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .modal__type-btn:hover { background: #EEF0F8; border-color: #C8CDDF; color: #4A5280; }
html[data-theme="light"] .modal__btn--cancel { background: #F7F8FC; border-color: #E0E3EF; color: #4A5280; }
html[data-theme="light"] .modal__btn--cancel:hover { background: #EEF0F8; border-color: #C8CDDF; }
html[data-theme="light"] .ev-chip { background: color-mix(in srgb, var(--ec) 10%, #FFFFFF); }
html[data-theme="light"] .hx-input--native { color-scheme: light; }
html[data-theme="light"] .logo-upload__preview { background: #F7F8FC; border-color: #E0E3EF; }
html[data-theme="light"] .logo-upload__btn { background: #F7F8FC; border-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .logo-upload__btn:hover { background: #EEF0F8; border-color: var(--accent); color: var(--accent); }
html[data-theme="light"] .logo-upload__preview { background: #F0F3FF; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
