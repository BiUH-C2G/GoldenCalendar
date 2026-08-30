import { coordinateFile, dataContract, getGrade } from './Contract'
import { addIsoDateDays, isoDateToDayNumber, parseIsoDate } from './DateTime'
import { expectArray, expectIntegerRange, expectNullableString, expectRecord, expectString, expectStringArray } from './Validation'
import type { LanguageClass, ScheduleData, ScheduleEvent, ScheduleNotice, SelectedLanguageClasses, Selection } from './Types'

const DATA_ROOT = `${import.meta.env.BASE_URL}data/${dataContract.term}/`

interface AdministrativePayload {
  calendar: ScheduleData['calendar']
  events: ScheduleEvent[]
  notices: ScheduleNotice[]
}

async function loadCoordinate<T>(file: string, label: string, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${DATA_ROOT}${file}`, { signal })
  if (!response.ok) throw new Error(`${label}加载失败（${response.status}）`)
  try {
    return parse(await response.json())
  } catch (cause) {
    if (cause instanceof Error) throw new Error(`${label}数据无效：${cause.message}`)
    throw new Error(`${label}数据无效`)
  }
}

export async function loadAdministrativeSchedule(selection: Selection, signal?: AbortSignal): Promise<ScheduleData> {
  const major = getGrade(selection.grade)?.majors.find((item) => item.code === selection.majorCode)
  if (!major) throw new Error('行政班坐标无效')
  const payload = await loadCoordinate(coordinateFile('administrative', { grade: selection.grade, majorCode: selection.majorCode, groupId: selection.groupId }), '行政班课程表', parseAdministrativePayload, signal)
  return { source: { term: dataContract.term, grade: selection.grade, majorCode: selection.majorCode, major: major.name }, calendar: payload.calendar, group: { groupId: selection.groupId, events: payload.events, notices: payload.notices } }
}

export async function loadSelectedLanguages(selection: Selection, signal?: AbortSignal): Promise<SelectedLanguageClasses> {
  const grade = getGrade(selection.grade)
  if (!grade) throw new Error('年级坐标无效')
  const germanPromise = loadCoordinate(coordinateFile('german', { section: grade.germanSection, level: selection.germanLevel, classNumber: selection.germanClassNumber }), '德语课程表', parseLanguageClass, signal)
  const englishPromise = selection.englishClassNumber ? loadCoordinate(coordinateFile('english', { classNumber: selection.englishClassNumber }), '英语课程表', parseLanguageClass, signal) : Promise.resolve(null)
  const catchupPromise = selection.englishCatchupEnabled && selection.englishCatchupClassNumber ? loadCoordinate(coordinateFile('englishCatchup', { classNumber: selection.englishCatchupClassNumber }), '英语补课课程表', parseLanguageClass, signal) : Promise.resolve(null)
  const [english, englishCatchup, german] = await Promise.all([englishPromise, catchupPromise, germanPromise])
  return { english, englishCatchup, german }
}

function parseAdministrativePayload(value: unknown): AdministrativePayload {
  const root = expectRecord(value, '行政班课程表')
  const calendarValue = expectRecord(root.calendar, '行政班课程表.calendar')
  const startDate = expectNullableString(calendarValue.startDate, '行政班课程表.calendar.startDate')
  if (startDate) parseIsoDate(startDate)
  const sessions = expectStringArray(calendarValue.sessions, '行政班课程表.calendar.sessions')
  sessions.forEach((session, index) => {
    if (!/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(session)) throw new Error(`行政班课程表.calendar.sessions[${index}] 格式无效`)
  })
  const calendar = { startDate, weekCount: expectIntegerRange(calendarValue.weekCount, '行政班课程表.calendar.weekCount', 1, 60), sessions }
  const events = expectArray(root.events, '行政班课程表.events').map(parseScheduleEvent)
  const notices = expectArray(root.notices, '行政班课程表.notices').map(parseScheduleNotice)
  validateAdministrativeRelations(calendar, events, notices)
  return { calendar, events, notices }
}

function validateAdministrativeRelations(calendar: ScheduleData['calendar'], events: ScheduleEvent[], notices: ScheduleNotice[]) {
  events.forEach((event, index) => {
    if (event.week > calendar.weekCount) throw new Error(`行政班课程表.events[${index}].week 超出学期周数`)
    if (event.slot > calendar.sessions.length) throw new Error(`行政班课程表.events[${index}].slot 超出节次数量`)
    if (!calendar.startDate) return
    const expectedDate = addIsoDateDays(calendar.startDate, (event.week - 1) * 7 + event.weekday - 1)
    if (event.date !== expectedDate) throw new Error(`行政班课程表.events[${index}] 的日期、周次与星期不一致`)
  })

  notices.forEach((notice, index) => {
    if (notice.startWeek > notice.endWeek || notice.endWeek > calendar.weekCount) throw new Error(`行政班课程表.notices[${index}] 的周次范围无效`)
    if (isoDateToDayNumber(notice.startDate) > isoDateToDayNumber(notice.endDate)) throw new Error(`行政班课程表.notices[${index}] 的日期范围无效`)
  })
}

function parseScheduleEvent(value: unknown, index: number): ScheduleEvent {
  const event = expectRecord(value, `行政班课程表.events[${index}]`)
  const date = expectString(event.date, `行政班课程表.events[${index}].date`)

  parseIsoDate(date)

  return { date, week: expectIntegerRange(event.week, `行政班课程表.events[${index}].week`, 1, 60), weekday: expectIntegerRange(event.weekday, `行政班课程表.events[${index}].weekday`, 1, 7), slot: expectIntegerRange(event.slot, `行政班课程表.events[${index}].slot`, 1, 20), title: expectString(event.title, `行政班课程表.events[${index}].title`), teacher: expectNullableString(event.teacher, `行政班课程表.events[${index}].teacher`), room: expectNullableString(event.room, `行政班课程表.events[${index}].room`), source: 'administrative' }
}

function parseScheduleNotice(value: unknown, index: number): ScheduleNotice {
  const notice = expectRecord(value, `行政班课程表.notices[${index}]`)
  const startDate = expectString(notice.startDate, `行政班课程表.notices[${index}].startDate`)
  const endDate = expectString(notice.endDate, `行政班课程表.notices[${index}].endDate`)

  parseIsoDate(startDate)
  parseIsoDate(endDate)

  return { label: expectString(notice.label, `行政班课程表.notices[${index}].label`), startDate, endDate, startWeek: expectIntegerRange(notice.startWeek, `行政班课程表.notices[${index}].startWeek`, 1, 60), endWeek: expectIntegerRange(notice.endWeek, `行政班课程表.notices[${index}].endWeek`, 1, 60) }
}

function parseLanguageClass(value: unknown): LanguageClass {
  const root = expectRecord(value, '语言课程表')

  const meetings = expectArray(root.meetings, '语言课程表.meetings').map((item, index) => {
    const meeting = expectRecord(item, `语言课程表.meetings[${index}]`)
    const startWeek = expectIntegerRange(meeting.startWeek, `语言课程表.meetings[${index}].startWeek`, 1, 60)
    const endWeek = expectIntegerRange(meeting.endWeek, `语言课程表.meetings[${index}].endWeek`, 1, 60)
    if (startWeek > endWeek) throw new Error(`语言课程表.meetings[${index}] 的周次范围无效`)
    return { startWeek, endWeek, weekday: expectIntegerRange(meeting.weekday, `语言课程表.meetings[${index}].weekday`, 1, 7), slot: expectIntegerRange(meeting.slot, `语言课程表.meetings[${index}].slot`, 1, 6), teachers: expectStringArray(meeting.teachers, `语言课程表.meetings[${index}].teachers`), room: expectString(meeting.room, `语言课程表.meetings[${index}].room`) }
  })

  return { code: expectString(root.code, '语言课程表.code'), meetings }
}
