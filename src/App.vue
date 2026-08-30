<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import SetupDialog from '@/components/SetupDialog.vue'
import { dataContract, getEnglishClassNumbers, getGermanSection, getGrade, getMajor } from '@/contract'
import { loadAdministrativeSchedule, loadSelectedLanguages } from '@/data'
import { importCalendar } from '@/calendar'
import {
  DEFAULT_SCHEDULE_LAYERS,
  DEFAULT_SESSION_TIMES,
  composeScheduleLayers,
  formatDate,
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
import type { ScheduleLayers } from '@/schedule'
import type { ScheduleData, ScheduleEvent, SelectedLanguageClasses, Selection } from '@/types'

const props = withDefaults(defineProps<{
  debug?: boolean
}>(), {
  debug: false,
})

const STORAGE_KEY = 'campus-timetable-selection'
const THEME_STORAGE_KEY = 'campus-timetable-theme'
type ThemePreference = 'system' | 'light' | 'dark'

const schedule = ref<ScheduleData | null>(null)
const languages = ref<SelectedLanguageClasses | null>(null)
const selection = ref<Selection | null>(readSelection())
const setupOpen = ref(false)
const loading = ref(true)
const error = ref('')
const currentWeek = ref(1)
const pager = ref<HTMLElement | null>(null)
const themePreference = ref<ThemePreference>(readThemePreference())
const systemPrefersDark = ref(false)
const layers = ref<ScheduleLayers>({ ...DEFAULT_SCHEDULE_LAYERS })
let themeMediaQuery: MediaQueryList | null = null
let loadRequest = 0

const source = computed(() => {
  if (!selection.value) return null
  return getMajor(selection.value.grade, selection.value.majorCode) ?? null
})
const group = computed(() => {
  if (!schedule.value || !languages.value || !hasValidSelection()) return null
  return composeScheduleLayers(schedule.value, schedule.value.group, languages.value, layers.value)
})
const weeks = computed(() => Array.from({ length: schedule.value?.calendar.weekCount ?? 0 }, (_, index) => index + 1))
const ready = computed(() => Boolean(!loading.value && schedule.value && group.value && hasValidSelection()))
const todayWeekday = getTodayWeekday()
const isBeforeSemester = computed(() => {
  if (!schedule.value?.calendar.startDate) return false
  return new Date() < new Date(`${schedule.value.calendar.startDate}T00:00:00`)
})

onMounted(async () => {
  themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemPrefersDark.value = themeMediaQuery.matches
  themeMediaQuery.addEventListener('change', handleSystemThemeChange)
  if (hasValidSelection()) {
    await loadSelectedSchedule()
  } else {
    loading.value = false
    setupOpen.value = true
  }
})

onUnmounted(() => {
  themeMediaQuery?.removeEventListener('change', handleSystemThemeChange)
})

watch([themePreference, systemPrefersDark], applyTheme, { immediate: true })

watch(selection, async () => {
  if (!hasValidSelection()) {
    loading.value = false
    setupOpen.value = true
    return
  }
  await loadSelectedSchedule()
})

async function loadSelectedSchedule() {
  const value = selection.value
  if (!value || !hasValidSelection(value)) return
  const request = ++loadRequest
  loading.value = true
  schedule.value = null
  languages.value = null
  error.value = ''
  try {
    const [nextSchedule, nextLanguages] = await Promise.all([
      loadAdministrativeSchedule(value),
      loadSelectedLanguages(value),
    ])
    if (request !== loadRequest) return
    schedule.value = nextSchedule
    languages.value = nextLanguages
    currentWeek.value = getCurrentWeek(nextSchedule)
    await nextTick()
    scrollToWeek(currentWeek.value, 'auto')
  } catch (cause) {
    if (request !== loadRequest) return
    error.value = cause instanceof Error ? cause.message : '课程表加载失败'
    setupOpen.value = true
  } finally {
    if (request === loadRequest) loading.value = false
  }
}

function hasValidSelection(value: Selection | null = selection.value) {
  if (!value || value.term !== dataContract.term) return false
  const grade = getGrade(value.grade)
  const major = getMajor(value.grade, value.majorCode)
  if (!grade || !major?.groups.includes(value.groupId)) return false
  const germanSection = getGermanSection(value.grade)
  const germanLevel = germanSection?.levels.find((item) => item.level === value.germanLevel)
  if (!germanLevel?.classes.includes(value.germanClassNumber)) return false
  if (typeof value.englishCatchupEnabled !== 'boolean') return false
  if (!grade.english) {
    return value.englishClassNumber === null && value.englishCatchupEnabled === false && value.englishCatchupClassNumber === null
  }
  if (!value.englishClassNumber || !getEnglishClassNumbers(value.majorCode).includes(value.englishClassNumber)) return false
  if (!value.englishCatchupEnabled) return value.englishCatchupClassNumber === null
  return Boolean(
    value.englishCatchupClassNumber
    && dataContract.languages.english.catchupClasses.includes(value.englishCatchupClassNumber),
  )
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
  loading.value = true
  schedule.value = null
  languages.value = null
  selection.value = value
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  setupOpen.value = false
}

function openSettings() {
  setupOpen.value = true
}

function resetDebugData() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(THEME_STORAGE_KEY)
  window.location.reload()
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

function eventsAt(groupEvents: ScheduleEvent[], weekday: number, slot: number) {
  return groupEvents.filter((event) => event.weekday === weekday && event.slot === slot)
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

</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <h1>课程表</h1>
      <div class="topbar-actions">
        <button
          class="calendar-import-button"
          type="button"
          title="导入日历"
          aria-label="导入日历"
          :disabled="!ready"
          @click="addToCalendar"
        >
          导入日历
        </button>
        <div class="context-label">
        <span v-if="selection">{{ selection.grade }}级 · {{ source?.name ?? selection.majorCode }} · {{ selection.groupId }}班</span>
        </div>
      </div>
    </header>

    <section v-if="props.debug" class="debug-layers" aria-label="课程表图层">
      <strong>视图叠合</strong>
      <label><input v-model="layers.administrative" type="checkbox">行政班</label>
      <label><input v-model="layers.english" type="checkbox">英语</label>
      <label><input v-model="layers.englishCatchup" type="checkbox">英语补课</label>
      <label><input v-model="layers.german" type="checkbox">德语</label>
      <a href="/">退出 Debug</a>
    </section>

    <section class="week-toolbar" aria-label="周次导航">
      <button class="icon-button" type="button" title="上一周" aria-label="上一周" :disabled="currentWeek <= 1" @click="changeWeek(-1)">
        上一周
      </button>
      <div class="week-heading" title="双击回到本周" @dblclick="returnToCurrentWeek">
        <strong>第 {{ currentWeek }} 周</strong>
        <span v-if="schedule">{{ currentDateForWeek(currentWeek) }}</span>
      </div>
      <button class="icon-button" type="button" title="下一周" aria-label="下一周" :disabled="currentWeek >= weeks.length" @click="changeWeek(1)">
        下一周
      </button>
    </section>

    <div v-if="error" class="state-panel error-state">
      {{ error }}
    </div>
    <div v-else-if="!ready" class="state-panel">《加载中》</div>

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
              <template
                v-for="(event, eventIndex) in eventsAt(getEvents(group, week), day.value, slot)"
                :key="`${event.date}-${event.slot}-${event.title}-${eventIndex}`"
              >
                <div
                  class="course-tile"
                  :class="{ 'single-element': !event.teacher && !event.room }"
                >
                  <strong class="course-title">{{ event.title }}</strong>
                  <span v-if="event.teacher" class="course-teacher">{{ event.teacher }}</span>
                  <span v-if="event.room" class="course-room">{{ event.room }}</span>
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

    <div v-if="isBeforeSemester && ready" class="status-note">当前还未进入本学期，已显示第 1 周</div>
    <button class="settings-button" type="button" @click="openSettings">设置</button>

    <SetupDialog
      v-model:open="setupOpen"
      :selection="selection"
      :required="!hasValidSelection()"
      :theme="themePreference"
      :debug="props.debug"
      @update:theme="setTheme"
      @save="saveSelection"
      @reset="resetDebugData"
    />
  </main>
</template>
