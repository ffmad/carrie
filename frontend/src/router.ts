import { createRouter, createWebHistory } from 'vue-router'
import { useCircleStore } from './stores/circle'
import CallView from './views/CallView.vue'
import DoctorView from './views/DoctorView.vue'
import FactView from './views/FactView.vue'
import FamilyView from './views/FamilyView.vue'
import HomeView from './views/HomeView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/call', name: 'call', component: CallView },
    { path: '/family', name: 'family', component: FamilyView },
    { path: '/fact/:id', name: 'fact', component: FactView, props: true },
    { path: '/doctor', name: 'doctor', component: DoctorView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// Opening a role's screen directly (deep link, reload) switches "viewing as" to match.
router.afterEach((to) => {
  const circle = useCircleStore()
  if (to.name === 'call') circle.viewAs('rose')
  if (to.name === 'doctor') circle.viewAs('dr-chen')
  if (to.name === 'family' && circle.viewer.role !== 'family') circle.viewAs('mia')
})
