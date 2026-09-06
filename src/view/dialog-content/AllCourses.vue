<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import { getCourseVisual } from '@/CourseVisual'
import type { ScheduleEvent } from '@/Types'
import '@/style/CourseTile.css'

const props = defineProps<{ events: ScheduleEvent[] }>()
const emit = defineEmits<{ select: [title: string] }>()
const filter = ref('')
const courses = computed(() => {
  const groups = new Map<string, ScheduleEvent[]>()
  for (const event of props.events) {
    const events = groups.get(event.title) ?? []
    events.push(event)
    groups.set(event.title, events)
  }
  return [...groups].map(([title, events]) => ({ title, count: events.length, teachers: [...new Set(events.flatMap((event) => event.teacher ? [event.teacher] : []))].join('、'), visual: getCourseVisual(title) })).sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
})
const filtered = computed(() => courses.value.filter((course) => course.title.toLocaleLowerCase().includes(filter.value.trim().toLocaleLowerCase())))
</script>

<template>
  <div class="all-courses">
    <label class="course-filter"><Search :size="18" aria-hidden="true"/><input v-model="filter" type="search" placeholder="筛选课程名称" aria-label="筛选课程名称" data-dialog-autofocus></label>
    <p class="course-count">{{ filtered.length }} 门课程</p>
    <div class="all-course-grid">
      <button v-for="course in filtered" :key="course.title" class="course-tile catalog-tile" type="button" :style="course.visual.style" @click="emit('select', course.title)"><strong>{{ course.title }}</strong><span>{{ course.teachers || '教师未注明' }}</span><small>{{ course.count }} 个上课时段</small></button>
    </div>
    <p v-if="!filtered.length" role="status">{{ courses.length ? '没有匹配的课程' : '当前课表暂无课程' }}</p>
  </div>
</template>

<style scoped>
.all-courses { min-width: 0 }
.course-filter { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; background: var(--surface-subtle); color: var(--text-muted) }
.course-filter input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text-strong); font: inherit }
.course-filter:focus-within { outline: 2px solid var(--accent) }
.course-filter input:focus-visible { box-shadow: none }
.course-count { color: var(--text-muted); font-size: 13px }
.all-course-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px }
.catalog-tile { display: flex; flex-direction: column; gap: 8px; min-height: 152px; padding: 12px; text-align: left }
.catalog-tile > * { position: relative; z-index: 1; overflow-wrap: anywhere }
.catalog-tile strong { color: var(--course-ink); font-size: 16px; font-weight: 720; line-height: 1.3 }
.catalog-tile span { color: var(--course-meta); font-size: 14px; line-height: 1.32 }
.catalog-tile small { margin-top: auto; color: var(--course-meta) }
</style>
