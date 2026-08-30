const SHANGHAI_TIMEZONE = 'Asia/Shanghai'
const DAY_MILLISECONDS = 86_400_000
const shanghaiDateFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: SHANGHAI_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

export function isoDateToDayNumber(value: string): number {
  const { year, month, day } = parseIsoDate(value)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MILLISECONDS)
}

export function dayNumberToIsoDate(value: number): string {
  const date = new Date(value * DAY_MILLISECONDS)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function addIsoDateDays(value: string, days: number): string {
  return dayNumberToIsoDate(isoDateToDayNumber(value) + days)
}

export function getShanghaiToday(now = new Date()): string {
  const parts = shanghaiDateFormatter.formatToParts(now)
  const year = parts.find((item) => item.type === 'year')?.value
  const month = parts.find((item) => item.type === 'month')?.value
  const day = parts.find((item) => item.type === 'day')?.value
  if (!year || !month || !day) throw new Error('无法取得中国时区日期')
  return `${year}-${month}-${day}`
}

export function getIsoWeekday(value: string): number {
  const weekday = new Date(isoDateToDayNumber(value) * DAY_MILLISECONDS).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

export function formatMonthDay(value: string): string {
  const { month, day } = parseIsoDate(value)
  return `${month}/${day}`
}

export function formatChineseDateRange(startValue: string, endValue: string): string {
  const start = parseIsoDate(startValue)
  const end = parseIsoDate(endValue)
  if (start.month === end.month) return `${start.month}月${start.day}日 — ${end.day}日`
  return `${start.month}月${start.day}日 — ${end.month}月${end.day}日`
}

export function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`日期格式无效：${value}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) throw new Error(`日期数值无效：${value}`)
  return { year, month, day }
}

export { SHANGHAI_TIMEZONE }
