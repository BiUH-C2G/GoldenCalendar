import { describe, expect, it } from 'vitest'
import { buildCalendarFile, buildCourseCalendarFile } from './Calendar'
import type { ScheduleData, ScheduleGroup } from './Types'

const group: ScheduleGroup = { groupId: '1', events: [{ date: '2026-08-31', week: 1, weekday: 1, slot: 1, title: '很长的中文课程名称用于验证日历文件折行不会破坏任何中文字符很长的中文课程名称用于验证日历文件折行不会破坏任何中文字符', teacher: '测试教师', room: 'A101', source: 'administrative' }], notices: [] }
const data: ScheduleData = { source: { term: '2026Autumn', grade: '2026', majorCode: 'CS', major: '计算机科学与技术' }, calendar: { startDate: '2026-08-31', weekCount: 1, sessions: ['8:30-10:00'] }, group }

describe('日历导出', () => {
  it('每个物理行不超过七十五个 UTF-8 字节', () => {
    const lines = buildCalendarFile(data, group).trimEnd().split('\r\n')
    expect(lines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
  })

  it('相同课程始终生成相同 UID', () => {
    const first = buildCalendarFile(data, group).match(/^UID:(.+)$/m)?.[1]
    const second = buildCalendarFile(data, group).match(/^UID:(.+)$/m)?.[1]
    expect(first).toBeTruthy()
    expect(second).toBe(first)
  })

  it('明确写入上海时区和事项序号', () => {
    const calendar = buildCalendarFile(data, group)
    expect(calendar).toContain('DTSTART;TZID=Asia/Shanghai:20260831T083000')
    expect(calendar).toContain('SEQUENCE:0')
  })

  it('能够为单次课程生成独立日历文件', () => {
    const calendar = buildCourseCalendarFile(data, group, group.events[0])
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(calendar).toContain('DTEND;TZID=Asia/Shanghai:20260831T100000')
    expect(calendar).toContain('LOCATION:A101')
  })
})
