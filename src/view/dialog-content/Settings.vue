<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { draftFromSelection, getSelectionBlocker, getSelectionOptions, resolveSelectionDraft, selectionFromDraft, updateSelectionDraft } from '@/SelectionState'
import type { SelectionDraft, SelectionField } from '@/SelectionState'
import type { ScheduleLayers } from '@/Schedule'
import type { Selection, ThemePreference } from '@/Types'

const props = defineProps<{ open: boolean, initialDraft: SelectionDraft | null, selection: Selection | null, theme: ThemePreference, debug: boolean, layers: ScheduleLayers }>()
const emit = defineEmits<{ save: [selection: Selection], cancel: [], reset: [], 'update:theme': [value: ThemePreference], 'update:layers': [value: ScheduleLayers] }>()
const draft = ref(draftFromSelection(props.selection))
const options = computed(() => getSelectionOptions(draft.value))
const blocker = computed(() => getSelectionBlocker(draft.value))

watch(() => props.open, (open) => {
  if (open) draft.value = resolveSelectionDraft(props.initialDraft ? { ...props.initialDraft } : draftFromSelection(props.selection))
}, { immediate: true })

function updateString(field: SelectionField, event: Event) {
  draft.value = updateSelectionDraft(draft.value, field, (event.target as HTMLSelectElement).value)
}

function updateBoolean(field: SelectionField, event: Event) {
  draft.value = updateSelectionDraft(draft.value, field, (event.target as HTMLInputElement).checked)
}

function save() {
  const selection = selectionFromDraft(draft.value)
  if (selection) emit('save', selection)
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
      <div class="settings-fields">
        <label v-if="options.grades.length > 1" class="field tone-green">年级<select :value="draft.grade" data-dialog-autofocus @change="updateString('grade', $event)"><option value="" disabled>请选择年级</option><option v-for="item in options.grades" :key="item" :value="item">{{ item }}级</option></select></label>
        <label v-if="draft.grade && options.majors.length > 1" class="field tone-blue">专业<select :value="draft.majorCode" @change="updateString('majorCode', $event)"><option value="" disabled>请选择专业</option><option v-for="item in options.majors" :key="item.code" :value="item.code">{{ item.name }}</option></select></label>
        <label v-if="draft.majorCode && options.groups.length > 1" class="field tone-violet">班级<select :value="draft.groupId" @change="updateString('groupId', $event)"><option value="" disabled>请选择班级</option><option v-for="item in options.groups" :key="item" :value="item">{{ item }}班</option></select></label>
      </div>
    </fieldset>

    <fieldset v-if="options.hasEnglish" class="settings-group">
      <legend>英语</legend>
      <p v-if="!draft.majorCode" class="settings-hint">请先选择专业，再选择英语班级</p>
      <div v-else class="settings-fields">
        <label v-if="options.englishClasses.length > 1" class="field tone-blue">班级<select :value="draft.englishClassNumber" @change="updateString('englishClassNumber', $event)"><option value="" disabled>请选择英语班级</option><option v-for="classNumber in options.englishClasses" :key="classNumber" :value="classNumber">{{ classNumber }}班</option></select></label>
        <label v-if="draft.englishClassNumber" class="field checkbox-field tone-warm"><span>要补课</span><input type="checkbox" :checked="draft.englishCatchupEnabled" @change="updateBoolean('englishCatchupEnabled', $event)"></label>
        <label v-if="draft.englishCatchupEnabled && options.catchupClasses.length > 1" class="field tone-green">补课班级<select :value="draft.englishCatchupClassNumber" @change="updateString('englishCatchupClassNumber', $event)"><option value="" disabled>请选择补课班级</option><option v-for="classNumber in options.catchupClasses" :key="classNumber" :value="classNumber">{{ classNumber }}班</option></select></label>
      </div>
    </fieldset>

    <fieldset v-if="options.hasGerman" class="settings-group">
      <legend>德语</legend>
      <div class="settings-fields">
        <label v-if="options.germanLevels.length > 1" class="field tone-violet">等级<select :value="draft.germanLevel" @change="updateString('germanLevel', $event)"><option value="" disabled>请选择德语等级</option><option v-for="item in options.germanLevels" :key="item" :value="item">{{ item }}</option></select></label>
        <label v-if="draft.germanLevel && options.germanClasses.length > 1" class="field tone-green">班级<select :value="draft.germanClassNumber" @change="updateString('germanClassNumber', $event)"><option value="" disabled>请选择德语班级</option><option v-for="classNumber in options.germanClasses" :key="classNumber" :value="classNumber">{{ classNumber }}班</option></select></label>
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
      <button class="primary-button" type="submit" :disabled="Boolean(blocker)">{{ blocker ?? '保存' }}</button>
    </div>
  </form>
</template>
