<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Settings2,
} from 'lucide-vue-next'
import SetupDialog from '@/components/SetupDialog.vue'
import FittedText from '@/components/FittedText.vue'
import { loadManifest, loadSchedule } from '@/data'
import { importCalendar } from '@/calendar'
import {
  DEFAULT_SESSION_TIMES,
  formatDate,
  getCourseHue,
  getCurrentWeek,
  getEvents,
  getNoticeForWeek,
  getTodayWeekday,
  getVisibleWeekdays,
  getWeekDates,
  isHolidayDate,
  isHolidayNotice,
  isExamWeek,
} from '@/schedule'
import type { Manifest, ScheduleData, ScheduleEvent, Selection } from '@/types'

const STORAGE_KEY = 'campus-timetable-selection'
const THEME_STORAGE_KEY = 'campus-timetable-theme'
type ThemePreference = 'system' | 'light' | 'dark'

const manifest = ref<Manifest | null>(null)
const schedule = ref<ScheduleData | null>(null)
const selection = ref<Selection | null>(readSelection())
const setupOpen = ref(false)
const loading = ref(true)
const error = ref('')
const currentWeek = ref(1)
const pager = ref<HTMLElement | null>(null)
const themePreference = ref<ThemePreference>(readThemePreference())
const systemPrefersDark = ref(false)
let themeMediaQuery: MediaQueryList | null = null

const source = computed(() => {
  if (!manifest.value || !selection.value) return null
  return manifest.value.sources.find(
    (item) => item.grade === selection.value?.grade && item.major === selection.value?.majorCode,
  ) ?? null
})
const group = computed(() => schedule.value?.groups.find(
  (item) => item.groupId === selection.value?.groupId,
) ?? null)
const weeks = computed(() => Array.from({ length: schedule.value?.calendar.weekCount ?? 0 }, (_, index) => index + 1))
const todayWeekday = getTodayWeekday()
const isBeforeSemester = computed(() => {
  if (!schedule.value?.calendar.startDate) return false
  return new Date() < new Date(`${schedule.value.calendar.startDate}T00:00:00`)
})

onMounted(async () => {
  themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemPrefersDark.value = themeMediaQuery.matches
  themeMediaQuery.addEventListener('change', handleSystemThemeChange)
  try {
    manifest.value = await loadManifest()
    if (!selection.value) setupOpen.value = true
    await loadSelectedSchedule()
    if (schedule.value && selection.value) {
      currentWeek.value = getCurrentWeek(schedule.value)
      if (!hasValidSelection()) setupOpen.value = true
    }
    await nextTick()
    scrollToWeek(currentWeek.value, 'auto')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '课程表加载失败'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  themeMediaQuery?.removeEventListener('change', handleSystemThemeChange)
})

watch([themePreference, systemPrefersDark], applyTheme, { immediate: true })

watch(selection, async () => {
  if (!selection.value || !manifest.value) return
  await loadSelectedSchedule()
  currentWeek.value = schedule.value ? getCurrentWeek(schedule.value) : 1
  await nextTick()
  scrollToWeek(currentWeek.value, 'auto')
})

async function loadSelectedSchedule() {
  if (!source.value) return
  loading.value = true
  error.value = ''
  try {
    schedule.value = await loadSchedule(source.value.path)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '课程表加载失败'
  } finally {
    loading.value = false
  }
}

function hasValidSelection() {
  return Boolean(source.value?.groups.includes(selection.value?.groupId ?? ''))
}

function readSelection(): Selection | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? JSON.parse(value) as Selection : null
  } catch {
    return null
  }
}

function readThemePreference(): ThemePreference {
  const value = localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : 'system'
}

function applyTheme() {
  const isDark = themePreference.value === 'dark'
    || (themePreference.value === 'system' && systemPrefersDark.value)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#020817' : '#f8fafc')
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

function setTheme(value: unknown) {
  if (value !== 'system' && value !== 'light' && value !== 'dark') return
  themePreference.value = value
  localStorage.setItem(THEME_STORAGE_KEY, value)
}

function saveSelection(value: Selection) {
  selection.value = value
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  setupOpen.value = false
}

function openSettings() {
  setupOpen.value = true
}

function addToCalendar() {
  if (!schedule.value || !group.value) return
  importCalendar(schedule.value, group.value)
}

function scrollToWeek(week: number, behavior: ScrollBehavior = 'smooth') {
  if (!pager.value) return
  pager.value.scrollTo({ left: (week - 1) * pager.value.clientWidth, behavior })
}

function changeWeek(offset: number) {
  const nextWeek = Math.min(weeks.value.length, Math.max(1, currentWeek.value + offset))
  currentWeek.value = nextWeek
  scrollToWeek(nextWeek)
}

function handlePagerScroll() {
  if (!pager.value) return
  const width = pager.value.clientWidth
  if (!width) return
  const nextWeek = Math.min(weeks.value.length, Math.max(1, Math.round(pager.value.scrollLeft / width) + 1))
  if (nextWeek !== currentWeek.value) currentWeek.value = nextWeek
}

function eventAt(groupEvents: ScheduleEvent[], weekday: number, slot: number) {
  return groupEvents.find((event) => event.weekday === weekday && event.slot === slot)
}

function isToday(week: number, weekday: number) {
  return weekday === todayWeekday
}

function displayNotices(currentGroup: NonNullable<typeof group.value>, week: number) {
  return getNoticeForWeek(currentGroup, week).filter((notice) => !isHolidayNotice(notice))
}

function isHolidayDay(week: number, weekday: number) {
  if (!group.value || !schedule.value) return false
  const date = getWeekDates(schedule.value, week)[weekday - 1]
  return Boolean(date && isHolidayDate(group.value, date))
}

function returnToCurrentWeek() {
  if (!schedule.value) return
  const week = getCurrentWeek(schedule.value)
  currentWeek.value = week
  nextTick(() => scrollToWeek(week))
}

function sessionLabel(slot: number) {
  return ['八点半', '十点十五', '十四点半', '十六点十五', '十八点三十五', '二十点十五'][slot - 1]
    ?? schedule.value?.calendar.sessions[slot - 1]?.split('-')[0]
    ?? DEFAULT_SESSION_TIMES[slot - 1]
}

function currentDateForWeek(week: number) {
  const date = schedule.value ? getWeekDates(schedule.value, week)[0] : null
  return date ? `${formatDate(date)} - ${formatDate(getWeekDates(schedule.value!, week)[6])}` : ''
}

function eventStyle(title: string) {
  return {
    '--course-hue': getCourseHue(title),
  }
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-line">
        <CalendarDays :size="20" stroke-width="2.2" />
        <h1>课程表</h1>
      </div>
      <div class="topbar-actions">
        <button
          class="calendar-import-button"
          type="button"
          title="导入日历"
          aria-label="导入日历"
          :disabled="!schedule || !group"
          @click="addToCalendar"
        >
          <CalendarPlus :size="16" />
          <span>导入日历</span>
        </button>
        <div class="context-label">
        <span v-if="selection">{{ selection.grade }}级 · {{ selection.majorCode }} · {{ selection.groupId }}班</span>
        </div>
      </div>
    </header>

    <section class="week-toolbar" aria-label="周次导航">
      <button class="icon-button" type="button" title="上一周" aria-label="上一周" :disabled="currentWeek <= 1" @click="changeWeek(-1)">
        <ChevronLeft :size="19" />
      </button>
      <div class="week-heading" title="双击回到本周" @dblclick="returnToCurrentWeek">
        <strong>第 {{ currentWeek }} 周</strong>
        <span v-if="schedule">{{ currentDateForWeek(currentWeek) }}</span>
      </div>
      <button class="icon-button" type="button" title="下一周" aria-label="下一周" :disabled="currentWeek >= weeks.length" @click="changeWeek(1)">
        <ChevronRight :size="19" />
      </button>
    </section>

    <div v-if="loading && !schedule" class="state-panel">正在加载课程表</div>
    <div v-else-if="error" class="state-panel error-state">
      <CircleAlert :size="20" />
      {{ error }}
    </div>
    <div v-else-if="!selection" class="state-panel">请选择你的课程表</div>

    <section v-else ref="pager" class="week-pager" aria-label="每周课程表" @scroll.passive="handlePagerScroll">
      <article v-for="week in weeks" :key="week" class="week-page">
        <div v-if="group && isExamWeek(group, week)" class="exam-week-state">
          <span>考试周</span><span class="exam-week-mark">！</span>
        </div>
        <template v-else>
          <div v-if="group && displayNotices(group, week).length" class="notice-strip">
            <span v-for="notice in displayNotices(group, week)" :key="`${notice.label}-${notice.startDate}`">{{ notice.label }}</span>
          </div>
          <div v-if="group" class="schedule-grid" :style="{ '--day-count': getVisibleWeekdays(group, week).length }">
          <div class="corner-cell" />
          <div
            v-for="(day, index) in getVisibleWeekdays(group, week)"
            :key="day.value"
            class="day-header"
            :class="{ today: isToday(week, day.value), 'last-column': index === getVisibleWeekdays(group, week).length - 1 }"
          >
            <span class="day-name">{{ day.short }}</span>
            <span class="day-date">{{ formatDate(getWeekDates(schedule!, week)[day.value - 1]) }}</span>
          </div>

          <template v-for="slot in 6" :key="slot">
            <div class="time-cell" :class="{ 'last-row': slot === 6 }">
              <span>{{ sessionLabel(slot) }}</span>
            </div>
            <div
              v-for="(day, dayIndex) in getVisibleWeekdays(group, week)"
              :key="`${week}-${day.value}-${slot}`"
              class="course-cell"
              :class="{
                today: isToday(week, day.value),
                'last-column': dayIndex === getVisibleWeekdays(group, week).length - 1,
                'last-row': slot === 6,
              }"
            >
              <template v-for="event in [eventAt(getEvents(group, week), day.value, slot)]" :key="event ? `${event.date}-${event.slot}` : 'empty'">
                <div
                  v-if="event"
                  class="course-tile"
                  :class="{ 'single-element': !event.teacher && !event.room }"
                  :style="eventStyle(event.title)"
                >
                  <FittedText class="course-title" :text="event.title" :max-size="20" :spacing-cap="1" role="title" />
                  <FittedText v-if="event.teacher" class="course-teacher" :text="event.teacher" :max-size="16" :spacing-cap="1" role="teacher" />
                  <FittedText v-if="event.room" class="course-room" :text="event.room" :max-size="15" :spacing-cap="2.5" role="room" />
                </div>
              </template>
            </div>
          </template>
          <template v-for="(day, dayIndex) in getVisibleWeekdays(group, week)" :key="`holiday-${week}-${day.value}`">
            <div
              v-if="isHolidayDay(week, day.value)"
              class="holiday-overlay"
              :style="{ '--holiday-index': dayIndex }"
              aria-label="假期"
            >
              <span>假</span>
              <span>期</span>
            </div>
          </template>
          </div>
        </template>
      </article>
    </section>

    <div v-if="isBeforeSemester && schedule" class="status-note">当前还未进入本学期，已显示第 1 周</div>
    <button class="floating-button" type="button" title="打开课程表设置" aria-label="打开课程表设置" @click="openSettings">
      <Settings2 :size="20" />
    </button>

    <SetupDialog
      v-if="manifest"
      v-model:open="setupOpen"
      :manifest="manifest"
      :selection="selection"
      :required="!selection || !hasValidSelection()"
      :theme="themePreference"
      @update:theme="setTheme"
      @save="saveSelection"
    />
  </main>
</template>
