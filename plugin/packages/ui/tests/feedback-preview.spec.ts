import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('反馈附件预览', () => {
  it('每个附件都有缩略图，且对象 URL 成对创建/释放（替换与卸载都回收）', async () => {
    const source = await readFile(new URL('../src/feedback-dialog.tsx', import.meta.url), 'utf8')
    expect(source).toContain('URL.createObjectURL')
    expect(source).toContain('URL.revokeObjectURL')
    expect(source).toContain('<AttachmentThumb')
    expect(source).toContain('own-feedback-thumb')
    // 释放必须发生在 useEffect 的清理函数里，而不是别处
    expect(source).toMatch(/return \(\) => \{ URL\.revokeObjectURL\(next\) \}/)
  })
})
