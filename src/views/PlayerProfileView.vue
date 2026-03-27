<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { API_BASE } from '@/config'
import { ArrowLeft, RefreshCw } from 'lucide-vue-next'

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()

const loading = ref(true)
const profile = ref<any>(null)
const userId  = Number(route.params.userId)

/* ── Helpers ── */
const CHAMP_SPECIAL: Record<string, string> = {
  "Nunu & Willump": "Nunu", "Renata Glasc": "Renata",
  "K'Sante": "KSante", "Bel'Veth": "Belveth", "Wukong": "MonkeyKing",
}
const TIER_COLOR: Record<string, string> = {
  IRON: '#7A6651', BRONZE: '#A07354', SILVER: '#A0AABE',
  GOLD: '#F0B429', PLATINUM: '#4DD0A0', EMERALD: '#00C896',
  DIAMOND: '#6BAEE8', MASTER: '#C084FC', GRANDMASTER: '#F87171', CHALLENGER: '#F0B429',
}
const ROLE_ICON: Record<string, string> = {
  TOP: 'TOP', JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP', '': '—',
}
const QUEUE_COLOR: Record<string, string> = {
  'Solo/Duo': '#6BAEE8', 'Flex': '#C084FC', 'Normal': '#8892B0',
  'ARAM': '#F0B429', 'Quickplay': '#8892B0',
}

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
  const ddv = profile.value?.riot_stats?.ddVersion ?? '15.6.1'
  return `https://ddragon.leagueoflegends.com/cdn/${ddv}/img/item/${id}.png`
}
function spellIcon(id: number) {
  const name = SUMMONER_KEY[id]; if (!name) return ''
  const ddv = profile.value?.riot_stats?.ddVersion ?? '15.6.1'
  return `https://ddragon.leagueoflegends.com/cdn/${ddv}/img/spell/${name}.png`
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

function champIcon(name: string) {
  const ddv = profile.value?.riot_stats?.ddVersion ?? '15.6.1'
  return `https://ddragon.leagueoflegends.com/cdn/${ddv}/img/champion/${CHAMP_SPECIAL[name] ?? name}.png`
}
function kdaColor(v: string | number) {
  const n = parseFloat(String(v))
  return n >= 5 ? '#00C896' : n >= 3 ? '#F0B429' : n >= 1.5 ? '#EEF2FF' : '#EF4444'
}
function wrColor(v: number) { return v >= 60 ? '#00C896' : v >= 50 ? '#F0B429' : '#EF4444' }
function rankNoDiv(tier: string) { return ['MASTER','GRANDMASTER','CHALLENGER'].includes(tier) }
function rankImg(tier: string): string | null {
  const t = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
  const imgs = ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master']
  return imgs.includes(t) ? `/ranks lol/Season_2023_-_${t}.webp` : null
}
function fmtDate(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 3600000)
  if (diff < 1) return "Récemment"
  if (diff < 24) return `il y a ${diff}h`
  return `il y a ${Math.floor(diff / 24)}j`
}

/* ── Computed from recent games ── */
const summary = computed(() => {
  const games = profile.value?.riot_stats?.recentGames ?? []
  if (!games.length) return null
  const wins = games.filter((g: any) => g.win).length
  const kills   = games.reduce((s: number, g: any) => s + g.kills,   0) / games.length
  const deaths  = games.reduce((s: number, g: any) => s + g.deaths,  0) / games.length
  const assists = games.reduce((s: number, g: any) => s + g.assists, 0) / games.length
  const kda = deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2)
  const csMin = (games.reduce((s: number, g: any) => s + parseFloat(g.csMin), 0) / games.length).toFixed(1)
  return { wins, losses: games.length - wins, wr: Math.round(wins / games.length * 100), kills: kills.toFixed(1), deaths: deaths.toFixed(1), assists: assists.toFixed(1), kda, csMin }
})

const expanded = ref<Set<string>>(new Set())
function toggleExpand(id: string) {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  expanded.value = s
}

async function loadProfile() {
  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/players/${userId}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) profile.value = await res.json()
  } finally { loading.value = false }
}

onMounted(loadProfile)
</script>

<template>
  <div class="pp">

    <!-- ── TOPBAR ── -->
    <div class="pp__topbar">
      <button class="pp__back" @click="router.back()">
        <ArrowLeft :size="15" /> Retour
      </button>
    </div>

    <!-- ── LOADING ── -->
    <div v-if="loading" class="pp__loading">
      <div class="pp__loading-bar" />
    </div>

    <!-- ── NO RIOT ID ── -->
    <div v-else-if="!profile?.riot_id" class="pp__empty">
      <span class="pp__empty-title">{{ profile?.username ?? '—' }}</span>
      <span class="pp__empty-sub">Ce joueur n'a pas encore configuré son Riot ID.</span>
    </div>

    <!-- ── ERROR ── -->
    <div v-else-if="profile?.riot_error && !profile?.riot_stats" class="pp__empty pp__empty--err">
      <span class="pp__empty-title">Erreur Riot API</span>
      <span class="pp__empty-sub">{{ profile.riot_error }}</span>
      <button class="pp__refresh-btn" @click="loadProfile"><RefreshCw :size="13" /> Réessayer</button>
    </div>

    <!-- ── PROFILE ── -->
    <template v-else-if="profile?.riot_stats">
      <!-- ══ HEADER ══ -->
      <div class="pp__header">
        <div class="pp__header-inner">
          <div class="pp__avatar">
            <span class="pp__avatar-letter">{{ profile.username.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="pp__identity">
            <div class="pp__name-row">
              <h1 class="pp__name">{{ profile.riot_stats.gameName }}</h1>
              <span class="pp__tag">#{{ profile.riot_stats.tagLine }}</span>
            </div>
            <div class="pp__role-row">
              <span class="pp__role-badge"
                :style="{ color: 'var(--accent)', borderColor: 'color-mix(in srgb,var(--accent) 30%,transparent)', background: 'color-mix(in srgb,var(--accent) 10%,transparent)' }">
                {{ profile.game_role?.toUpperCase() }}
              </span>
              <span class="pp__team-name">{{ profile.team_name }}</span>
            </div>
          </div>
          <button class="pp__refresh-btn pp__refresh-btn--top" @click="loadProfile" title="Actualiser">
            <RefreshCw :size="13" />
          </button>
        </div>
      </div>

      <!-- ══ BODY 30/70 ══ -->
      <div class="pp__body">

        <!-- LEFT 30% : ranks + champ pool -->
        <div class="pp__left">

          <!-- Ranks stacked -->
          <div class="pp__ranks-col">

            <!-- Solo/Duo -->
            <div class="pp__rank-card"
              :style="profile.riot_stats.soloQ ? { '--tc': TIER_COLOR[profile.riot_stats.soloQ.tier] } : { '--tc': '#3D4460' }">
              <div class="pp__rank-card-head">RANKED SOLO / DUO</div>
              <div v-if="profile.riot_stats.soloQ" class="pp__rank-card-body">
                <div class="pp__rank-emblem">
                  <img v-if="rankImg(profile.riot_stats.soloQ.tier)"
                    :src="rankImg(profile.riot_stats.soloQ.tier)!"
                    :alt="profile.riot_stats.soloQ.tier"
                    class="pp__rank-img"
                    @error="($event.target as HTMLImageElement).style.display='none'" />
                  <span v-else class="pp__rank-tier-letter" :style="{ color: TIER_COLOR[profile.riot_stats.soloQ.tier] }">
                    {{ profile.riot_stats.soloQ.tier.charAt(0) }}
                  </span>
                </div>
                <div class="pp__rank-info">
                  <span class="pp__rank-tier-label" :style="{ color: TIER_COLOR[profile.riot_stats.soloQ.tier] }">
                    {{ profile.riot_stats.soloQ.tier }}{{ rankNoDiv(profile.riot_stats.soloQ.tier) ? '' : ' ' + profile.riot_stats.soloQ.rank }}
                  </span>
                  <span class="pp__rank-lp">{{ profile.riot_stats.soloQ.lp }} LP</span>
                  <span class="pp__rank-wr" :style="{ color: wrColor(profile.riot_stats.soloQ.winRate) }">
                    {{ profile.riot_stats.soloQ.winRate }}% WR
                  </span>
                  <div class="pp__wr-bar">
                    <div class="pp__wr-win" :style="{ width: `${profile.riot_stats.soloQ.winRate}%` }" />
                    <div class="pp__wr-loss" :style="{ width: `${100 - profile.riot_stats.soloQ.winRate}%` }" />
                  </div>
                </div>
              </div>
              <div v-else class="pp__rank-card-body pp__rank-card-body--unranked">
                <span class="pp__unranked">Unranked</span>
              </div>
            </div>

            <!-- Flex -->
            <div class="pp__rank-card"
              :style="profile.riot_stats.flexQ ? { '--tc': TIER_COLOR[profile.riot_stats.flexQ.tier] } : { '--tc': '#3D4460' }">
              <div class="pp__rank-card-head">RANKED FLEX</div>
              <div v-if="profile.riot_stats.flexQ" class="pp__rank-card-body">
                <div class="pp__rank-emblem">
                  <img v-if="rankImg(profile.riot_stats.flexQ.tier)"
                    :src="rankImg(profile.riot_stats.flexQ.tier)!"
                    :alt="profile.riot_stats.flexQ.tier"
                    class="pp__rank-img"
                    @error="($event.target as HTMLImageElement).style.display='none'" />
                  <span v-else class="pp__rank-tier-letter" :style="{ color: TIER_COLOR[profile.riot_stats.flexQ.tier] }">
                    {{ profile.riot_stats.flexQ.tier.charAt(0) }}
                  </span>
                </div>
                <div class="pp__rank-info">
                  <span class="pp__rank-tier-label" :style="{ color: TIER_COLOR[profile.riot_stats.flexQ.tier] }">
                    {{ profile.riot_stats.flexQ.tier }}{{ rankNoDiv(profile.riot_stats.flexQ.tier) ? '' : ' ' + profile.riot_stats.flexQ.rank }}
                  </span>
                  <span class="pp__rank-lp">{{ profile.riot_stats.flexQ.lp }} LP</span>
                  <span class="pp__rank-wr" :style="{ color: wrColor(profile.riot_stats.flexQ.winRate) }">
                    {{ profile.riot_stats.flexQ.winRate }}% WR
                  </span>
                  <div class="pp__wr-bar">
                    <div class="pp__wr-win" :style="{ width: `${profile.riot_stats.flexQ.winRate}%` }" />
                    <div class="pp__wr-loss" :style="{ width: `${100 - profile.riot_stats.flexQ.winRate}%` }" />
                  </div>
                </div>
              </div>
              <div v-else class="pp__rank-card-body pp__rank-card-body--unranked">
                <span class="pp__unranked">Unranked</span>
              </div>
            </div>
          </div><!-- /pp__ranks-col -->

          <!-- Champion Pool -->
          <div v-if="profile.riot_stats.champPool.length" class="pp__section">
            <div class="pp__section-title">CHAMPION POOL</div>
            <div class="pp__champ-table">
              <div class="pp__champ-table-head">
                <span>Champion</span>
                <span>G</span>
                <span>Win Rate</span>
                <span>KDA</span>
              </div>
              <div v-for="(c, i) in profile.riot_stats.champPool" :key="c.name" class="pp__champ-row">
                <div class="pp__champ-row-left">
                  <span class="pp__champ-idx">{{ i + 1 }}</span>
                  <div class="pp__champ-portrait">
                    <img :src="champIcon(c.name)" :alt="c.name"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                  </div>
                  <span class="pp__champ-name">{{ c.name }}</span>
                </div>
                <span class="pp__champ-games">{{ c.games }}</span>
                <div class="pp__champ-wr-col">
                  <span class="pp__champ-wr-pct" :style="{ color: wrColor(c.winRate) }">{{ c.winRate }}%</span>
                  <div class="pp__champ-wr-bar">
                    <div :style="{ width: `${c.winRate}%`, background: wrColor(c.winRate) }" />
                  </div>
                </div>
                <span class="pp__champ-kda" :style="{ color: kdaColor(c.kda) }">{{ c.kda }}</span>
              </div>
            </div>
          </div>

        </div><!-- /pp__left -->

        <!-- RIGHT 70% : summary widget + match history -->
        <div class="pp__right">

          <!-- Summary 10 dernières -->
          <div v-if="summary" class="pp__rank-card pp__summary-card">
            <div class="pp__rank-card-head">10 DERNIÈRES PARTIES</div>
            <div class="pp__summary-body">
              <div class="pp__summary-wr">
                <svg viewBox="0 0 36 36" class="pp__donut">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1A1F2E" stroke-width="3.2"/>
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    :stroke="wrColor(summary.wr)"
                    stroke-width="3.2"
                    :style="{ strokeDasharray: `${summary.wr} ${100 - summary.wr}`, strokeLinecap: 'round' }"
                    transform="rotate(-90 18 18)"/>
                </svg>
                <div class="pp__donut-text">
                  <span class="pp__donut-wr" :style="{ color: wrColor(summary.wr) }">{{ summary.wr }}%</span>
                  <span class="pp__donut-sub">{{ summary.wins }}V {{ summary.losses }}D</span>
                </div>
              </div>
              <div class="pp__summary-kda">
                <span class="pp__summary-scores">{{ summary.kills }} / <span style="color:#EF4444">{{ summary.deaths }}</span> / {{ summary.assists }}</span>
                <span class="pp__summary-ratio" :style="{ color: kdaColor(summary.kda) }">{{ summary.kda }} KDA</span>
                <span class="pp__summary-cs">{{ summary.csMin }} CS/min</span>
              </div>
            </div>
          </div>

          <!-- Match history -->
          <div v-if="profile.riot_stats.recentGames.length" class="pp__section">
        <div class="pp__section-title">HISTORIQUE DES PARTIES</div>
        <div class="pp__matches">
          <div v-for="g in profile.riot_stats.recentGames" :key="g.matchId"
            class="pp__match" :class="g.win ? 'pp__match--win' : 'pp__match--loss'">

            <!-- Main row -->
            <div class="pp__match-main">
              <!-- 1. Info zone -->
              <div class="pp__match-info">
                <div class="pp__match-info-top">
                  <span class="pp__match-queue" :style="{ color: QUEUE_COLOR[g.queueLabel] ?? '#8892B0' }">{{ g.queueLabel }}</span>
                  <span class="pp__match-date">{{ fmtDate(g.date) }}</span>
                </div>
                <div class="pp__match-info-bot">
                  <span class="pp__match-vd" :class="g.win ? 'pp__match-vd--win' : 'pp__match-vd--loss'">
                    {{ g.win ? 'Victoire' : 'Défaite' }}
                  </span>
                  <span class="pp__match-dur">{{ fmtDur(g.durationSec, g.duration) }}</span>
                </div>
              </div>

              <!-- 2. Champion zone -->
              <div class="pp__match-champ-zone">
                <div class="pp__match-champ-top">
                  <div class="pp__match-portrait-wrap">
                    <img :src="champIcon(g.champion)" :alt="g.champion" class="pp__match-portrait"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                    <span v-if="g.champLevel" class="pp__match-level">{{ g.champLevel }}</span>
                  </div>
                  <div class="pp__match-spells-col">
                    <img v-if="spellIcon(g.summoners?.[0] ?? 0)" class="pp__match-spell"
                      :src="spellIcon(g.summoners?.[0] ?? 0)"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                    <div v-else class="pp__match-spell pp__slot-empty" />
                    <img v-if="spellIcon(g.summoners?.[1] ?? 0)" class="pp__match-spell"
                      :src="spellIcon(g.summoners?.[1] ?? 0)"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                    <div v-else class="pp__match-spell pp__slot-empty" />
                    <img v-if="runeIcon(g.primaryRune ?? 0)" class="pp__match-rune"
                      :src="runeIcon(g.primaryRune ?? 0)"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                    <div v-else class="pp__match-rune pp__slot-empty pp__slot-empty--round" />
                  </div>
                </div>
                <div class="pp__match-items-row">
                  <div v-for="(itemId, i) in (g.items ?? [0,0,0,0,0,0])" :key="i" class="pp__match-item-slot">
                    <img v-if="itemId" class="pp__match-item" :src="itemIcon(itemId)"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                  </div>
                  <div class="pp__match-item-slot pp__match-item-slot--trinket">
                    <img v-if="g.trinket" class="pp__match-item" :src="itemIcon(g.trinket)"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                  </div>
                </div>
              </div>

              <!-- 3. KDA zone -->
              <div class="pp__match-kda">
                <span class="pp__match-score">
                  <span class="pp__match-k">{{ g.kills }}</span>
                  <span class="pp__match-sep"> / </span>
                  <span class="pp__match-d">{{ g.deaths }}</span>
                  <span class="pp__match-sep"> / </span>
                  <span class="pp__match-a">{{ g.assists }}</span>
                </span>
                <span class="pp__match-ratio" :style="{ color: kdaColor(g.kda) }">{{ g.kda }} KDA</span>
              </div>

              <!-- 4. Stats zone -->
              <div class="pp__match-stats">
                <div v-if="g.pKill != null" class="pp__match-stat-row">
                  <span class="pp__match-stat-lbl">P/Kill</span>
                  <span class="pp__match-stat-val" :style="{ color: pKillColor(g.pKill) }">{{ g.pKill }}%</span>
                </div>
                <div class="pp__match-stat-row">
                  <span class="pp__match-stat-lbl">CS</span>
                  <span class="pp__match-stat-val">{{ g.cs }}<span class="pp__match-stat-sub"> ({{ g.csMin }}/m)</span></span>
                </div>
                <div class="pp__match-stat-row">
                  <span class="pp__match-stat-lbl">Dégâts</span>
                  <span class="pp__match-stat-val">{{ g.damage ? (g.damage / 1000).toFixed(1) + 'k' : '—' }}<span v-if="g.dmgShare != null" class="pp__match-stat-sub" :style="{ color: dmgColor(g.dmgShare) }"> ({{ g.dmgShare }}%)</span></span>
                </div>
              </div>

              <!-- 5. Team comp: two vertical columns -->
              <div v-if="g.myTeam?.length" class="pp__match-teams">
                <div class="pp__match-team-col">
                  <img v-for="c in g.myTeam" :key="c" :src="champIcon(c)" :alt="c"
                    class="pp__match-team-icon" :class="{ 'pp__match-team-icon--me': c === g.champion }"
                    @error="($event.target as HTMLImageElement).src='/logo.png'" />
                </div>
                <div class="pp__match-team-col">
                  <img v-for="c in g.enemyTeam" :key="c" :src="champIcon(c)" :alt="c"
                    class="pp__match-team-icon"
                    @error="($event.target as HTMLImageElement).src='/logo.png'" />
                </div>
              </div>

              <!-- 6. Expand button -->
              <div class="pp__match-expand-wrap">
                <button v-if="g.participants?.length"
                  class="pp__match-expand-btn" :class="{ 'pp__match-expand-btn--open': expanded.has(g.matchId) }"
                  @click="toggleExpand(g.matchId)" title="Détails">
                  <span class="pp__match-expand-arrow">▼</span>
                </button>
              </div>
            </div>

            <!-- Scoreboard (expanded) -->
            <div v-if="expanded.has(g.matchId) && g.participants?.length" class="pp__match-scoreboard">
              <div class="pp__match-sb-grid">
                <div class="pp__match-sb-col">
                  <div v-for="p in g.participants.filter((x: any) => (x.teamId ?? 100) === 100)"
                    :key="p.champion" class="pp__match-sb-row"
                    :class="{ 'pp__match-sb-row--me': p.isMe }">
                    <img :src="champIcon(p.champion)" :alt="p.champion" class="pp__match-sb-icon"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                    <span class="pp__match-sb-kda">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
                    <span class="pp__match-sb-cs">{{ p.cs }} cs</span>
                    <span class="pp__match-sb-dmg">{{ (p.damage / 1000).toFixed(1) }}k</span>
                  </div>
                </div>
                <div class="pp__match-sb-divider" />
                <div class="pp__match-sb-col">
                  <div v-for="p in g.participants.filter((x: any) => (x.teamId ?? 200) === 200)"
                    :key="p.champion" class="pp__match-sb-row">
                    <img :src="champIcon(p.champion)" :alt="p.champion" class="pp__match-sb-icon"
                      @error="($event.target as HTMLImageElement).src='/logo.png'" />
                    <span class="pp__match-sb-kda">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
                    <span class="pp__match-sb-cs">{{ p.cs }} cs</span>
                    <span class="pp__match-sb-dmg">{{ (p.damage / 1000).toFixed(1) }}k</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div><!-- /pp__section match history -->

        </div><!-- /pp__right -->
      </div><!-- /pp__body -->

    </template>
  </div>
</template>

<style scoped>
.pp {
  display: flex; flex-direction: column; gap: 0;
  min-height: 100%; animation: fadeIn .3s ease-out both;
}

/* ── Topbar ── */
.pp__topbar { padding: 0 0 16px; }
.pp__back {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px;
  color: #8892B0; background: none; border: none; cursor: pointer; padding: 0; transition: color .15s;
}
.pp__back:hover { color: #EEF2FF; }

/* ── Loading ── */
.pp__loading { height: 3px; background: #111520; border-radius: 2px; overflow: hidden; margin-bottom: 24px; }
.pp__loading-bar {
  height: 100%; width: 35%; background: var(--accent);
  animation: loading 1.2s ease-in-out infinite;
}
@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }

/* ── Empty ── */
.pp__empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 80px 24px; text-align: center;
}
.pp__empty--err .pp__empty-title { color: #EF4444; }
.pp__empty-title {
  font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700;
  letter-spacing: 3px; color: #EEF2FF;
}
.pp__empty-sub { font-family: 'Inter', sans-serif; font-size: 13px; color: #3D4460; }

/* ── Header ── */
.pp__header {
  background: linear-gradient(180deg, #111520 0%, #0D1018 100%);
  border: 1px solid #1A1F2E; border-radius: 12px; margin-bottom: 12px; overflow: hidden;
}
.pp__header::before {
  content: ''; display: block; height: 60px;
  background: linear-gradient(135deg, color-mix(in srgb,var(--accent) 15%,transparent) 0%, transparent 60%);
}
.pp__header-inner {
  display: flex; align-items: center; gap: 16px;
  padding: 0 20px 20px; margin-top: -30px;
}
.pp__avatar {
  position: relative; width: 72px; height: 72px; border-radius: 12px;
  background: linear-gradient(135deg, #1A1F2E, #0D1018);
  border: 3px solid color-mix(in srgb,var(--accent) 40%,transparent);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.pp__avatar-letter {
  font-family: 'Rajdhani', sans-serif; font-size: 34px; font-weight: 700;
  color: var(--accent); line-height: 1;
}
.pp__avatar-level {
  position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px;
  background: #0D1018; border: 1px solid #1A1F2E; color: #8892B0;
  padding: 1px 6px; border-radius: 4px; white-space: nowrap;
}

/* ── 30/70 Body layout ── */
.pp__body {
  display: grid;
  grid-template-columns: 30% 1fr;
  gap: 12px;
  align-items: start;
}
.pp__left  { display: flex; flex-direction: column; gap: 12px; }
.pp__right { display: flex; flex-direction: column; gap: 10px; }
.pp__identity { flex: 1; display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.pp__name-row { display: flex; align-items: baseline; gap: 8px; }
.pp__name {
  font-family: 'Rajdhani', sans-serif; font-size: 30px; font-weight: 700;
  letter-spacing: 3px; color: #EEF2FF; margin: 0; line-height: 1;
}
.pp__tag { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 600; color: #3D4460; }
.pp__role-row { display: flex; align-items: center; gap: 10px; }
.pp__role-badge {
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px;
  padding: 3px 8px; border-radius: 4px; border: 1px solid;
}
.pp__team-name { font-family: 'Inter', sans-serif; font-size: 12px; color: #3D4460; }
.pp__refresh-btn--top {
  background: #111520; border: 1px solid #1A1F2E; color: #3D4460;
  width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all .15s; flex-shrink: 0; align-self: flex-start; margin-top: 10px;
}
.pp__refresh-btn--top:hover { border-color: var(--accent); color: var(--accent); }
.pp__refresh-btn {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 8px;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px;
  background: color-mix(in srgb,var(--accent) 10%,transparent);
  border: 1px solid color-mix(in srgb,var(--accent) 30%,transparent);
  color: var(--accent); padding: 8px 16px; border-radius: 6px; cursor: pointer; transition: all .15s;
}
.pp__refresh-btn:hover { background: color-mix(in srgb,var(--accent) 18%,transparent); }

/* ── Ranks col ── */
.pp__ranks-col { display: flex; flex-direction: column; gap: 10px; }
.pp__rank-card {
  background: #111520; border: 1px solid #1A1F2E; border-radius: 12px;
  overflow: hidden; transition: border-color .2s;
}
.pp__rank-card:hover { border-color: color-mix(in srgb, var(--tc, #3D4460) 40%, transparent); }
.pp__rank-card-head {
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2.5px;
  color: #3D4460; padding: 10px 14px 8px;
  border-bottom: 1px solid #1A1F2E;
}
.pp__rank-card-body { display: flex; align-items: center; gap: 14px; padding: 14px; }
.pp__rank-card-body--unranked { justify-content: center; }
.pp__rank-emblem {
  width: 64px; height: 64px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.pp__rank-img {
  width: 64px; height: 64px; object-fit: contain;
  filter: drop-shadow(0 2px 8px color-mix(in srgb, var(--tc, #3D4460) 50%, transparent));
}
.pp__rank-tier-letter {
  font-family: 'Rajdhani', sans-serif; font-size: 36px; font-weight: 900; line-height: 1;
}
.pp__rank-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.pp__rank-tier-label {
  font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 1px; line-height: 1;
}
.pp__rank-lp { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; color: #8892B0; }
.pp__rank-wr {
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700;
}
.pp__wr-bar { height: 4px; border-radius: 2px; overflow: hidden; display: flex; }
.pp__wr-win  { background: #10B981; transition: width .6s ease; }
.pp__wr-loss { background: #EF4444; transition: width .6s ease; }
.pp__unranked {
  font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 600;
  color: #2A3050; letter-spacing: 1px; padding: 16px 0;
}

/* ── Summary card ── */
.pp__summary-card {}
.pp__summary-body { display: flex; align-items: center; gap: 20px; padding: 14px; }
.pp__summary-wr { position: relative; width: 70px; height: 70px; flex-shrink: 0; }
.pp__donut { width: 70px; height: 70px; }
.pp__donut-text {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1px;
}
.pp__donut-wr { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; line-height: 1; }
.pp__donut-sub { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; }
.pp__summary-kda { display: flex; flex-direction: column; gap: 4px; }
.pp__summary-scores {
  font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; color: #EEF2FF; line-height: 1;
}
.pp__summary-ratio { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; }
.pp__summary-cs { font-family: 'Inter', sans-serif; font-size: 11px; color: #3D4460; }

/* ── Section ── */
.pp__section { margin-bottom: 12px; }
.pp__section-title {
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 3px;
  color: #3D4460; padding: 0 2px 10px;
}

/* ── Champion table ── */
.pp__champ-table { background: #111520; border: 1px solid #1A1F2E; border-radius: 12px; overflow: hidden; }
.pp__champ-table-head {
  display: grid; grid-template-columns: 1fr 60px 120px 80px;
  padding: 8px 14px; border-bottom: 1px solid #1A1F2E;
  font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; color: #3D4460;
}
.pp__champ-row {
  display: grid; grid-template-columns: 1fr 60px 120px 80px;
  align-items: center; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,.03);
  transition: background .1s;
}
.pp__champ-row:last-child { border-bottom: none; }
.pp__champ-row:hover { background: rgba(255,255,255,.02); }
.pp__champ-row-left { display: flex; align-items: center; gap: 10px; }
.pp__champ-idx { font-family: 'Rajdhani', sans-serif; font-size: 11px; color: #2A3050; width: 14px; text-align: center; }
.pp__champ-portrait { width: 36px; height: 36px; border-radius: 6px; overflow: hidden; border: 1px solid #1A1F2E; flex-shrink: 0; }
.pp__champ-portrait img { width: 100%; height: 100%; object-fit: cover; }
.pp__champ-name { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; color: #EEF2FF; }
.pp__champ-games { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #8892B0; }
.pp__champ-wr-col { display: flex; flex-direction: column; gap: 3px; }
.pp__champ-wr-pct { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; }
.pp__champ-wr-bar { height: 3px; background: #1A1F2E; border-radius: 2px; overflow: hidden; }
.pp__champ-wr-bar div { height: 100%; border-radius: 2px; }
.pp__champ-kda { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; }

/* ── Match history ── */
.pp__matches { display: flex; flex-direction: column; gap: 4px; }
.pp__match {
  display: flex; flex-direction: column;
  background: #111520; border: 1px solid #1A1F2E; border-radius: 10px;
  border-left: 4px solid transparent; overflow: hidden;
}
.pp__match:hover > .pp__match-main { background: #131828; }
.pp__match--win  { border-left-color: #10B981; }
.pp__match--loss { border-left-color: #EF4444; }

.pp__match-main {
  display: grid;
  grid-template-columns: 115px 185px 110px 145px 1fr 36px;
  align-items: stretch; min-height: 90px;
}

/* 1. Info zone */
.pp__match-info {
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 10px; border-right: 1px solid rgba(255,255,255,.04);
}
.pp__match-info-top { display: flex; flex-direction: column; gap: 2px; }
.pp__match-info-bot { display: flex; flex-direction: column; gap: 2px; }
.pp__match-queue { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
.pp__match-date  { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; }
.pp__match-vd    { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: .5px; }
.pp__match-vd--win  { color: #10B981; }
.pp__match-vd--loss { color: #EF4444; }
.pp__match-dur   { font-family: 'Inter', sans-serif; font-size: 10px; color: #3D4460; }

/* 2. Champion zone */
.pp__match-champ-zone {
  display: flex; flex-direction: column; justify-content: center; gap: 6px;
  padding: 8px 10px; border-right: 1px solid rgba(255,255,255,.04);
}
.pp__match-champ-top    { display: flex; align-items: center; gap: 5px; }
.pp__match-portrait-wrap { position: relative; flex-shrink: 0; }
.pp__match-portrait { width: 58px; height: 58px; border-radius: 6px; object-fit: cover; border: 2px solid rgba(255,255,255,.1); display: block; }
.pp__match-level {
  position: absolute; bottom: -2px; left: -2px;
  background: #0D1018; border: 1px solid #2A3050;
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700;
  color: #8892B0; padding: 0 3px; border-radius: 3px; line-height: 15px; z-index: 1;
}
.pp__match-spells-col { display: flex; flex-direction: column; gap: 3px; align-self: center; }
.pp__match-spell {
  width: 20px; height: 20px; border-radius: 4px; object-fit: cover;
  border: 1px solid rgba(255,255,255,.1); display: block;
}
.pp__match-rune {
  width: 20px; height: 20px; border-radius: 50%; object-fit: contain;
  background: #0D1018; border: 1px solid rgba(255,255,255,.08); display: block;
}
.pp__slot-empty { background: #0D1018 !important; }
.pp__slot-empty--round { border-radius: 50% !important; }
.pp__match-items-row { display: flex; gap: 2px; align-items: center; }
.pp__match-item-slot {
  width: 20px; height: 20px; border-radius: 4px; overflow: hidden;
  background: #0A0E18; border: 1px solid #1A1F2E; flex-shrink: 0;
}
.pp__match-item-slot--trinket { border-radius: 50%; margin-left: 3px; }
.pp__match-item { width: 100%; height: 100%; object-fit: cover; display: block; }

/* 3. KDA zone */
.pp__match-kda {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  padding: 10px 8px; border-right: 1px solid rgba(255,255,255,.04);
}
.pp__match-score { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; line-height: 1; white-space: nowrap; }
.pp__match-k, .pp__match-a { color: #EEF2FF; }
.pp__match-d { color: #EF4444; }
.pp__match-sep { color: #3D4460; font-size: 16px; }
.pp__match-ratio { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; }

/* 4. Stats zone */
.pp__match-stats {
  display: flex; flex-direction: column; justify-content: center; gap: 6px;
  padding: 10px 14px; border-right: 1px solid rgba(255,255,255,.04);
}
.pp__match-stat-row  { display: flex; align-items: baseline; gap: 6px; }
.pp__match-stat-lbl  { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #3D4460; min-width: 40px; }
.pp__match-stat-val  { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #EEF2FF; }
.pp__match-stat-sub  { font-family: 'Inter', sans-serif; font-size: 9px; color: #3D4460; }
.pp__match-champ-name {
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; color: #8892B0;
  text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 88px;
}

/* 5. Team comp: two vertical columns */
.pp__match-teams {
  display: flex; gap: 8px; align-items: center; justify-content: center;
  padding: 8px 12px; border-right: 1px solid rgba(255,255,255,.04);
}
.pp__match-team-col  { display: flex; flex-direction: column; gap: 2px; }
.pp__match-team-icon {
  width: 22px; height: 22px; border-radius: 3px; object-fit: cover;
  border: 1px solid rgba(255,255,255,.06); opacity: .7; display: block;
}
.pp__match-team-icon--me { border-color: var(--accent) !important; opacity: 1; }

/* 6. Expand */
.pp__match-expand-wrap {
  display: flex; align-items: center; justify-content: center; padding: 8px 5px;
}
.pp__match-expand-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: #0D1018; border: 1px solid #1A1F2E; border-radius: 4px;
  color: #3D4460; cursor: pointer; font-size: 9px; transition: all .15s;
}
.pp__match-expand-btn:hover { border-color: var(--accent); color: var(--accent); }
.pp__match-expand-btn--open { border-color: color-mix(in srgb,var(--accent) 50%,transparent); color: var(--accent); }
.pp__match-expand-arrow { display: inline-block; transition: transform .2s ease; line-height: 1; }
.pp__match-expand-btn--open .pp__match-expand-arrow { transform: rotate(180deg); }

/* Scoreboard */
.pp__match-scoreboard { border-top: 1px solid #1A1F2E; padding: 8px 36px; background: #0A0E18; }
.pp__match-sb-grid    { display: grid; grid-template-columns: 1fr 1px 1fr; }
.pp__match-sb-divider { background: #1A1F2E; margin: 2px 8px; }
.pp__match-sb-col     { display: flex; flex-direction: column; gap: 1px; padding: 0 8px; }
.pp__match-sb-col:first-child { padding-left: 0; }
.pp__match-sb-col:last-child  { padding-right: 0; }
.pp__match-sb-row {
  display: grid; grid-template-columns: 24px 1fr 50px 44px;
  align-items: center; gap: 6px; padding: 3px 5px; border-radius: 4px; transition: background .1s;
}
.pp__match-sb-row:hover { background: rgba(255,255,255,.03); }
.pp__match-sb-row--me  { background: color-mix(in srgb, var(--accent) 7%, transparent) !important; }
.pp__match-sb-icon { width: 24px; height: 24px; border-radius: 4px; object-fit: cover; border: 1px solid rgba(255,255,255,.06); }
.pp__match-sb-kda  { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: #3D4460; }
.pp__match-sb-cs   { font-family: 'Rajdhani', sans-serif; font-size: 11px; color: #2A3050; text-align: right; }
.pp__match-sb-dmg  { font-family: 'Rajdhani', sans-serif; font-size: 11px; color: #2A3050; text-align: right; }
.pp__match-sb-row--me .pp__match-sb-kda { color: var(--accent); }

/* ── Light theme ── */
html[data-theme="light"] .pp__header { background: linear-gradient(180deg, #F7F8FC 0%, #FFFFFF 100%); border-color: #E0E3EF; }
html[data-theme="light"] .pp__header::before { background: linear-gradient(135deg, color-mix(in srgb,var(--accent) 8%,transparent) 0%, transparent 60%); }
html[data-theme="light"] .pp__avatar { background: linear-gradient(135deg, #EEF0F8, #FFFFFF); border-color: color-mix(in srgb,var(--accent) 30%,transparent); }
html[data-theme="light"] .pp__name { color: #0D1220; }
html[data-theme="light"] .pp__rank-card { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .pp__rank-card-head { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .pp__rank-lp { color: #4A5280; }
html[data-theme="light"] .pp__wr-bar { background: #E0E3EF; }
html[data-theme="light"] .pp__champ-table { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .pp__champ-table-head { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .pp__champ-row { border-bottom-color: #F0F3FF; }
html[data-theme="light"] .pp__champ-row:hover { background: #F7F8FC; }
html[data-theme="light"] .pp__champ-portrait { border-color: #E0E3EF; }
html[data-theme="light"] .pp__champ-name { color: #0D1220; }
html[data-theme="light"] .pp__champ-wr-bar { background: #E0E3EF; }
html[data-theme="light"] .pp__match { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .pp__match:hover > .pp__match-main { background: #F7F8FC; }
html[data-theme="light"] .pp__match-info     { border-right-color: #E0E3EF; }
html[data-theme="light"] .pp__match-champ-zone { border-right-color: #E0E3EF; }
html[data-theme="light"] .pp__match-kda      { border-right-color: #E0E3EF; }
html[data-theme="light"] .pp__match-stats    { border-right-color: #E0E3EF; }
html[data-theme="light"] .pp__match-teams    { border-right-color: #E0E3EF; }
html[data-theme="light"] .pp__match-portrait { border-color: #C8CDDF; }
html[data-theme="light"] .pp__match-spell    { border-color: #C8CDDF; }
html[data-theme="light"] .pp__match-rune     { border-color: #C8CDDF; background: #F0F3FF; }
html[data-theme="light"] .pp__match-item-slot { background: #F0F3FF; border-color: #E0E3EF; }
html[data-theme="light"] .pp__match-score    { color: #0D1220; }
html[data-theme="light"] .pp__match-stat-val { color: #0D1220; }
html[data-theme="light"] .pp__match-stat-sub { color: #8892B0; }
html[data-theme="light"] .pp__match-team-icon { border-color: #C8CDDF; opacity: .85; }
html[data-theme="light"] .pp__match-expand-btn { background: #F7F8FC; border-color: #E0E3EF; color: #8892B0; }
html[data-theme="light"] .pp__match-scoreboard { background: #F0F3FF; border-top-color: #E0E3EF; }
html[data-theme="light"] .pp__match-sb-divider { background: #E0E3EF; }
html[data-theme="light"] .pp__match-sb-row:hover { background: rgba(0,0,0,.03); }
html[data-theme="light"] .pp__match-k, html[data-theme="light"] .pp__match-a { color: #0D1220; }
html[data-theme="light"] .pp__summary-scores { color: #0D1220; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 768px) {
  .pp { gap: 14px; }

  /* Switch to single column on mobile */
  .pp__body { grid-template-columns: 1fr; }

  /* Rank cards: horizontal scroll */
  .pp__ranks-col {
    flex-direction: row;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 4px;
  }
  .pp__ranks-col::-webkit-scrollbar { display: none; }
  .pp__rank-card { flex: 0 0 200px; scroll-snap-align: start; }

  /* Recent games */
  .pp__match-main {
    grid-template-columns: 90px 1fr 90px 32px !important;
    min-height: 78px;
  }
  .pp__match-teams { display: none !important; }
  .pp__match-stats { display: none !important; }
  .pp__match-champ-zone { padding: 6px; gap: 4px; }
  .pp__match-portrait { width: 44px; height: 44px; }
  .pp__match-spells-col { display: none; }
  .pp__match-item-slot { width: 17px; height: 17px; }
}
</style>
