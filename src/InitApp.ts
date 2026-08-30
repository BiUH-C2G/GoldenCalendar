import { createApp } from 'vue'
import App from './App.vue'
import { applyThemePreference, readThemePreference } from './Theme'
import './style/Style.css'

applyThemePreference(readThemePreference(), window.matchMedia('(prefers-color-scheme: dark)').matches)
createApp(App, { debug: /(?:^|\/)debug\/?$/.test(window.location.pathname) }).mount('#app')