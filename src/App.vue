<script setup lang="ts">
import { watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'

useThemeStore() // initialise + applique le thème au démarrage

const auth = useAuthStore()

function applyBrand(slug: string | null | undefined) {
  if (slug === 'hornax-royalty') {
    document.documentElement.dataset.brand = 'royalty'
  } else {
    delete document.documentElement.dataset.brand
  }
}

// Apply immediately on load (user already logged in)
applyBrand(auth.user?.team_slug)

// Watch for login/logout changes
watch(() => auth.user?.team_slug, applyBrand)
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<style>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
