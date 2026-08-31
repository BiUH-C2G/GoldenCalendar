import { describe, expect, it } from 'vitest'
import { getCourseVisual, WAGARA_PATTERNS, WASHOKU_COLORS } from './CourseVisual'

describe('课程视觉标识', () => {
  it('保留参考页的完整颜色与纹理元数据', () => {
    expect(WASHOKU_COLORS).toHaveLength(32)
    expect(WASHOKU_COLORS).toContainEqual({ id: 'karashi', name: '芥子色', hex: '#d0af4c' })
    expect(WAGARA_PATTERNS).toHaveLength(19)
    expect(WAGARA_PATTERNS.find((pattern) => pattern.id === 'shokko')).toMatchObject({ name: '蜀江', size: '56px 56px' })
    expect(WAGARA_PATTERNS.every((pattern) => pattern.svg.startsWith('<svg'))).toBe(true)
  })

  it('相同课程经规范化后始终获得相同视觉标识', () => {
    const first = getCourseVisual('  Software  Engineering ')
    const second = getCourseVisual('software engineering')
    expect(second.color).toEqual(first.color)
    expect(second.pattern).toEqual(first.pattern)
  })

  it('颜色与纹理使用独立哈希流', () => {
    const visuals = Array.from({ length: 96 }, (_, index) => getCourseVisual(`课程${index + 1}`))
    expect(new Set(visuals.map((visual) => visual.color.id)).size).toBeGreaterThan(24)
    expect(new Set(visuals.map((visual) => visual.pattern.id)).size).toBeGreaterThan(16)
    expect(new Set(visuals.map((visual) => `${visual.color.id}/${visual.pattern.id}`)).size).toBeGreaterThan(80)
  })
})
