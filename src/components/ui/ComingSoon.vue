<script setup lang="ts">
import { Lock } from 'lucide-vue-next'
defineProps<{ title: string }>()
</script>

<template>
  <div class="cs-wrapper">
    <div class="cs-content" aria-hidden="true">
      <slot />
    </div>
    <div class="cs-overlay">
      <div class="cs-panel">
        <div class="cs-icon-wrap">
          <Lock :size="28" class="cs-icon" />
          <div class="cs-icon-ring" />
        </div>
        <h2 class="cs-title">{{ title }}</h2>
        <p class="cs-sub">Cette fonctionnalité est en développement</p>
        <div class="cs-badge">COMING SOON</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cs-wrapper {
  position: relative;
  width: 100%;
  min-height: 400px;
}
.cs-content {
  filter: blur(6px);
  opacity: 0.25;
  pointer-events: none;
  user-select: none;
}
.cs-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.cs-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 52px;
  background: rgba(13, 16, 24, 0.94);
  border: 1px solid #2B3346;
  border-radius: 12px;
  backdrop-filter: blur(16px);
  text-align: center;
  animation: csIn 0.4s ease-out forwards;
}
.cs-icon-wrap {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cs-icon { color: var(--accent); position: relative; z-index: 1; }
.cs-icon-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb,var(--accent) 30%,transparent);
  animation: ringPulse 2s ease-in-out infinite;
}
.cs-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 4px;
  color: #EEF2FF;
  margin: 0;
  text-transform: uppercase;
}
.cs-sub {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: #8892B0;
  margin: 0;
}
.cs-badge {
  font-family: 'Rajdhani', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--accent);
  border: 1px solid color-mix(in srgb,var(--accent) 30%,transparent);
  background: color-mix(in srgb,var(--accent) 8%,transparent);
  padding: 5px 18px;
  border-radius: 20px;
  margin-top: 4px;
}
@keyframes ringPulse {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50%       { transform: scale(1.35); opacity: 0.1; }
}
@keyframes csIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
