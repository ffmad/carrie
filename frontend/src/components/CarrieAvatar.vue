<script setup lang="ts">
/**
 * Carrie the carrier dove: a clearly non-human, stylized character.
 *
 * `state` picks what she is doing. The first three are the original ones; the rest are optional extras:
 *   idle       waiting: breathes, blinks, now and then looks aside or checks her satchel
 *   listening  wing to her ear, nods from time to time, rings arrive
 *   speaking   moves between three talking poses, rings go out
 *   thinking   working out what to say (use while a reply is on its way)
 *   asking     holds the message out: "Can I share this?"
 *   sending    in flight with the message in her beak, wings beating
 *   happy      a little cheer (after a yes, or a thank-you)
 *   waving     hello (incoming call, or "tap me")
 *   playing    holds a glowing message up while a family recording plays
 *   keeping    "this stays with me" (shared with nobody)
 *
 * Every pose is a 720x720 image in public/carrie/ on one shared canvas, so poses swap in place.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

type CarrieState =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'thinking'
  | 'asking'
  | 'sending'
  | 'happy'
  | 'waving'
  | 'playing'
  | 'keeping'

const props = withDefaults(defineProps<{ state?: CarrieState; size?: number }>(), {
  state: 'idle',
  size: 160,
})

/** Poses used by each state; the first one is where the state starts. */
const POSES: Record<CarrieState, string[]> = {
  idle: ['idle', 'idle-blink', 'idle-look', 'idle-satchel'],
  listening: ['listening', 'listening-2'],
  speaking: ['speaking', 'speaking-2', 'speaking-3'],
  thinking: ['thinking'],
  asking: ['asking'],
  sending: ['sending-1', 'sending-2', 'sending-3'],
  happy: ['happy'],
  waving: ['waving'],
  playing: ['playing'],
  keeping: ['keeping'],
}

const LABELS: Record<CarrieState, string> = {
  idle: 'here',
  listening: 'listening',
  speaking: 'speaking',
  thinking: 'thinking',
  asking: 'asking you a question',
  sending: 'carrying a message',
  happy: 'happy',
  waving: 'waving hello',
  playing: 'playing a voice message',
  keeping: 'keeping it private',
}

const url = (pose: string) => `${import.meta.env.BASE_URL}carrie/carrie-${pose}.webp`

/** Poses that are in the page so far (added the first time their state is used). */
const mounted = ref<string[]>([...POSES[props.state]])
const pose = ref(POSES[props.state][0])
/** True while poses must swap at once (a blink, a wing beat) instead of cross-fading. */
const snap = ref(false)
/** True for a moment after the state changes: she gives a small hop. */
const hop = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
let hopTimer: ReturnType<typeof setTimeout> | undefined
const between = (min: number, max: number) => min + Math.random() * (max - min)
const after = (ms: number, next: () => void) => (timer = setTimeout(next, ms))

function show(name: string, atOnce = false) {
  snap.value = atOnce
  pose.value = name
}

function idleLoop() {
  after(between(2200, 4800), () => {
    show('idle-blink', true)
    after(140, () => {
      show('idle', true)
      if (Math.random() > 0.35) return idleLoop()
      after(between(900, 1800), () => {
        show(Math.random() < 0.5 ? 'idle-look' : 'idle-satchel')
        after(between(1500, 2300), () => {
          show('idle')
          idleLoop()
        })
      })
    })
  })
}

function listenLoop() {
  after(between(2400, 4200), () => {
    show('listening-2')
    after(between(1300, 2100), () => {
      show('listening')
      listenLoop()
    })
  })
}

function talkLoop() {
  after(between(420, 900), () => {
    const others = POSES.speaking.filter((name) => name !== pose.value)
    show(others[Math.floor(Math.random() * others.length)])
    talkLoop()
  })
}

/** One wing beat: up, level, down, level. */
function flapLoop(step = 0) {
  show(['sending-1', 'sending-2', 'sending-3', 'sending-2'][step % 4], true)
  after(105, () => flapLoop(step + 1))
}

function play(state: CarrieState, isFirst = false) {
  clearTimeout(timer)
  for (const name of POSES[state]) if (!mounted.value.includes(name)) mounted.value.push(name)
  show(POSES[state][0])

  if (!isFirst) {
    hop.value = true
    clearTimeout(hopTimer)
    hopTimer = setTimeout(() => (hop.value = false), 380)
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (state === 'idle') idleLoop()
  else if (state === 'listening') listenLoop()
  else if (state === 'speaking') talkLoop()
  else if (state === 'sending') flapLoop()
}

watch(() => props.state, (state) => play(state))

onMounted(() => {
  play(props.state, true)
  // Fetch the other poses quietly, so the first blink or wing beat never shows a gap.
  setTimeout(() => {
    for (const name of Object.values(POSES).flat()) new Image().src = url(name)
  }, 600)
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  clearTimeout(hopTimer)
})
</script>

<template>
  <div
    class="carrie"
    :class="[`carrie--${state}`, { 'carrie--snap': snap, 'carrie--hop': hop }]"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="`Carrie, your AI helper, is ${LABELS[state]}`"
  >
    <span class="carrie__ring" />
    <span class="carrie__ring carrie__ring--late" />
    <span class="carrie__shadow" />
    <div class="carrie__stage">
      <div class="carrie__figure">
        <img
          v-for="name in mounted"
          :key="name"
          class="carrie__pose"
          :class="{ 'carrie__pose--on': name === pose }"
          :src="url(name)"
          alt=""
          draggable="false"
        />
      </div>
    </div>
    <span class="carrie__dots" aria-hidden="true"><i /><i /><i /></span>
  </div>
</template>

<style scoped>
.carrie {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
}

/* She stands on the bottom edge of the box, so everything moves from her feet. */
.carrie__stage,
.carrie__figure {
  position: absolute;
  inset: 0;
  transform-origin: 50% 95%;
}

.carrie__figure {
  animation: carrie-breathe 4s ease-in-out infinite;
}

/* The pose coming in fades up first; the one going out waits, so she never turns see-through. */
.carrie__pose {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity 160ms ease 110ms;
  user-select: none;
}

.carrie__pose--on {
  opacity: 1;
  transition: opacity 170ms ease;
}

.carrie--snap .carrie__pose {
  transition: none;
}

.carrie__shadow {
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: 1.5%;
  height: 7%;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--color-carrie-face), transparent);
  opacity: 0.22;
  transition:
    transform var(--duration-slow) var(--ease),
    opacity var(--duration-slow) var(--ease);
}

.carrie__ring {
  position: absolute;
  inset: 12%;
  border-radius: var(--radius-pill);
  background: var(--color-carrie-glow);
  opacity: 0;
}

/* A small hop whenever she changes what she is doing. */
.carrie--hop .carrie__stage {
  animation: carrie-hop 380ms var(--ease);
}

/* Listening: she leans in and soft rings arrive around her. */
.carrie--listening .carrie__ring {
  animation: carrie-ripple 2s var(--ease) infinite reverse;
}

.carrie--listening .carrie__ring--late {
  animation-delay: 1s;
}

.carrie--listening .carrie__figure {
  animation: carrie-lean 2.4s ease-in-out infinite;
}

/* Speaking and playing a recording: rings travel outward in her satchel's orange. */
.carrie--speaking .carrie__ring,
.carrie--playing .carrie__ring {
  background: var(--color-accent-soft);
  animation: carrie-ripple 1.6s var(--ease) infinite;
}

.carrie--speaking .carrie__ring--late,
.carrie--playing .carrie__ring--late {
  animation-delay: 0.8s;
}

.carrie--speaking .carrie__figure {
  animation: carrie-talk 0.42s ease-in-out infinite alternate;
}

.carrie--playing .carrie__figure {
  animation: carrie-sway 2.6s ease-in-out infinite;
}

/* Thinking: a slow sway, and three dots that take turns. */
.carrie--thinking .carrie__figure {
  animation: carrie-sway 3.2s ease-in-out infinite;
}

.carrie__dots {
  position: absolute;
  top: 6%;
  right: 8%;
  display: none;
  gap: 5%;
  width: 24%;
  justify-content: center;
}

.carrie--thinking .carrie__dots {
  display: flex;
}

.carrie__dots i {
  width: 22%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--color-primary);
  animation: carrie-dot 1.2s ease-in-out infinite;
}

.carrie__dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.carrie__dots i:nth-child(3) {
  animation-delay: 0.3s;
}

/* Asking: she offers the message forward, gently, again and again. */
.carrie--asking .carrie__figure {
  animation: carrie-offer 1.8s ease-in-out infinite;
}

/* Sending: she is in the air, so the shadow shrinks and she rides up and down. */
.carrie--sending .carrie__figure {
  animation: carrie-fly 1.7s ease-in-out infinite;
}

.carrie--sending .carrie__shadow {
  transform: scale(0.55);
  opacity: 0.1;
}

/* Happy: two quick hops, a pause, again. */
.carrie--happy .carrie__figure {
  animation: carrie-cheer 1.5s var(--ease) infinite;
}

/* Waving: she rocks toward the raised wing. */
.carrie--waving .carrie__figure {
  animation: carrie-wave 0.9s ease-in-out infinite;
}

@keyframes carrie-breathe {
  50% {
    transform: scale(1.012, 1.022);
  }
}

@keyframes carrie-hop {
  35% {
    transform: translateY(-5%) scale(0.985, 1.03);
  }
  70% {
    transform: translateY(0) scale(1.02, 0.975);
  }
}

@keyframes carrie-lean {
  50% {
    transform: rotate(-2deg) scale(1.01);
  }
}

@keyframes carrie-talk {
  from {
    transform: scale(1.012, 0.988);
  }
  to {
    transform: scale(0.992, 1.016) translateY(-1.5%);
  }
}

@keyframes carrie-sway {
  0%,
  100% {
    transform: rotate(-1.6deg);
  }
  50% {
    transform: rotate(1.6deg);
  }
}

@keyframes carrie-offer {
  50% {
    transform: scale(1.035) translateY(-1%);
  }
}

@keyframes carrie-fly {
  0%,
  100% {
    transform: translate(-2.5%, 1.5%) rotate(-2deg);
  }
  50% {
    transform: translate(2.5%, -4.5%) rotate(2deg);
  }
}

@keyframes carrie-cheer {
  0%,
  40%,
  100% {
    transform: translateY(0) scale(1);
  }
  10%,
  30% {
    transform: translateY(-6%) scale(0.985, 1.03);
  }
  20% {
    transform: translateY(0) scale(1.02, 0.975);
  }
}

@keyframes carrie-wave {
  0%,
  100% {
    transform: rotate(-2.5deg);
  }
  50% {
    transform: rotate(1.5deg);
  }
}

@keyframes carrie-dot {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  30% {
    transform: translateY(-45%);
    opacity: 1;
  }
}

@keyframes carrie-ripple {
  from {
    transform: scale(0.8);
    opacity: 0.85;
  }
  to {
    transform: scale(1.3);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .carrie__stage,
  .carrie__figure,
  .carrie__ring,
  .carrie__dots i {
    animation: none !important;
  }
}
</style>
