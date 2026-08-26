<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getCourseVisual } from '@/CourseVisual'
import { formatDate, getEvents, getNoticeForWeek, getVisibleWeekdays, getWeekDates, isExamWeek, isHolidayDate, isHolidayNotice } from '@/Schedule'
import { TextMarquee } from '@/TextMarquee'
import type { ScheduleData, ScheduleEvent, ScheduleGroup } from '@/Types'

const props = defineProps<{ schedule: ScheduleData, group: ScheduleGroup, week: number }>()
const root = ref<HTMLElement | null>(null)
const visibleDays = computed(() => getVisibleWeekdays(props.group, props.week))
const weekEvents = computed(() => getEvents(props.group, props.week))
const notices = computed(() => getNoticeForWeek(props.group, props.week).filter((notice) => !isHolidayNotice(notice)))
const sessionCount = computed(() => Math.max(6, props.schedule.calendar.sessions.length))
let marquee: TextMarquee | null = null

onMounted(() => {
  if (root.value) marquee = new TextMarquee(root.value)
})
onBeforeUnmount(() => marquee?.dispose())
watch(() => [props.week, props.group], async () => {
  await nextTick()
  marquee?.scheduleRefresh()
})

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
    <div class="schedule-card">
      <div v-if="isExamWeek(group, week)" class="exam-week-state"><span>考试周</span><strong>！</strong></div>
      <div v-else class="schedule-grid" :style="{ '--day-count': visibleDays.length, '--session-count': sessionCount }">
        <div class="corner" />
        <div v-for="day in visibleDays" :key="day.value" class="day-head"><span>{{ day.label }}</span><small>{{ formatDate(getWeekDates(schedule, week)[day.value - 1]) }}</small></div>
        <template v-for="slot in sessionCount" :key="slot">
          <div class="time-cell" :aria-label="schedule.calendar.sessions[slot - 1] ?? sessionLabel(slot)">{{ sessionLabel(slot) }}</div>
          <div v-for="day in visibleDays" :key="`${week}-${day.value}-${slot}`" class="course-cell">
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
