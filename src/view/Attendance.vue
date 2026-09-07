<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRightLeft, ChevronRight, ClipboardCheck, Download, Info, Pencil, Plus, Search, Settings2, Trash2, Undo2, Upload } from 'lucide-vue-next'
import { ATTENDANCE_MODES, ATTENDANCE_STORAGE_KEY, buildAttendanceCourses, lessonStart, parseAttendanceBackup, PRESENCE_LABELS, ROLL_CALL_LABELS, summarizeAttendance } from '@/Attendance'
import type { AttendanceCourse, AttendanceLesson, AttendanceMode, AttendanceRecord } from '@/Attendance'
import { readAttendance, undoAttendance, writeAttendance } from '@/AttendanceStore'
import { getShanghaiToday } from '@/DateTime'
import { getCourseVisual } from '@/CourseVisual'
import type { ScheduleGroup, Selection } from '@/Types'
import Dialog from './Dialog.vue'
import AttendanceEditor from './dialog-content/AttendanceEditor.vue'
import AttendanceDetail from './dialog-content/AttendanceDetail.vue'
import AttendanceRules from './dialog-content/AttendanceRules.vue'
import AttendanceImport from './dialog-content/AttendanceImport.vue'
import AttendanceMetric from './AttendanceMetric.vue'

const props = defineProps<{ group: ScheduleGroup, selection: Selection, sessions: string[], summary: string }>()
const emit = defineEmits<{ settings: [] }>()
const records = ref<AttendanceRecord[]>([])
const storageError = ref('')
const message = ref('')
const now = ref(Date.now())
const view = ref<'courses' | 'records'>('courses')
const search = ref('')
const recordScope = ref<'current' | 'archive' | 'all'>('current')
const sortMode = ref<AttendanceMode>('daily')
const showConservative = ref(false)
const editorOpen = ref(false)
const initialLesson = ref<AttendanceLesson>()
const reassignRecord = ref<AttendanceRecord>()
const detailId = ref<string | null>(null)
const rulesOpen = ref(false)
const importRecords = ref<AttendanceRecord[] | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const undoState = ref<{ before: Map<string, AttendanceRecord | null>, after: Map<string, AttendanceRecord | null> } | null>(null)
let timer = 0
const courses = computed(() => buildAttendanceCourses(props.group, props.selection))
const lessons = computed(() => new Map(courses.value.flatMap((course) => course.lessons).map((lesson) => [lesson.id, lesson])))
const summaries = computed(() => courses.value.map((course) => summarizeAttendance(course, records.value, props.sessions, now.value)))
const visibleSummaries = computed(() => summaries.value.filter((item) => item.course.title.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())).sort((a, b) => a.metrics[sortMode.value].remaining - b.metrics[sortMode.value].remaining || b.metrics[sortMode.value].rate - a.metrics[sortMode.value].rate || a.course.title.localeCompare(b.course.title, 'zh-CN')))
const coreModes = ATTENDANCE_MODES.slice(0, 3)
const archiveRecords = computed(() => records.value.filter((record) => !lessons.value.has(record.id)))
const visibleRecords = computed(() => records.value.filter((record) => (recordScope.value === 'all' || (recordScope.value === 'current' ? lessons.value.has(record.id) : !lessons.value.has(record.id))) && record.event.title.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())).sort((a, b) => b.event.date.localeCompare(a.event.date) || b.event.slot - a.event.slot || a.event.title.localeCompare(b.event.title, 'zh-CN')))
const criticalCount = computed(() => summaries.value.filter((item) => ['critical', 'danger'].includes(item.metrics[sortMode.value].level)).length)
const unknownCount = computed(() => summaries.value.reduce((count, item) => count + item.unknownPresence, 0))
const detail = computed(() => summaries.value.find((item) => item.course.id === detailId.value))
const recordIndex = computed(() => new Map(records.value.map((record) => [record.id, record])))
const importConflicts = computed(() => importRecords.value?.filter((record) => recordIndex.value.has(record.id)).length ?? 0)
const backgroundInert = computed(() => editorOpen.value || detailId.value !== null || rulesOpen.value || importRecords.value !== null)

function reload() {
  try {
    records.value = readAttendance()
    storageError.value = ''
  } catch {
    storageError.value = '无法读取本地出勤数据，请检查浏览器存储权限或备份文件；原数据已保留'
  }
}

function onStorage(event: StorageEvent) {
  if (event.key === ATTENDANCE_STORAGE_KEY || event.key === null) reload()
}

onMounted(() => {
  reload()
  timer = window.setInterval(() => now.value = Date.now(), 30000)
  window.addEventListener('storage', onStorage)
})
onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.removeEventListener('storage', onStorage)
})

function commit(changes: Map<string, AttendanceRecord | null>, success: string) {
  try {
    const result = writeAttendance(changes)
    const previous = new Map(result.before.map((record) => [record.id, record]))
    undoState.value = { before: new Map([...changes.keys()].map((id) => [id, previous.get(id) ?? null])), after: changes }
    records.value = result.records
    message.value = success
    storageError.value = ''
    return true
  } catch {
    message.value = '保存失败，请检查浏览器存储空间和权限后重试'
    return false
  }
}

function openEditor(lesson?: AttendanceLesson) {
  initialLesson.value = lesson
  reassignRecord.value = undefined
  editorOpen.value = true
}

function saveRecords(values: AttendanceRecord[]) {
  const changes = new Map<string, AttendanceRecord | null>(values.map((record) => [record.id, record.presence === 'unknown' && record.rollCall === 'unknown' ? null : record]))
  if (reassignRecord.value && values.length === 1) changes.set(reassignRecord.value.id, null)
  if (commit(changes, reassignRecord.value ? '记录已重新关联' : `已保存 ${values.length} 节记录`)) editorOpen.value = false
}

function removeRecord(record: AttendanceRecord) {
  commit(new Map([[record.id, null]]), '已删除这节记录，可撤销')
}

function undo() {
  if (!undoState.value) return
  try {
    records.value = undoAttendance(undoState.value.before, undoState.value.after)
    undoState.value = null
    message.value = '已撤销上次操作'
  } catch (cause) {
    message.value = cause instanceof Error ? `撤销失败：${cause.message}` : '撤销失败，请重试'
  }
}

function exportBackup() {
  try {
    const latest = readAttendance()
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, records: latest }, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `出勤记录-${getShanghaiToday()}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    message.value = `已导出 ${latest.length} 节记录`
  } catch {
    message.value = '导出失败，请检查本地数据和浏览器权限'
  }
}

async function readImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('备份文件不能超过 5 MB')
    importRecords.value = parseAttendanceBackup(JSON.parse(await file.text())).records
  } catch {
    message.value = '无法导入：备份格式无效、版本不支持或文件超过 5 MB'
  } finally {
    input.value = ''
  }
}

function confirmImport() {
  if (!importRecords.value) return
  if (commit(new Map(importRecords.value.map((record) => [record.id, record])), `已合并 ${importRecords.value.length} 节记录`)) importRecords.value = null
}

function reassign(record: AttendanceRecord) {
  initialLesson.value = record
  reassignRecord.value = record
  editorOpen.value = true
}

function courseCaption(course: AttendanceCourse) {
  const source = course.lessons[0]?.event.source
  return source === 'language' ? '语言课' : source === 'physicalEducation' ? '体育课' : '行政班课程'
}

function lessonLabel(lesson: AttendanceLesson) {
  const dayLessons = courses.value.find((course) => course.id === lesson.courseId)?.lessons.filter((item) => item.event.date === lesson.event.date)
  const index = dayLessons?.findIndex((item) => item.id === lesson.id) ?? -1
  return index >= 0 ? `第 ${index + 1} 节` : `课表第 ${lesson.event.slot} 时段`
}
</script>

<template>
  <div class="attendance-page">
    <div class="attendance-content" :inert="backgroundInert">
      <header class="attendance-header"><button class="attendance-icon" type="button" aria-label="查看计算口径" title="查看计算口径" @click="rulesOpen = true"><Info :size="20"/></button><div class="attendance-title"><h1>出勤小助手</h1><p>{{ summary }} · {{ selection.term }}</p></div><button class="attendance-icon attendance-settings" type="button" aria-label="课程表设置" title="课程表设置" @click="emit('settings')"><Settings2 :size="20"/></button></header>
      <section class="attendance-overview" aria-label="出勤概览"><div><span>本学期课程</span><strong>{{ courses.length }}<small> 门</small></strong></div><div><span>{{ ATTENDANCE_MODES.find((mode) => mode.key === sortMode)?.label }}临界 / 达线</span><strong :class="{ 'danger-text': criticalCount > 0 }">{{ criticalCount }}<small> 门</small></strong></div><div><span>已开始 · 到场未记录</span><strong>{{ unknownCount }}<small> 节</small></strong></div><button type="button" class="primary-button record-command" :disabled="!!storageError" @click="openEditor()"><Plus :size="19" aria-hidden="true"/>记录出勤</button></section>
      <div v-if="storageError" class="attendance-notice danger-text" role="alert">{{ storageError }}<button type="button" class="secondary-button" @click="reload">重试</button></div>
      <div v-if="message" class="attendance-notice" role="status">{{ message }}<button v-if="undoState" class="attendance-icon" type="button" aria-label="撤销上次操作" title="撤销上次操作" @click="undo"><Undo2 :size="18"/></button></div>
      <div v-if="archiveRecords.length" class="attendance-notice"><span>{{ archiveRecords.length }} 节记录未关联当前课表，未计入统计</span><button type="button" class="text-command" @click="view = 'records'; recordScope = 'archive'; search = ''">查看记录<ChevronRight :size="15"/></button></div>
      <div class="attendance-toolbar"><div class="attendance-tabs" role="tablist" aria-label="出勤视图"><button id="attendance-courses-tab" type="button" role="tab" :aria-selected="view === 'courses'" aria-controls="attendance-courses-panel" @click="view = 'courses'">课程概览</button><button id="attendance-records-tab" type="button" role="tab" :aria-selected="view === 'records'" aria-controls="attendance-records-panel" @click="view = 'records'">记录明细</button></div><div class="backup-actions"><button type="button" class="attendance-icon" :disabled="!!storageError" aria-label="导出出勤备份" title="导出出勤备份" @click="exportBackup"><Download :size="18"/></button><button type="button" class="attendance-icon" :disabled="!!storageError" aria-label="导入出勤备份" title="导入出勤备份" @click="fileInput?.click()"><Upload :size="18"/></button><input ref="fileInput" type="file" accept="application/json,.json" hidden aria-label="出勤备份文件" @change="readImport"></div></div>
      <div class="attendance-filters"><label class="attendance-search"><Search :size="17" aria-hidden="true"/><input v-model="search" type="search" placeholder="搜索课程" aria-label="搜索课程"></label><label v-if="view === 'courses'" class="sort-filter">按余量排序<select v-model="sortMode" aria-label="排序计算口径"><option v-for="mode in ATTENDANCE_MODES" :key="mode.key" :value="mode.key">{{ mode.label }}</option></select></label><select v-else v-model="recordScope" aria-label="记录范围"><option value="current">当前课表</option><option value="archive">未关联记录</option><option value="all">全部记录</option></select></div>
      <div v-if="view === 'courses'" id="attendance-courses-panel" role="tabpanel" aria-labelledby="attendance-courses-tab">
        <div class="attendance-basis"><span>整学期时段为分母 · 缺勤率 &lt;30% · 课表一格计一节</span><label><input v-model="showConservative" type="checkbox">保守合并</label></div>
        <article v-for="item in visibleSummaries" :key="item.course.id" class="attendance-course-row" :style="getCourseVisual(item.course.title).style">
          <div class="course-row-title"><button type="button" class="course-detail-command" @click="detailId = item.course.id"><span class="course-source">{{ courseCaption(item.course) }} · {{ item.total }} 节</span><strong>{{ item.course.title }}</strong><span class="course-next">{{ item.nextDate ? `下次 ${item.nextDate.slice(5)} · 当日本课 ${item.nextCount} 节` : '本课全部时段已开始' }}</span><span class="course-detail-link">查看节次<ChevronRight :size="14"/></span></button></div>
          <div class="course-metrics"><AttendanceMetric v-for="mode in coreModes" :key="mode.key" :metric="item.metrics[mode.key]" :label="mode.key === 'actual' ? '已记录实际' : mode.label" :description="mode.description"/></div>
          <div class="course-completeness"><span>已记缺勤 {{ item.metrics.actual.count }} 节，其中点名缺勤 {{ item.metrics.called.count }} 节</span><span>已开始：到场未记录 {{ item.unknownPresence }} 节 · 点名待确认 {{ item.unknownRollCall }} 节</span></div>
          <div v-if="showConservative" class="conservative-row"><AttendanceMetric :metric="item.metrics.conservative" label="保守合并" :description="ATTENDANCE_MODES[3].description"/><span>实际缺勤与整日连带取并集</span></div>
        </article>
        <div v-if="!visibleSummaries.length" class="attendance-empty"><ClipboardCheck :size="30" aria-hidden="true"/><p>{{ courses.length ? '没有匹配的课程' : '当前课表暂无可统计的课程' }}</p></div>
      </div>
      <div v-else id="attendance-records-panel" role="tabpanel" aria-labelledby="attendance-records-tab">
        <div v-for="record in visibleRecords" :key="record.id" class="attendance-record-row"><div><strong>{{ record.event.title }}</strong><span>{{ record.event.date }} · {{ lessonLabel(record) }}{{ !lessons.has(record.id) ? ' · 未关联当前课表' : lessonStart(record, sessions) > now ? ' · 未开始，暂不计入事实统计' : '' }}</span></div><div class="record-state"><span :class="{ 'danger-text': record.presence === 'absent' }">{{ PRESENCE_LABELS[record.presence] }}</span><span>{{ ROLL_CALL_LABELS[record.rollCall] }}</span></div><div class="record-actions"><button v-if="lessons.has(record.id)" type="button" class="attendance-icon" :disabled="!!storageError || lessonStart(record, sessions) > now" :aria-label="`编辑${record.event.title}${record.event.date}${lessonLabel(record)}`" title="编辑记录" @click="openEditor(lessons.get(record.id))"><Pencil :size="17"/></button><button v-else type="button" class="attendance-icon" :disabled="!!storageError" aria-label="重新关联课程节次" title="重新关联课程节次" @click="reassign(record)"><ArrowRightLeft :size="17"/></button><button type="button" class="attendance-icon" :disabled="!!storageError" :aria-label="`删除${record.event.title}${record.event.date}${lessonLabel(record)}`" title="删除记录" @click="removeRecord(record)"><Trash2 :size="17"/></button></div></div>
        <div v-if="!visibleRecords.length" class="attendance-empty"><ClipboardCheck :size="30" aria-hidden="true"/><p>暂无{{ recordScope === 'archive' ? '未关联' : '匹配的' }}记录</p></div>
      </div>
      <footer class="attendance-footer"><span>记录保存在当前浏览器</span><span>缺勤率按已记录数据计算</span></footer>
    </div>
    <Dialog :open="detailId !== null" :title="detail?.course.title ?? '课程详情'" @update:open="detailId = null">
      <AttendanceDetail v-if="detail" :summary="detail" :records="records" :sessions="sessions" :now="now" :disabled="!!storageError" @select="openEditor"/>
    </Dialog>
    <AttendanceEditor :open="editorOpen" :courses="courses" :records="records" :sessions="sessions" :initial="initialLesson" :now="now" :reassign="!!reassignRecord" :original="reassignRecord" :original-label="reassignRecord ? lessonLabel(reassignRecord) : undefined" :error="message.includes('失败') ? message : ''" @save="saveRecords" @cancel="editorOpen = false"/>
    <Dialog v-model:open="rulesOpen" title="计算口径">
      <AttendanceRules/>
    </Dialog>
    <Dialog :open="importRecords !== null" title="导入出勤备份" @update:open="importRecords = null"><AttendanceImport :count="importRecords?.length ?? 0" :conflicts="importConflicts" :error="message.includes('失败') ? message : ''"/><template #actions><button type="button" class="secondary-button" @click="importRecords = null">取消</button><button type="button" class="primary-button" @click="confirmImport">合并导入</button></template></Dialog>
  </div>
</template>

<style scoped>
.attendance-page { width: 100%; min-height: 100%; color: var(--text); letter-spacing: 0; overflow-wrap: anywhere }
.attendance-content { max-width: 1120px; margin: 0 auto; padding: 30px 28px 24px }
.attendance-header { display: grid; grid-template-columns: 38px minmax(0, 1fr) 38px; align-items: center; gap: 14px; min-height: 62px }
.attendance-title { min-width: 0; text-align: center }
.attendance-title h1 { margin: 0; color: var(--text-strong); font-size: 28px; font-family: var(--font-display); font-weight: 650 }
.attendance-title p { margin: 8px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.6 }
.attendance-icon { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; flex: 0 0 38px; border: 0; border-radius: 14px; background: var(--block-blue); color: var(--text); cursor: pointer; text-decoration: none; transition: filter var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard) }
.attendance-icon svg { stroke-width: 1.65 }
.attendance-icon:hover { filter: brightness(1.035) }
.attendance-icon:active { transform: scale(.97) }
.attendance-settings { background: var(--block-warm) }
.attendance-overview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; align-items: center; gap: 20px; padding: 25px 4px; margin-top: 24px; border-bottom: 1px solid var(--border-soft) }
.attendance-overview > div { display: grid; gap: 10px; min-width: 0 }
.attendance-overview > div > span { font-size: 12px; color: var(--text-muted) }
.attendance-overview strong { font-family: var(--font-display); font-size: 28px; font-weight: 600; color: var(--text-strong); font-variant-numeric: tabular-nums }
.attendance-overview small { font-size: 12px; font-weight: 400; color: var(--text-muted) }
.record-command { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; font-size: 13px }
.attendance-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 22px }
.attendance-tabs, .backup-actions { display: flex; align-items: center; gap: 6px }
.attendance-tabs { padding: 4px; border-radius: 16px; background: var(--surface); box-shadow: var(--shadow-1) }
.attendance-tabs button { border: 0; border-radius: 12px; background: transparent; color: var(--text-muted); padding: 10px 17px; cursor: pointer; font-size: 13px; transition: color var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard) }
.attendance-tabs button[aria-selected="true"] { color: var(--fiddler-fg); background: var(--fiddler-bg); font-weight: 600 }
.backup-actions .attendance-icon { background: var(--surface) }
.attendance-filters { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 0 }
.attendance-search { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; max-width: 360px; padding: 0 12px; border-radius: 15px; background: color-mix(in srgb, var(--block-blue) 65%, var(--surface)); color: var(--text-muted) }
.attendance-search input { width: 100%; min-width: 0; padding: 11px 0; border: 0; outline: 0; background: transparent; color: var(--text-strong); font-size: 13px }
.attendance-search:focus-within { outline: 2px solid var(--accent) }
.attendance-search input:focus-visible { box-shadow: none }
.sort-filter { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted) }
.attendance-filters select { min-width: 0; min-height: 40px; border: 0; border-radius: 15px; background: var(--block-violet); color: var(--text-strong); padding: 10px 12px; font-size: 12px }
.attendance-basis { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-bottom: 15px; color: var(--text-muted); font-size: 11px }
.attendance-basis label { display: flex; gap: 5px; align-items: center; cursor: pointer }
.attendance-basis input { accent-color: var(--accent) }
.attendance-course-row { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(170px, .9fr) minmax(0, 2.4fr); gap: 19px 28px; margin-bottom: 12px; padding: 24px; border-radius: 11px; background: color-mix(in srgb, var(--course-base) 5%, var(--surface)); box-shadow: var(--shadow-1) }
.attendance-course-row::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 80px; z-index: -1; border-radius: 11px 0 0 11px; background: var(--course-base); opacity: .06; mask-image: var(--pattern-mask); mask-size: var(--pattern-size); mask-repeat: repeat; pointer-events: none }
.course-detail-command { display: grid; gap: 9px; border: 0; padding: 0; background: transparent; color: var(--text); text-align: left; cursor: pointer; width: 100%; min-width: 0 }
.course-detail-command strong { font-family: var(--font-display); font-size: 19px; font-weight: 600; line-height: 1.4; color: var(--text-strong); overflow-wrap: anywhere }
.course-source { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--text-muted) }
.course-source::before { content: ''; width: 6px; height: 12px; border-radius: 2px; background: var(--course-base); opacity: .75; flex-shrink: 0 }
.course-next { font-size: 11px; color: var(--text-muted) }
.course-detail-link { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--accent) }
.course-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-content: center }
.course-completeness { grid-column: 1 / -1; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding-top: 14px; border-top: 1px solid var(--border-soft); color: var(--text-muted); font-size: 11px; line-height: 1.6 }
.conservative-row { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 20px; align-items: center; padding: 15px 0 0; border-top: 1px dashed var(--border-soft) }
.conservative-row > span { color: var(--text-muted); font-size: 12px }
.attendance-notice { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--border-soft); font-size: 12px; line-height: 1.7 }
.text-command { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; padding: 6px 0; border: 0; background: transparent; color: var(--accent); cursor: pointer; font-size: 12px }
.danger-text, .attendance-overview .danger-text { color: var(--danger) }
.attendance-empty { display: grid; place-items: center; align-content: center; min-height: 220px; color: var(--text-muted); font-size: 14px }
.attendance-record-row { display: grid; grid-template-columns: minmax(0, 1fr) 130px 80px; gap: 12px; align-items: center; margin-bottom: 10px; padding: 18px; border-radius: 8px; background: var(--surface); box-shadow: var(--shadow-1) }
.attendance-record-row > div:first-child { display: grid; gap: 7px; min-width: 0 }
.attendance-record-row strong { color: var(--text-strong); font-family: var(--font-display); font-size: 17px; font-weight: 600; line-height: 1.5 }
.attendance-record-row span { color: var(--text-muted); font-size: 12px }
.record-state { display: flex; align-items: center; gap: 14px }
.attendance-record-row .danger-text { color: var(--danger) }
.record-actions { display: flex; gap: 4px }
.attendance-footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border-soft); color: var(--text-faint); font-size: 11px }
@media (max-width: 700px) {
.attendance-content { padding: 20px 14px 24px }
  .attendance-header { grid-template-columns: 38px minmax(0, 1fr) 38px; gap: 12px }
  .attendance-title h1 { font-size: 25px }
  .attendance-title p { font-size: 11px }
  .attendance-overview { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px 10px; padding: 18px 4px; margin-top: 14px }
  .attendance-overview > div > span { min-height: 32px; font-size: 11px; line-height: 1.5 }
  .attendance-overview strong { font-size: 25px }
  .record-command { grid-column: 1 / -1; width: 100% }
  .attendance-course-row { grid-template-columns: minmax(0, 1fr); gap: 19px; padding: 20px 16px }
  .course-detail-command { grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px }
  .course-detail-command strong { grid-column: 1 / -1; grid-row: 2 }
  .course-next { grid-column: 1 / -1 }
  .course-detail-link { grid-column: 2; grid-row: 1 }
  .course-metrics { gap: 14px }
  .attendance-record-row { grid-template-columns: minmax(0, 1fr) 76px; gap: 6px 10px }
  .record-state { grid-column: 1; grid-row: 2 }
  .record-actions { grid-column: 2; grid-row: 1 / 3 }
  .sort-filter { flex-direction: column; align-items: flex-end; gap: 4px }
}
@media (max-width: 360px) {
  .attendance-content { padding-right: 10px; padding-left: 10px }
  .attendance-title h1 { font-size: 23px }
  .attendance-course-row { padding: 18px 12px }
  .course-metrics { gap: 10px }
  .attendance-tabs button { padding-right: 12px; padding-left: 12px }
}
</style>
