<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { API_BASE } from '@/config'
import { X } from 'lucide-vue-next'

const props = defineProps<{ userId: number; username: string; role: string }>()
const emit  = defineEmits<{ (e: 'close'): void }>()

const auth    = useAuthStore()
const loading = ref(true)
const profile = ref<any>(null)

const ROLE_COLOR: Record<string, string> = {
  top: '#FBBF24', jgl: '#34D399', mid: '#60A5FA',
  adc: '#F87171', sup: '#C084FC', sub: '#8892B0',
}
const TIER_COLOR: Record<string, string> = {
  IRON: '#7A6651', BRONZE: '#A0734A', SILVER: '#8892B0',
  GOLD: '#FBBF24', PLATINUM: '#4ADE80', EMERALD: '#10B981',
  DIAMOND: '#60A5FA', MASTER: '#C084FC', GRANDMASTER: '#F87171', CHALLENGER: '#FBBF24',
}
const TIER_BG: Record<string, string> = {
  IRON: 'rgba(122,102,81,.12)', BRONZE: 'rgba(160,115,74,.12)', SILVER: 'rgba(136,146,176,.1)',
  GOLD: 'rgba(251,191,36,.1)', PLATINUM: 'rgba(74,222,128,.1)', EMERALD: 'rgba(16,185,129,.1)',
  DIAMOND: 'rgba(96,165,250,.1)', MASTER: 'rgba(192,132,252,.1)',
  GRANDMASTER: 'rgba(248,113,113,.1)', CHALLENGER: 'rgba(251,191,36,.12)',
}
const CHAMP_SPECIAL: Record<string, string> = {
  "Nunu & Willump": "Nunu", "Renata Glasc": "Renata",
  "K'Sante": "KSante", "Bel'Veth": "Belveth", "Wukong": "MonkeyKing",
}

function champIcon(name: string) {
  const ddv = profile.value?.riot_stats?.ddVersion ?? '15.6.1'
  return `https://ddragon.leagueoflegends.com/cdn/${ddv}/img/champion/${CHAMP_SPECIAL[name] ?? name}.png`
}

function rankLabel(q: any): string {
  if (!q) return 'Unranked'
  const noDiv = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(q.tier)
  return noDiv ? q.tier : `${q.tier} ${q.rank}`
}

function kdaColor(v: string | number): string {
  const n = parseFloat(String(v))
  return n >= 4 ? '#10B981' : n >= 2.5 ? 'var(--accent)' : n >= 1.5 ? '#EEF2FF' : '#EF4444'
}
function wrColor(v: number): string {
  return v >= 60 ? '#10B981' : v >= 50 ? '#FBBF24' : '#EF4444'
}
function wrBarStyle(wins: number, losses: number) {
  const total = wins + losses
  if (!total) return { wins: '50%', losses: '50%' }
  return { wins: `${Math.round(wins / total * 100)}%`, losses: `${Math.round(losses / total * 100)}%` }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE}/players/${props.userId}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) profile.value = await res.json()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="ppm-backdrop" @click.self="emit('close')">
      <div class="ppm" :style="{ '--rc': ROLE_COLOR[role] ?? '#8892B0' }">

        <!-- ── HEADER ── -->
        <div class="ppm__header">
          <div class="ppm__header-left">
            <div class="ppm__role-pill">{{ role.toUpperCase() }}</div>
            <div class="ppm__identity">
              <span class="ppm__name">{{ username }}</span>
              <span v-if="profile?.riot_stats" class="ppm__riot-tag">
                {{ profile.riot_stats.gameName }}<span class="ppm__tag-sep">#</span>{{ profile.riot_stats.tagLine }}
                <span class="ppm__level">Lvl {{ profile.riot_stats.summonerLevel }}</span>
              </span>
              <span v-else-if="!loading" class="ppm__riot-tag ppm__riot-tag--none">Aucun Riot ID</span>
            </div>
          </div>
          <button class="ppm__close" @click="emit('close')"><X :size="15" /></button>
        </div>

        <!-- ── LOADING ── -->
        <div v-if="loading" class="ppm__loader">
          <div class="ppm__loader-bar" />
        </div>

        <!-- ── NO RIOT ID ── -->
        <div v-else-if="!profile?.riot_id" class="ppm__empty">
          <span class="ppm__empty-icon">⚔</span>
          <span>Ce joueur n'a pas configuré son Riot ID.</span>
          <span class="ppm__empty-sub">Il peut l'ajouter dans son profil.</span>
        </div>

        <!-- ── RIOT ERROR ── -->
        <div v-else-if="profile?.riot_error && !profile?.riot_stats" class="ppm__empty ppm__empty--err">
          <span class="ppm__empty-icon">!</span>
          <span>{{ profile.riot_error }}</span>
        </div>

        <!-- ── STATS ── -->
        <template v-else-if="profile?.riot_stats">

          <!-- Ranks row -->
          <div class="ppm__ranks">
            <!-- Solo/Duo -->
            <div class="ppm__rank"
              :style="profile.riot_stats.soloQ ? { background: TIER_BG[profile.riot_stats.soloQ.tier], borderColor: TIER_COLOR[profile.riot_stats.soloQ.tier] + '33' } : {}">
              <span class="ppm__rank-mode">SOLO / DUO</span>
              <template v-if="profile.riot_stats.soloQ">
                <span class="ppm__rank-tier" :style="{ color: TIER_COLOR[profile.riot_stats.soloQ.tier] }">
                  {{ rankLabel(profile.riot_stats.soloQ) }}
                </span>
                <span class="ppm__rank-lp">{{ profile.riot_stats.soloQ.lp }} LP</span>
                <div class="ppm__rank-bar">
                  <div class="ppm__rank-bar-win"  :style="{ width: wrBarStyle(profile.riot_stats.soloQ.wins, profile.riot_stats.soloQ.losses).wins }" />
                  <div class="ppm__rank-bar-loss" :style="{ width: wrBarStyle(profile.riot_stats.soloQ.wins, profile.riot_stats.soloQ.losses).losses }" />
                </div>
                <div class="ppm__rank-record">
                  <span style="color:#10B981">{{ profile.riot_stats.soloQ.wins }}V</span>
                  <span style="color:#EF4444">{{ profile.riot_stats.soloQ.losses }}D</span>
                  <span :style="{ color: wrColor(profile.riot_stats.soloQ.winRate) }" class="ppm__rank-wr">
                    {{ profile.riot_stats.soloQ.winRate }}% WR
                  </span>
                </div>
              </template>
              <span v-else class="ppm__rank-unranked">Unranked</span>
            </div>

            <!-- Flex -->
            <div class="ppm__rank"
              :style="profile.riot_stats.flexQ ? { background: TIER_BG[profile.riot_stats.flexQ.tier], borderColor: TIER_COLOR[profile.riot_stats.flexQ.tier] + '33' } : {}">
              <span class="ppm__rank-mode">FLEX</span>
              <template v-if="profile.riot_stats.flexQ">
                <span class="ppm__rank-tier" :style="{ color: TIER_COLOR[profile.riot_stats.flexQ.tier] }">
                  {{ rankLabel(profile.riot_stats.flexQ) }}
                </span>
                <span class="ppm__rank-lp">{{ profile.riot_stats.flexQ.lp }} LP</span>
                <div class="ppm__rank-bar">
                  <div class="ppm__rank-bar-win"  :style="{ width: wrBarStyle(profile.riot_stats.flexQ.wins, profile.riot_stats.flexQ.losses).wins }" />
                  <div class="ppm__rank-bar-loss" :style="{ width: wrBarStyle(profile.riot_stats.flexQ.wins, profile.riot_stats.flexQ.losses).losses }" />
                </div>
                <div class="ppm__rank-record">
                  <span style="color:#10B981">{{ profile.riot_stats.flexQ.wins }}V</span>
                  <span style="color:#EF4444">{{ profile.riot_stats.flexQ.losses }}D</span>
                  <span :style="{ color: wrColor(profile.riot_stats.flexQ.winRate) }" class="ppm__rank-wr">
                    {{ profile.riot_stats.flexQ.winRate }}% WR
                  </span>
                </div>
              </template>
              <span v-else class="ppm__rank-unranked">Unranked</span>
            </div>
          </div>

          <!-- Champion pool -->
          <div v-if="profile.riot_stats.champPool.length" class="ppm__section">
            <div class="ppm__section-head">
              <span class="ppm__section-title">CHAMPION POOL</span>
              <span class="ppm__section-sub">Sur les 10 dernières parties</span>
            </div>
            <div class="ppm__champs">
              <div v-for="(c, i) in profile.riot_stats.champPool" :key="c.name" class="ppm__champ">
                <div class="ppm__champ-rank">{{ i + 1 }}</div>
                <div class="ppm__champ-portrait">
                  <img :src="champIcon(c.name)" :alt="c.name"
                    @error="($event.target as HTMLImageElement).src='/logo.png'" />
                </div>
                <div class="ppm__champ-info">
                  <span class="ppm__champ-name">{{ c.name }}</span>
                  <span class="ppm__champ-games">{{ c.games }} partie{{ c.games > 1 ? 's' : '' }}</span>
                </div>
                <div class="ppm__champ-stats">
                  <span class="ppm__champ-wr" :style="{ color: wrColor(c.winRate) }">{{ c.winRate }}%</span>
                  <span class="ppm__champ-wr-label">WR</span>
                </div>
                <div class="ppm__champ-kda-wrap">
                  <span class="ppm__champ-kda" :style="{ color: kdaColor(c.kda) }">{{ c.kda }}</span>
                  <span class="ppm__champ-kda-label">KDA</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent games -->
          <div v-if="profile.riot_stats.recentGames.length" class="ppm__section ppm__section--last">
            <div class="ppm__section-head">
              <span class="ppm__section-title">PARTIES RÉCENTES</span>
              <span class="ppm__section-sub">10 dernières</span>
            </div>

            <!-- W/L summary bar -->
            <div class="ppm__wl-summary">
              <span class="ppm__wl-wins">{{ profile.riot_stats.recentGames.filter((g: any) => g.win).length }}V</span>
              <div class="ppm__wl-bar">
                <div class="ppm__wl-bar-fill"
                  :style="{ width: `${profile.riot_stats.recentGames.filter((g: any) => g.win).length * 10}%` }" />
              </div>
              <span class="ppm__wl-losses">{{ profile.riot_stats.recentGames.filter((g: any) => !g.win).length }}D</span>
            </div>

            <div class="ppm__games">
              <div v-for="g in profile.riot_stats.recentGames" :key="g.matchId"
                class="ppm__game" :class="g.win ? 'ppm__game--win' : 'ppm__game--loss'">
                <!-- Result bar + champ -->
                <div class="ppm__game-left">
                  <div class="ppm__game-result" :class="g.win ? 'ppm__game-result--win' : 'ppm__game-result--loss'">
                    {{ g.win ? 'V' : 'D' }}
                  </div>
                  <div class="ppm__game-champ-wrap">
                    <img :src="champIcon(g.champion)" :alt="g.champion" class="ppm__game-img"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                  </div>
                  <div class="ppm__game-champ-info">
                    <span class="ppm__game-champ">{{ g.champion }}</span>
                    <span class="ppm__game-queue">{{ g.queueLabel }}</span>
                  </div>
                </div>
                <!-- KDA -->
                <div class="ppm__game-kda">
                  <span class="ppm__game-score">{{ g.kills }} / <span style="color:#EF4444">{{ g.deaths }}</span> / {{ g.assists }}</span>
                  <span class="ppm__game-ratio" :style="{ color: kdaColor(g.kda) }">{{ g.kda }} KDA</span>
                </div>
                <!-- Meta -->
                <div class="ppm__game-meta">
                  <span class="ppm__game-cs">{{ g.cs }} CS <span style="color:#3D4460">({{ g.csMin }}/min)</span></span>
                  <span class="ppm__game-dur">{{ g.duration }}min · {{ fmtDate(g.date) }}</span>
                </div>
              </div>
            </div>
          </div>

        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop ── */
.ppm-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(5, 7, 15, .75); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}

/* ── Panel ── */
.ppm {
  width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto;
  background: #0A0D18;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  display: flex; flex-direction: column;
  animation: slideUp .2s ease-out both;
  scrollbar-width: thin; scrollbar-color: #1A1F2E transparent;
}

/* ── Header ── */
.ppm__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,.06);
  background: linear-gradient(135deg, color-mix(in srgb, var(--rc) 8%, transparent), transparent 60%);
  border-radius: 12px 12px 0 0;
}
.ppm__header-left { display: flex; align-items: center; gap: 14px; }
.ppm__role-pill {
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2px;
  color: var(--rc); border: 1px solid color-mix(in srgb, var(--rc) 35%, transparent);
  background: color-mix(in srgb, var(--rc) 10%, transparent);
  border-radius: 6px; padding: 5px 10px; flex-shrink: 0;
}
.ppm__identity { display: flex; flex-direction: column; gap: 2px; }
.ppm__name {
  font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700;
  letter-spacing: 2px; color: #EEF2FF; line-height: 1.1;
}
.ppm__riot-tag {
  font-family: 'Inter', sans-serif; font-size: 11px; color: #8892B0;
  display: flex; align-items: center; gap: 5px;
}
.ppm__riot-tag--none { color: #3D4460; font-style: italic; }
.ppm__tag-sep { color: #3D4460; }
.ppm__level {
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px;
  color: #3D4460; background: #111520; border: 1px solid #1A1F2E;
  border-radius: 4px; padding: 1px 6px;
}
.ppm__close {
  background: #111520; border: 1px solid #1A1F2E; color: #8892B0;
  width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.ppm__close:hover { border-color: #EF4444; color: #EF4444; }

/* ── Loader ── */
.ppm__loader { height: 3px; background: #111520; overflow: hidden; }
.ppm__loader-bar {
  height: 100%; width: 40%; background: var(--accent);
  animation: loading 1.2s ease-in-out infinite;
}
@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }

/* ── Empty ── */
.ppm__empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 48px 24px; text-align: center;
  font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 1px; color: #3D4460;
}
.ppm__empty--err { color: #EF4444; }
.ppm__empty-icon { font-size: 28px; opacity: .4; }
.ppm__empty-sub { font-family: 'Inter', sans-serif; font-size: 11px; color: #2A3050; font-weight: 400; letter-spacing: 0; }

/* ── Ranks ── */
.ppm__ranks { display: flex; gap: 10px; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,.05); }
.ppm__rank {
  flex: 1; background: #111520; border: 1px solid #1A1F2E; border-radius: 10px;
  padding: 14px 16px; display: flex; flex-direction: column; gap: 5px;
  transition: border-color .2s;
}
.ppm__rank-mode {
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 2.5px; color: #3D4460; margin-bottom: 2px;
}
.ppm__rank-tier {
  font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700;
  letter-spacing: 1px; line-height: 1;
}
.ppm__rank-lp {
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700;
  color: #8892B0; letter-spacing: 1px;
}
.ppm__rank-bar {
  height: 4px; border-radius: 2px; overflow: hidden;
  background: #1A1F2E; display: flex; margin: 2px 0;
}
.ppm__rank-bar-win  { height: 100%; background: #10B981; transition: width .6s ease; }
.ppm__rank-bar-loss { height: 100%; background: #EF4444; transition: width .6s ease; }
.ppm__rank-record {
  display: flex; align-items: center; gap: 8px;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700;
}
.ppm__rank-wr { margin-left: auto; }
.ppm__rank-unranked {
  font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 600;
  color: #2A3050; letter-spacing: 1px; padding: 8px 0;
}

/* ── Section ── */
.ppm__section { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,.05); }
.ppm__section--last { border-bottom: none; }
.ppm__section-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.ppm__section-title {
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 3px; color: #3D4460;
}
.ppm__section-sub { font-family: 'Inter', sans-serif; font-size: 10px; color: #2A3050; }

/* ── Champion pool ── */
.ppm__champs { display: flex; flex-direction: column; gap: 5px; }
.ppm__champ {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px; background: #111520; border: 1px solid #1A1F2E;
  border-radius: 8px; transition: border-color .15s;
}
.ppm__champ:hover { border-color: #2A2F42; }
.ppm__champ-rank {
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700;
  color: #2A3050; width: 14px; text-align: center; flex-shrink: 0;
}
.ppm__champ-portrait {
  width: 40px; height: 40px; border-radius: 8px; overflow: hidden;
  border: 1px solid #1A1F2E; flex-shrink: 0;
}
.ppm__champ-portrait img { width: 100%; height: 100%; object-fit: cover; }
.ppm__champ-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ppm__champ-name {
  font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700;
  color: #EEF2FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ppm__champ-games { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }
.ppm__champ-stats { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 44px; }
.ppm__champ-wr { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; line-height: 1; }
.ppm__champ-wr-label { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; }
.ppm__champ-kda-wrap { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 44px; }
.ppm__champ-kda { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; line-height: 1; }
.ppm__champ-kda-label { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; }

/* ── W/L summary ── */
.ppm__wl-summary { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.ppm__wl-wins  { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #10B981; width: 26px; }
.ppm__wl-losses { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #EF4444; width: 26px; text-align: right; }
.ppm__wl-bar { flex: 1; height: 5px; background: rgba(239,68,68,.25); border-radius: 3px; overflow: hidden; }
.ppm__wl-bar-fill { height: 100%; background: #10B981; border-radius: 3px; transition: width .6s ease; }

/* ── Recent games ── */
.ppm__games { display: flex; flex-direction: column; gap: 4px; }
.ppm__game {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 10px; border-radius: 8px; border-left: 3px solid transparent;
  background: #111520; border: 1px solid #1A1F2E; border-left: 3px solid transparent;
  transition: background .1s;
}
.ppm__game:hover { background: #131828; }
.ppm__game--win  { border-left-color: #10B981 !important; }
.ppm__game--loss { border-left-color: #EF4444 !important; }

.ppm__game-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.ppm__game-result {
  width: 22px; height: 22px; border-radius: 5px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700;
}
.ppm__game-result--win  { background: rgba(16,185,129,.15); color: #10B981; border: 1px solid rgba(16,185,129,.3); }
.ppm__game-result--loss { background: rgba(239,68,68,.15);  color: #EF4444; border: 1px solid rgba(239,68,68,.3); }

.ppm__game-champ-wrap { position: relative; flex-shrink: 0; }
.ppm__game-img { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; border: 1px solid #1A1F2E; display: block; }
.ppm__game-champ-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ppm__game-champ {
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700;
  color: #EEF2FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ppm__game-queue {
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 1.5px; color: #3D4460;
}
.ppm__game-kda { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; min-width: 100px; }
.ppm__game-score { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #EEF2FF; }
.ppm__game-ratio { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; }
.ppm__game-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; min-width: 90px; }
.ppm__game-cs { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600; color: #8892B0; }
.ppm__game-dur { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }

/* ── Light theme ── */
html[data-theme="light"] .ppm { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .ppm__header { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .ppm__name { color: #0D1220; }
html[data-theme="light"] .ppm__rank { background: #F7F8FC; border-color: #E0E3EF; }
html[data-theme="light"] .ppm__rank-lp { color: #4A5280; }
html[data-theme="light"] .ppm__rank-bar { background: #E0E3EF; }
html[data-theme="light"] .ppm__section { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .ppm__champ { background: #F7F8FC; border-color: #E0E3EF; }
html[data-theme="light"] .ppm__champ:hover { border-color: #C8CDDF; }
html[data-theme="light"] .ppm__champ-portrait { border-color: #E0E3EF; }
html[data-theme="light"] .ppm__champ-name { color: #0D1220; }
html[data-theme="light"] .ppm__game { background: #F7F8FC; border-color: #E0E3EF; }
html[data-theme="light"] .ppm__game:hover { background: #EEF0F8; }
html[data-theme="light"] .ppm__game-champ { color: #0D1220; }
html[data-theme="light"] .ppm__game-score { color: #0D1220; }
html[data-theme="light"] .ppm__game-img { border-color: #E0E3EF; }
html[data-theme="light"] .ppm__level { background: #F0F3FF; border-color: #E0E3EF; }
html[data-theme="light"] .ppm__close { background: #F7F8FC; border-color: #E0E3EF; color: #4A5280; }
html[data-theme="light"] .ppm__wl-bar { background: rgba(239,68,68,.15); }
html[data-theme="light"] .ppm__loader { background: #E0E3EF; }

@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
</style>
