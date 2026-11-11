<script setup lang="ts">
/**
 * Placeholder Carrie: a clearly non-human, stylized character.
 * This file is the single swap point for the real design: keep the `state`
 * and `size` props and replace the SVG and animations.
 */
withDefaults(defineProps<{ state?: 'idle' | 'listening' | 'speaking'; size?: number }>(), {
  state: 'idle',
  size: 160,
})
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
    <svg class="carrie__figure" viewBox="0 0 120 120" aria-hidden="true">
      <line class="carrie__stem" x1="60" y1="12" x2="60" y2="24" />
      <circle class="carrie__spark" cx="60" cy="10" r="4" />
      <ellipse class="carrie__body" cx="60" cy="66" rx="44" ry="42" />
      <ellipse class="carrie__cheek" cx="36" cy="74" rx="7" ry="4.5" />
      <ellipse class="carrie__cheek" cx="84" cy="74" rx="7" ry="4.5" />
      <g class="carrie__eyes">
        <circle cx="46" cy="60" r="4.5" />
        <circle cx="74" cy="60" r="4.5" />
      </g>
      <path class="carrie__smile" d="M49 76 Q60 86 71 76" />
      <ellipse class="carrie__mouth" cx="60" cy="79" rx="8" ry="6" />
    </svg>
  </div>
</template>

<style scoped>
.carrie {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
}

.carrie__figure {
  position: relative;
  width: 100%;
  height: 100%;
  animation: carrie-float 4s ease-in-out infinite;
}

.carrie__body {
  fill: var(--color-carrie-body);
}

.carrie__cheek {
  fill: var(--color-carrie-shade);
}

.carrie__eyes,
.carrie__mouth,
.carrie__spark {
  fill: var(--color-carrie-face);
}

.carrie__eyes {
  transform-origin: 60px 60px;
  animation: carrie-blink 5s infinite;
}

.carrie__stem,
.carrie__smile {
  fill: none;
  stroke: var(--color-carrie-face);
  stroke-width: 3;
  stroke-linecap: round;
}

.carrie__mouth {
  display: none;
  transform-origin: 60px 79px;
}

.carrie__ring {
  position: absolute;
  inset: 8%;
  border-radius: var(--radius-pill);
  background: var(--color-carrie-glow);
  opacity: 0;
}

/* Listening: soft rings ripple outward. */
.carrie--listening .carrie__ring {
  animation: carrie-ripple 2s var(--ease) infinite;
}

.carrie--listening .carrie__ring--late {
  animation-delay: 1s;
}

.carrie--listening .carrie__spark {
  fill: var(--color-accent);
}

/* Speaking: the smile becomes a moving mouth. */
.carrie--speaking .carrie__smile {
  display: none;
}

.carrie--speaking .carrie__mouth {
  display: block;
  animation: carrie-talk 0.38s ease-in-out infinite alternate;
}

.carrie--speaking .carrie__spark {
  fill: var(--color-primary);
}

@keyframes carrie-float {
  50% {
    transform: translateY(-3%);
  }
}

@keyframes carrie-blink {
  0%,
  94%,
  100% {
    transform: scaleY(1);
  }
  97% {
    transform: scaleY(0.1);
  }
}

@keyframes carrie-ripple {
  from {
    transform: scale(0.85);
    opacity: 0.9;
  }
  to {
    transform: scale(1.35);
    opacity: 0;
  }
}

@keyframes carrie-talk {
  from {
    transform: scaleY(0.25);
  }
  to {
    transform: scaleY(1);
  }
}
</style>
