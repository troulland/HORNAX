<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTeamStore } from '@/stores/team'
import { useAuthStore } from '@/stores/auth'
import { useMatchStore, type Match } from '@/stores/matches'
import { Trophy } from 'lucide-vue-next'
import { STATIC_BASE } from '@/config'

const team = useTeamStore()
const auth = useAuthStore()
const matchStore = useMatchStore()

onMounted(() => {
  matchStore.fetchHistory(30)
  matchStore.fetchUpcoming(3)
  if (auth.user?.team_id) team.fetchRoster(auth.user.team_id)
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Bon matin'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
})

const streakLabel = computed(() => {
  const { currentStreak, streakType } = team.teamStats
  return `${currentStreak}W` + (streakType === 'win' ? '' : 'L') + ' streak'
})

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const isRoyalty = computed(() => auth.user?.team_slug === 'hornax-royalty')
const teamLogo  = computed(() => isRoyalty.value ? '/hornax-royalty.png' : '/logo.png')
const teamLabel = computed(() => isRoyalty.value ? 'ROYALTY' : 'HORNAX')

function logoSrc(logo: string | null): string | null {
  if (!logo) return null
  return logo.startsWith('/logos/') ? `${STATIC_BASE}${logo}` : logo
}

function opponentLogoSrc(match: Match): string | null {
  if (match.opponent_logo) return logoSrc(match.opponent_logo)
  if (match.opponent.toLowerCase().includes('royalty')) return '/hornax-royalty.png'
  return null
}

function boFormat(n: number): string {
  if (n <= 1) return 'BO1'
  if (n <= 3) return 'BO3'
  return 'BO5'
}

interface BoGroup {
  seriesId: string | null
  matches: Match[]
  wins: number
  losses: number
  total: number
  opponent: string
  logo: string | null
  date: string
  isSolo: boolean
  seriesWin: boolean
}

const boGroups = computed<BoGroup[]>(() => {
  const grouped = new Map<string, Match[]>()

  for (const m of matchStore.history) {
    if (m.series_id) {
      if (!grouped.has(m.series_id)) grouped.set(m.series_id, [])
      grouped.get(m.series_id)!.push(m)
    }
  }

  const result: BoGroup[] = []

  for (const [seriesId, matches] of grouped) {
    const wins = matches.filter(m => m.result === 'win').length
    const losses = matches.filter(m => m.result === 'loss').length
    result.push({
      seriesId,
      matches,
      wins,
      losses,
      total: matches.length,
      opponent: matches[0].opponent,
      logo: matches[0].opponent_logo,
      date: matches.reduce((latest, m) => m.date > latest ? m.date : latest, matches[0].date),
      isSolo: false,
      seriesWin: wins > losses,
    })
  }

  result.sort((a, b) => b.date.localeCompare(a.date))
  return result.slice(0, 3)
})

const ROLE_ORDER = ['top', 'jgl', 'mid', 'adc', 'sup', 'sub', 'coach', 'manager']
const rosterPlayers = computed(() =>
  [...team.roster].sort(
    (a, b) => ROLE_ORDER.indexOf(a.game_role) - ROLE_ORDER.indexOf(b.game_role)
  )
)
</script>

<template>
  <div class="dashboard">
    <!-- Page header -->
    <div class="dash-header">
      <div>
        <p class="dash-header__greeting">{{ greeting }},</p>
        <h1 class="dash-header__title">{{ auth.username ?? 'Manager' }}</h1>
      </div>
      <div class="dash-header__badge">
        <Trophy :size="14" class="text-hx-orange" />
        <span>{{ streakLabel }}</span>
      </div>
    </div>

    <!-- Stats bar 
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__icon" style="background: rgba(16, 185, 129, 0.1); color: #10B981">
          <TrendingUp :size="20" />
        </div>
        <div class="stat-card__body">
          <span class="stat-card__label">Win Rate</span>
          <span class="stat-card__value" style="color: #10B981">{{ team.teamStats.winRate }}%</span>
        </div>
        <div class="stat-card__sub">{{ team.teamStats.totalGames }} matchs</div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon" style="background: color-mix(in srgb,var(--accent) 10%,transparent); color: var(--accent)">
          <Target :size="20" />
        </div>
        <div class="stat-card__body">
          <span class="stat-card__label">KDA Moyen</span>
          <span class="stat-card__value" style="color: var(--accent)">{{ team.teamStats.avgKda }}</span>
        </div>
        <div class="stat-card__sub">équipe</div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon" style="background: rgba(33, 150, 243, 0.1); color: #2196F3">
          <Swords :size="20" />
        </div>
        <div class="stat-card__body">
          <span class="stat-card__label">Matchs ce mois</span>
          <span class="stat-card__value" style="color: #2196F3">{{ team.teamStats.totalGames }}</span>
        </div>
        <div class="stat-card__sub">mars 2026</div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon" style="background: rgba(196, 132, 252, 0.1); color: #C084FC">
          <Zap :size="20" />
        </div>
        <div class="stat-card__body">
          <span class="stat-card__label">Streak</span>
          <span class="stat-card__value" style="color: #C084FC">{{ team.teamStats.currentStreak }}</span>
        </div>
        <div class="stat-card__sub" style="color: #10B981">victoires consécutives</div>
      </div>
    </div>-->

    <!-- Matches Grid -->
    <div class="matches-grid">
      <!-- Derniers BO -->
      <section class="match-section">
        <h2 class="match-section__title">DERNIERS BO</h2>
        <div v-if="matchStore.loading" class="match-empty">Chargement…</div>
        <div v-else-if="boGroups.length === 0" class="match-empty">Aucun BO enregistré.</div>
        <div v-else class="match-cards-grid">
          <div
            v-for="group in boGroups"
            :key="group.seriesId ?? group.matches[0].id"
            class="bo-card"
            :style="{ '--mc': group.seriesWin ? '#10B981' : '#EF4444' }"
          >
            <span class="mc-corner mc-corner--tl" /><span class="mc-corner mc-corner--tr" />
            <span class="mc-corner mc-corner--bl" /><span class="mc-corner mc-corner--br" />

            <!-- Header: date + format badge -->
            <div class="bo-card__head">
              <span class="bo-card__date">{{ fmtDate(group.date) }}</span>
              <span class="bo-card__format">{{ boFormat(group.total) }}</span>
            </div>

            <!-- Logo centré -->
            <div class="bo-card__center">
              <div class="bo-card__logo-wrap">
                <img v-if="logoSrc(group.logo)" :src="logoSrc(group.logo)!" class="bo-card__logo" :alt="group.opponent" />
                <div v-else class="bo-card__letter">{{ group.opponent.charAt(0).toUpperCase() }}</div>
              </div>
              <span class="bo-card__opponent">{{ group.opponent }}</span>
            </div>

            <!-- Score series -->
            <div v-if="!group.isSolo" class="bo-card__score">
              <span class="bo-card__score-win">{{ group.wins }}</span>
              <span class="bo-card__score-sep"> — </span>
              <span class="bo-card__score-loss">{{ group.losses }}</span>
            </div>

            <!-- Footer: dots + résultat -->
            <div class="bo-card__foot">
              <div class="bo-card__games">
                <span
                  v-for="(m, i) in group.matches"
                  :key="i"
                  class="bo-card__dot"
                  :class="m.result === 'win' ? 'bo-card__dot--win' : 'bo-card__dot--loss'"
                >{{ m.result === 'win' ? 'V' : 'D' }}</span>
              </div>
              <span class="bo-card__result" :class="group.seriesWin ? 'bo-card__result--win' : 'bo-card__result--loss'">
                {{ group.seriesWin ? 'VICTOIRE' : 'DÉFAITE' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Upcoming Matches -->
      <section class="match-section">
        <h2 class="match-section__title">UPCOMING MATCHES</h2>
        <div v-if="matchStore.upcoming.length === 0" class="match-empty">Aucun match prévu.</div>
        <div v-else class="match-cards-grid">
          <div v-for="match in matchStore.upcoming" :key="match.id" class="uc-card">
            <span class="mc-corner mc-corner--tl" /><span class="mc-corner mc-corner--tr" />
            <span class="mc-corner mc-corner--bl" /><span class="mc-corner mc-corner--br" />

            <!-- Head: date + type badge -->
            <div class="uc-card__head">
              <span class="uc-card__date">{{ fmtDate(match.date) }}</span>
              <span class="uc-card__type">{{ match.type.toUpperCase() }}</span>
            </div>

            <!-- Center: matchup -->
            <div class="uc-card__matchup">
              <div class="uc-card__side">
                <div class="uc-card__logo-wrap">
                  <img :src="teamLogo" :alt="teamLabel" class="uc-card__logo-img" />
                </div>
                <span class="uc-card__name">{{ teamLabel }}</span>
              </div>
              <span class="uc-card__vs">VS</span>
              <div class="uc-card__side uc-card__side--right">
                <div class="uc-card__logo-wrap">
                  <img v-if="opponentLogoSrc(match)" :src="opponentLogoSrc(match)!" :alt="match.opponent" class="uc-card__logo-img" />
                  <span v-else class="uc-card__logo-letter">{{ match.opponent.charAt(0).toUpperCase() }}</span>
                </div>
                <span class="uc-card__name">{{ match.opponent }}</span>
              </div>
            </div>

            <!-- Foot: time + status -->
            <div class="uc-card__foot">
              <span class="uc-card__time">{{ match.time ?? '—' }}</span>
              <span class="uc-card__status">À VENIR</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Roster Section -->
    <section class="roster-section">
      <h2 class="match-section__title">ROSTER</h2>
      <div v-if="team.loading" class="match-empty">Chargement…</div>
      <div v-else-if="rosterPlayers.length === 0" class="match-empty">Aucun joueur dans l'équipe.</div>
      <div v-else class="roster-grid">
        <div v-for="player in rosterPlayers" :key="player.id" class="roster-card">
          <div class="roster-card__image-wrap">
            <img src="/character.png" :alt="player.username" class="roster-card__image" />
            <div class="roster-card__overlay">
              <div class="roster-card__info">
                <span class="roster-card__ign">{{ player.username }}</span>
                <span class="roster-card__role">{{ player.game_role.toUpperCase() }}</span>
              </div>
              <div class="roster-card__score">
                <div class="roster-card__score-badge roster-card__score-badge--available">—</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: fadeIn 0.4s ease-out forwards;
}

/* Header */
.dash-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18px;
}

.dash-header__greeting {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: #8892B0;
  margin: 0 0 2px 0;
}

.dash-header__title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: #EEF2FF;
  margin: 0;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.dash-header__badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: color-mix(in srgb,var(--accent) 10%,transparent);
  border: 1px solid color-mix(in srgb,var(--accent) 30%,transparent);
  border-radius: 20px;
  padding: 6px 14px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 2px;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  background: #111520;
  border: 1px solid #1A1F2E;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.stat-card:hover {
  border-color: #2A2F40;
}

.stat-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.stat-card__label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  color: #8892B0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-card__value {
  font-family: 'Rajdhani', sans-serif;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 1px;
}

.stat-card__sub {
  position: absolute;
  bottom: 12px;
  right: 14px;
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  color: #3D4460;
}

/* Layout grid */
.matches-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.match-section {
  --bd-angle: 0deg;
  background:
    linear-gradient(var(--bg-card), var(--bg-card)) padding-box,
    conic-gradient(
      from var(--bd-angle),
      var(--border) 0%,
      var(--border) 35%,
      color-mix(in srgb, var(--accent) 50%, var(--border)) 44%,
      var(--accent) 50%,
      color-mix(in srgb, var(--accent) 50%, var(--border)) 56%,
      var(--border) 65%,
      var(--border) 100%
    ) border-box;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 18px;
  animation: border-liquid 6s linear infinite;
}

.match-section__title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--accent);
  text-transform: uppercase;
  margin: 0 0 16px 0;
}

.match-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.match-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
  gap: 10px;
  align-items: stretch;
}

/* Compact match cards */
.match-card-compact {
  background: #0D1018;
  border: 1px solid #1A1F2E;
  border-radius: 6px;
  padding: 10px 12px;
  transition: border-color 0.2s;
  position: relative;
}

.match-card-compact:hover {
  border-color: #2A2F40;
}

.match-card-compact__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.match-card-compact__date {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  color: #8892B0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.match-card-compact__status {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  border: 2px solid;
}

.match-card-compact__status--win {
  background: rgba(16, 185, 129, 0.15);
  color: #10B981;
  border-color: #10B981;
}

.match-card-compact__status--loss {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
  border-color: #EF4444;
}

.match-card-compact__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.match-card-compact__logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}

.match-card-compact__name {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #EEF2FF;
  letter-spacing: 1px;
  flex: 1;
}

.match-card-compact__score {
  font-family: 'Rajdhani', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #EEF2FF;
  min-width: 20px;
  text-align: right;
}

/* ── Upcoming cards (same skeleton as bo-card) ── */
.uc-card {
  background: #0D1018;
  border: 1px solid #1A1F2E;
  border-radius: 6px;
  padding: 12px;
  position: relative;
  height: 100%;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  transition: border-color .2s;
  box-sizing: border-box;
}
.uc-card:hover { border-color: #2A2F40; }

/* Head */
.uc-card__head { display: flex; align-items: center; justify-content: space-between; }
.uc-card__date { font-family: 'Inter', sans-serif; font-size: 10px; color: #8892B0; text-transform: uppercase; letter-spacing: .5px; }
.uc-card__type {
  font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
  color: var(--accent); background: color-mix(in srgb,var(--accent) 10%,transparent);
  border: 1px solid color-mix(in srgb,var(--accent) 25%,transparent);
  border-radius: 4px; padding: 1px 6px;
}

/* Center matchup */
.uc-card__matchup { display: flex; align-items: center; justify-content: space-between; flex: 1; }
.uc-card__side { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; min-width: 0; }
.uc-card__side--right { align-items: flex-end; }
.uc-card__logo-wrap {
  width: 38px; height: 38px; border-radius: 7px; overflow: hidden;
  background: #1A1F2E; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.uc-card__logo-img { width: 100%; height: 100%; object-fit: contain; }
.uc-card__logo-letter { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; color: var(--accent); }
.uc-card__name {
  font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px;
  color: #EEF2FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}
.uc-card__vs {
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: #3D4460;
  letter-spacing: 1px; flex-shrink: 0; padding: 0 8px;
}

/* Foot */
.uc-card__foot { display: flex; align-items: center; justify-content: space-between; }
.uc-card__time { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: var(--accent); letter-spacing: 1px; }
.uc-card__status { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #3D4460; }

/* Old match card styles - kept for reference */
/*
.match-card {
  background: #0D1018;
  border: 1px solid #1A1F2E;
  border-radius: 8px;
  padding: 14px;
  position: relative;
  transition: border-color 0.2s;
}

.match-card:hover {
  border-color: #2A2F40;
}

.match-card__date {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  color: #8892B0;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.match-card__status {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.match-card__status--win {
  background: rgba(16, 185, 129, 0.15);
  color: #10B981;
}

.match-card__status--loss {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}

.match-card__event {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  color: #EEF2FF;
  margin-bottom: 4px;
  line-height: 1.4;
}

.match-card__time {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 12px;
}

.match-card__teams {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.match-card__team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.match-card__logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
  filter: drop-shadow(0 0 4px color-mix(in srgb,var(--accent) 40%,transparent));
}

.match-card__name {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #EEF2FF;
  letter-spacing: 2px;
}

.match-card__score {
  font-family: 'Rajdhani', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #EEF2FF;
  letter-spacing: 1px;
  flex-shrink: 0;
}

.match-card__vs {
  font-family: 'Rajdhani', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #3D4460;
  letter-spacing: 1px;
  flex-shrink: 0;
}
*/

.dash-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Roster Section */
.roster-section {
  --bd-angle: 0deg;
  background:
    linear-gradient(var(--bg-card), var(--bg-card)) padding-box,
    conic-gradient(
      from var(--bd-angle),
      var(--border) 0%,
      var(--border) 35%,
      color-mix(in srgb, var(--accent) 50%, var(--border)) 44%,
      var(--accent) 50%,
      color-mix(in srgb, var(--accent) 50%, var(--border)) 56%,
      var(--border) 65%,
      var(--border) 100%
    ) border-box;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 18px;
  animation: border-liquid 6s linear infinite;
}

.roster-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

.roster-card {
  position: relative;
  background: linear-gradient(135deg, #0D1018 0%, #111520 100%);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #1A1F2E;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
}

.roster-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.roster-card:hover {
  border-color: var(--accent);
  transform: translateY(-6px);
  box-shadow: 0 12px 32px color-mix(in srgb,var(--accent) 15%,transparent), 0 0 0 1px color-mix(in srgb,var(--accent) 10%,transparent);
}

.roster-card:hover::before {
  opacity: 1;
}

.roster-card__image-wrap {
  position: relative;
  aspect-ratio: 3/4;
  overflow: hidden;
  clip-path: polygon(
    0 8%,
    15% 0,
    85% 0,
    100% 8%,
    100% 92%,
    85% 100%,
    15% 100%,
    0 92%
  );
  margin: 8px;
}

.roster-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  transition: transform 0.4s ease;
}

.roster-card:hover .roster-card__image {
  transform: scale(1.08);
}

.roster-card__overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(
    to top,
    rgba(8, 10, 16, 0.98) 0%,
    rgba(8, 10, 16, 0.85) 50%,
    transparent 100%
  );
  padding: 20px 12px 14px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.roster-card__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.roster-card__ign {
  font-family: 'Rajdhani', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #EEF2FF;
  letter-spacing: 1.5px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  text-transform: uppercase;
  text-align: center;
}

.roster-card__role {
  font-family: 'Rajdhani', sans-serif;
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 2px;
  text-transform: uppercase;
  text-align: center;
}

.roster-card__score {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 2px;
}

.roster-card__score-label {
  font-family: 'Inter', sans-serif;
  font-size: 8px;
  color: #3D4460;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.roster-card__score-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 6px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  align-self: center;
  position: relative;
  overflow: hidden;
}

.roster-card__score-badge::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.5s ease;
}

.roster-card:hover .roster-card__score-badge::before {
  left: 100%;
}

.roster-card__score-badge--available {
  background: linear-gradient(135deg, color-mix(in srgb,var(--accent) 20%,transparent), color-mix(in srgb,var(--accent-2) 15%,transparent));
  color: var(--accent);
  border: 1px solid color-mix(in srgb,var(--accent) 40%,transparent);
  box-shadow: 0 0 12px color-mix(in srgb,var(--accent) 20%,transparent);
}
.roster-card__score-badge--sub {
  background: rgba(139,148,170,.08);
  color: #8892B0;
  border: 1px solid rgba(139,148,170,.25);
}

/* Section */
.dash-section {
  background: #111520;
  border: 1px solid #1A1F2E;
  border-radius: 8px;
  padding: 18px;
}

.dash-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.dash-section__title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #EEF2FF;
  text-transform: uppercase;
  margin: 0;
}

.dash-section__action {
  font-family: 'Rajdhani', sans-serif;
  font-size: 11px;
  color: var(--accent);
  letter-spacing: 1px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease;
}

.dash-section__action:hover { color: var(--accent-2); }

/* Roster */
.roster-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #0D1018;
  border: 1px solid #1A1F2E;
  transition: all 0.15s ease;
}

.player-card:hover {
  border-color: #2A2F40;
  background: #111828;
}

.player-card--sub {
  opacity: 0.7;
}

.player-card__role {
  font-family: 'Rajdhani', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid;
  flex-shrink: 0;
  min-width: 42px;
  text-align: center;
}

.player-card__info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.player-card__ign {
  font-family: 'Rajdhani', sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: #EEF2FF;
  letter-spacing: 1px;
}

.player-card__sub-tag {
  font-family: 'Rajdhani', sans-serif;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #8892B0;
  background: #1A1F2E;
  padding: 2px 5px;
  border-radius: 3px;
}

.player-card__stats {
  display: flex;
  gap: 12px;
  align-items: center;
}

.player-card__kda {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.player-card__wr {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  color: #8892B0;
}

.player-card__status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-card__status--available { background: #10B981; box-shadow: 0 0 5px rgba(16,185,129,0.6); }
.player-card__status--unavailable { background: #EF4444; }
.player-card__status--uncertain { background: #F59E0B; }

/* Matches */
.matches-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.match-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  min-height: 56px;
  border-radius: 6px;
  background: #0D1018;
  border: 1px solid #1A1F2E;
}

.match-row__result {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.match-row__result--win { background: rgba(16,185,129,0.15); color: #10B981; }
.match-row__result--loss { background: rgba(239,68,68,0.15); color: #EF4444; }

.match-row__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.match-row__opponent {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #EEF2FF;
  letter-spacing: 1px;
}

.match-row__meta {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  color: #8892B0;
}

.match-row__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.match-row__type {
  font-family: 'Rajdhani', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #3D4460;
}

.match-row__date {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  color: #3D4460;
}

/* Events */
.events-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 6px;
  background: #0D1018;
  border: 1px solid #1A1F2E;
  transition: border-color 0.15s;
}

.event-card:hover { border-color: #2A2F40; }

.event-card__type {
  font-family: 'Rajdhani', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 3px 7px;
  border-radius: 4px;
  border: 1px solid;
  flex-shrink: 0;
  margin-top: 1px;
}

.event-card__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.event-card__title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #EEF2FF;
  letter-spacing: 0.5px;
}

.event-card__date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  color: #8892B0;
}

/* Empty state */
.match-empty {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: #3D4460;
  padding: 24px 0;
  text-align: center;
}

/* HUD corner brackets */
.match-card-compact {
  min-height: 140px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.mc-corner {
  position: absolute;
  width: 8px; height: 8px;
  border-color: var(--mc, var(--accent));
  border-style: solid;
  opacity: .45;
  pointer-events: none;
}
.mc-corner--tl { top: 5px; left: 4px;   border-width: 1px 0 0 1px; }
.mc-corner--tr { top: 5px; right: 4px;  border-width: 1px 1px 0 0; }
.mc-corner--bl { bottom: 5px; left: 4px;  border-width: 0 0 1px 1px; }
.mc-corner--br { bottom: 5px; right: 4px; border-width: 0 1px 1px 0; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* BO Cards — compact grid (same structure as match-card-compact) */
.bo-card {
  background: #0D1018;
  border: 1px solid #1A1F2E;
  border-radius: 6px;
  padding: 12px;
  position: relative;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  transition: border-color .2s;
}
.bo-card:hover { border-color: #2A2F40; }

.bo-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.bo-card__date {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  color: #8892B0;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.bo-card__format {
  font-family: 'Rajdhani', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--accent);
  background: color-mix(in srgb,var(--accent) 10%,transparent);
  border: 1px solid color-mix(in srgb,var(--accent) 25%,transparent);
  border-radius: 4px;
  padding: 1px 6px;
}

.bo-card__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.bo-card__logo-wrap {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  background: #1A1F2E;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bo-card__logo { width: 100%; height: 100%; object-fit: contain; }
.bo-card__letter {
  font-family: 'Rajdhani', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: var(--accent);
}
.bo-card__opponent {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #EEF2FF;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.bo-card__score {
  font-family: 'Rajdhani', sans-serif;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
  text-align: center;
  line-height: 1;
}
.bo-card__score-win  { color: #10B981; }
.bo-card__score-sep  { color: #3D4460; }
.bo-card__score-loss { color: #EF4444; }

.bo-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.bo-card__games { display: flex; gap: 4px; }
.bo-card__dot {
  font-family: 'Rajdhani', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .5px;
  padding: 2px 5px;
  border-radius: 3px;
}
.bo-card__dot--win  { background: rgba(16,185,129,.15); color: #10B981; }
.bo-card__dot--loss { background: rgba(239,68,68,.15);  color: #EF4444; }

.bo-card__result {
  font-family: 'Rajdhani', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
}
.bo-card__result--win  { color: #10B981; }
.bo-card__result--loss { color: #EF4444; }

/* Light mode */
/* Light */
html[data-theme="light"] .bo-card { background: var(--bg-card); border-color: var(--border); }
html[data-theme="light"] .bo-card:hover { border-color: color-mix(in srgb,var(--accent) 40%,transparent); }
html[data-theme="light"] .bo-card__logo-wrap { background: var(--bg-hover); }
html[data-theme="light"] .bo-card__opponent { color: var(--t-primary); }
html[data-theme="light"] .bo-card__date { color: var(--t-dim); }
html[data-theme="light"] .match-empty { color: var(--t-muted); }
html[data-theme="light"] .uc-card { background: var(--bg-card); border-color: var(--border); }
html[data-theme="light"] .uc-card:hover { border-color: color-mix(in srgb,var(--accent) 40%,transparent); background: var(--bg-hover); }
html[data-theme="light"] .uc-card__date { color: var(--t-dim); }
html[data-theme="light"] .uc-card__name { color: var(--t-primary); }
html[data-theme="light"] .uc-card__vs { color: var(--t-muted); }
html[data-theme="light"] .uc-card__logo-wrap { background: var(--bg-hover); }
html[data-theme="light"] .uc-card__status { color: var(--t-muted); }
</style>
