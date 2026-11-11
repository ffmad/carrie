import { createRouter, createWebHistory } from 'vue-router'
import { useCircleStore, type ViewerKey } from './stores/circle'
import HomeView from './views/HomeView.vue'

// One Carrie, four ways in: see docs/app-spec.md for what each person sees.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/rose', name: 'rose', component: () => import('./views/rose/RoseView.vue') },
    { path: '/rose/shared', name: 'rose-shared', component: () => import('./views/rose/RoseSharedView.vue') },
    {
      path: '/family/:who(mia|leo)',
      component: () => import('./views/family/FamilyShell.vue'),
      children: [
        { path: '', redirect: (to) => `/family/${String(to.params.who)}/carrie` },
        { path: 'carrie', name: 'family-carrie', component: () => import('./views/family/FamilyCarrieView.vue') },
        { path: 'her', name: 'family-her', component: () => import('./views/family/FamilyHerView.vue') },
        { path: 'circle', name: 'family-circle', component: () => import('./views/family/FamilyCircleView.vue') },
      ],
    },
    { path: '/doctor', name: 'doctor', component: () => import('./views/doctor/DoctorView.vue') },
    { path: '/call', redirect: '/rose' },
    { path: '/family', redirect: '/family/mia' },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// Opening someone's screen directly (deep link, reload) makes this their phone.
router.beforeEach((to) => {
  const circle = useCircleStore()
  if (to.path.startsWith('/rose')) circle.viewAs('rose')
  else if (to.path.startsWith('/doctor')) circle.viewAs('dr-chen')
  else if (to.params.who) circle.viewAs(String(to.params.who) as ViewerKey)
})
