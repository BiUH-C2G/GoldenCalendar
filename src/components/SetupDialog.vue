<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  dataContract,
  getEnglishClassNumbers,
  getGermanSection,
  getGrade,
  getMajor,
} from '@/contract'
import type { Selection } from '@/types'

type ThemePreference = 'system' | 'light' | 'dark'

const props = defineProps<{
  open: boolean
  selection: Selection | null
  required: boolean
  theme: ThemePreference
  debug: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:theme': [value: ThemePreference]
  save: [selection: Selection]
  reset: []
}>()

const grade = ref('')
const majorCode = ref('')
const groupId = ref('')
const englishClassNumber = ref('')
const englishCatchupEnabled = ref(false)
const englishCatchupClassNumber = ref('')
const germanLevel = ref('')
const germanClassNumber = ref('')

const grades = computed(() => dataContract.grades)
const gradeContract = computed(() => getGrade(grade.value))
const majors = computed(() => gradeContract.value?.majors ?? [])
const groups = computed(() => getMajor(grade.value, majorCode.value)?.groups ?? [])
const isEnglishGrade = computed(() => Boolean(gradeContract.value?.english))
const englishClasses = computed(() => getEnglishClassNumbers(majorCode.value))
const catchupClasses = computed(() => dataContract.languages.english.catchupClasses)
const germanSection = computed(() => getGermanSection(grade.value))
const germanLevels = computed(() => germanSection.value?.levels.map((item) => item.level) ?? [])
const germanClasses = computed(() => (
  germanSection.value?.levels.find((item) => item.level === germanLevel.value)?.classes ?? []
))

const canSave = computed(() => Boolean(
  grade.value
  && majorCode.value
  && groupId.value
  && germanClassNumber.value
  && (!isEnglishGrade.value || englishClassNumber.value)
  && (!englishCatchupEnabled.value || englishCatchupClassNumber.value),
))

watch(() => props.open, (open) => {
  if (!open) return
  grade.value = props.selection?.grade ?? grades.value[0]?.grade ?? ''
  majorCode.value = props.selection?.majorCode ?? ''
  groupId.value = props.selection?.groupId ?? ''
  englishClassNumber.value = props.selection?.englishClassNumber ?? ''
  englishCatchupEnabled.value = Boolean(props.selection?.englishCatchupEnabled)
  englishCatchupClassNumber.value = props.selection?.englishCatchupClassNumber ?? ''
  germanLevel.value = props.selection?.germanLevel ?? ''
  germanClassNumber.value = props.selection?.germanClassNumber ?? ''
  normalizeMajor()
  normalizeGroup()
  normalizeEnglishClass()
  normalizeGermanLevel()
  normalizeCatchupClass()
})

watch(grade, () => {
  normalizeMajor()
  normalizeGroup()
  normalizeEnglishClass()
  normalizeGermanLevel()
})
watch(majorCode, () => {
  normalizeGroup()
  normalizeEnglishClass()
})
watch(germanLevel, normalizeGermanClass)
watch(englishCatchupEnabled, normalizeCatchupClass)

function normalizeMajor() {
  if (!majors.value.some((major) => major.code === majorCode.value)) majorCode.value = majors.value[0]?.code ?? ''
}

function normalizeGroup() {
  if (!groups.value.includes(groupId.value)) groupId.value = groups.value[0] ?? ''
}

function normalizeEnglishClass() {
  if (!isEnglishGrade.value) {
    englishClassNumber.value = ''
    englishCatchupEnabled.value = false
    englishCatchupClassNumber.value = ''
    return
  }
  if (!englishClasses.value.includes(englishClassNumber.value)) {
    englishClassNumber.value = englishClasses.value[0] ?? ''
  }
}

function normalizeCatchupClass() {
  if (!englishCatchupEnabled.value) {
    englishCatchupClassNumber.value = ''
    return
  }
  if (!catchupClasses.value.includes(englishCatchupClassNumber.value)) {
    englishCatchupClassNumber.value = catchupClasses.value[0] ?? ''
  }
}

function normalizeGermanLevel() {
  if (!germanLevels.value.includes(germanLevel.value)) germanLevel.value = germanLevels.value[0] ?? ''
  normalizeGermanClass()
}

function normalizeGermanClass() {
  if (!germanClasses.value.includes(germanClassNumber.value)) {
    germanClassNumber.value = germanClasses.value[0] ?? ''
  }
}

function save() {
  if (!canSave.value) return
  emit('save', {
    term: dataContract.term,
    grade: grade.value,
    majorCode: majorCode.value,
    groupId: groupId.value,
    englishClassNumber: isEnglishGrade.value ? englishClassNumber.value : null,
    englishCatchupEnabled: isEnglishGrade.value && englishCatchupEnabled.value,
    englishCatchupClassNumber: isEnglishGrade.value && englishCatchupEnabled.value
      ? englishCatchupClassNumber.value
      : null,
    germanLevel: germanLevel.value,
    germanClassNumber: germanClassNumber.value,
  })
}

function setTheme(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'system' || value === 'light' || value === 'dark') emit('update:theme', value)
}

function close() {
  if (!props.required) emit('update:open', false)
}
</script>

<template>
  <div v-if="open" class="dialog-overlay" @click.self="close">
    <section class="dialog-content" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <header>
        <h2 id="setup-title">设置课程表</h2>
        <button v-if="!required" type="button" @click="close">关闭</button>
      </header>

      <form @submit.prevent="save">
        <fieldset>
          <legend>行政班</legend>
          <label>
            年级
            <select v-model="grade">
              <option v-for="item in grades" :key="item.grade" :value="item.grade">{{ item.grade }}级</option>
            </select>
          </label>
          <label>
            专业
            <select v-model="majorCode">
              <option v-for="item in majors" :key="item.code" :value="item.code">{{ item.name }}</option>
            </select>
          </label>
          <label>
            班级
            <select v-model="groupId">
              <option v-for="item in groups" :key="item" :value="item">{{ item }}班</option>
            </select>
          </label>
        </fieldset>

        <fieldset v-if="isEnglishGrade">
          <legend>英语</legend>
          <label>
            班级
            <select v-model="englishClassNumber">
              <option v-for="classNumber in englishClasses" :key="classNumber" :value="classNumber">
                {{ classNumber }}班
              </option>
            </select>
          </label>
          <label class="checkbox-label">
            <input v-model="englishCatchupEnabled" type="checkbox">
            补课英语
          </label>
          <label v-if="englishCatchupEnabled">
            补课班级
            <select v-model="englishCatchupClassNumber">
              <option v-for="classNumber in catchupClasses" :key="classNumber" :value="classNumber">
                {{ classNumber }}班
              </option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>德语</legend>
          <label v-if="germanLevels.length > 1">
            等级
            <select v-model="germanLevel">
              <option v-for="item in germanLevels" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label>
            班级
            <select v-model="germanClassNumber">
              <option v-for="classNumber in germanClasses" :key="classNumber" :value="classNumber">
                {{ classNumber }}班
              </option>
            </select>
          </label>
        </fieldset>

        <label>
          主题
          <select :value="theme" @change="setTheme">
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>

        <button type="submit" :disabled="!canSave">保存</button>
        <button v-if="debug" type="button" @click="emit('reset')">清空数据并刷新</button>
      </form>
    </section>
  </div>
</template>
