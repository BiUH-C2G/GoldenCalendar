<script setup lang="ts">
import {computed, ref, useId, watch} from 'vue'
import {Check, ListChecks, Search} from 'lucide-vue-next'
import {currentAttendanceLessons, lessonStart, PRESENCE_LABELS, ROLL_CALL_LABELS} from '@/Attendance'
import type {AttendanceCourse, AttendanceLesson, AttendanceRecord, Presence, RollCall} from '@/Attendance'
import {getShanghaiToday} from '@/DateTime'
import Dialog from '@/view/Dialog.vue'

const props = defineProps<{ open: boolean, courses: AttendanceCourse[], records: AttendanceRecord[], sessions: string[], initial?: AttendanceLesson, now: number, reassign?: boolean, original?: AttendanceRecord, originalLabel?: string, error?: string }>()
const emit = defineEmits<{ save: [records: AttendanceRecord[]], cancel: [] }>()
const formId = useId()
const date = ref(props.initial?.event.date ?? getShanghaiToday(new Date(props.now)))
const search = ref(props.initial?.event.title ?? '')
const selected = ref<string[]>([])
const drafts = ref<Record<string, { presence: Presence, rollCall: RollCall }>>({})
const bulkPresence = ref<Presence>('absent')
const bulkRollCall = ref<RollCall>('unknown')
const today = computed(() => getShanghaiToday(new Date(props.now)))
const allLessons = computed(() => props.courses.flatMap((course) => course.lessons))
const dayCourses = computed(() => props.courses.filter((course) => course.title.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())).map((course) => ({...course, lessons: course.lessons.filter((lesson) => lesson.event.date === date.value)})).filter((course) => course.lessons.length))
const chosen = computed(() => allLessons.value.filter((lesson) => selected.value.includes(lesson.id)))
const absentCount = computed(() => chosen.value.filter((lesson) => drafts.value[lesson.id]?.presence === 'absent').length)
const calledCount = computed(() => chosen.value.filter((lesson) => drafts.value[lesson.id]?.presence === 'absent' && drafts.value[lesson.id]?.rollCall === 'yes').length)

function initialize() {
  selected.value = []
  drafts.value = Object.fromEntries(allLessons.value.filter((lesson) => lesson.event.date === date.value).map((lesson) => {
    const record = props.original ?? props.records.find((item) => item.id === lesson.id)
    return [lesson.id, {presence: record?.presence ?? 'absent', rollCall: record?.rollCall ?? 'unknown'}]
  }))
}

function toggle(lesson: AttendanceLesson, checked: boolean) {
  if (lessonStart(lesson, props.sessions) > props.now) return
  if (checked) selected.value = props.reassign ? [lesson.id] : [...new Set([...selected.value, lesson.id])]
  else selected.value = selected.value.filter((id) => id !== lesson.id)
}

function selectCourse(course: AttendanceCourse) {
  const ids = course.lessons.filter((lesson) => lessonStart(lesson, props.sessions) <= props.now).map((lesson) => lesson.id)
  const allSelected = ids.every((id) => selected.value.includes(id))
  selected.value = allSelected ? selected.value.filter((id) => !ids.includes(id)) : [...new Set([...selected.value, ...ids])]
}

function applyBulk() {
  for (const id of selected.value) drafts.value[id] = {presence: bulkPresence.value, rollCall: bulkRollCall.value}
}

function save() {
  const updatedAt = new Date().toISOString()
  const records = chosen.value.filter((lesson) => lessonStart(lesson, props.sessions) <= Date.now()).map((lesson) => ({...lesson, ...drafts.value[lesson.id], updatedAt}))
  if (records.length) emit('save', records)
}

watch(date, initialize, {flush: 'sync'})
watch(() => props.open, (open) => {
  if (!open) return
  date.value = props.initial?.event.date ?? getShanghaiToday(new Date(props.now))
  search.value = props.initial?.event.title ?? ''
  bulkPresence.value = 'absent'
  bulkRollCall.value = 'unknown'
  initialize()
  if (props.initial && allLessons.value.some((lesson) => lesson.id === props.initial?.id)) toggle(props.initial, true)
  else if (!props.reassign) for (const lesson of currentAttendanceLessons(props.courses, props.sessions, new Date(props.now))) toggle(lesson, true)
}, {immediate: true})
</script>

<template>
  <Dialog :open="open" :title="reassign ? '重新关联记录' : '记录出勤'" @update:open="emit('cancel')">
    <form :id="formId" class="attendance-editor" @submit.prevent="save">
      <section v-if="original" class="editor-original">
        <h3 class="dialog-group-title">原记录</h3>
        <p>{{ original.event.title }} · {{ original.event.date }} · {{ originalLabel }} · {{ PRESENCE_LABELS[original.presence] }} · {{ ROLL_CALL_LABELS[original.rollCall] }}</p>
        <p>保存后替换原关联；目标节次已有记录时，以本次填写为准</p>
      </section>
      <div class="editor-filters">
        <label>上课日期<input v-model="date" type="date" :max="today" data-dialog-autofocus></label><label>课程名称
          <div class="editor-search">
            <Search :size="16" aria-hidden="true"/>
            <input v-model="search" type="search" placeholder="输入课程名" list="attendance-course-names"></div>
        </label>
      </div>
      <datalist id="attendance-course-names">
        <option v-for="course in courses" :key="course.id" :value="course.title"/>
      </datalist>
      <div class="bulk-controls">
        <label>到场<select v-model="bulkPresence" aria-label="批量到场状态">
          <option v-for="(label, value) in PRESENCE_LABELS" :key="value" :value="value">{{ label }}</option>
        </select></label><label>点名<select v-model="bulkRollCall" aria-label="批量点名状态">
          <option v-for="(label, value) in ROLL_CALL_LABELS" :key="value" :value="value">{{ label }}</option>
        </select></label>
        <button type="button" class="secondary-button" :disabled="!selected.length" @click="applyBulk">应用到所选</button>
      </div>
      <section v-for="course in dayCourses" :key="course.id" class="editor-course">
        <div class="editor-course-heading">
          <h3 class="dialog-group-title">{{ course.title }}</h3>
          <button v-if="!reassign" type="button" class="attendance-icon" :aria-label="`全选或取消当天${course.title}`" title="全选或取消当天本课" @click="selectCourse(course)">
            <ListChecks :size="20"/>
          </button>
        </div>
        <div v-for="(lesson, index) in course.lessons" :key="lesson.id" class="editor-lesson" :class="{ selected: selected.includes(lesson.id) }">
          <label class="lesson-choice"><input type="checkbox" :checked="selected.includes(lesson.id)" :disabled="lessonStart(lesson, sessions) > now" :aria-label="`选择${course.title}第${index + 1}节`" @change="toggle(lesson, ($event.target as HTMLInputElement).checked)"><span><strong>第 {{ index + 1 }} 节</strong><small>{{ sessions[lesson.event.slot - 1] }}{{ lessonStart(lesson, sessions) > now ? ' · 未开始' : records.some((record) => record.id === lesson.id) ? ' · 已记录' : '' }}</small></span></label>
          <div class="lesson-controls">
            <select v-model="drafts[lesson.id].presence" :disabled="!selected.includes(lesson.id)" :aria-label="`${course.title}第${index + 1}节到场状态`">
              <option v-for="(label, value) in PRESENCE_LABELS" :key="value" :value="value">{{ label }}</option>
            </select><select v-model="drafts[lesson.id].rollCall" :disabled="!selected.includes(lesson.id)" :aria-label="`${course.title}第${index + 1}节点名状态`">
              <option v-for="(label, value) in ROLL_CALL_LABELS" :key="value" :value="value">{{ label }}</option>
            </select>
          </div>
        </div>
      </section>
      <p v-if="!dayCourses.length" class="attendance-empty">{{ date > today ? '未来课程尚未开始' : '该日期没有匹配的课程' }}</p>
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
    </form>
    <template #actions>
      <p class="editor-selection" role="status">已选 {{ selected.length }} 节 · 缺勤 {{ absentCount }} 节 · 其中点名缺勤 {{ calledCount }} 节</p>
      <button type="button" class="secondary-button" @click="emit('cancel')">取消</button>
      <button type="submit" :form="formId" class="primary-button editor-save" :disabled="!selected.length">
        <Check :size="17" aria-hidden="true"/>
        {{ reassign ? '关联并保存' : '保存记录' }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.attendance-editor {
  min-width: 0;
  font-size: 13px;
  overflow-wrap: anywhere
}

.editor-original {
  margin-bottom: 24px
}

.editor-original p {
  margin: 8px 2px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.8
}

.editor-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: 12px
}

.editor-filters label {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: var(--text-muted)
}

.attendance-editor input:not([type="checkbox"]), .attendance-editor select {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  border: 0;
  border-radius: 15px;
  padding: 10px 12px;
  background: var(--block-blue);
  color: var(--text-strong)
}

.attendance-editor input[type="date"] {
  background: var(--block-green)
}

.attendance-editor input[type="search"] {
  background: var(--block-warm)
}

.editor-search {
  display: flex;
  align-items: center;
  gap: 5px
}

.bulk-controls {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 10px;
  padding: 22px 0;
  border-bottom: 1px solid var(--border-soft)
}

.bulk-controls label {
  display: grid;
  gap: 5px;
  flex: 1;
  min-width: 75px
}

.bulk-controls button {
  min-height: 42px;
  padding: 10px 12px
}

.bulk-controls label:first-child select {
  background: var(--block-green)
}

.editor-course {
  padding-top: 24px
}

.editor-course-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px
}

.editor-course-heading .dialog-group-title {
  min-width: 0;
  margin-bottom: 0
}

.editor-lesson {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  padding: 14px 12px;
  border-radius: 8px;
  background: var(--surface-subtle);
  transition: background var(--duration-fast) var(--ease-standard)
}

.editor-lesson.selected {
  background: var(--block-green)
}

.lesson-choice {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer
}

.lesson-choice input {
  width: 17px;
  height: 17px;
  accent-color: var(--accent)
}

.lesson-choice span {
  display: grid;
  gap: 4px
}

.lesson-choice small {
  color: var(--text-muted);
  font-size: 11px
}

.lesson-controls {
  display: flex;
  gap: 6px
}

.lesson-controls select {
  width: 88px;
  background: var(--surface-solid)
}

.editor-selection {
  flex-basis: 100%;
  margin: 0 0 3px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6
}

.editor-save {
  display: inline-flex;
  align-items: center;
  gap: 6px
}

.editor-error {
  color: var(--danger);
  line-height: 1.6
}

.attendance-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 0;
  border-radius: 14px;
  background: var(--block-blue);
  color: var(--text-muted);
  cursor: pointer
}

.attendance-icon:hover {
  background: var(--surface-subtle)
}

.attendance-empty {
  padding: 28px 0;
  color: var(--text-muted);
  text-align: center
}

@media (max-width: 400px) {
  .editor-filters {
    grid-template-columns: minmax(0, 1fr)
  }

  .lesson-controls {
    margin-left: 27px;
    width: calc(100% - 27px)
  }

  .lesson-controls select {
    flex: 1
  }
}
</style>
