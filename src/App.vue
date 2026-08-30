<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { importCalendar, importCourseCalendar } from '@/Calendar'
import { getMajor } from '@/Contract'
import { loadAdministrativeSchedule, loadSelectedLanguages } from '@/Data'
import { formatChineseDateRange, getShanghaiToday } from '@/DateTime'
import { DEFAULT_SCHEDULE_LAYERS, composeScheduleLayers, getCurrentWeek, getVisibleWeekdays, getWeekDates } from '@/Schedule'
import type { ScheduleLayers } from '@/Schedule'
import { draftFromSelection, readSelectionDraft, selectionFromDraft } from '@/SelectionState'
import type { SelectionDraft } from '@/SelectionState'
import { THEME_STORAGE_KEY, applyThemePreference, readThemePreference } from '@/Theme'
import type { ScheduleData, ScheduleEvent, SelectedLanguageClasses, Selection, ThemePreference } from '@/Types'
import BottomBar from '@/view/BottomBar.vue'
import type { BottomBarItem } from '@/view/BottomBar.vue'
import Dialog from '@/view/Dialog.vue'
import TimeTable from '@/view/TimeTable.vue'
import WeekFiddler from '@/view/WeekFiddler.vue'
import About from '@/view/dialog-content/About.vue'
import CourseDetail from '@/view/dialog-content/CourseDetail.vue'
import Settings from '@/view/dialog-content/Settings.vue'

const props = withDefaults(defineProps<{ debug?: boolean }>(), { debug: false })
const STORAGE_KEY = 'campus-timetable-selection'
const initialDraft = readStoredSelectionDraft()
const initialSelection = initialDraft ? selectionFromDraft(initialDraft) : null
const schedule = ref<ScheduleData | null>(null)
const languages = ref<SelectedLanguageClasses | null>(null)
const selectionDraft = ref<SelectionDraft | null>(initialDraft)
const selection = ref<Selection | null>(initialSelection)
const loading = ref(true)
const error = ref('')
const currentWeek = ref(1)
const todayDate = ref(getShanghaiToday())
const activeDialog = ref<'settings' | 'about' | 'course' | null>(null)
const selectedCourse = ref<ScheduleEvent | null>(null)
const themePreference = ref<ThemePreference>(readThemePreference())
const systemPrefersDark = ref(false)
const layers = ref<ScheduleLayers>({ ...DEFAULT_SCHEDULE_LAYERS })
const toastMessage = ref('')
const weekStage = ref<HTMLElement | null>(null)
const pagerDragOffset = ref(0)
const pagerAnimating = ref(false)
const pagerDragging = ref(false)
const pagerTargetWeek = ref<number | null>(null)
let themeMediaQuery: MediaQueryList | null = null
let toastTimer = 0
let todayTimer = 0
let pagerAnimationTimer = 0
let pagerAnimationFrame = 0
let pagerCommitWeek: number | null = null
let pagerSuppressCourseUntil = 0
let loadAbortController: AbortController | null = null
let pagerPointer: { id: number, startX: number, startY: number, lastX: number, lastTime: number, velocityX: number, axis: 'pending' | 'horizontal' | 'vertical' } | null = null

const source = computed(() => selection.value ? getMajor(selection.value.grade, selection.value.majorCode) ?? null : null)
const group = computed(() => schedule.value && languages.value ? composeScheduleLayers(schedule.value, schedule.value.group, languages.value, layers.value) : null)
const ready = computed(() => Boolean(!loading.value && schedule.value && group.value && selection.value))
const weekCount = computed(() => schedule.value?.calendar.weekCount ?? 1)
const summary = computed(() => selection.value ? `${selection.value.grade}级 · ${source.value?.name ?? selection.value.majorCode} · ${selection.value.groupId}班` : '尚未设置课程表')
const settingsOpen = computed({ get: () => activeDialog.value === 'settings', set: (open) => activeDialog.value = open ? 'settings' : null })
const aboutOpen = computed({ get: () => activeDialog.value === 'about', set: (open) => activeDialog.value = open ? 'about' : null })
const courseOpen = computed({ get: () => activeDialog.value === 'course', set: (open) => activeDialog.value = open ? 'course' : null })
const bottomItems = computed<BottomBarItem[]>(() => [{ id: 'settings', label: '设置', icon: 'settings', tone: 'warm' }, { id: 'export', label: '导出到手机', icon: 'export', tone: 'green', disabled: !ready.value }, { id: 'about', label: '关于', icon: 'about', tone: 'blue' }])
const pagerCards = computed(() => pagerTargetWeek.value && pagerTargetWeek.value !== currentWeek.value ? [pagerTargetWeek.value, currentWeek.value] : [currentWeek.value])
const dateRange = computed(() => {
  if (!schedule.value || !group.value) return '等待课程数据'
  const dates = getWeekDates(schedule.value, currentWeek.value)
  const days = getVisibleWeekdays(group.value, currentWeek.value)
  const start = dates[(days[0]?.value ?? 1) - 1]
  const end = dates[(days.at(-1)?.value ?? 5) - 1]
  return start && end ? formatChineseDateRange(start, end) : '日期待定'
})

if (initialSelection) writeStoredSelection(initialSelection)

onMounted(async () => {
  themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemPrefersDark.value = themeMediaQuery.matches
  themeMediaQuery.addEventListener('change', handleSystemThemeChange)
  applyTheme()
  todayTimer = window.setInterval(refreshToday, 60_000)
  if (selection.value) await loadSelectedSchedule()
  else {
    loading.value = false
    activeDialog.value = 'settings'
  }
})

onBeforeUnmount(() => {
  themeMediaQuery?.removeEventListener('change', handleSystemThemeChange)
  loadAbortController?.abort()
  window.clearInterval(todayTimer)
  window.clearTimeout(toastTimer)
  window.clearTimeout(pagerAnimationTimer)
  cancelAnimationFrame(pagerAnimationFrame)
})

watch(selection, async (value) => {
  if (!value) {
    loading.value = false
    activeDialog.value = 'settings'
    return
  }
  await loadSelectedSchedule()
})
watch([themePreference, systemPrefersDark], applyTheme)
watch(ready, resetPagerState)

async function loadSelectedSchedule() {
  const value = selection.value
  if (!value) return
  loadAbortController?.abort()
  const controller = new AbortController()
  loadAbortController = controller
  loading.value = true
  schedule.value = null
  languages.value = null
  error.value = ''

  try {
    const [nextSchedule, nextLanguages] = await Promise.all([loadAdministrativeSchedule(value, controller.signal), loadSelectedLanguages(value, controller.signal)])
    if (controller.signal.aborted || loadAbortController !== controller) return
    schedule.value = nextSchedule
    languages.value = nextLanguages
    currentWeek.value = getCurrentWeek(nextSchedule, todayDate.value)
    resetPagerState()
  } catch (cause) {
    if (controller.signal.aborted) return
    error.value = cause instanceof Error ? cause.message : '课程表加载失败'
    activeDialog.value = 'settings'
  } finally {
    if (loadAbortController === controller) loading.value = false
  }
}

function readStoredSelectionDraft(): SelectionDraft | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    if (!text) return null
    const value: unknown = JSON.parse(text)
    if (typeof value === 'object' && value !== null && 'selection' in value) return readSelectionDraft((value as { selection: unknown }).selection)
    return readSelectionDraft(value)
  } catch {
    return null
  }
}

function writeStoredSelection(value: Selection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selection: value }))
}

function applyTheme() {
  applyThemePreference(themePreference.value, systemPrefersDark.value)
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

function setTheme(value: ThemePreference) {
  themePreference.value = value
  localStorage.setItem(THEME_STORAGE_KEY, value)
}

function saveSelection(value: Selection) {
  const unchanged = ready.value && selection.value && JSON.stringify(value) === JSON.stringify(selection.value)
  selectionDraft.value = draftFromSelection(value)
  writeStoredSelection(value)
  activeDialog.value = null
  showToast('设置已保存')
  if (unchanged) return
  selection.value = value
}

function resetDebugData() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(THEME_STORAGE_KEY)
  window.location.reload()
}

function refreshToday() {
  const nextToday = getShanghaiToday()
  if (todayDate.value === nextToday) return
  todayDate.value = nextToday
  if (schedule.value) currentWeek.value = getCurrentWeek(schedule.value, nextToday)
}

function returnToCurrentWeek() {
  if (!schedule.value) return
  const targetWeek = getCurrentWeek(schedule.value, todayDate.value)
  if (targetWeek === currentWeek.value) return
  resetPagerState()
  currentWeek.value = targetWeek
}

function slideWeek(offset: number) {
  const targetWeek = currentWeek.value + offset
  if (targetWeek < 1 || targetWeek > weekCount.value || pagerAnimating.value || pagerDragging.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    currentWeek.value = targetWeek
    return
  }
  pagerTargetWeek.value = targetWeek
  pagerCommitWeek = targetWeek
  pagerAnimating.value = true
  pagerDragOffset.value = 0
  cancelAnimationFrame(pagerAnimationFrame)
  pagerAnimationFrame = requestAnimationFrame(() => pagerDragOffset.value = -offset * pagerTravelDistance() * 1.08)
  startPagerFallbackTimer()
}

function handlePagerPointerDown(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0 || pagerAnimating.value) return
  pagerPointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastTime: performance.now(), velocityX: 0, axis: 'pending' }
}

function handlePagerPointerMove(event: PointerEvent) {
  const pointer = pagerPointer
  if (!pointer || pointer.id !== event.pointerId) return
  const distanceX = event.clientX - pointer.startX
  const distanceY = event.clientY - pointer.startY

  if (pointer.axis === 'pending') {
    if (Math.max(Math.abs(distanceX), Math.abs(distanceY)) < 8) return
    if (Math.abs(distanceY) >= Math.abs(distanceX) * .9) {
      pointer.axis = 'vertical'
      releasePagerPointer(event)
      return
    }
    pointer.axis = 'horizontal'
    const target = event.currentTarget as HTMLElement
    if (!target.hasPointerCapture(event.pointerId)) target.setPointerCapture(event.pointerId)
    pagerDragging.value = true
  }

  if (pointer.axis !== 'horizontal') return
  event.preventDefault()
  const now = performance.now()
  const elapsed = Math.max(1, now - pointer.lastTime)
  pointer.velocityX = pointer.velocityX * .35 + (event.clientX - pointer.lastX) / elapsed * .65
  pointer.lastX = event.clientX
  pointer.lastTime = now
  preparePagerTarget(distanceX)
  const atBoundary = distanceX > 0 && currentWeek.value <= 1 || distanceX < 0 && currentWeek.value >= weekCount.value
  pagerDragOffset.value = atBoundary ? distanceX * .18 : distanceX
}

function handlePagerPointerEnd(event: PointerEvent) {
  const pointer = pagerPointer
  if (!pointer || pointer.id !== event.pointerId) return
  const horizontal = pointer.axis === 'horizontal'
  const velocityX = pointer.velocityX
  releasePagerPointer(event)
  if (!horizontal) return
  pagerSuppressCourseUntil = performance.now() + 320
  const distance = pagerDragOffset.value
  const threshold = (weekStage.value?.clientWidth ?? 0) * .22
  let offset = Math.abs(distance) >= threshold ? distance > 0 ? -1 : 1 : 0
  if (!offset && Math.abs(distance) > 8 && Math.abs(velocityX) >= .45) offset = velocityX > 0 ? -1 : 1
  const targetWeek = currentWeek.value + offset
  if (!offset || targetWeek < 1 || targetWeek > weekCount.value) animatePagerReturn()
  else animatePagerCommit(targetWeek, offset)
}

function handlePagerPointerCancel(event: PointerEvent) {
  const pointer = pagerPointer
  if (!pointer || pointer.id !== event.pointerId) return
  const horizontal = pointer.axis === 'horizontal'
  releasePagerPointer(event)
  if (horizontal) pagerSuppressCourseUntil = performance.now() + 320
  if (horizontal) animatePagerReturn()
}

function releasePagerPointer(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  pagerPointer = null
  pagerDragging.value = false
}

function preparePagerTarget(distance: number) {
  if (!distance) return
  const targetWeek = currentWeek.value + (distance > 0 ? -1 : 1)
  pagerTargetWeek.value = targetWeek >= 1 && targetWeek <= weekCount.value ? targetWeek : null
}

function animatePagerCommit(targetWeek: number, offset: number) {
  pagerTargetWeek.value = targetWeek
  pagerCommitWeek = targetWeek
  pagerAnimating.value = true
  cancelAnimationFrame(pagerAnimationFrame)
  pagerAnimationFrame = requestAnimationFrame(() => pagerDragOffset.value = -offset * pagerTravelDistance() * 1.08)
  startPagerFallbackTimer()
}

function animatePagerReturn() {
  if (!pagerDragOffset.value) {
    pagerTargetWeek.value = null
    return
  }
  pagerCommitWeek = null
  pagerAnimating.value = true
  cancelAnimationFrame(pagerAnimationFrame)
  pagerAnimationFrame = requestAnimationFrame(() => pagerDragOffset.value = 0)
  startPagerFallbackTimer()
}

function handlePagerTransitionEnd(event: TransitionEvent) {
  const target = event.target as HTMLElement
  if (event.propertyName === 'transform' && target.classList.contains('week-card-current')) finishPagerAnimation()
}

function finishPagerAnimation() {
  if (!pagerAnimating.value) return
  const targetWeek = pagerCommitWeek
  window.clearTimeout(pagerAnimationTimer)
  pagerAnimating.value = false
  pagerCommitWeek = null
  pagerDragOffset.value = 0
  if (targetWeek) currentWeek.value = targetWeek
  pagerTargetWeek.value = null
}

function startPagerFallbackTimer() {
  window.clearTimeout(pagerAnimationTimer)
  pagerAnimationTimer = window.setTimeout(finishPagerAnimation, 360)
}

function pagerTravelDistance() {
  return weekStage.value?.clientWidth ?? 0
}

function resetPagerState() {
  window.clearTimeout(pagerAnimationTimer)
  cancelAnimationFrame(pagerAnimationFrame)
  pagerPointer = null
  pagerCommitWeek = null
  pagerDragOffset.value = 0
  pagerAnimating.value = false
  pagerDragging.value = false
  pagerTargetWeek.value = null
}

function pagerCardClass(week: number) {
  return week === currentWeek.value ? 'week-card-current' : 'week-card-target'
}

function pagerCardStyle(week: number) {
  const width = Math.max(1, weekStage.value?.clientWidth ?? 1)
  const progress = Math.min(1, Math.abs(pagerDragOffset.value) / width)
  if (week === currentWeek.value) {
    const rotation = Math.max(-2.2, Math.min(2.2, pagerDragOffset.value / width * 2.2))
    return { opacity: 1 - progress * .12, transform: `translate3d(${pagerDragOffset.value}px, 0, 0) rotate(${rotation}deg)` }
  }
  return { opacity: .48 + progress * .52, transform: `scale(${.955 + progress * .045})` }
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

function openCourse(event: ScheduleEvent) {
  if (performance.now() < pagerSuppressCourseUntil) return
  selectedCourse.value = event
  activeDialog.value = 'course'
}

function exportSelectedCourse() {
  if (!schedule.value || !group.value || !selectedCourse.value) return
  importCourseCalendar(schedule.value, group.value, selectedCourse.value)
  activeDialog.value = null
  showToast('已生成本课程的日历文件')
}

async function copyCourseDetail(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) {
      showToast('复制失败，请长按复制')
      return
    }
  }
  showToast(`已复制${label}`)
}

function showToast(message: string) {
  toastMessage.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toastMessage.value = '', 1800)
}
</script>

<template>
  <div class="application-layer" :inert="activeDialog !== null" :aria-hidden="activeDialog !== null">
    <div class="app">
      <main class="page">
        <div class="shell">
          <WeekFiddler :summary="summary" :current-week="currentWeek" :week-count="weekCount" :date-range="dateRange" @previous="slideWeek(-1)" @next="slideWeek(1)" @current="returnToCurrentWeek" />
          <div v-if="error" class="state-card error-state"><strong>课程表加载失败</strong><span>{{ error }}</span></div>
          <div v-else-if="!ready" class="state-card"><span>{{ loading ? '正在整理课程表' : '请先完成课程表设置' }}</span></div>
          <div v-else-if="schedule && group" ref="weekStage" class="week-stage" :class="{ 'is-animating': pagerAnimating, 'is-dragging': pagerDragging }" aria-label="左右拖动切换周次" @pointerdown="handlePagerPointerDown" @pointermove="handlePagerPointerMove" @pointerup="handlePagerPointerEnd" @pointercancel="handlePagerPointerCancel" @transitionend="handlePagerTransitionEnd" @dragstart.prevent>
            <div v-for="week in pagerCards" :key="week" class="week-card" :class="pagerCardClass(week)" :style="pagerCardStyle(week)" :aria-hidden="week !== currentWeek"><TimeTable :schedule="schedule" :group="group" :week="week" :today-date="todayDate" :active="week === currentWeek" @select-course="openCourse" /></div>
          </div>
        </div>
      </main>
    </div>
    <BottomBar :items="bottomItems" @select="handleBottomAction" />
  </div>

  <Dialog v-model:open="settingsOpen" title="设置" :closable="Boolean(selection)">
    <Settings :open="settingsOpen" :initial-draft="selectionDraft" :selection="selection" :theme="themePreference" :debug="props.debug" :layers="layers" @save="saveSelection" @cancel="activeDialog = null" @reset="resetDebugData" @update:theme="setTheme" @update:layers="layers = $event" />
  </Dialog>
  <Dialog v-model:open="aboutOpen" title="科比在线课程表"><About /></Dialog>
  <Dialog v-model:open="courseOpen" title="课程详情"><CourseDetail v-if="selectedCourse && schedule" :event="selectedCourse" :time="schedule.calendar.sessions[selectedCourse.slot - 1] ?? '时间未注明'" @calendar="exportSelectedCourse" @close="activeDialog = null" @copy="copyCourseDetail" /></Dialog>
  <div class="toast" :class="{ show: toastMessage }" role="status" aria-live="polite">{{ toastMessage }}</div>
</template>
