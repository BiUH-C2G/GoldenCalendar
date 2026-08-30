<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { importCalendar } from '@/Calendar'
import { dataContract, getEnglishClassNumbers, getGermanSection, getGrade, getMajor } from '@/Contract'
import { loadAdministrativeSchedule, loadSelectedLanguages } from '@/Data'
import { DEFAULT_SCHEDULE_LAYERS, composeScheduleLayers, getCurrentWeek, getVisibleWeekdays, getWeekDates, parseLocalDate } from '@/Schedule'
import type { ScheduleLayers } from '@/Schedule'
import type { ScheduleData, SelectedLanguageClasses, Selection, ThemePreference } from '@/Types'
import BottomBar from '@/view/BottomBar.vue'
import type { BottomBarItem } from '@/view/BottomBar.vue'
import Dialog from '@/view/Dialog.vue'
import TimeTable from '@/view/TimeTable.vue'
import WeekFiddler from '@/view/WeekFiddler.vue'
import About from '@/view/dialog-content/About.vue'
import Settings from '@/view/dialog-content/Settings.vue'

const props = withDefaults(defineProps<{ debug?: boolean }>(), { debug: false })
const STORAGE_KEY = 'campus-timetable-selection'
const THEME_STORAGE_KEY = 'campus-timetable-theme'
const schedule = ref<ScheduleData | null>(null)
const languages = ref<SelectedLanguageClasses | null>(null)
const selection = ref<Selection | null>(readSelection())
const loading = ref(true)
const error = ref('')
const currentWeek = ref(1)
const activeDialog = ref<'settings' | 'about' | null>(null)
const themePreference = ref<ThemePreference>(readThemePreference())
const systemPrefersDark = ref(false)
const layers = ref<ScheduleLayers>({ ...DEFAULT_SCHEDULE_LAYERS })
const toastMessage = ref('')
let themeMediaQuery: MediaQueryList | null = null
let toastTimer = 0
let loadRequest = 0

const source = computed(() => selection.value ? getMajor(selection.value.grade, selection.value.majorCode) ?? null : null)
const group = computed(() => schedule.value && languages.value && hasValidSelection() ? composeScheduleLayers(schedule.value, schedule.value.group, languages.value, layers.value) : null)
const ready = computed(() => Boolean(!loading.value && schedule.value && group.value && hasValidSelection()))
const weekCount = computed(() => schedule.value?.calendar.weekCount ?? 1)
const summary = computed(() => selection.value ? `${selection.value.grade}级 · ${source.value?.name ?? selection.value.majorCode} · ${selection.value.groupId}班` : '尚未设置课程表')
const settingsOpen = computed({ get: () => activeDialog.value === 'settings', set: (open) => activeDialog.value = open ? 'settings' : null })
const aboutOpen = computed({ get: () => activeDialog.value === 'about', set: (open) => activeDialog.value = open ? 'about' : null })
const isBeforeSemester = computed(() => Boolean(schedule.value?.calendar.startDate && new Date() < parseLocalDate(schedule.value.calendar.startDate)))
const bottomItems = computed<BottomBarItem[]>(() => [
  { id: 'settings', label: '设置', icon: 'settings', tone: 'warm' },
  { id: 'export', label: '导出到手机', icon: 'export', tone: 'green', disabled: !ready.value },
  { id: 'about', label: '关于', icon: 'about', tone: 'blue' }
])
const dateRange = computed(() => {
  if (!schedule.value || !group.value) return '等待课程数据'
  const dates = getWeekDates(schedule.value, currentWeek.value)
  const days = getVisibleWeekdays(group.value, currentWeek.value)
  const start = dates[(days[0]?.value ?? 1) - 1]
  const end = dates[(days.at(-1)?.value ?? 5) - 1]
  return start && end ? formatDateRange(start, end) : '日期待定'
})

onMounted(async () => {
  themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemPrefersDark.value = themeMediaQuery.matches
  themeMediaQuery.addEventListener('change', handleSystemThemeChange)
  applyTheme()
  if (hasValidSelection()) await loadSelectedSchedule()
  else {
    loading.value = false
    activeDialog.value = 'settings'
  }
})

onBeforeUnmount(() => {
  themeMediaQuery?.removeEventListener('change', handleSystemThemeChange)
  window.clearTimeout(toastTimer)
})

watch(selection, async () => {
  if (!hasValidSelection()) {
    loading.value = false
    activeDialog.value = 'settings'
    return
  }
  await loadSelectedSchedule()
})
watch([themePreference, systemPrefersDark], applyTheme)

async function loadSelectedSchedule() {
  const value = selection.value
  if (!value || !hasValidSelection(value)) return
  const request = ++loadRequest
  loading.value = true
  schedule.value = null
  languages.value = null
  error.value = ''
  try {
    const [nextSchedule, nextLanguages] = await Promise.all([loadAdministrativeSchedule(value), loadSelectedLanguages(value)])
    if (request !== loadRequest) return
    schedule.value = nextSchedule
    languages.value = nextLanguages
    currentWeek.value = getCurrentWeek(nextSchedule)
  } catch (cause) {
    if (request !== loadRequest) return
    error.value = cause instanceof Error ? cause.message : '课程表加载失败'
    activeDialog.value = 'settings'
  } finally {
    if (request === loadRequest) loading.value = false
  }
}

function hasValidSelection(value: Selection | null = selection.value) {
  if (!value || value.term !== dataContract.term) return false
  const grade = getGrade(value.grade)
  const major = getMajor(value.grade, value.majorCode)
  if (!grade || !major?.groups.includes(value.groupId)) return false
  const germanLevel = getGermanSection(value.grade)?.levels.find((item) => item.level === value.germanLevel)
  if (!germanLevel?.classes.includes(value.germanClassNumber)) return false
  if (typeof value.englishCatchupEnabled !== 'boolean') return false
  if (!grade.english) return value.englishClassNumber === null && !value.englishCatchupEnabled && value.englishCatchupClassNumber === null
  if (!value.englishClassNumber || !getEnglishClassNumbers(value.majorCode).includes(value.englishClassNumber)) return false
  if (!value.englishCatchupEnabled) return value.englishCatchupClassNumber === null
  return Boolean(value.englishCatchupClassNumber && dataContract.languages.english.catchupClasses.includes(value.englishCatchupClassNumber))
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
  if (themePreference.value === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = themePreference.value
  const dark = themePreference.value === 'dark' || themePreference.value === 'system' && systemPrefersDark.value
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171817' : '#f7f3ed')
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

function setTheme(value: ThemePreference) {
  themePreference.value = value
  localStorage.setItem(THEME_STORAGE_KEY, value)
}

function saveSelection(value: Selection) {
  loading.value = true
  schedule.value = null
  languages.value = null
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  selection.value = value
  activeDialog.value = null
  showToast('设置已保存')
}

function resetDebugData() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(THEME_STORAGE_KEY)
  window.location.reload()
}

function changeWeek(offset: number) {
  currentWeek.value = Math.min(weekCount.value, Math.max(1, currentWeek.value + offset))
}

function handleBottomAction(id: string) {
  if (id === 'settings') activeDialog.value = 'settings'
  else if (id === 'about') activeDialog.value = 'about'
  else if (id === 'export') exportCalendar()
}

function exportCalendar() {
  if (!schedule.value || !group.value) return
  importCalendar(schedule.value, group.value)
  showToast('已生成日历文件')
}

function showToast(message: string) {
  toastMessage.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toastMessage.value = '', 1800)
}

function formatDateRange(startValue: string, endValue: string) {
  const start = parseLocalDate(startValue)
  const end = parseLocalDate(endValue)
  if (start.getMonth() === end.getMonth()) return `${start.getMonth() + 1}月${start.getDate()}日 — ${end.getDate()}日`
  return `${start.getMonth() + 1}月${start.getDate()}日 — ${end.getMonth() + 1}月${end.getDate()}日`
}
</script>

<template>
  <div class="app">
    <main class="page">
      <div class="shell">
        <WeekFiddler :summary="summary" :current-week="currentWeek" :week-count="weekCount" :date-range="dateRange" @previous="changeWeek(-1)" @next="changeWeek(1)" />
        <div v-if="error" class="state-card error-state"><strong>课程表加载失败</strong><span>{{ error }}</span></div>
        <div v-else-if="!ready" class="state-card"><span>{{ loading ? '正在整理课程表' : '请先完成课程表设置' }}</span></div>
        <TimeTable v-else-if="schedule && group" :schedule="schedule" :group="group" :week="currentWeek" />
        <div v-if="isBeforeSemester && ready" class="status-note">当前还未进入本学期，已显示第1周</div>
      </div>
    </main>
    <BottomBar :items="bottomItems" @select="handleBottomAction" />
  </div>

  <Dialog v-model:open="settingsOpen" title="设置" :closable="hasValidSelection()">
    <Settings :open="settingsOpen" :selection="selection" :theme="themePreference" :debug="props.debug" :layers="layers" @save="saveSelection" @cancel="activeDialog = null" @reset="resetDebugData" @update:theme="setTheme" @update:layers="layers = $event" />
  </Dialog>
  <Dialog v-model:open="aboutOpen" title="科比在线课程表"><About /></Dialog>
  <div class="toast" :class="{ show: toastMessage }" role="status" aria-live="polite">{{ toastMessage }}</div>
</template>
