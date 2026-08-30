import { describe, expect, it } from 'vitest'
import { addIsoDateDays, formatChineseDateRange, getIsoWeekday, getShanghaiToday, isoDateToDayNumber } from './DateTime'

describe('中国时区日期', () => {
  it('按上海时区判断跨日', () => {
    expect(getShanghaiToday(new Date('2026-08-30T15:59:59Z'))).toBe('2026-08-30')
    expect(getShanghaiToday(new Date('2026-08-30T16:00:00Z'))).toBe('2026-08-31')
  })

  it('日期运算不受设备夏令时影响', () => {
    expect(addIsoDateDays('2026-03-01', 14)).toBe('2026-03-15')
    expect(isoDateToDayNumber('2026-03-15') - isoDateToDayNumber('2026-03-01')).toBe(14)
  })

  it('正确计算星期和日期范围', () => {
    expect(getIsoWeekday('2026-08-31')).toBe(1)
    expect(formatChineseDateRange('2026-08-31', '2026-09-04')).toBe('8月31日 — 9月4日')
  })
})
