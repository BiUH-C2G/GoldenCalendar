<script setup lang="ts">
defineProps<{ summary: string, currentWeek: number, weekCount: number, dateRange: string }>()
const emit = defineEmits<{ previous: [], next: [], current: [] }>()
</script>

<template>
  <header class="topline"><div class="class-summary">{{ summary }}</div></header>
  <section class="date-nav" aria-label="周次导航">
    <button class="date-button previous-button" type="button" aria-label="上一周" :disabled="currentWeek <= 1" @click="emit('previous')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m15 18-6-6 6-6"/></svg></button>
    <div class="date-text" role="button" tabindex="0" aria-label="双击返回当前周" title="双击返回当前周" @dblclick="emit('current')" @keydown.enter="emit('current')"><div class="date-main">第{{ currentWeek }}周</div><div class="date-week">{{ dateRange }}</div></div>
    <button class="date-button next-button" type="button" aria-label="下一周" :disabled="currentWeek >= weekCount" @click="emit('next')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 18 6-6-6-6"/></svg></button>
  </section>
</template>
