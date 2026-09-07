import { describe, expect, it } from 'vitest'
import { attendanceMetric, buildAttendanceCourses, currentAttendanceLessons, parseAttendanceBackup, summarizeAttendance } from './Attendance'
import type { AttendanceRecord } from './Attendance'
import { readAttendance, undoAttendance, writeAttendance } from './AttendanceStore'
import type { ScheduleEvent, Selection } from './Types'

const selection: Selection = { term: '2026Autumn', grade: '2026', majorCode: 'CS', groupId: '1', englishClassNumber: '1', englishCatchupEnabled: false, englishCatchupClassNumber: null, germanLevel: 'A1', germanClassNumber: '1', physicalEducationGroupId: '1' }
const sessions = ['8:30-10:00', '10:15-11:45', '14:30-16:00']
const events: ScheduleEvent[] = Array.from({ length: 6 }, (_, index) => ({ date: index < 3 ? '2026-09-01' : '2026-09-02', week: 1, weekday: index < 3 ? 2 : 3, slot: index % 3 + 1, title: '测试课程', teacher: '教师甲', room: '教室甲', source: 'administrative' }))
const course = buildAttendanceCourses({ groupId: '1', events, notices: [] }, selection)[0]
const now = Date.parse('2026-09-03T12:00:00+08:00')

function record(index: number, presence: AttendanceRecord['presence'] = 'absent', rollCall: AttendanceRecord['rollCall'] = 'no'): AttendanceRecord {
  return { ...course.lessons[index], presence, rollCall, updatedAt: '2026-09-03T04:00:00.000Z' }
}

describe('出勤口径', () => {
  it.each([
    { name: '全部到场', records: [record(0, 'present', 'yes'), record(1, 'present'), record(2, 'present')], counts: [0, 0, 0, 0] },
    { name: '缺一节且未点名', records: [record(0)], counts: [0, 0, 1, 1] },
    { name: '全天缺勤且未点名', records: [record(0), record(1), record(2)], counts: [0, 0, 3, 3] },
    { name: '全天缺勤且点名一节', records: [record(0, 'absent', 'yes'), record(1), record(2)], counts: [1, 3, 3, 3] },
    { name: '全天缺勤且点名两节', records: [record(0, 'absent', 'yes'), record(1, 'absent', 'yes'), record(2)], counts: [2, 3, 3, 3] },
    { name: '仅缺的一节被点名', records: [record(0, 'absent', 'yes'), record(1, 'present'), record(2, 'present')], counts: [1, 3, 1, 3] },
    { name: '只在到场时点名', records: [record(0), record(1, 'present', 'yes'), record(2, 'present')], counts: [0, 0, 1, 1] },
    { name: '同日有点名到场和点名缺勤', records: [record(0, 'absent', 'yes'), record(1), record(2, 'present', 'yes')], counts: [1, 3, 2, 3] }
  ])('$name', ({ records, counts }) => {
    const result = summarizeAttendance(course, records, sessions, now)
    expect(['called', 'daily', 'actual', 'conservative'].map((key) => result.metrics[key as keyof typeof result.metrics].count)).toEqual(counts)
  })

  it('保守合并跨日期取并集，不取两个总数的最大值', () => {
    const result = summarizeAttendance(course, [record(0), record(1), record(2), record(3, 'absent', 'yes')], sessions, now)
    expect(result.metrics.actual.count).toBe(4)
    expect(result.metrics.daily.count).toBe(3)
    expect(result.metrics.conservative.count).toBe(6)
  })

  it('未知状态不认定到场或未点名，未来记录不计入事实', () => {
    const result = summarizeAttendance(course, [record(0, 'absent', 'unknown'), record(3, 'absent', 'yes')], sessions, Date.parse('2026-09-01T16:00:00+08:00'))
    expect(result.unknownPresence).toBe(2)
    expect(result.unknownRollCall).toBe(3)
    expect(result.future).toBe(3)
    expect(result.metrics.actual.count).toBe(1)
    expect(result.metrics.called.count).toBe(0)
  })

  it('连带假设覆盖当天未来节次，但不改写实际缺勤', () => {
    const result = summarizeAttendance(course, [record(0, 'absent', 'yes')], sessions, Date.parse('2026-09-01T09:00:00+08:00'))
    expect(result.metrics.daily.count).toBe(3)
    expect(result.metrics.actual.count).toBe(1)
    expect(result.future).toBe(5)
  })

  it('重复记录不会重复计数，撤销缺勤后连带计数同步消失', () => {
    expect(summarizeAttendance(course, [record(0, 'absent', 'yes'), record(0, 'absent', 'yes')], sessions, now).metrics.called.count).toBe(1)
    expect(summarizeAttendance(course, [record(0, 'absent', 'yes'), record(0, 'present', 'yes')], sessions, now).metrics.daily.count).toBe(0)
  })

  it.each([10, 20, 40, 100])('总计 %i 节时恰好百分之三十已经达线', (total) => {
    expect(attendanceMetric(total * .3, total).level).toBe('danger')
    expect(attendanceMetric(total * .3 - 1, total)).toMatchObject({ level: 'critical', remaining: 0 })
  })

  it('非整除总数、零节和少课时课程的边界', () => {
    expect(attendanceMetric(2, 7)).toMatchObject({ maximum: 2, level: 'critical' })
    expect(attendanceMetric(3, 7)).toMatchObject({ level: 'danger', excess: 1 })
    expect(attendanceMetric(0, 0).rate).toBe(0)
    expect(attendanceMetric(0, 3).remaining).toBe(0)
    expect(attendanceMetric(8, 40).remaining).toBe(3)
    expect(attendanceMetric(9, 40).label).toBe('需留意')
  })
})

describe('出勤课表关联', () => {
  it('排除语言占位和假期并按稳定节次去重', () => {
    const group = { groupId: '1', events: [...events, { ...events[0], teacher: '教师乙' }, { ...events[0], title: 'English Catchup' }], notices: [{ label: '假期', startDate: '2026-09-02', endDate: '2026-09-02', startWeek: 1, endWeek: 1 }] }
    const courses = buildAttendanceCourses(group, selection)
    expect(courses).toHaveLength(1)
    expect(courses[0].lessons).toHaveLength(3)
  })

  it('换教师或教室不丢关联，换学期或行政班不混记', () => {
    const group = { groupId: '1', events: events.map((event) => ({ ...event, teacher: '新教师', room: '新教室' })), notices: [] }
    expect(buildAttendanceCourses(group, selection)[0].lessons[0].id).toBe(course.lessons[0].id)
    expect(buildAttendanceCourses(group, { ...selection, term: '2027Spring' })[0].id).not.toBe(course.id)
    expect(buildAttendanceCourses(group, { ...selection, groupId: '2' })[0].id).not.toBe(course.id)
  })

  it('同名不同来源的课程不互相连带', () => {
    const other = buildAttendanceCourses({ groupId: '1', events: events.map((event) => ({ ...event, source: 'language' })), notices: [] }, selection)[0]
    expect(summarizeAttendance(other, [record(0, 'absent', 'yes')], sessions, now).metrics.daily.count).toBe(0)
  })

  it('当前课程按上海时区匹配，结束时刻不再选中', () => {
    expect(currentAttendanceLessons([course], sessions, new Date('2026-09-01T01:00:00Z')).map((lesson) => lesson.event.slot)).toEqual([1])
    expect(currentAttendanceLessons([course], sessions, new Date('2026-09-01T02:00:00Z'))).toHaveLength(0)
  })
})

describe('出勤存储和备份', () => {
  function storage(initial: AttendanceRecord[] = []) {
    let data = JSON.stringify({ version: 1, records: initial })
    return { getItem: () => data, setItem: (_key: string, value: string) => data = value }
  }

  it('备份往返保留事实与课程身份', () => {
    expect(parseAttendanceBackup(JSON.parse(JSON.stringify({ version: 1, records: [record(0)] }))).records).toEqual([record(0)])
  })

  it('拒绝不支持版本、重复标识、无效状态和伪造日期', () => {
    expect(() => parseAttendanceBackup({ version: 2, records: [] })).toThrow()
    expect(() => parseAttendanceBackup({ version: 1, records: [record(0), record(0)] })).toThrow()
    expect(() => parseAttendanceBackup({ version: 1, records: [{ ...record(0), presence: '其他' }] })).toThrow()
    expect(() => parseAttendanceBackup({ version: 1, records: [{ ...record(0), event: { ...record(0).event, date: '2026-02-30' } }] })).toThrow()
  })

  it('按节次更新并合并最新数据，删除不影响其他记录', () => {
    const target = storage([record(0), record(3)])
    writeAttendance(new Map([[record(0).id, record(0, 'present', 'yes')], [record(1).id, record(1)]]), target)
    expect(readAttendance(target)).toHaveLength(3)
    expect(readAttendance(target).find((item) => item.id === record(0).id)?.presence).toBe('present')
    writeAttendance(new Map([[record(0).id, null]]), target)
    expect(readAttendance(target).map((item) => item.id)).toEqual([record(3).id, record(1).id])
  })

  it('存储失败或原数据损坏时不覆盖现有内容', () => {
    const target = storage([record(0)])
    expect(() => writeAttendance(new Map([[record(1).id, record(1)]]), { ...target, setItem: () => { throw new Error('空间不足') } })).toThrow('空间不足')
    expect(readAttendance(target)).toEqual([record(0)])
    let writes = 0
    expect(() => writeAttendance(new Map(), { getItem: () => '损坏数据', setItem: () => writes += 1 })).toThrow()
    expect(writes).toBe(0)
  })

  it('撤销不受备份解析后的字段顺序影响，重新关联可以完整恢复', () => {
    const target = storage([record(0)])
    const before = new Map<string, AttendanceRecord | null>([[record(0).id, record(0)], [record(1).id, null]])
    const after = new Map<string, AttendanceRecord | null>([[record(0).id, null], [record(1).id, record(1)]])
    writeAttendance(after, target)
    expect(undoAttendance(before, after, target)).toEqual([record(0)])
  })

  it('撤销保留其他节次的新记录，拒绝覆盖同节次的并发修改', () => {
    const target = storage()
    const before = new Map<string, AttendanceRecord | null>([[record(0).id, null]])
    const after = new Map<string, AttendanceRecord | null>([[record(0).id, record(0)]])
    writeAttendance(after, target)
    writeAttendance(new Map([[record(1).id, record(1)]]), target)
    expect(undoAttendance(before, after, target)).toEqual([record(1)])
    writeAttendance(new Map([[record(0).id, record(0, 'present')]]), target)
    expect(() => undoAttendance(before, after, target)).toThrow('相关记录已在其他页面更新')
    expect(readAttendance(target)).toHaveLength(2)
  })
})
