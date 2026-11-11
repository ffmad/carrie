<script setup lang="ts">
/** Full-bleed on phones; a centered phone-shaped frame on larger screens so it records well. */
</script>

<template>
  <div class="phone">
    <div class="phone__device">
      <div class="phone__screen">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.phone {
  display: flex;
  height: 100dvh;
  background: var(--color-bg);
}

.phone__device {
  display: flex;
  flex: 1;
  min-width: 0;
}

.phone__screen {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--color-bg);
}

@media (min-width: 600px) and (min-height: 500px) {
  .phone {
    align-items: center;
    justify-content: center;
    background: var(--color-backdrop);
  }

  .phone__device {
    flex: none;
    width: calc(var(--phone-width) + 2 * var(--frame-border));
    height: min(calc(var(--phone-height) + 2 * var(--frame-border)), calc(100dvh - 2 * var(--space-5)));
    border: var(--frame-border) solid var(--color-frame);
    border-radius: var(--radius-frame);
    background: var(--color-frame);
    box-shadow: var(--shadow-frame);
    overflow: hidden;
  }

  .phone__screen {
    border-radius: calc(var(--radius-frame) - var(--frame-border));
  }
}
</style>
