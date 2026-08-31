<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { draftFromSelection, getSelectionBlocker, getSelectionOptions, resolveSelectionDraft, selectionFromDraft, updateSelectionDraft } from '@/SelectionState'
import type { SelectionDraft, SelectionField } from '@/SelectionState'
import type { Selection, ThemePreference } from '@/Types'

const props = defineProps<{ open: boolean, initialDraft: SelectionDraft | null, selection: Selection | null, theme: ThemePreference }>()
const emit = defineEmits<{ save: [selection: Selection], cancel: [], 'update:theme': [value: ThemePreference] }>()
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
      <div class="theme-choice" :data-active="theme" role="group" aria-label="外观模式">
        <button v-for="item in [{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }] as const" :key="item.value" class="theme-option" type="button" :aria-pressed="theme === item.value" @click="setTheme(item.value)">{{ item.label }}</button>
      </div>
    </fieldset>

    <div class="dialog-actions">
      <button v-if="selection" class="secondary-button" type="button" @click="emit('cancel')">取消</button>
      <button class="primary-button" type="submit" :disabled="Boolean(blocker)">{{ blocker ?? '保存' }}</button>
    </div>
  </form>
</template>

<style scoped>
.settings-form {
  display: grid;
  gap: 24px;
  margin-top: 18px;
}

.settings-group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.settings-group legend {
  margin-bottom: 13px;
  padding: 0 2px;
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: .035em;
}

.settings-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.settings-hint {
  margin: 0;
  padding: 12px 13px;
  border-radius: 15px;
  color: var(--text-muted);
  background: var(--surface-subtle);
  font-size: 12px;
  line-height: 1.6;
}

.field {
  min-width: 0;
  display: grid;
  gap: 7px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 560;
  letter-spacing: .025em;
}

.field select {
  width: 100%;
  min-width: 0;
  padding: 12px 13px;
  border: 0;
  border-radius: 15px;
  outline: 0;
  color: var(--text-strong);
  background: var(--block-blue);
}

.field.tone-green select, .field.tone-green.checkbox-field {
  background: var(--block-green);
}

.field.tone-blue select, .field.tone-blue.checkbox-field {
  background: var(--block-blue);
}

.field.tone-violet select, .field.tone-violet.checkbox-field {
  background: var(--block-violet);
}

.field.tone-warm select, .field.tone-warm.checkbox-field {
  background: var(--block-warm);
}

.checkbox-field {
  min-height: 43px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  align-self: auto;
  padding: 0 13px;
  border-radius: 15px;
  color: var(--text-strong);
}

.checkbox-field input {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
}

.theme-choice {
  --theme-choice-index: 0;
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  isolation: isolate;
  overflow: hidden;
  padding: 4px;
  border-radius: 16px;
  background: var(--surface-subtle);
}

.theme-choice[data-active="light"] {
  --theme-choice-index: 1;
}

.theme-choice[data-active="dark"] {
  --theme-choice-index: 2;
}

.theme-choice::before {
  content: "";
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  z-index: 0;
  width: calc((100% - 16px) / 3);
  border-radius: 12px;
  background: var(--fiddler-bg);
  box-shadow: var(--shadow-1);
  transform: translateX(calc(var(--theme-choice-index) * (100% + 4px)));
  transition: transform 430ms cubic-bezier(.22, 1.55, .36, 1), background-color .3s ease, box-shadow .3s ease;
}

.theme-option {
  position: relative;
  z-index: 1;
  min-height: 39px;
  border: 0;
  border-radius: 12px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  transition: color .3s ease, transform var(--duration-fast) var(--ease-standard);
}

.theme-option[aria-pressed="true"] {
  color: var(--fiddler-fg);
}

.theme-option:active {
  transform: scale(.97);
}
</style>
