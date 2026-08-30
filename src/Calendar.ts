import type { ScheduleEvent, ScheduleGroup, ScheduleData } from './Types'

interface CalendarEvent {
  start: string
  end: string
  title: string
  teacher: string | null
  room: string | null
}

const CALENDAR_TIMEZONE = 'Asia/Shanghai'

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function formatIcsDate(date: string, time: string) {
  const [year, month, day] = date.split('-')
  const [hours, minutes] = time.split(':')
  return `${year}${month}${day}T${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`
}

function formatIcsUtcDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function sessionTimeRange(value: string) {
  const match = value.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
  return match ? { start: match[1], end: match[2] } : null
}

function eventTitle(event: ScheduleEvent) {
  return event.title.replace(/\r?\n/g, ' / ')
}

function mergeEvents(data: ScheduleData, group: ScheduleGroup): CalendarEvent[] {
  const sessions = data.calendar.sessions.map(sessionTimeRange)
  const events = [...group.events].sort((left, right) => (
    left.date.localeCompare(right.date)
    || left.slot - right.slot
  ))
  const merged: CalendarEvent[] = []

  for (const event of events) {
    const range = sessions[event.slot - 1]
    if (!range) continue
    const last = merged.at(-1)
    const sameCourse = last
      && last.end === formatIcsDate(event.date, sessions[event.slot - 2]?.end ?? range.start)
      && last.title === eventTitle(event)
      && last.teacher === event.teacher
      && last.room === event.room

    if (sameCourse) {
      last.end = formatIcsDate(event.date, range.end)
      continue
    }

    merged.push({
      start: formatIcsDate(event.date, range.start),
      end: formatIcsDate(event.date, range.end),
      title: eventTitle(event),
      teacher: event.teacher,
      room: event.room,
    })
  }

  return merged
}

function foldIcsLine(line: string) {
  const chunks: string[] = []
  let remaining = line
  while (remaining.length > 75) {
    chunks.push(remaining.slice(0, 75))
    remaining = ` ${remaining.slice(75)}`
  }
  chunks.push(remaining)
  return chunks.join('\r\n')
}

export function buildCalendarFile(data: ScheduleData, group: ScheduleGroup) {
  const stamp = formatIcsUtcDate(new Date())
  const events = mergeEvents(data, group)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Campus Timetable//Calendar Import//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${CALENDAR_TIMEZONE}`,
    `X-WR-CALNAME:${escapeIcsText(`${data.source.grade}级 ${data.source.major} ${group.groupId}班课表`)}`,
    'BEGIN:VTIMEZONE',
    `TZID:${CALENDAR_TIMEZONE}`,
    `X-LIC-LOCATION:${CALENDAR_TIMEZONE}`,
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]

  events.forEach((event, index) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${data.source.term}-${data.source.grade}-${data.source.majorCode}-${group.groupId}-${event.start}-${index}@campus-timetable`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${CALENDAR_TIMEZONE}:${event.start}`,
      `DTEND;TZID=${CALENDAR_TIMEZONE}:${event.end}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      ...(event.room ? [`LOCATION:${escapeIcsText(event.room)}`] : []),
      ...(event.teacher ? [`DESCRIPTION:${escapeIcsText(`教师：${event.teacher}`)}`] : []),
      'END:VEVENT',
    )
  })

  lines.push('END:VCALENDAR')
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}

export function importCalendar(data: ScheduleData, group: ScheduleGroup) {
  const fileName = `${data.source.grade}${data.source.majorCode}-${group.groupId}.ics`
  const blob = new Blob([buildCalendarFile(data, group)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener'
  link.type = 'text/calendar'
  document.body.append(link)

  const opened = window.open(url, '_blank')
  if (!opened) {
    link.download = fileName
    link.target = '_self'
    link.click()
  }

  window.setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 60_000)
}
