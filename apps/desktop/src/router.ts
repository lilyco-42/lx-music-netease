import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/Home.vue') },
  { path: '/search', name: 'search', component: () => import('./views/Search.vue') },
  { path: '/player', name: 'player', component: () => import('./views/Player.vue') },
  { path: '/membership', name: 'membership', component: () => import('./views/Membership.vue') },
  { path: '/sync', name: 'sync', component: () => import('./views/Sync.vue') },
  { path: '/my', name: 'my', component: () => import('./views/MyMusic.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
