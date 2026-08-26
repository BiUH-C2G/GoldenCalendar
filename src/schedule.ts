import type { ScheduleData, ScheduleEvent, ScheduleGroup, ScheduleNotice } from './types'

export const WEEKDAYS = [
  { value: 1, label: '周一', short: '一' },
  { value: 2, label: '周二', short: '二' },
  { value: 3, label: '周三', short: '三' },
  { value: 4, label: '周四', short: '四' },
  { value: 5, label: '周五', short: '五' },
  { value: 6, label: '周六', short: '六' },
  { value: 7, label: '周日', short: '日' },
] as const

export const DEFAULT_SESSION_TIMES = [
  '8:30',
  '10:15',
  '14:30',
  '16:15',
  '18:30',
  '20:15',
]

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDate(value: string): string {
  const date = parseLocalDate(value)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function getWeekStart(data: ScheduleData, week: number): string | null {
  if (!data.calendar.startDate) return null
  const date = parseLocalDate(data.calendar.startDate)
  date.setDate(date.getDate() + (week - 1) * 7)
  return toLocalIsoDate(date)
}

export function getCurrentWeek(data: ScheduleData): number {
  if (!data.calendar.startDate || !data.calendar.weekCount) return 1
  const start = parseLocalDate(data.calendar.startDate)
  const today = new Date()
  const dayOffset = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - start.getTime()) /
      86_400_000,
  )
  return Math.min(data.calendar.weekCount, Math.max(1, Math.floor(dayOffset / 7) + 1))
}

export function getWeekDates(data: ScheduleData, week: number): string[] {
  const start = getWeekStart(data, week)
  if (!start) return []
  const date = parseLocalDate(start)
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(date)
    current.setDate(date.getDate() + index)
    return toLocalIsoDate(current)
  })
}

export function getEvents(group: ScheduleGroup, week: number): ScheduleEvent[] {
  return group.events.filter((event) => event.week === week)
}

export function getVisibleWeekdays(group: ScheduleGroup, week: number) {
  const events = getEvents(group, week)
  const hasWeekend = events.some((event) => event.weekday > 5)
  return WEEKDAYS.filter((day) => day.value <= 5 || hasWeekend)
}

export function getCourseHue(title: string): number {
  let hash = 0
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) | 0
  }
  const palette = [190, 215, 240, 265, 285, 315, 345, 12, 35, 55, 80, 110, 140, 165]
  return palette[Math.abs(hash) % palette.length]
}

export function getTodayWeekday(): number {
  const day = new Date().getDay()
  return day === 0 ? 7 : day
}

export function getNoticeForWeek(group: ScheduleGroup, week: number) {
  return group.notices.filter((notice) => notice.startWeek <= week && notice.endWeek >= week)
}

export function isHolidayNotice(notice: ScheduleNotice) {
  return notice.label === '假期' || /^holiday$/i.test(notice.label)
}

export function isHolidayDate(group: ScheduleGroup, date: string) {
  return group.notices.some(
    (notice) => isHolidayNotice(notice) && notice.startDate <= date && notice.endDate >= date,
  )
}

export function isExamWeek(group: ScheduleGroup, week: number) {
  return getNoticeForWeek(group, week).some(
    (notice) => notice.label === '考试周' || /exam weeks?/i.test(notice.label),
  )
}
