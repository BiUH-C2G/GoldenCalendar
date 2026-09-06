<script setup lang="ts">
import {computed, onBeforeUnmount, ref, useId, watch} from 'vue'
import {loadSelection} from '@/Data'
import type {LoadedSchedule} from '@/Data'
import {composeScheduleLayers} from '@/Schedule'
import {findCourseConflicts} from '@/Conflicts'
import {clearConfirmedConflicts, hashConflicts, isConflictConfirmed} from '@/ConflictCache'
import type {ConflictConfirmation} from '@/ConflictCache'
import Dialog from '@/view/Dialog.vue'
import CourseConflicts from '@/view/dialog-content/CourseConflicts.vue'
import type {CourseConflict} from '@/Conflicts'
import {draftFromSelection, getSelectionBlocker, getSelectionOptions, resolveSelectionDraft, selectionFromDraft, updateSelectionDraft} from '@/SelectionState'
import type {SelectionDraft, SelectionField} from '@/SelectionState'
import type {Selection, ThemePreference} from '@/Types'

const props = defineProps<{ open: boolean, initialDraft: SelectionDraft | null, selection: Selection | null, theme: ThemePreference }>()
const emit = defineEmits<{ save: [selection: Selection, loaded: LoadedSchedule, confirmation: ConflictConfirmation], cancel: [], 'update:theme': [value: ThemePreference] }>()
const draft = ref(draftFromSelection(props.selection))
const formId = useId()
const options = computed(() => getSelectionOptions(draft.value))
const blocker = computed(() => getSelectionBlocker(draft.value))
const courseSettingsChanged = computed(() => !props.selection || JSON.stringify(selectionFromDraft(draft.value)) !== JSON.stringify(selectionFromDraft(draftFromSelection(props.selection))))
const checking = ref(false)
const saveError = ref('')
const conflicts = ref<CourseConflict[]>([])
let pending: { selection: Selection, loaded: LoadedSchedule, confirmation: ConflictConfirmation } | null = null
let controller: AbortController | null = null

function invalidateCheck() {
  controller?.abort()
  controller = null
  checking.value = false
  pending = null
  conflicts.value = []
  saveError.value = ''
}

onBeforeUnmount(invalidateCheck)

watch(() => props.open, (open) => {
  invalidateCheck()
  if (open) draft.value = resolveSelectionDraft(props.initialDraft ? {...props.initialDraft} : draftFromSelection(props.selection))
}, {immediate: true})

function updateString(field: SelectionField, event: Event) {
  invalidateCheck()
  draft.value = updateSelectionDraft(draft.value, field, (event.target as HTMLSelectElement).value)
}

function updateBoolean(field: SelectionField, event: Event) {
  invalidateCheck()
  draft.value = updateSelectionDraft(draft.value, field, (event.target as HTMLInputElement).checked)
}

async function save() {
  if (checking.value || conflicts.value.length || !courseSettingsChanged.value) return

  const selection = selectionFromDraft(draft.value)
  if (!selection) return

  invalidateCheck()
  const request = new AbortController()
  controller = request
  checking.value = true

  try {
    const loaded = await loadSelection(selection, request.signal)
    if (request.signal.aborted) return

    const group = composeScheduleLayers(loaded.schedule, loaded.schedule.group, loaded.languages, undefined, loaded.physicalEducation ?? undefined)
    const detectedConflicts = findCourseConflicts(group.events)
    const hash = await hashConflicts(selection.term, group.events, detectedConflicts)
    if (request.signal.aborted) return

    pending = {selection, loaded, confirmation: {hasConflicts: Boolean(detectedConflicts.length), hash}}
    const noConflicts = !detectedConflicts.length
    if (noConflicts) clearConfirmedConflicts()

    if (noConflicts || isConflictConfirmed(hash)) confirmSave()
    else conflicts.value = detectedConflicts
  } catch (cause) {
    if (!request.signal.aborted) saveError.value = cause instanceof Error ? cause.message : '课程数据加载失败，请重试'
  } finally {
    if (controller === request) checking.value = false
  }
}

function confirmSave() {
  if (!pending) return
  emit('save', pending.selection, pending.loaded, pending.confirmation)
}

function setTheme(value: ThemePreference) {
  emit('update:theme', value)
}

</script>

<template>
  <Dialog :open="open" title="设置" :closable="Boolean(selection)" @update:open="emit('cancel')">
    <form :id="formId" class="settings-form" @submit.prevent="save">
      <fieldset class="settings-group">
        <legend class="dialog-group-title">行政班</legend>
        <div class="settings-fields">
          <label v-if="options.grades.length > 1" class="field tone-green">年级<select :value="draft.grade" data-dialog-autofocus @change="updateString('grade', $event)">
            <option value="" disabled>请选择年级</option>
            <option v-for="item in options.grades" :key="item" :value="item">{{ item }}级</option>
          </select></label>
          <label v-if="draft.grade && options.majors.length > 1" class="field tone-blue">专业<select :value="draft.majorCode" @change="updateString('majorCode', $event)">
            <option value="" disabled>请选择专业</option>
            <option v-for="item in options.majors" :key="item.code" :value="item.code">{{ item.name }}</option>
          </select></label>
          <label v-if="draft.majorCode && options.groups.length > 1" class="field tone-violet">班级<select :value="draft.groupId" @change="updateString('groupId', $event)">
            <option value="" disabled>请选择班级</option>
            <option v-for="item in options.groups" :key="item" :value="item">{{ item }}班</option>
          </select></label>
        </div>
      </fieldset>

      <fieldset v-if="options.physicalEducationGroups.length" class="settings-group">
        <legend class="dialog-group-title">体育</legend>
        <div class="settings-fields">
          <label class="field tone-green">分组<select :value="draft.physicalEducationGroupId" @change="updateString('physicalEducationGroupId', $event)">
            <option value="" disabled>请选择体育分组</option>
            <option v-for="item in options.physicalEducationGroups" :key="item" :value="item">第 {{ item }} 组</option>
          </select></label>
        </div>
      </fieldset>

      <fieldset v-if="options.hasEnglish" class="settings-group">
        <legend class="dialog-group-title">英语</legend>
        <p v-if="!draft.majorCode" class="settings-hint">请先选择专业，再选择英语班级</p>
        <div v-else class="settings-fields">
          <label v-if="options.englishClasses.length > 1" class="field tone-blue">班级<select :value="draft.englishClassNumber" @change="updateString('englishClassNumber', $event)">
            <option value="" disabled>请选择英语班级</option>
            <option v-for="classNumber in options.englishClasses" :key="classNumber" :value="classNumber">{{ classNumber }}班</option>
          </select></label>
          <label v-if="draft.englishClassNumber" class="field checkbox-field tone-warm"><span>要补课</span><input type="checkbox" :checked="draft.englishCatchupEnabled" @change="updateBoolean('englishCatchupEnabled', $event)"></label>
          <label v-if="draft.englishCatchupEnabled && options.catchupClasses.length > 1" class="field tone-green">补课班级<select :value="draft.englishCatchupClassNumber" @change="updateString('englishCatchupClassNumber', $event)">
            <option value="" disabled>请选择补课班级</option>
            <option v-for="classNumber in options.catchupClasses" :key="classNumber" :value="classNumber">{{ classNumber }}班</option>
          </select></label>
        </div>
      </fieldset>

      <fieldset v-if="options.hasGerman" class="settings-group">
        <legend class="dialog-group-title">德语</legend>
        <div class="settings-fields">
          <label v-if="options.germanLevels.length > 1" class="field tone-violet">等级<select :value="draft.germanLevel" @change="updateString('germanLevel', $event)">
            <option value="" disabled>请选择德语等级</option>
            <option v-for="item in options.germanLevels" :key="item" :value="item">{{ item }}</option>
          </select></label>
          <label v-if="draft.germanLevel && options.germanClasses.length > 1" class="field tone-green">班级<select :value="draft.germanClassNumber" @change="updateString('germanClassNumber', $event)">
            <option value="" disabled>请选择德语班级</option>
            <option v-for="classNumber in options.germanClasses" :key="classNumber" :value="classNumber">{{ classNumber }}班</option>
          </select></label>
        </div>
      </fieldset>

      <fieldset class="settings-group">
        <legend class="dialog-group-title">外观</legend>
        <div class="theme-choice" :data-active="theme" role="group" aria-label="外观模式">
          <button v-for="item in [{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }] as const" :key="item.value" class="theme-option" type="button" :aria-pressed="theme === item.value" @click="setTheme(item.value)">{{ item.label }}</button>
        </div>
      </fieldset>

      <p v-if="saveError" role="alert">{{ saveError }}</p>
    </form>
    <template v-if="courseSettingsChanged" #actions>
      <button class="primary-button" type="submit" :form="formId" :disabled="checking || Boolean(blocker)">{{ checking ? '正在检查课程冲突' : blocker ?? '保存' }}</button>
    </template>
  </Dialog>
  <Dialog :open="open && Boolean(conflicts.length)" title="存在课程冲突！" @update:open="invalidateCheck">
    <CourseConflicts :conflicts="conflicts" :sessions="pending?.loaded.schedule.calendar.sessions ?? []"/>
    <template #actions><button class="primary-button" type="button" data-dialog-autofocus @click="invalidateCheck">返回修改</button><button class="secondary-button conflict-confirm" type="button" @click="confirmSave">坚持保存</button></template>
  </Dialog>
</template>

<style scoped>
.conflict-confirm { color: var(--danger) }
.conflict-confirm:hover { background: color-mix(in srgb, var(--danger) 12%, var(--surface-solid)) }
.settings-form {
  display: grid;
  gap: 24px;
}

.settings-group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
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
