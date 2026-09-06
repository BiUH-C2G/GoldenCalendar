<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
defineProps<{ currentWeek: number, weekCount: number, dateRange: string }>()
const emit = defineEmits<{ previous: [], next: [], current: [] }>()
</script>

<template>
  <section class="date-nav" aria-label="周次导航">
    <button class="date-button previous-button" type="button" aria-label="上一周" title="上一周" :disabled="currentWeek <= 1" @click="emit('previous')"><ChevronLeft aria-hidden="true"/></button>
    <div class="date-text" role="button" tabindex="0" aria-label="双击返回当前周" title="双击返回当前周" @dblclick="emit('current')" @keydown.enter="emit('current')"><div class="date-main">第{{ currentWeek }}周</div><div class="date-week">{{ dateRange }}</div></div>
    <button class="date-button next-button" type="button" aria-label="下一周" title="下一周" :disabled="currentWeek >= weekCount" @click="emit('next')"><ChevronRight aria-hidden="true"/></button>
  </section>
</template>

<style scoped>
.date-nav {
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-button {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 14px;
  color: var(--fiddler-fg);
  background: var(--fiddler-bg);
  box-shadow: var(--shadow-1);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-standard), filter var(--duration-fast) var(--ease-standard);
}

.date-button.previous-button {
  background: var(--fiddler-bg-previous);
}

.date-button:hover:not(:disabled) {
  filter: brightness(1.04);
}

.date-button:active:not(:disabled) {
  transform: translateY(1px) scale(.985);
}

.date-button svg {
  width: 20px;
  height: 20px;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.date-text {
  width: 160px;
  min-width: 160px;
  max-width: 160px;
  flex: 0 0 160px;
  border-radius: 16px;
  text-align: center;
  overflow: hidden;
  cursor: pointer;
  touch-action: manipulation;
}

.date-main {
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 650;
  letter-spacing: .04em;
  white-space: nowrap;
}

.date-week {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  letter-spacing: .025em;
  white-space: nowrap;
}

@media (max-width: 379px) {
  .date-button {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
    border-radius: 13px;
  }
}
</style>
