<script setup lang="ts">
import { computed } from 'vue'
import { getCourseVisual } from '@/CourseVisual'
import type { ScheduleEvent } from '@/Types'

const props = defineProps<{ event: ScheduleEvent, time: string }>()
const emit = defineEmits<{ calendar: [], close: [], copy: [label: string, value: string] }>()
const visual = computed(() => getCourseVisual(props.event.title))
const rows = computed(() => [
  { label: '课程', value: props.event.title },
  { label: '教师', value: props.event.teacher ?? '未注明' },
  { label: '上课地点', value: props.event.room ?? '未注明' },
  { label: '时间', value: props.time },
  { label: '本课程来自', copyLabel: '课表来源', value: props.event.source === 'physicalEducation' ? '体育课表' : props.event.source === 'language' ? '语言班课表' : '行政班课表' },
  { label: '颜色', value: visual.value.color.name },
  { label: '纹理', value: visual.value.pattern.name }
])
</script>

<template>
  <div class="course-detail">
    <dl class="course-detail-list">
      <div v-for="row in rows" :key="row.label" class="course-detail-row" role="button" tabindex="0" title="点击复制" :aria-label="`复制${row.copyLabel ?? row.label}：${row.value}`" @click="emit('copy', row.copyLabel ?? row.label, row.value)" @keydown.enter.prevent="emit('copy', row.copyLabel ?? row.label, row.value)" @keydown.space.prevent="emit('copy', row.copyLabel ?? row.label, row.value)"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
    </dl>

    <div class="dialog-actions course-detail-actions">
      <button class="primary-button" type="button" @click="emit('calendar')">搞到日历里去</button>
      <button class="secondary-button" type="button" @click="emit('close')">好的</button>
    </div>
  </div>
</template>

<style scoped>
.course-detail-list {
  display: grid;
  gap: 10px;
  margin: 4px 0 0;
}

.course-detail-list > div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 14px;
  padding: 13px 14px;
  border-radius: 16px;
  cursor: copy;
  transition: filter var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);
}

.course-detail-row:nth-child(odd) {
  background: var(--block-warm);
}

.course-detail-row:nth-child(even) {
  background: var(--block-blue);
}

.course-detail-row:hover {
  filter: brightness(1.025);
}

.course-detail-row:active {
  transform: scale(.992);
}

.course-detail-list dt {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
  text-align: left;
}

.course-detail-list dd {
  min-width: 0;
  margin: 0;
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
}

.course-detail-actions {
  margin-top: 18px;
}
</style>
