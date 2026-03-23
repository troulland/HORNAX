import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

// Reload once if Vite chunk fails to load after a new deploy
const RELOAD_KEY = 'chunk_reload'
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message ?? ''
  if (/dynamically imported module|Unable to preload CSS/.test(msg)) {
    if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, '1')
      window.location.reload()
    }
  }
})
router.onError((err) => {
  if (/dynamically imported module|Unable to preload CSS/.test(err.message)) {
    if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, '1')
      window.location.reload()
    }
  }
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
