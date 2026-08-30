<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { dataContract, getEnglishClassNumbers, getGermanSection, getGrade, getMajor } from '@/Contract'
import type { ScheduleLayers } from '@/Schedule'
import type { Selection, ThemePreference } from '@/Types'

const props = defineProps<{ open: boolean, selection: Selection | null, theme: ThemePreference, debug: boolean, layers: ScheduleLayers }>()
const emit = defineEmits<{ save: [selection: Selection], cancel: [], reset: [], 'update:theme': [value: ThemePreference], 'update:layers': [value: ScheduleLayers] }>()
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
const germanClasses = computed(() => germanSection.value?.levels.find((item) => item.level === germanLevel.value)?.classes ?? [])
const canSave = computed(() => Boolean(grade.value && majorCode.value && groupId.value && germanClassNumber.value && (!isEnglishGrade.value || englishClassNumber.value) && (!englishCatchupEnabled.value || englishCatchupClassNumber.value)))

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
}, { immediate: true })

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
  if (!englishClasses.value.includes(englishClassNumber.value)) englishClassNumber.value = englishClasses.value[0] ?? ''
}

function normalizeCatchupClass() {
  if (!englishCatchupEnabled.value) {
    englishCatchupClassNumber.value = ''
    return
  }
  if (!catchupClasses.value.includes(englishCatchupClassNumber.value)) englishCatchupClassNumber.value = catchupClasses.value[0] ?? ''
}

function normalizeGermanLevel() {
  if (!germanLevels.value.includes(germanLevel.value)) germanLevel.value = germanLevels.value[0] ?? ''
  normalizeGermanClass()
}

function normalizeGermanClass() {
  if (!germanClasses.value.includes(germanClassNumber.value)) germanClassNumber.value = germanClasses.value[0] ?? ''
}

function save() {
  if (!canSave.value) return
  emit('save', { term: dataContract.term, grade: grade.value, majorCode: majorCode.value, groupId: groupId.value, englishClassNumber: isEnglishGrade.value ? englishClassNumber.value : null, englishCatchupEnabled: isEnglishGrade.value && englishCatchupEnabled.value, englishCatchupClassNumber: isEnglishGrade.value && englishCatchupEnabled.value ? englishCatchupClassNumber.value : null, germanLevel: germanLevel.value, germanClassNumber: germanClassNumber.value })
}

function setTheme(value: ThemePreference) {
  emit('update:theme', value)
}

function setLayer(key: keyof ScheduleLayers, value: boolean) {
  emit('update:layers', { ...props.layers, [key]: value })
}
</script>

<template>
  <form class="settings-form" @submit.prevent="save">
    <fieldset class="settings-group">
      <legend>行政班</legend>
      <div class="settings-fields three-columns">
        <label class="field tone-green">年级<select v-model="grade" data-dialog-autofocus><option v-for="item in grades" :key="item.grade" :value="item.grade">{{ item.grade }}级</option></select></label>
        <label class="field tone-blue">专业<select v-model="majorCode"><option v-for="item in majors" :key="item.code" :value="item.code">{{ item.name }}</option></select></label>
        <label class="field tone-violet">班级<select v-model="groupId"><option v-for="item in groups" :key="item" :value="item">{{ item }}班</option></select></label>
      </div>
    </fieldset>

    <fieldset v-if="isEnglishGrade" class="settings-group">
      <legend>英语</legend>
      <div class="settings-fields two-columns">
        <label class="field tone-blue">班级<select v-model="englishClassNumber"><option v-for="classNumber in englishClasses" :key="classNumber" :value="classNumber">{{ classNumber }}班</option></select></label>
        <label class="field checkbox-field tone-warm"><span>补课英语</span><input v-model="englishCatchupEnabled" type="checkbox"></label>
        <label v-if="englishCatchupEnabled" class="field tone-green">补课班级<select v-model="englishCatchupClassNumber"><option v-for="classNumber in catchupClasses" :key="classNumber" :value="classNumber">{{ classNumber }}班</option></select></label>
      </div>
    </fieldset>

    <fieldset class="settings-group">
      <legend>德语</legend>
      <div class="settings-fields two-columns">
        <label v-if="germanLevels.length > 1" class="field tone-violet">等级<select v-model="germanLevel"><option v-for="item in germanLevels" :key="item" :value="item">{{ item }}</option></select></label>
        <label class="field tone-green">班级<select v-model="germanClassNumber"><option v-for="classNumber in germanClasses" :key="classNumber" :value="classNumber">{{ classNumber }}班</option></select></label>
      </div>
    </fieldset>

    <fieldset class="settings-group">
      <legend>外观</legend>
      <div class="theme-choice" role="group" aria-label="外观模式">
        <button v-for="item in [{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }] as const" :key="item.value" class="theme-option" type="button" :aria-pressed="theme === item.value" @click="setTheme(item.value)">{{ item.label }}</button>
      </div>
    </fieldset>

    <fieldset v-if="debug" class="settings-group">
      <legend>调试图层</legend>
      <div class="layer-choice">
        <label><input type="checkbox" :checked="layers.administrative" @change="setLayer('administrative', ($event.target as HTMLInputElement).checked)">行政班</label>
        <label><input type="checkbox" :checked="layers.english" @change="setLayer('english', ($event.target as HTMLInputElement).checked)">英语</label>
        <label><input type="checkbox" :checked="layers.englishCatchup" @change="setLayer('englishCatchup', ($event.target as HTMLInputElement).checked)">英语补课</label>
        <label><input type="checkbox" :checked="layers.german" @change="setLayer('german', ($event.target as HTMLInputElement).checked)">德语</label>
      </div>
      <button class="danger-button" type="button" @click="emit('reset')">清空数据并刷新</button>
    </fieldset>

    <div class="dialog-actions">
      <button v-if="selection" class="secondary-button" type="button" @click="emit('cancel')">取消</button>
      <button class="primary-button" type="submit" :disabled="!canSave">保存</button>
    </div>
  </form>
</template>
