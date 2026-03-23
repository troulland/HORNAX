import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

// Reload page if Vite chunk fails to load after a new deploy
router.onError((err) => {
  if (/Failed to fetch dynamically imported module|Unable to preload CSS/.test(err.message)) {
    window.location.reload()
  }
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
