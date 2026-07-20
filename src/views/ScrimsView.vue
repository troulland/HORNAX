<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { RefreshCw, Swords, Pencil, X, Upload } from 'lucide-vue-next'
import { useRiotStore, type ScrimStats, type ScrimSeries, type ScrimGameLite } from '@/stores/riot'
import { champIcon, fmtDur, fmtAgo, wrColor } from '@/utils/lol'
import { STATIC_BASE } from '@/config'

const riot = useRiotStore()
const router = useRouter()

const stats = ref<ScrimStats | null>(null)
const series = ref<ScrimSeries[]>([])
const loading = ref(true)

async function load() {
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
const logoUrl = (p: string | null) => (p ? (p.startsWith('http') ? p : `${STATIC_BASE}${p}`) : '')
const ourFocus = (m: ScrimGameLite) => m.allies.find(a => a.userId)?.userId ?? undefined
const openGame = (id: string, focus?: number) =>
  router.push(focus ? `/game/${id}?focus=${focus}` : `/game/${id}`)

// ── édition BO (adversaire + logo) ──────────────────────────
const editing = ref<ScrimSeries | null>(null)
const form = ref({ opponent: '', logoUrl: '' as string | null, preview: '' })
const saving = ref(false)

function openEdit(s: ScrimSeries) {
  editing.value = s
  form.value = { opponent: s.opponent ?? '', logoUrl: s.opponentLogo, preview: logoUrl(s.opponentLogo) }
}
async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  form.value.preview = URL.createObjectURL(file)
  const url = await riot.uploadLogo(file)
  if (url) form.value.logoUrl = url
}
async function saveEdit() {
  if (!editing.value) return
  saving.value = true
  const ok = await riot.editSeries(editing.value.seriesId, {
    opponent: form.value.opponent.trim() || null,
    opponent_logo: form.value.logoUrl,
  })
  saving.value = false
  if (ok) { editing.value = null; await load() }
}

onMounted(async () => {
  await load()
  // synchro auto en arrière-plan (debounce 15 min côté serveur) → espace partagé équipe
  riot.sync(false).then(r => { if (r && !r.skipped) load() })
})
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">SCRIMS</h1>
        <p class="page__sub">Parties en code de tournoi · 30 derniers jours · partagé avec la team</p>
      </div>
      <button class="hx-btn-primary sync-btn" :disabled="riot.syncing" @click="sync">
        <RefreshCw :size="15" :class="{ spin: riot.syncing }" />
        {{ riot.syncing ? 'Synchro…' : 'Synchroniser' }}
      </button>
    </header>

    <!-- KPIs + bloc bleu/rouge (un cadre, séparé en deux) -->
    <div v-if="stats && stats.games" class="stats">
      <div class="tile"><span class="tile__val">{{ stats.games }}</span><span class="tile__lbl">Matchs joués</span></div>
      <div class="tile">
        <span class="tile__val" :style="{ color: wrColor(stats.winRate) }">{{ stats.winRate }}%</span>
        <span class="tile__lbl">Winrate · {{ stats.wins }}V {{ stats.losses }}D</span>
      </div>
      <div class="tile"><span class="tile__val">{{ fmtDur(stats.avgDurationSec) }}</span><span class="tile__lbl">Durée moyenne</span></div>
      <div class="sideblock">
        <div class="sideblock__half blue">
          <span class="sideblock__side">BLEU</span>
          <span class="sideblock__wr">{{ stats.blue.winRate }}%</span>
          <span class="sideblock__g">{{ stats.blue.wins }}V / {{ stats.blue.games }}g</span>
        </div>
        <div class="sideblock__sep" />
        <div class="sideblock__half red">
          <span class="sideblock__side">ROUGE</span>
          <span class="sideblock__wr">{{ stats.red.winRate }}%</span>
          <span class="sideblock__g">{{ stats.red.wins }}V / {{ stats.red.games }}g</span>
        </div>
      </div>
    </div>

    <!-- Séries / BO -->
    <section class="panel">
      <div class="panel__head"><span class="eyebrow">Derniers scrims</span></div>

      <div v-if="loading" class="empty">Chargement…</div>
      <div v-else-if="!series.length" class="empty">
        <Swords :size="28" />
        <p>Aucun scrim sur les 30 derniers jours.</p>
        <span>Clique sur <strong>Synchroniser</strong> — l'import se fait pour toute la team.</span>
      </div>

      <div v-else class="series">
        <div v-for="s in series" :key="s.seriesId" class="bo">
          <div class="bo__top">
            <span class="bo__tag" :class="s.seriesWin ? 'win' : 'loss'">{{ boLabel(s.total) }}</span>
            <img v-if="s.opponentLogo" class="bo__logo" :src="logoUrl(s.opponentLogo)" alt="" />
            <span class="bo__opp">{{ s.opponent || 'Adversaire inconnu' }}</span>
            <span class="bo__score">{{ s.wins }} — {{ s.losses }}</span>
            <span class="bo__res" :class="s.seriesWin ? 'win' : 'loss'">{{ s.seriesWin ? 'VICTOIRE' : 'DÉFAITE' }}</span>
            <span class="bo__date">{{ fmtAgo(s.gameStart) }}</span>
            <button class="bo__edit" title="Éditer l'adversaire" @click="openEdit(s)"><Pencil :size="14" /></button>
          </div>

          <div class="bo__games">
            <button
              v-for="(m, i) in s.matches" :key="m.matchId"
              class="game" :class="m.win ? 'win' : 'loss'"
              @click="openGame(m.matchId, ourFocus(m))"
            >
              <div class="game__bar">
                <span class="game__n">G{{ i + 1 }}</span>
                <span class="game__side" :style="{ color: m.side === 100 ? '#3B82F6' : '#EF4444' }">
                  {{ m.side === 100 ? 'CÔTÉ BLEU' : 'CÔTÉ ROUGE' }}
                </span>
                <span class="game__res" :class="m.win ? 'win' : 'loss'">{{ m.win ? 'VICTOIRE' : 'DÉFAITE' }}</span>
                <span class="game__dur">{{ fmtDur(m.duration) }}</span>
              </div>
              <div class="teams">
                <div class="team">
                  <div v-for="(p, pi) in m.allies" :key="pi" class="slot" :class="{ rostered: p.userId }">
                    <img :src="champIcon(p.champion)" :alt="p.champion" />
                    <span class="slot__name">{{ p.username || p.name }}</span>
                    <span class="slot__kda">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
                  </div>
                </div>
                <span class="vs">VS</span>
                <div class="team enemy">
                  <div v-for="(p, pi) in m.enemies" :key="pi" class="slot">
                    <img :src="champIcon(p.champion)" :alt="p.champion" />
                    <span class="slot__name">{{ p.name }}</span>
                    <span class="slot__kda">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Modal édition BO -->
    <Teleport to="body">
      <div v-if="editing" class="modal-bg" @click.self="editing = null">
        <div class="modal">
          <div class="modal__head">
            <span>Éditer le BO</span>
            <button class="modal__close" @click="editing = null"><X :size="16" /></button>
          </div>
          <label class="hx-label">Nom de l'équipe adverse</label>
          <input v-model="form.opponent" class="hx-input" placeholder="ex. Team Adverse" />
          <label class="hx-label" style="margin-top:14px">Logo</label>
          <div class="logo-row">
            <div class="logo-prev">
              <img v-if="form.preview" :src="form.preview" alt="" />
              <span v-else>—</span>
            </div>
            <label class="hx-btn-ghost upload">
              <Upload :size="14" /> Choisir un logo
              <input type="file" accept="image/*" hidden @change="onFile" />
            </label>
          </div>
          <div class="modal__actions">
            <button class="hx-btn-ghost" @click="editing = null">Annuler</button>
            <button class="hx-btn-primary" :disabled="saving" @click="saveEdit">{{ saving ? '…' : 'Enregistrer' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
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

/* KPIs + bloc côté */
.stats { display: grid; grid-template-columns: repeat(3, 1fr) 1.5fr; gap: 12px; }
.tile { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.tile__val { font-family: 'Rajdhani', sans-serif; font-size: 28px; font-weight: 700; color: var(--t-primary); line-height: 1; }
.tile__lbl { font-size: 11px; color: var(--t-dim); text-transform: uppercase; letter-spacing: 1px; }
.sideblock { display: flex; align-items: stretch; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.sideblock__half { flex: 1; padding: 12px 16px; display: flex; flex-direction: column; gap: 2px; justify-content: center; }
.sideblock__half.blue { background: linear-gradient(90deg, rgba(59,130,246,.10), transparent); }
.sideblock__half.red  { background: linear-gradient(-90deg, rgba(239,68,68,.10), transparent); align-items: flex-end; text-align: right; }
.sideblock__sep { width: 1px; background: var(--border); }
.sideblock__side { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
.sideblock__half.blue .sideblock__side { color: #3B82F6; } .sideblock__half.red .sideblock__side { color: #EF4444; }
.sideblock__wr { font-family: 'Rajdhani', sans-serif; font-size: 24px; font-weight: 700; color: var(--t-primary); line-height: 1; }
.sideblock__g { font-size: 11px; color: var(--t-dim); }

.panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.panel__head { padding: 16px 18px; border-bottom: 1px solid var(--border); }
.eyebrow { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: var(--accent); text-transform: uppercase; }
.empty { padding: 48px 20px; text-align: center; color: var(--t-dim); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty p { color: var(--t-primary); font-weight: 600; }
.empty span { font-size: 13px; }

.series { padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.bo { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.bo__top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.bo__tag { font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: 1px; font-size: 12px; padding: 3px 8px; border-radius: 4px; }
.bo__tag.win { color: #10B981; background: rgba(16,185,129,.12); }
.bo__tag.loss { color: #EF4444; background: rgba(239,68,68,.12); }
.bo__logo { width: 24px; height: 24px; border-radius: 5px; object-fit: cover; }
.bo__opp { font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: .5px; color: var(--t-primary); }
.bo__score { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; color: var(--t-primary); }
.bo__res { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
.bo__res.win { color: #10B981; } .bo__res.loss { color: #EF4444; }
.bo__date { margin-left: auto; font-size: 12px; color: var(--t-dim); }
.bo__edit { background: transparent; border: 1px solid var(--border); color: var(--t-dim); border-radius: 6px; padding: 6px; cursor: pointer; display: flex; transition: all .15s; }
.bo__edit:hover { color: var(--accent); border-color: var(--accent); }

.bo__games { display: flex; flex-direction: column; gap: 10px; }
.game {
  display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 8px; cursor: pointer; width: 100%; text-align: left;
  background: var(--bg-card); border: 1px solid var(--border); border-left-width: 3px; font-family: inherit; transition: all .15s;
}
.game:hover { background: var(--bg-hover); }
.game.win { border-left-color: #10B981; } .game.loss { border-left-color: #EF4444; }
.game__bar { display: flex; align-items: center; gap: 10px; }
.game__n { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 12px; color: var(--t-dim); }
.game__side { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
.game__res { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 1px; }
.game__res.win { color: #10B981; } .game__res.loss { color: #EF4444; }
.game__dur { margin-left: auto; font-size: 12px; color: var(--t-dim); }

.teams { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.team { display: flex; gap: 10px; flex-wrap: wrap; flex: 1; }
.team.enemy { justify-content: flex-end; }
.slot { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 52px; }
.slot img { width: 34px; height: 34px; border-radius: 6px; border: 1px solid var(--border-2); }
.slot.rostered img { border-color: var(--accent); }
.slot__name { font-size: 9px; color: var(--t-dim); max-width: 52px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.slot__kda { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; color: var(--t-primary); }
.vs { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; color: var(--t-muted); }

/* Modal */
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px; }
.modal { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; width: 100%; max-width: 400px; }
.modal__head { display: flex; align-items: center; justify-content: space-between; font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: 1px; color: var(--t-primary); margin-bottom: 14px; }
.modal__close { background: transparent; border: none; color: var(--t-dim); cursor: pointer; display: flex; }
.logo-row { display: flex; align-items: center; gap: 12px; }
.logo-prev { width: 48px; height: 48px; border-radius: 8px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--t-muted); overflow: hidden; }
.logo-prev img { width: 100%; height: 100%; object-fit: cover; }
.upload { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; font-size: 13px; cursor: pointer; }
.modal__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.modal__actions .hx-btn-primary, .modal__actions .hx-btn-ghost { padding: 9px 18px; }

@media (max-width: 768px) { .stats { grid-template-columns: 1fr 1fr; } .sideblock { grid-column: 1 / -1; } }
</style>
