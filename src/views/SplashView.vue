<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

onMounted(() => {
  setTimeout(() => {
    if (auth.isAuthenticated) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, 3200)
})
</script>

<template>
  <div class="splash">
    <!-- Background radial glow -->
    <div class="splash__bg-glow" />

    <!-- Animated grid overlay -->
    <div class="splash__grid" />

    <!-- Center content -->
    <div class="splash__center">
      <!-- Logo wrapper with glow animation -->
      <div class="splash__logo-wrap">
        <img
          src="/logo.png"
          alt="HORNAX"
          class="splash__logo"
        />
        <div class="splash__logo-halo" />
      </div>

      <!-- Wordmark -->
      <div class="splash__wordmark">
        <span
          v-for="(char, i) in 'HORNAX'"
          :key="i"
          class="splash__char"
          :style="{ animationDelay: `${0.8 + i * 0.08}s` }"
        >{{ char }}</span>
      </div>

      <!-- Tagline -->
      <p class="splash__tagline">DOMINATE THE META</p>

      <!-- Loading bar -->
      <div class="splash__bar-wrap">
        <div class="splash__bar" />
      </div>
    </div>

    <!-- Version -->
    <span class="splash__version">v0.1.0</span>
  </div>
</template>

<style scoped>
.splash {
  width: 100vw;
  height: 100vh;
  background: #080A10;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.splash__bg-glow {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb,var(--accent) 12%,transparent) 0%, transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: bgPulse 3s ease-in-out infinite;
}

.splash__grid {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%231A1F2E' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.5;
}

.splash__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  z-index: 1;
}

.splash__logo-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: logoIn 0.8s ease-out forwards;
  opacity: 0;
}

.splash__logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
  position: relative;
  z-index: 1;
  filter:
    drop-shadow(0 10px 20px color-mix(in srgb,var(--accent) 22%,transparent))
    drop-shadow(0 0 12px color-mix(in srgb,var(--accent-2) 20%,transparent));
}

.splash__logo-halo {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 52%,
    rgba(255, 160, 105, 0.2) 0%,
    rgba(255, 121, 43, 0.13) 36%,
    color-mix(in srgb,var(--accent) 6%,transparent) 58%,
    transparent 78%
  );
  filter: blur(3px);
  mix-blend-mode: screen;
  pointer-events: none;
  opacity: 0.52;
  transform: scale(1);
  will-change: opacity, transform;
  animation: haloBreath 3.2s cubic-bezier(0.42, 0, 0.2, 1) infinite;
}

.splash__wordmark {
  display: flex;
  gap: 2px;
  margin-top: 24px;
}

.splash__char {
  font-family: 'Rajdhani', sans-serif;
  font-size: 52px;
  font-weight: 700;
  color: #EEF2FF;
  letter-spacing: 8px;
  opacity: 0;
  animation: charIn 0.4s ease-out forwards;
}

.splash__tagline {
  font-family: 'Rajdhani', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 6px;
  color: var(--accent);
  margin-top: 8px;
  opacity: 0;
  animation: fadeIn 0.6s ease-out 1.6s forwards;
}

.splash__bar-wrap {
  width: 200px;
  height: 1px;
  background: #1A1F2E;
  margin-top: 40px;
  overflow: hidden;
  border-radius: 1px;
  opacity: 0;
  animation: fadeIn 0.3s ease-out 1.8s forwards;
}

.splash__bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 8px color-mix(in srgb,var(--accent) 80%,transparent);
  animation: barFill 2.8s ease-out 1.8s forwards;
}

.splash__version {
  position: absolute;
  bottom: 24px;
  right: 24px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 11px;
  color: #3D4460;
  letter-spacing: 2px;
}

@keyframes logoIn {
  from { opacity: 0; transform: scale(0.7); filter: blur(8px); }
  to { opacity: 1; transform: scale(1); filter: blur(0); }
}

@keyframes charIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes haloBreath {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.62; transform: scale(1.04); }
}

@keyframes bgPulse {
  0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
}

@keyframes barFill {
  from { width: 0%; }
  to { width: 100%; }
}
</style>
