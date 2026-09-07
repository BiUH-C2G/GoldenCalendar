import { getShanghaiToday, parseIsoDate } from './DateTime'
import { isHolidayDate } from './Schedule'
import type { ScheduleEvent, ScheduleGroup, Selection } from './Types'

export type Presence = 'present' | 'absent' | 'unknown'
export type RollCall = 'yes' | 'no' | 'unknown'
export type AttendanceMode = 'called' | 'daily' | 'actual' | 'conservative'
export interface AttendanceLesson { id: string, courseId: string, event: ScheduleEvent }
export interface AttendanceCourse { id: string, title: string, lessons: AttendanceLesson[] }
export interface AttendanceRecord extends AttendanceLesson { presence: Presence, rollCall: RollCall, updatedAt: string }
export interface AttendanceBackup { version: 1, records: AttendanceRecord[] }
export const ATTENDANCE_STORAGE_KEY = 'campus-attendance-v1'
export const PRESENCE_LABELS: Record<Presence, string> = { present: '到场', absent: '缺勤', unknown: '未记录' }
export const ROLL_CALL_LABELS: Record<RollCall, string> = { yes: '点名', no: '未点名', unknown: '不清楚' }
export const ATTENDANCE_MODES: Array<{ key: AttendanceMode, label: string, description: string }> = [
  { key: 'called', label: '逐节点名', description: '只计实际缺勤且点名的节次' },
  { key: 'daily', label: '整日连带', description: '当天本课有一次点名缺勤，就计当天本课全部节次' },
  { key: 'actual', label: '实际缺勤', description: '计入已记录的全部实际缺勤，与点名无关' },
  { key: 'conservative', label: '保守合并', description: '实际缺勤与整日连带的节次取并集，每节只计一次' }
]

export function attendanceLessonId(courseId: string, date: string, slot: number) {
  return JSON.stringify([courseId, date, slot])
}

export function buildAttendanceCourses(group: ScheduleGroup, selection: Selection): AttendanceCourse[] {
  const courses = new Map<string, AttendanceCourse>()
  const seen = new Set<string>()
  for (const event of group.events) {
    if (isHolidayDate(group, event.date) || event.source === 'administrative' && ['English', 'English Catchup', 'German'].includes(event.title)) continue
    const coordinate = event.source === 'administrative' ? [selection.grade, selection.majorCode, selection.groupId] : event.source === 'physicalEducation' ? [selection.grade, selection.physicalEducationGroupId] : [selection.grade, event.title]
    const courseId = JSON.stringify([selection.term, event.source, coordinate, event.title])
    const id = attendanceLessonId(courseId, event.date, event.slot)
    if (seen.has(id)) continue
    seen.add(id)
    const course = courses.get(courseId) ?? { id: courseId, title: event.title, lessons: [] }
    course.lessons.push({ id, courseId, event })
    courses.set(courseId, course)
  }
  return [...courses.values()].map((course) => ({ ...course, lessons: course.lessons.sort((a, b) => a.event.date.localeCompare(b.event.date) || a.event.slot - b.event.slot) })).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
}

export function lessonStart(lesson: AttendanceLesson, sessions: string[]) {
  const time = sessions[lesson.event.slot - 1]?.split('-')[0]?.trim()
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return Number.POSITIVE_INFINITY
  return Date.parse(`${lesson.event.date}T${time.padStart(5, '0')}:00+08:00`)
}

export function currentAttendanceLessons(courses: AttendanceCourse[], sessions: string[], now = new Date()) {
  const today = getShanghaiToday(now)
  return courses.flatMap((course) => course.lessons).filter((lesson) => {
    const end = sessions[lesson.event.slot - 1]?.split('-')[1]?.trim()
    return lesson.event.date === today && end && lessonStart(lesson, sessions) <= now.getTime() && now.getTime() < Date.parse(`${today}T${end.padStart(5, '0')}:00+08:00`)
  })
}

export function attendanceMetric(count: number, total: number) {
  // 用整数运算保留严格小于百分之三十的边界
  const maximum = Math.max(0, Math.floor((3 * total - 1) / 10))
  const remaining = Math.max(0, maximum - count)
  const exceeded = total > 0 && count * 10 >= total * 3
  return { count, total, rate: total ? count / total * 100 : 0, maximum, remaining, excess: Math.max(0, count - maximum), level: exceeded ? 'danger' : remaining === 0 ? 'critical' : remaining <= 2 ? 'warning' : 'normal', label: exceeded ? '已达线' : remaining === 0 ? '临界' : remaining <= 2 ? '需留意' : '有余量' }
}

export function summarizeAttendance(course: AttendanceCourse, records: AttendanceRecord[], sessions: string[], now = Date.now()) {
  const index = new Map(records.map((record) => [record.id, record]))
  const actual = new Set<string>()
  const called = new Set<string>()
  const calledDates = new Set<string>()
  let unknownPresence = 0
  let unknownRollCall = 0
  let future = 0
  for (const lesson of course.lessons) {
    if (lessonStart(lesson, sessions) > now) {
      future += 1
      continue
    }
    const record = index.get(lesson.id)
    if (!record || record.presence === 'unknown') unknownPresence += 1
    if (!record || record.rollCall === 'unknown') unknownRollCall += 1
    if (record?.presence !== 'absent') continue
    actual.add(lesson.id)
    if (record.rollCall === 'yes') {
      called.add(lesson.id)
      calledDates.add(lesson.event.date)
    }
  }
  // 连带假设可以覆盖当天尚未开始的同课时段，但不把它们写成实际缺勤
  const daily = new Set(course.lessons.filter((lesson) => calledDates.has(lesson.event.date)).map((lesson) => lesson.id))
  const conservative = new Set([...actual, ...daily])
  const total = course.lessons.length
  const nextDate = course.lessons.find((lesson) => lessonStart(lesson, sessions) > now)?.event.date
  return { course, total, future, unknownPresence, unknownRollCall, nextDate, nextCount: course.lessons.filter((lesson) => lesson.event.date === nextDate).length, metrics: { called: attendanceMetric(called.size, total), daily: attendanceMetric(daily.size, total), actual: attendanceMetric(actual.size, total), conservative: attendanceMetric(conservative.size, total) } }
}

export function parseAttendanceBackup(value: unknown): AttendanceBackup {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.records) || value.records.length > 50000) throw new Error('出勤备份格式或版本无效')
  const ids = new Set<string>()
  const records = value.records.map((item): AttendanceRecord => {
    if (!isRecord(item) || !isRecord(item.event)) throw new Error('出勤记录格式无效')
    const event = item.event
    if (typeof item.courseId !== 'string' || typeof item.id !== 'string' || typeof event.date !== 'string' || typeof event.title !== 'string' || !event.title.trim() || !['administrative', 'language', 'physicalEducation'].includes(String(event.source))) throw new Error('出勤记录的课程信息无效')
    parseIsoDate(event.date)
    if (!Number.isInteger(event.slot) || Number(event.slot) < 1 || Number(event.slot) > 20 || !Number.isInteger(event.week) || Number(event.week) < 1 || Number(event.week) > 60 || !Number.isInteger(event.weekday) || Number(event.weekday) < 1 || Number(event.weekday) > 7) throw new Error('出勤记录的节次或周次无效')
    if (event.teacher !== null && typeof event.teacher !== 'string' || event.room !== null && typeof event.room !== 'string') throw new Error('出勤记录的教师或教室无效')
    if (!['present', 'absent', 'unknown'].includes(String(item.presence)) || !['yes', 'no', 'unknown'].includes(String(item.rollCall))) throw new Error('出勤记录的到场或点名状态无效')
    if (typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt)) || item.id !== attendanceLessonId(item.courseId, event.date, Number(event.slot)) || ids.has(item.id)) throw new Error('出勤记录的标识重复或无效')
    const identity: unknown = JSON.parse(item.courseId)
    if (!Array.isArray(identity) || identity.length !== 4 || typeof identity[0] !== 'string' || identity[1] !== event.source || !Array.isArray(identity[2]) || !identity[2].every((part: unknown) => typeof part === 'string') || identity[3] !== event.title) throw new Error('出勤记录的课程标识无效')
    ids.add(item.id)
    return { id: item.id, courseId: item.courseId, event: { date: event.date, title: event.title, slot: Number(event.slot), week: Number(event.week), weekday: Number(event.weekday), teacher: event.teacher as string | null, room: event.room as string | null, source: event.source as ScheduleEvent['source'] }, presence: item.presence as Presence, rollCall: item.rollCall as RollCall, updatedAt: item.updatedAt }
  })
  return { version: 1, records }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
