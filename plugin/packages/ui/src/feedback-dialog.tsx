/**
 * [INPUT]: 依赖 React、Lucide 的 ImagePlus/LoaderCircle/X、Harness 共享 Modal/Button、account-state 的共享脱敏订阅与既有错误码文案、local-api 的反馈草稿/回执 DTO 与失败码投影
 * [OUTPUT]: 对外提供「帮助与反馈」弹窗 `EnterpriseFeedbackDialog`、开关控制器 `useEnterpriseFeedbackDialog`，以及表单纯投影（counter/occurredAt 显隐/魔数判型/附件与提交校验/draft 构造）
 * [POS]: dsh-ui 的个人中心反馈面板——字段与条件显隐照 feedback-feature-spec §1，提交经同源 `/enterprise/api/v1/local/feedback` 由 Host 代取令牌转交中心；浏览器不发 diagnostics（Host 采集），附件在本层先做类型/大小/张数预校验给出可见提示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ImagePlus, LoaderCircle, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  enterpriseErrorDisplay,
  enterpriseErrorMessage,
  enterpriseSessionUsable,
  useAccount,
} from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import {
  enterpriseLocalErrorCode,
  type EnterpriseFeedbackDraft,
  type EnterpriseFeedbackReceipt,
} from './local-api.js'

/** 契约字段上限（feedback-feature-spec §1 / §6）：描述 ≤510 字、附件 ≤3 张、单张 ≤2 MiB。 */
export const ENTERPRISE_FEEDBACK_DESCRIPTION_MAX = 510
export const ENTERPRISE_FEEDBACK_MAX_ATTACHMENTS = 3
export const ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024

export type EnterpriseFeedbackType = 'issue' | 'suggestion'
export type EnterpriseFeedbackImageKind = 'image/png' | 'image/jpeg' | 'image/webp'

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return bytes.length >= magic.length && magic.every((byte, index) => bytes[index] === byte)
}

/**
 * 按魔数判型，不看扩展名也不看 `File.type`（SVG 改名成 .png、或 Content-Type 谎报都拦得住）。
 * Host 侧会再判一次；这里的目的是尽早给员工可见提示，而不是替中心做校验。
 */
export function enterpriseFeedbackImageKind(bytes: Uint8Array): EnterpriseFeedbackImageKind | undefined {
  if (startsWith(bytes, PNG_MAGIC)) return 'image/png'
  if (startsWith(bytes, JPEG_MAGIC)) return 'image/jpeg'
  if (bytes.length >= 12
    && startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) return 'image/webp'
  return undefined
}

/** 描述计数：右下角恒显示「已输入 N/510」，超限也如实显示而不截断数字。 */
export function enterpriseFeedbackCounterText(length: number): string {
  return `已输入 ${length}/${ENTERPRISE_FEEDBACK_DESCRIPTION_MAX}`
}

/** `occurredAt` 是条件字段：仅问题态出现；切到建议时隐藏且不提交。 */
export function enterpriseFeedbackOccurredAtVisible(type: EnterpriseFeedbackType): boolean {
  return type === 'issue'
}

/** `datetime-local` 需要本地挂钟字符串；展示用，不参与提交。 */
export function enterpriseFeedbackLocalDateTime(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 本地挂钟 → 契约要求的 ISO-8601 带时区（`toISOString()` 的 Z 即权威偏移）；不可解析时不提交。 */
export function enterpriseFeedbackOccurredAtIso(local: string): string | undefined {
  if (local === '') return undefined
  const at = new Date(local)
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString()
}

/**
 * 附件缩略图：为已选文件建立对象 URL，并在卸载或文件替换时释放。
 *
 * 预览是"看得见的确认"——用户能一眼核对是否选对了截图；组件随列表项卸载即回收，不泄漏对象 URL。
 */
function AttachmentThumb({ file, name }: { readonly file: File; readonly name: string }): ReactNode {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => { URL.revokeObjectURL(next) }
  }, [file])
  return url === undefined
    ? <span aria-hidden className="own-feedback-thumb" />
    : <img alt={`${name} 预览`} className="own-feedback-thumb" src={url} />
}

/** 已选附件：保留原始 `File` 以便原样提交，另存界面要显示的名字与大小。 */
export interface EnterpriseFeedbackAttachment {
  readonly file: File
  readonly name: string
  readonly size: number
}

export interface EnterpriseFeedbackFormState {
  readonly type: EnterpriseFeedbackType
  readonly description: string
  /** `datetime-local` 的本地挂钟值；仅问题态提交。 */
  readonly occurredAt: string
  readonly contact: string
  readonly consent: boolean
  readonly attachments: readonly EnterpriseFeedbackAttachment[]
}

/** 打开弹窗时的初始表单：默认问题、时间默认当前时刻、未同意、无附件。 */
export function enterpriseFeedbackInitialState(now: Date): EnterpriseFeedbackFormState {
  return {
    type: 'issue',
    description: '',
    occurredAt: enterpriseFeedbackLocalDateTime(now),
    contact: '',
    consent: false,
    attachments: [],
  }
}

/**
 * 单个候选附件的本地预校验；返回中心同名的错误码，或 undefined 表示可以加入。
 *
 * 顺序与中心一致：张数 → 大小 → 魔数。`bytes` 缺席（读不到文件头）按类型不符处理。
 */
export function enterpriseFeedbackAttachmentRejection(
  candidate: { readonly size: number },
  bytes: Uint8Array | undefined,
  selected: number,
): string | undefined {
  if (selected >= ENTERPRISE_FEEDBACK_MAX_ATTACHMENTS) return 'ENT_FEEDBACK_ATTACHMENT_INVALID'
  if (candidate.size > ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES) return 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE'
  if (bytes === undefined || enterpriseFeedbackImageKind(bytes) === undefined) {
    return 'ENT_FEEDBACK_ATTACHMENT_INVALID'
  }
  return undefined
}

/** 提交前置条件：描述 1..510、已同意、附件不超过 3 张。 */
export function enterpriseFeedbackSubmittable(state: EnterpriseFeedbackFormState): boolean {
  const length = state.description.trim().length
  return length >= 1 && length <= ENTERPRISE_FEEDBACK_DESCRIPTION_MAX
    && state.consent
    && state.attachments.length <= ENTERPRISE_FEEDBACK_MAX_ATTACHMENTS
}

/** 提交按钮的禁用判定；未同意或缺描述时按钮就在原位禁用，不静默吞掉点击。 */
export function enterpriseFeedbackSubmitDisabled(state: EnterpriseFeedbackFormState): boolean {
  return !enterpriseFeedbackSubmittable(state)
}

/**
 * 表单 → 提交草稿。
 *
 * 两处契约约束在纯函数里固化：建议态不带 `occurredAt`（隐藏即不提交），空白联系人不产生字段；
 * `diagnostics` 不在这里出现——它是 Host 采集的权威事实。未满足提交条件时返回 undefined。
 */
export function enterpriseFeedbackDraft(state: EnterpriseFeedbackFormState): EnterpriseFeedbackDraft | undefined {
  if (!enterpriseFeedbackSubmittable(state)) return undefined
  const occurredAt = enterpriseFeedbackOccurredAtVisible(state.type)
    ? enterpriseFeedbackOccurredAtIso(state.occurredAt)
    : undefined
  const contact = state.contact.trim()
  return {
    type: state.type,
    description: state.description,
    consent: true,
    attachments: state.attachments.map(attachment => attachment.file),
    ...(occurredAt === undefined ? {} : { occurredAt }),
    ...(contact === '' ? {} : { contact }),
  }
}

export interface EnterpriseFeedbackDialogController {
  readonly open: boolean
  readonly openDialog: () => void
  readonly closeDialog: () => void
}

/**
 * 弹窗开关的唯一持有者。开关必须与弹窗元素在同一棵树里（组件在 account-menu 中渲染），
 * 否则「帮助与反馈」会表现为点击静默无反应。
 */
export function useEnterpriseFeedbackDialog(): EnterpriseFeedbackDialogController {
  const [open, setOpen] = useState(false)
  const openDialog = useCallback(() => { setOpen(true) }, [])
  const closeDialog = useCallback(() => { setOpen(false) }, [])
  return { open, openDialog, closeDialog }
}

/** 提交的四个互斥状态；成功态带中心回执，失败态只带受控错误码。 */
export type EnterpriseFeedbackDialogState =
  | { readonly kind: 'form' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'success'; readonly receipt: EnterpriseFeedbackReceipt }
  | { readonly kind: 'failed'; readonly errorCode: string }

/** 弹窗自持排版；官方 Modal 给外框与键盘，几何与颜色用官方 token 声明并带中性兜底。 */
const FEEDBACK_STYLES = `
      [role="dialog"]:has(.own-feedback-body) { box-sizing: border-box; max-height: calc(100vh - 48px); width: min(560px, calc(100vw - 48px)); }
      .own-feedback-content { min-height: 0; overflow-y: auto; }
      .own-feedback-body { display: flex; flex-direction: column; gap: 16px; }
      .own-feedback-field { display: flex; flex-direction: column; gap: 6px; margin: 0; }
      .own-feedback-label { color: var(--dsw-alias-label-primary, #101828); font-size: 13px; font-weight: 500; line-height: 20px; }
      .own-feedback-required { color: var(--dsw-alias-status-error, #c4320a); margin-left: 2px; }
      .own-feedback-hint { color: var(--dsw-alias-label-tertiary, #667085); font-size: 12px; line-height: 18px; margin: 0; }
      .own-feedback-error { color: var(--dsw-alias-status-error, #c4320a); font-size: 13px; line-height: 20px; margin: 0; }
      .own-feedback-success { color: var(--dsw-alias-state-success-primary, #16803c); font-size: 13px; line-height: 20px; margin: 0; }
      .own-feedback-radios { display: flex; gap: 20px; }
      .own-feedback-radio { align-items: center; color: var(--dsw-alias-label-primary, #101828); display: inline-flex; font-size: 13px; gap: 6px; line-height: 20px; }
      .own-feedback-textarea, .own-feedback-input { background: var(--dsw-alias-bg-layer-1, #ffffff); border: 1px solid var(--dsw-alias-border-l2, #d0d5dd); border-radius: var(--dsw-radius-md, 8px); box-sizing: border-box; color: var(--dsw-alias-label-primary, #101828); font: inherit; font-size: 13px; line-height: 20px; padding: 8px 10px; width: 100%; }
      .own-feedback-textarea { min-height: 96px; resize: vertical; }
      .own-feedback-textarea:focus-visible, .own-feedback-input:focus-visible { border-color: var(--dsw-alias-state-business-primary, #4d6bfe); outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: 1px; }
      .own-feedback-counter { color: var(--dsw-alias-label-tertiary, #667085); font-size: 12px; line-height: 18px; text-align: right; }
      .own-feedback-counter[data-over='true'] { color: var(--dsw-alias-status-error, #c4320a); }
      .own-feedback-consent { align-items: flex-start; color: var(--dsw-alias-label-primary, #101828); display: flex; font-size: 13px; gap: 8px; line-height: 20px; }
      .own-feedback-attachments { display: flex; flex-direction: column; gap: 6px; list-style: none; margin: 8px 0 0; padding: 0; }
      .own-feedback-attachment { align-items: center; display: flex; gap: 8px; font-size: 13px; line-height: 20px; }
      .own-feedback-thumb { background: var(--dsw-alias-fill-secondary, #f2f4f7); border-radius: 6px; flex: none; height: 40px; object-fit: cover; width: 40px; }
      .own-feedback-attachment-name { color: var(--dsw-alias-label-primary, #101828); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .own-feedback-attachment-size { color: var(--dsw-alias-label-tertiary, #667085); font-size: 12px; }
      .own-feedback-remove { align-items: center; background: transparent; border: 0; color: var(--dsw-alias-label-tertiary, #667085); cursor: pointer; display: inline-flex; padding: 2px; }
      .own-feedback-remove:hover { color: var(--dsw-alias-status-error, #c4320a); }
      .own-feedback-spin { animation: own-feedback-rotate 1s linear infinite; }
      @keyframes own-feedback-rotate { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .own-feedback-spin { animation: none; } }
`

const footerStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }
const BODY_CLASS = 'own-feedback-body'

/** 附件大小按 KiB/MiB 显示；界面不出现原始字节数。 */
function sizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
  return `${Math.max(1, Math.round(bytes / 1024))} KiB`
}

/** 读取文件头 16 字节做魔数判型；读取失败按「无法识别」处理，不抛出。 */
async function sampleBytes(file: File): Promise<Uint8Array | undefined> {
  try {
    return new Uint8Array(await file.slice(0, 16).arrayBuffer())
  } catch {
    return undefined
  }
}

export interface EnterpriseFeedbackDialogProps {
  readonly store: EnterpriseAccountStore
  readonly open: boolean
  readonly onClose: () => void
}

/**
 * 「帮助与反馈」弹窗：表单、附件、同意与三态都在这里，关闭即中止在途提交。
 *
 * 未登录时不发请求，弹窗内直接给「先登录」的引导语（该菜单行任何登录态都可见，不静默）；
 * 提交中用官方进度图标禁用两个按钮；成功给明确成功态与反馈编号；失败走 account-state 既有中文文案。
 */
export function EnterpriseFeedbackDialog(props: EnterpriseFeedbackDialogProps): ReactNode {
  const snapshot = useAccount(props.store)
  const usable = enterpriseSessionUsable(snapshot.status?.state)
  const [form, setForm] = useState<EnterpriseFeedbackFormState>(() => enterpriseFeedbackInitialState(new Date()))
  const [dialog, setDialog] = useState<EnterpriseFeedbackDialogState>({ kind: 'form' })
  const [attachmentNotice, setAttachmentNotice] = useState<string | undefined>(undefined)
  const bodyRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef(props.onClose)
  const pending = useRef<AbortController | undefined>(undefined)
  /** 一次草稿一个幂等键：失败后重试复用同一个键，中心据此返回既有反馈而不新建行。 */
  const idempotencyKey = useRef<string | undefined>(undefined)

  useEffect(() => { closeRef.current = props.onClose }, [props.onClose])
  // 每次打开都回到干净表单并换一个新的幂等键；关闭即中止在途提交，迟到结果不再回填。
  useEffect(() => {
    if (!props.open) return
    setForm(enterpriseFeedbackInitialState(new Date()))
    setDialog({ kind: 'form' })
    setAttachmentNotice(undefined)
    idempotencyKey.current = undefined
    return () => { pending.current?.abort() }
  }, [props.open])
  // 官方 Modal 已给初始焦点、Tab 与遮罩关闭；这里只隔离外层 Settings 的 Escape，与本包其它弹窗同一处理。
  useEffect(() => {
    if (!props.open) return
    const root = bodyRef.current?.closest<HTMLElement>('[role="dialog"]')
    if (root === null || root === undefined) return
    const onKeyDown = (event: KeyboardEvent): void => {
      event.stopPropagation()
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current() }
    }
    root.addEventListener('keydown', onKeyDown)
    return () => { root.removeEventListener('keydown', onKeyDown) }
  }, [props.open])

  const update = (patch: Partial<EnterpriseFeedbackFormState>): void => {
    setForm(current => ({ ...current, ...patch }))
  }

  /** 加入候选附件：逐个做张数/大小/魔数预校验，被拒的给可见提示，通过的按序累积。 */
  const addAttachments = useCallback(async (candidates: readonly File[]): Promise<void> => {
    if (candidates.length === 0) return
    let selected = form.attachments.length
    const accepted: EnterpriseFeedbackAttachment[] = []
    let rejection: string | undefined
    for (const file of candidates) {
      const code = enterpriseFeedbackAttachmentRejection(file, await sampleBytes(file), selected)
      if (code === undefined) {
        accepted.push({ file, name: file.name === '' ? '粘贴的截图' : file.name, size: file.size })
        selected += 1
      } else {
        rejection ??= code
      }
    }
    if (accepted.length > 0) setForm(current => ({ ...current, attachments: [...current.attachments, ...accepted] }))
    setAttachmentNotice(rejection === undefined ? undefined : enterpriseErrorMessage(rejection))
  }, [form.attachments.length])

  /** 直接粘贴截图：只接管带图片的粘贴，纯文本粘贴仍落进当前输入框。 */
  const onPaste = (event: ClipboardEvent<HTMLDivElement>): void => {
    const items = event.clipboardData?.items
    if (items === undefined) return
    const files: File[] = []
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      if (item === undefined || item.kind !== 'file' || !item.type.startsWith('image/')) continue
      const file = item.getAsFile()
      if (file !== null) files.push(file)
    }
    if (files.length === 0) return
    event.preventDefault()
    void addAttachments(files)
  }

  const onPick = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void addAttachments(files)
  }

  const submit = (): void => {
    const draft = enterpriseFeedbackDraft(form)
    if (draft === undefined || !usable) return
    const request = new AbortController()
    pending.current = request
    idempotencyKey.current ??= crypto.randomUUID()
    setDialog({ kind: 'submitting' })
    void (async () => {
      try {
        const receipt = await props.store.api.submitFeedback(draft, request.signal, idempotencyKey.current)
        if (!request.signal.aborted) setDialog({ kind: 'success', receipt })
      } catch (error) {
        if (!request.signal.aborted) {
          setDialog({ kind: 'failed', errorCode: enterpriseLocalErrorCode(error) })
        }
      }
    })()
  }

  const busy = dialog.kind === 'submitting'
  const done = dialog.kind === 'success'
  const errorDisplay = dialog.kind === 'failed' ? enterpriseErrorDisplay(dialog.errorCode) : undefined
  const overLimit = form.description.length > ENTERPRISE_FEEDBACK_DESCRIPTION_MAX
  const footer = done
    ? <Button onClick={props.onClose}>完成</Button>
    : <div style={footerStyle}>
      <Button disabled={busy} onClick={props.onClose} variant="outline">取消</Button>
      <Button
        disabled={busy || !usable || enterpriseFeedbackSubmitDisabled(form)}
        onClick={submit}
      >
        {busy ? <><LoaderCircle aria-hidden className="own-feedback-spin" size={14} />正在提交…</> : '提交'}
      </Button>
    </div>
  return <Modal
    closeLabel="关闭"
    contentClassName="own-feedback-content"
    description="问题与建议会提交给企业管理员，需登录企业账号"
    footer={footer}
    onClose={props.onClose}
    open={props.open}
    title="帮助与反馈"
  >
    <div className={BODY_CLASS} onPaste={onPaste} ref={bodyRef}>
      <style>{FEEDBACK_STYLES}</style>
      {!usable
        ? <p className="own-feedback-hint">请先登录企业账号，登录后即可提交反馈。</p>
        : null}
      {usable && dialog.kind === 'success'
        ? <p className="own-feedback-success" role="status">
          反馈已提交（编号 {dialog.receipt.id}），已收到 {dialog.receipt.attachmentCount} 张图片。
        </p>
        : null}
      {usable && !done
        ? <>
          <fieldset className="own-feedback-field" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="own-feedback-label">反馈类型</legend>
            <div className="own-feedback-radios">
              <label className="own-feedback-radio">
                <input
                  checked={form.type === 'issue'}
                  disabled={busy}
                  name="enterprise-feedback-type"
                  onChange={() => { update({ type: 'issue' }) }}
                  type="radio"
                />问题
              </label>
              <label className="own-feedback-radio">
                <input
                  checked={form.type === 'suggestion'}
                  disabled={busy}
                  name="enterprise-feedback-type"
                  onChange={() => { update({ type: 'suggestion' }) }}
                  type="radio"
                />建议
              </label>
            </div>
          </fieldset>
          {enterpriseFeedbackOccurredAtVisible(form.type)
            ? <label className="own-feedback-field">
              <span className="own-feedback-label">发生时间</span>
              <input
                className="own-feedback-input"
                disabled={busy}
                onChange={event => { update({ occurredAt: event.target.value }) }}
                type="datetime-local"
                value={form.occurredAt}
              />
            </label>
            : null}
          <div className="own-feedback-field">
            <label className="own-feedback-label" htmlFor="own-feedback-description">
              问题描述<span aria-hidden className="own-feedback-required">*</span>
            </label>
            <textarea
              className="own-feedback-textarea"
              disabled={busy}
              id="own-feedback-description"
              maxLength={ENTERPRISE_FEEDBACK_DESCRIPTION_MAX}
              onChange={event => { update({ description: event.target.value }) }}
              placeholder="请描述遇到的问题与复现步骤"
              value={form.description}
            />
            <span className="own-feedback-counter" data-over={overLimit ? 'true' : 'false'}>
              {enterpriseFeedbackCounterText(form.description.length)}
            </span>
          </div>
          <label className="own-feedback-field">
            <span className="own-feedback-label">联系方式</span>
            <input
              className="own-feedback-input"
              disabled={busy}
              onChange={event => { update({ contact: event.target.value }) }}
              placeholder="邮箱或手机号，便于回访"
              type="text"
              value={form.contact}
            />
          </label>
          <div className="own-feedback-field">
            <span className="own-feedback-label">添加图片</span>
            <div>
              <Button disabled={busy || form.attachments.length >= ENTERPRISE_FEEDBACK_MAX_ATTACHMENTS} onClick={() => { fileRef.current?.click() }} variant="outline">
                <ImagePlus aria-hidden size={14} />添加图片
              </Button>
              <input
                accept="image/png,image/jpeg,image/webp"
                hidden
                multiple
                onChange={onPick}
                ref={fileRef}
                type="file"
              />
            </div>
            <p className="own-feedback-hint">已选 {form.attachments.length} 张（最多 3 张，可直接粘贴截图）</p>
            {attachmentNotice === undefined
              ? null
              : <p className="own-feedback-error" role="alert">{attachmentNotice}</p>}
            {form.attachments.length === 0
              ? null
              : <ul className="own-feedback-attachments">
                {form.attachments.map(attachment => <li className="own-feedback-attachment" key={`${attachment.name}-${attachment.size}-${attachment.file.lastModified}`}>
                  <AttachmentThumb file={attachment.file} name={attachment.name} />
                  <span className="own-feedback-attachment-name" title={attachment.name}>{attachment.name}</span>
                  <span className="own-feedback-attachment-size">{sizeText(attachment.size)}</span>
                  <button
                    aria-label={`移除 ${attachment.name}`}
                    className="own-feedback-remove"
                    disabled={busy}
                    onClick={() => {
                      setForm(current => ({
                        ...current,
                        attachments: current.attachments.filter(candidate => candidate !== attachment),
                      }))
                    }}
                    type="button"
                  ><X aria-hidden size={14} /></button>
                </li>)}
              </ul>}
          </div>
          <label className="own-feedback-consent">
            <input
              checked={form.consent}
              disabled={busy}
              onChange={event => { update({ consent: event.target.checked }) }}
              type="checkbox"
            />
            <span>我同意将内容与设备、版本、日志信息一并提交，用于定位问题。</span>
          </label>
          {errorDisplay === undefined
            ? null
            : <p className="own-feedback-error" role="alert">
              {errorDisplay.message}{errorDisplay.code === undefined ? null : `（${errorDisplay.code}）`}
            </p>}
        </>
        : null}
    </div>
  </Modal>
}
