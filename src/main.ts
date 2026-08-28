import { createApp } from 'vue'
import 'source-han-sans-sc-vf/result.css'
import App from './App.vue'
import TextDebugApp from './TextDebugApp.vue'
import './styles.css'

createApp(window.location.pathname === '/text-debug' ? TextDebugApp : App).mount('#app')
