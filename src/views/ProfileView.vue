<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { User, Lock, Sun, Moon, Shield, CheckCircle } from 'lucide-vue-next'
import type { AuthUser } from '@/stores/auth'
import { API_BASE as API } from '@/config'
const auth  = useAuthStore()
const theme = useThemeStore()

/* ── Infos ──────────────────────────────────────── */
const infoUser  = ref(auth.user?.username ?? '')
const infoEmail = ref(auth.user?.email ?? '')
const infoMsg   = ref<{ text: string; ok: boolean } | null>(null)
const infoLoad  = ref(false)

async function saveInfo() {
  if (!infoUser.value.trim() || !infoEmail.value.trim()) return
  infoLoad.value = true; infoMsg.value = null
  try {
    const res  = await fetch(`${API}/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ username: infoUser.value.trim(), email: infoEmail.value.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { infoMsg.value = { text: data.error, ok: false } }
    else {
      auth.user = { ...auth.user!, username: data.username, email: data.email } as AuthUser
      localStorage.setItem('hx_user', JSON.stringify(auth.user))
      infoMsg.value = { text: 'Informations mises à jour.', ok: true }
    }
  } catch { infoMsg.value = { text: 'Erreur réseau.', ok: false } }
  finally { infoLoad.value = false }
}

async function saveAll() {
  await Promise.all([saveInfo(), saveRiotId()])
}

/* ── Riot ID ─────────────────────────────────────── */
const riotIdVal  = ref(auth.user?.riot_id ?? '')
const riotMsg    = ref<{ text: string; ok: boolean } | null>(null)
const riotLoad   = ref(false)

async function saveRiotId() {
  riotLoad.value = true; riotMsg.value = null
  try {
    const res = await fetch(`${API}/players/me/riot-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ riot_id: riotIdVal.value.trim() || null }),
    })
    const data = await res.json()
    if (!res.ok) { riotMsg.value = { text: data.error ?? 'Erreur.', ok: false } }
    else {
      if (auth.user) {
        auth.user = { ...auth.user, riot_id: data.riot_id }
        localStorage.setItem('hx_user', JSON.stringify(auth.user))
      }
      riotMsg.value = { text: 'Riot ID sauvegardé.', ok: true }
    }
  } catch { riotMsg.value = { text: 'Erreur réseau.', ok: false } }
  finally { riotLoad.value = false }
}

/* ── Mot de passe ───────────────────────────────── */
const pwdCurrent = ref('')
const pwdNew     = ref('')
const pwdConfirm = ref('')
const pwdMsg     = ref<{ text: string; ok: boolean } | null>(null)
const pwdLoad    = ref(false)

async function savePassword() {
  pwdMsg.value = null
  if (!pwdCurrent.value || !pwdNew.value || !pwdConfirm.value) {
    pwdMsg.value = { text: 'Tous les champs sont requis.', ok: false }; return
  }
  if (pwdNew.value !== pwdConfirm.value) {
    pwdMsg.value = { text: 'Les mots de passe ne correspondent pas.', ok: false }; return
  }
  pwdLoad.value = true
  try {
    const res  = await fetch(`${API}/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ currentPassword: pwdCurrent.value, newPassword: pwdNew.value }),
    })
    const data = await res.json()
    if (!res.ok) { pwdMsg.value = { text: data.error, ok: false } }
    else {
      pwdMsg.value = { text: 'Mot de passe mis à jour.', ok: true }
      pwdCurrent.value = pwdNew.value = pwdConfirm.value = ''
    }
  } catch { pwdMsg.value = { text: 'Erreur réseau.', ok: false } }
  finally { pwdLoad.value = false }
}

/* ── Helpers ────────────────────────────────────── */
const ROLE_COLOR: Record<string, string> = {
  top: '#FBBF24', jgl: '#34D399', mid: '#60A5FA',
  adc: '#F87171', sup: '#C084FC', sub: '#8892B0',
  coach: 'var(--accent)', manager: '#EEF2FF',
}
const roleColor = computed(() => ROLE_COLOR[auth.user?.game_role ?? ''] ?? '#8892B0')
</script>

<template>
  <div class="profile">
    <!-- En-tête profil -->
    <header class="profile__hdr">
      <div class="profile__avatar" :style="{ background: `linear-gradient(135deg, ${roleColor}33, ${roleColor}11)`, borderColor: `${roleColor}44` }">
        <span class="profile__avatar-letter">{{ auth.user?.username?.charAt(0).toUpperCase() ?? 'H' }}</span>
      </div>
      <div>
        <span class="profile__eye">MON COMPTE</span>
        <h1 class="profile__name">{{ auth.user?.username ?? '—' }}</h1>
        <div class="profile__meta">
          <span class="profile__role-badge" :style="{ color: roleColor, borderColor: `${roleColor}44`, background: `${roleColor}14` }">
            {{ auth.user?.game_role?.toUpperCase() ?? 'N/A' }}
          </span>
          <span class="profile__team">{{ auth.user?.team_name ?? '—' }}</span>
        </div>
      </div>

      <!-- Toggle thème dans le header de page -->
      <button class="profile__theme-toggle" @click="theme.toggle()">
        <component :is="theme.isDark ? Sun : Moon" :size="15" />
        {{ theme.isDark ? 'Mode clair' : 'Mode sombre' }}
      </button>
    </header>

    <div class="profile__grid">
      <!-- ── INFORMATIONS ─────────────────────────── -->
      <section class="pcard">
        <div class="pcard__head">
          <User :size="15" class="pcard__head-icon" />
          <span class="pcard__head-title">INFORMATIONS</span>
        </div>

        <div class="pcard__body">
          <div class="pcard__field">
            <label class="hx-label">Pseudo (IGN)</label>
            <input v-model="infoUser" class="hx-input" placeholder="Ton pseudo" autocomplete="username" />
          </div>
          <div class="pcard__field">
            <label class="hx-label">Email</label>
            <input v-model="infoEmail" class="hx-input" type="email" placeholder="ton@email.com" autocomplete="email" />
          </div>
          <div class="pcard__field">
            <label class="hx-label">Riot ID <span class="pcard__field-hint">utilisé pour charger tes stats</span></label>
            <input v-model="riotIdVal" class="hx-input" placeholder="Pseudo#TAG" autocomplete="off" />
          </div>
          <Transition name="msg">
            <div v-if="infoMsg || riotMsg" class="pcard__msg" :class="(infoMsg ?? riotMsg)!.ok ? 'pcard__msg--ok' : 'pcard__msg--err'">
              <CheckCircle v-if="(infoMsg ?? riotMsg)!.ok" :size="13" />
              {{ (infoMsg ?? riotMsg)!.text }}
            </div>
          </Transition>

          <button class="pcard__save" :disabled="infoLoad || riotLoad" @click="saveAll">
            <span v-if="!infoLoad && !riotLoad">ENREGISTRER</span>
            <span v-else class="pcard__spinner" />
          </button>
        </div>
      </section>

      <!-- ── SÉCURITÉ ────────────────────────────── -->
      <section class="pcard">
        <div class="pcard__head">
          <Lock :size="15" class="pcard__head-icon" />
          <span class="pcard__head-title">SÉCURITÉ</span>
        </div>

        <div class="pcard__body">
          <div class="pcard__field">
            <label class="hx-label">Mot de passe actuel</label>
            <input v-model="pwdCurrent" class="hx-input" type="password" placeholder="••••••••" autocomplete="current-password" />
          </div>
          <div class="pcard__field">
            <label class="hx-label">Nouveau mot de passe</label>
            <input v-model="pwdNew" class="hx-input" type="password" placeholder="6 caractères minimum" autocomplete="new-password" />
          </div>
          <div class="pcard__field">
            <label class="hx-label">Confirmation</label>
            <input v-model="pwdConfirm" class="hx-input" type="password" placeholder="••••••••" autocomplete="new-password" />
          </div>

          <Transition name="msg">
            <div v-if="pwdMsg" class="pcard__msg" :class="pwdMsg.ok ? 'pcard__msg--ok' : 'pcard__msg--err'">
              <CheckCircle v-if="pwdMsg.ok" :size="13" />
              {{ pwdMsg.text }}
            </div>
          </Transition>

          <button class="pcard__save" :disabled="pwdLoad" @click="savePassword">
            <span v-if="!pwdLoad">CHANGER LE MOT DE PASSE</span>
            <span v-else class="pcard__spinner" />
          </button>
        </div>
      </section>

      <!-- ── THÈME ───────────────────────────────── -->
      <section class="pcard pcard--theme">
        <div class="pcard__head">
          <Shield :size="15" class="pcard__head-icon" />
          <span class="pcard__head-title">APPARENCE</span>
        </div>
        <div class="pcard__body pcard__body--row">
          <button
            class="theme-option"
            :class="{ 'theme-option--active': theme.isDark }"
            @click="theme.isDark || theme.toggle()"
          >
            <Moon :size="22" />
            <span>Mode sombre</span>
            <span class="theme-option__sub">Recommandé</span>
          </button>
          <button
            class="theme-option"
            :class="{ 'theme-option--active': !theme.isDark }"
            @click="!theme.isDark || theme.toggle()"
          >
            <Sun :size="22" />
            <span>Mode clair</span>
            <span class="theme-option__sub">Pour la journée</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.profile { display: flex; flex-direction: column; gap: 24px; animation: fadeIn .4s ease-out both; }

/* Header profil */
.profile__hdr { display: flex; align-items: center; gap: 20px; }
.profile__avatar {
  width: 72px; height: 72px; border-radius: 50%; border: 2px solid;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.profile__avatar-letter { font-family: 'Rajdhani', sans-serif; font-size: 32px; font-weight: 700; color: #EEF2FF; }
.profile__eye { display: block; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 4px; color: var(--accent); margin-bottom: 4px; }
.profile__name { font-family: 'Rajdhani', sans-serif; font-size: 28px; font-weight: 700; letter-spacing: 3px; color: #EEF2FF; margin: 0 0 8px 0; }
.profile__meta { display: flex; align-items: center; gap: 10px; }
.profile__role-badge { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; padding: 3px 10px; border-radius: 4px; border: 1px solid; }
.profile__team { font-family: 'Inter', sans-serif; font-size: 12px; color: #8892B0; }

.profile__theme-toggle {
  margin-left: auto; display: flex; align-items: center; gap: 7px;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 2px; color: #8892B0;
  background: #1B2030; border: 1px solid #2B3346; border-radius: 6px; padding: 8px 14px; cursor: pointer; transition: all .15s;
}
.profile__theme-toggle:hover { border-color: var(--accent); color: #EEF2FF; }

/* Grid */
.profile__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* Cards */
.pcard { background: #1B2030; border: 1px solid #2B3346; border-radius: 10px; overflow: hidden; }
.pcard--theme { grid-column: 1 / -1; }
.pcard__head { display: flex; align-items: center; gap: 8px; padding: 14px 20px; border-bottom: 1px solid #2B3346; }
.pcard__head-icon { color: var(--accent); flex-shrink: 0; }
.pcard__head-title { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #616C8A; }
.pcard__body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.pcard__body--row { flex-direction: row; gap: 12px; }
.pcard__field { display: flex; flex-direction: column; }
.pcard__field-hint { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 400; letter-spacing: 0; color: #616C8A; margin-left: 6px; }

/* Messages */
.pcard__msg { display: flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif; font-size: 12px; padding: 8px 12px; border-radius: 4px; }
.pcard__msg--ok  { color: #10B981; background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.2); }
.pcard__msg--err { color: #EF4444; background: rgba(239,68,68,.1);   border: 1px solid rgba(239,68,68,.2); }

/* Bouton save */
.pcard__save {
  padding: 11px; background: var(--accent); color: white; border: none; border-radius: 5px;
  font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 3px;
  cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; margin-top: 4px;
}
.pcard__save:hover:not(:disabled) { background: var(--accent-2); box-shadow: 0 0 18px color-mix(in srgb,var(--accent) 35%,transparent); }
.pcard__save:disabled { opacity: .6; cursor: not-allowed; }
.pcard__spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .6s linear infinite; }

/* Theme options */
.theme-option {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px;
  background: #151A27; border: 1px solid #2B3346; border-radius: 8px; cursor: pointer;
  color: #8892B0; transition: all .2s;
  font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 1.5px;
}
.theme-option:hover { border-color: #3A4358; color: #EEF2FF; }
.theme-option--active { border-color: var(--accent); background: color-mix(in srgb,var(--accent) 6%,transparent); color: #EEF2FF; }
.theme-option__sub { font-family: 'Inter', sans-serif; font-size: 10px; color: #616C8A; font-weight: 400; letter-spacing: 0; }
.theme-option--active .theme-option__sub { color: #8892B0; }

/* Light theme overrides */
html[data-theme="light"] .pcard { background: #FFFFFF; border-color: #E0E3EF; }
html[data-theme="light"] .pcard__head { border-bottom-color: #E0E3EF; }
html[data-theme="light"] .pcard__head-title { color: #8892B0; }
html[data-theme="light"] .profile__avatar-letter { color: #0D1220; }
html[data-theme="light"] .profile__name { color: #0D1220; }
html[data-theme="light"] .profile__team { color: #4A5280; }
html[data-theme="light"] .profile__theme-toggle { background: #FFF5EE; border-color: color-mix(in srgb,var(--accent) 30%,transparent); color: #4A5280; }
html[data-theme="light"] .profile__theme-toggle:hover { border-color: var(--accent); color: var(--accent); }
html[data-theme="light"] .theme-option { background: #FAFBFE; border-color: #C8CDDF; color: #4A5280; }
html[data-theme="light"] .theme-option:hover { border-color: var(--accent); color: #0D1220; background: color-mix(in srgb,var(--accent) 5%,transparent); }
html[data-theme="light"] .theme-option--active { border-color: var(--accent); background: color-mix(in srgb,var(--accent) 7%,transparent); color: #0D1220; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin    { to { transform: rotate(360deg); } }
.msg-enter-active, .msg-leave-active { transition: all .25s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-4px); }

@media (max-width: 768px) {
  .profile__grid { grid-template-columns: 1fr !important; }
  .profile__hdr { flex-wrap: wrap; }
  .profile__theme-toggle { width: 100%; justify-content: center; margin-left: 0; margin-top: 8px; }
  .pcard__body--row { flex-direction: column; }
  .theme-option { flex-direction: row; padding: 14px 16px; gap: 12px; }
}
</style>
