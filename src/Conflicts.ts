import type { ScheduleEvent } from './Types'

export interface CourseConflict { weekday: number, slot: number, weeks: number[], dates: string[], courses: ScheduleEvent[] }

function courseIdentity(event: ScheduleEvent) {
  return JSON.stringify([event.title, event.teacher, event.room])
}

export function findCourseConflicts(events: ScheduleEvent[]): CourseConflict[] {
  const cells = new Map<string, Map<string, ScheduleEvent>>()
  for (const event of events) {
    const key = JSON.stringify([event.date, event.slot])
    const courses = cells.get(key) ?? new Map<string, ScheduleEvent>()
    courses.set(courseIdentity(event), event)
    cells.set(key, courses)
  }

  const conflicts = new Map<string, CourseConflict>()
  for (const cell of cells.values()) {
    if (cell.size < 2) continue
    const courses = [...cell.values()].sort((left, right) => courseIdentity(left).localeCompare(courseIdentity(right)))
    const first = courses[0]
    const key = JSON.stringify([first.weekday, first.slot, courses.map(courseIdentity)])
    const conflict = conflicts.get(key) ?? { weekday: first.weekday, slot: first.slot, weeks: [], dates: [], courses }
    conflict.weeks.push(first.week)
    conflict.dates.push(first.date)
    conflicts.set(key, conflict)
  }
  return [...conflicts.values()].map((conflict) => ({ ...conflict, weeks: [...new Set(conflict.weeks)].sort((left, right) => left - right), dates: conflict.dates.sort() })).sort((left, right) => left.weekday - right.weekday || left.slot - right.slot)
}

export function formatConflictWeeks(weeks: number[]): string {
  const ranges: string[] = []
  let start = weeks[0]
  let end = start
  for (const week of weeks.slice(1)) {
    if (week === end + 1) end = week
    else {
      ranges.push(start === end ? `${start}` : `${start}–${end}`)
      start = week
      end = week
    }
  }
  if (start !== undefined) ranges.push(start === end ? `${start}` : `${start}–${end}`)
  return ranges.join('、')
}
