import rawContract from '../data-contract.json'
import { expectArray, expectBoolean, expectRecord, expectString, expectStringArray } from './Validation'
import type { ContractFileKind, DataContract, GermanContractSection, GradeContract, MajorContract } from './Types'

export const dataContract = parseDataContract(rawContract)

export function getGrade(grade: string): GradeContract | undefined {
  return dataContract.grades.find((item) => item.grade === grade)
}

export function getMajor(grade: string, majorCode: string): MajorContract | undefined {
  return getGrade(grade)?.majors.find((item) => item.code === majorCode)
}

export function getGermanSection(grade: string): GermanContractSection | undefined {
  const section = getGrade(grade)?.germanSection
  return dataContract.languages.german.find((item) => item.section === section)
}

export function getEnglishClassNumbers(majorCode: string): string[] {
  return dataContract.languages.english.classes
    .filter((group) => group.eligibleMajorCodes.includes(majorCode))
    .flatMap((group) => group.numbers)
    .sort((left, right) => Number(left) - Number(right))
}

export function coordinateFile(
  kind: ContractFileKind,
  coordinates: Record<string, string>,
): string {
  const template = dataContract.files[kind]
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = coordinates[key]
    if (!value) throw new Error(`数据坐标缺少 ${key}`)
    return encodeURIComponent(value)
  })
}

function parseDataContract(value: unknown): DataContract {
  const root = expectRecord(value, '数据约定')
  const filesValue = expectRecord(root.files, '数据约定.files')

  const files = {
    administrative: expectString(filesValue.administrative, '数据约定.files.administrative'),
    english: expectString(filesValue.english, '数据约定.files.english'),
    englishCatchup: expectString(filesValue.englishCatchup, '数据约定.files.englishCatchup'),
    german: expectString(filesValue.german, '数据约定.files.german')
  }

  const grades = expectArray(root.grades, '数据约定.grades').map((item, gradeIndex) => {
    const grade = expectRecord(item, `数据约定.grades[${gradeIndex}]`)
    const majors = expectArray(grade.majors, `数据约定.grades[${gradeIndex}].majors`).map((majorItem, majorIndex) => {
      const major = expectRecord(majorItem, `数据约定.grades[${gradeIndex}].majors[${majorIndex}]`)
      return { code: expectString(major.code, `数据约定.grades[${gradeIndex}].majors[${majorIndex}].code`), name: expectString(major.name, `数据约定.grades[${gradeIndex}].majors[${majorIndex}].name`), groups: expectStringArray(major.groups, `数据约定.grades[${gradeIndex}].majors[${majorIndex}].groups`) }
    })
    return { grade: expectString(grade.grade, `数据约定.grades[${gradeIndex}].grade`), english: expectBoolean(grade.english, `数据约定.grades[${gradeIndex}].english`), germanSection: expectString(grade.germanSection, `数据约定.grades[${gradeIndex}].germanSection`), majors }
  })

  const languages = expectRecord(root.languages, '数据约定.languages')
  const englishValue = expectRecord(languages.english, '数据约定.languages.english')
  const english = {
    section: expectString(englishValue.section, '数据约定.languages.english.section'),
    classes: expectArray(englishValue.classes, '数据约定.languages.english.classes').map((item, index) => {
      const group = expectRecord(item, `数据约定.languages.english.classes[${index}]`)
      return { numbers: expectStringArray(group.numbers, `数据约定.languages.english.classes[${index}].numbers`), eligibleMajorCodes: expectStringArray(group.eligibleMajorCodes, `数据约定.languages.english.classes[${index}].eligibleMajorCodes`) }
    }),
    catchupClasses: expectStringArray(englishValue.catchupClasses, '数据约定.languages.english.catchupClasses')
  }

  const german = expectArray(languages.german, '数据约定.languages.german').map((item, sectionIndex) => {
    const section = expectRecord(item, `数据约定.languages.german[${sectionIndex}]`)
    const levels = expectArray(section.levels, `数据约定.languages.german[${sectionIndex}].levels`).map((levelItem, levelIndex) => {
      const level = expectRecord(levelItem, `数据约定.languages.german[${sectionIndex}].levels[${levelIndex}]`)
      return { level: expectString(level.level, `数据约定.languages.german[${sectionIndex}].levels[${levelIndex}].level`), classes: expectStringArray(level.classes, `数据约定.languages.german[${sectionIndex}].levels[${levelIndex}].classes`) }
    })
    return { section: expectString(section.section, `数据约定.languages.german[${sectionIndex}].section`), levels }
  })

  return { term: expectString(root.term, '数据约定.term'), files, grades, languages: { english, german } }
}
