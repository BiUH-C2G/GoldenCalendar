<script setup lang="ts">
import {computed} from 'vue'
import {Pencil} from 'lucide-vue-next'
import {ATTENDANCE_MODES, lessonStart, PRESENCE_LABELS, ROLL_CALL_LABELS} from '@/Attendance'
import type {AttendanceLesson, AttendanceRecord, summarizeAttendance} from '@/Attendance'
import AttendanceMetric from '@/view/AttendanceMetric.vue'

const props = defineProps<{ summary: ReturnType<typeof summarizeAttendance>, records: AttendanceRecord[], sessions: string[], now: number, disabled: boolean }>()
const emit = defineEmits<{ select: [lesson: AttendanceLesson] }>()
const days = computed(() => {
  const groups = new Map<string, AttendanceLesson[]>()
  for (const lesson of props.summary.course.lessons) groups.set(lesson.event.date, [...groups.get(lesson.event.date) ?? [], lesson])
  return [...groups].map(([date, lessons]) => ({date, lessons}))
})
const recordIndex = computed(() => new Map(props.records.map((record) => [record.id, record])))

function recordLabel(lesson: AttendanceLesson) {
  if (lessonStart(lesson, props.sessions) > props.now) return '未开始'
  const record = recordIndex.value.get(lesson.id)
  return `${PRESENCE_LABELS[record?.presence ?? 'unknown']} · ${ROLL_CALL_LABELS[record?.rollCall ?? 'unknown']}`
}
</script>

<template>
  <div class="attendance-detail">
    <section>
      <h3 class="dialog-group-title">出勤概况</h3>
      <div class="detail-metrics">
        <AttendanceMetric v-for="mode in ATTENDANCE_MODES" :key="mode.key" :metric="summary.metrics[mode.key]" :label="mode.label" :description="mode.description"/>
      </div>
      <p class="detail-basis">全学期 {{ summary.total }} 节 · 严格低于 30% 时最多计缺勤 {{ summary.metrics.actual.maximum }} 节</p>
    </section>
    <section v-for="day in days" :key="day.date" class="detail-day">
      <h3 class="dialog-group-title">{{ day.date }} · {{ day.lessons.length }} 节</h3>
      <button v-for="(lesson, index) in day.lessons" :key="lesson.id" type="button" :disabled="disabled || lessonStart(lesson, sessions) > now" @click="emit('select', lesson)">
        <span>第 {{ index + 1 }} 节<small>{{ sessions[lesson.event.slot - 1] }}</small></span><span>{{ recordLabel(lesson) }}</span>
        <Pencil :size="15" aria-hidden="true"/>
      </button>
    </section>
  </div>
</template>

<style scoped>
.attendance-detail {
  display: grid;
  gap: 24px;
  min-width: 0;
  overflow-wrap: anywhere
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px
}

.detail-basis {
  margin: 14px 2px 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.8
}

.detail-day button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 60px;
  padding: 12px 14px;
  border: 0;
  border-radius: 8px;
  background: var(--block-blue);
  text-align: left;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: filter var(--duration-fast) var(--ease-standard)
}

.detail-day button + button {
  margin-top: 8px
}

.detail-day button:nth-of-type(even) {
  background: var(--block-green)
}

.detail-day button:hover:not(:disabled) {
  filter: brightness(1.025)
}

.detail-day button > span:first-child {
  display: grid;
  gap: 5px;
  color: var(--text-strong)
}

.detail-day button small {
  color: var(--text-muted);
  font-size: 12px
}

.detail-day button svg {
  flex-shrink: 0;
  color: var(--text-muted)
}
</style>
