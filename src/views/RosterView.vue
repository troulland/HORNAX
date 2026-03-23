<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTeamStore } from '@/stores/team'
import type { Player, Role } from '@/types'

const team = useTeamStore()
const selectedPlayer = ref<Player | null>(null)

const ROLE_ORDER: Role[] = ['top', 'jgl', 'mid', 'adc', 'sup']

const starters = computed(() =>
  ROLE_ORDER.map(r => team.players.find(p => p.role === r && p.isStarter)!)
)
const subs = computed(() => team.players.filter(p => !p.isStarter))

interface RoleMeta { label: string; full: string; color: string; num: string }
const ROLE: Record<Role, RoleMeta> = {
  top: { label: 'TOP', full: 'Top Laner',  color: '#FBBF24', num: '01' },
  jgl: { label: 'JGL', full: 'Jungler',    color: '#34D399', num: '02' },
  mid: { label: 'MID', full: 'Mid Laner',  color: '#60A5FA', num: '03' },
  adc: { label: 'ADC', full: 'Bot Laner',  color: '#F87171', num: '04' },
  sup: { label: 'SUP', full: 'Support',    color: '#C084FC', num: '05' },
  sub: { label: 'SUB', full: 'Substitute', color: '#8892B0', num: '06' },
}

function kdaColor(v: number) { return v >= 5 ? '#10B981' : v >= 3.5 ? 'var(--accent)' : '#8892B0' }
function wrColor(v: number)  { return v >= 65 ? '#10B981' : v >= 55 ? 'var(--accent)' : '#EF4444' }
function select(p: Player) {
  selectedPlayer.value = selectedPlayer.value?.id === p.id ? null : p
}

const wins = computed(() => Math.round(team.teamStats.totalGames * team.teamStats.winRate / 100))
const losses = computed(() => team.teamStats.totalGames - wins.value)
</script>

<template>
  <div class="roster">

    <!-- ── HEADER ── -->
    <header class="roster__hdr">
      <div>
        <span class="roster__hdr-eye">SAISON 2026 · SPRING SPLIT · LINEUP ACTIF</span>
        <h1 class="roster__hdr-title">ROSTER</h1>
      </div>
      <div class="roster__record">
        <div class="rec-block">
          <span class="rec-val" style="color:#EEF2FF">{{ team.teamStats.totalGames }}</span>
          <span class="rec-lbl">GAP</span>
        </div>
        <div class="rec-sep" />
        <div class="rec-block">
          <span class="rec-val" style="color:#10B981">{{ wins }}</span>
          <span class="rec-lbl">WIN</span>
        </div>
        <div class="rec-sep" />
        <div class="rec-block">
          <span class="rec-val" style="color:#EF4444">{{ losses }}</span>
          <span class="rec-lbl">LOSS</span>
        </div>
        <div class="rec-wr">{{ team.teamStats.winRate }}% WR</div>
      </div>
    </header>

    <!-- ── LINEUP ── -->
    <div class="lineup">
      <article
        v-for="(player, idx) in starters"
        :key="player.id"
        class="lcard"
        :class="{ 'lcard--active': selectedPlayer?.id === player.id }"
        :style="{ '--c': ROLE[player.role].color, animationDelay: `${idx * 0.08}s` }"
        @click="select(player)"
      >
        <div class="lcard__bar" />
        <!-- HUD corners -->
        <span class="lcard__corner lcard__corner--tl" />
        <span class="lcard__corner lcard__corner--tr" />
        <span class="lcard__corner lcard__corner--bl" />
        <span class="lcard__corner lcard__corner--br" />
        <!-- scan line -->
        <div class="lcard__scan" />
        <!-- character art -->
        <img v-if="player.avatar" :src="player.avatar" class="lcard__char" alt="" />
        <!-- ghost text -->
        <div class="lcard__ghost">{{ ROLE[player.role].label }}</div>

        <div class="lcard__meta" style="position:relative;z-index:2">
          <span class="lcard__num">{{ ROLE[player.role].num }}</span>
          <span class="lcard__role-badge">{{ ROLE[player.role].label }}</span>
        </div>

        <div class="lcard__identity" style="position:relative;z-index:2">
          <span class="lcard__ign">{{ player.ign }}</span>
          <span class="lcard__role-full">{{ ROLE[player.role].full }}</span>
        </div>

        <div class="lcard__champs" style="position:relative;z-index:2">
          <span v-for="c in player.stats.mostPlayedChamps.slice(0,3)" :key="c" class="lcard__champ">{{ c }}</span>
        </div>

        <div class="lcard__stats" style="position:relative;z-index:2">
          <div class="lcard__stat">
            <span class="lcard__stat-v" :style="{ color: kdaColor(player.stats.kda) }">{{ player.stats.kda }}</span>
            <span class="lcard__stat-l">KDA</span>
          </div>
          <div class="lcard__stat-sep" />
          <div class="lcard__stat">
            <span class="lcard__stat-v" :style="{ color: wrColor(player.stats.winRate) }">{{ player.stats.winRate }}%</span>
            <span class="lcard__stat-l">WIN</span>
          </div>
          <div class="lcard__stat-sep" />
          <div class="lcard__stat">
            <span class="lcard__stat-v" style="color:#8892B0">{{ player.stats.gamesPlayed }}</span>
            <span class="lcard__stat-l">GAP</span>
          </div>
        </div>

        <div class="lcard__foot" style="position:relative;z-index:2">
          <div class="lcard__status">
            <span class="lcard__dot" :class="`dot--${player.status}`" />
            <span class="lcard__status-txt">{{ player.status === 'available' ? 'DISPONIBLE' : player.status === 'unavailable' ? 'INDISPONIBLE' : 'INCERTAIN' }}</span>
          </div>
          <div class="lcard__loadbar"><div class="lcard__loadfill" /></div>
        </div>
      </article>
    </div>

    <!-- ── DETAIL PANEL ── -->
    <Transition name="detail">
      <div v-if="selectedPlayer" class="detail" :style="{ '--c': ROLE[selectedPlayer.role].color }">
        <div class="detail__inner">
          <div class="detail__head">
            <div>
              <span class="detail__role">{{ ROLE[selectedPlayer.role].full.toUpperCase() }}</span>
              <h2 class="detail__ign">{{ selectedPlayer.ign }}</h2>
            </div>
            <button class="detail__close" @click="selectedPlayer = null">✕</button>
          </div>

          <div class="detail__tiles">
            <div class="dtile"><span class="dtile__v" :style="{ color: kdaColor(selectedPlayer.stats.kda) }">{{ selectedPlayer.stats.kda }}</span><span class="dtile__l">KDA</span></div>
            <div class="dtile"><span class="dtile__v" :style="{ color: wrColor(selectedPlayer.stats.winRate) }">{{ selectedPlayer.stats.winRate }}%</span><span class="dtile__l">Win Rate</span></div>
            <div class="dtile"><span class="dtile__v" style="color:#10B981">{{ selectedPlayer.stats.avgKills }}</span><span class="dtile__l">Avg K</span></div>
            <div class="dtile"><span class="dtile__v" style="color:#EF4444">{{ selectedPlayer.stats.avgDeaths }}</span><span class="dtile__l">Avg D</span></div>
            <div class="dtile"><span class="dtile__v" style="color:#60A5FA">{{ selectedPlayer.stats.avgAssists }}</span><span class="dtile__l">Avg A</span></div>
            <div class="dtile"><span class="dtile__v" style="color:#8892B0">{{ selectedPlayer.stats.gamesPlayed }}</span><span class="dtile__l">Games</span></div>
          </div>

          <div class="detail__bars">
            <div class="dbar">
              <span class="dbar__l">Kills</span>
              <div class="dbar__track"><div class="dbar__fill" style="background:#10B981" :style="{ width: `${Math.min(selectedPlayer.stats.avgKills/10*100,100)}%` }" /></div>
              <span class="dbar__v" style="color:#10B981">{{ selectedPlayer.stats.avgKills }}</span>
            </div>
            <div class="dbar">
              <span class="dbar__l">Deaths</span>
              <div class="dbar__track"><div class="dbar__fill" style="background:#EF4444" :style="{ width: `${Math.min(selectedPlayer.stats.avgDeaths/10*100,100)}%` }" /></div>
              <span class="dbar__v" style="color:#EF4444">{{ selectedPlayer.stats.avgDeaths }}</span>
            </div>
            <div class="dbar">
              <span class="dbar__l">Assists</span>
              <div class="dbar__track"><div class="dbar__fill" style="background:#60A5FA" :style="{ width: `${Math.min(selectedPlayer.stats.avgAssists/15*100,100)}%` }" /></div>
              <span class="dbar__v" style="color:#60A5FA">{{ selectedPlayer.stats.avgAssists }}</span>
            </div>
          </div>

          <div>
            <span class="detail__sect-lbl">CHAMPION POOL</span>
            <div class="detail__champs">
              <span v-for="c in selectedPlayer.stats.mostPlayedChamps" :key="c" class="detail__champ-pill">{{ c }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── SUBSTITUTES ── -->
    <div class="subs">
      <span class="subs__lbl">SUBSTITUTS</span>
      <div class="subs__list">
        <div v-for="p in subs" :key="p.id" class="scard" :style="{ '--c': ROLE[p.role].color }">
          <span class="scard__corner scard__corner--tl" />
          <span class="scard__corner scard__corner--tr" />
          <div class="scard__role">{{ ROLE[p.role].label }}</div>
          <div class="scard__ign">{{ p.ign }}</div>
          <div class="scard__stats">
            <span :style="{ color: kdaColor(p.stats.kda) }">{{ p.stats.kda }} KDA</span>
            <span style="color:#3D4460">·</span>
            <span :style="{ color: wrColor(p.stats.winRate) }">{{ p.stats.winRate }}%</span>
          </div>
          <div class="scard__champs">
            <span v-for="c in p.stats.mostPlayedChamps.slice(0,3)" :key="c">{{ c }}</span>
          </div>
          <span class="scard__dot dot--available" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.roster { display: flex; flex-direction: column; gap: 20px; animation: pageIn .4s ease-out both; }

/* header */
.roster__hdr { display: flex; align-items: flex-end; justify-content: space-between; }
.roster__hdr-eye { display: block; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 4px; color: var(--accent); margin-bottom: 4px; }
.roster__hdr-title { font-family: 'Rajdhani', sans-serif; font-size: 30px; font-weight: 700; letter-spacing: 4px; color: #EEF2FF; margin: 0; }
.roster__record { display: flex; align-items: center; gap: 4px; background: #111520; border: 1px solid #1A1F2E; border-radius: 8px; padding: 10px 18px; }
.rec-block { display: flex; flex-direction: column; align-items: center; padding: 0 10px; }
.rec-val { font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; line-height: 1; }
.rec-lbl { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; letter-spacing: 2px; }
.rec-sep { width: 1px; height: 28px; background: #1A1F2E; }
.rec-wr { margin-left: 12px; font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 2px; color: #10B981; background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.25); border-radius: 20px; padding: 4px 12px; }

/* lineup */
.lineup { display: flex; gap: 6px; height: 380px; }

.lcard {
  flex: 1; position: relative;
  background: linear-gradient(160deg, color-mix(in srgb, var(--c) 6%, transparent) 0%, #0A0C13 45%);
  border: 1px solid rgba(255,255,255,.04); border-left: 3px solid var(--c); border-radius: 4px;
  display: flex; flex-direction: column; cursor: pointer; overflow: hidden;
  animation: cardIn .5s ease-out both;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.lcard:hover {
  transform: translateY(-6px) scale(1.01);
  border-color: var(--c);
  box-shadow: 0 12px 40px rgba(0,0,0,.5), 0 0 28px color-mix(in srgb, var(--c) 18%, transparent);
  z-index: 2;
}
.lcard--active { border-color: var(--c) !important; box-shadow: 0 0 24px color-mix(in srgb, var(--c) 22%, transparent) !important; }

.lcard__bar { height: 3px; background: var(--c); box-shadow: 0 0 10px var(--c); flex-shrink: 0; }

.lcard__corner { position: absolute; width: 10px; height: 10px; border-color: var(--c); border-style: solid; opacity: .55; }
.lcard__corner--tl { top: 6px; left: 5px; border-width: 1px 0 0 1px; }
.lcard__corner--tr { top: 6px; right: 5px; border-width: 1px 1px 0 0; }
.lcard__corner--bl { bottom: 6px; left: 5px; border-width: 0 0 1px 1px; }
.lcard__corner--br { bottom: 6px; right: 5px; border-width: 0 1px 1px 0; }

.lcard__scan {
  position: absolute; inset: 0; pointer-events: none; opacity: 0;
  background: linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--c) 8%, transparent) 50%, transparent 100%);
  height: 40%; transition: opacity .2s;
}
.lcard:hover .lcard__scan { opacity: 1; animation: scan 1.8s ease-in-out infinite; }

.lcard__char {
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  height: 72%; width: auto; object-fit: contain; object-position: bottom center;
  opacity: .18; pointer-events: none; user-select: none; z-index: 1;
  filter: saturate(.5) brightness(1.3);
  -webkit-mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,.6) 30%, rgba(0,0,0,1) 80%);
  mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,.6) 30%, rgba(0,0,0,1) 80%);
}

.lcard__ghost {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  font-family: 'Rajdhani', sans-serif; font-size: 110px; font-weight: 900;
  color: var(--c); opacity: .045; user-select: none; pointer-events: none; letter-spacing: -4px; white-space: nowrap;
  z-index: 1;
}

.lcard__meta { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px 0; }
.lcard__num { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; color: #3D4460; letter-spacing: 2px; }
.lcard__role-badge {
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px;
  color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 25%, transparent); border-radius: 3px; padding: 2px 7px;
}

.lcard__identity { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 14px 8px; }
.lcard__ign { font-family: 'Rajdhani', sans-serif; font-size: 24px; font-weight: 700; letter-spacing: 2px; color: #EEF2FF; display: block; line-height: 1.1; }
.lcard__role-full { font-family: 'Inter', sans-serif; font-size: 10px; color: var(--c); opacity: .8; display: block; margin-top: 2px; }

.lcard__champs { padding: 6px 14px; display: flex; flex-direction: column; gap: 2px; }
.lcard__champ { font-family: 'Inter', sans-serif; font-size: 10px; color: #8892B0; line-height: 1.4; }
.lcard__champ::before { content: '▸ '; color: var(--c); opacity: .5; }

.lcard__stats { display: flex; align-items: center; padding: 7px 14px; border-top: 1px solid rgba(255,255,255,.04); }
.lcard__stat { flex: 1; display: flex; flex-direction: column; align-items: center; }
.lcard__stat-v { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; line-height: 1.2; }
.lcard__stat-l { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; letter-spacing: 1px; }
.lcard__stat-sep { width: 1px; height: 22px; background: rgba(255,255,255,.06); }

.lcard__foot { padding: 7px 14px 10px; }
.lcard__status { display: flex; align-items: center; gap: 5px; margin-bottom: 6px; }
.lcard__dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.lcard__status-txt { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 1.5px; color: #3D4460; }
.lcard__loadbar { height: 2px; background: rgba(255,255,255,.05); border-radius: 1px; overflow: hidden; }
.lcard__loadfill { height: 100%; width: 100%; background: var(--c); box-shadow: 0 0 6px var(--c); }

.dot--available   { background: #10B981; box-shadow: 0 0 5px rgba(16,185,129,.7); }
.dot--unavailable { background: #EF4444; }
.dot--uncertain   { background: #F59E0B; }

/* detail */
.detail { background: #0D1018; border: 1px solid rgba(255,255,255,.06); border-left: 3px solid var(--c); border-radius: 6px; }
.detail__inner { padding: 20px; }
.detail__head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,.05); }
.detail__role { display: block; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 3px; color: var(--c); margin-bottom: 3px; }
.detail__ign { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: 3px; color: #EEF2FF; margin: 0; }
.detail__close { background: none; border: none; color: #3D4460; font-size: 15px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: color .15s; }
.detail__close:hover { color: #EEF2FF; }
.detail__tiles { display: grid; grid-template-columns: repeat(6,1fr); gap: 8px; margin-bottom: 16px; }
.dtile { display: flex; flex-direction: column; align-items: center; padding: 10px 4px; background: #111520; border: 1px solid #1A1F2E; border-radius: 6px; }
.dtile__v { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; }
.dtile__l { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; margin-top: 2px; }
.detail__bars { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.dbar { display: flex; align-items: center; gap: 10px; }
.dbar__l { font-family: 'Inter', sans-serif; font-size: 11px; color: #8892B0; width: 50px; flex-shrink: 0; }
.dbar__track { flex: 1; height: 4px; background: #1A1F2E; border-radius: 2px; overflow: hidden; }
.dbar__fill { height: 100%; border-radius: 2px; transition: width .8s ease; }
.dbar__v { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; width: 28px; text-align: right; flex-shrink: 0; }
.detail__sect-lbl { display: block; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 3px; color: #3D4460; margin-bottom: 8px; }
.detail__champs { display: flex; gap: 6px; flex-wrap: wrap; }
.detail__champ-pill { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 1px; color: var(--c); background: color-mix(in srgb, var(--c) 10%, transparent); border: 1px solid color-mix(in srgb, var(--c) 25%, transparent); padding: 4px 12px; border-radius: 20px; }

.detail-enter-active { transition: all .3s ease; }
.detail-leave-active { transition: all .2s ease; }
.detail-enter-from { opacity: 0; transform: translateY(-8px); }
.detail-leave-to   { opacity: 0; transform: translateY(-4px); }

/* subs */
.subs__lbl { display: block; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 4px; color: #3D4460; margin-bottom: 10px; }
.subs__list { display: flex; gap: 10px; }
.scard { flex: 0 0 auto; min-width: 260px; background: #0D1018; border: 1px solid rgba(255,255,255,.04); border-left: 2px solid var(--c); border-radius: 6px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; position: relative; overflow: hidden; transition: border-color .2s; }
.scard:hover { border-color: var(--c); }
.scard__corner { position: absolute; width: 8px; height: 8px; border-color: var(--c); border-style: solid; opacity: .4; }
.scard__corner--tl { top: 4px; left: 3px; border-width: 1px 0 0 1px; }
.scard__corner--tr { top: 4px; right: 3px; border-width: 1px 1px 0 0; }
.scard__role { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); padding: 3px 8px; border-radius: 4px; flex-shrink: 0; }
.scard__ign { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 2px; color: #EEF2FF; flex: 1; }
.scard__stats { display: flex; gap: 6px; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; }
.scard__champs { display: flex; gap: 4px; font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; }
.scard__champs span { background: #111520; padding: 1px 5px; border-radius: 3px; }
.scard__dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

@keyframes pageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cardIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(300%); } }
</style>
