<script setup lang="ts">
/**
 * Carrie the carrier dove: a clearly non-human, stylized character.
 * Three rendered poses (idle, listening, speaking) share one canvas with her feet
 * in the same spot, so the states cross-fade in place. Same props as the placeholder.
 * The images live in public/carrie/.
 */
withDefaults(defineProps<{ state?: 'idle' | 'listening' | 'speaking'; size?: number }>(), {
  state: 'idle',
  size: 160,
})

const poses = (['idle', 'listening', 'speaking'] as const).map((name) => ({
  name,
  url: `${import.meta.env.BASE_URL}carrie/carrie-${name}.webp`,
}))
</script>

<template>
  <div
    class="carrie"
    :class="`carrie--${state}`"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="`Carrie, your AI helper, is ${state}`"
  >
    <span class="carrie__ring" />
    <span class="carrie__ring carrie__ring--late" />
    <span class="carrie__shadow" />
    <div class="carrie__figure">
      <img
        v-for="pose in poses"
        :key="pose.name"
        class="carrie__pose"
        :class="{ 'carrie__pose--on': pose.name === state }"
        :src="pose.url"
        alt=""
        draggable="false"
      />
    </div>
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
.carrie__figure {
  position: absolute;
  inset: 0;
  transform-origin: 50% 96%;
  animation: carrie-breathe 4s ease-in-out infinite;
}

.carrie__pose {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity var(--duration-slow) var(--ease);
  user-select: none;
}

.carrie__pose--on {
  opacity: 1;
}

.carrie__shadow {
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: 1%;
  height: 7%;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--color-carrie-face), transparent);
  opacity: 0.22;
}

.carrie__ring {
  position: absolute;
  inset: 12%;
  border-radius: var(--radius-pill);
  background: var(--color-carrie-glow);
  opacity: 0;
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

/* Speaking: rings travel outward in her satchel's orange and she bobs as she talks. */
.carrie--speaking .carrie__ring {
  background: var(--color-accent-soft);
  animation: carrie-ripple 1.6s var(--ease) infinite;
}

.carrie--speaking .carrie__ring--late {
  animation-delay: 0.8s;
}

.carrie--speaking .carrie__figure {
  animation: carrie-talk 0.42s ease-in-out infinite alternate;
}

@keyframes carrie-breathe {
  50% {
    transform: scale(1.012, 1.022);
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
  .carrie__figure,
  .carrie__ring {
    animation: none !important;
  }
}
</style>
