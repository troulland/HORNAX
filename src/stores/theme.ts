import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const stored = localStorage.getItem('hx_theme')
  const isDark = ref(stored !== 'light')

  function apply(dark: boolean) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('hx_theme', dark ? 'dark' : 'light')
  }

  // Apply immediately on store init
  apply(isDark.value)

  watch(isDark, apply)

  function toggle() { isDark.value = !isDark.value }

  return { isDark, toggle }
})
