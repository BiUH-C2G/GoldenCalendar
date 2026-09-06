<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {getCourseVisual} from '@/CourseVisual'
import '@/style/CourseTile.css'
import {getIsoWeekday} from '@/DateTime'
import {formatDate, getEvents, getNoticeForWeek, getVisibleWeekdays, getWeekDates, isExamWeek, isHolidayDate, isHolidayNotice} from '@/Schedule'
import {TextMarquee} from '@/TextMarquee'
import type {ScheduleData, ScheduleEvent, ScheduleGroup} from '@/Types'

type WeekdayGlowEdge = 'soft' | 'hard'
type RenderedScheduleEvent = { event: ScheduleEvent, visual: ReturnType<typeof getCourseVisual> }

const props = withDefaults(defineProps<{
  schedule: ScheduleData, group: ScheduleGroup, week: number, todayDate: string, active: boolean, animateEntry?: boolean, glowWeekday?: number, glowEdge?: WeekdayGlowEdge, highlightedCourse?: ScheduleEvent | null
}>(), {animateEntry: true, glowWeekday: undefined, glowEdge: 'soft', highlightedCourse: null})

const emit = defineEmits<{ 'select-course': [event: ScheduleEvent] }>()

const root = ref<HTMLElement | null>(null)
const scheduleCard = ref<HTMLElement | null>(null)
const scheduleBackground = ref('var(--schedule-surface-rest)')
const visibleDays = computed(() => getVisibleWeekdays(props.group, props.week))
const weekEvents = computed(() => getEvents(props.group, props.week))
const weekDates = computed(() => getWeekDates(props.schedule, props.week))
const eventsByCell = computed(() => {
  const cells = new Map<string, RenderedScheduleEvent[]>()

  for (const event of weekEvents.value) {
    const key = `${event.weekday}-${event.slot}`
    const events = cells.get(key) ?? []
    events.push({event, visual: getCourseVisual(event.title)})
    cells.set(key, events)
  }

  return cells
})
const highlightedInWeek = computed(() => props.highlightedCourse?.week === props.week)
function isHighlighted(event: ScheduleEvent) {
  const target = props.highlightedCourse
  return Boolean(target && event.date === target.date && event.slot === target.slot && event.title === target.title && event.teacher === target.teacher && event.room === target.room)
}
const holidayWeekdays = computed(() => new Set<number>(visibleDays.value.filter((day) => {
  const date = weekDates.value[day.value - 1]
  return Boolean(date && isHolidayDate(props.group, date))
}).map((day) => day.value)))
const notices = computed(() => getNoticeForWeek(props.group, props.week).filter((notice) => !isHolidayNotice(notice) && notice.label !== '考试周'))
const sessionCount = computed(() => Math.max(6, props.schedule.calendar.sessions.length))
const glowWeekday = computed(() => props.glowWeekday ?? getIsoWeekday(props.todayDate))
const glowColumnIndex = computed(() => visibleDays.value.findIndex((day) => day.value === glowWeekday.value))
const animateEntry = props.animateEntry
let marquee: TextMarquee | null = null
let backgroundResizeObserver: ResizeObserver | null = null

onMounted(() => {
  syncMarquee()

  backgroundResizeObserver = new ResizeObserver(refreshScheduleBackground)

  if (scheduleCard.value) backgroundResizeObserver.observe(scheduleCard.value)

  refreshScheduleBackground()
})

onBeforeUnmount(() => {
  marquee?.dispose()
  backgroundResizeObserver?.disconnect()
})

watch(() => [props.week, props.group, props.todayDate, props.glowWeekday, props.glowEdge], async () => {
  await nextTick()
  refreshScheduleBackground()
})
watch(() => props.active, syncMarquee)

function syncMarquee() {
  if (!props.active) {
    marquee?.dispose()
    marquee = null
    return
  }

  if (!marquee && root.value) marquee = new TextMarquee(root.value)
  else marquee?.scheduleRefresh()
}

// 星期辉光
function refreshScheduleBackground() {
  const card = scheduleCard.value
  const glowHead = root.value?.querySelector<HTMLElement>('[data-glow-column]')

  // 如果不满足则不发光喵
  if (!card || !glowHead || glowColumnIndex.value < 0) {
    scheduleBackground.value = 'var(--schedule-surface-rest)'
    return
  }

  const measuredStart = getLayoutLeft(glowHead, card)

  if (measuredStart === null) {
    scheduleBackground.value = 'var(--schedule-surface-rest)'
    return
  }

  // 顶真元素始末
  const cardWidth = card.clientWidth
  const measuredEnd = Math.min(cardWidth, measuredStart + glowHead.offsetWidth)
  const dayWidth = Math.max(0, measuredEnd - measuredStart)

  if (!dayWidth) {
    scheduleBackground.value = 'var(--schedule-surface-rest)'
    return
  }

  // 第一天/最后一天的带派处理
  const start = glowColumnIndex.value === 0 ? 0 : measuredStart
  const end = glowColumnIndex.value === visibleDays.value.length - 1 ? cardWidth : measuredEnd

  const rest = 'var(--schedule-surface-rest)'
  const today = 'var(--schedule-surface-today)'

  // 如果是硬就直接套弄
  if (props.glowEdge === 'hard') scheduleBackground.value = `linear-gradient(90deg, ${rest} 0, ${rest} ${start}px, ${today} ${start}px, ${today} ${end}px, ${rest} ${end}px, ${rest} 100%)`
  else {
    // 进一步处理后辉光

    const soft = 'var(--schedule-surface-soft)'
    const near = 'var(--schedule-surface-near)'

    // 最大72，否则42%列宽
    const feather = Math.min(72, dayWidth * .42)
    const stops: string[] = []

    // 左侧辉光
    if (start > 0) stops.push(`${rest} 0`, `${rest} ${Math.max(0, start - feather)}px`, `${soft} ${Math.max(0, start - feather * .58)}px`, `${near} ${Math.max(0, start - feather * .22)}px`, `${today} ${start}px`)
    else stops.push(`${today} 0`)

    stops.push(`${today} ${end}px`)

    // 右侧辉光
    if (end < cardWidth) stops.push(`${near} ${Math.min(cardWidth, end + feather * .22)}px`, `${soft} ${Math.min(cardWidth, end + feather * .58)}px`, `${rest} ${Math.min(cardWidth, end + feather)}px`, `${rest} 100%`)

    scheduleBackground.value = `linear-gradient(90deg, ${stops.join(', ')})`
  }
}

function getLayoutLeft(element: HTMLElement, ancestor: HTMLElement) {
  let left = 0
  let node: HTMLElement | null = element

  while (node && node !== ancestor) {
    left += node.offsetLeft
    node = node.offsetParent as HTMLElement | null
  }

  return node === ancestor ? left : null
}

function eventsAt(weekday: number, slot: number) {
  return eventsByCell.value.get(`${weekday}-${slot}`) ?? []
}

function holidayAt(weekday: number) {
  return holidayWeekdays.value.has(weekday)
}

function dateLabel(weekday: number) {
  const date = weekDates.value[weekday - 1]
  return date ? formatDate(date) : '—'
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
    <div ref="scheduleCard" class="schedule-card" :class="{ 'schedule-card-entering': animateEntry }" :style="{ background: scheduleBackground }">
      <div v-if="isExamWeek(group, week) && !highlightedInWeek" class="exam-week-state"><span>考试周</span><strong>！</strong></div>
      <div v-else class="schedule-grid" :style="{ '--day-count': visibleDays.length, '--session-count': sessionCount }">
        <div class="corner"/>
        <div v-for="(day, dayIndex) in visibleDays" :key="day.value" class="day-head" :style="{ gridColumn: dayIndex + 2, gridRow: 1 }" :data-glow-column="dayIndex === glowColumnIndex ? '' : undefined"><span>{{ visibleDays.length > 5 ? day.short : day.label }}</span><small>{{ dateLabel(day.value) }}</small></div>
        <template v-for="slot in sessionCount" :key="slot">
          <div class="time-cell" :style="{ gridColumn: 1, gridRow: slot + 1 }" :aria-label="schedule.calendar.sessions[slot - 1] ?? sessionLabel(slot)">{{ sessionLabel(slot) }}</div>
          <div v-for="(day, dayIndex) in visibleDays" :key="`${week}-${day.value}-${slot}`" class="course-cell" :style="{ gridColumn: dayIndex + 2, gridRow: slot + 1 }">
            <article v-for="(entry, index) in eventsAt(day.value, slot)" :key="`${entry.event.date}-${entry.event.slot}-${entry.event.title}-${index}`" class="course-tile" :style="entry.visual.style" :data-course-highlight="isHighlighted(entry.event) ? '' : undefined" :data-washoku="entry.visual.color.name" :data-pattern="entry.visual.pattern.id" :data-pattern-name="entry.visual.pattern.name" :aria-label="eventLabel(entry.event)" role="button" tabindex="0" @click="emit('select-course', entry.event)" @keydown.enter.prevent="emit('select-course', entry.event)" @keydown.space.prevent="emit('select-course', entry.event)">
              <div class="course-content">
                <div class="course-field-scroll" data-marquee data-max-lines="3" data-field-label="课名"><strong class="course-title course-field-track">{{ entry.event.title }}</strong></div>
                <div v-if="entry.event.teacher" class="course-field-scroll course-teacher-scroll" data-marquee data-max-lines="2" data-field-label="教师名"><span class="course-teacher course-field-track">{{ entry.event.teacher }}</span></div>
                <span v-if="entry.event.room" class="course-room">{{ entry.event.room }}</span>
              </div>
            </article>
          </div>
        </template>
        <div v-for="(day, index) in visibleDays" v-show="holidayAt(day.value) && !(highlightedInWeek && highlightedCourse?.weekday === day.value)" :key="`holiday-${day.value}`" class="holiday-column" :style="{ gridColumn: index + 2, gridRow: `2 / ${sessionCount + 2}` }" aria-label="假期"><span>假</span><span>期</span></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.course-tile[data-course-highlight]::after { content: ''; position: absolute; inset: 0; z-index: 2; border-radius: inherit; box-shadow: inset 0 0 0 3px var(--course-ink); pointer-events: none }
.highlight-exiting .course-tile[data-course-highlight]::after { animation: course-highlight-out 600ms ease-out forwards }
@keyframes course-highlight-out {
  from { opacity: 1; filter: blur(0) }
  to { opacity: 0; filter: blur(5px) }
}
@media (prefers-reduced-motion: reduce) {
  .highlight-exiting .course-tile[data-course-highlight]::after { animation: none; opacity: 0 }
}
.timetable {
  width: 100%;
  min-width: 0;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.notice-strip {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 0 12px 10px;
}

.notice-strip span {
  padding: 6px 11px;
  border-radius: 999px;
  color: var(--text);
  background: var(--block-warm);
  box-shadow: var(--shadow-1);
  font-size: 12px;
}

.schedule-card {
  position: relative;
  min-height: 0;
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--schedule-surface-rest);
  box-shadow: var(--shadow-2);
}

.schedule-card-entering {
  animation: schedule-card-enter 300ms var(--ease-standard) both;
}

@keyframes schedule-card-enter {
  from {
    opacity: 0;
    transform: translateY(5px) scale(.995);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.schedule-grid {
  position: relative;
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: var(--time-w) repeat(var(--day-count), minmax(0, 1fr));
  grid-template-rows: 42px repeat(var(--session-count), var(--course-row-h));
  gap: var(--grid-gap);
  padding: 6px 0;
}

.corner {
  grid-column: 1;
  grid-row: 1;
  background: transparent;
}

.day-head, .time-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  background: transparent;
  font-family: var(--font-display);
  font-weight: 500;
}

.day-head {
  position: relative;
  z-index: 1;
  min-width: 0;
  flex-direction: column;
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: .035em;
  white-space: nowrap;
}

.day-head small {
  margin-top: 2px;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
}

.time-cell {
  color: var(--text);
  font-size: 14px;
  font-weight: 560;
  line-height: 1;
  letter-spacing: .055em;
  writing-mode: vertical-rl;
  text-orientation: upright;
  white-space: nowrap;
}

.course-cell {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-auto-rows: minmax(0, 1fr);
  gap: 3px;
}

.course-content {
  position: relative;
  z-index: 1;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.course-field-scroll {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  contain: paint;
}

.course-field-track {
  width: 100%;
  min-width: 100%;
  transform: translate3d(0, 0, 0);
  transform-origin: left top;
}

.course-field-scroll.is-marquee .course-field-track {
  will-change: transform;
}

.course-field-scroll.has-hidden-left {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 10px, #000 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 10px, #000 100%);
}

.course-field-scroll.has-hidden-right {
  -webkit-mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 10px), transparent 100%);
  mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 10px), transparent 100%);
}

.course-field-scroll.has-hidden-left.has-hidden-right {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
}

.course-field-scroll.is-manual-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  touch-action: pan-x;
}

.course-field-scroll.is-manual-scroll::-webkit-scrollbar {
  display: none;
}

.course-teacher-scroll {
  margin-top: 6px;
}

.course-title, .course-teacher, .course-room {
  display: block;
  overflow-wrap: anywhere;
  word-break: normal;
  white-space: normal;
}

.course-title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--course-ink);
  font-size: 16px;
  font-weight: 720;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.course-teacher, .course-room {
  color: var(--course-meta);
  font-size: 14px;
  font-weight: 540;
  line-height: 1.32;
}

.course-teacher {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.course-room {
  margin-top: 5px;
  overflow: hidden;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.holiday-column {
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0;
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 650;
  pointer-events: none;
}

.exam-week-state {
  min-height: 360px;
  flex: 1 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: 64px;
}

.exam-week-state strong {
  color: var(--accent);
}

@media (min-width: 700px) {
  .schedule-card {
    border-radius: 24px;
  }

  .schedule-grid {
    grid-template-rows: 54px repeat(var(--session-count), var(--course-row-h));
    padding: 12px;
  }

  .course-tile {
    padding: 14px 12px 12px;
    border-radius: 16px;
  }

  .course-teacher-scroll {
    margin-top: 8px;
  }
}

@media (max-width: 379px) {
  .course-tile {
    padding-left: 5px;
    padding-right: 5px;
  }
}
</style>
