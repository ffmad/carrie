<script setup lang="ts">
import { RouterView } from 'vue-router'
import DemoSwitcher from './components/DemoSwitcher.vue'
import PhoneFrame from './components/PhoneFrame.vue'
import { useLiveData } from './lib/poll'

// Every phone reloads the shared data every few seconds, so what Rose says shows up on Mia's.
useLiveData()
</script>

<template>
  <PhoneFrame>
    <RouterView />
  </PhoneFrame>
  <DemoSwitcher />
</template>
