import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'

createApp(App, { debug: /(?:^|\/)debug\/?$/.test(window.location.pathname) }).mount('#app')
