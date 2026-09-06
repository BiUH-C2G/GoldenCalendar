<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { parseIsoDate } from '@/DateTime'
import { WEEKDAYS } from '@/Schedule'
import type { ScheduleEvent } from '@/Types'

const props = defineProps<{ title: string, events: ScheduleEvent[], sessions: string[], currentWeek: number }>()
const emit = defineEmits<{ select: [event: ScheduleEvent] }>()
const root = ref<HTMLElement | null>(null)
const matches = computed(() => props.events.filter((event) => event.title === props.title).sort((left, right) => left.date.localeCompare(right.date) || left.slot - right.slot))
const weeks = computed(() => {
  const groups = new Map<number, ScheduleEvent[]>()
  for (const event of matches.value) {
    const events = groups.get(event.week) ?? []
    events.push(event)
    groups.set(event.week, events)
  }
  return [...groups].map(([week, events]) => ({ week, events }))
})
const targetWeek = computed(() => weeks.value.find((group) => group.week >= props.currentWeek)?.week ?? weeks.value.at(-1)?.week)
function dateLabel(event: ScheduleEvent) {
  const { month, day } = parseIsoDate(event.date)
  return `${month}月${day}日 · 星期${WEEKDAYS[event.weekday - 1].short} · 第${event.slot}节`
}
onMounted(async () => {
  await nextTick()
  root.value?.querySelector<HTMLElement>(`[data-week="${targetWeek.value}"]`)?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <div ref="root" class="occurrences">
    <h3>{{ title }}</h3><p class="occurrence-count">共 {{ matches.length }} 个上课时段</p>
    <section v-for="group in weeks" :key="group.week" :data-week="group.week"><h4>第 {{ group.week }} 周</h4><button v-for="(event, index) in group.events" :key="index" class="occurrence" type="button" :data-dialog-autofocus="group.week === targetWeek && index === 0 ? '' : undefined" @click="emit('select', event)"><strong>{{ dateLabel(event) }}</strong><span>{{ sessions[event.slot - 1] ?? '时间未注明' }}</span><span>{{ event.teacher ?? '教师未注明' }} · {{ event.room ?? '场地未注明' }}</span></button></section>
    <p v-if="!matches.length">当前课表没有本课程的安排</p>
  </div>
</template>

<style scoped>
.occurrences { min-width: 0; overflow-wrap: anywhere }
.occurrences h3 { margin: 0; color: var(--text-strong); font-size: 17px }
.occurrence-count { color: var(--text-muted); font-size: 13px }
.occurrences h4 { margin: 20px 0 8px; color: var(--text-strong); font-size: 14px }
.occurrence { display: grid; gap: 4px; width: 100%; padding: 12px; border: 0; border-bottom: 1px solid var(--border-soft); border-radius: 8px; background: transparent; color: var(--text); text-align: left; cursor: pointer; overflow-wrap: anywhere }
.occurrence strong { font-size: 14px }
.occurrence span { font-size: 13px; color: var(--text-muted) }
.occurrence:hover { background: var(--surface-subtle) }
.occurrence:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px }
</style>
