export interface ScheduleEvent {
  date: string
  week: number
  weekday: number
  slot: number
  title: string
  teacher: string | null
  room: string | null
}

export interface ScheduleNotice {
  label: string
  startDate: string
  endDate: string
  startWeek: number
  endWeek: number
}

export interface ScheduleGroup {
  groupId: string
  events: ScheduleEvent[]
  notices: ScheduleNotice[]
}

export interface ScheduleData {
  source: {
    term: string
    grade: string
    majorCode: string
    major: string
  }
  calendar: {
    startDate: string | null
    weekCount: number
    sessions: string[]
  }
  group: ScheduleGroup
}

export interface LanguageMeeting {
  startWeek: number
  endWeek: number
  weekday: number
  slot: number
  teachers: string[]
  room: string
}

export interface LanguageClass {
  code: string
  meetings: LanguageMeeting[]
}

export interface SelectedLanguageClasses {
  english: LanguageClass | null
  englishCatchup: LanguageClass | null
  german: LanguageClass
}

export interface Selection {
  term: string
  grade: string
  majorCode: string
  groupId: string
  englishClassNumber: string | null
  englishCatchupEnabled: boolean
  englishCatchupClassNumber: string | null
  germanLevel: string
  germanClassNumber: string
}

export type ThemePreference = 'system' | 'light' | 'dark'

export type ContractFileKind = 'administrative' | 'english' | 'englishCatchup' | 'german'

export interface MajorContract {
  code: string
  name: string
  groups: string[]
}

export interface GradeContract {
  grade: string
  english: boolean
  germanSection: string
  majors: MajorContract[]
}

export interface GermanContractLevel {
  level: string
  classes: string[]
}

export interface GermanContractSection {
  section: string
  levels: GermanContractLevel[]
}

export interface DataContract {
  term: string
  files: Record<ContractFileKind, string>
  grades: GradeContract[]
  languages: {
    english: {
      section: string
      classes: Array<{
        numbers: string[]
        eligibleMajorCodes: string[]
      }>
      catchupClasses: string[]
    }
    german: GermanContractSection[]
  }
}
