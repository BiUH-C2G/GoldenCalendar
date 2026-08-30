import rawContract from '../data-contract.json'
import type {
  ContractFileKind,
  DataContract,
  GermanContractSection,
  GradeContract,
  MajorContract,
} from './Types'

export const dataContract = rawContract as DataContract

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
