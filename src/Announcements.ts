import { expectArray, expectRecord, expectString } from './Validation'

export interface Announcement { id: string, title: string, content: string }
const DISMISSED_KEY = 'campus-timetable-dismissed-announcements'

export async function loadAnnouncements(signal: AbortSignal): Promise<Announcement[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}announcements.json`, { signal, cache: 'no-store' })

  if (!response.ok) throw new Error(`公告加载失败（${response.status}）`)

  const ids = new Set<string>()
  return expectArray(await response.json(), '公告列表').map((value, index) => {
    const item = expectRecord(value, `公告列表[${index}]`)
    const id = expectString(item.id, '公告日期').trim()
    const title = expectString(item.title, '公告标题').trim()
    const content = expectString(item.content, '公告内容').trim()

    if (!id || !title || !content) throw new Error('公告日期、标题和内容不能为空')
    if (ids.has(id)) throw new Error(`公告日期标识重复：${id}`)

    ids.add(id)
    return { id, title, content }
  })
}

export function readDismissedAnnouncements(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

export function dismissAnnouncement(id: string) {
  const dismissed = readDismissedAnnouncements()
  dismissed.add(id)
  
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
  } catch {
    throw new Error('无法记住此选择，请检查浏览器储存权限，或选择“关闭”')
  }
}
