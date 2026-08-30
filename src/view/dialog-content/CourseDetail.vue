<script setup lang="ts">
import { computed } from 'vue'
import type { ScheduleEvent } from '@/Types'

const props = defineProps<{ event: ScheduleEvent, time: string }>()
const emit = defineEmits<{ calendar: [], close: [], copy: [label: string, value: string] }>()
const rows = computed(() => [
  { label: '课程', value: props.event.title },
  { label: '教师', value: props.event.teacher ?? '未注明' },
  { label: '上课地点', value: props.event.room ?? '未注明' },
  { label: '时间', value: props.time },
  { label: '本课程来自', copyLabel: '课表来源', value: props.event.source === 'language' ? '语言班课表' : '行政班课表' }
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
