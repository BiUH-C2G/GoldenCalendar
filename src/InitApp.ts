import { createApp } from 'vue'
import App from './App.vue'
import './style/Style.css'

createApp(App, { debug: /(?:^|\/)debug\/?$/.test(window.location.pathname) }).mount('#app')
