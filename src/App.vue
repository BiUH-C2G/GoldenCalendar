<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {importCalendar} from '@/Calendar'
import type {CalendarScope} from '@/Calendar'
import {getMajor} from '@/Contract'
import {loadAdministrativeSchedule, loadSelectedLanguages, loadPhysicalEducation} from '@/Data'
import {formatChineseDateRange, getIsoWeekday, getShanghaiToday} from '@/DateTime'
import {DEFAULT_SCHEDULE_LAYERS, composeScheduleLayers, getCurrentWeek, getVisibleWeekdays, getWeekDates} from '@/Schedule'
import type {ScheduleLayers} from '@/Schedule'
import {draftFromSelection, readSelectionDraft, selectionFromDraft} from '@/SelectionState'
import type {SelectionDraft} from '@/SelectionState'
import {THEME_STORAGE_KEY, applyThemePreference, readThemePreference} from '@/Theme'
import type {ScheduleData, ScheduleEvent, SelectedLanguageClasses, Selection, ThemePreference, PhysicalEducationGroup} from '@/Types'
import BottomBar from '@/view/BottomBar.vue'
import type {BottomBarItem} from '@/view/BottomBar.vue'
import ClassSummary from '@/view/ClassSummary.vue'
import Dialog from '@/view/Dialog.vue'
import TimeTable from '@/view/TimeTable.vue'
import WeekFiddler from '@/view/WeekFiddler.vue'
import About from '@/view/dialog-content/About.vue'
import CourseDetail from '@/view/dialog-content/CourseDetail.vue'
import AllCourses from '@/view/dialog-content/AllCourses.vue'
import CourseOccurrences from '@/view/dialog-content/CourseOccurrences.vue'
import Settings from '@/view/dialog-content/Settings.vue'
import AnnouncementQueue from '@/view/AnnouncementQueue.vue'
import { rememberConfirmedConflict } from '@/ConflictCache'
import type { ConflictConfirmation } from '@/ConflictCache'
import type { LoadedSchedule } from '@/Data'

const props = withDefaults(defineProps<{ debug?: boolean }>(), {debug: false})
const STORAGE_KEY = 'campus-timetable-selection'
const initialDraft = readStoredSelectionDraft()
const initialSelection = initialDraft ? selectionFromDraft(initialDraft) : null
const schedule = ref<ScheduleData | null>(null)
const languages = ref<SelectedLanguageClasses | null>(null)
const physicalEducation = ref<PhysicalEducationGroup | null>(null)
const selectionDraft = ref<SelectionDraft | null>(initialDraft)
const selection = ref<Selection | null>(initialSelection)
const loading = ref(true)
const error = ref('')
const announcementActive = ref(false)
const currentWeek = ref(1)
const todayDate = ref(getShanghaiToday())
const activeDialog = ref<'settings' | 'about' | 'course' | 'allCourses' | 'occurrences' | null>(null)
const lookupTitle = ref('')
const pendingLookupTitle = ref<string | null>(null)
const highlightedCourse = ref<ScheduleEvent | null>(null)
const highlightExiting = ref(false)
let highlightExpired = false
let highlightTimer = 0
let highlightOutroTimer = 0
const selectedCourse = ref<ScheduleEvent | null>(null)
const themePreference = ref<ThemePreference>(readThemePreference())
const systemPrefersDark = ref(false)
const layers = ref<ScheduleLayers>({...DEFAULT_SCHEDULE_LAYERS})
const debugGlowWeekday = ref(getIsoWeekday(todayDate.value))
const debugGlowEdge = ref<'soft' | 'hard'>('soft')
const toastMessage = ref('')
const weekStage = ref<HTMLElement | null>(null)
const pagerAnimating = ref(false)
const pagerDragging = ref(false)
const pagerTargetWeek = ref<number | null>(null)
let themeMediaQuery: MediaQueryList | null = null
let toastTimer = 0
let todayTimer = 0
let pagerAnimationFrame = 0
let pagerResizeObserver: ResizeObserver | null = null
let pagerStageWidth = 1
let pagerProgress = 0
let pagerPendingOffset: number | null = null
let pagerDirection: -1 | 0 | 1 = 0
let pagerCommitWeek: number | null = null
let pagerSuppressCourseUntil = 0
let loadAbortController: AbortController | null = null
let pagerPointer: { id: number, startX: number, startY: number, lastX: number, lastTime: number, velocityX: number, distanceX: number, axis: 'pending' | 'horizontal' | 'vertical' } | null = null

const source = computed(() => selection.value ? getMajor(selection.value.grade, selection.value.majorCode) ?? null : null)
const group = computed(() => schedule.value && languages.value ? composeScheduleLayers(schedule.value, schedule.value.group, languages.value, layers.value, physicalEducation.value ?? undefined) : null)
const allCourseEvents = computed(() => schedule.value && languages.value ? composeScheduleLayers(schedule.value, schedule.value.group, languages.value, DEFAULT_SCHEDULE_LAYERS, physicalEducation.value ?? undefined).events : [])
const ready = computed(() => Boolean(!loading.value && schedule.value && group.value && selection.value))
const weekCount = computed(() => schedule.value?.calendar.weekCount ?? 1)
const summary = computed(() => selection.value ? `${selection.value.grade}级 · ${source.value?.name ?? selection.value.majorCode} · ${selection.value.groupId}班` : '尚未设置课程表')
const settingsOpen = computed({get: () => activeDialog.value === 'settings', set: (open) => activeDialog.value = open ? 'settings' : null})
const aboutOpen = computed({get: () => activeDialog.value === 'about', set: (open) => activeDialog.value = open ? 'about' : null})
const courseOpen = computed({get: () => activeDialog.value === 'course', set: (open) => activeDialog.value = open ? 'course' : null})
const bottomItems = computed<BottomBarItem[]>(() => [{id: 'settings', label: '设置', icon: 'settings', tone: 'warm'}, {id: 'allCourses', label: '所有课', icon: 'courses', tone: 'blue', disabled: !ready.value}, {id: 'export', label: '课表导到日历', icon: 'export', tone: 'green', disabled: !ready.value}, {id: 'about', label: '关于', icon: 'about', tone: 'blue'}])
const pagerCards = computed(() => pagerTargetWeek.value && pagerTargetWeek.value !== currentWeek.value ? [pagerTargetWeek.value, currentWeek.value] : [currentWeek.value])
const debugGlowDays = computed(() => group.value ? getVisibleWeekdays(group.value, currentWeek.value) : [])
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
  window.clearTimeout(highlightTimer)
  window.clearTimeout(highlightOutroTimer)
  themeMediaQuery?.removeEventListener('change', handleSystemThemeChange)
  loadAbortController?.abort()
  pagerResizeObserver?.disconnect()
  window.clearInterval(todayTimer)
  window.clearTimeout(toastTimer)
  cancelAnimationFrame(pagerAnimationFrame)
})

watch([themePreference, systemPrefersDark], applyTheme)
watch(activeDialog, (value) => {
  if (value !== 'allCourses') pendingLookupTitle.value = null
})
watch(ready, resetPagerState)
watch(currentWeek, (week) => {
  if (highlightedCourse.value && highlightedCourse.value.week !== week) clearCourseHighlight()
}, { flush: 'sync' })
watch([pagerAnimating, pagerDragging], ([animating, dragging]) => {
  if (animating || dragging) {
    window.clearTimeout(highlightOutroTimer)
    highlightExiting.value = false
  } else if (highlightExpired) finishCourseHighlight()
})
watch(weekStage, syncPagerStageObserver, {flush: 'post'})
watch(debugGlowDays, (days) => {
  if (days.length && !days.some((day) => day.value === debugGlowWeekday.value)) debugGlowWeekday.value = days[0].value
})

async function loadSelectedSchedule() {
  const value = selection.value
  if (!value) return
  loadAbortController?.abort()
  const controller = new AbortController()
  loadAbortController = controller
  loading.value = true
  schedule.value = null
    languages.value = null
    physicalEducation.value = null
  error.value = ''

  try {
    const [nextSchedule, nextLanguages, nextPhysicalEducation] = await Promise.all([loadAdministrativeSchedule(value, controller.signal), loadSelectedLanguages(value, controller.signal), loadPhysicalEducation(value, controller.signal)])
    if (controller.signal.aborted || loadAbortController !== controller) return
    schedule.value = nextSchedule
    languages.value = nextLanguages
    physicalEducation.value = nextPhysicalEducation
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, selection: value}))
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

function saveSelection(value: Selection, loaded: LoadedSchedule, confirmation: ConflictConfirmation) {
  try {
    writeStoredSelection(value)
  } catch {
    showToast('无法保存到本地储存，请检查浏览器储存权限后重试')
    return
  }
  loadAbortController?.abort()
  loadAbortController = null
  selectionDraft.value = draftFromSelection(value)
  selection.value = value
  schedule.value = loaded.schedule
  languages.value = loaded.languages
  physicalEducation.value = loaded.physicalEducation
  loading.value = false
  error.value = ''
  currentWeek.value = getCurrentWeek(loaded.schedule, todayDate.value)
  resetPagerState()
  activeDialog.value = null
  if (confirmation.hasConflicts) rememberConfirmedConflict(confirmation.hash)
  showToast(confirmation.hasConflicts ? '已保存，含确认的冲突' : '设置已保存')
}

function resetDebugData() {
  localStorage.clear()
  window.location.reload()
}

function setDebugLayer(key: keyof ScheduleLayers, value: boolean) {
  layers.value = {...layers.value, [key]: value}
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
  if (prefersReducedMotion()) {
    currentWeek.value = targetWeek
    return
  }

  cachePagerStageWidth()
  pagerTargetWeek.value = targetWeek
  pagerDirection = offset < 0 ? -1 : 1
  pagerCommitWeek = targetWeek
  pagerAnimating.value = true
  applyPagerProgress(0)
  pagerAnimationFrame = requestAnimationFrame(() => animatePagerProgress(1))
}

function handlePagerPointerDown(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0 || pagerAnimating.value) return
  cachePagerStageWidth()
  pagerPointer = {id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastTime: performance.now(), velocityX: 0, distanceX: 0, axis: 'pending'}
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
  pointer.distanceX = distanceX
  pointer.lastX = event.clientX
  pointer.lastTime = now
  preparePagerTarget(distanceX)
  pagerPendingOffset = distanceX
  schedulePagerPointerFrame()
}

function handlePagerPointerEnd(event: PointerEvent) {
  const pointer = pagerPointer
  if (!pointer || pointer.id !== event.pointerId) return
  const horizontal = pointer.axis === 'horizontal'
  const velocityX = pointer.velocityX
  const distance = pointer.distanceX
  flushPagerPointerFrame()
  releasePagerPointer(event)
  if (!horizontal) return
  pagerSuppressCourseUntil = performance.now() + 320
  const threshold = pagerStageWidth * .22
  const targetWeek = pagerTargetWeek.value
  const velocityCommits = pagerDirection !== 0 && Math.abs(distance) > 8 && velocityX * -pagerDirection >= .45
  if (!targetWeek || Math.abs(distance) < threshold && !velocityCommits) animatePagerReturn()
  else animatePagerCommit(targetWeek)
}

function handlePagerPointerCancel(event: PointerEvent) {
  const pointer = pagerPointer
  if (!pointer || pointer.id !== event.pointerId) return
  const horizontal = pointer.axis === 'horizontal'
  flushPagerPointerFrame()
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
  const requestedDirection = distance > 0 ? -1 : 1
  if (!pagerDirection || requestedDirection !== pagerDirection && Math.abs(distance) >= 20) pagerDirection = requestedDirection
  const targetWeek = currentWeek.value + pagerDirection
  pagerTargetWeek.value = targetWeek >= 1 && targetWeek <= weekCount.value ? targetWeek : null
}

function schedulePagerPointerFrame() {
  if (pagerAnimationFrame) return
  pagerAnimationFrame = requestAnimationFrame(() => {
    pagerAnimationFrame = 0
    renderPendingPagerOffset()
  })
}

function flushPagerPointerFrame() {
  if (pagerAnimationFrame) cancelAnimationFrame(pagerAnimationFrame)
  pagerAnimationFrame = 0
  renderPendingPagerOffset()
}

function renderPendingPagerOffset() {
  const distance = pagerPendingOffset
  pagerPendingOffset = null
  if (distance === null || !pagerDirection) return
  const requestedDirection = distance > 0 ? -1 : 1
  const followsDirection = requestedDirection === pagerDirection
  const visualDistance = followsDirection ? pagerTargetWeek.value ? distance : distance * .18 : 0
  applyPagerProgress(Math.min(1, Math.abs(visualDistance) / pagerStageWidth))
}

function animatePagerCommit(targetWeek: number) {
  if (prefersReducedMotion()) {
    currentWeek.value = targetWeek
    pagerTargetWeek.value = null
    nextTick(resetPagerVisual)
    return
  }

  pagerTargetWeek.value = targetWeek
  pagerCommitWeek = targetWeek
  pagerAnimating.value = true
  animatePagerProgress(1)
}

function animatePagerReturn() {
  if (!pagerProgress) {
    pagerTargetWeek.value = null
    pagerDirection = 0
    return
  }

  if (prefersReducedMotion()) {
    pagerTargetWeek.value = null
    resetPagerVisual()
    return
  }

  pagerCommitWeek = null
  pagerAnimating.value = true
  animatePagerProgress(0)
}

function animatePagerProgress(targetProgress: number) {
  cancelAnimationFrame(pagerAnimationFrame)
  pagerAnimationFrame = 0
  const startProgress = pagerProgress
  const distance = Math.abs(targetProgress - startProgress)
  const duration = 170 + distance * 130
  const startTime = performance.now()

  const step = (now: number) => {
    const timeProgress = Math.min(1, (now - startTime) / duration)
    const easedTime = smoothProgress(timeProgress)
    applyPagerProgress(startProgress + (targetProgress - startProgress) * easedTime)

    if (timeProgress < 1) pagerAnimationFrame = requestAnimationFrame(step)
    else {
      pagerAnimationFrame = 0
      finishPagerAnimation()
    }
  }

  pagerAnimationFrame = requestAnimationFrame(step)
}

function finishPagerAnimation() {
  if (!pagerAnimating.value) return
  const targetWeek = pagerCommitWeek
  pagerAnimating.value = false
  pagerCommitWeek = null

  if (targetWeek) {
    currentWeek.value = targetWeek
    pagerTargetWeek.value = null
    nextTick(resetPagerVisual)
  } else {
    pagerTargetWeek.value = null
    resetPagerVisual()
  }
}

function resetPagerState() {
  cancelAnimationFrame(pagerAnimationFrame)
  pagerAnimationFrame = 0
  pagerPointer = null
  pagerCommitWeek = null
  pagerPendingOffset = null
  pagerAnimating.value = false
  pagerDragging.value = false
  pagerTargetWeek.value = null
  resetPagerVisual()
}

function pagerCardClass(week: number) {
  return week === currentWeek.value ? 'week-card-current' : 'week-card-target'
}

function smoothProgress(progress: number) {
  return progress * progress * (3 - 2 * progress)
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function applyPagerProgress(progress: number) {
  const stage = weekStage.value
  const normalized = Math.max(0, Math.min(1, progress))
  const eased = smoothProgress(normalized)
  const offset = pagerDirection ? -pagerDirection * pagerStageWidth * normalized : 0
  const rotation = Math.max(-2.2, Math.min(2.2, offset / pagerStageWidth * 2.2))
  pagerProgress = normalized
  if (!stage) return
  stage.style.setProperty('--pager-x', `${offset}px`)
  stage.style.setProperty('--pager-rotation', `${rotation}deg`)
  stage.style.setProperty('--pager-outgoing-opacity', `${1 - eased * .2}`)
  stage.style.setProperty('--pager-incoming-opacity', `${pagerTargetWeek.value ? eased : 0}`)
  stage.style.setProperty('--pager-target-scale', `${.955 + eased * .045}`)
}

function resetPagerVisual() {
  pagerProgress = 0
  pagerDirection = 0
  applyPagerProgress(0)
}

function cachePagerStageWidth() {
  if (weekStage.value) pagerStageWidth = Math.max(1, weekStage.value.clientWidth)
}

function syncPagerStageObserver(element: HTMLElement | null) {
  pagerResizeObserver?.disconnect()
  pagerResizeObserver = null
  if (!element) return
  cachePagerStageWidth()
  pagerResizeObserver = new ResizeObserver(([entry]) => {
    pagerStageWidth = Math.max(1, entry.contentRect.width)
    if (pagerProgress) applyPagerProgress(pagerProgress)
  })
  pagerResizeObserver.observe(element)
}

function handleBottomAction(id: string) {
  if (id === 'allCourses' && ready.value) activeDialog.value = 'allCourses'
  if (id === 'settings') activeDialog.value = 'settings'
  else if (id === 'about') activeDialog.value = 'about'
  else if (id === 'export') exportCalendar()
}

function exportCalendar(scope: CalendarScope = { kind: 'all' }) {
  if (!schedule.value || !group.value) return
  try {
    importCalendar(schedule.value, { ...group.value, events: allCourseEvents.value }, scope)
    activeDialog.value = null
    showToast('已生成日历文件')
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : '日历生成失败，请重试')
  }
}

function openCourse(event: ScheduleEvent) {
  if (performance.now() < pagerSuppressCourseUntil) return
  selectedCourse.value = event
  activeDialog.value = 'course'
}

function findAllCourse(title: string) {
  lookupTitle.value = title
  pendingLookupTitle.value = null
  activeDialog.value = 'occurrences'
}

async function jumpToCourse(event: ScheduleEvent) {
  clearCourseHighlight()
  resetPagerState()
  layers.value = { ...DEFAULT_SCHEDULE_LAYERS }
  currentWeek.value = event.week
  highlightedCourse.value = event
  activeDialog.value = null
  window.clearTimeout(highlightTimer)
  await nextTick()
  const target = weekStage.value?.querySelector<HTMLElement>('[data-course-highlight]')
  target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  target?.focus({ preventScroll: true })
  highlightTimer = window.setTimeout(() => {
    highlightExpired = true
    finishCourseHighlight()
  }, 4000)
}

function clearCourseHighlight() {
  window.clearTimeout(highlightTimer)
  window.clearTimeout(highlightOutroTimer)
  highlightedCourse.value = null
  highlightExiting.value = false
  highlightExpired = false
}

function finishCourseHighlight() {
  if (!highlightedCourse.value || pagerAnimating.value || pagerDragging.value) return
  if (prefersReducedMotion()) {
    clearCourseHighlight()
    return
  }
  highlightExiting.value = true
  highlightOutroTimer = window.setTimeout(clearCourseHighlight, 600)
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
  <div class="application-layer" :inert="activeDialog !== null || announcementActive" :aria-hidden="activeDialog !== null || announcementActive">
    <div class="app">
      <main class="page">
        <div class="shell">
          <section v-if="props.debug" class="debug-hud" aria-label="调试控制">
            <article class="debug-hud-card" aria-label="星期辉光调试">
              <strong class="debug-hud-title">星期辉光调试</strong>
              <div class="debug-hud-row">
                <span class="debug-hud-label">星期</span>

                <div class="debug-hud-choice" role="group" aria-label="辉光星期">
                  <button v-for="day in debugGlowDays" :key="day.value" type="button" :aria-pressed="debugGlowWeekday === day.value" @click="debugGlowWeekday = day.value">{{ day.label }}</button>
                </div>
              </div>

              <div class="debug-hud-row">
                <span class="debug-hud-label">边缘</span>
                <div class="debug-hud-choice" role="group" aria-label="辉光边缘">
                  <button type="button" :aria-pressed="debugGlowEdge === 'soft'" @click="debugGlowEdge = 'soft'">柔和边缘</button>
                  <button type="button" :aria-pressed="debugGlowEdge === 'hard'" @click="debugGlowEdge = 'hard'">硬边缘</button>
                </div>
              </div>
            </article>

            <article class="debug-hud-card" aria-label="调试图层">
              <strong class="debug-hud-title">调试图层</strong>
              <div class="layer-choice">
                <label><input type="checkbox" :checked="layers.administrative" @change="setDebugLayer('administrative', ($event.target as HTMLInputElement).checked)">行政班</label>
                <label><input type="checkbox" :checked="layers.english" @change="setDebugLayer('english', ($event.target as HTMLInputElement).checked)">英语</label>
                <label><input type="checkbox" :checked="layers.englishCatchup" @change="setDebugLayer('englishCatchup', ($event.target as HTMLInputElement).checked)">英语补课</label>
                <label><input type="checkbox" :checked="layers.german" @change="setDebugLayer('german', ($event.target as HTMLInputElement).checked)">德语</label>
              </div>
            </article>

            <article class="debug-hud-card" aria-label="信息清理">
              <strong class="debug-hud-title">信息清理</strong>
              <p class="debug-hud-description">清除：课程表、外观、公告已读等情况</p>
              <button class="danger-button" type="button" @click="resetDebugData">清空数据并刷新</button>
            </article>
          </section>

          <ClassSummary class="class-summary-top" :summary="summary"/>

          <WeekFiddler :current-week="currentWeek" :week-count="weekCount" :date-range="dateRange" @previous="slideWeek(-1)" @next="slideWeek(1)" @current="returnToCurrentWeek"/>

          <div v-if="error" class="state-card error-state"><strong>课程表加载失败</strong><span>{{ error }}</span></div>
          <div v-else-if="!ready" class="state-card"><span>{{ loading ? '正在整理课程表' : '请先完成课程表设置' }}</span></div>
          <div v-else-if="schedule && group" ref="weekStage" class="week-stage" :class="{ 'is-animating': pagerAnimating, 'is-dragging': pagerDragging }" aria-label="左右拖动切换周次" @pointerdown="handlePagerPointerDown" @pointermove="handlePagerPointerMove" @pointerup="handlePagerPointerEnd" @pointercancel="handlePagerPointerCancel" @dragstart.prevent>
            <div v-for="week in pagerCards" :key="week" class="week-card" :class="pagerCardClass(week)" :aria-hidden="week !== currentWeek">
              <TimeTable :class="{ 'highlight-exiting': highlightExiting }" :schedule="schedule" :group="group" :week="week" :today-date="todayDate" :active="week === currentWeek && !pagerDragging && !pagerAnimating" :animate-entry="week === currentWeek && pagerTargetWeek === null" :glow-weekday="props.debug ? debugGlowWeekday : undefined" :glow-edge="props.debug ? debugGlowEdge : 'soft'" :highlighted-course="highlightedCourse" @select-course="openCourse"/>
            </div>
          </div>

          <ClassSummary class="class-summary-bottom" :summary="summary"/>
        </div>
      </main>
    </div>
    <BottomBar :items="bottomItems" @select="handleBottomAction"/>
  </div>

  <Settings :open="settingsOpen" :initial-draft="selectionDraft" :selection="selection" :theme="themePreference" @save="saveSelection" @cancel="activeDialog = null" @update:theme="setTheme"/>
  <AnnouncementQueue :enabled="!loading && activeDialog === null" @active="announcementActive = $event"/>

  <Dialog v-model:open="aboutOpen" title="科比在线课程表">
    <About/>
  </Dialog>

  <Dialog v-model:open="courseOpen" title="课程详情">
    <CourseDetail v-if="selectedCourse && schedule" :event="selectedCourse" :time="schedule.calendar.sessions[selectedCourse.slot - 1] ?? '时间未注明'" @copy="copyCourseDetail"/>
    <template #actions>
      <button class="secondary-button" type="button" :disabled="!selectedCourse" @click="selectedCourse && findAllCourse(selectedCourse.title)">查看本课更多节次</button>
      <button class="primary-button" type="button" :disabled="!selectedCourse" @click="selectedCourse && exportCalendar({ kind: 'event', event: selectedCourse })">本节课导到日历</button>
    </template>
  </Dialog>

  <Dialog :open="activeDialog === 'allCourses'" title="所有课" @update:open="activeDialog = null">
    <AllCourses v-if="activeDialog === 'allCourses'" :events="allCourseEvents" @select="pendingLookupTitle = $event"/>
  </Dialog>
  <Dialog :open="activeDialog === 'allCourses' && pendingLookupTitle !== null" title="看所有本课" @update:open="pendingLookupTitle = null">
    <p class="lookup-confirm">您是否要看目前课表下所有的「{{ pendingLookupTitle }}」？</p>
    <template #actions><button class="secondary-button" type="button" data-dialog-autofocus @click="pendingLookupTitle = null">不</button><button class="primary-button" type="button" @click="pendingLookupTitle !== null && findAllCourse(pendingLookupTitle)">是的</button></template>
  </Dialog>
  <Dialog :open="activeDialog === 'occurrences'" :title="lookupTitle" @update:open="activeDialog = null">
    <CourseOccurrences v-if="activeDialog === 'occurrences' && schedule" :title="lookupTitle" :events="allCourseEvents" :sessions="schedule.calendar.sessions" :current-week="currentWeek" @select="jumpToCourse"/>
    <template #actions><button class="primary-button" type="button" :disabled="!allCourseEvents.some((event) => event.title === lookupTitle)" @click="exportCalendar({ kind: 'course', title: lookupTitle })">所有本课导到日历</button></template>
  </Dialog>

  <div class="toast" :class="{ show: toastMessage }" role="status" aria-live="polite">{{ toastMessage }}</div>
</template>

<style scoped>
.lookup-confirm { overflow-wrap: anywhere; line-height: 1.6 }
.application-layer, .app {
  width: 100vw;
  max-width: 100vw;
  min-width: 0;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.page {
  width: 100%;
  max-width: 100vw;
  min-width: 0;
  height: 100vh;
  height: 100dvh;
  overflow-x: hidden;
  overflow-x: clip;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: 14px 0 calc(32px + var(--bottom-bar-h) + env(safe-area-inset-bottom));
}

.shell {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0 auto;
}

.debug-hud {
  display: grid;
  gap: 12px;
  margin: 0 12px 12px;
}

.debug-hud-card {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--shadow-1);
}

.debug-hud-title {
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: 15px;
}

.debug-hud-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.debug-hud-label {
  width: 34px;
  flex: 0 0 34px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
}

.debug-hud-choice {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.debug-hud-choice button {
  min-height: 32px;
  padding: 6px 10px;
  border: 0;
  border-radius: 10px;
  color: var(--text);
  background: var(--surface-subtle);
  cursor: pointer;
}

.debug-hud-choice button[aria-pressed="true"] {
  color: var(--fiddler-fg);
  background: var(--fiddler-bg);
  box-shadow: var(--shadow-1);
}

.debug-hud-description {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.layer-choice {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.layer-choice label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  border-radius: 999px;
  color: var(--text);
  background: var(--surface-subtle);
  font-size: 12px;
}

.layer-choice input {
  accent-color: var(--accent);
}

.danger-button {
  justify-self: start;
  padding: 9px 12px;
  border: 0;
  border-radius: 13px;
  color: var(--danger);
  background: var(--block-warm);
  cursor: pointer;
}

.week-stage {
  --pager-x: 0px;
  --pager-rotation: 0deg;
  --pager-outgoing-opacity: 1;
  --pager-incoming-opacity: 0;
  --pager-target-scale: .955;
  position: relative;
  width: 100%;
  min-width: 0;
  flex: 1 0 auto;
  display: flex;
  align-items: stretch;
  overflow: visible;
  isolation: isolate;
  touch-action: pan-y pinch-zoom;
}

.week-stage::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  backdrop-filter: blur(18px) saturate(1.02);
  -webkit-backdrop-filter: blur(18px) saturate(1.02);
}

.week-card {
  width: 100%;
  min-width: 0;
  min-height: 100%;
  transform-origin: center 72%;
}

.week-card-current {
  position: relative;
  flex: 1 0 auto;
  z-index: 2;
  opacity: var(--pager-outgoing-opacity);
  transform: translate3d(var(--pager-x), 0, 0) rotate(var(--pager-rotation));
}

.week-card-target {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: var(--pager-incoming-opacity);
  pointer-events: none;
  transform: scale(var(--pager-target-scale));
}

.week-stage.is-animating .week-card, .week-stage.is-dragging .week-card {
  will-change: transform, opacity;
}

.week-stage.is-dragging {
  cursor: grabbing;
  user-select: none;
}

.state-card {
  min-height: 360px;
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0 12px;
  border-radius: 22px;
  color: var(--text-muted);
  background: var(--surface);
  box-shadow: var(--shadow-2);
}

.state-card strong {
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: 20px;
}

.error-state span {
  color: var(--danger);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--bottom-bar-h) + env(safe-area-inset-bottom) + 16px);
  z-index: 100;
  padding: 10px 14px;
  border-radius: 999px;
  color: var(--toast-text);
  background: var(--toast-bg);
  box-shadow: var(--shadow-2);
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(8px);
  transition: opacity var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

@media (min-width: 700px) {
  .page {
    padding: 22px 22px calc(32px + var(--bottom-bar-h) + env(safe-area-inset-bottom));
    scrollbar-gutter: stable;
  }

  .debug-hud {
    margin-right: 0;
    margin-left: 0;
  }

  .week-stage::before {
    border-radius: 24px;
  }
}

@media (min-width: 900px) {
  .debug-hud {
    grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr) minmax(220px, 1fr);
  }
}
</style>
