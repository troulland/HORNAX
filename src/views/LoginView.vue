<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { API_BASE as API } from '@/config'

const router = useRouter()
const auth   = useAuthStore()

const error   = ref('')
const loading = ref(false)
const loginId  = ref('')
const loginPwd = ref('')

const mode = ref<'login' | 'register'>('login')

// ── Inscription (crée un joueur ou un coach/viewer) ──────────────
const regUsername = ref('')
const regEmail    = ref('')
const regPwd      = ref('')
const regRole     = ref('coach')
const ROLES = [
  { value: 'top', label: 'Top' }, { value: 'jgl', label: 'Jungle' },
  { value: 'mid', label: 'Mid' }, { value: 'adc', label: 'ADC' },
  { value: 'sup', label: 'Support' }, { value: 'sub', label: 'Remplaçant' },
  { value: 'coach', label: 'Coach (lecture + dispos)' },
  { value: 'viewer', label: 'Viewer (lecture seule, hors dispos)' },
  { value: 'manager', label: 'Manager' },
]

// team slug → id (récupéré depuis l'API, repli 1/2)
const teamIds = ref<Record<string, number>>({ hornax: 1, 'hornax-royalty': 2 })
onMounted(async () => {
  try {
    const res = await fetch(`${API}/teams`)
    if (res.ok) {
      const map: Record<string, number> = {}
      for (const t of await res.json()) map[t.slug] = t.id
      if (Object.keys(map).length) teamIds.value = map
    }
  } catch { /* repli */ }
})

function switchMode(m: 'login' | 'register') { mode.value = m; error.value = '' }

async function handleRegister() {
  if (!regUsername.value || !regEmail.value || !regPwd.value) { error.value = 'Tous les champs sont requis.'; return }
  if (regPwd.value.length < 6) { error.value = 'Mot de passe : 6 caractères min.'; return }
  loading.value = true; error.value = ''
  const slug = selectedTeam.value === 'royalty' ? 'hornax-royalty' : 'hornax'
  const team_id = teamIds.value[slug] ?? (selectedTeam.value === 'royalty' ? 2 : 1)
  const err = await auth.register({
    username: regUsername.value.trim(),
    email: regEmail.value.trim(),
    password: regPwd.value,
    team_id,
    game_role: regRole.value,
  })
  if (err) { error.value = err; loading.value = false }
  else router.push('/dashboard')
}

// ── Team picker (visual only — drives pre-login brand) ──────────────────────
const selectedTeam  = ref<'hornax' | 'royalty'>('hornax')
const logoAnimating = ref(false)

const logoSrc   = { hornax: '/logo.png', royalty: '/hornax-royalty.png' }
const brandName = { hornax: 'HORNAX',    royalty: 'ROYALTY' }

watch(selectedTeam, () => {
  // Apply brand immediately so CSS vars react
  if (selectedTeam.value === 'royalty') {
    document.documentElement.dataset.brand = 'royalty'
  } else {
    delete document.documentElement.dataset.brand
  }
  // Logo flip animation
  logoAnimating.value = true
  setTimeout(() => { logoAnimating.value = false }, 500)
})

async function handleLogin() {
  if (!loginId.value || !loginPwd.value) { error.value = 'Identifiants requis.'; return }
  loading.value = true; error.value = ''
  const err = await auth.login(loginId.value, loginPwd.value)
  if (err) { error.value = err; loading.value = false }
  else router.push('/dashboard')
}
</script>

<template>
  <div class="login">
    <div class="login__bg">
      <div class="login__bg-glow" />
    </div>
    <div class="login__grid" />

    <!-- Left panel -->
    <div class="login__left">
      <div class="login__left-content">
        <img src="/hornax2.webp" alt="" class="login__bg-mockup" />
        <div class="login__left-overlay" />
        <div class="login__tagblock">
          <span class="login__tag-eyebrow">ESPORTS MANAGEMENT PLATFORM</span>
          <h1 class="login__tag-title">Contrôle.<br/>Stratégie.<br/>Domination.</h1>
          <p class="login__tag-sub">L'outil qui donne l'avantage compétitif réel.</p>
        </div>
      </div>
    </div>

    <!-- Right panel -->
    <div class="login__right">
      <div class="login__form-wrap">

        <!-- Logo + brand -->
        <div class="login__logo-row">
          <img
            :src="logoSrc[selectedTeam]"
            alt="HORNAX"
            class="login__logo"
            :class="{ 'login__logo--flip': logoAnimating }"
          />
          <span class="login__brand">{{ brandName[selectedTeam] }}</span>
        </div>
        <div class="login__divider" />

        <!-- Team picker -->
        <div class="login__team-picker">
          <button
            type="button"
            class="login__team-btn"
            :class="{ 'login__team-btn--active': selectedTeam === 'hornax' }"
            @click="selectedTeam = 'hornax'"
          >
            <img src="/logo.png" class="login__team-icon" />
            <span>HORNAX</span>
          </button>
          <button
            type="button"
            class="login__team-btn"
            :class="{ 'login__team-btn--active': selectedTeam === 'royalty' }"
            @click="selectedTeam = 'royalty'"
          >
            <img src="/hornax-royalty.png" class="login__team-icon" />
            <span>ROYALTY</span>
          </button>
        </div>

        <!-- Connexion -->
        <form v-if="mode === 'login'" class="login__form" @submit.prevent="handleLogin">
          <h2 class="login__heading">Connexion</h2>
          <p class="login__subheading">Accès réservé aux membres de l'équipe</p>

          <div class="login__field">
            <label class="hx-label">Identifiant ou email</label>
            <input v-model="loginId" type="text" class="hx-input" placeholder="Pseudo ou email" autocomplete="username" />
          </div>

          <div class="login__field">
            <label class="hx-label">Mot de passe</label>
            <input v-model="loginPwd" type="password" class="hx-input" placeholder="••••••••" autocomplete="current-password" />
          </div>

          <Transition name="err">
            <p v-if="error" class="login__error">{{ error }}</p>
          </Transition>

          <button type="submit" class="login__submit" :class="{ 'login__submit--loading': loading }" :disabled="loading">
            <span v-if="!loading">SE CONNECTER</span>
            <span v-else class="login__spinner" />
          </button>
        </form>

        <!-- Inscription (joueur ou coach/viewer) -->
        <form v-else class="login__form" @submit.prevent="handleRegister">
          <h2 class="login__heading">Inscription</h2>
          <p class="login__subheading">Rejoins {{ brandName[selectedTeam] }} — joueur ou coach / viewer</p>

          <div class="login__field">
            <label class="hx-label">Pseudo</label>
            <input v-model="regUsername" type="text" class="hx-input" placeholder="Ton pseudo" autocomplete="username" />
          </div>
          <div class="login__field">
            <label class="hx-label">Email</label>
            <input v-model="regEmail" type="email" class="hx-input" placeholder="email@exemple.com" autocomplete="email" />
          </div>
          <div class="login__field">
            <label class="hx-label">Mot de passe</label>
            <input v-model="regPwd" type="password" class="hx-input" placeholder="6 caractères min." autocomplete="new-password" />
          </div>
          <div class="login__field">
            <label class="hx-label">Rôle</label>
            <select v-model="regRole" class="hx-input">
              <option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>

          <Transition name="err">
            <p v-if="error" class="login__error">{{ error }}</p>
          </Transition>

          <button type="submit" class="login__submit" :disabled="loading">
            <span v-if="!loading">CRÉER LE COMPTE</span>
            <span v-else class="login__spinner" />
          </button>
        </form>

        <p class="login__forgot">
          <template v-if="mode === 'login'">Pas de compte ? <button type="button" class="login__link" @click="switchMode('register')">S'inscrire</button></template>
          <template v-else>Déjà un compte ? <button type="button" class="login__link" @click="switchMode('login')">Se connecter</button></template>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login {
  width: 100vw; height: 100vh;
  display: flex; background: #0F1320;
  position: relative; overflow: hidden;
}

.login__bg { position: absolute; inset: 0; z-index: 0; }
.login__bg-glow {
  position: absolute; width: 500px; height: 500px; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb,var(--accent) 10%,transparent) 0%, transparent 70%);
  right: 10%; top: 50%; transform: translateY(-50%);
  transition: background .5s ease;
}
.login__grid {
  position: absolute; inset: 0; z-index: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%231A1F2E' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

/* LEFT */
.login__left { flex: 1; position: relative; overflow: hidden; display: none; }
@media (min-width: 1024px) { .login__left { display: block; } .login__right { width: 460px; } }
.login__left-content { position: absolute; inset: 0; }
.login__bg-mockup { width: 100%; height: 100%; object-fit: cover; object-position: center; opacity: .4; }
.login__left-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to right, transparent 0%, rgba(8,10,16,.4) 70%, #0F1320 100%);
}
.login__tagblock { position: absolute; bottom: 60px; left: 48px; right: 80px; z-index: 1; }
.login__tag-eyebrow { font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 4px; color: var(--accent); display: block; margin-bottom: 12px; transition: color .4s ease; }
.login__tag-title { font-family: 'Rajdhani', sans-serif; font-size: 48px; font-weight: 700; color: #EEF2FF; line-height: 1.1; margin: 0 0 16px 0; }
.login__tag-sub { font-family: 'Inter', sans-serif; font-size: 14px; color: #8892B0; margin: 0; }

/* RIGHT */
.login__right {
  flex-shrink: 0; width: 100%;
  display: flex; align-items: center; justify-content: center;
  padding: 32px 24px; z-index: 1; position: relative; overflow-y: auto;
}
.login__form-wrap { width: 100%; max-width: 400px; animation: slideUp .6s ease-out forwards; }

/* Logo */
.login__logo-row { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.login__logo {
  width: 36px; height: 36px; object-fit: contain;
  filter: drop-shadow(0 0 8px color-mix(in srgb,var(--accent) 60%,transparent));
  transition: filter .4s ease;
}
.login__logo--flip {
  animation: logo-flip .45s ease;
}
@keyframes logo-flip {
  0%   { transform: scale(1) rotate(0deg);   opacity: 1; }
  40%  { transform: scale(0) rotate(-90deg); opacity: 0; }
  41%  { transform: scale(0) rotate(90deg);  opacity: 0; }
  100% { transform: scale(1) rotate(0deg);   opacity: 1; }
}

.login__brand {
  font-family: 'Rajdhani', sans-serif; font-size: 24px; font-weight: 700;
  color: #EEF2FF; letter-spacing: 4px;
  transition: color .4s ease;
}
.login__divider {
  height: 1px;
  background: linear-gradient(90deg, var(--accent) 0%, #2B3346 100%);
  margin-bottom: 24px;
  transition: background .4s ease;
}

/* Team picker */
.login__team-picker {
  display: flex; gap: 8px; margin-bottom: 28px;
}
.login__team-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid #2B3346; background: #151A27;
  font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700;
  letter-spacing: 2px; color: #616C8A;
  transition: all .25s ease;
}
.login__team-btn:hover { border-color: var(--accent); color: #8892B0; }
.login__team-btn--active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 20%, transparent);
}
.login__team-icon {
  width: 20px; height: 20px; object-fit: contain;
  filter: drop-shadow(0 0 4px color-mix(in srgb,var(--accent) 50%,transparent));
  transition: filter .4s ease;
}

/* Form */
.login__form { display: flex; flex-direction: column; gap: 16px; }
.login__heading { font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; color: #EEF2FF; margin: 0 0 2px 0; letter-spacing: 2px; }
.login__subheading { font-family: 'Inter', sans-serif; font-size: 12px; color: #8892B0; margin: 0 0 8px 0; }
.login__field { display: flex; flex-direction: column; gap: 6px; }

.login__error { font-family: 'Inter', sans-serif; font-size: 12px; color: #EF4444; margin: 0; padding: 8px 12px; background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.2); border-radius: 4px; }

.login__submit {
  width: 100%; padding: 13px; background: var(--accent); color: white; border: none; border-radius: 4px;
  font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 3px;
  cursor: pointer; transition: all .2s ease; display: flex; align-items: center; justify-content: center; margin-top: 4px;
}
.login__submit:hover:not(:disabled) {
  background: var(--accent-2);
  box-shadow: 0 0 20px color-mix(in srgb,var(--accent) 40%,transparent);
  transform: translateY(-1px);
}
.login__submit:disabled { opacity: .7; cursor: not-allowed; }
.login__spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .6s linear infinite; display: block; }

.login__forgot { font-family: 'Inter', sans-serif; font-size: 12px; color: #616C8A; text-align: center; margin-top: 16px; }
.login__link { background: none; border: none; color: var(--accent); font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; padding: 0; text-decoration: underline; }
.login__link:hover { color: var(--accent-2); }

@keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
.err-enter-active, .err-leave-active { transition: all .3s ease; }
.err-enter-from, .err-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
