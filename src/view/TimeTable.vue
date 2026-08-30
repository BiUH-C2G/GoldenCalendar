<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getCourseVisual } from '@/CourseVisual'
import { formatDate, getEvents, getNoticeForWeek, getTodayWeekday, getVisibleWeekdays, getWeekDates, isExamWeek, isHolidayDate, isHolidayNotice } from '@/Schedule'
import { TextMarquee } from '@/TextMarquee'
import type { ScheduleData, ScheduleEvent, ScheduleGroup } from '@/Types'

const props = defineProps<{ schedule: ScheduleData, group: ScheduleGroup, week: number }>()
const root = ref<HTMLElement | null>(null)
const scheduleCard = ref<HTMLElement | null>(null)
const scheduleBackground = ref('var(--schedule-surface-rest)')
const visibleDays = computed(() => getVisibleWeekdays(props.group, props.week))
const weekEvents = computed(() => getEvents(props.group, props.week))
const notices = computed(() => getNoticeForWeek(props.group, props.week).filter((notice) => !isHolidayNotice(notice) && notice.label !== '考试周'))
const sessionCount = computed(() => Math.max(6, props.schedule.calendar.sessions.length))
const todayWeekday = getTodayWeekday()
const todayColumnIndex = computed(() => visibleDays.value.findIndex((day) => day.value === todayWeekday))
let marquee: TextMarquee | null = null
let backgroundResizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (root.value) marquee = new TextMarquee(root.value)
  backgroundResizeObserver = new ResizeObserver(refreshScheduleBackground)
  if (scheduleCard.value) backgroundResizeObserver.observe(scheduleCard.value)
  refreshScheduleBackground()
})
onBeforeUnmount(() => {
  marquee?.dispose()
  backgroundResizeObserver?.disconnect()
})
watch(() => [props.week, props.group], async () => {
  await nextTick()
  marquee?.scheduleRefresh()
  refreshScheduleBackground()
})

function refreshScheduleBackground() {
  const card = scheduleCard.value
  const todayHead = root.value?.querySelector<HTMLElement>('[data-today-column]')
  if (!card || !todayHead || todayColumnIndex.value < 0) {
    scheduleBackground.value = 'var(--schedule-surface-rest)'
    return
  }

  const cardRect = card.getBoundingClientRect()
  const todayRect = todayHead.getBoundingClientRect()
  const start = Math.max(0, todayRect.left - cardRect.left)
  const end = Math.min(cardRect.width, todayRect.right - cardRect.left)
  const dayWidth = Math.max(0, end - start)
  if (!dayWidth) {
    scheduleBackground.value = 'var(--schedule-surface-rest)'
    return
  }

  const feather = Math.min(72, dayWidth * .42)
  const inner = Math.min(18, dayWidth * .08)
  const leftOuter = Math.max(0, start - feather)
  const leftSoft = Math.max(0, start - feather * .58)
  const leftNear = Math.max(0, start - feather * .22)
  const leftSolid = Math.min(end, start + inner)
  const rightSolid = Math.max(start, end - inner)
  const rightNear = Math.min(cardRect.width, end + feather * .22)
  const rightSoft = Math.min(cardRect.width, end + feather * .58)
  const rightOuter = Math.min(cardRect.width, end + feather)
  const rest = 'var(--schedule-surface-rest)'
  const soft = 'var(--schedule-surface-soft)'
  const near = 'var(--schedule-surface-near)'
  const today = 'var(--schedule-surface-today)'
  let stops: string[]

  if (todayColumnIndex.value === 0) stops = [`${today} 0`, `${today} ${rightSolid}px`, `${near} ${rightNear}px`, `${soft} ${rightSoft}px`, `${rest} ${rightOuter}px`, `${rest} 100%`]
  else if (todayColumnIndex.value === visibleDays.value.length - 1) stops = [`${rest} 0`, `${rest} ${leftOuter}px`, `${soft} ${leftSoft}px`, `${near} ${leftNear}px`, `${today} ${leftSolid}px`, `${today} 100%`]
  else stops = [`${rest} 0`, `${rest} ${leftOuter}px`, `${soft} ${leftSoft}px`, `${near} ${leftNear}px`, `${today} ${leftSolid}px`, `${today} ${rightSolid}px`, `${near} ${rightNear}px`, `${soft} ${rightSoft}px`, `${rest} ${rightOuter}px`, `${rest} 100%`]

  scheduleBackground.value = `linear-gradient(90deg, ${stops.join(', ')})`
}

function eventsAt(weekday: number, slot: number) {
  return weekEvents.value.filter((event) => event.weekday === weekday && event.slot === slot)
}

function holidayAt(weekday: number) {
  const date = getWeekDates(props.schedule, props.week)[weekday - 1]
  return Boolean(date && isHolidayDate(props.group, date))
}

function sessionLabel(slot: number) {
  return ['八点半', '十点十五', '十四点半', '十六点十五', '十八点三十五', '二十点十五'][slot - 1] ?? props.schedule.calendar.sessions[slot - 1]?.split('-')[0] ?? `${slot}`
}

function eventLabel(event: ScheduleEvent) {
  return [event.title, event.teacher ? `教师 ${event.teacher}` : '', event.room ? `教室 ${event.room}` : ''].filter(Boolean).join('，')
}
</script>

<template>
  <section ref="root" class="timetable" aria-label="课程表">
    <div v-if="notices.length" class="notice-strip"><span v-for="notice in notices" :key="`${notice.label}-${notice.startDate}`">{{ notice.label }}</span></div>
    <div ref="scheduleCard" class="schedule-card" :style="{ background: scheduleBackground }" @animationend="refreshScheduleBackground">
      <div v-if="isExamWeek(group, week)" class="exam-week-state"><span>考试周</span><strong>！</strong></div>
      <div v-else class="schedule-grid" :style="{ '--day-count': visibleDays.length, '--session-count': sessionCount }">
        <div class="corner" />
        <div v-for="(day, dayIndex) in visibleDays" :key="day.value" class="day-head" :style="{ gridColumn: dayIndex + 2, gridRow: 1 }" :data-today-column="dayIndex === todayColumnIndex ? '' : undefined"><span>{{ visibleDays.length > 5 ? day.short : day.label }}</span><small>{{ formatDate(getWeekDates(schedule, week)[day.value - 1]) }}</small></div>
        <template v-for="slot in sessionCount" :key="slot">
          <div class="time-cell" :style="{ gridColumn: 1, gridRow: slot + 1 }" :aria-label="schedule.calendar.sessions[slot - 1] ?? sessionLabel(slot)">{{ sessionLabel(slot) }}</div>
          <div v-for="(day, dayIndex) in visibleDays" :key="`${week}-${day.value}-${slot}`" class="course-cell" :style="{ gridColumn: dayIndex + 2, gridRow: slot + 1 }">
            <article v-for="(event, index) in eventsAt(day.value, slot)" :key="`${event.date}-${event.slot}-${event.title}-${index}`" class="course-tile" :style="getCourseVisual(event.title)" :aria-label="eventLabel(event)">
              <div class="course-content">
                <div class="course-field-scroll" data-marquee data-max-lines="3" data-field-label="课名"><strong class="course-title course-field-track">{{ event.title }}</strong></div>
                <div v-if="event.teacher" class="course-field-scroll course-teacher-scroll" data-marquee data-max-lines="2" data-field-label="教师名"><span class="course-teacher course-field-track">{{ event.teacher }}</span></div>
                <span v-if="event.room" class="course-room">{{ event.room }}</span>
              </div>
            </article>
          </div>
        </template>
        <div v-for="(day, index) in visibleDays" v-show="holidayAt(day.value)" :key="`holiday-${day.value}`" class="holiday-column" :style="{ gridColumn: index + 2, gridRow: `2 / ${sessionCount + 2}` }" aria-label="假期"><span>假</span><span>期</span></div>
      </div>
    </div>
  </section>
</template>
