import { ATTENDANCE_STORAGE_KEY, parseAttendanceBackup } from './Attendance'
import type { AttendanceRecord } from './Attendance'

export function readAttendance(storage: Pick<Storage, 'getItem'> = localStorage) {
  const raw = storage.getItem(ATTENDANCE_STORAGE_KEY)
  return raw ? parseAttendanceBackup(JSON.parse(raw)).records : []
}

export function writeAttendance(changes: Map<string, AttendanceRecord | null>, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const before = readAttendance(storage)
  const merged = new Map(before.map((record) => [record.id, record]))
  for (const [id, record] of changes) {
    if (record) merged.set(id, record)
    else merged.delete(id)
  }
  const records = [...merged.values()]
  storage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify({ version: 1, records }))
  return { before, records }
}

export function undoAttendance(before: Map<string, AttendanceRecord | null>, after: Map<string, AttendanceRecord | null>, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const current = new Map(readAttendance(storage).map((record) => [record.id, record]))
  for (const [id, expected] of after) if (!sameRecord(current.get(id) ?? null, expected)) throw new Error('相关记录已在其他页面更新，无法撤销')
  return writeAttendance(before, storage).records
}

function sameRecord(left: AttendanceRecord | null, right: AttendanceRecord | null) {
  if (!left || !right) return left === right
  return left.id === right.id && left.courseId === right.courseId && left.presence === right.presence && left.rollCall === right.rollCall && left.updatedAt === right.updatedAt && (Object.keys(left.event) as Array<keyof AttendanceRecord['event']>).every((key) => left.event[key] === right.event[key])
}
