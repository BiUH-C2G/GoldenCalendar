import type {
  LanguageClass,
  ScheduleData,
  ScheduleEvent,
  ScheduleGroup,
  ScheduleNotice,
  SelectedLanguageClasses,
} from './Types'
import { addIsoDateDays, formatMonthDay, getShanghaiToday, isoDateToDayNumber } from './DateTime'

export const WEEKDAYS = [
  { value: 1, label: '周一', short: '一' },
  { value: 2, label: '周二', short: '二' },
  { value: 3, label: '周三', short: '三' },
  { value: 4, label: '周四', short: '四' },
  { value: 5, label: '周五', short: '五' },
  { value: 6, label: '周六', short: '六' },
  { value: 7, label: '周日', short: '日' },
] as const

export function formatDate(value: string): string {
  return formatMonthDay(value)
}

export function getWeekStart(data: ScheduleData, week: number): string | null {
  if (!data.calendar.startDate) return null
  return addIsoDateDays(data.calendar.startDate, (week - 1) * 7)
}

export function getCurrentWeek(data: ScheduleData, today = getShanghaiToday()): number {
  if (!data.calendar.startDate || !data.calendar.weekCount) return 1
  const dayOffset = isoDateToDayNumber(today) - isoDateToDayNumber(data.calendar.startDate)
  return Math.min(data.calendar.weekCount, Math.max(1, Math.floor(dayOffset / 7) + 1))
}

export function getWeekDates(data: ScheduleData, week: number): string[] {
  const start = getWeekStart(data, week)
  if (!start) return []
  return Array.from({ length: 7 }, (_, index) => addIsoDateDays(start, index))
}

export function getEvents(group: ScheduleGroup, week: number): ScheduleEvent[] {
  return group.events.filter((event) => event.week === week)
}

export function getVisibleWeekdays(group: ScheduleGroup, week: number) {
  const events = getEvents(group, week)
  const hasWeekend = events.some((event) => event.weekday > 5)
  return WEEKDAYS.filter((day) => day.value <= 5 || hasWeekend)
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

const LANGUAGE_PLACEHOLDERS = new Set(['English', 'English Catchup', 'German'])

export interface ScheduleLayers {
  administrative: boolean
  english: boolean
  englishCatchup: boolean
  german: boolean
}

export const DEFAULT_SCHEDULE_LAYERS: ScheduleLayers = {
  administrative: true,
  english: true,
  englishCatchup: true,
  german: true,
}

function activeDates(group: ScheduleGroup, title: string) {
  return new Set(group.events.filter((event) => event.title === title).map((event) => event.date))
}

function languageEvents(
  data: ScheduleData,
  course: LanguageClass | undefined,
  enabledDates: Set<string>,
): ScheduleEvent[] {
  if (!course) return []
  const events: ScheduleEvent[] = []
  for (const meeting of course.meetings) {
    for (let week = meeting.startWeek; week <= meeting.endWeek; week += 1) {
      const date = getWeekDates(data, week)[meeting.weekday - 1]
      if (!date || !enabledDates.has(date)) continue
      events.push({
        date,
        week,
        weekday: meeting.weekday,
        slot: meeting.slot,
        title: course.code,
        teacher: meeting.teachers.join(', ') || null,
        room: meeting.room || null,
        source: 'language',
      })
    }
  }
  return events
}

export function composeScheduleLayers(
  data: ScheduleData,
  group: ScheduleGroup,
  languages: SelectedLanguageClasses,
  layers: ScheduleLayers = DEFAULT_SCHEDULE_LAYERS,
): ScheduleGroup {
  const englishDates = activeDates(group, 'English')
  const catchupDates = activeDates(group, 'English Catchup')
  const germanDates = activeDates(group, 'German')
  const patchedPlaceholder = {
    English: layers.english,
    'English Catchup': layers.englishCatchup,
    German: layers.german,
  } as const
  const baseEvents = layers.administrative
    ? group.events.filter((event) => (
        !LANGUAGE_PLACEHOLDERS.has(event.title)
        || !patchedPlaceholder[event.title as keyof typeof patchedPlaceholder]
      ))
    : []
  const patchedEvents = [
    ...baseEvents,
    ...(layers.english
      ? languageEvents(data, languages.english ?? undefined, englishDates)
      : []),
    ...(layers.german
      ? languageEvents(data, languages.german, germanDates)
      : []),
    ...(layers.englishCatchup
      ? languageEvents(data, languages.englishCatchup ?? undefined, catchupDates)
      : []),
  ]
  const uniqueEvents = new Map<string, ScheduleEvent>()
  for (const event of patchedEvents) {
    const key = [event.date, event.slot, event.title, event.teacher ?? '', event.room ?? ''].join('|')
    uniqueEvents.set(key, event)
  }
  return {
    ...group,
    events: [...uniqueEvents.values()].sort((left, right) => (
      left.date.localeCompare(right.date)
      || left.slot - right.slot
      || left.title.localeCompare(right.title)
    )),
  }
}
