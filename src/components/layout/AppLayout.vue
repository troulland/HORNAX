<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
</script>

<template>
  <div class="app-layout">
    <div class="app-layout__grid" />
    <AppSidebar />
    <div class="app-layout__main">
      <AppHeader />
      <main class="app-layout__content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  background: #0F1320;
  overflow: hidden;
  position: relative;
}

.app-layout__grid {
  position: absolute;
  inset: 0;
  /* DARK (défaut) : traits blancs très légers → visibles sur le fond sombre.
     Le light-mode réécrit ce background-image en teinte foncée (voir style.css). */
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23FFFFFF'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.07;
  pointer-events: none;
  z-index: 0;
}

.app-layout__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.app-layout__content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 28px;
}

@media (max-width: 768px) {
  .app-layout { flex-direction: column; }
  .app-layout__content { padding: 16px 16px 80px; }
}
</style>
