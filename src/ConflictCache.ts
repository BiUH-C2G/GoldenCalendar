import type { CourseConflict } from './Conflicts'
import type { ScheduleEvent } from './Types'

export const CONFLICT_CACHE_KEY = 'campus-timetable-confirmed-conflicts-v1'
const CACHE_LIMIT = 32

export interface ConflictConfirmation { hasConflicts: boolean, hash: string | null }

export async function hashConflicts(term: string, events: ScheduleEvent[], conflicts: CourseConflict[]): Promise<string | null> {
  if (!conflicts.length || !globalThis.crypto?.subtle) return null
  const cells = new Set(conflicts.flatMap((conflict) => conflict.dates.map((date) => JSON.stringify([date, conflict.slot]))))
  const records = [...new Set(events.filter((event) => cells.has(JSON.stringify([event.date, event.slot]))).map((event) => JSON.stringify([event.date, event.week, event.weekday, event.slot, event.title, event.source, event.teacher, event.room])))].sort()
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([1, term, records])))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

function readHashes(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CONFLICT_CACHE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && /^[a-f0-9]{64}$/.test(item)).slice(-CACHE_LIMIT) : []
  } catch {
    return []
  }
}

export function isConflictConfirmed(hash: string | null): boolean {
  return hash !== null && readHashes().includes(hash)
}

export function clearConfirmedConflicts() {
  try {
    localStorage.removeItem(CONFLICT_CACHE_KEY)
  } catch {
    throw new Error('无法清除冲突确认缓存，请检查浏览器储存权限后重试')
  }
}

export function rememberConfirmedConflict(hash: string | null) {
  if (!hash) return
  try {
    localStorage.setItem(CONFLICT_CACHE_KEY, JSON.stringify([...readHashes().filter((item) => item !== hash), hash].slice(-CACHE_LIMIT)))
  } catch {
    // 缓存失败不影响已经保存的课程，下次遇到冲突时重新询问
  }
}
