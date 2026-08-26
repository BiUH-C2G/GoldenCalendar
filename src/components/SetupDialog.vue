<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
  RadioGroupIndicator,
  RadioGroupItem,
  RadioGroupRoot,
} from 'reka-ui'
import { Check, ChevronDown, Monitor, Moon, Sun, X } from 'lucide-vue-next'
import type { Manifest, ScheduleSource, Selection } from '@/types'

type ThemePreference = 'system' | 'light' | 'dark'

const props = defineProps<{
  open: boolean
  manifest: Manifest
  selection: Selection | null
  required: boolean
  theme: ThemePreference
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:theme': [value: ThemePreference]
  save: [selection: Selection]
}>()

const grade = ref('')
const majorCode = ref('')
const groupId = ref('')
const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Monitor }> = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '月之亮面', icon: Sun },
  { value: 'dark', label: '月之暗面', icon: Moon },
]

const grades = computed(() => [...new Set(props.manifest.sources.map((source) => source.grade))].sort())
const majors = computed(() => {
  return [...new Set(
    props.manifest.sources
      .filter((source) => source.grade === grade.value)
      .map((source) => source.major),
  )].sort()
})
const source = computed<ScheduleSource | undefined>(() => props.manifest.sources.find(
  (item) => item.grade === grade.value && item.major === majorCode.value,
))
const groups = computed(() => source.value?.groups ?? [])
const canSave = computed(() => Boolean(grade.value && majorCode.value && groupId.value))

watch(() => props.open, (open) => {
  if (!open) return
  grade.value = props.selection?.grade ?? grades.value[0] ?? ''
  majorCode.value = props.selection?.majorCode ?? ''
  groupId.value = props.selection?.groupId ?? ''
  if (!majorCode.value || !majors.value.includes(majorCode.value)) majorCode.value = majors.value[0] ?? ''
  if (!groupId.value || !groups.value.includes(groupId.value)) {
    groupId.value = groups.value[0] ?? ''
  }
})

watch(grade, () => {
  if (!majors.value.includes(majorCode.value)) majorCode.value = majors.value[0] ?? ''
})

watch(majorCode, () => {
  if (!groups.value.includes(groupId.value)) groupId.value = groups.value[0] ?? ''
})

function save() {
  if (!canSave.value) return
  emit('save', { grade: grade.value, majorCode: majorCode.value, groupId: groupId.value })
}

function updateTheme(value: unknown) {
  if (value !== 'system' && value !== 'light' && value !== 'dark') return
  emit('update:theme', value)
}

function close() {
  if (!props.required) emit('update:open', false)
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent class="dialog-content">
        <div class="dialog-heading">
          <DialogTitle>选择课程表</DialogTitle>
          <DialogDescription>选择你的年级、专业和班级</DialogDescription>
        </div>
        <DialogClose v-if="!required" class="icon-button dialog-close" aria-label="关闭" title="关闭" @click="close">
          <X :size="18" />
        </DialogClose>

        <div class="form-stack">
          <label class="field-label" for="grade">年级</label>
          <SelectRoot v-model="grade">
            <SelectTrigger id="grade" class="select-trigger" aria-label="年级">
              <SelectValue placeholder="选择年级" />
              <ChevronDown :size="16" />
            </SelectTrigger>
            <SelectPortal>
              <SelectContent class="select-content" position="popper" side="bottom" align="start" :side-offset="4">
                <SelectViewport>
                  <SelectItem v-for="item in grades" :key="item" :value="item" class="select-item">
                    <SelectItemText>{{ item }}级</SelectItemText>
                    <SelectItemIndicator>
                      <Check :size="16" />
                    </SelectItemIndicator>
                  </SelectItem>
                </SelectViewport>
              </SelectContent>
            </SelectPortal>
          </SelectRoot>

          <label class="field-label" for="major">专业</label>
          <SelectRoot v-model="majorCode">
            <SelectTrigger id="major" class="select-trigger" aria-label="专业">
              <SelectValue placeholder="选择专业" />
              <ChevronDown :size="16" />
            </SelectTrigger>
            <SelectPortal>
              <SelectContent class="select-content" position="popper" side="bottom" align="start" :side-offset="4">
                <SelectViewport>
                  <SelectItem v-for="item in majors" :key="item" :value="item" class="select-item">
                    <SelectItemText>{{ item }}</SelectItemText>
                    <SelectItemIndicator>
                      <Check :size="16" />
                    </SelectItemIndicator>
                  </SelectItem>
                </SelectViewport>
              </SelectContent>
            </SelectPortal>
          </SelectRoot>

          <label class="field-label" for="group">班级</label>
          <SelectRoot v-model="groupId">
            <SelectTrigger id="group" class="select-trigger" aria-label="班级">
              <SelectValue placeholder="选择班级" />
              <ChevronDown :size="16" />
            </SelectTrigger>
            <SelectPortal>
              <SelectContent class="select-content" position="popper" side="bottom" align="start" :side-offset="4">
                <SelectViewport>
                  <SelectItem v-for="item in groups" :key="item" :value="item" class="select-item">
                    <SelectItemText>{{ item }}班</SelectItemText>
                    <SelectItemIndicator>
                      <Check :size="16" />
                    </SelectItemIndicator>
                  </SelectItem>
                </SelectViewport>
              </SelectContent>
            </SelectPortal>
          </SelectRoot>

          <span class="field-label">外观</span>
          <RadioGroupRoot
            class="theme-options"
            aria-label="外观"
            :model-value="theme"
            orientation="horizontal"
            @update:model-value="updateTheme"
          >
            <RadioGroupItem v-for="item in themeOptions" :key="item.value" :value="item.value" class="theme-option">
              <component :is="item.icon" :size="16" stroke-width="1.8" />
              <span>{{ item.label }}</span>
              <RadioGroupIndicator class="theme-radio-indicator">
                <Check :size="12" />
              </RadioGroupIndicator>
            </RadioGroupItem>
          </RadioGroupRoot>
        </div>

        <button class="primary-button full-width" type="button" :disabled="!canSave" @click="save">
          <Check :size="17" />
          确认
        </button>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
