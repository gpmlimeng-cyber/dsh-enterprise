/**
 * [INPUT]: 依赖两个纯事实层 `skill-import`（accept / 50 MiB / 弹窗文案与形态翻译）与 `skill-import-queue`
 *   （四态队列的全部投影），`skill-import-dialog` 的三枚**无 hook**纯视图，唯一码表 `error-messages`，
 *   以及 `node:fs`（源码级反向锁：读 `src/**` 的**代码**文本）
 * [OUTPUT]: 验证口径 60（导入弹窗 · 纯 UI）的八条硬判据：① 多选按选择顺序入队且**串行**（至多一项在装）；
 *   ② **单项失败不中断其余**；③ 批量摘要句逐字（含 0 失败 / 全失败两档）；④ **装中禁关**（判据为真时关闭被拒）；
 *   ⑤ 成功 ⇒ 关闭与 toast **各恰好一处出口**（且成功文案复用既有那句）；⑥ 全部预失败 ⇒ 直接返回不干活；
 *   ⑦ 文案与 Host 真源同源（accept 派生形态 + 唯一的 50 MiB 常量；反向锁：全 src 不许出现 Cherry 的限额）；
 *   ⑧ 反向锁（无目录导入 / 无新增依赖 / 唯一上传器 / 既有单件通路与商城页一字未动）
 * [POS]: 本刀（口径 60）的机械门禁。本仓 vitest **没有 DOM**，故本文件一条渲染测试都不写：
 *   队列状态机、逐项状态迁移、摘要文案、"装中能否关闭"的判据全部落在**纯函数**上直测，
 *   界面那一层只验"纯视图交出来的东西"（元素 props）与"源码里只有哪些出口"。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { enterpriseErrorMessage } from '../src/error-messages.js'
import {
  EnterpriseSkillImportBatchSummary,
  EnterpriseSkillImportDropzone,
  EnterpriseSkillImportQueueList,
  EnterpriseSkillImportView,
} from '../src/skill-import-dialog.js'
import {
  ENTERPRISE_SKILL_IMPORT_ACCEPT,
  ENTERPRISE_SKILL_IMPORT_ARCHIVE_NAME,
  ENTERPRISE_SKILL_IMPORT_DIALOG_SUBTITLE,
  ENTERPRISE_SKILL_IMPORT_DIALOG_TITLE,
  ENTERPRISE_SKILL_IMPORT_DONE,
  ENTERPRISE_SKILL_IMPORT_DROP_HINT,
  ENTERPRISE_SKILL_IMPORT_FORMATS_TEXT,
  ENTERPRISE_SKILL_IMPORT_FORMAT_NAMES,
  ENTERPRISE_SKILL_IMPORT_INPUT_LABEL,
  ENTERPRISE_SKILL_IMPORT_MAX_BYTES,
  ENTERPRISE_SKILL_IMPORT_MAX_TEXT,
  ENTERPRISE_SKILL_IMPORT_PICK_ARIA,
  ENTERPRISE_SKILL_IMPORT_PICK_LABEL,
  ENTERPRISE_SKILL_IMPORT_RESELECT,
  ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL,
  ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE,
  enterpriseSkillImportFormatNames,
  enterpriseSkillImportLabel,
  enterpriseSkillImportNotice,
} from '../src/skill-import.js'
import {
  ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE,
  enterpriseSkillImportItemStatusText,
  enterpriseSkillImportQueueClosable,
  enterpriseSkillImportQueueCounts,
  enterpriseSkillImportQueueOf,
  enterpriseSkillImportQueueOutcome,
  enterpriseSkillImportQueueSettle,
  enterpriseSkillImportQueueStart,
  enterpriseSkillImportQueueSummary,
  type EnterpriseSkillImportItem,
  type EnterpriseSkillImportQueue,
} from '../src/skill-import-queue.js'

/**
 * 官方原语包在本仓**不可直接加载**（它依赖的 `clsx` 没进本包依赖树），既有 ui 测试一律 mock 掉它。
 *
 * 本文件只直调**无 hook 的纯视图**（弹窗外壳 `Modal` 与 `Toast` 一枚都不渲染），故这个 mock 的唯一
 * 职责是让模块图加载得起来 —— 与 `esc.spec.ts` 那条同源（那里 mock 的是它真正取到的那几枚导出）。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Modal: vi.fn(),
  Toast: vi.fn(),
}))

/* ────────────────────────── 取证脚手架（纯文本，无 DOM） ────────────────────────── */

/** 一件文件只要 `name`/`size` 两件事实（`File` 天然满足；这里给一份最小真实形状）。 */
function file(name: string, size: number): { readonly name: string; readonly size: number } {
  return { name, size }
}

/** 剥注释：源码级判据只看**代码**——注释里为了记录"我们没照抄什么"而提到某个 API/数字，不算使用。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//')
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')
}

/** 读 `src/` 下某一个文件（相对 `src` 的路径）。 */
function readSrc(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
}

/** 递归读全 `src/**` 的 `.ts`/`.tsx`（文件名 → **剥注释后**的代码文本）。 */
function sources(): ReadonlyMap<string, string> {
  const out = new Map<string, string>()
  const walk = (dir: URL, prefix: string): void => {
    for (const name of readdirSync(dir)) {
      const child = new URL(name, dir)
      if (statSync(child).isDirectory()) {
        walk(new URL(`${name}/`, dir), `${prefix}${name}/`)
        continue
      }
      if (/\.tsx?$/.test(name)) out.set(`${prefix}${name}`, stripComments(readFileSync(child, 'utf8')))
    }
  }
  walk(new URL('../src/', import.meta.url), '')
  return out
}

/** 一个源文件的 import 说明符（裸包名 / 相对路径都原样给）。 */
function importSpecifiers(source: string): readonly string[] {
  return [...source.matchAll(/from\s+'([^']+)'/g)].flatMap(match => (match[1] === undefined ? [] : [match[1]]))
}

/** 元素形状（与 esc.spec 同一套：`createElement` 的产物就是 `{type, props}`）。 */
interface Element { readonly type: unknown; readonly props: Record<string, unknown> }

const childrenOf = (element: Element): readonly unknown[] => {
  const children = element.props['children']
  return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
}

const walk = (node: unknown, out: Element[] = []): Element[] => {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const each of node) walk(each, out)
    return out
  }
  const element = node as Element
  out.push(element)
  for (const each of childrenOf(element)) walk(each, out)
  return out
}

/** 一棵（纯视图）子树里的**可见字符串**（逐项状态句、提示句都靠它取证）。 */
const textsOf = (node: unknown): readonly string[] =>
  walk(node).flatMap(element => {
    const children = element.props['children']
    if (typeof children === 'string') return [children]
    return Array.isArray(children) ? children.filter((each): each is string => typeof each === 'string') : []
  })

/** 一棵（纯视图）子树里取第一枚带某属性的元素。 */
const byProp = (node: unknown, prop: string): Element | undefined =>
  walk(node).find(element => element.props[prop] !== undefined)

/**
 * **纯驱动器**：按 `useEnterpriseSkillImportQueue` 那两拍（交棒 → 收束）把一批文件跑完。
 *
 * ★它顺带把"串行"这条判据**逐步**钉住：每一步交棒前后都数一遍 `installing` 的项数
 *   （交棒前 0、交棒后恰好 1）——并行那档在这一层就写不出来。
 */
function drain(
  files: readonly { readonly name: string; readonly size: number }[],
  verdict: (name: string) => 'ok' | 'fail',
): { readonly queue: EnterpriseSkillImportQueue; readonly visited: readonly string[] } {
  let queue = enterpriseSkillImportQueueOf(files)
  const visited: string[] = []
  let guard = 0
  while (queue.active !== undefined) {
    if (guard >= 32) throw new Error('队列没有收敛（驱动器坏了）')
    guard += 1
    const index = queue.active
    const item = queue.items[index]!
    expect(queue.items.filter(each => each.status === 'installing'), `交棒前 ${item.name}`).toHaveLength(0)
    queue = enterpriseSkillImportQueueStart(queue, index)
    // ★串行：交棒之后**恰好**一项在装（不是两项、也不是零项）
    expect(queue.items.filter(each => each.status === 'installing'), `交棒后 ${item.name}`).toHaveLength(1)
    visited.push(item.name)
    queue = enterpriseSkillImportQueueSettle(queue, index, verdict(item.name) === 'ok'
      ? { kind: 'success', names: [`${item.name}-skill`], listed: true }
      : { kind: 'failed', code: 'ENT_SKILL_UPLOAD_INVALID' })
  }
  expect(queue.items.filter(each => each.status === 'installing')).toHaveLength(0)
  return { queue, visited }
}

/* ────────────────────────── ① 串行 + 选择顺序 ────────────────────────── */

describe('口径 60：队列状态机（纯投影，无 DOM 直测）', () => {
  it('① 多选按**选择顺序**入队，且任何时刻至多一项在装（串行）', () => {
    const files = [file('a.dshskill', 10), file('b.dshskill', 20), file('c.dshskill', 30)]
    const queued = enterpriseSkillImportQueueOf(files)
    // 顺序 = 用户的选择顺序（id 只做 React key，不参与排序）
    expect(queued.items.map(item => item.name)).toEqual(['a.dshskill', 'b.dshskill', 'c.dshskill'])
    expect(queued.items.map(item => item.status)).toEqual(['pending', 'pending', 'pending'])
    expect(queued.active).toBe(0)
    const { queue, visited } = drain(files, () => 'ok')
    expect(visited).toEqual(['a.dshskill', 'b.dshskill', 'c.dshskill'])
    expect(queue.items.map(item => item.status)).toEqual(['success', 'success', 'success'])
    expect(queue.active).toBeUndefined()
    // ★反向锁（串行的构造性证据）：交棒**只碰当前项**，`active` 不动、后面的项仍是 `pending`
    const started = enterpriseSkillImportQueueStart(queued, 0)
    expect(started.active).toBe(0)
    expect(started.items[1]!.status).toBe('pending')
    expect(started.items[2]!.status).toBe('pending')
    // 状态迁移单向：已交棒过的项不许被再交棒一次（否则就是同一项装两遍）
    expect(enterpriseSkillImportQueueStart(started, 0)).toBe(started)
    // 收束只认**在途**那一项：没交棒过的项交结果给它，队列原样不动（不会凭空把它标成成功/失败）
    expect(enterpriseSkillImportQueueSettle(queued, 0, { kind: 'success', names: [], listed: true })).toBe(queued)
  })

  /* ────────────────────────── ② 单项失败不中断 ────────────────────────── */

  it('② 单项失败**不中断**其余：中间那一项失败，第三项照样被处理', () => {
    const files = [file('good-1.dshskill', 10), file('bad.dshskill', 20), file('good-2.dshskill', 30)]
    const { queue, visited } = drain(files, name => (name === 'bad.dshskill' ? 'fail' : 'ok'))
    // ★判据是"第三项**被访问过**"——只断言最终状态的话，"失败即中断"也能蒙过去（那会剩 pending）
    expect(visited).toEqual(['good-1.dshskill', 'bad.dshskill', 'good-2.dshskill'])
    expect(queue.items.map(item => item.status)).toEqual(['success', 'failed', 'success'])
    expect(queue.items[1]!.code).toBe('ENT_SKILL_UPLOAD_INVALID')
    // 失败没把队列卡死：收束后没有待处理项（那一项也不是 `installing`）
    expect(queue.active).toBeUndefined()
    expect(queue.attempted).toBe(3)
  })

  /* ────────────────────────── ③ 批量摘要逐字 ────────────────────────── */

  it('③ 批量摘要句**逐字**（含 0 失败与全失败两档）', () => {
    // 0 失败 ⇒ 没有摘要句（这一档由「全成功 ⇒ toast + 关窗」接管）
    const allOk = drain([file('a.dshskill', 1), file('b.dshskill', 2)], () => 'ok').queue
    expect(enterpriseSkillImportQueueCounts(allOk)).toEqual({ failed: 0, success: 2, total: 2 })
    expect(enterpriseSkillImportQueueSummary(allOk)).toBeUndefined()
    // 部分失败 ⇒ 逐字（段序：失败 / 成功 / 共）
    const partial = drain([file('a.dshskill', 1), file('b.dshskill', 2)], name => (name === 'b.dshskill' ? 'fail' : 'ok')).queue
    expect(enterpriseSkillImportQueueSummary(partial)).toBe('失败 1 / 成功 1 / 共 2')
    // 全失败 ⇒ 同一套拼法（不特判、不换格式），这一档三枚计数都要对
    const allBad = drain([file('a', 1), file('b', 2), file('c', 3)], () => 'fail').queue
    expect(enterpriseSkillImportQueueCounts(allBad)).toEqual({ failed: 3, success: 0, total: 3 })
    expect(enterpriseSkillImportQueueSummary(allBad)).toBe('失败 3 / 成功 0 / 共 3')
    // 单项失败不出摘要句（那一项的错误已经在逐项行上说清楚了）
    const single = drain([file('a', 1)], () => 'fail').queue
    expect(enterpriseSkillImportQueueSummary(single)).toBeUndefined()
    expect(enterpriseSkillImportQueueSummary(ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE)).toBeUndefined()
  })

  /* ────────────────────────── ④ 装中禁关 ────────────────────────── */

  it('④ 装中禁关：判据为真时**关闭请求被拒**（排队中、进行中都算装中）', () => {
    const queued = enterpriseSkillImportQueueOf([file('a.dshskill', 1), file('b.dshskill', 2)])
    // 排队中（第一项还没交棒）：队列已经列在界面上，这时关窗等于丢掉进度 ⇒ 不许关
    expect(enterpriseSkillImportQueueClosable(queued)).toBe(false)
    const started = enterpriseSkillImportQueueStart(queued, 0)
    expect(enterpriseSkillImportQueueClosable(started)).toBe(false)
    // 第一项装完、第二项还在排队 ⇒ 仍不许关
    const half = enterpriseSkillImportQueueSettle(started, 0, { kind: 'success', names: [], listed: true })
    expect(half.items[0]!.status).toBe('success')
    expect(half.active).toBe(1)
    expect(enterpriseSkillImportQueueClosable(half)).toBe(false)
    // 全部跑完 ⇒ 可以关（第二项先交棒、再收束 —— 与真实驱动器同一顺序）
    const startedSecond = enterpriseSkillImportQueueStart(half, 1)
    const done = enterpriseSkillImportQueueSettle(startedSecond, 1, { kind: 'success', names: [], listed: true })
    expect(done.active).toBeUndefined()
    expect(enterpriseSkillImportQueueClosable(done)).toBe(true)
    // 空队列 / 全部预失败（一个字节都没发出去）都可以关：错误在逐项行上，不该把人锁在窗里
    expect(enterpriseSkillImportQueueClosable(ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE)).toBe(true)
    expect(enterpriseSkillImportQueueClosable(
      enterpriseSkillImportQueueOf([file('huge.dshskill', ENTERPRISE_SKILL_IMPORT_MAX_BYTES + 1)]),
    )).toBe(true)
    // ★行为侧的另一半：**关闭请求先问判据、再放行**。官方 Modal 的遮罩点击 / Esc / 右上角关闭按钮
    //   三条路都走同一个 `onClose` ⇒ 一处早退就拦住三条（不必另接键盘监听）；这里把"判据在场 +
    //   它真的被用来早退"钉在源码上（判据在纯函数那一半已经逐档测过）。
    const drawer = stripComments(readSrc('skill-import-dialog.tsx'))
    expect(drawer).toContain('if (!enterpriseSkillImportQueueClosable(queue)) return')
    expect(drawer).toContain('onClose: close,')
    // 拖拽区与那枚按钮在装中也一起闭掉（否则"装中"只是关不掉窗，却还能再塞一批进来）；
    // `enqueue` 自己也有一道闸（判据同源：`enterpriseSkillImportQueueClosable` 的反面）。
    expect(drawer).toContain('const busy = !enterpriseSkillImportQueueClosable(queue)')
    expect(stripComments(readSrc('skill-import-port.tsx'))).toContain('if (busy || files.length === 0) return')
  })

  /* ────────────────────────── ⑤ 成功 ⇒ 关闭 + toast ────────────────────────── */

  it('⑤ 成功 ⇒ toast + 自动关闭**各恰好一处出口**（且成功文案复用既有那句）', () => {
    // 单项成功：toast 就是**既有**那枚投影的 `done` 句（一个字都没在队列里新写）
    const one = drain([file('one.dshskill', 2048)], () => 'ok').queue
    const outcome = enterpriseSkillImportQueueOutcome(one)
    expect(outcome.kind).toBe('success')
    expect(outcome.kind === 'success' ? outcome.toast : '').toBe(
      enterpriseSkillImportNotice({
        kind: 'done', name: 'one.dshskill', bytes: 2048, names: ['one.dshskill-skill'], listed: true,
      }).text,
    )
    // 清单读不到时那半句如实的交代也要跟着来（复用同一枚投影 ⇒ 不可能漂）
    const unlisted = enterpriseSkillImportQueueSettle(
      enterpriseSkillImportQueueStart(enterpriseSkillImportQueueOf([file('u.dshskill', 1)]), 0),
      0,
      { kind: 'success', names: [], listed: false },
    )
    const unlistedOutcome = enterpriseSkillImportQueueOutcome(unlisted)
    expect(unlistedOutcome.kind === 'success' ? unlistedOutcome.toast : '')
      .toBe(enterpriseSkillImportNotice({ kind: 'done', name: 'u.dshskill', bytes: 1, names: [], listed: false }).text)
    // 多项全成功 ⇒ 数量句（动词仍是既有那枚 `已导入`，不新造动词）
    const many = drain([file('a', 1), file('b', 2)], () => 'ok').queue
    expect(enterpriseSkillImportQueueOutcome(many))
      .toEqual({ kind: 'success', toast: `${ENTERPRISE_SKILL_IMPORT_DONE}2 个技能包。` })
    // ★源码级：关窗出口是**枚举的**——成功那一支的自动关（ref）＋ 用户点关闭那一处（判据为真才过），
    //   没有第三处；toast 走官方原语，且成功那一支的判据就是那句 toast 文本本身。
    const src = stripComments(readSrc('skill-import-dialog.tsx'))
    expect(src.match(/\(false\)/g) ?? []).toHaveLength(2)
    expect(src).toContain('if (successToast === undefined) return')
    expect(src.match(/createElement\(Toast,/g) ?? []).toHaveLength(1)
    // 失败档**不关窗**：那支 effect 只在 `success` 时动手（partial / failed / nothing 都不碰 onOpenChange）
    expect(src).toContain("const successToast = outcome.kind === 'success' ? outcome.toast : undefined")
  })

  /* ────────────────────────── ⑥ 全部预失败 ⇒ 不干活 ────────────────────────── */

  it('⑥ 全部预失败（一个字节都没发出去）⇒ 直接返回**不干活**：无摘要、无 toast、不关窗', () => {
    const tooBig = file('huge.dshskill', ENTERPRISE_SKILL_IMPORT_MAX_BYTES + 1)
    const bigger = file('bigger.dshskill', ENTERPRISE_SKILL_IMPORT_MAX_BYTES + 2)
    const queue = enterpriseSkillImportQueueOf([tooBig, bigger])
    // 预检是**入队那一刻**做的：两项当场落 `failed`，`active` 直接缺席（驱动器一项都不会碰）
    expect(queue.items.map(item => item.status)).toEqual(['failed', 'failed'])
    expect(queue.items[0]!.code).toBe(ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE)
    expect(queue.active).toBeUndefined()
    expect(queue.attempted).toBe(0)
    expect(enterpriseSkillImportQueueOutcome(queue)).toEqual({ kind: 'nothing' })
    // 摘要句本身**算得出来**（纯投影要能覆盖"全失败"那一档），只是这一档**不画**它
    expect(enterpriseSkillImportQueueSummary(queue)).toBe('失败 2 / 成功 0 / 共 2')
    // 对照：真的跑了一圈但都失败（`attempted > 0`）⇒ 摘要句该出（那才需要一句话拢住）
    const ran = drain([file('a', 1), file('b', 2)], () => 'fail').queue
    expect(ran.attempted).toBe(2)
    expect(enterpriseSkillImportQueueOutcome(ran)).toEqual({ kind: 'partial', summary: '失败 2 / 成功 0 / 共 2' })
  })

  it('逐项状态句：四态各有可见词；失败项上屏**人话**、人话只有唯一码表那一处', () => {
    const item = (status: EnterpriseSkillImportItem['status'], extra: Partial<EnterpriseSkillImportItem> = {}): EnterpriseSkillImportItem =>
      ({ id: status, name: 'x.dshskill', bytes: 1, status, ...extra })
    expect(enterpriseSkillImportItemStatusText(item('pending'))).toBe('排队中')
    expect(enterpriseSkillImportItemStatusText(item('installing'))).toBe('进行中')
    expect(enterpriseSkillImportItemStatusText(item('success'))).toBe('成功')
    expect(enterpriseSkillImportItemStatusText(item('success', { names: ['a-skill', 'b-skill'] }))).toBe('成功：a-skill、b-skill')
    expect(enterpriseSkillImportItemStatusText(item('failed', { code: 'ENT_SKILL_UPLOAD_INVALID' })))
      .toBe(`失败：${enterpriseErrorMessage('ENT_SKILL_UPLOAD_INVALID')}`)
    // 没有人话可给（码缺席）时只剩状态词，绝不编一句
    expect(enterpriseSkillImportItemStatusText(item('failed'))).toBe('失败')
  })
})

/* ────────────────────────── ⑦ 文案与 Host 真源同源 ────────────────────────── */

describe('口径 60：弹窗文案与 Host 真实常量同源', () => {
  it('⑦ 接受的格式由 accept 派生、上限逐字用那枚 50 MiB 常量（全 src 只有一个数字真源）', () => {
    // 形态翻译是**真的在读**那串 accept（换一串就换一批词，不是写死的三枚字面量）
    expect(enterpriseSkillImportFormatNames('.zip,application/zip,text/plain')).toEqual(['.zip', 'ZIP'])
    expect(enterpriseSkillImportFormatNames('application/vnd.dsh.skill+zip')).toEqual(['ZIP'])
    expect(enterpriseSkillImportFormatNames('application/x-7z-compressed')).toEqual([])
    expect(ENTERPRISE_SKILL_IMPORT_FORMAT_NAMES).toEqual(enterpriseSkillImportFormatNames(ENTERPRISE_SKILL_IMPORT_ACCEPT))
    expect(ENTERPRISE_SKILL_IMPORT_FORMAT_NAMES).toEqual(['.dshskill', 'ZIP'])
    expect(ENTERPRISE_SKILL_IMPORT_ARCHIVE_NAME).toBe('ZIP')
    // 第二行提示逐字：形态清单 + **那枚常量**（上限不许出现第二个字面量）
    expect(ENTERPRISE_SKILL_IMPORT_FORMATS_TEXT)
      .toBe(`接受 ${ENTERPRISE_SKILL_IMPORT_FORMAT_NAMES.join('、')}，单个文件不超过 ${ENTERPRISE_SKILL_IMPORT_MAX_TEXT}`)
    expect(ENTERPRISE_SKILL_IMPORT_FORMATS_TEXT).toBe(`接受 .dshskill、ZIP，单个文件不超过 ${ENTERPRISE_SKILL_IMPORT_MAX_TEXT}`)
    // 第一行提示 + 弹窗标题/副标题（照规格：拖拽提示 / 接受格式与上限两行）
    expect(ENTERPRISE_SKILL_IMPORT_DROP_HINT.length).toBeGreaterThan(0)
    expect(ENTERPRISE_SKILL_IMPORT_DIALOG_TITLE).toBe('导入技能')
    expect(ENTERPRISE_SKILL_IMPORT_DIALOG_SUBTITLE.length).toBeGreaterThan(0)
    // 那枚按钮逐字「选择 ZIP 文件」，而 ZIP 那枚词从 accept 派生（文案里不写死它）
    expect(ENTERPRISE_SKILL_IMPORT_PICK_LABEL).toBe('选择 ZIP 文件')
    expect(ENTERPRISE_SKILL_IMPORT_PICK_LABEL).toBe(`选择 ${ENTERPRISE_SKILL_IMPORT_ARCHIVE_NAME} 文件`)
    expect(ENTERPRISE_SKILL_IMPORT_PICK_ARIA).toContain(ENTERPRISE_SKILL_IMPORT_PICK_LABEL)
    // ★源码级反向锁：全 `src` 剥注释后 `50 MiB` **恰好一次**（就是 `skill-import.ts` 那枚常量的定义处）。
    //   本刀顺手把 `error-messages.ts` 那句「不超过 50 MiB」改成引用同一枚常量 ⇒ 全仓只有一个数字真源。
    const every = sources()
    let hits = 0
    const elsewhere: string[] = []
    for (const [name, code] of every) {
      const found = code.match(/50 MiB/g) ?? []
      hits += found.length
      if (found.length > 0 && name !== 'skill-import.ts') elsewhere.push(name)
    }
    expect(hits, '全 src 的 50 MiB 字面量总数').toBe(1)
    expect(elsewhere, '除常量定义处之外还写了 50 MiB 的文件').toEqual([])
    expect(every.get('skill-import.ts')).toContain("export const ENTERPRISE_SKILL_IMPORT_MAX_TEXT = '50 MiB'")
    // ★不许照抄 Cherry 的限额（数字、条目数、体积）——全 `src` 一处都没有
    for (const [name, code] of every) {
      for (const cherry of ['100MB', '100 MB', '20000', '20,000', '20 万', '1GB', '1 GB', '50000', '50,000', '5 万']) {
        expect(code, `${name} 抄了 Cherry 的限额「${cherry}」`).not.toContain(cherry)
      }
    }
    // 上限那枚字节常量也必须有唯一的人话归属（口径 46 的既有绑定，本刀不动它）
    expect(ENTERPRISE_SKILL_IMPORT_MAX_BYTES).toBe(50 * 1024 * 1024)
  })
})

/* ────────────────────────── 弹窗视图（无 hook、可直调） ────────────────────────── */

describe('口径 60：导入弹窗的纯视图', () => {
  const viewOf = (queue: EnterpriseSkillImportQueue) => EnterpriseSkillImportView({
    queue,
    inputRef: { current: null },
    busy: !enterpriseSkillImportQueueClosable(queue),
    onPick: () => undefined,
    onFiles: () => undefined,
    onReselect: () => undefined,
  })

  it('拖拽区：虚线框那一枚 + 两行提示（拖拽提示 / 接受格式与上限）+ 一枚显式的多选按钮', () => {
    const onFiles = vi.fn()
    const onPick = vi.fn()
    const tree = EnterpriseSkillImportDropzone({ inputRef: { current: null }, busy: false, onPick, onFiles })
    const all = walk(tree)
    // ① 拖拽区（虚线框走它自己的类名；`data-busy` 是"装中不许再进来"的可见钩子）
    const drop = byProp(tree, 'data-enterprise-skill-import-drop')
    expect(drop?.props['className']).toBe('own-skill-import-drop')
    expect(drop?.props['data-busy']).toBe('false')
    const busyDrop = byProp(EnterpriseSkillImportDropzone({ inputRef: { current: null }, busy: true, onPick, onFiles }), 'data-enterprise-skill-import-drop')
    expect(busyDrop?.props['data-busy']).toBe('true')
    // ② 两行提示逐字（第一行拖拽、第二行接受格式与上限）
    const texts = textsOf(tree)
    expect(texts).toContain(ENTERPRISE_SKILL_IMPORT_DROP_HINT)
    expect(texts).toContain(ENTERPRISE_SKILL_IMPORT_FORMATS_TEXT)
    // ③ 显式按钮：可见文案 + 无障碍名与商城那枚**不同一个**（"选择要导入的技能包文件" vs 本枚）
    const pick = byProp(tree, 'data-enterprise-skill-import-pick')
    expect(pick?.props['children']).toBe(ENTERPRISE_SKILL_IMPORT_PICK_LABEL)
    expect(pick?.props['aria-label']).toBe(ENTERPRISE_SKILL_IMPORT_PICK_ARIA)
    expect(pick?.props['aria-label']).not.toBe(ENTERPRISE_SKILL_IMPORT_INPUT_LABEL)
    ;(pick?.props['onClick'] as () => void)()
    expect(onPick).toHaveBeenCalledTimes(1)
    // ④ 恒不可见选择器：accept 逐字来自冻结常量、**多选**、1px 剪裁、选完清空 value
    const input = all.find(element => element.props['type'] === 'file')
    expect(input?.props['accept']).toBe(ENTERPRISE_SKILL_IMPORT_ACCEPT)
    expect(input?.props['multiple']).toBe(true)
    expect(input?.props['style']).toMatchObject({ position: 'absolute', width: '1px', height: '1px', clip: 'rect(0 0 0 0)' })
    const chosen = { name: 'notes.dshskill', size: 2048 } as unknown as File
    const event = { currentTarget: { files: [chosen], value: 'C:\\fakepath\\notes.dshskill' } }
    ;(input?.props['onChange'] as (event: unknown) => void)(event)
    expect(onFiles).toHaveBeenCalledWith([chosen])
    expect(event.currentTarget.value).toBe('')
  })

  it('摘要句在**最上**（先于拖拽区），逐项状态四态各有可见词、失败项原文进 title', () => {
    const partial = drain([file('a.dshskill', 1), file('b.dshskill', 2)], name => (name === 'b.dshskill' ? 'fail' : 'ok')).queue
    // ① 布局：摘要那一格排在拖拽区**之前**（口径 60 第 3 条「顶部一句」的机器化判据）
    const body = viewOf(partial) as Element
    const order = childrenOf(body).map(child => (child as Element).type)
    expect(order.indexOf(EnterpriseSkillImportBatchSummary)).toBeGreaterThanOrEqual(0)
    expect(order.indexOf(EnterpriseSkillImportBatchSummary)).toBeLessThan(order.indexOf(EnterpriseSkillImportDropzone))
    expect(order.indexOf(EnterpriseSkillImportQueueList)).toBeGreaterThan(order.indexOf(EnterpriseSkillImportDropzone))
    // 空队列没有列表那一格（一枚元素都不画）
    const emptyOrder = childrenOf(viewOf(ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE) as Element)
      .map(child => (child === null ? undefined : (child as Element).type))
    expect(emptyOrder).not.toContain(EnterpriseSkillImportQueueList)
    // ② 摘要件：`role="alert"` + 逐字那一句；失败时给一枚**真能点**的「重新选择文件」
    const onReselect = vi.fn()
    const summary = EnterpriseSkillImportBatchSummary({ queue: partial, onReselect })
    expect(walk(summary).find(element => element.props['role'] === 'alert')?.props['children']).toBe('失败 1 / 成功 1 / 共 2')
    const reselect = walk(summary).find(element => element.props['aria-label'] === ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL)
    expect(reselect?.props['children']).toBe(ENTERPRISE_SKILL_IMPORT_RESELECT)
    ;(reselect?.props['onClick'] as () => void)()
    expect(onReselect).toHaveBeenCalledTimes(1)
    // 0 失败 / 空队列 ⇒ 整段不渲染
    const allOk = drain([file('a', 1), file('b', 2)], () => 'ok').queue
    expect(EnterpriseSkillImportBatchSummary({ queue: allOk, onReselect })).toBeNull()
    expect(EnterpriseSkillImportBatchSummary({ queue: ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE, onReselect })).toBeNull()
    // ③ 逐项行：名称用**既有那枚唯一拼法**，状态句四态各有可见词，失败项 `title` 是原文（稳定码）
    const items: readonly EnterpriseSkillImportItem[] = [
      { id: '0', name: 'a.dshskill', bytes: 2048, status: 'pending' },
      { id: '1', name: 'b.dshskill', bytes: 10, status: 'installing' },
      { id: '2', name: 'c.dshskill', bytes: 10, status: 'success', names: ['c-skill'], listed: true },
      { id: '3', name: 'd.dshskill', bytes: 10, status: 'failed', code: 'ENT_SKILL_UPLOAD_INVALID' },
    ]
    const list = EnterpriseSkillImportQueueList({ items })
    const rows = walk(list).filter(element => element.props['data-enterprise-skill-import-item'] !== undefined)
    expect(rows).toHaveLength(4)
    expect(textsOf(rows[0])).toContain('排队中')
    expect(textsOf(rows[1])).toContain('进行中')
    expect(textsOf(rows[2])).toContain('成功：c-skill')
    expect(textsOf(rows[3])).toContain(`失败：${enterpriseErrorMessage('ENT_SKILL_UPLOAD_INVALID')}`)
    expect(textsOf(rows[0])).toContain(enterpriseSkillImportLabel('a.dshskill', 2048))
    const failedCell = walk(rows[3]).find(element => element.props['data-status'] === 'failed')
    expect(failedCell?.props['title']).toBe('ENT_SKILL_UPLOAD_INVALID')
    // 上屏的是人话（不含裸码），原文只在 title 里
    expect(textsOf(rows[3]).join('')).not.toContain('ENT_')
  })
})

/* ────────────────────────── ⑧ 反向锁 ────────────────────────── */

describe('口径 60：反向锁（本刀明确不做的事）', () => {
  it('不许目录/文件夹导入：全 src 剥注释后没有任何目录选择 API，拖入只认文件那一档', () => {
    const every = sources()
    for (const [name, code] of every) {
      for (const forbidden of ['webkitdirectory', 'webkitGetAsEntry', 'webkitEntries', 'showDirectoryPicker', 'dataTransferItem']) {
        expect(code, `${name} 出现目录导入入口 ${forbidden}`).not.toContain(forbidden)
      }
    }
    // 拖入读的是 `dataTransfer.files`（**文件**），不是条目树 —— 这一条把"Phase 2 才做目录"钉在代码上
    const dialog = every.get('skill-import-dialog.tsx') ?? ''
    expect(dialog).toContain('event.dataTransfer.files')
    expect(dialog).toContain('multiple: true')
  })

  it('不许新增依赖：两个新文件的 import 全在允许清单里，且没有任何 zip 写入器', () => {
    const allowed = new Set(['react', 'lucide-react', '@deepseek-ai/dsh-client-ui-primitives'])
    for (const name of ['skill-import-queue.ts', 'skill-import-dialog.tsx']) {
      for (const spec of importSpecifiers(readSrc(name))) {
        expect(allowed.has(spec) || spec.startsWith('.'), `${name} 引入计划外依赖 ${spec}`).toBe(true)
      }
    }
    const every = sources()
    for (const [name, code] of every) {
      for (const spec of importSpecifiers(code)) {
        expect(/zip|archiver|jszip|yauzl|fflate|adm-zip/i.test(spec), `${name} 引入 zip 依赖 ${spec}`).toBe(false)
      }
    }
    // `package.json` 的依赖面**一字不动**（本刀一个依赖都不加：不引 zip 写入器、不引拖拽库）
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, unknown>
    expect(pkg['dependencies']).toBeUndefined()
    expect(pkg['devDependencies']).toEqual({ '@deepseek-ai/dsh-client-ui-primitives': '0.1.5-rc.2', '@types/mdast': '4.0.4' })
    expect(pkg['peerDependencies']).toEqual({ react: '^18.2.0' })
  })

  it('回归：既有单件通路（隐藏选择器 + 三态反馈）原样还在，商城页照旧用它、技能页不再挂它', () => {
    const leaf = stripComments(readSrc('skill-import-port.tsx'))
    const market = readSrc('marketplace-entry.tsx')
    const aggregation = readSrc('esc/esc-aggregation.tsx')
    // ① 单件那三件事实一个都没少（状态机 / 隐藏选择器 / 三态反馈），且商城页照旧消费它
    expect(leaf).toContain('export function useEnterpriseSkillImport(')
    expect(leaf).toContain('export function EnterpriseSkillImportChrome')
    expect(leaf).toContain('export function EnterpriseSkillImportNotice')
    expect(leaf).toContain("event.currentTarget.value = ''")
    expect(market).toContain('EnterpriseSkillImportChrome')
    expect(market).toContain('useEnterpriseSkillImport(')
    // ② 技能页那一侧换成了弹窗；**反向锁**：那枚隐藏选择器不许回到这一页（回来就是"两种入口并存"）
    expect(aggregation).toContain('useEnterpriseSkillImportQueue({')
    expect(aggregation).toContain('createElement(EnterpriseSkillImportDialog, {')
    expect(aggregation).not.toContain('EnterpriseSkillImportChrome')
    expect(aggregation).not.toContain('skillImportPort?.onOpen')
    // ③ 全 src 仍然**只有一个上传器**：「第二套 multipart 构造」在源码层就写不出来
    const owners = [...sources()].filter(([, code]) => code.includes('await uploadSkill(file, controller.signal)')).map(([name]) => name)
    expect(owners).toEqual(['skill-import-port.tsx'])
    // ④ 队列驱动器自己**不含**任何运输细节（它只把文件交棒给那枚单件状态机）
    const queueHook = leaf.slice(
      leaf.indexOf('export function useEnterpriseSkillImportQueue'),
      leaf.indexOf('export const ENTERPRISE_SKILL_IMPORT_INPUT_STYLE'),
    )
    expect(queueHook.length).toBeGreaterThan(0)
    for (const forbidden of ['fetch(', 'FormData', 'new Blob', 'uploadSkill(']) {
      expect(queueHook, `队列驱动器不该自己发请求：${forbidden}`).not.toContain(forbidden)
    }
    expect(queueHook).toContain('port.onSelect(file)')
  })
})
