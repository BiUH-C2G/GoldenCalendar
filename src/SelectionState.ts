import { dataContract, getEnglishClassNumbers, getGermanSection, getGrade, getMajor } from './Contract'
import type { Selection } from './Types'

export interface SelectionDraft {
  term: string
  grade: string
  majorCode: string
  groupId: string
  englishClassNumber: string
  englishCatchupEnabled: boolean
  englishCatchupClassNumber: string
  germanLevel: string
  germanClassNumber: string
}

export type SelectionField = 'grade' | 'majorCode' | 'groupId' | 'englishClassNumber' | 'englishCatchupEnabled' | 'englishCatchupClassNumber' | 'germanLevel' | 'germanClassNumber'

export interface SelectionOptions {
  grades: string[]
  majors: Array<{ code: string, name: string }>
  groups: string[]
  englishClasses: string[]
  catchupClasses: string[]
  germanLevels: string[]
  germanClasses: string[]
  hasEnglish: boolean
  hasGerman: boolean
}

const EMPTY_DRAFT: SelectionDraft = {
  term: dataContract.term,
  grade: '',
  majorCode: '',
  groupId: '',
  englishClassNumber: '',
  englishCatchupEnabled: false,
  englishCatchupClassNumber: '',
  germanLevel: '',
  germanClassNumber: ''
}

export function createEmptySelectionDraft(): SelectionDraft {
  return resolveSelectionDraft({ ...EMPTY_DRAFT })
}

export function readSelectionDraft(value: unknown): SelectionDraft | null {
  if (!isRecord(value)) return null
  if (typeof value.term === 'string' && value.term && value.term !== dataContract.term) return createEmptySelectionDraft()

  return resolveSelectionDraft({
    term: dataContract.term,
    grade: stringValue(value.grade),
    majorCode: stringValue(value.majorCode),
    groupId: stringValue(value.groupId),
    englishClassNumber: stringValue(value.englishClassNumber),
    englishCatchupEnabled: value.englishCatchupEnabled === true,
    englishCatchupClassNumber: stringValue(value.englishCatchupClassNumber),
    germanLevel: stringValue(value.germanLevel),
    germanClassNumber: stringValue(value.germanClassNumber)
  })
}

export function draftFromSelection(selection: Selection | null): SelectionDraft {
  return selection ? resolveSelectionDraft({ ...selection, englishClassNumber: selection.englishClassNumber ?? '', englishCatchupClassNumber: selection.englishCatchupClassNumber ?? '' }) : createEmptySelectionDraft()
}

export function getSelectionOptions(draft: SelectionDraft): SelectionOptions {
  const grade = getGrade(draft.grade)
  const major = getMajor(draft.grade, draft.majorCode)
  const germanSection = getGermanSection(draft.grade)
  const germanLevel = germanSection?.levels.find((item) => item.level === draft.germanLevel)

  return {
    grades: dataContract.grades.map((item) => item.grade),
    majors: grade?.majors.map((item) => ({ code: item.code, name: item.name })) ?? [],
    groups: major?.groups ?? [],
    englishClasses: grade?.english && major ? getEnglishClassNumbers(draft.majorCode) : [],
    catchupClasses: dataContract.languages.english.catchupClasses,
    germanLevels: germanSection?.levels.map((item) => item.level) ?? [],
    germanClasses: germanLevel?.classes ?? [],
    hasEnglish: Boolean(grade?.english),
    hasGerman: Boolean(germanSection)
  }
}

export function resolveSelectionDraft(input: SelectionDraft): SelectionDraft {
  const draft = { ...input, term: dataContract.term }
  const gradeOptions = dataContract.grades.map((item) => item.grade)
  const originalGrade = draft.grade
  draft.grade = resolveValue(draft.grade, gradeOptions)
  if (originalGrade && originalGrade !== draft.grade) clearAfterGrade(draft)

  const grade = getGrade(draft.grade)
  if (!grade) return clearAfterGrade(draft)
  const originalMajorCode = draft.majorCode
  draft.majorCode = resolveValue(draft.majorCode, grade.majors.map((item) => item.code))
  if (originalMajorCode && originalMajorCode !== draft.majorCode) {
    draft.groupId = ''
    clearEnglish(draft)
  }

  const major = getMajor(draft.grade, draft.majorCode)
  draft.groupId = resolveValue(draft.groupId, major?.groups ?? [])

  if (grade.english && major) {
    const originalEnglishClassNumber = draft.englishClassNumber
    draft.englishClassNumber = resolveValue(draft.englishClassNumber, getEnglishClassNumbers(draft.majorCode))
    if (originalEnglishClassNumber && originalEnglishClassNumber !== draft.englishClassNumber) {
      draft.englishCatchupEnabled = false
      draft.englishCatchupClassNumber = ''
    }
    if (!draft.englishClassNumber) draft.englishCatchupEnabled = false
    draft.englishCatchupClassNumber = draft.englishCatchupEnabled ? resolveValue(draft.englishCatchupClassNumber, dataContract.languages.english.catchupClasses) : ''
  } else clearEnglish(draft)

  const germanSection = getGermanSection(draft.grade)
  const originalGermanLevel = draft.germanLevel
  draft.germanLevel = resolveValue(draft.germanLevel, germanSection?.levels.map((item) => item.level) ?? [])
  if (originalGermanLevel && originalGermanLevel !== draft.germanLevel) draft.germanClassNumber = ''
  const germanClasses = germanSection?.levels.find((item) => item.level === draft.germanLevel)?.classes ?? []
  draft.germanClassNumber = resolveValue(draft.germanClassNumber, germanClasses)
  return draft
}

export function updateSelectionDraft(input: SelectionDraft, field: SelectionField, value: string | boolean): SelectionDraft {
  const draft = { ...input, [field]: value }

  if (field === 'grade') {
    draft.majorCode = ''
    draft.groupId = ''
    clearEnglish(draft)
    draft.germanLevel = ''
    draft.germanClassNumber = ''
  }

  if (field === 'majorCode') {
    draft.groupId = ''
    clearEnglish(draft)
  }

  if (field === 'englishClassNumber') {
    draft.englishCatchupEnabled = false
    draft.englishCatchupClassNumber = ''
  }

  if (field === 'englishCatchupEnabled') draft.englishCatchupClassNumber = ''
  if (field === 'germanLevel') draft.germanClassNumber = ''
  return resolveSelectionDraft(draft)
}

export function getSelectionBlocker(input: SelectionDraft): string | null {
  const draft = resolveSelectionDraft(input)
  const options = getSelectionOptions(draft)
  if (!draft.grade) return '请选择年级'
  if (!draft.majorCode) return '请选择专业'
  if (!draft.groupId) return '请选择行政班级'
  if (options.hasEnglish && !draft.englishClassNumber) return '请选择英语班级'
  if (draft.englishCatchupEnabled && !draft.englishCatchupClassNumber) return '请选择补课班级'
  if (options.hasGerman && !draft.germanLevel) return '请选择德语等级'
  if (options.hasGerman && !draft.germanClassNumber) return '请选择德语班级'
  return null
}

export function selectionFromDraft(input: SelectionDraft): Selection | null {
  const draft = resolveSelectionDraft(input)
  if (getSelectionBlocker(draft)) return null
  const grade = getGrade(draft.grade)
  if (!grade) return null

  return {
    term: dataContract.term,
    grade: draft.grade,
    majorCode: draft.majorCode,
    groupId: draft.groupId,
    englishClassNumber: grade.english ? draft.englishClassNumber : null,
    englishCatchupEnabled: grade.english && draft.englishCatchupEnabled,
    englishCatchupClassNumber: grade.english && draft.englishCatchupEnabled ? draft.englishCatchupClassNumber : null,
    germanLevel: draft.germanLevel,
    germanClassNumber: draft.germanClassNumber
  }
}

function resolveValue(value: string, options: string[]) {
  if (options.includes(value)) return value
  return options.length === 1 ? options[0] : ''
}

function clearAfterGrade(draft: SelectionDraft) {
  draft.majorCode = ''
  draft.groupId = ''
  clearEnglish(draft)
  draft.germanLevel = ''
  draft.germanClassNumber = ''
  return draft
}

function clearEnglish(draft: SelectionDraft) {
  draft.englishClassNumber = ''
  draft.englishCatchupEnabled = false
  draft.englishCatchupClassNumber = ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}
