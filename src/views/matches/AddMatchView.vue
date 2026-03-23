<script setup lang="ts">
import { ref } from 'vue'
import { useMatchStore } from '@/stores/matches'
import { useRouter } from 'vue-router'
import { CheckCircle } from 'lucide-vue-next'

const store  = useMatchStore()
const router = useRouter()

const opponent  = ref('')
const date      = ref('')
const time      = ref('')
const type      = ref<'scrim' | 'tournament' | 'official'>('scrim')
const isPlayed  = ref(false)
const result    = ref<'win' | 'loss'>('win')
const scoreUs   = ref<number | ''>('')
const scoreThem = ref<number | ''>('')
const notes     = ref('')
const msg       = ref<{ text: string; ok: boolean } | null>(null)
const loading   = ref(false)

const TYPE_OPTS = [
  { key: 'scrim',      label: 'SCRIM',    color: '#8892B0' },
  { key: 'tournament', label: 'TOURNOI',  color: '#C084FC' },
  { key: 'official',   label: 'OFFICIEL', color: 'var(--accent)' },
] as const

async function submit() {
  msg.value = null
  if (!opponent.value.trim() || !date.value) {
    msg.value = { text: 'Adversaire et date requis.', ok: false }; return
  }
  loading.value = true
  const data = {
    opponent:   opponent.value.trim(),
    date:       date.value,
    time:       time.value || null,
    type:       type.value,
    result:     isPlayed.value ? result.value : null,
    score_us:   isPlayed.value && scoreUs.value !== '' ? Number(scoreUs.value) : null,
    score_them: isPlayed.value && scoreThem.value !== '' ? Number(scoreThem.value) : null,
    notes:      notes.value.trim() || null,
  }
  const created = await store.createMatch(data)
  loading.value = false
  if (!created) { msg.value = { text: 'Erreur lors de la création.', ok: false }; return }
  msg.value = { text: 'Match ajouté !', ok: true }
  // reset form
  opponent.value = ''; date.value = ''; time.value = ''; notes.value = ''
  scoreUs.value = ''; scoreThem.value = ''
  isPlayed.value = false; result.value = 'win'
  setTimeout(() => router.push('/matches/history'), 1200)
}
</script>

<template>
  <div class="add">
    <div class="add__card">
      <div class="add__head">
        <span class="add__head-title">PLANIFIER UNE PARTIE</span>
      </div>
      <div class="add__body">
        <!-- Adversaire -->
        <div class="add__field">
          <label class="hx-label">Adversaire</label>
          <input v-model="opponent" class="hx-input" placeholder="Nom de l'équipe adverse" />
        </div>

        <!-- Date + Heure -->
        <div class="add__row2">
          <div class="add__field">
            <label class="hx-label">Date</label>
            <input v-model="date" class="hx-input" type="date" />
          </div>
          <div class="add__field">
            <label class="hx-label">Heure (optionnel)</label>
            <input v-model="time" class="hx-input" type="time" />
          </div>
        </div>

        <!-- Type -->
        <div class="add__field">
          <label class="hx-label">Type</label>
          <div class="add__types">
            <button
              v-for="opt in TYPE_OPTS" :key="opt.key"
              class="add__type-btn"
              :class="{ 'add__type-btn--active': type === opt.key }"
              :style="type === opt.key ? { borderColor: opt.color, color: opt.color, background: opt.color + '18' } : {}"
              @click="type = opt.key"
            >{{ opt.label }}</button>
          </div>
        </div>

        <!-- Match joué ? -->
        <div class="add__field">
          <label class="hx-label">Statut</label>
          <div class="add__types">
            <button class="add__type-btn" :class="{ 'add__type-btn--active': !isPlayed }" :style="!isPlayed ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 10%,transparent)' } : {}" @click="isPlayed = false">À VENIR</button>
            <button class="add__type-btn" :class="{ 'add__type-btn--active': isPlayed }"  :style="isPlayed  ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 10%,transparent)' } : {}" @click="isPlayed = true">JOUÉ</button>
          </div>
        </div>

        <!-- Si joué : résultat + score -->
        <Transition name="slide">
          <div v-if="isPlayed" class="add__played">
            <div class="add__field">
              <label class="hx-label">Résultat</label>
              <div class="add__types">
                <button class="add__type-btn" :class="{ 'add__type-btn--active': result === 'win' }"  :style="result === 'win'  ? { borderColor: '#10B981', color: '#10B981', background: 'rgba(16,185,129,.1)' }  : {}" @click="result = 'win'">VICTOIRE</button>
                <button class="add__type-btn" :class="{ 'add__type-btn--active': result === 'loss' }" :style="result === 'loss' ? { borderColor: '#EF4444', color: '#EF4444', background: 'rgba(239,68,68,.1)' } : {}" @click="result = 'loss'">DÉFAITE</button>
              </div>
            </div>
            <div class="add__row2">
              <div class="add__field">
                <label class="hx-label">Score HORNAX</label>
                <input v-model.number="scoreUs" class="hx-input" type="number" min="0" placeholder="0" />
              </div>
              <div class="add__field">
                <label class="hx-label">Score Adversaire</label>
                <input v-model.number="scoreThem" class="hx-input" type="number" min="0" placeholder="0" />
              </div>
            </div>
          </div>
        </Transition>

        <!-- Notes -->
        <div class="add__field">
          <label class="hx-label">Notes (optionnel)</label>
          <textarea v-model="notes" class="hx-input add__textarea" placeholder="Observations, VOD, …" />
        </div>

        <!-- Message -->
        <Transition name="msg">
          <div v-if="msg" class="add__msg" :class="msg.ok ? 'add__msg--ok' : 'add__msg--err'">
            <CheckCircle v-if="msg.ok" :size="13" />{{ msg.text }}
          </div>
        </Transition>

        <button class="add__submit" :disabled="loading" @click="submit">
          <span v-if="!loading">ENREGISTRER</span>
          <span v-else class="add__spinner" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.add { max-width: 600px; }
.add__card { background: #111520; border: 1px solid #1A1F2E; border-radius: 10px; overflow: hidden; }
.add__head { padding: 14px 20px; border-bottom: 1px solid #1A1F2E; }
.add__head-title { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #3D4460; }
.add__body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.add__field { display: flex; flex-direction: column; gap: 6px; }
.add__row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.add__types { display: flex; gap: 8px; flex-wrap: wrap; }
.add__type-btn {
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px;
  background: #0D1018; border: 1px solid #1A1F2E; border-radius: 5px;
  color: #3D4460; padding: 7px 16px; cursor: pointer; transition: all .15s;
}
.add__type-btn:hover { border-color: #2A2F40; color: #8892B0; }
.add__played { display: flex; flex-direction: column; gap: 14px; padding: 14px; background: rgba(255,255,255,.02); border-radius: 6px; border: 1px solid #1A1F2E; }
.add__textarea { resize: vertical; min-height: 80px; font-family: 'Inter', sans-serif; }
.add__msg { display: flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif; font-size: 12px; padding: 8px 12px; border-radius: 4px; }
.add__msg--ok  { color: #10B981; background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.2); }
.add__msg--err { color: #EF4444; background: rgba(239,68,68,.1);   border: 1px solid rgba(239,68,68,.2); }
.add__submit {
  padding: 11px; background: var(--accent); color: white; border: none; border-radius: 5px;
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 3px;
  cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center;
}
.add__submit:hover:not(:disabled) { background: var(--accent-2); box-shadow: 0 0 18px color-mix(in srgb,var(--accent) 35%,transparent); }
.add__submit:disabled { opacity: .6; cursor: not-allowed; }
.add__spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .6s linear infinite; }
/* Light */
html[data-theme="light"] .add__card { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .add__head { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .add__type-btn { background: #F7F8FC; border-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .add__type-btn:hover { border-color: #C8CDDF; color: #4A5280; }
html[data-theme="light"] .add__played { background: #F7F8FC; border-color: #E0E3EF; }
.slide-enter-active, .slide-leave-active { transition: all .25s ease; max-height: 200px; overflow: hidden; }
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; }
.msg-enter-active, .msg-leave-active { transition: all .25s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-4px); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
