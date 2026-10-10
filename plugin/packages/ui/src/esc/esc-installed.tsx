/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useRef/useState、官方原语 `Button`、lucide 的 `ArrowLeft`/`Inbox`，`esc-copy` 的文案、`esc-card` 那张卡（与它的两枚计划形状）、`esc-installed-model` 的纯投影（分组 / **账本条数** / 元信息表）、`esc-api` 的三条只读取数（官方发现面 + 两份元信息）、`esc-types` 的写入口类型，`esc-skill-more`（「更多」的唯一事实层：计划 + 文案 + 超时）/`esc-skill-try`（「去试试」的唯一事实层）、`error-messages` 的唯一稳定码，以及 `error-notice` 的唯一失败提示件
 * [OUTPUT]: 对外提供 `EnterpriseEscInstalledView`——「已安装技能」页（**按来源分组** + 每张卡一枚开关 + **「更多」/「去试试」两个入口**）
 * [POS]: esc 页的**第二个视图**（口径 47/54），由工具栏那枚「已安装」打开、页壳 `esc-page` 负责切换（没有真实路由，故用一份视图状态切换——与商城页的技能详情子页面同一条手法）。
 *   ★**口径 54（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）**：
 *     · **列表真源 = `api.discoveredSkills()`**（宿主官方 `ctx.get('skills')` 的快照 = 运行时真正加载的那一份）
 *       —— 它答的是"**磁盘上真的装着什么**"，而不是"我们自己那两份记录里写了什么"。
 *     · **来源标注**：按官方 `source`（+「与企业记录同名」这一格）分组，组名就是"谁放进去的"
 *       （企业装下来的 / 本机导入的 / 项目里的 / 官方内置 / 其它来源（原样枚举）），判定全在
 *       `esc-installed-model.ts`（纯投影，因为本仓 vitest 跑不了 hook —— 见那个文件头）。
 *     · **两份老记录降级为元信息**（`api.installedSkills()` 给 `versionId`/`packageId`、
 *       `api.selfInstalledSkills()` 给 `sha256`/`displayName`）：它们**不再决定"列不列出来"**，
 *       只在卡片上贡献显示名、在开关的悬浮说明里贡献那半句版本/摘要，并决定那枚开关**能不能拨**
 *       （名字对上企业记录才有中心包 id ⇒ 才有卸载路由）。
 *     · `complete === false` ⇒ **如实说"还在发现中"**（页头一条可见的 `role="status"`），
 *       数字位保持为"目前真的读到的那几个" —— **不当 0、不写死数字**。
 *   ★版式照用户那张参考图：**分组标题 + 卡片网格**。卡片**就是技能卡那张**（`EnterpriseEscCard` + `showUse`），
 *     两处不同仍按用户原话：① 标题行第二格＝**开关**（`actionSwitch`）；② **没有底部标签行**（`showTags: false`）。
 *     ★本刀**一字未动卡片几何与类名**（"不许动卡片几何"是硬约束）：元信息那半句的落点因此选在
 *       **开关的悬浮说明**上（与"置灰原因"同一个落点，也是本仓对 title 的既有用法），不新增 DOM 层。
 *   ★如实缺口（写在开关的置灰原因里）：本机导入 / 项目里 / 官方内置的那些枚**没有**中心雪花包 id
 *     ⇒ 宿主侧**没有**对应的卸载路由，开关置灰并写明原因；而技能**启停**（参考图里那个开关的原意）
 *     在本机与平台两侧**都不存在**路由，故开关在这里表达的是**装/卸**这件真事。
 *   ★**本刀（真机缺口修复：这一页此前缺「更多」与「去试试」两个入口）**——先如实记下**两半根因**，
 *     它们是两件事、缺哪一半都还是缺口：
 *     ① **视图没交计划**：`installedCard()` 只给了 `item` + `actionSwitch` + `showTags:false`
 *        ——`more`（本机管理动作的唯一计划）与 `tryNow`（「去试试」的唯一计划）**都没接**；
 *     ② **卡片层是"二选一"**：`esc-card.tsx` 的标题行那一格改前写的是"给了 `actionSwitch` 就只画开关"
 *        ⇒ 即便①把计划交下来，`skillActionBox` 也**进不了树**（「去试试」那支虽写着 `installed === true`
 *        就渲染，却永远走不到那一行）。故本刀**两半一起补**（卡片那半是 additive：`actionSwitch` 缺席时
 *        标题行子节点逐格不变）。
 *     ★**两个计划各恰一处、且只认唯一那两枚纯投影**：`moreOf`（`enterpriseEscSkillMorePlan`，可用性
 *       **只认自装记录的 `names[]`**）与 `tryNowOf`（`enterpriseEscSkillTryPlan`）。**本页不新建真值**：
 *       自装记录就是这一页**已经在读**的那一份（`meta.value.self`，`GET …/skills/self-installed`），
 *       不为这两个入口多发一趟请求、也不另存一份。
 *     ★**本刀（技能页性能：「不再白算 / 不再白画」那一半）**：那两枚纯投影**不再被本页逐卡直调**，
 *       改由两张**计划表**（`enterpriseEscSkillMoreTable` / `enterpriseEscSkillTryTable`）在 `useMemo`
 *       里各建一次、渲染时按名取 —— 于是同一份数据 + 同一份状态下，同一枚技能拿到的计划**引用相等**，
 *       `esc-card.tsx` 那层 `memo` 才判得出"props 没变"而跳过整棵子树重画（真机："技能页很卡"）。
 *       同刀把四份真值（发现面 / 元信息表 / 自装记录 / 分组卡片）钉在 `useMemo` 上、把四枚执行器
 *       收成 `useCallback`（**依赖列恰好是各自闭包读的那几格状态**）：引用稳定这条链**每一环都要稳**，
 *       少一环（比如"空真值每次现造一个 `[]`"）就是表被逐帧重建、memo 白包。
 *       ⚠**如实边界**：本页每张卡还带一枚**每渲染现造**的 `actionSwitch`（开关）与内联 `onChange`
 *       ⇒ 本页的卡**这一刀还没有吃到 memo 的收益**（口径：那一格是中心卸载链的入参，不在本刀范围）。
 *       本页的收益是"不再逐卡折 Set、不再逐卡造计划、真值引用稳定"，以及为下一刀铺好路。
 *     ★**本页恒 `installed: true`**：这一页列出来的每一枚都是**磁盘上真的装着**的（真源＝官方发现面）
 *       ⇒ 「去试试」在本页**恒可点**（"已装却被禁用"是自相矛盾的形态），草稿按**判据键**（发现面的
 *       kebab 名，不是给员工看的显示名）拼出、**只填不发送**。
 *     ★**为什么那枚开关与「更多→卸载」**不**冗余**（一句话：**自装技能没有中心包 id**）：
 *       · 开关走的是**中心卸载链**（`skillPort.uninstallSkill(packageId)`，要企业那份记录里的雪花包 id）；
 *       · 「更多→卸载」走的是**本机自装链**（`skillPort.uninstallSelfInstalledSkill(name)`，只认落盘目录名）；
 *       ⇒ 对**本机导入 / 项目里 / 官方内置**那几组技能，中心包 id 根本不存在 ⇒ 那枚开关对它们
 *       **本来就是锁死的**（`selfInstalledLocked`），「更多→卸载」是它们**唯一**的卸载入口。
 *       两条链各有其主，谁都不许顶替谁（中心那一枚也**不许**被改成按名字卸：那会越过中心记账）。
 *     ★**成功以宿主回执为准、绝不乐观翻态**：卸载成功后**只**请本页那两趟读重跑一次（复用既有
 *       `reloadToken`）——列表的增删永远由官方发现面说；失败**一格都不翻**，只把稳定码落在那一张卡上。
 *   ★★**本刀（用户最终裁决：`已安装` = DSH 自己装过的那本账，按"来源渠道"分四组）**：
 *     · **账目口径**：只有**有 DSH 记录**的技能进这一页（中心已装记录 `installed.json`，或自装记录
 *       `self-installed.json` 的 `names[]`）；没有记录的一律出去（用户原话「电脑上装的不是 DSH 安装的
 *       就不要出现在已安装里」）——那 7 枚无记录 `user-dsh` 与 41 枚无记录 `user-agents` **不在这一页**，
 *       但它们**没有丢**：它们在「本地三方」那一面（宿主 `buildThirdPartySkillRoots` 的根表里就有
 *       `~/.dsh/skills` 与 `~/.agents/skills`）。
 *     · **四组渠道**：系统内置 / 来自内部市场 / 来自外部市场 / 用户自定义（判据与优先级全在
 *       `esc-installed-model.ts` 的 `enterpriseEscInstalledGroupIdOf`；本页只画）。
 *     · **页头那个数** = 这一页真的铺出来的卡片数（不再是发现面扫到的总数）——数字与列表同源，
 *       否则会出现"标题写 48、列表只铺 4 张"的自相矛盾。
 *     · ★**分组只决定"画不画 / 归哪一组"，绝不参与任何动作的可用性**：安装 / 卸载 / 打开文件夹 /
 *       「去试试」的判据仍然只有**记录 + 端口在场**两件。分组是**显示口径、不是权威事实**
 *       （`sourceInput` 是自由串，用户自造前缀就能"换组"）——这一句是给后来者的提醒。
 *     ★**已知缺口（就地登记，不藏）**：`project-dsh` / `project-agents` 这两类没有 DSH 记录 ⇒ 按本口径
 *       它们不在这一页，而「本地三方」的根表里也还没有项目根 ⇒ **项目根的技能当前无处显示**，
 *       等「本地三方」扩项目根那一刀一起解决（这里不硬塞第五组）。
 *   ★**本刀（用户冻结规格 §3：「…」菜单照 WorkBuddy，四行）**——三件事，**账目口径与四组一字未动**：
 *     ① **菜单四行**：`去对话` / `编辑` / `打开文件夹` / `卸载`（行数据在 `esc-more-menu.tsx`，
 *        顺序即版式真源）。★`编辑`（用系统默认应用打开 `SKILL.md`）那条宿主路由**还没落地** ⇒
 *        `wired.edit`（查 `skillPort.editSkillFile`）与写入口**同时缺席** ⇒
 *        `escCardMoreRows` 把它**整行丢掉**（fail-closed：不画一枚点了没反应的菜单项、也不先画成禁用）。
 *        ⇒ 今天真机上画出来的是**三行**（去对话 / 打开文件夹 / 卸载），第二格待那条路由落地。
 *     ② ★**`去对话` 与卡片上那枚 `去试试` 是同一个动作**（新会话 + 填好草稿、**绝不自动发送**）：
 *        本页先把那一枚「去试试」计划算出来（`tryNowOf`），**同一个对象**既交给卡片那枚按钮，
 *        又交给「更多」的计划（`moreOf(each.name, tryNow)` 的 `gotoChat` 那一格）——那一行的
 *        `onSelect` 就是 `plan.onTry`（**同一个闭包**）、`disabled` 就是 `plan.disabled`（同一份事实）。
 *        ⇒ 两处入口、一份实现：本页 `runSkillTry` **只有一个调用点**，草稿**只有一处**拼法
 *        （唯一构造器 `enterpriseEscSkillTryDraft`，本页一次都不调它）。
 *     ③ **卡片上那枚 `去试试` 保留**（用户裁决），开关与两张计划的关系**逐字未改**。
 *   ★**本刀**：本页**不**参与"广场隐藏已安装"那条规则（那一页是广场/精选的事；这一页列的就是已装的那本账）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { ArrowLeft, Inbox } from 'lucide-react'
import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE } from '../error-messages.js'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { enterpriseLocalErrorCode } from '../local-api.js'
import type { EnterpriseDiscoveredSkill, EnterpriseInstalledSkill, EnterpriseSelfInstalledSkill } from '../skill-api-decode.js'
import { EnterpriseEscCard } from './esc-card.js'
import type { EnterpriseEscApi } from './esc-api.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import {
  enterpriseEscInstalledCount,
  enterpriseEscInstalledGroups,
  enterpriseEscInstalledMetaTable,
  type EnterpriseEscInstalledCard,
} from './esc-installed-model.js'
import type { EscCardMore } from './esc-more-menu.js'
/**
 * ★**本刀**：两枚计划的**唯一事实层**——「更多」那两枚本机管理动作与「去试试」。
 * 本文件只接线（把这份自装真值、端口在不在场、在途与失败交进去），一个判据都不自己写。
 */
import {
  ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS,
  enterpriseEscSelfInstalledNames,
  enterpriseEscSkillMoreRevealedText,
  enterpriseEscSkillMoreEditedText,
  enterpriseEscSkillMoreTable,
  enterpriseEscSkillMoreUninstalledText,
  type EnterpriseEscSkillMoreAction,
  type EnterpriseEscSkillMoreFailure,
  type EnterpriseEscSkillMorePending,
} from './esc-skill-more.js'
import {
  enterpriseEscSkillTryFilledText,
  enterpriseEscSkillTryTable,
  type EnterpriseEscSkillTryPlan,
} from './esc-skill-try.js'
import type { EnterpriseEscSkillPort } from './esc-types.js'

/**
 * 三枚**同一引用**的空真值（本刀：引用稳定）。
 *
 * ★**为什么需要它们**：`discovery` / `meta` 还没就绪时，本页改用"空的一份"来算分组与计划。
 *   改前那三处写的是 `: []` / `metaTable([], [])` —— 那是**每次渲染现造**的数组
 *   ⇒ 以它为依赖的 `useMemo`（那两张计划表、`selfInstalledNames`、`groups`）每次都判定"变了"而重建，
 *   于是"表没变 ⇒ 卡能跳过"这条链在最常见的那一档（元信息读不到、只有发现面真值）里当场断掉。
 *   三枚常量把"空"也变成**同一个对象**：状态没变，依赖就不变。
 */
const ENTERPRISE_ESC_INSTALLED_NO_DISCOVERED: readonly EnterpriseDiscoveredSkill[] = []
const ENTERPRISE_ESC_INSTALLED_NO_RECORDS: readonly EnterpriseSelfInstalledSkill[] = []
const ENTERPRISE_ESC_INSTALLED_NO_CENTER: readonly EnterpriseInstalledSkill[] = []

/** 一个只读取数的三态（三份取数**各算各的**：元信息读不到**不**能把真源那份也拖成失败）。 */
type ReadState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly code: string }
  | { readonly kind: 'ready'; readonly value: T }

/** 官方发现面那一份（`value` 里多一枚 `complete`：官方自己说"发现完了没有"）。 */
type DiscoveryState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly code: string }
  | { readonly kind: 'ready'; readonly skills: readonly EnterpriseDiscoveredSkill[]; readonly complete: boolean }

/** 两张老记录的元信息（降级后的用途：显示名 / 版本 / 摘要 / 卸载用包 id）。 */
type MetaState = ReadState<{
  readonly center: readonly EnterpriseInstalledSkill[]
  readonly self: readonly EnterpriseSelfInstalledSkill[]
}>

/** 入参。 */
export interface EnterpriseEscInstalledViewProps {
  /** 只读面：官方发现面（真源）+ 两份元信息（`GET …/skills/discovered` / `installed` / `self-installed`）。 */
  readonly api: EnterpriseEscApi
  /** 写入口：卸载（口径 46 起与「添加技能」共用同一枚端口）。 */
  readonly skillPort: EnterpriseEscSkillPort
  /** 回列表（本页没有真实路由，返回就是切视图状态）。 */
  readonly onBack: () => void
}

/** 一句可见的加载/失败交代（空着与读不到是两件事，分开说）。 */
function hintNode(className: string, children: ReactNode): ReactNode {
  return createElement('div', { className }, children)
}

/** 加载态那一格（`aria-busy` 让读屏知道这还在读，不是"没有"）。 */
function loadingNode(): ReactNode {
  return createElement('div', { className: 'esc-installed-hint', 'aria-busy': true }, ENTERPRISE_ESC_COPY.loading)
}

/**
 * 一张已安装卡片：技能卡那套版式 + 标题行那一格开关 + **没有底部标签行**（口径 47 的两处不同）
 * + **「更多」与「去试试」两个入口**（真机缺口修复那一刀补上，见文件头那两半根因）。
 *
 * @param each - 纯投影给出的一条卡片数据（key / **判据键** / 卡片 / 开关能不能拨 / 元信息半句）。
 * @param disabled - 这一枚**此刻**能不能拨（在途时置灰；`each.locked` 的置灰在调用处另算）。
 * @param title - 悬浮说明（置灰原因，或"拨下去会发生什么"；**元信息半句也并在这里**）。
 * @param onChange - 拨动（只有"关"这一个方向是真的动作）。
 * @param more - 「更多」计划（`moreOf` 给的；`undefined` = 这一枚**整枚不画** `⋯`，是计划自己的规则）。
 *   ★**本刀**：它的 `goto-chat` 那一格拿的是**同一枚** `tryNow`（见 `moreOf` 的长注释）。
 * @param tryNow - 「去试试」计划（`tryNowOf` 给的；**恒有值**——不可用是"禁用 + 写明原因"，不是不画）。
 *   ★**同一个对象**也交给了 `more`（「去对话」那一行）⇒ 两个入口的动作与可点性来自同一份事实。
 */
function installedCard(
  each: EnterpriseEscInstalledCard,
  disabled: boolean,
  title: string,
  onChange: (next: boolean) => void,
  more: EscCardMore | undefined,
  tryNow: EnterpriseEscSkillTryPlan,
): ReactNode {
  return createElement(EnterpriseEscCard, {
    key: each.key,
    item: each.item,
    iconShape: 'square',
    // 技能卡那套版式（标题行 + 描述独立一行）——用户原话「卡片和技能卡片一致」。
    showUse: true,
    /**
     * ★**本刀**：这一页列出来的每一枚都是**磁盘上真的装着**的（真源＝官方发现面）⇒ 卡片按"已装"那一档
     *   画「更多 + 去试试」（这一位同时是那两枚计划进树的前提：`esc-card.tsx` 只在 `installed === true`
     *   那一支读它们）。改前这里没给 ⇒ 那两枚动作无从渲染。
     */
    installed: true,
    // ① 标题行第二格＝开关（**一字未改**：中心卸载链那枚）；② 没有底部标签行。这两处就是用户说的"唯一不同"。
    actionSwitch: { checked: true, disabled, title, onChange },
    showTags: false,
    // ★两个计划各**恰一处**（见文件头）：更多（算不出来 ⇒ 整枚不画）与去试试（恒有值）。
    ...(more === undefined ? {} : { more }),
    tryNow,
  })
}

/**
 * 「已安装技能」页。
 *
 * @param props - 见 `EnterpriseEscInstalledViewProps`。
 * @returns 页头（返回 + 标题 + 总数 + 「还在发现中」那句）+ 按来源分组的分节 + 整页空态/失败态。
 */
export function EnterpriseEscInstalledView({ api, skillPort, onBack }: EnterpriseEscInstalledViewProps): ReactNode {
  const [discovery, setDiscovery] = useState<DiscoveryState>({ kind: 'loading' })
  const [meta, setMeta] = useState<MetaState>({ kind: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  /** 在途卸载的包 id（那一枚开关在途时置灰；别的开关不受影响）。 */
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  /** 卸载失败的稳定码（唯一失败提示件的输入；下一次动作开始时清掉）。 */
  const [actionCode, setActionCode] = useState<string | undefined>(undefined)
  const actionAbort = useRef<AbortController | null>(null)
  /**
   * ★**本刀**：「更多」那三枚**本机管理动作**（卸载 / 编辑 / 打开所在文件夹）的三件状态
   * （在途那一枚 / 失败那一行 / 刚办成那一句）。
   *
   * ★**为什么另起一小组、不并进上面那两格**：那是**中心卸载链**（开关 → `packageId` → `…/skills/uninstall`），
   *   这是**本机自装链**（下拉 → 落盘目录名 → `…/skills/self-installed/uninstall`）——两条链的坐标、
   *   记账面与失败面都不同，混用一格就会出现"开关在途却把下拉也灰掉"这类自相矛盾。与聚合层那三格同形
   *   （那里也是 `morePending`/`moreError`/`moreNotice` 独立一组）。
   */
  const [morePending, setMorePending] = useState<EnterpriseEscSkillMorePending | undefined>(undefined)
  const [moreError, setMoreError] = useState<EnterpriseEscSkillMoreFailure | undefined>(undefined)
  const [moreNotice, setMoreNotice] = useState<string | undefined>(undefined)
  /**
   * ★**本刀**：「去试试」的三件状态（与上面那三格**并列**、同一条纪律）。
   *
   * 与 `morePending` 的差别只有一条：在途只可能是**一枚技能名**（那枚按钮自己禁用即可，不必连带全场）。
   */
  const [tryPending, setTryPending] = useState<string | undefined>(undefined)
  const [tryError, setTryError] = useState<{ readonly name: string; readonly code: string } | undefined>(undefined)
  const [tryNotice, setTryNotice] = useState<string | undefined>(undefined)
  /**
   * 三趟取数**各自**落地（口径同文件头：元信息读不到不拖真源）。
   *
   * ★**真源那一趟只有一条请求**（`api.discoveredSkills`）：列表、计数、"装没装"三件事同源，
   *   不存在"计数读一份、列表读另一份"那种会静默漂开的形态。
   */
  useEffect(() => {
    const controller = new AbortController()
    setDiscovery({ kind: 'loading' })
    setMeta({ kind: 'loading' })
    void (async () => {
      try {
        const snapshot = await api.discoveredSkills(controller.signal)
        if (controller.signal.aborted) return
        setDiscovery({ kind: 'ready', skills: snapshot.skills, complete: snapshot.complete })
      } catch (error) {
        if (controller.signal.aborted) return
        setDiscovery({ kind: 'failed', code: enterpriseLocalErrorCode(error) })
      }
    })()
    void (async () => {
      try {
        // 两份**元信息**串行读（同一趟里各一次请求）：任一条失败即整趟降级为"元信息读不到"，
        // 但**列表那一趟不受影响**（发现面已经给出了列表与真值）。
        const center = await api.installedSkills(controller.signal)
        if (controller.signal.aborted) return
        const self = await api.selfInstalledSkills(controller.signal)
        if (controller.signal.aborted) return
        setMeta({ kind: 'ready', value: { center, self } })
      } catch (error) {
        if (controller.signal.aborted) return
        setMeta({ kind: 'failed', code: enterpriseLocalErrorCode(error) })
      }
    })()
    return () => controller.abort()
  }, [api, reloadToken])
  // 离开这一页即中止在途的卸载（迟到结果不回填）。
  useEffect(() => () => { actionAbort.current?.abort() }, [])

  /**
   * ★**本刀（技能页性能：真值引用稳定）**：下面四份真值**全部**由 `useMemo` 派生，依赖只有状态本身
   *   （`discovery` / `meta` 都是 `useState` 的同一枚对象，状态没翻就是同一引用）。
   *
   * ★**为什么这一步与那两张计划表同样要紧**：卡片那层 `memo` 比较的是**props 逐键浅相等**，
   *   其中 `item` / `actionSwitch` 都由 `groups` 这一层投影产出 ⇒ `groups` 每渲染重建一次，
   *   每张卡拿到的就是**新的** `item`，memo 照样判"变了"。把"读到的那几份真值 → 元信息表 →
   *   分组卡片"这条链上的每一步都钉在 `useMemo` 上，引用才真的稳。
   * ★**空真值取**同一枚常量**（文件顶上那三枚）：改前写的是 `: []` / `([], [])` —— 每次渲染现造，
   *   依赖当场失效（元信息读不到那一档最常见）。
   */
  const skills = useMemo(
    () => (discovery.kind === 'ready' ? discovery.skills : ENTERPRISE_ESC_INSTALLED_NO_DISCOVERED),
    [discovery],
  )
  /** 元信息表：读到了就用它；读不到给一张**空表**（卡片照样画出来，只是没有显示名/版本/卸载口）。 */
  const metaTable = useMemo(
    () => (meta.kind === 'ready'
      ? enterpriseEscInstalledMetaTable(meta.value.center, meta.value.self)
      : enterpriseEscInstalledMetaTable(ENTERPRISE_ESC_INSTALLED_NO_CENTER, ENTERPRISE_ESC_INSTALLED_NO_RECORDS)),
    [meta],
  )
  /**
   * ★**本刀**：自装记录那份**已经在手**的真值（本页那份元信息里的 `self`，`GET …/skills/self-installed`）。
   *
   * ★**它就是「更多」可用性判据的唯一来源**（自装记录的 `names[]` 并集，唯一实现是
   *   `enterpriseEscSelfInstalledNames`，本页不自算）。**不为这件事再发一趟请求、也不另存第二份真值**：
   *   这一页本来就在读它（`meta` 那一趟），复用即可。读不到时是空数组 ⇒ 一枚本机管理动作都不给
   *   （与聚合层同判，且上面那条 `installedMetaFailed` 已经把"读不到"说出来，不是静默缺口）。
   */
  const selfRecords = useMemo(
    () => (meta.kind === 'ready' ? meta.value.self : ENTERPRISE_ESC_INSTALLED_NO_RECORDS),
    [meta],
  )
  /** 分组卡片（纯投影）：输入那两份真值引用稳定 ⇒ 这一份也稳定 ⇒ 每张卡拿到的 `item` 引用稳定。 */
  const groups = useMemo(() => enterpriseEscInstalledGroups(skills, metaTable), [skills, metaTable])
  /**
   * ★**本刀（账目口径 + 同一个词只指一个数）**：页头那个数**不是**发现面扫到的总数，而是
   *   **这一页真的铺出来的卡片数**（＝DSH 那本账上的那几条），取值口是**同一个纯投影**
   *   `enterpriseEscInstalledCount` —— 顶栏那枚「已安装(N)」（`esc-aggregation.tsx`）调的也是它，
   *   两个消费者吃同一份输入、走同一个判据，故同一屏上不可能出现两个数。
   *
   * ★理由（用户裁决「电脑上装的不是 DSH 安装的就不要出现在已安装里」）：数字位若照旧数"磁盘上有什么"，
   *   页面就会出现"标题写 48、列表只铺 4 张"的自相矛盾 —— 数字与列表必须同源（同一个投影）。
   * ★**分组只决定"画不画 / 归哪一组"，绝不参与任何动作的可用性**：能卸 / 能开文件夹 / 能试，
   *   判据仍然只有**记录 + 端口在场**两件（那三枚计划的判据全在纯投影里，见 model 那一处的长注释）。
   */
  const total = enterpriseEscInstalledCount(skills, metaTable)
  /** ★官方自己说"还没发现完" ⇒ 数字位那一个数**还会变**，页面必须说出来（口径 54）。 */
  const discovering = discovery.kind === 'ready' && discovery.complete === false

  const uninstall = (packageId: string): void => {
    actionAbort.current?.abort()
    const controller = new AbortController()
    actionAbort.current = controller
    setActionCode(undefined)
    setBusyId(packageId)
    void (async () => {
      try {
        await skillPort.uninstallSkill(packageId, controller.signal)
        if (controller.signal.aborted) return
        /**
         * ★卸载成功后**只重跑那两趟读**（`reloadToken`）：卸载真的改了磁盘，而"磁盘上现在有什么"
         *   只有官方发现面说了算 —— 界面绝不自己从列表里减掉一枚（那是乐观猜测，不是真值）。
         */
        setReloadToken(token => token + 1)
      } catch (error) {
        if (controller.signal.aborted) return
        setActionCode(enterpriseLocalErrorCode(error))
      } finally {
        if (!controller.signal.aborted) setBusyId(undefined)
      }
    })()
  }

  /**
   * ★**本刀**：两个入口各自的写入口（判据是**端口在不在场**，不是写死 disabled）。
   *
   * ★它们与上面那枚开关**共用同一个注入面**（`EnterpriseEscSkillPort`），但走的是**另外两条链**
   *   （见文件头"为什么不冗余"）：本页一个路由字面量、一次 `fetch` 都**不出现**，全部交给注入的端口。
   */
  const uninstallSelfInstalledSkill = skillPort.uninstallSelfInstalledSkill
  const revealSelfInstalledSkill = skillPort.revealSelfInstalledSkill
  const editSelfInstalledSkill = skillPort.editSkillFile
  const fillSkillTryDraft = skillPort.fillSkillTryDraft

  /**
   * 一次本机管理动作的**公共起点**（两枚共用）：在途闸 + 清掉上一轮的两句反馈。
   *
   * @returns `false` = 被"一次一条"挡下（**那一条请求一条都不发**，也不排队）。
   */
  const beginSkillMore = useCallback((action: EnterpriseEscSkillMoreAction, name: string): boolean => {
    if (morePending !== undefined) return false
    setMorePending({ name, action })
    setMoreError(undefined)
    setMoreNotice(undefined)
    // 一张卡上同一时刻只说一件事：开始这两枚动作时也清掉「去试试」那两句反馈
    // （两枚动作共用一个失败位，见 `esc-card.tsx` 的 `cardFailure`）。
    setTryError(undefined)
    setTryNotice(undefined)
    return true
    /**
     * ★**本刀**：依赖列恰好是这枚闭包**读的那一格状态**（`morePending` 那枚在途闸）——
     *   它一变，这枚回调与下面两枚执行器就跟着换新的（而那些计划表也随之重建）。
     *   这不是"为了消 warning 随手补的依赖"：`useCallback` 与那几张计划表**必须**同生同死，
     *   否则表里存下的执行器会闭着一个**过期的在途闸**（第二次点在途动作就挡不住了）。
     */
  }, [morePending])

  /**
   * **卸载**一枚自装技能（破坏性：只有那枚下拉里、且过了二次确认的那一行会调它）。
   *
   * ★**成功以宿主回执为准、绝不乐观翻态**：宿主那一次回执只说明"这一次动作成了"，而"磁盘上现在有什么"
   *   只有官方发现面说了算 ⇒ 这里**只**请本页那两趟读重跑一次（复用既有 `reloadToken`）。界面**从不**
   *   自己从列表里减去一枚（失败那一支更是连列表都不碰：只把稳定码落在那一张卡上）。
   * ★**不中止在途**：那是一次**写**动作，中止 fetch 不会撤销它、只会让界面不知道结果 ⇒ 只挂一枚超时信号。
   */
  const runUninstallSelfInstalled = useCallback((name: string): void => {
    if (uninstallSelfInstalledSkill === undefined) return
    if (!beginSkillMore('uninstall', name)) return
    const signal = AbortSignal.timeout(ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS)
    void uninstallSelfInstalledSkill(name, signal).then(
      () => {
        setMoreNotice(enterpriseEscSkillMoreUninstalledText(name))
        setReloadToken(token => token + 1)
      },
      (error: unknown) => {
        setMoreError({ name, action: 'uninstall', code: enterpriseLocalErrorCode(error) })
      },
    ).finally(() => { setMorePending(undefined) })
  }, [uninstallSelfInstalledSkill, beginSkillMore])

  /**
   * **打开所在文件夹**（非破坏性、无确认，但**仍是异步动作**：在途禁用 + 成败都如实说）。
   *
   * ★成功**不改任何本地状态**（宿主那一跳不改记录），只说一句"已经交出去了"；
   *   失败（目录不在了 ⇒ 404、系统交接失败 ⇒ 503）走同一条失败落点（那一张卡上的唯一提示件）。
   */
  const runRevealSelfInstalled = useCallback((name: string): void => {
    if (revealSelfInstalledSkill === undefined) return
    if (!beginSkillMore('open-folder', name)) return
    const signal = AbortSignal.timeout(ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS)
    void revealSelfInstalledSkill(name, signal).then(
      () => { setMoreNotice(enterpriseEscSkillMoreRevealedText(name)) },
      (error: unknown) => {
        setMoreError({ name, action: 'open-folder', code: enterpriseLocalErrorCode(error) })
      },
    ).finally(() => { setMorePending(undefined) })
  }, [revealSelfInstalledSkill, beginSkillMore])
  /**
   * **编辑**（用系统**默认应用**打开这枚技能的 `SKILL.md`）：与「打开文件夹」同族同形 ——
   * 非破坏性、无确认，但**仍是异步动作**（在途禁用 + 成败都如实说）；成功**不改任何本地状态**。
   */
  const runEditSelfInstalled = useCallback((name: string): void => {
    if (editSelfInstalledSkill === undefined) return
    if (!beginSkillMore('edit', name)) return
    const signal = AbortSignal.timeout(ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS)
    void editSelfInstalledSkill(name, signal).then(
      () => { setMoreNotice(enterpriseEscSkillMoreEditedText(name)) },
      (error: unknown) => {
        setMoreError({ name, action: 'edit', code: enterpriseLocalErrorCode(error) })
      },
    ).finally(() => { setMorePending(undefined) })
  }, [editSelfInstalledSkill, beginSkillMore])

  /**
   * ★**本刀（技能页性能：「不再白算」那一半）**：本页那**两张计划表**（更多 / 去试试）。
   *
   * ★与聚合层那三张**逐条同因**：卡片由 `memo` 包着，判据是 props **逐键浅相等** ⇒ 逐卡现造的计划
   *   等于"每张卡每次渲染都变了"。表在 `useMemo` 里各建一次，依赖是真值引用与状态标量
   *   （`selfRecords` 是取数落地的那份数组、`tryPending`/`tryError`/`morePending`/`moreError` 是状态标量）
   *   ⇒ 状态没变时同一枚技能取到的永远是**同一枚计划**，那些已装卡才真的能被跳过重画。
   * ★**自装名字集合只建一次**：`enterpriseEscSelfInstalledNames` 是"这一枚能不能卸"那条判据的
   *   唯一输入投影（改前每张卡调一次），现在由本层建一次交给 `morePlans`。
   * ★**两个名字（`moreOf` / `tryNowOf`）与签名一字未改**：交下去的仍是这两个薄函数、仍是**同一张表**
   *   （同一份夹具下卡片拿到的计划对象与改前逐字段相同，只是**引用不再每渲染换一个**）。
   */
  const selfInstalledNames = useMemo(() => enterpriseEscSelfInstalledNames(selfRecords), [selfRecords])
  const morePlans = useMemo(() => enterpriseEscSkillMoreTable({
    selfInstalledNames,
    wired: {
      /** ★「编辑」：宿主路由**已落地**（A2.1）⇒ 这一格不再恒 false（判据仍是"端口在不在场"）。 */
      edit: skillPort.editSkillFile !== undefined,
      uninstall: uninstallSelfInstalledSkill !== undefined,
      reveal: revealSelfInstalledSkill !== undefined,
    },
    ...(morePending === undefined ? {} : { pending: morePending }),
    ...(moreError === undefined ? {} : { failure: moreError }),
    onUninstall: runUninstallSelfInstalled,
    onReveal: runRevealSelfInstalled,
    onEdit: runEditSelfInstalled,
  }), [selfInstalledNames, morePending, moreError, skillPort, uninstallSelfInstalledSkill, revealSelfInstalledSkill, runUninstallSelfInstalled, runRevealSelfInstalled, editSelfInstalledSkill, runEditSelfInstalled])

  /**
   * 某一枚技能 → 它的「更多」计划（**唯一构造点**：上面那张 `morePlans` 表，表内唯一投影是
   * `enterpriseEscSkillMorePlan`）。
   *
   * ★几件事实一起交给它：那份**已经在手**的自装名字集合（可用性**只认 `names[]`**，集合建过一次）、
   *   三条端口在不在场、在途与失败，以及**同一枚**「去试试」计划（见下）。算出来 `undefined` 就是
   *   "这一枚**不画**那枚 `⋯`"——判据在纯投影里，本页不重写一份（中心装下来的 / 官方内置的那批因此
   *   **没有卸载入口**：画了就是在暗示能卸）。
   * ★★**本刀（用户冻结规格 §3：`去对话` 与 `去试试` 是同一个动作）**：
   *   · **动作**：那一行的写入口就是 `tryPlan.onTry` —— 卡片上那枚按钮按下去调的是**同一个闭包**；
   *   · **可点性**：那一行按不按得动取的是那一枚计划的 `disabled`（同一份事实，不另判一套）。
   *   于是"两处入口、一份实现"在**结构上**成立，而不是靠两处各写一遍长得像的代码。
   * ★传进来的正是 `groupNode` 里那一枚（**同一个对象**：它同时交给卡片那枚按钮）—— 表内按这枚计划的
   *   **对象身份**分了层，故"带计划"与"不带计划"两档不可能互相借到对方的缓存。
   */
  const moreOf = (name: string, tryPlan: EnterpriseEscSkillTryPlan): EscCardMore | undefined => morePlans(name, tryPlan)

  /**
   * 发起一次「去试试」（**界面上只有已装技能卡那枚按钮、以及「更多 → 去对话」那一行会调它**）。
   *
   * ★`draft` 是**计划层（`enterpriseEscSkillTryPlan` 的 `onTry` 闭包）拼好的那句指令**——
   *   两个入口走的是**同一个闭包**（见上面 `gotoChat` 那格），故"新会话 + 填草稿"这件事在本页
   *   只有**一处实现**、草稿也**只有一处**拼法（唯一构造器 `enterpriseEscSkillTryDraft`）；
   *   **只填不发送**（发送那一枚写入口在本仓根本不存在）。
   */
  const runSkillTry = useCallback((name: string, draft: string): void => {
    if (tryPending !== undefined) return
    if (fillSkillTryDraft === undefined) return
    setTryPending(name)
    setTryError(undefined)
    setTryNotice(undefined)
    // 同一张卡上同一时刻只说一件事（与 `beginSkillMore` 对称）。
    setMoreError(undefined)
    setMoreNotice(undefined)
    void fillSkillTryDraft(draft).then(
      (ok) => {
        if (ok) setTryNotice(enterpriseEscSkillTryFilledText(name))
        else setTryError({ name, code: ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE })
      },
      // 端口抛错与返回 false 同一条收束（都是"这一级没走成"），绝不静默。
      () => { setTryError({ name, code: ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE }) },
    ).finally(() => { setTryPending(undefined) })
    // ★**本刀**：依赖列正是这枚闭包读的两格（在途那一枚 + 写入口）——理由与 `beginSkillMore` 那条同。
  }, [tryPending, fillSkillTryDraft])
  /**
   * ★**本刀（技能页性能）**：本页那张「去试试」计划表（`useMemo` 建一次，按名取）。
   *
   * ★与 `morePlans` **逐条同因**；它排在这里而不是与 `morePlans` 并排，只有一个理由：
   *   它的执行器 `runSkillTry` 定义在下面（表要用**同一份**执行器，不是另造一枚）。
   */
  const tryPlans = useMemo(() => enterpriseEscSkillTryTable({
    wired: fillSkillTryDraft !== undefined,
    ...(tryPending === undefined ? {} : { pending: tryPending }),
    ...(tryError === undefined ? {} : { failure: tryError }),
    onTry: runSkillTry,
  }), [fillSkillTryDraft, tryPending, tryError, runSkillTry])

  /**
   * 某一枚技能 → 它的「去试试」计划（**唯一构造点**：上面那张 `tryPlans` 表，表内唯一投影是
   * `enterpriseEscSkillTryPlan`）。
   *
   * ★**本页恒 `installed: true`**：这一页的每一枚都是磁盘上真的装着的（真源＝官方发现面）⇒ 只要名字
   *   拼得出合法指令、那条官方链路在场，这一枚就**恒可点**（"已装却被禁用"在这页是自相矛盾的形态）。
   * ★键是**判据键**（`each.name`＝发现面的 kebab 名），**不是**给员工看的显示名 —— 显示名（如「会议纪要」）
   *   拼不出合法指令、也不在 `names[]` 里，拿它当键会让这两枚动作被静默禁用（见 `esc-installed-model.ts`）。
   * ★**本刀（技能页性能）**：它不再是"每卡现造一枚"，而是取表里那一枚（同一份状态下同一枚技能
   *   拿到的是**同一个对象**）—— `memo` 那层才判得出"props 没变"。
   */
  const tryNowOf = (name: string): EnterpriseEscSkillTryPlan => tryPlans(name, true)

  /** 组名带计数（括号里的数**只**统计这一组真的发现到的那些）。 */
  const groupTitleOf = (title: string, count: number): ReactNode =>
    createElement('h4', { className: 'esc-installed-group-title' }, `${title}（${count}）`)

  /**
   * 一节：组名 + 卡片网格。
   *
   * ★置灰与悬浮说明的判据只有一条：**这一枚有没有中心包 id**（`locked`）。
   *   有 ⇒ 真能拨（拨下去是卸载，host 侧 `POST …/skills/uninstall` 真的存在）；
   *   没有 ⇒ 置灰 + 写明原因（不是"忘了接线"，是本部署对**这一枚**没有卸载路由）。
   * ★元信息半句（版本/摘要）并进悬浮说明：卡片几何不许动，而这条事实必须**说得出**
   *   （它正是两份老记录降级之后**仅剩**的用途）。
   * ★**本刀**：每一张卡**同时**拿到两个计划（各**恰一处**、都从唯一那两枚纯投影来）——
   *   开关那一条判据与它的两句文案**逐字未改**（同一枚元素、同一份 props、同一个位次）。
   */
  const groupNode = (id: string, title: string, cards: readonly EnterpriseEscInstalledCard[]): ReactNode =>
    createElement(
      'section',
      { className: 'esc-installed-group', key: id },
      groupTitleOf(title, cards.length),
      createElement(
        'div',
        { className: 'esc-list-section' },
        cards.map(each => {
          const withMeta = (sentence: string): string => each.meta === undefined ? sentence : `${sentence}（${each.meta}）`
          const packageId = each.packageId
          /** 这一枚走不走**中心**那条卸载链（有中心包 id）；走不了的那一枚那枚开关置灰 + 写明原因。 */
          const centerWired = !each.locked && packageId !== undefined
          /**
           * ★**本刀（用户冻结规格 §3）**：「去试试」与「去对话」**共用这一枚计划**（**同一个对象**：
           *   上面交给卡片那枚按钮、下面交给「更多」里那一行）⇒ 两处入口的动作与可点性来自**同一份
           *   事实**，物理上不可能漂（门禁锁的正是"两处拿到的是同一个对象"这条结构事实）。
           */
          const tryNow = tryNowOf(each.name)
          return installedCard(
            each,
            centerWired ? busyId === packageId : true,
            withMeta(centerWired ? ENTERPRISE_ESC_LOCAL_COPY.centerUninstallTitle : ENTERPRISE_ESC_LOCAL_COPY.selfInstalledLocked),
            centerWired ? (next: boolean) => { if (!next && busyId !== packageId) uninstall(packageId) } : () => undefined,
            // ★两个计划各**恰一处**（判据键＝发现面的 kebab 名，见 `esc-installed-model.ts` 那一格）。
            moreOf(each.name, tryNow),
            tryNow,
          )
        }),
      ),
    )

  const settled = discovery.kind !== 'loading'
  const allEmpty = settled && discovery.kind === 'ready' && total === 0

  return createElement(
    'div',
    { className: 'esc-content' },
    createElement(
      'div',
      { className: 'esc-installed-head' },
      createElement(Button, {
        variant: 'outline',
        size: 'sm',
        className: 'esc-installed-back',
        onClick: onBack,
        icon: createElement(ArrowLeft, { size: 14, 'aria-hidden': true }),
        children: ENTERPRISE_ESC_LOCAL_COPY.installedBack,
      }),
      createElement(
        'span',
        { className: 'esc-installed-title' },
        `${ENTERPRISE_ESC_LOCAL_COPY.installedTitle}（${total}）`,
      ),
      /**
       * ★**口径 54**：官方还没发现完 ⇒ 当场说出来（`role="status"` 是"过程事实"的正确语义，
       * 不是 `alert`：这不是失败）。句子里一个数字都没有 —— 用户裁决「不许当 0、不许写死数字」。
       */
      discovering
        ? createElement(
            'span',
            { className: 'esc-installed-discovering', role: 'status' },
            ENTERPRISE_ESC_LOCAL_COPY.installedDiscovering,
          )
        : null,
    ),
    actionCode === undefined
      ? null
      : createElement(EnterpriseErrorNotice, { className: 'esc-installed-error', code: actionCode }),
    /**
     * ★元信息读不到**必须说出来**（本仓硬纪律"不许静默吞失败"）：它不影响列表（列表来自真源），
     *   但它决定了"能不能在这里卸载"与那半句版本/摘要 —— 静默吞掉会让员工以为
     *   "这枚技能本来就不能卸"。走唯一提示件（人话 + 下一步 + 稳定码）。
     */
    meta.kind === 'failed'
      ? createElement(EnterpriseErrorNotice, {
          className: 'esc-installed-error',
          code: meta.code,
          prefix: ENTERPRISE_ESC_LOCAL_COPY.installedMetaFailed,
        })
      : null,
    /**
     * ★**本刀**：那两枚本机动作的**成功交代**（「已卸载…」/「已打开…」）。
     *
     * 落点与另三处（广场网格 / 精选行 / 企业技能目录）**同一条**：`.esc-catalog-status` + `role="status"`
     * + 同一枚 `data-esc-skill-more-notice` 钩子——**零新增 CSS 类**、一句话也不在这里现编
     * （两句都出自 `esc-skill-more.ts` 那枚唯一事实层）。
     * ★为什么必须说出来：卸载成功之后那一行**会**从列表里消失，但"为什么消失"只有这句话说得清；
     *   打开文件夹那一下的可见结果在**系统文件管理器**里，界面这一侧不留一句就等于"点了没反应"。
     * ★次序是确定的（先「更多」后「去试试」）：两边开始时都会清掉对方那两句（见两个执行器），
     *   故同一时刻只可能有一句上屏。
     */
    moreNotice === undefined
      ? null
      : createElement('p', {
          className: 'esc-catalog-status',
          role: 'status',
          'data-esc-skill-more-notice': 'true',
          children: moreNotice,
        }),
    tryNotice === undefined
      ? null
      : createElement('p', {
          className: 'esc-catalog-status',
          role: 'status',
          'data-esc-skill-try-notice': 'true',
          children: tryNotice,
        }),
    createElement(
      'div',
      { className: 'esc-scroll esc-scroll-hidden' },
      discovery.kind === 'loading'
        ? loadingNode()
        : discovery.kind === 'failed'
          ? hintNode(
              'esc-installed-hint',
              createElement(
                'span',
                null,
                ENTERPRISE_ESC_LOCAL_COPY.installedGroupFailed,
                createElement('code', { className: 'esc-state-code' }, discovery.code),
              ),
            )
          : allEmpty
            ? createElement(
                'div',
                { className: 'esc-state' },
                createElement(
                  'div',
                  { className: 'esc-empty-art', 'aria-hidden': 'true' },
                  createElement(Inbox, { size: 28, strokeWidth: 1.5 }),
                ),
                createElement('div', { children: ENTERPRISE_ESC_LOCAL_COPY.installedEmpty }),
              )
            // 分节顺序取 `ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS`（系统内置 → 来自内部市场 → 来自外部市场
            // → 用户自定义）：顺序的真源只有 `esc-installed-model.ts` 那一处。★空态那句说的是**账上没有**
            // 而不是"这台机器上没有技能"（机器上扫到的那些在「本地三方」里），见 `installedEmpty` 的注释。
            : groups.map(group => groupNode(group.id, group.title, group.cards)),
    ),
    // 真源那一趟读不到 ⇒ 给一枚真重试（它是"列表从哪来"的唯一来源，读不到就没有可看的东西）。
    discovery.kind === 'failed'
      ? createElement(Button, {
          variant: 'outline',
          size: 'sm',
          className: 'esc-installed-retry',
          onClick: () => setReloadToken(token => token + 1),
          children: ENTERPRISE_ESC_LOCAL_COPY.retry,
        })
      : null,
  )
}
