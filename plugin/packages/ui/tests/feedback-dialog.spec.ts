/**
 * [INPUT]: 依赖 feedback-dialog 的表单纯投影与源码、local-api 的反馈提交与回执解码、Node fs 与标准 File/FormData/Response
 * [OUTPUT]: 锁定 occurredAt 随 type 显隐与不提交、510 计数、附件张数/大小/魔数三道本地预校验、提交前置条件与 draft 形状、同源 multipart 提交路径与幂等键，以及「弹窗必被渲染」「失败文案复用 account-state」「浏览器不发 diagnostics」三条源码级不变量
 * [POS]: dsh-ui「帮助与反馈」的契约回归；有人把建议态也带上 occurredAt、把 SVG 放行、在浏览器侧伪造 diagnostics，或让弹窗元素与开关分家，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES,
  ENTERPRISE_FEEDBACK_DESCRIPTION_MAX,
  ENTERPRISE_FEEDBACK_MAX_ATTACHMENTS,
  enterpriseFeedbackAttachmentRejection,
  enterpriseFeedbackCounterText,
  enterpriseFeedbackDraft,
  enterpriseFeedbackImageKind,
  enterpriseFeedbackInitialState,
  enterpriseFeedbackLocalDateTime,
  enterpriseFeedbackOccurredAtIso,
  enterpriseFeedbackOccurredAtVisible,
  enterpriseFeedbackSubmitDisabled,
  type EnterpriseFeedbackFormState,
} from '../src/feedback-dialog.js'
import {
  ENTERPRISE_FEEDBACK_LOCAL_PATH,
  createEnterpriseLocalApi,
  decodeEnterpriseFeedbackReceipt,
} from '../src/local-api.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Modal: vi.fn(),
}))

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')
/** 与 PNG 等长的无关候选大小；用于断言「读不到文件头」的拒绝分支。 */
const HEADLESS_SIZE = 12

const NOW = new Date('2026-09-30T13:20:00+08:00')

function attachment(name = 'shot.png', size = PNG.length): EnterpriseFeedbackFormState['attachments'][number] {
  return { file: new File([PNG], name, { type: 'image/png' }), name, size }
}

function state(overrides: Partial<EnterpriseFeedbackFormState> = {}): EnterpriseFeedbackFormState {
  return { ...enterpriseFeedbackInitialState(NOW), consent: true, description: '上传后没有反馈', ...overrides }
}

function ok(data: unknown, status = 201): Response {
  return new Response(JSON.stringify({ data }), {
    headers: { 'content-type': 'application/json' },
    status,
  })
}

describe('the feedback form keeps the frozen field semantics', () => {
  it('shows 发生时间 only for 问题 and never submits it for 建议', () => {
    expect(enterpriseFeedbackOccurredAtVisible('issue')).toBe(true)
    expect(enterpriseFeedbackOccurredAtVisible('suggestion')).toBe(false)
    const issue = enterpriseFeedbackDraft(state({ type: 'issue' }))
    expect(issue?.occurredAt).toBe(enterpriseFeedbackOccurredAtIso(enterpriseFeedbackLocalDateTime(NOW)))
    // 切到建议：字段隐藏，且草稿里连键都不出现（不是空串，也不是 undefined 占位）。
    const suggestion = enterpriseFeedbackDraft(state({ type: 'suggestion' }))
    expect(suggestion).not.toBeUndefined()
    expect(Object.keys(suggestion!)).not.toContain('occurredAt')
    expect(suggestion?.type).toBe('suggestion')
  })

  it('defaults to 问题 with the current local time and untouched consent/attachments', () => {
    const initial = enterpriseFeedbackInitialState(NOW)
    expect(initial).toEqual({
      type: 'issue',
      description: '',
      occurredAt: '2026-09-30T13:20',
      contact: '',
      consent: false,
      attachments: [],
    })
    // 默认时间必须可解析成带时区的 ISO；契约不允许无偏移的本地时间。
    expect(enterpriseFeedbackOccurredAtIso(initial.occurredAt)).toBe('2026-09-30T05:20:00.000Z')
    expect(enterpriseFeedbackOccurredAtIso('')).toBeUndefined()
    expect(enterpriseFeedbackOccurredAtIso('not-a-date')).toBeUndefined()
  })

  it('counts 已输入/510 for the live counter', () => {
    expect(ENTERPRISE_FEEDBACK_DESCRIPTION_MAX).toBe(510)
    expect(enterpriseFeedbackCounterText(0)).toBe('已输入 0/510')
    expect(enterpriseFeedbackCounterText(510)).toBe('已输入 510/510')
    // 超限（粘贴等路径）也如实显示，不截断数字。
    expect(enterpriseFeedbackCounterText(512)).toBe('已输入 512/510')
  })

  it('rejects the fourth attachment, oversize bitmaps and non-bitmaps by magic number', () => {
    expect(ENTERPRISE_FEEDBACK_MAX_ATTACHMENTS).toBe(3)
    expect(enterpriseFeedbackAttachmentRejection({ size: PNG.length }, PNG, 0)).toBeUndefined()
    expect(enterpriseFeedbackAttachmentRejection({ size: PNG.length }, PNG, 3))
      .toBe('ENT_FEEDBACK_ATTACHMENT_INVALID')
    expect(enterpriseFeedbackAttachmentRejection({ size: ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES + 1 }, PNG, 0))
      .toBe('ENT_FEEDBACK_ATTACHMENT_TOO_LARGE')
    // 改名成 .png 的 SVG、以及读不到文件头的候选，都按位图白名单拒绝。
    expect(enterpriseFeedbackAttachmentRejection({ size: SVG.length }, SVG, 0))
      .toBe('ENT_FEEDBACK_ATTACHMENT_INVALID')
    expect(enterpriseFeedbackAttachmentRejection({ size: HEADLESS_SIZE }, undefined, 0))
      .toBe('ENT_FEEDBACK_ATTACHMENT_INVALID')
    expect(enterpriseFeedbackImageKind(PNG)).toBe('image/png')
    expect(enterpriseFeedbackImageKind(SVG)).toBeUndefined()
  })

  it('requires a description and the consent checkbox before submit', () => {
    expect(enterpriseFeedbackSubmitDisabled(state())).toBe(false)
    expect(enterpriseFeedbackSubmitDisabled(state({ description: '' }))).toBe(true)
    expect(enterpriseFeedbackSubmitDisabled(state({ description: '   ' }))).toBe(true)
    expect(enterpriseFeedbackSubmitDisabled(state({ consent: false }))).toBe(true)
    expect(enterpriseFeedbackSubmitDisabled(state({ description: 'x'.repeat(ENTERPRISE_FEEDBACK_DESCRIPTION_MAX + 1) })))
      .toBe(true)
    // 未满足条件时连草稿都不产生：调用方拿不到可以误发的对象。
    expect(enterpriseFeedbackDraft(state({ consent: false }))).toBeUndefined()
  })

  it('builds a draft with trimmed optional contact and no diagnostics field', () => {
    const draft = enterpriseFeedbackDraft(state({ contact: ' zhang@example.com ', attachments: [attachment()] }))
    expect(draft).toEqual({
      attachments: [expect.any(File)],
      consent: true,
      description: '上传后没有反馈',
      contact: 'zhang@example.com',
      occurredAt: '2026-09-30T05:20:00.000Z',
      type: 'issue',
    })
    expect(Object.keys(draft!)).not.toContain('diagnostics')
    expect(Object.keys(enterpriseFeedbackDraft(state({ contact: '   ' }))!)).not.toContain('contact')
  })
})

describe('the feedback submit crosses the same-origin multipart route', () => {
  const RECEIPT = {
    id: '1900100000000000007',
    type: 'issue',
    status: 'new',
    occurredAt: '2026-09-30T05:20:00Z',
    attachmentCount: 1,
    createdAt: '2026-09-30T05:20:11Z',
  }

  it('posts a multipart body to the fixed local path without pinning content-type', async () => {
    const fetcher = vi.fn(async () => ok(RECEIPT))
    const api = createEnterpriseLocalApi(fetcher)
    const draft = enterpriseFeedbackDraft(state({ attachments: [attachment()] }))!
    await expect(api.submitFeedback(draft, new AbortController().signal, '4c96d076-a80a-4b6c-8df6-f0db804b6f0a'))
      .resolves.toEqual(RECEIPT)
    expect(ENTERPRISE_FEEDBACK_LOCAL_PATH).toBe('/enterprise/api/v1/local/feedback')
    const [path, init] = fetcher.mock.calls[0]!
    expect(path).toBe(ENTERPRISE_FEEDBACK_LOCAL_PATH)
    expect(init).toMatchObject({ cache: 'no-store', method: 'POST' })
    // multipart 的 content-type 必须由浏览器带 boundary 生成，这里不能自己写死。
    expect(new Headers(init?.headers).get('content-type')).toBeNull()
    expect(new Headers(init?.headers).get('idempotency-key')).toBe('4c96d076-a80a-4b6c-8df6-f0db804b6f0a')
    const body = init?.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.getAll('attachments')).toHaveLength(1)
    const metadata = JSON.parse(await (body.get('metadata') as File).text()) as Record<string, unknown>
    expect(metadata).toEqual({
      consent: true,
      description: '上传后没有反馈',
      occurredAt: '2026-09-30T05:20:00.000Z',
      type: 'issue',
    })
  })

  it('decodes the receipt strictly and drops anything the Host should have stripped', () => {
    expect(decodeEnterpriseFeedbackReceipt(RECEIPT)).toEqual(RECEIPT)
    expect(() => decodeEnterpriseFeedbackReceipt({ ...RECEIPT, requestId: 'req_1' }))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterpriseFeedbackReceipt({ ...RECEIPT, status: 'archived' }))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterpriseFeedbackReceipt({ ...RECEIPT, attachmentCount: 4 }))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterpriseFeedbackReceipt({ ...RECEIPT, occurredAt: '2026-09-30 05:20:11' }))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
  })
})

describe('the help-and-feedback surface stays wired to the tree and to the shared wording', () => {
  const source = (name: string): Promise<string> =>
    readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')

  it('renders EnterpriseFeedbackDialog with the very state that opens it', async () => {
    const text = await source('account-menu.tsx')
    const opening = text.slice(text.indexOf('<EnterpriseFeedbackDialog'))
    expect(text).toContain('<EnterpriseFeedbackDialog')
    const element = opening.slice(0, opening.indexOf('/>'))
    expect(element).toContain('open={feedbackDialog.open}')
    expect(element).toContain('onClose={feedbackDialog.closeDialog}')
  })

  it('reuses the existing error-code wording map and adds no second one', async () => {
    const text = await source('feedback-dialog.tsx')
    expect(text).toContain('enterpriseErrorDisplay')
    expect(text).toContain('enterpriseErrorMessage')
    expect(text).not.toMatch(/const\s+\w*MESSAGES\s*[:=]/)
    expect(text).not.toContain('ENT_FEEDBACK_INVALID:')
  })

  it('never lets the browser author diagnostics and never submits while signed out', async () => {
    const text = await source('feedback-dialog.tsx')
    // 诊断事实由 Host 采集：界面只提交草稿，不写 diagnostics 键。
    expect(text).not.toMatch(/diagnostics\s*:/)
    expect(text).toContain('if (draft === undefined || !usable) return')
    // 未登录是可见结论，不是静默：弹窗内给先登录的引导语。
    expect(text).toContain('请先登录企业账号')
  })

  it('carries the screenshot paste path, the three-picture cap and the consent wording', async () => {
    const text = await source('feedback-dialog.tsx')
    expect(text).toContain('onPaste')
    expect(text).toContain("item.kind !== 'file'")
    expect(text).toContain('添加图片')
    expect(text).toContain('已选 {form.attachments.length} 张')
    expect(text).toContain('设备、版本、日志信息一并提交')
    expect(text).toContain('请描述遇到的问题与复现步骤')
    expect(text).toContain('邮箱或手机号，便于回访')
  })
})
