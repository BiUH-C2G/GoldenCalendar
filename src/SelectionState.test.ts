import { describe, expect, it } from 'vitest'
import { createEmptySelectionDraft, getSelectionBlocker, getSelectionOptions, readSelectionDraft, selectionFromDraft, updateSelectionDraft } from './SelectionState'

describe('选择状态', () => {
  it('自动修复二六级缺失的德语等级', () => {
    const draft = readSelectionDraft({ term: '2026Autumn', grade: '2026', majorCode: 'SE', groupId: '1', englishClassNumber: '5', englishCatchupEnabled: false, englishCatchupClassNumber: null, germanClassNumber: '9' })
    expect(draft?.germanLevel).toBe('A1')
    expect(draft?.germanClassNumber).toBe('9')
    expect(selectionFromDraft(draft!)).not.toBeNull()
  })

  it('非法旧等级不会把班级误映射到新等级', () => {
    const draft = readSelectionDraft({ term: '2026Autumn', grade: '2026', majorCode: 'SE', groupId: '1', englishClassNumber: '5', englishCatchupEnabled: false, englishCatchupClassNumber: null, germanLevel: 'B1', germanClassNumber: '9' })
    expect(draft?.germanLevel).toBe('A1')
    expect(draft?.germanClassNumber).toBe('')
    expect(getSelectionBlocker(draft!)).toBe('请选择德语班级')
  })

  it('选择二六级后英语区域等待专业', () => {
    const draft = updateSelectionDraft(createEmptySelectionDraft(), 'grade', '2026')
    const options = getSelectionOptions(draft)
    expect(options.hasEnglish).toBe(true)
    expect(options.englishClasses).toEqual([])
    expect(getSelectionBlocker(draft)).toBe('请选择专业')
  })

  it('单一行政班会自动跳过', () => {
    let draft = updateSelectionDraft(createEmptySelectionDraft(), 'grade', '2026')
    draft = updateSelectionDraft(draft, 'majorCode', 'SE')
    expect(draft.groupId).toBe('1')
  })

  it('单一德语班会自动跳过', () => {
    let draft = updateSelectionDraft(createEmptySelectionDraft(), 'grade', '2024')
    draft = updateSelectionDraft(draft, 'majorCode', 'CS')
    draft = updateSelectionDraft(draft, 'groupId', '1')
    draft = updateSelectionDraft(draft, 'germanLevel', 'TestDaF')
    expect(draft.germanClassNumber).toBe('1')
  })

  it('非英语年级会清理隐藏的英语状态', () => {
    const draft = readSelectionDraft({ term: '2026Autumn', grade: '2025', majorCode: 'CS', groupId: '1', englishClassNumber: '5', englishCatchupEnabled: true, englishCatchupClassNumber: '29', germanLevel: 'B1', germanClassNumber: '1' })
    expect(draft?.englishClassNumber).toBe('')
    expect(draft?.englishCatchupEnabled).toBe(false)
    expect(draft?.englishCatchupClassNumber).toBe('')
    expect(getSelectionBlocker(draft!)).toBeNull()
  })

  it('保存提示返回页面中最先缺失的选项', () => {
    let draft = updateSelectionDraft(createEmptySelectionDraft(), 'grade', '2026')
    draft = updateSelectionDraft(draft, 'majorCode', 'SE')
    draft = updateSelectionDraft(draft, 'englishClassNumber', '5')
    draft = updateSelectionDraft(draft, 'englishCatchupEnabled', true)
    expect(getSelectionBlocker(draft)).toBe('请选择补课班级')
  })
})
