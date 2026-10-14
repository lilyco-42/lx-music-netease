import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/Home.vue') },
  { path: '/player', name: 'player', component: () => import('./views/Player.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
