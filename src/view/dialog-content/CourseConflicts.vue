<script setup lang="ts">
import { computed } from 'vue'
import { formatConflictWeeks } from '@/Conflicts'
import type { CourseConflict } from '@/Conflicts'
import { WEEKDAYS } from '@/Schedule'

const props = defineProps<{ conflicts: CourseConflict[], sessions: string[] }>()
const emit = defineEmits<{ back: [], confirm: [] }>()
const occurrenceCount = computed(() => props.conflicts.reduce((count, conflict) => count + conflict.dates.length, 0))
const includesPhysicalEducation = computed(() => props.conflicts.some((conflict) => conflict.courses.some((course) => course.source === 'physicalEducation')))
</script>

<template>
  <div class="conflict-content">
    <p class="conflict-overview">共 {{ conflicts.length }} 组课程冲突，涉及 {{ occurrenceCount }} 个上课时段</p>
    <p v-if="includesPhysicalEducation" class="conflict-note">体育授课周次尚未公布，涉及体育的冲突按当前学期每周安排推算</p>
    <ol class="conflict-list">
      <li v-for="(conflict, index) in conflicts" :key="index" class="conflict-item">
        <header class="conflict-heading"><h3>{{ WEEKDAYS[conflict.weekday - 1]?.label }} · 第 {{ conflict.slot }} 节</h3><span>{{ sessions[conflict.slot - 1] ?? '时间待定' }}</span></header>
        <p class="conflict-weeks">第 {{ formatConflictWeeks(conflict.weeks) }} 周 · {{ conflict.dates.length }} 次</p>
        <ul class="conflict-courses"><li v-for="(course, courseIndex) in conflict.courses" :key="courseIndex"><strong>{{ course.title }}</strong><span>{{ course.teacher ?? '教师待定' }} · {{ course.room ?? '场地待定' }}</span></li></ul>
        <details class="conflict-dates"><summary>具体日期</summary><p>{{ conflict.dates.join('、') }}</p></details>
      </li>
    </ol>
    <div class="dialog-actions conflict-actions"><button class="primary-button" type="button" data-dialog-autofocus @click="emit('back')">返回修改</button><button class="secondary-button conflict-confirm" type="button" @click="emit('confirm')">坚持保存</button></div>
  </div>
</template>

<style scoped>
.conflict-content { min-width: 0; overflow-wrap: anywhere; line-height: 1.6 }
.conflict-overview { margin: 0 0 12px; color: var(--text-muted); font-size: 14px }
.conflict-note { margin: 0 0 16px; padding: 10px 12px; border-left: 3px solid var(--danger); color: var(--text); background: var(--surface-subtle); font-size: 13px }
.conflict-list { margin: 0; padding: 0; list-style: none }
.conflict-item { padding: 16px 0; border-top: 1px solid var(--border-soft) }
.conflict-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px }
.conflict-heading h3 { margin: 0; color: var(--text-strong); font-size: 16px; font-weight: 650 }
.conflict-heading span, .conflict-weeks { color: var(--text-muted); font-size: 13px }
.conflict-weeks { margin: 4px 0 12px }
.conflict-courses { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none }
.conflict-courses li { display: grid; gap: 2px; padding-left: 12px; border-left: 2px solid var(--danger) }
.conflict-courses strong { color: var(--text-strong); font-size: 14px; font-weight: 600 }
.conflict-courses span { color: var(--text-muted); font-size: 13px }
.conflict-dates { margin-top: 12px; color: var(--text-muted); font-size: 12px }
.conflict-dates summary { width: fit-content; cursor: pointer }
.conflict-dates p { margin: 8px 0 0 }
.conflict-actions { position: sticky; bottom: -1px; display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; padding: 14px 0 2px; background: var(--surface-solid) }
.conflict-actions button { flex: 1 1 120px; min-width: 0; white-space: normal }
.conflict-confirm { color: var(--danger) }
.conflict-confirm:hover { background: color-mix(in srgb, var(--danger) 12%, var(--surface-solid)) }
</style>
