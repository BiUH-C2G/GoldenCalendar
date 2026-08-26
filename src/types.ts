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

export interface ScheduleSource {
  id: string
  file: string
  term: string
  grade: string
  major: string
  path: string
  groups: string[]
}

export interface ScheduleData {
  schemaVersion: number
  source: {
    term: string
    grade: string
    major: string
  }
  calendar: {
    startDate: string | null
    weekCount: number
    sessions: string[]
  }
  groups: ScheduleGroup[]
}

export interface Manifest {
  schemaVersion: number
  sources: ScheduleSource[]
}

export interface Selection {
  grade: string
  majorCode: string
  groupId: string
}
