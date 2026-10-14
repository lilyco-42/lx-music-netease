import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { ensureDesktopPlatform } from './lib/platform'
import './styles/main.css'

// 安装平台适配器 + 注册内核里已移植的音源（幂等）
ensureDesktopPlatform()

createApp(App).use(router).mount('#app')
