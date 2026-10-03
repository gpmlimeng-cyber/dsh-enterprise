/**
 * [INPUT]: 依赖 Cordis Context 的结构化只读读面（官方 `configEditor.entries()`、entry 的 runtime Config 与 settings 服务的能力位），不 import 官方实现
 * [OUTPUT]: 对外提供 `settingsDiagnostics`（owner entry 在官方 configEditor/schema 中的可见性快照）与 `thrownErrorDiagnostics`（异常 name/message/code/stack 摘要）
 * [POS]: platform-client 的地址写入诊断层，被 platform-service 与 bundle 的 Server/账户后台地址写入路径共用，只读探测、不改写入语义、不调用会广播的官方 `settings.describe()`
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from '@deepseek-ai/cordis'

const KNOWN_ENTRY_LIMIT = 12
const FIELD_LIMIT = 16
const STACK_LINE_LIMIT = 4

/** 官方 `ctx.configEditor.entries()` 行的窄视图；不依赖 loader 包的类型。 */
interface ConfigEditorRowView {
  /** entry 在整棵 Loader 树里的全局 id（嵌套 include 下形如 `include:dshent`）。 */
  readonly id?: unknown
  readonly options?: {
    readonly id?: unknown
    readonly name?: unknown
    readonly config?: unknown
  }
  readonly fiber?: {
    /** 官方 Fiber 状态；2 表示 ACTIVE（`dsh-settings` 只投影 state === 2 的 entry）。 */
    readonly state?: unknown
    readonly runtime?: { readonly name?: unknown, readonly Config?: unknown } | null
  } | null
}

interface ConfigEditorView {
  readonly entries?: () => readonly ConfigEditorRowView[]
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function joined(values: readonly string[]): string {
  if (values.length === 0) return '(none)'
  const shown = values.slice(0, FIELD_LIMIT)
  return values.length > shown.length ? `${shown.join(',')}+${values.length - shown.length}` : shown.join(',')
}

function objectKeys(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value) : []
}

/**
 * 从 schemastery Schema 的 `dict` 里读出声明为 volatile 的字段名。
 *
 * 官方 Loader（`Schema.resolve`）与 `SettingsForms.volatileForm()` 判定 volatile 的唯一依据就是
 * `schema.dict[key].meta.volatile`，因此这是「该字段能否被 `settings.update` 接受」的直接证据；
 * 相对地，调用官方 `describe()` 会按需广播 `settings/document-updated`，在失败路径上会反向触发
 * 我们自己的写回，故这里只做只读反射。
 *
 * @param row - 官方 configEditor 的 entry 行。
 * @returns 声明的字段名与其中标记为 volatile 的字段名。
 */
function schemaFieldNames(row: ConfigEditorRowView): { readonly fields: readonly string[], readonly volatile: readonly string[] } {
  const schema = row.fiber?.runtime?.Config
  const dict = isRecord(schema) ? Reflect.get(schema, 'dict') : undefined
  if (!isRecord(dict)) return { fields: [], volatile: [] }
  const fields = Object.keys(dict)
  const volatile = fields.filter(field => {
    const child = dict[field]
    const meta = isRecord(child) ? Reflect.get(child, 'meta') : undefined
    return isRecord(meta) && Reflect.get(meta, 'volatile') === true
  })
  return { fields, volatile }
}

/**
 * owner entry 在官方 configEditor 与 runtime Config 中的可见性快照。
 *
 * @param ctx - 组合层上下文；`configEditor` 缺席不是错误，如实记录即可。
 * @param entryId - 推导出的 settings 命名空间（= owner profile entry 的 options.id）。
 * @returns 单行、可 grep 的 `key=value` 串。
 */
export function entryDiagnostics(ctx: Context, entryId: string | undefined): string {
  const editor = ctx.get('configEditor') as ConfigEditorView | undefined
  const entries = typeof editor?.entries === 'function' ? editor.entries() : undefined
  if (entries === undefined) return `configEditor=absent entryId=${entryId ?? '(none)'}`
  const known = entries.map(row => text(row.options?.id)).filter((id): id is string => id !== undefined)
  const row = entryId === undefined ? undefined : entries.find(candidate => text(candidate.options?.id) === entryId)
  if (row === undefined) {
    return `configEditor=present entries=${known.length} known=[${joined(known.slice(0, KNOWN_ENTRY_LIMIT))}]`
      + ` target=missing entryId=${entryId ?? '(none)'}`
  }
  const { fields, volatile } = schemaFieldNames(row)
  return `configEditor=present target=present entryId=${entryId ?? '(none)'}`
    + ` globalId=${text(row.id) ?? '(unknown)'} name=${text(row.options?.name) ?? '(unnamed)'}`
    + ` runtime=${text(row.fiber?.runtime?.name) ?? '(unknown)'} active=${row.fiber?.state === 2}`
    + ` configKeys=[${joined(objectKeys(row.options?.config))}]`
    + ` schemaFields=[${joined(fields)}] volatileFields=[${joined(volatile)}]`
}

/**
 * settings 服务的可写能力位快照；只读属性名，不触发任何写入或广播。
 *
 * @param settings - 官方 settings 服务实例（可能缺席）。
 * @returns 单行能力串。
 */
export function settingsCapabilityDiagnostics(settings: unknown): string {
  const describe = isRecord(settings) ? typeof Reflect.get(settings, 'describe') : 'undefined'
  const update = isRecord(settings) ? typeof Reflect.get(settings, 'update') : 'undefined'
  const configure = isRecord(settings) ? typeof Reflect.get(settings, 'configure') : 'undefined'
  return `settings{describe=${String(describe)},update=${String(update)},configure=${String(configure)}}`
}

/**
 * 抛出/返回前的统一诊断串：entry 可见性 + settings 能力位。
 *
 * @param ctx - 组合层上下文。
 * @param entryId - 推导出的 settings 命名空间。
 * @param settings - 官方 settings 服务实例（可选）。
 * @returns 单行诊断串。
 */
export function settingsDiagnostics(ctx: Context, entryId: string | undefined, settings?: unknown): string {
  return `${entryDiagnostics(ctx, entryId)} ${settingsCapabilityDiagnostics(settings)}`
}

/**
 * 异常的定位摘要：name/message/code 与前若干行 stack。
 *
 * @param error - 被捕获的原始异常。
 * @returns 单行摘要；不含请求头、令牌或配置值。
 */
export function thrownErrorDiagnostics(error: unknown): string {
  if (typeof error !== 'object' || error === null) return `error=${String(error)}`
  const field = (key: string): unknown => Reflect.get(error, key)
  const frames = text(field('stack'))
  return `error{name=${text(field('name')) ?? '(unnamed)'},code=${text(field('code')) ?? '(none)'}`
    + `,message=${text(field('message')) ?? '(no message)'}`
    + `,stack=${frames === undefined ? '(no stack)' : frames.split('\n').slice(0, STACK_LINE_LIMIT).map(line => line.trim()).join(' | ')}}`
}
