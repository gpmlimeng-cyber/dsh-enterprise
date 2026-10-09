/**
 * [INPUT]: 依赖 React 的 hook 原语、官方原语 `Button`、`esc-api` 的取数面、`esc-categories`/`esc-list` 两个数据 hook、
 *   `esc-card`/`esc-toolbar`/`esc-style`/`esc-third-party-list`/`esc-catalog-list`/`esc-connector-plaza` 的展示件、
 *   `esc-catalog` 的纯投影、`skill-market` 的**唯一**取数源工厂（口径 53 复用）与 `esc-copy` 的文案
 * [OUTPUT]: 对外提供 `EnterpriseEscAggregation`——工具栏 + 卡片网格 + 触底加载 + 三态（骨架/失败/空）
 * [POS]: esc 页面的**内容区**，移植自 NUWAX `ResourceAggregation/index.tsx`（831 行）里**本刀范围内**的那部分。
 *   ★留下了什么：主 tab 与二级分类状态、搜索 400ms 防抖、团队空间维度的两种寻址（具体空间 `spaceId` / 「全部」
 *   经 `spaceIds` 聚合）、`waitingSpace` 判定、首屏加载、触底加载、**不满屏自动补拉**（含窗口 resize 重判）、
 *   空态文案（`暂无数据`，原文如此）。
 *   ★**口径 35④**：首屏加载态与官方对齐——官方那一态是 `components/custom/Loading`（转圈 + 「加载中...」），
 *   本页原先自造了六张骨架卡；现换成同一枚（条件判据 `(loading || waitingSpace) && list.length === 0` 未变）。
 *   ★**没有**什么（A 档口径，逐条可查）：付费订阅拦截、专家召唤、技能立即使用、收藏/取消收藏、连接器连接/断开、
 *   连接启用开关、技能启用开关、四个业务弹窗（凭据/设备授权/统一专家卡/订阅套餐）。那些动作位在卡片上**置灰并在
 *   `title` 里写明原因**，不是删掉。
 *   ★三处**如实差异**：① 原页面把筛选状态同步到 URL（`history.replace`）以便刷新/分享还原——DSH 的独立页面
 *   没有这个页内 URL，故去掉（左栏重复点击驱动的整区刷新仍按原文用 `key` remount 实现）；
 *   ② 原页面读不到数据时静默画空态，这里画出**失败态 + 稳定码 + 重试**；
 *   ③ 未登录（平台回 401）单独成一态：写明"请先登录 NUWAX 账号"，而不是显示成"平台没有数据"。
 *   ★`react-infinite-scroll-component` 换成容器自身的 `onScroll` 判据。
 *   ★**本刀（用户裁决「移动端页面不要冻结、支持全屏滚动」）**：滚动面在两种档位下**不是同一个元素**——
 *   桌面档是列表（`.esc-scroll`，工具栏钉死）；移动档（触屏/窄/矮）整个内容区（`.esc-content`）才是滚动面
 *   （样式表那条 @media 定的）。因此触底加载与「不满屏自动补拉」都改成**问真正在滚的那一个**
 *   （`activeScroller()`：判据是真实溢出，不是 `matchMedia`——断点只有一个真源）。
 *   ★**本刀（用户裁决②③⑧ + 补半成品）**：① 顶栏「已安装(N)」的计数**真正接线**了——上一刀只定义了
 *   `installedCount` 这个 prop 却没人去读那份清单，真机截图里「已安装」光秃秃没有数字。
 *   本刀经 `api.installedSkills()`（复用 `GET /skills/installed` 那份**既有真值**，不是新接口）读一次，
 *   **只在技能页读**；`undefined`＝没读到真值（工具栏按用户裁决把数字位画 `(0)`，并用 `title` 说清
 *   "这是暂定值"）、数字＝真读到了。★**用户裁决（读不到 ⇒ 0）**：这两态在按钮上同形，如实交代全在 title。
 *   ② 技能卡的「+」与「更多+去试试」按**已装清单**分流。★**匹配键是名字，不是 id**（实测纠正）：
 *   已装那份的 `packageId` 是雪花号（实测 `2105915576743428098`）、广场那条的 `id` 是 `4194`，
 *   两套坐标系对不上；真正的公共键是 kebab 名（已装 `skillId` / 广场 `name`）。
 *   ★**口径 43（本刀）**：这份 `installedIds` 现在也交给**精选行**（技能页）——那一行的卡片已改成
 *   广场那张卡，已装分流必须同源，否则同一条技能在上面写「+」、下面写「更多 + 去试试」。
 *   ★**口径 46/47**：新增 `skillPort`（本机技能写入口）与 `onOpenInstalled`；本地导入走**与商城页同一枚**
 *   `useEnterpriseSkillImport`，隐藏选择器与三态反馈挂在工具栏下方一格（触发钮在哪棵树，落点就在哪棵树）。
 *   ★**口径 60（本刀）**：技能页那条本地导入通路改走**队列驱动器** `useEnterpriseSkillImportQueue`
 *   （内部仍持同一枚单件状态机，见 `skill-import-port.tsx` 的长注释）＋**导入弹窗**
 *   `EnterpriseSkillImportDialog`（官方 Modal；拖拽区 + 多选按钮 + 逐项状态 + 批量摘要 + 装中禁关 +
 *   成功 toast/自动关闭）。`onAddSkill` 从此只**开窗**（不再点隐藏选择器）；本层新增的那一格状态
 *   `skillImportOpen` 就是这枚弹窗的开合。★**恒不可见选择器这张叶子仍在**（商城页照旧用它，一字未动）
 *   —— 本刀只换掉技能页这一条的入口形态，不删任何既有实现（门禁有反向锁盯着这条）。
 *   ★**口径 49（本刀）**：新增 `draftPort`（技能页下拉里「查找技能 / 创建技能」的实现面）——
 *   本层持那枚下拉的**开合态**与**预填失败态**（工具栏是纯投影、不持 hook），失败走唯一提示组件 +
 *   稳定码 `ENT_ESC_DRAFT_UNAVAILABLE`（人话 + 下一步在唯一码表里）；两项的调用**只有** `draftPort.launch`
 *   这一个出口，它内部就是 `preset-launch.ts` 的"跳新会话 + setDraft、**不发送**"——本层没有第二个开会话端口，
 *   也没有任何发送出口（门禁源码级反向锁）。
 *   ★**口径 51**：新增 `onOpenMyExperts`（专家页那枚「我的专家」切子页的入口，由页壳持有视图状态）
 *   ——本层只是把它原样交给工具栏（与 `onOpenInstalled` 同一条注入范式）。
 *   ★**用户裁决（读不到 ⇒ 0）**：顶栏计数读不到时，本层**照旧**把 `installedCount: undefined` +
 *   `installedCountFailed: true` 交上去（**计数来源与请求次数/时机一字未动**），由工具栏把数字位画成
 *   `(0)` 并在 title 里说明"这是暂定值"——本层不写假数、不吞失败，也不新增请求。
 *   ★**口径 62（本刀）**：技能页第三枚维度「本地三方」（本地三方 Agent 技能源）——
 *     本层持**一份**扫描真值（`api.thirdPartySkills`）与选中的来源根：为什么提到这一层而不在内容区里取
 *     ——**chip 行住在工具栏、候选列表住在内容区**，两者必须认同**同一份**真值与**同一枚**
 *     选中 key（否则就是“子组件 fetch → 回调 setState → 父组件重渲染 → 子组件重建取数源”那种自激）；
 *     chip 行的投影与过滤走 `esc-third-party.ts` + `esc-sub-tabs.ts` 两份**纯函数**（本层只接线）；
 *     内容区那一块只管“一次一条在途”的安装动作（成功后重扫本维度 + **复用**口径 46 那枚 `installedRefreshToken`）。
 *   ★**口径 54（本刀）**：「已安装」真源换成**官方发现面**（`api.discoveredSkills()`）—— 广场/精选
 *     卡片的已装判定键由纯投影 `installedSnapshotFacts(snapshot)` 给出（`names` / `discovering`
 *     **两件事实**同源）；两份老记录**退出"哪些名字算装过"的判据**（降级为子页的来源/元信息）。
 *     三态纪律保留，`complete === false` 是第四态。
 *   ★**本刀（用户最终裁决：`已安装` = DSH 装过的那本账 + 同一个词在同一屏上只指一个数）**：
 *     顶栏那个数**不再**是发现面枚数，而是 **`enterpriseEscInstalledCount(发现面快照, 两份记录)`**
 *     —— 与「已安装」页页头**同一个纯投影的两个消费者**（判据只有 `esc-installed-model.ts` 一处）。
 *     为此这一层多读一趟**中心已装记录**（与自装记录**串行同趟**，任一条失败即整趟降级 + 如实说
 *     "读不到"）；`installedSnapshotFacts` 因此收成**两件**事实（`count` 从它里面**搬走**了：
 *     留一个"发现面枚数"在那里，就是让同一个词在同一屏上有第二个数）。
 *   ★**口径 53（本刀）**：技能页**第四枚**维度「企业技能」——本层持**一份**目录真值
 *     （`createEnterpriseSkillListSource`，与「企业设置 → 技能」那页**同一个工厂**，不新造取数器/路由/解码器）
 *     与选中的二级分类：为什么提到这一层而不在内容区里取 —— 与「本地三方」**逐条同因**
 *     （**chip 行住在工具栏、卡片住在内容区**，两者必须认同同一份真值与同一枚选中 key，
 *     否则就是"子组件 fetch → 回调 setState → 父组件重渲染 → 子组件重建取数源"那种自激）；
 *     chip 行的投影走 `esc-catalog.ts` 的 `enterpriseCatalogSubChips`（**取响应自己的 `category`**）
 *     + `esc-sub-tabs.ts` 那份通用机制；内容区那一支（`esc-catalog-list.tsx`）只管画与发动作
 *     （**真的能装**：写入口是企业技能端口上那枚 `installSkill`，成功以 Host 回传的最新清单为准，
 *     并**复用**口径 46/62 那枚 `installedRefreshToken` 请顶栏计数重读）。
 *   ★**口径 64（本刀）**：技能页**第一枚**维度「系统广场」那批 NUWAX 已发布技能的【＋】**真的接上**——
 *     终态由 `esc-system.ts` 的纯投影 `escSystemInstallPlan` 给（七档：可点 / 本枚在途 / 被别的在途挡住 /
 *     记录缺安装坐标 / 发布者不允许复制 / 需要付费 / 端口缺席），写入口是技能端口上**并列**的那一枚
 *     `installPublishedSkill`（`packageId` 那条路一字未动，两条路各只有一个调用点）；
 *     本层持三件状态（在途那一枚 / 失败落在哪一行 / 刚成功那一句），成功只把 Host 回传清单里的名字
 *     **并进**已装集合再**复用同一枚** `onInstalledRefresh` 请官方发现面重读（**不乐观翻态**）。
 *   ★**本刀（S5a：技能卡「更多」里的两个本机管理动作）**：本层多持**四件状态**——本机自装清单真值
 *     （`GET /skills/self-installed`，**可用性判据的唯一来源**，随既有的 `installedRefreshToken` 一起重读）、
 *     在途那一枚（`name` + 是哪枚动作）、失败那一行（`name` + 稳定码 + 是哪枚动作）、成功那一句；
 *     唯一计划工厂 `moreOf`（纯投影 `escSkillMorePlan`）把「这一枚能不能卸 / 能不能打开文件夹」
 *     交给**广场网格与精选行这两处**（同一个函数 ⇒ 不可能一处画得出、一处画不出）。
 *     成功以 Host 回执为准（卸载回执里的 `skills` 覆盖那份清单）+ **复用同一枚** `onInstalledRefresh`；
 *     自装清单读不到时不静默（出一句 `role="status"` 的降级交代）。
 *   ★**本刀（Phase C D1：连接器广场）**：**连接器页「系统广场」那一格整段换掉**——判据是
 *     `resourceType === 'connector' && source === 'system'`（维度与资源类型这一对，不是"列表为空"），
 *     内容由新叶 `esc-connector-plaza.tsx` 铺：它自带那台**唯一**的四态取数源
 *     （`createEnterpriseListSource`，端口是新增的 `connectorPort`，只有只读一格）
 *     ⇒ 本层**不新造取数器、不加路由、不碰平台那条目录面**，只把端口与已防抖的搜索词原样交下去。
 *     ★**连接器页另外两格（团队空间 / 已连接的）一字未动**：它们仍走共享列表那一支（本刀非目标）；
 *     那一格的二级分类胶囊也随数据面一起退场（`esc-categories.ts` 里同一条短路，见那一处推理）。
 *   ★**本刀（S5b：技能卡那枚「去试试」真的能用）**：本层再多**三件状态**（在途那一枚技能名 / 失败那一枚 +
 *     稳定码 / 刚办成那一句）与**一个计划工厂** `tryOf`（纯投影 `enterpriseEscSkillTryPlan`，见 `esc-skill-try.ts`）：
 *     它把「这一枚能不能试 / 为什么不能试 / 在途写什么」交给**广场网格与精选行这两处**（同一个函数）。
 *     写入口是技能端口上那格 `fillSkillTryDraft`（`client.tsx` 接在**同一枚** `createEnterprisePresetLauncher`
 *     上：跳新会话 + 写输入框、**不发送**）。一次一条只禁**正在跑的那一枚**（不占本机资源、不抢工作区）；
 *     成功只留一句如实交代（**不开新页面**、也**不宣称已发送**），失败出唯一提示件 + 稳定码
 *     `ENT_SKILL_TRY_LAUNCH_FAILED`（落在**这一枚卡片**上；与「更多」那两枚共用一个失败位）。
 *   ★**本刀（技能卡规格：`analysis/esc-skill-card-spec.md` §1①② / §2）**——本层是**广场那一侧**的接线：
 *     ① **广场（系统广场 + 团队空间两个维度）默认不显示已安装的卡片**：新增 `visibleList`——判据是
 *        **同一个**纯函数 `enterpriseEscSkillCardHidden`（`esc-skill-card.ts`，精选行调的也是它），
 *        即"磁盘上已有同名技能"（`installedIds` ＝官方发现面，**不是账本**：账本没记、盘上却有的那些
 *        点下去只会撞 `ENT_SKILL_NAME_CONFLICT`）；**去掉**（`filter`）而不是灰化/打标，
 *        且**刚装的那一枚例外**（`cardMark`，见下）。★那一支的闸只有 `resourceType === 'skill'`
 *        （**不看 `source`**）⇒ 系统广场与团队空间是同一条规则，不是两套。
 *     ② **刚装那一枚留在原地**：新增 `cardMark`（唯一 reducer `enterpriseEscSkillCardMarkState`）——
 *        安装成功（`runSystemInstall` 的成功分支）派发 `installed`；**列表重读 / 切维度**派发 `relist`
 *        （`relistCards` 唯一出口，五个调用点：切维度 / 切资源类型 / 换分类 / 改搜索词 / 失败重试）。
 *        ⚠**安装成功之后那次自动重读不算 `relist`**（它是这次安装动作自己的收尾；算进去标记就会在
 *        同一次动作里被撤掉，那个例外永远看不见）——判据在 reducer 的 `ownRead` 那一格。
 *     ③ **卡片入参的唯一装配点**：新增 `installOf`（`escSystemInstallPlan` + `enterpriseEscSystemCardInstall`
 *        在本层**唯一**的构造点）与共享投影 `enterpriseEscSkillCardSpec`（网格里 `cardProps` 那一处；
 *        **精选行调的是同一个函数**，且 `installOf` / `moreOf` / `tryOf` 三个工厂都是**同一枚**交下去、
 *        `justInstalledSkillName` 用的是**同一枚**标记）—— 故同一份夹具下两处入参**逐键相等**
 *        （规格 §2 那条"精选卡与广场卡接同一份安装计划"；改前精选行少递那一格 ⇒ 精选卡退回兜底形态、
 *        把「这类技能没有可下载的技能包…」铺成独立一行，就是用户真机看到的"描述三行"）。
 *     ④ **高度同源只落在"广场那张刚装卡"上**（用户裁决②）：刚装那一枚多包一层既有的
 *        `.esc-catalog-cell`，并在那一格上打 `data-esc-skill-just-installed="true"` ——
 *        `esc-style.ts` 那条"「去试试」与【＋】同高"的规则**挂在这枚属性下**；已安装页（没有安装按钮、
 *        那句话管不到它）回到官方 `.sm` 原状。另两档（普通未装卡 / 带失败块那一行）结构**一字未动**。
 *     ⑤ **第三条"为什么空"**（真话）：`enterpriseEscSkillAllInstalledEmpty({listed, visible})` ——
 *        `list.length > 0` 而 `visibleList.length === 0` 时，`EmptyBlock` 说"这个维度里的技能都已经装到
 *        本机了" + 下一步（两句都用**既有**类名，零新增 CSS）；`listed === 0`（真没有数据）才走既有那一态。
 *   ★**本刀（技能页性能：「不再白算」那一半）**：上面那三个计划工厂的**身体**搬进了三张计划表，
 *     本层只留"按名取"（`installOf` / `moreOf` / `tryOf` 三个名字与签名一字未改，交下去的还是**同一枚**）：
 *     `selfInstalledNames`（`enterpriseEscSelfInstalledNames` 的产物，**只建一次**）、
 *     `tryPlans`（`enterpriseEscSkillTryTable`）、`morePlans`（`enterpriseEscSkillMoreTable`）、
 *     `installPlans`（`enterpriseEscSystemInstallTable`）——四者都在 `useMemo` 里，依赖是真值引用与状态标量。
 *     **为什么非改不可**：`EnterpriseEscCard` 是 `memo` 包的，判据是 props **逐键浅相等**；
 *     改前这三个工厂**每渲染一次、每张卡一次**都现造一枚新对象 ⇒ memo 每次都判"变了"、
 *     几百张卡整页重画（真机："技能页很卡，hover 也卡"）；改后同一份数据 + 同一份状态下
 *     同一枚技能取到的是**同一枚对象** ⇒ 卡能真的被跳过。**界面样子一个像素都没动**：取到的计划
 *     逐字段与改前同一份纯投影算出来的完全一样（纯投影本身一个字未改）。
 *   ★**本刀收尾（技能页收尾 ③：新增 SkillHub 维度）**：第四枚维度由「企业技能」换成 `SkillHub`
 *     （用户裁决「那一枚的名字与来源都换」；位次与数量一字未动）。本层因此多三件：
 *     ① **取数**——`api.onlineSearchSkills`（**既有**那条在线搜索本机路由的委托），查询串就是工具栏那一枚
 *        已防抖的输入框值（本维度**不新造第二个搜索框**）；**没到下限一条请求都不发**（判据复用
 *        `online-search.ts` 的 `enterpriseOnlineQueryState`）；失败只记 `{kind:'failed', code}`（**绝不回落
 *        空列表**），换关键词/换维度即 abort（迟到结果不回填）；★**v1 的已知浪费如实登记**：那条路由是
 *        四源 fan-out，而本维度只投影 `skillhub.cn` 那一批（判据在 `esc-skillhub.ts`）⇒ 另三源的结果被
 *        界面侧丢掉；省掉它只能给那条路由加 `source` 参数（要动 `platform-client`，本刀禁改）。
 *     ② **一格整段替换的内容区**——`source === 'skillhub'` ⇒ 新叶 `EnterpriseEscSkillHub`（有状态包装：
 *        在途那一条 / 失败落在哪一条 / 刚成功那一句 + 唯一执行路 `runInstall`，超时 120s 与另两条安装
 *        通路同一个数字）；成功以宿主回执为准（只把那条坐标记进"本次会话已装"）+ **复用**本层那一枚
 *        `onInstalledRefresh`（装了东西请计数重数一遍，本页仍只有这一条机制）。
 *     ③ **分类行显式压掉**——这一维**不做分类 chip**（v1 明令），故显式给一枚**空 chip 行**
 *        （`subTabs: { chips: [] … }`），否则工具栏会退回"后端分类那一支"（平台那棵分类树，与本维度无关）。
 *     ★另：**「本地三方」与「SkillHub」两支都把同一对 `moreOf`/`tryOf` 交下去**（已装那一档那两枚按钮
 *     与广场网格同源 ⇒ 同一枚技能在三处不可能给出两个答案）；「企业技能」那一支（`source === 'catalog'`）
 *     与 `EnterpriseEscCatalog` 的接线**本刀按 ① 一字未动**（它仍手拼卡片，与「已安装」并列登记为下一刀收编）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Inbox, LoaderCircle } from 'lucide-react'
import { createElement, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { EnterpriseEscApi } from './esc-api.js'
import { enterpriseLocalErrorCode } from '../local-api.js'
import { EnterpriseEscCard } from './esc-card.js'
import { useEnterpriseEscCategories } from './esc-categories.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import { useEnterpriseEscResourceList } from './esc-list.js'
import {
  ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY,
  enterpriseEscSkillAllInstalledEmpty,
  enterpriseEscSkillCardHidden,
  enterpriseEscSkillCardMarkState,
  enterpriseEscSkillCardSpec,
  type EnterpriseEscSkillCardMarkState,
} from './esc-skill-card.js'
import { ENTERPRISE_ESC_DRAFT_FAILED_CODE, ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE, enterpriseErrorAction, enterpriseErrorMessage, enterpriseErrorRetryable } from '../error-messages.js'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { EnterpriseEscFeatured } from './esc-featured.js'
import { EnterpriseEscResourceTabs } from './esc-resource-tabs.js'
import { EnterpriseEscToolbar } from './esc-toolbar.js'
import { EnterpriseEscThirdPartyList } from './esc-third-party-list.js'
import { EnterpriseEscSkillHubList } from './esc-skillhub-list.js'
import { enterpriseSkillHubInstalledText } from './esc-skillhub.js'
import { enterpriseOnlineQueryState } from '../online-search.js'
import { createEnterpriseThirdPartyInstaller } from './esc-third-party-install.js'
import { enterpriseThirdPartyInstalledText, enterpriseThirdPartySubChips } from './esc-third-party.js'
import { EnterpriseEscCatalog } from './esc-catalog-list.js'
import { enterpriseEscInstalledCount, enterpriseEscInstalledMetaTable } from './esc-installed-model.js'
import { enterpriseCatalogSubChips } from './esc-catalog.js'
import { EnterpriseEscConnectorPlaza } from './esc-connector-plaza.js'
import { EnterpriseEscSystemInstallFailure } from './esc-system-list.js'
import {
  ENTERPRISE_ESC_SYSTEM_INSTALL_TIMEOUT_MS,
  enterpriseEscSystemInstalledNames,
  enterpriseEscSystemInstallTable,
  enterpriseEscSystemInstalledText,
} from './esc-system.js'
import {
  ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS,
  enterpriseEscSelfInstalledNames,
  enterpriseEscSkillMoreRevealedText,
  enterpriseEscSkillMoreTable,
  enterpriseEscSkillMoreUninstalledText,
  type EnterpriseEscSkillMoreAction,
  type EnterpriseEscSkillMoreFailure,
  type EnterpriseEscSkillMorePending,
} from './esc-skill-more.js'
import {
  enterpriseEscSkillTryFilledText,
  enterpriseEscSkillTryTable,
} from './esc-skill-try.js'
import type { EscCardMore } from './esc-more-menu.js'
import type { EscCardInstall, EscCardTryNow } from './esc-card.js'
import type { EnterpriseEscSkillTryPlan } from './esc-skill-try.js'
import { ENTERPRISE_ESC_SUB_TAB_ALL_KEY, enterpriseEscSubTabFilter, enterpriseEscSubTabs } from './esc-sub-tabs.js'
import type { EnterpriseListState } from '../list-state.js'
import type { EnterpriseDiscoveredSkill, EnterpriseInstalledSkill, EnterpriseSelfInstalledSkill } from '../skill-api-decode.js'
import type { EnterpriseOnlineSkillSearch, EnterpriseThirdPartySkills } from '../skill-api-decode.js'
import type { EnterpriseSelfInstalledUninstall } from '../skill-api-decode.js'
import { EnterpriseSkillImportDialog } from '../skill-import-dialog.js'
import { useEnterpriseSkillImportQueue } from '../skill-import-port.js'
import { createEnterpriseSkillListSource, type EnterpriseSkillListPayload } from '../skill-market.js'
import type {
  EnterpriseEscAddSkillLock,
  EnterpriseEscConnectorPort,
  EnterpriseEscDraftKind,
  EnterpriseEscDraftPort,
  EnterpriseEscSkillPort,
  ResourceItem,
  ResourceSourceEnum,
  ResourceTypeEnum,
} from './esc-types.js'



/** 触底判据的提前量：距底 80px 就拉下一页（原 `InfiniteScroll` 的默认手感）。 */
const SCROLL_THRESHOLD_PX = 80

/**
 * 触底判据（纯函数，`handleScroll` 与门禁共用同一条）。
 *
 * ★**本刀修的就是这里**（真机故障「下滑加载中不起作用、会一直闪屏」）。原判据只看"离底多近"，
 *   **从不问 `hasMore`**：平台已经回过"没有下一页"（实测 `/api/published/skill/list` ⇒ `current:1
 *   pages:1 total:7`，本页 7 条；再要第 2 页 ⇒ `records: []` 且 `pages: 1`），可手指一到底部就一遍遍
 *   发同一条取不到东西的请求（Android 在回弹/按压期间**会持续发 scroll**），每次都在列表末尾插一行
 *   「加载中…」再拆掉 ⇒ 看到的正是"加载不起作用"+"一直闪"。
 *   上一刀把滚动面从列表那口小格子挪到整页（用户裁决「不要冻结、支持全屏滚动」）之后，手指才**够得着**
 *   这个触发点——所以它是那一刀**暴露**出来的老洞，不是新写坏的。
 * ★另外两条同源纪律：请求在途时不再叠加（`loading`）；本筛选集下已判定"补拉无进展"时不再自动重试
 *   （`suppressed`，见 `decideAutoFill`）。用户换筛选条件/点重试会解闩。
 */
export function shouldTriggerBottomLoad(input: {
  readonly scrollHeight: number
  readonly scrollTop: number
  readonly clientHeight: number
  readonly hasMore: boolean
  readonly loading: boolean
  readonly suppressed: boolean
}): boolean {
  if (!input.hasMore || input.loading || input.suppressed) return false
  return input.scrollHeight - input.scrollTop - input.clientHeight <= SCROLL_THRESHOLD_PX
}

/** 「不满屏自动补拉」的三态裁决（纯函数）。 */
export type AutoFillDecision =
  /** 滚动面确实不满屏且还有下一页 ⇒ 补一页。 */
  | 'pull'
  /** 不需要补（已经能滚 / 没有下一页 / 正在加载 / 列表还空着）。 */
  | 'idle'
  /** 上一次补拉**没有让列表变长** ⇒ 上闩停手（否则每 100ms 一次，就是"一直闪"）。 */
  | 'suppress'

/**
 * 「列表没填满滚动面 ⇒ 自动补拉」判据。**上一刀把滚动面挪到整页时这里踩了两个洞，本刀一起堵：**
 *
 * ① **两个高度必须来自同一个盒子**。旧写法是「卡片区 `.esc-list-section` 的 scrollHeight」比
 *    「滚动面的 clientHeight」。桌面档滚动面就是那口格子、里面只装卡片，比得公平；手机档滚动面是
 *    **整页** `.esc-content`（工具栏/精选/维度/分类全在里面），卡片区只是它的一部分 ⇒ 卡片**永远**
 *    比"视口"矮 ⇒ 判据恒真，一路把页拉光（问错了盒子）。
 *    现在问滚动面**它自己**：`scrollHeight <= clientHeight + 1` 就是"这个面没东西可滚"。
 * ② **补拉必须有进展**。列表长度与上次补拉时相同（空页、同批页、或请求失败）⇒ 再补也是同一结果，
 *    直接上闩（返回 `suppress`），由调用方置位并停止自动补拉。
 */
export function decideAutoFill(input: {
  readonly scrollerScrollHeight: number
  readonly scrollerClientHeight: number
  readonly hasMore: boolean
  readonly loading: boolean
  readonly listLength: number
  /** 上一次补拉发起时的列表长度（-1 = 本筛选集下还没补拉过）。 */
  readonly previousLength: number
  readonly suppressed: boolean
}): AutoFillDecision {
  if (input.suppressed) return 'idle'
  if (input.loading || !input.hasMore || input.listLength === 0) return 'idle'
  // 补过一轮但列表没长 ⇒ 空页/同批页/失败，再补也是同一结果
  if (input.previousLength >= 0 && input.listLength === input.previousLength) return 'suppress'
  return input.scrollerScrollHeight <= input.scrollerClientHeight + 1 ? 'pull' : 'idle'
}

/**
 * ★**口径 54**：官方发现面的一次快照 → 广场卡片要用的**两件事实**（唯一投影）。
 *
 * 为什么非要抽成纯函数：本仓 vitest 跑不了 hook，而这两件事**必须同源**（同一份假响应喂进去，
 * 两处必须得到同一个结论）—— 只有把这条投影抽出来，"同源"才能被机器判据证明，
 * 而不是靠"看代码里两处写的都是 snapshot"。
 *
 * 两件事实：
 *   · `names` —— 广场卡片/精选行判"已装"用的**名字集合**（口径 47 那把公共键，口径 54 起
 *     对撞的是**磁盘真值**：报告里有这个名字就是真的装着）；★它**不是计数**（两者是两件事：
 *     "这一枚在不在磁盘上" vs "这一枚在不在 DSH 那本账上"）。
 *   · `discovering` —— 官方自己说"还没发现完"（`complete === false`）：这个数**还会变**，
 *     工具栏据此换掉 title（**不许当 0、不许写死数字**）。
 *
 * ★**本刀：`count` 从这条投影里搬走了**（用户裁决「已安装 = DSH 的账」+「同一个词在同一屏上只指
 *   一个数」）：顶栏那个数现在由 `esc-installed-model.ts` 的 **`enterpriseEscInstalledCount`** 算，
 *   与页头是**同一个纯投影的两个消费者**。留一个"发现面枚数"的 `count` 在这里，就是让同一个词
 *   在同一屏上有第二个数 —— 那正是本刀要消灭的东西。
 *
 * @param snapshot - `api.discoveredSkills()` 的返回值。
 * @returns 已装判定键 / 是否还在发现中。
 */
export function installedSnapshotFacts(snapshot: {
  readonly skills: readonly { readonly name: string }[]
  readonly complete: boolean
}): { readonly names: ReadonlySet<string>; readonly discovering: boolean } {
  return {
    names: new Set(snapshot.skills.map(each => each.name)),
    discovering: snapshot.complete === false,
  }
}

/** 内容区入参。 */
export interface EnterpriseEscAggregationProps {
  readonly api: EnterpriseEscApi
  /** 资源类型（左栏选中项）。 */
  readonly resourceType: ResourceTypeEnum
  /**
   * ★用户裁决④：切换资源类型（**含「重复点当前项也要重拉**，与原页面那个 `_t` 令牌同义**）。
   * 由 `esc-page` 持有状态与刷新令牌，本层只负责把页签的点击交上去。
   */
  readonly onResourceTypeChange?: ((code: ResourceTypeEnum) => void) | undefined
  /**
   * ★口径 46：本机技能写入口（本地导入 + 自装清单 + 卸载）。
   *
   * 缺席 ⇒ 工具栏那枚「添加技能」回到"置灰 + 写明原因"那一态（不画一枚点了没反应的选择器）。
   * ★它**不进** `api`（那一面是结构性只读的，见 `esc-types.ts` 的长注释）。
   */
  readonly skillPort?: EnterpriseEscSkillPort | undefined
  /** ★口径 47：「已安装」那枚的入口（由页壳切视图；缺席即置灰写明原因）。 */
  readonly onOpenInstalled?: (() => void) | undefined
  /**
   * ★**口径 51**：专家页那枚「我的专家」的入口（由页壳切到「我的专家」子页）。
   *
   * 与 `onOpenInstalled` 同一条：缺席即置灰 + 行上写明原因（判据是端口，不是写死的 disabled）。
   * ★它**不带数据面**：子页今天要不到清单（本部署没有那条只读接口），内容区是一句如实交代
   *   （见 `esc-my-experts.tsx` 的头注）——故这里就**没有**第二枚端口要往下传。
   */
  readonly onOpenMyExperts?: (() => void) | undefined
  /**
   * ★**口径 49**：技能页主按钮下拉里「查找技能 / 创建技能」那两项的**实现面**
   * （跳新会话 + 把提示词预填进输入框、**不发送**）。
   *
   * 缺席 ⇒ 那两项置灰 + 写明原因（`esc-toolbar` 那一侧按"端口在不在场"判，不写死 disabled）。
   * ★它**不进** `api`（那一面是结构性只读的），也**不是**第二套开会话机制——
   *   真实现在 `preset-launch.ts`，由 `client.tsx` 用同一个 `createEnterprisePresetLauncher` 建。
   */
  readonly draftPort?: EnterpriseEscDraftPort | undefined
  /**
   * ★**本刀（Phase C D1：连接器广场）**：本机连接器广场的**只读**端口（`client.tsx` 接在**同一枚**
   *   `createEnterpriseLocalApi()` 实例上）。
   *
   * ★为什么它是**第三枚端口**而不是 `api` 上的第七个方法：`api` 那一面是**平台镜像**（宿主侧那张
   *   浏览器可读闭集只放平台的只读端点），而连接器广场走的是**本机同源脱敏投影** —— 与
   *   `skillPort`/`draftPort` 同一条注入范式（判据是"端口在不在场"）。
   * ★**只有只读一格、没有写方法**：本刀（D1）不做启用/断开（D2），故卡片上那枚启用动作
   *   **恒禁用 + 行上可见原因**（"端口上有没有写方法"是类型层的事实，不是界面写死一个 `disabled`）。
   * ★缺席 ⇒ 那一格出一句可见交代（绝不画成"企业一台连接器都没有"）。
   */
  readonly connectorPort?: EnterpriseEscConnectorPort | undefined
}

/** 工具栏下方那句如实说明（本页新增，不是原文的一部分）。 */

/** 资源聚合内容区。 */
export function EnterpriseEscAggregation({ api, resourceType, onResourceTypeChange, skillPort, onOpenInstalled, onOpenMyExperts, draftPort, connectorPort }: EnterpriseEscAggregationProps): ReactNode {
  // 主 tab：系统广场/团队空间（连接器另有"已连接的"、技能另有"我启用的"）
  const [source, setSource] = useState<ResourceSourceEnum>('system')
  // 二级分类 key（空串=全部；团队维度下它承载空间 id）
  const [category, setCategory] = useState<string>('')
  // 搜索关键字（输入值 + 防抖值）
  const [keywordInput, setKeywordInput] = useState<string>('')
  const [keyword, setKeyword] = useState<string>('')
  /**
   * ★**本刀（用户冻结规格 §1②：「刚装的那一枚留在原地」）**：本页本次会话里刚安装成功那一枚的标记。
   *
   * 三件事的**唯一事实层**是 `esc-skill-card.ts` 的 `enterpriseEscSkillCardMarkState`（纯 reducer），
   * 本层只负责**在正确的时刻派发两个事件**：
   *   · `installed`（安装成功，见下面 `runSystemInstall` 的成功分支）；
   *   · `relist`（**列表重读 / 切维度**：切维度、切资源类型、换分类、改搜索词、失败重试各一处，见下）。
   * ⚠**"安装成功之后那一次自动重读"刻意不算 `relist`**：那次读是这次安装动作自己的收尾
   *   （成功回执 ⇒ 请官方发现面重读一遍）；把它也算成"列表重读"，标记会在**同一次动作里**刚置上就被
   *   撤掉 —— 用户点的那枚卡片照样凭空消失（那个例外就白写了）。判据在 reducer 的 `ownRead` 那一格。
   * ⚠**不许永久留着**：上面那五处派发保证它最多活到下一次"用户发起的重读"为止。
   */
  const [cardMark, setCardMark] = useState<EnterpriseEscSkillCardMarkState>(ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY)
  /** 列表重读 / 切维度 ⇒ 撤掉刚装标记（**唯一出口**：全文件 `{ kind: 'relist' }` 只在这里出现）。 */
  const relistCards = useCallback((): void => {
    setCardMark(current => enterpriseEscSkillCardMarkState(current, { kind: 'relist' }))
  }, [])

  const { categories, unavailable } = useEnterpriseEscCategories(resourceType, source, api)

  // 团队维度「全部」页签的聚合查询参数：全部空间 ID（连接器走 scope=space 不消费；系统广场维度不依赖）
  const teamSpaceIds = useMemo(() => {
    if (source !== 'team' || resourceType === 'connector') return undefined
    return categories
      .map(item => Number(item.key))
      .filter(id => Number.isFinite(id) && id > 0)
  }, [source, resourceType, categories])

  // 列表请求用的空间 ID：团队维度选中具体空间时 = 该空间
  const listSpaceId = useMemo(() => {
    if (source !== 'team') return undefined
    const id = Number(category)
    return Number.isFinite(id) && id > 0 ? id : undefined
  }, [source, category])

  // 团队维度：分类（空间）key 不在空间列表中时回落「全部」（原文同判据）
  useEffect(() => {
    if (source !== 'team' || categories.length === 0) return
    if (!categories.some(item => item.key === category)) setCategory(categories[0]?.key ?? '')
  }, [source, categories, category])

  const { list, loading, hasMore, error, loadMore, reload } = useEnterpriseEscResourceList({
    api,
    resourceType,
    source,
    category: source === 'team' ? '' : category,
    keyword,
    spaceId: listSpaceId,
    // 「全部」页签：spaceIds 携带全部空间（具体空间页签不传）
    spaceIds: source === 'team' && !category ? teamSpaceIds : undefined,
    pageSize: 20,
  })

  // 搜索防抖 400ms（原文同值）
  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordInput), 400)
    return () => window.clearTimeout(timer)
  }, [keywordInput])

  // 滚动容器，用于不满屏自动补拉
  const containerRef = useRef<HTMLDivElement | null>(null)
  /**
   * ★移动端那一档（触屏/窄/矮，见 `esc-style.ts` 里同名的那条 @media）把**滚动面从列表挪到了内容区**：
   *   `.esc-content` 成为滚动容器、`.esc-scroll` 退回普通块。于是"到底谁在滚"在两种档位下不同，
   *   而「不满屏自动补拉」必须问**真正在滚的那一个**要 `clientHeight`
   *   （问错了的后果：手机上一口气把所有页都拉光）。
   *   ★判据取真实溢出（`scrollHeight > clientHeight`）而不是 `matchMedia`：断点只有一个真源（样式表），
   *     JS 不另立一套断点，两边不可能漂移；样式改档位时这里自动跟随。
   *   ★本刀补一句：**两个高度必须来自同一个盒子**——旧写法拿"卡片区高度"比"滚动面视口高"，
   *     手机档必然误判（详见 `decideAutoFill` 的注释）。
   */
  const boxRef = useRef<HTMLDivElement | null>(null)
  const activeScroller = useCallback((): HTMLDivElement | null => {
    const box = boxRef.current
    if (box !== null && box.scrollHeight > box.clientHeight + 1) return box
    return containerRef.current
  }, [])

  /**
   * ★本刀：「补拉无进展」闩锁 + 上次补拉发起时的列表长度（判据见文件头的 `decideAutoFill`）。
   * `lastFillLengthRef === -1` 表示本筛选集下还没补拉过——不能拿它当"没进展"。
   */
  const suppressedRef = useRef<boolean>(false)
  const lastFillLengthRef = useRef<number>(-1)
  const clearFillLatch = useCallback((): void => {
    suppressedRef.current = false
    lastFillLengthRef.current = -1
  }, [])

  // 换资源类型/换维度/换分类/换关键字 ⇒ 这是**新查询**，解闩（"补过了没进展"只对同一批数据成立）
  useEffect(() => {
    clearFillLatch()
  }, [clearFillLatch, resourceType, source, category, keyword, listSpaceId, teamSpaceIds])

  /** 列表没填满滚动面且还有更多 ⇒ 自动补拉（100ms 延迟照原文；判据见 `decideAutoFill`）。 */
  const checkAndAutoFill = useCallback(() => {
    const scroller = activeScroller()
    if (scroller === null) return
    const decision = decideAutoFill({
      scrollerScrollHeight: scroller.scrollHeight,
      scrollerClientHeight: scroller.clientHeight,
      hasMore,
      loading,
      listLength: list.length,
      previousLength: lastFillLengthRef.current,
      suppressed: suppressedRef.current,
    })
    if (decision === 'suppress') {
      // 补过一轮而列表没长（空页/同批页/失败）⇒ **停手**：再补也是同一结果，而每 100ms 重来一次
      // 就是用户看见的"一直闪"。要解闩得换筛选条件、换页签，或点失败行上的「重试」。
      suppressedRef.current = true
      return
    }
    if (decision !== 'pull') return
    lastFillLengthRef.current = list.length
    loadMore()
  }, [activeScroller, loading, hasMore, list, loadMore])

  useEffect(() => {
    const timer = window.setTimeout(checkAndAutoFill, 100)
    return () => window.clearTimeout(timer)
  }, [list, checkAndAutoFill])

  // 窗口大小变化时重新检查（原文同）
  useEffect(() => {
    const handleResize = (): void => checkAndAutoFill()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [checkAndAutoFill])

  // 触底加载下一页（替换 react-infinite-scroll-component：同一个滚动容器、同一条判据）
  const handleScroll = useCallback(
    (event: { readonly currentTarget: HTMLDivElement }) => {
      const el = event.currentTarget
      // ★判据收进纯函数（`shouldTriggerBottomLoad`）：它必须问 `hasMore`——见那里的注释，
      //   "平台说没有下一页了还一遍遍发请求"正是真机上"一直闪、加载不起作用"的来处。
      if (
        !shouldTriggerBottomLoad({
          scrollHeight: el.scrollHeight,
          scrollTop: el.scrollTop,
          clientHeight: el.clientHeight,
          hasMore,
          loading,
          suppressed: suppressedRef.current,
        })
      ) {
        return
      }
      loadMore()
    },
    [loadMore, hasMore, loading],
  )

  /** 「重试」：解闩后再重拉（失败/空页之后用户明确要求再试一次，闩锁不该拦着）。
   *  ★**本刀**：它同时是一次"**列表重读**"⇒ 撤掉刚装标记（用户明确要求把这一面重新读一遍，
   *   那就该看到这一面的真形态，而不是上次安装留下来的那一格）。 */
  const retry = useCallback((): void => {
    relistCards()
    clearFillLatch()
    reload()
  }, [relistCards, clearFillLatch, reload])

  // 团队空间维度等待空间数据就绪（专家/技能「全部」页签需 spaceIds、具体空间页签需 spaceId）；
  // 连接器维度「全部」页签无 spaceId 也可请求（scope 聚合），不等待
  const waitingSpace =
    source === 'team' && resourceType !== 'connector' && !listSpaceId && !(teamSpaceIds && teamSpaceIds.length > 0)
  // 首屏加载（非滚动加载更多）才显示整屏骨架
  const initialLoading = (loading || waitingSpace) && list.length === 0
  const signedOut = error?.code === 'ENT_AUTH_REQUIRED'

  /**
   * ★本刀补上：顶栏那枚「已安装(N)」的计数。
   *
   * 上一刀把 `installedCount` 这个 prop **定义好了却没接线**——真机截图里「已安装」光秃秃没有数字，
   * 就是因为没人去读那份清单。这一刀补上，并守住两条纪律：
   * ① **只有技能页读**（专家/连接器页顶栏不显示这枚控件，读了就是白白发一条请求）；
   * ② `installedCount` **四态**分明——`undefined`＝**没读到真值**、数字＝真读到了（哪怕是 0，那也是
   *    "确实一个都没装"）；★**用户裁决（读不到 ⇒ 0）**：界面上前两态**同一个形状**（都画 `(0)`，
   *    代价用户已接受），差别由工具栏那一侧写在 `title` 上（读不到 ⇒ `installedCountUnreadable`）
   *    —— 这是"不许静默吞掉读不到"的落点；本层只管如实把"读失败"这个事实交上去，不改数、不写 0。
   * ★**口径 54（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）**：这一趟改读
   *    **官方发现面**（`api.discoveredSkills`，宿主 `ctx.get('skills')` 的快照 = 磁盘/运行时真值），
   *    不再读我们那两份记录。理由有一次真机取证：`~/.dsh/skills/` 上实有 **7** 枚技能，
   *    而企业那份记录只认 **1** 枚 —— "装了多少"这个问题，两份记录的回答必然是错的。
   * ★**本刀（用户最终裁决：`已安装` = DSH 装过的那本账，同一个词在同一屏上只指一个数）**：
   *    顶栏那个数**不再**取发现面枚数，而是 `enterpriseEscInstalledCount(发现面, 两份记录)` ——
   *    与「已安装」页页头**同一个纯投影**。故这一趟只负责"取到发现面快照"（以及已装判定键、
   *    第四态），**计数**是渲染期由那份快照 + 下面那一趟的两份记录一起算出来的（见 `installedCount`）。
   * ★**第四态（`complete === false`）**：官方自己说"还没发现完" ⇒ 数字位画的是**真的读到的那几个**
   *    （**不许当 0、不许写死数字**），同时把这件事交上去（`installedCountDiscovering`），
   *    由工具栏写成 title 那句「本机技能还在发现中，这个数字还会变」。
   */
  /** 发现面那一趟的**原始快照**（`undefined` = 还没读到真值；账本条数由它与两份记录一起算）。 */
  const [discoveredSkills, setDiscoveredSkills] = useState<readonly EnterpriseDiscoveredSkill[] | undefined>(undefined)
  const [installedReadFailed, setInstalledReadFailed] = useState(false)
  /** ★口径 54 第四态：官方说它还没发现完。 */
  const [installedDiscovering, setInstalledDiscovering] = useState(false)
  /** 已装技能**名**集合（卡片据此在「+」与「更多+去试试」之间分流）。读不到时是空集 ⇒ 按"未装"画「+」。 */
  const [installedIds, setInstalledIds] = useState<ReadonlySet<string>>(new Set<string>())
  /**
   * ★口径 46：**本地导入成功之后**请上面那次读重跑一遍。
   *
   * ★口径 54 起它重跑的是**官方发现面**那一趟（导入真的落了盘 ⇒ 发现面该看到它；
   *   官方 watcher 是即时发现的，这一趟重读就是"新装的那枚出现在计数里"的机制）。
   */
  const [installedRefreshToken, setInstalledRefreshToken] = useState(0)
  useEffect(() => {
    if (resourceType !== 'skill') return
    const controller = new AbortController()
    setDiscoveredSkills(undefined)
    setInstalledReadFailed(false)
    setInstalledDiscovering(false)
    setInstalledIds(new Set<string>())
    void (async () => {
      try {
        const snapshot = await api.discoveredSkills(controller.signal)
        if (controller.signal.aborted) return
        /**
         * ★**实测纠正**（沿革，仍然是这条键的由来）：中心已装清单的 `packageId` 是雪花号
         *   （实测 `2105915576743421088` 那一族），而广场列表那条的 `id` 是 `4194` ——
         *   **两套坐标系对不上**。真正的公共键是**名字**。口径 54 把这把公共键**升级为磁盘真值**：
         *   `installedSnapshotFacts` 收的就是发现面给的 kebab `name`（广场那份的 `name` 与它
         *   同一套命名），故命中率由真值决定。
         * ★**两件事实出自同一处投影**（`installedSnapshotFacts`）—— 已装判定键与"还没发现完"
         *   不许各算一遍。★**计数不在这里**（本刀）：那个数由 `enterpriseEscInstalledCount` 在渲染期
         *   与两份记录一起算（见 `installedCount`），以免同一个词在同一屏上有第二个数。
         */
        const facts = installedSnapshotFacts(snapshot)
        setInstalledIds(facts.names)
        setDiscoveredSkills(snapshot.skills)
        // ★官方自己说还没发现完 ⇒ 这一个数**还会变**：如实置旗（工具栏据此写 title 那句）。
        setInstalledDiscovering(facts.discovering)
      } catch {
        // ★读不到就如实说读不到（`discoveredSkills` 留在 `undefined` ⇒ 账本条数交 `undefined`，
        //   工具栏据此把 `(0)` 的 title 写成"暂定值"那句），**不回落成 0**（本层不写假数）、
        //   也不把整页拖进失败态。
        if (controller.signal.aborted) return
        setInstalledReadFailed(true)
      }
    })()
    return () => controller.abort()
  }, [api, resourceType, installedRefreshToken])
  /**
   * ★口径 46：本地导入那台状态机（**与商城页同一枚 `useEnterpriseSkillImport`**）。
   *
   * ★**口径 60**：技能页那条路现在走**队列驱动器** `useEnterpriseSkillImportQueue`——它内部持的仍是
   *   上面那同一枚单件状态机（一份文件一份文件地交棒），故「预检 / multipart / 自装清单 / `onInstalled` 刷新」
   *   在本仓仍然只有一处实现；本层多出来的只有"一批文件排队"这一层（纯投影在 `skill-import-queue.ts`）。
   *   写入口缺席（没有本机写面）⇒ hook 返回 `undefined` ⇒ 菜单项置灰写明原因、弹窗一枚都不画。
   */
  const skillImportPort = useEnterpriseSkillImportQueue({
    uploadSkill: skillPort === undefined ? undefined : (file, signal) => skillPort.uploadSkill(file, signal),
    selfInstalledSkills: skillPort === undefined ? undefined : signal => skillPort.selfInstalledSkills(signal),
    // 导入成功后只做一件事：请"本机已装"那一趟读重跑（真值仍由它说，不在这里自己加减）。
    onInstalled: () => setInstalledRefreshToken(token => token + 1),
  })
  /**
   * ★**口径 60**：导入弹窗的开合态。
   *
   * 触发钮在工具栏里、弹窗挂在这一层（与口径 46 那枚隐藏选择器同一个落点：**触发钮在哪棵树，
   * 落点就在哪棵树**）。`onAddSkill` 从此只**开窗**——上传那件事由用户在弹窗里发起（拖入或选文件）。
   */
  const [skillImportOpen, setSkillImportOpen] = useState(false)

  /**
   * ★**口径 62**：第三枚维度「本地三方」的**重扫令牌**（点【重试】/【重新扫描】只是把它 +1）。
   *
   * ★与 `installedRefreshToken` 同一条手法：**令牌变化 = 一次新请求**（下面那个子组件按它重建取数源），
   *   不是"重画一下"。失败态那枚【重试】与就绪态那枚【重新扫描】**共用这一枚令牌**——两处都是
   *   "再发一条请求"，没有第二种语义，故不许各造一枚（那样两处就会漂成"一处真重发、一处只重画"）。
   */
  const [thirdPartyAttempt, setThirdPartyAttempt] = useState(0)
  /** 重新扫描本维度（**真的**再发一次请求；与上面那枚令牌同一个出口）。 */
  const onReloadThirdParty = useCallback((): void => {
    setThirdPartyAttempt(current => current + 1)
  }, [])
  /** 装好一枚之后请「已安装」计数重读——★**复用**口径 46 那一枚既有的 refresh token，不造第二个。 */
  const onInstalledRefresh = useCallback((): void => {
    setInstalledRefreshToken(token => token + 1)
  }, [])

  /**
   * ★**口径 64（本刀）**：**系统广场**那批 NUWAX 已发布技能的一枚【＋】——三件状态 + 唯一的执行路。
   *
   * ★**为什么这三件状态住在这里、而不是内容区某个子组件里**：卡片网格就是本层直接铺的
   *   （系统广场是平台列表，与触底加载/四态同一条 data flow），故"哪一枚在途、失败落在哪一行"
   *   只能与那份列表同生共死；抽一个子组件出来反而要把整份列表转交出去。
   * ★**三条动作纪律**（与口径 46/53/62 那三条通路逐条对齐）：
   *   ① **一次一条**：`systemPending` 在场时第二次点击**直接返回**（那一条请求一条都不发），
   *      且**其余每一枚【＋】随之禁用并各自写明原因**（纯投影 `escSystemInstallPlan` 的 `blocked` 档，
   *      不是只把当前那枚灰掉——否则别的按钮看着能点却什么都不会发生）；
   *   ② **不乐观翻态**：成功时**只**把 Host 回传那份清单里的名字**并进**已装集合
   *      （`enterpriseEscSystemInstalledNames`：每一个名字都出自宿主那一次回执，不是我们自己猜的），
   *      随后**复用**那一枚既有的 `onInstalledRefresh` 请官方发现面重读（真值最终仍由它说）；
   *      失败**一格都不翻**，只把稳定码落在那一行上；
   *   ③ **失败不吞**：失败走**唯一**提示组件 + 稳定码（`EnterpriseEscSystemInstallFailure`），
   *      与"平台目录读不到"（`error`）两件事互不覆盖。
   */
  const [systemPending, setSystemPending] = useState<{ readonly id: number; readonly name: string } | undefined>(undefined)
  const [systemError, setSystemError] = useState<{ readonly id: number; readonly code: string } | undefined>(undefined)
  const [systemNotice, setSystemNotice] = useState<string | undefined>(undefined)
  /**
   * 「系统广场技能安装」这一枚写入口（判据是**端口在不在场**：缺席 ⇒ 那批【＋】禁用 +
   * 行上可见写明原因，绝不画一枚点了没反应的按钮）。★它与「企业技能」那一枚是**两格**
   * （坐标 / 制品 / 响应三件全不同，见 `esc-types.ts` 的长注释），本层只是各自原样转交。
   */
  const installPublishedSkill = skillPort?.installPublishedSkill
  /**
   * 发起一次安装（**界面上只有系统广场那些技能卡的【＋】与失败那一行的【重试】会调它**）。
   *
   * ★这里没有第二个 `fetch`、没有第二个解码器：动作原样交给注入的 `installPublishedSkill`
   *   （它内部就是 `local-api.ts` 的 `requestJson('/skills/published/install', …)` + 既有严格解码器）。
   * ★被"一次一条"挡住时直接返回（**一条请求都不发**）——原因已经在屏幕上（正在装的那一枚写着
   *   「安装中…」，其余每一枚下面写着"另一枚技能正在安装"）。
   */
  const runSystemInstall = useCallback((targetId: number, name: string): void => {
    if (systemPending !== undefined) return
    if (installPublishedSkill === undefined) return
    setSystemPending({ id: targetId, name })
    setSystemError(undefined)
    setSystemNotice(undefined)
    const signal = AbortSignal.timeout(ENTERPRISE_ESC_SYSTEM_INSTALL_TIMEOUT_MS)
    void installPublishedSkill(targetId, signal).then(
      (next) => {
        // ★以 Host 回传的清单为准（**并进**，不替换：那份自装清单只是官方发现面的一个子集）。
        setInstalledIds(previous => new Set([...previous, ...enterpriseEscSystemInstalledNames(next)]))
        setSystemNotice(enterpriseEscSystemInstalledText(name))
        /**
         * ★**本刀（用户冻结规格 §1②：「刚装的那一枚留在原地」）**：把这一枚的名字**置上标记**——
         *   紧接着那次重读会把它的名字并进"磁盘上已有"⇒ 隐藏规则本来会把它从列表里抹掉；标记让它
         *   **留在原地**（位置照旧），并且卡片只显示「去试试」（见 `esc-skill-card.ts` 那枚共享投影）。
         * ★标记的生命周期只由 reducer 说（置上与撤销都在 `esc-skill-card.ts`），本层只在**这两个时刻**
         *   派发：这里（安装成功）与 `relistCards`（列表重读 / 切维度）。
         */
        setCardMark(current => enterpriseEscSkillCardMarkState(current, { kind: 'installed', name }))
        // ★同一枚 refresh token（聚合层那枚）：装了东西就该让顶栏计数重数一遍。
        onInstalledRefresh()
      },
      (error: unknown) => {
        setSystemError({ id: targetId, code: enterpriseLocalErrorCode(error) })
      },
    ).finally(() => { setSystemPending(undefined) })
  }, [systemPending, installPublishedSkill, onInstalledRefresh])

  /**
   * ★**本刀（S5a）**：技能卡「更多」里那两枚本机管理动作（卸载 / 打开所在文件夹）的**四件状态**。
   *
   * ★**为什么它们住在这一层**（与上面 systemPending 那条同因）：卡片网格就是本层直接铺的
   *   （系统广场是平台列表），而"哪一枚在途、失败落在哪一行"必须与那份列表同生共死；
   *   另一处消费点是**精选行**（同一枚卡片、同一份真值，见下面 `moreOf` 那段），
   *   两处必须认同**同一个**在途事实 —— 抽到子组件里就得分两份状态，那正是"同一枚技能两处不一致"的来源。
   * ★**四件**：自装清单真值（**可用性判据的唯一来源**，来自 `GET /skills/self-installed`）、
   *   在途那一枚（`name` + 是哪枚动作）、失败那一行（`name` + 稳定码 + 是哪枚动作）、成功那一句。
   */
  const [selfInstalled, setSelfInstalled] = useState<readonly EnterpriseSelfInstalledSkill[]>([])
  /**
   * ★**本刀**：**中心已装记录**（`GET …/skills/installed`）——「已安装」那本账的另一半。
   *
   * ★它与下面那份自装记录**同一趟读**（串行），只有一个用途：喂给 `enterpriseEscInstalledCount`
   *   （顶栏那个数 = 页头那个数）。"哪些名字算装过"这件事的判据仍然只有一处
   *   （`esc-installed-model.ts` 的 `enterpriseEscInstalledGroupIdOf`），本层只搬数据、不判定。
   */
  const [installedCenter, setInstalledCenter] = useState<readonly EnterpriseInstalledSkill[]>([])
  /** 自装清单这次没读到（稳定码）：**必须说出来**——否则"每张卡都没有管理入口"会被读成"本机什么都没装"。 */
  const [selfInstalledCode, setSelfInstalledCode] = useState<string | undefined>(undefined)
  const [morePending, setMorePending] = useState<EnterpriseEscSkillMorePending | undefined>(undefined)
  const [moreError, setMoreError] = useState<EnterpriseEscSkillMoreFailure | undefined>(undefined)
  const [moreNotice, setMoreNotice] = useState<string | undefined>(undefined)
  /**
   * ★**本刀（S5b）**：技能卡那枚「去试试」的三件状态（与上面那三格**并列**、同一条纪律）。
   *
   * 与 `morePending` 那一组的唯一差别是**在途只可能有一枚技能名**（那枚按钮自己禁用即可，
   * 不必把全场按钮连带禁用）：这件事不占本机资源、也不与别人抢工作区。
   */
  const [tryPending, setTryPending] = useState<string | undefined>(undefined)
  const [tryError, setTryError] = useState<{ readonly name: string; readonly code: string } | undefined>(undefined)
  const [tryNotice, setTryNotice] = useState<string | undefined>(undefined)
  /**
   * 两份 DSH 记录那一趟读（**这一页的账目**）。两件用途、一条读：
   *   ① **自装记录**（`GET …/skills/self-installed`）——「更多」里那两枚动作的**可用性判据来源**
   *      （`names[]` 并集，见 `esc-skill-more.ts`）；
   *   ② **中心已装记录**（`GET …/skills/installed`）——「已安装」那本账的另一半（"来自内部市场"那几枚
   *      只有它认得出来）⇒ 顶栏那个数与页头**同一个纯投影**的输入之一。
   *
   * ★三条纪律与上面"官方发现面"那一趟逐条对齐：
   *   ① **只有技能页读**（专家/连接器页既没有那两枚动作、工具栏也不显示那枚计数）；
   *   ② **`installedRefreshToken` 变化就重读**——卸载/安装成功后触发的正是**同一枚**令牌，
   *      于是"顶栏计数"与"这张卡的「更多」还在不在"由**同一次**刷新一起收敛（不另造第二枚令牌）；
   *   ③ 读不到**不回落成空清单就算数**：置 `selfInstalledCode` 让界面如实说一句（人话 + 下一步 + 稳定码），
   *      并同时置 `installedReadFailed`（账本条数随之不可知 ⇒ 工具栏把那句"读不到"写在 title 上），
   *      而不是让员工对着一个"没有管理入口 / 已安装(0)"的页面猜。
   * ★**两读串行**（与 `esc-installed.tsx` 那份元信息那一趟同一条手法）：任一条失败即整趟降级 ——
   *   缺一半的账目算出来的数字是**假数**，宁可如实说"读不到"。
   */
  useEffect(() => {
    if (resourceType !== 'skill') return undefined
    const controller = new AbortController()
    setSelfInstalled([])
    setInstalledCenter([])
    setSelfInstalledCode(undefined)
    /**
     * ★两读**串行**（与 `esc-installed.tsx` 那份元信息那一趟同一条手法），且**任一条失败即整趟降级**：
     *   缺一半的账目算出来的数字是**假数**，宁可如实说"读不到"（`selfInstalledCode` + `installedReadFailed`）。
     * ★沿革：这一趟原本只读自装记录（`[…].then(ok, err)` 两条分支，零 `catch`）——本刀在它前面
     *   串上中心已装记录，故改成嵌套 `then`；**全文件仍然一个 `catch (` 都没有**（那条反向锁照旧）。
     */
    void api.installedSkills(controller.signal).then(
      (center) => {
        if (controller.signal.aborted) return
        setInstalledCenter(center)
        return api.selfInstalledSkills(controller.signal).then(
          (records) => {
            if (controller.signal.aborted) return
            setSelfInstalled(records)
          },
          (error: unknown) => {
            if (controller.signal.aborted) return
            // ★失败**不抛给整页**（这两份记录是次级取数：读不到只该让那两枚动作缺席、账目按空算，
            //   不该拖垮目录），但**必须说出来**（下面那行 `role="status"` + 工具栏的 title）
            //   —— 这就是本仓"降级必须可见"的口径。
            setSelfInstalledCode(enterpriseLocalErrorCode(error))
            setInstalledReadFailed(true)
          },
        )
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setSelfInstalledCode(enterpriseLocalErrorCode(error))
        setInstalledReadFailed(true)
      },
    )
    return () => { controller.abort() }
  }, [api, resourceType, installedRefreshToken])
  /**
   * ★**本刀（用户裁决：同一个词在同一屏上只指一个数）**：顶栏那枚「已安装(N)」的数字
   * ＝**「已安装」页那个投影的条数**——`enterpriseEscInstalledCount`（`esc-installed-model.ts`），
   * 与页头 `esc-installed.tsx` 的 `total` 是**同一个纯投影的两个消费者**（不是各算一遍）。
   *
   * ★**判据只有一处**：`enterpriseEscInstalledGroupIdOf`（系统内置 ∪ 有 DSH 记录 ⇒ 才算装过）。
   *   本层不写第二份判据、也不自己 sum，只把**同一份输入**（发现面快照 + 两份记录）交进去。
   * ★**读不到 ⇒ `undefined`**（而不是 0）：发现面那一趟没到 ⇒ 数不可知（工具栏照旧画 `(0)` 并把
   *   title 写成"读不到"那句）；两份记录读不到 ⇒ 它们是空数组、账条数与**页头**同值（页头另有一条
   *   可见的"元信息读不到"交代），同一个词仍然只指一个数。
   */
  const installedCount = useMemo(
    () => discoveredSkills === undefined
      ? undefined
      : enterpriseEscInstalledCount(
          discoveredSkills,
          enterpriseEscInstalledMetaTable(installedCenter, selfInstalled),
        ),
    [discoveredSkills, installedCenter, selfInstalled],
  )
  /**
   * 两枚动作的写入口（判据是**端口在不在场**：缺席 ⇒ 那一行**不画**，见 `esc-skill-more.ts` 的计划投影）。
   *
   * ★**入参只有技能目录名**：界面不拼路径、不挑记录、不加工——归属判据的权威在宿主
   *   （`local-api.ts` 那两条 exact 路由，正文关闭键集恰好 `{name}`）。
   */
  const uninstallSelfInstalledSkill = skillPort?.uninstallSelfInstalledSkill
  const revealSelfInstalledSkill = skillPort?.revealSelfInstalledSkill
  /**
   * 一次本机管理动作的**公共起点**（两条共用）：在途闸 + 清掉上一轮的两句反馈。
   *
   * @returns `false` = 被"一次一条"挡下（**那一条请求一条都不发**，也不排队）。
   */
  const beginSkillMore = (action: EnterpriseEscSkillMoreAction, name: string): boolean => {
    if (morePending !== undefined) return false
    setMorePending({ name, action })
    setMoreError(undefined)
    setMoreNotice(undefined)
    // ★**本刀（S5b）**：一张卡上同一时刻只说一件事——开始这两枚动作时也清掉「去试试」那两句反馈
    //   （见 `esc-card.tsx` 的 `cardFailure`：两枚动作共用一个失败位）。
    setTryError(undefined)
    setTryNotice(undefined)
    return true
  }
  /**
   * **卸载**一枚自装技能（**破坏性**：界面上只有那枚下拉里、且过了二次确认的那一行会调它）。
   *
   * ★三条纪律（与上面「系统广场安装」那条逐条对齐）：
   *   ① **不乐观改本地**：成功时把自装清单换成 **Host 回执里那份投影**（`result.skills`，卸载后的真值），
   *      界面从不自己从清单里减去一枚、也不自己加减计数；
   *   ② **成功后触发同一枚计数刷新**（`onInstalledRefresh` → 既有的 `installedRefreshToken`）：
   *      顶栏「已安装(N)」与本页这份自装清单由**同一次**刷新一起收敛；
   *   ③ **失败不吞**：只把稳定码落在**这一枚卡片**上（唯一提示组件），不动任何本地状态。
   * ★**不中止在途**：那是一次**写**动作（宿主可能已经在删目录 / 已经改了记录），中止 fetch 不会撤销它，
   *   只会让界面不知道结果 ⇒ 只挂一枚超时信号（与设置页那几枚同一条）。
   */
  const runUninstallSelfInstalled = useCallback((name: string): void => {
    if (uninstallSelfInstalledSkill === undefined) return
    if (!beginSkillMore('uninstall', name)) return
    const signal = AbortSignal.timeout(ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS)
    void uninstallSelfInstalledSkill(name, signal).then(
      (next: EnterpriseSelfInstalledUninstall) => {
        // ★以 Host 回传的最新记录为准（不乐观改本地）：那份 `skills` 就是"卸完之后本机自装了什么"。
        setSelfInstalled(next.skills)
        setMoreNotice(enterpriseEscSkillMoreUninstalledText(name))
        // ★同一枚 refresh token（聚合层那枚）：卸了东西就该让顶栏计数重数一遍。
        onInstalledRefresh()
      },
      (error: unknown) => {
        setMoreError({ name, action: 'uninstall', code: enterpriseLocalErrorCode(error) })
      },
    ).finally(() => { setMorePending(undefined) })
  }, [morePending, uninstallSelfInstalledSkill, onInstalledRefresh])
  /**
   * **打开所在文件夹**（非破坏性、无确认，但**仍是异步动作**：在途禁用 + 失败如实上屏）。
   *
   * ★成功**不改任何本地状态**（宿主那一跳不改记录），只说一句"已经交出去了"；
   *   失败（目录不在了 ⇒ 404、系统交接失败 ⇒ 503）走同一条失败落点。
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
  }, [morePending, revealSelfInstalledSkill])
  /**
   * 那枚写入口（判据是**端口在不在场**：缺席 ⇒ 卡片上禁用 + 行上可见写明原因，见 `esc-skill-try.ts`）。
   *
   * ★它**不是**本层新造的机制：`client.tsx` 把它接在**同一个** `createEnterprisePresetLauncher(...)`
   *   上（与技能页下拉那两项草稿同一枚构造器），故"打开会话 + 写草稿"在本仓仍然只有 `preset-launch.ts`
   *   一处实现；本层只是把那句拼好的指令原样转交。
   */
  const fillSkillTryDraft = skillPort?.fillSkillTryDraft
  /**
   * 发起一次「去试试」（**界面上只有已装技能卡那枚按钮、以及「更多 → 去对话」那一行会调它**）。
   *
   * ★`draft` 是**计划层（`enterpriseEscSkillTryPlan` 的 `onTry` 闭包）拼好的那句指令**——
   *   两个入口走的是**同一个闭包**（见下面 `moreOf` 的 `gotoChat` 那格），故"新会话 + 填草稿"这件事
   *   在本层只有**一处实现**、草稿也**只有一处**拼法（唯一构造器 `enterpriseEscSkillTryDraft`）。
   * ★被"一次一条"挡住时直接返回（那一次**什么都不做**：按钮此刻已禁用并写着「正在把这句话填进…」）。
   */
  const runSkillTry = useCallback((name: string, draft: string): void => {
    if (tryPending !== undefined) return
    if (fillSkillTryDraft === undefined) return
    setTryPending(name)
    setTryError(undefined)
    setTryNotice(undefined)
    // 一张卡上同一时刻只说一件事：这一次开始时清掉那两枚本机管理动作的反馈（见 `esc-card.tsx` 的 `cardFailure`）。
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
  }, [tryPending, fillSkillTryDraft])
  /**
   * ★**本刀（技能页性能：「不再白算」那一半）**：本页那**三张计划表**（安装 / 更多 / 去试试）。
   *
   * 一张表 = **一份数据 + 一份状态**下"按名取**同一枚对象**"的落点（唯一实现 `esc-plan-table.ts`）。
   * 三张表都由 `useMemo` 建**一次**：依赖里放的全是**真值引用或状态标量**（不是每渲染新建的数组/对象）
   * ⇒ 状态没变时表不重建、表内同一枚技能取到的计划**引用相等**，`EnterpriseEscCard` 那层 `memo`
   * 才会判"props 没变"而整棵子树跳过。这就是真机上"技能页很卡 / hover 也卡"那一刀的根因修法：
   * 主线程不再被几百张卡的整页重画占着，鼠标事件才排得到前面。
   *
   * ★**三张表各自都是那一族投影在全 `src` 里的唯一调用点**（门禁逐文件计数锁着）：
   *   · `enterpriseEscSystemInstallTable` ← `escSystemInstallPlan` + `enterpriseEscSystemCardInstall`
   *   · `enterpriseEscSkillMoreTable`    ← `enterpriseEscSkillMorePlan`
   *   · `enterpriseEscSkillTryTable`     ← `enterpriseEscSkillTryPlan`
   * ★**自装名字集合只建一次**（下面 `selfInstalledNames`）：它是"这一枚能不能卸"的**唯一判据输入**，
   *   改前每张卡调一次 `enterpriseEscSelfInstalledNames(records)`（610 张 = 610 次 `new Set`，
   *   且每次渲染重来）——那正是本刀要消掉的第二处白算。
   * ★**次序**：try 表先建（more 表要有它才能给出「去对话」那一行）；install 表与另两张无关。
   */
  const selfInstalledNames = useMemo(() => enterpriseEscSelfInstalledNames(selfInstalled), [selfInstalled])
  const tryPlans = useMemo(() => enterpriseEscSkillTryTable({
    wired: fillSkillTryDraft !== undefined,
    ...(tryPending === undefined ? {} : { pending: tryPending }),
    ...(tryError === undefined ? {} : { failure: tryError }),
    onTry: runSkillTry,
  }), [fillSkillTryDraft, tryPending, tryError, runSkillTry])
  const morePlans = useMemo(() => enterpriseEscSkillMoreTable({
    selfInstalledNames,
    wired: {
      /** ★「编辑」那一行要的那条宿主路由**还没落地** ⇒ 这里如实交"端口不在场"（那一行整行不画）。 */
      edit: skillPort?.editSkillFile !== undefined,
      uninstall: uninstallSelfInstalledSkill !== undefined,
      reveal: revealSelfInstalledSkill !== undefined,
    },
    ...(morePending === undefined ? {} : { pending: morePending }),
    ...(moreError === undefined ? {} : { failure: moreError }),
    onUninstall: runUninstallSelfInstalled,
    onReveal: runRevealSelfInstalled,
    /** ★`onEdit` **刻意不交**：那条路由没落地 ⇒ 计划里那一格也不会出现（双闸，见 `esc-skill-more.ts`）。 */
  }), [selfInstalledNames, morePending, moreError, skillPort, uninstallSelfInstalledSkill, revealSelfInstalledSkill, runUninstallSelfInstalled, runRevealSelfInstalled])
  const installPlans = useMemo(() => enterpriseEscSystemInstallTable({
    /**
     * ★**维度闸一字未动**（口径 64）：只有「系统广场 × 技能」这一格构造终态 —— 另几枚维度（团队空间 /
     *   企业技能 / 本地三方）在广场那一侧本来就没有计划，精选这一侧照旧也没有（同一条判据）。
     */
    enabled: resourceType === 'skill' && source === 'system',
    wired: installPublishedSkill !== undefined,
    ...(systemPending === undefined ? {} : { busy: systemPending.id }),
    onInstall: runSystemInstall,
  }), [resourceType, source, installPublishedSkill, systemPending, runSystemInstall])
  /**
   * ★**本刀（用户冻结规格 §1④/§2：「精选卡接同一份安装计划」）**：系统广场那批 NUWAX 已发布技能的
   * 【＋】计划 —— **广场网格与精选行都按卡片取这一张表**（同一张表、同一个 `item`）⇒ 同一份夹具下
   * 两处拿到的安装入参**逐键相等**。这就是"精选卡那枚【＋】退回兜底形态、把『这类技能没有可下载的
   * 技能包…』铺成独立一行、把卡片撑成描述三行"那个 bug 的修法：改前精选行根本没接这一格。
   *
   * ★**本刀（技能页性能）**：它由"逐卡现造"改成"按卡片取表里那一枚"——`installPlans(item)` 对同一张卡
   *   返回**同一枚对象**（memo 才跳得过去）；`item` 是键本身，故"名字拼键"那类撞车在这里物理上不存在。
   */
  const installOf = useCallback((item: ResourceItem): EscCardInstall | undefined => installPlans(item), [installPlans])
  /**
   * 某一枚技能 → 它的「更多」计划（**唯一构造点**：上面那张 `morePlans` 表，表内唯一投影是
   * `enterpriseEscSkillMorePlan`）。
   *
   * ★几件事实一起交给它：这份自装真值（**可用性判据只认 `names[]`**，且集合已在本层建过一次）、
   *   三条端口的在不在场、在途与失败。算出来的 `undefined` 就是"这一枚不画那枚 `⋯`"——系统广场网格
   *   与精选行**共用这一张表**，故同一枚技能在两处不可能一个画、一个不画（口径 43 明令要避免的
   *   "同一屏两种形态"）。
   * ★**「去对话」那一格**走的是表内按**计划对象身份**分的那一层（见 `esc-skill-more.ts` 那段）：
   *   广场网格带着那一枚「去试试」计划、精选行只递名字（不带）——两处本来就该拿到**不同**的计划，
   *   故这两档不能共用一层按名字的缓存。
   */
  const moreOf = useCallback((name: string, tryPlan?: EnterpriseEscSkillTryPlan | undefined): EscCardMore | undefined => morePlans(name, tryPlan), [morePlans])

  /**
   * ★**本刀（S5b）**：技能卡那枚「去试试」的**唯一执行路**（三件状态见上面那三格）。
   *
   * ★**一次一条**：`tryPending` 在场时第二次点击**直接返回**（不排队、也不重入）；
   *   其余每一枚的按钮**不会被连带禁用**（这件事不占任何本机资源、也不与别人抢工作区——
   *   与安装/卸载那种"一次一条挡住全场"的语义刻意不同，故这里只禁用**正在跑的那一枚**）。
   * ★**成功与失败都如实收束**：成功只留一句「已在新会话的输入框里填好…按发送即可」（**不开新页面**、
   *   也不宣称已发送——我们只填不发送）；失败只记稳定码，落在**这一枚卡片**上（唯一提示组件）。
   */
  /**
   * 某一枚技能 → 它的「去试试」计划（**唯一构造点**：上面那张 `tryPlans` 表，表内唯一投影是
   * `enterpriseEscSkillTryPlan`）。
   *
   * ★几件事实一起交给它：这一枚**装没装**（与卡片 `installed` 同源，同一把名字键）、**端口在不在场**、
   *   在途与失败。算出来的计划**恒有值**（不可用是"禁用 + 写明原因"，不是"整枚不画"）。
   * ★网格与精选行**共用这一张表**（与 `moreOf` 同一条纪律）：同一枚技能在两处不可能一处能点、
   *   一处不能点；同一份状态下取两次也是**同一枚对象**（memo 跳得过去）。
   */
  const tryOf = useCallback((name: string, installed: boolean): EscCardTryNow => tryPlans(name, installed), [tryPlans])

  /**
   * ★**口径 62（用户修正：二级 chip 行数据驱动）**：本维度的**取数与 chip 行**都住在**这一层**。
   *
   * ★为什么取数必须提到这一层（而不是留在内容区那个子组件里）：chip 行住在**工具栏**、候选列表住在
   *   **内容区**，而"哪几枚 chip、选中的是哪一枚"必须与那一份响应**同源**。若取数留在内容区、chip 行
   *   再由子组件回调上来，就成了"子组件 fetch → 回调 setState → 父组件重渲染 → 子组件重建 source"
   *   那种**自激**形状（页面上表现为请求反复重发）。提到这一层之后：**一次扫描一份真值**，
   *   工具栏与内容区都只是它的两个投影。
   * ★`aliasOf` / `count === 0` 的根**不出 chip**（判据在 `enterpriseThirdPartySubChips` 那一处，
   *   理由逐条写在它上面）；选中的那一枚**已经不在**这一排里时回落「全部」（判据在
   *   `enterpriseEscSubTabs`）。两件事都是**纯投影**，故这里的代码只有"接线"。
   */
  const [thirdPartyState, setThirdPartyState] = useState<EnterpriseListState<EnterpriseThirdPartySkills>>({ kind: 'loading' })
  /** 选中的来源根（`ENTERPRISE_ESC_SUB_TAB_ALL_KEY` = 全部）。切换资源类型/维度时复位。 */
  const [thirdPartyRoot, setThirdPartyRoot] = useState<string>(ENTERPRISE_ESC_SUB_TAB_ALL_KEY)
  const thirdPartyApi = api
  useEffect(() => {
    if (source !== 'third-party') return undefined
    const controller = new AbortController()
    /**
     * ★重扫（`thirdPartyAttempt` 变化）时**不**回到加载态：上一次的真值继续铺着，结果到了再换
     *   ——与本页"行上装/卸之后不整页闪"是同一条口径；首帧才出「正在扫描…」。
     * ★失败**绝不回落空列表**：这里只记 `{kind:'failed', code}`（界面据此出失败态 + 真重发的重试）。
     */
    setThirdPartyState(previous =>
      previous.kind === 'ready' || previous.kind === 'empty' ? previous : { kind: 'loading' })
    void thirdPartyApi.thirdPartySkills(controller.signal).then(
      (scanned) => {
        if (controller.signal.aborted) return
        setThirdPartyState(scanned.skills.length === 0 ? { kind: 'empty', value: scanned } : { kind: 'ready', value: scanned })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setThirdPartyState({ kind: 'failed', code: enterpriseLocalErrorCode(error) })
      },
    )
    return () => { controller.abort() }
  }, [source, thirdPartyAttempt, thirdPartyApi])
  /**
   * 换维度/换资源类型时把选中的来源根**复位**（否则会带着「上一维度选的那一枚」进新维度）。
   * 判据取"离开这一维度"：只在 `source !== 'third-party'` 时清，进来时不动（同一会话内切走再切回
   * 仍记得上次选的那一枚——那是我们自己的状态，不是从别处借来的）。
   */
  useEffect(() => {
    if (source !== 'third-party') setThirdPartyRoot(ENTERPRISE_ESC_SUB_TAB_ALL_KEY)
  }, [source, resourceType])
  /** 这一维度的 chip 行（数据驱动）：全部 + 有技能、非别名的每一枚根。 */
  const thirdPartyScan = thirdPartyState.kind === 'ready' || thirdPartyState.kind === 'empty' ? thirdPartyState.value : undefined
  const thirdPartySubTabs = useMemo(
    () => {
      if (source !== 'third-party') return undefined
      const chips = thirdPartyScan === undefined ? [] : enterpriseThirdPartySubChips(thirdPartyScan)
      return enterpriseEscSubTabs({ chips, activeKey: thirdPartyRoot })
    },
    [source, thirdPartyScan, thirdPartyRoot],
  )
  /** 按选中的 chip 过滤候选（判据在 `esc-sub-tabs.ts` 那一份：选「全部」原样返回，不重建数组）。 */
  const thirdPartySkills = useMemo(
    () => thirdPartyScan === undefined
      ? undefined
      : enterpriseEscSubTabFilter(thirdPartyScan.skills, thirdPartySubTabs?.activeKey ?? ENTERPRISE_ESC_SUB_TAB_ALL_KEY, skill => skill.rootId),
    [thirdPartyScan, thirdPartySubTabs],
  )

  /**
   * ★**口径 53（本刀）**：第四枚维度「企业技能」的**取数源**——**复用**「企业设置 → 技能」那一页的
   *   **同一个**工厂 `createEnterpriseSkillListSource`（不新造取数器、不新造路由、不新造解码器）。
   *
   * ★为什么它也要提到这一层（与上面「本地三方」逐条同因）：这一维度的**二级 chip 行住在工具栏**、
   *   卡片住在内容区，两者必须认同**同一份**真值与**同一枚**选中的 key；若取数留在内容区、
   *   再由子组件回调把 chip 交上去，就成了"子组件 fetch → 回调 setState → 父组件重渲染 →
   *   子组件重建取数源"那种**自激**形状（页面上表现为请求反复重发）。
   * ★它的两个输入都来自**这条结构性只读的 `api`**（`skills` = 中心发布的目录、`installedSkills` =
   *   本机已装清单）：与设置页那一页逐字同源，本页只是**再读一次同一份**。
   * ★`useSyncExternalStore` 订阅它（与设置页那一页同一条手法）：四态互斥、`retry()` 真重发。
   */
  const catalogSource = useMemo(
    () => createEnterpriseSkillListSource({
      skills: signal => api.skills(signal),
      installedSkills: signal => api.installedSkills(signal),
    }),
    [api],
  )
  const catalogState = useSyncExternalStore(catalogSource.subscribe, catalogSource.getSnapshot, catalogSource.getSnapshot)
  /**
   * ★**只在进到这一维度时才发请求**（首帧与切走时一条都不发）。
   *   `load()` 是幂等的（已在途 / 已有结果都不动），故反复进出一趟不会重复打平台。
   */
  useEffect(() => {
    if (source !== 'catalog') return
    catalogSource.load()
  }, [source, catalogSource])
  /** 选中的二级分类（`category` 取自响应本身；空串 = 全部）。切换资源类型/维度时复位。 */
  const [catalogCategory, setCatalogCategory] = useState<string>(ENTERPRISE_ESC_SUB_TAB_ALL_KEY)
  useEffect(() => {
    if (source !== 'catalog') setCatalogCategory(ENTERPRISE_ESC_SUB_TAB_ALL_KEY)
  }, [source, resourceType])
  /** 这一维度的 chip 行（数据驱动）：全部 + 目录里真的出现过的每一个 `category`。 */
  const catalogScan = catalogState.kind === 'ready' || catalogState.kind === 'empty' ? catalogState.value : undefined
  const catalogSubTabs = useMemo(
    () => {
      if (source !== 'catalog') return undefined
      const chips = catalogScan === undefined ? [] : enterpriseCatalogSubChips(catalogScan.items)
      return enterpriseEscSubTabs({ chips, activeKey: catalogCategory })
    },
    [source, catalogScan, catalogCategory],
  )
  /** 这一维度那枚【刷新】的动作：失败态那枚【重试】与就绪/空态那枚【刷新】**共用**它（真重发）。 */
  const onReloadCatalog = useCallback((): void => {
    catalogSource.retry()
  }, [catalogSource])

  /**
   * ★**本刀 ③（SkillHub 维度）**：第四枚维度的**取数**——走**既有**那条在线搜索本机路由
   *   （`api.onlineSearchSkills`，`local-api.ts` 的 `GET /skills/online-search?q=…`）。
   *
   * ★**为什么取数住在这一层**（与「本地三方」/「企业技能」逐条同因）：搜索框住在**工具栏**、
   *   结果卡住在**内容区**，两者必须认同**同一份**真值与**同一枚**查询串；若取数留在内容区、
   *   再由子组件回调上来，就成了"子组件 fetch → 回调 setState → 父组件重渲染 → 子组件重建取数源"
   *   那种**自激**形状（页面上表现为请求反复重发）。
   * ★**查询串就是工具栏那一枚输入框的值**（`keyword`，已防抖）：本维度**不新造第二个搜索框**
   *   —— 同一屏两个搜索框是"哪个在搜什么"的经典歧义。
   * ★**没到门槛就一条请求都不发**（判据复用 `online-search.ts` 的 `enterpriseOnlineQueryState`，
   *   同一个下限 `ENTERPRISE_ONLINE_QUERY_MIN`）：那一档由纯投影说"请先输入关键词"
   *   （两句不同的"为什么空"之一），不是我们这里造一个假响应。
   * ★**失败绝不回落空列表**：只记 `{kind:'failed', code}`（界面据此出失败态 + 真重发的重试）。
   * ★**换关键词/换维度即中止**：`AbortController` 在清理函数里 abort，迟到结果不回填。
   * ★**v1 的已知浪费**（如实登记）：那条路由是**四源 fan-out**，而本维度只投影 `skillhub.cn`
   *   那一批（判据在 `esc-skillhub.ts`，**不在这一层**）⇒ 另三源的结果被界面侧丢掉。
   *   省掉它只能给那条路由加 `source` 参数（要动 `platform-client`，本刀禁改）。
   */
  const [skillHubState, setSkillHubState] = useState<EnterpriseListState<EnterpriseOnlineSkillSearch>>({ kind: 'loading' })
  /** 失败态那枚【重试】的令牌（**真重发**：它一变就再打一次那条既有路由）。 */
  const [skillHubAttempt, setSkillHubAttempt] = useState(0)
  const skillHubReady = enterpriseOnlineQueryState(keyword) === 'ready'
  useEffect(() => {
    if (source !== 'skillhub') return undefined
    // 没到下限 ⇒ 一条都不发（那一档的界面由纯投影 `enterpriseSkillHubFace` 说）。
    if (!skillHubReady) return undefined
    const controller = new AbortController()
    setSkillHubState({ kind: 'loading' })
    void api.onlineSearchSkills(keyword, controller.signal).then(
      (found) => {
        if (controller.signal.aborted) return
        setSkillHubState(found.results.length === 0
          ? { kind: 'empty', value: found }
          : { kind: 'ready', value: found })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setSkillHubState({ kind: 'failed', code: enterpriseLocalErrorCode(error) })
      },
    )
    return () => { controller.abort() }
    /**
     * ★依赖列恰好是这趟读读的几格：维度 / 查询串（已防抖）/ 重试令牌 / 取数面。
     *   多一格就是一次多余的重发，少一格就是"改了关键词还在铺上一次的结果"。
     */
  }, [source, skillHubReady, keyword, skillHubAttempt, api])
  /** 这一维度那枚【重试】的动作（失败态用；**真的**再发一次）。 */
  const onReloadSkillHub = useCallback((): void => {
    setSkillHubAttempt(current => current + 1)
  }, [])

  /**
   * ★**口径 49**：技能页那枚主按钮下拉的**开合态**与**预填失败态**。
   *
   * 为什么这两件事住在这里而不是工具栏里：`esc-toolbar.tsx` 是**纯投影**（不持 hook、可直调，
   * 既有那一批结构锁正是靠这一点才成立）；开合是交互状态、预填是异步动作，两者都需要 hook
   * ⇒ 落在这一层，由它把「哪一项、什么状态」当 props 交上去。这也是"失败要可见"的落点：
   * 唯一提示组件（`EnterpriseErrorNotice`）挂在本层，人话 + 下一步 + 稳定码都走 `error-messages.ts`
   * 那张唯一码表 —— **绝不静默失败**。
   */
  const [addSkillMenuOpen, setAddSkillMenuOpen] = useState(false)
  const [draftFailure, setDraftFailure] = useState<EnterpriseEscDraftKind | undefined>(undefined)
  /**
   * 走会话的那两项：把**已经写好的那句提示词**交给 `preset-launch.ts` 那条唯一实现
   * （跳新会话 + `setDraft` 预填、**不发送**）。
   *
   * 三条诚实边界：
   *   ① 端口缺席或这次没走成（`false` / reject）⇒ 记下是哪一项，由下面那枚提示件说出来；
   *   ② 成功**什么都不做**：官方会把主视图切到那个新会话，草稿躺在输入框里等用户按发送——
   *      那才是这件事的反馈（与商城页"通过 Agent 创建"那条同判，见 `marketplace-entry.tsx`）；
   *   ③ 这条路径**一个发送出口都没有**：`launch` 是唯一的调用，它的实现在 `preset-launch.ts` 里
   *      只调官方 `setDraft`（门禁有一条源码级反向锁盯住这一点）。
   */
  const runDraftWithAgent = useCallback((kind: EnterpriseEscDraftKind): void => {
    const prompt = kind === 'find' ? ENTERPRISE_ESC_LOCAL_COPY.skillFindPrompt : ENTERPRISE_ESC_LOCAL_COPY.skillCreatePrompt
    setDraftFailure(undefined)
    if (draftPort === undefined) {
      // 端口缺席 = 这一级不可用（菜单项已置灰 + 写明原因，正常路径点不到这里）。
      setDraftFailure(kind)
      return
    }
    void draftPort.launch(prompt).then(
      (ok) => { if (!ok) setDraftFailure(kind) },
      // 端口抛错与返回 false 同一条收束（都是"这一级没走成"），绝不静默。
      () => { setDraftFailure(kind) },
    )
  }, [draftPort])
  /** 按下的那一项渲染成提示件的**动作前缀**（说清是「查找技能」还是「创建技能」没成）。 */
  const draftFailureLabel = draftFailure === undefined
    ? undefined
    : draftFailure === 'find' ? ENTERPRISE_ESC_COPY.addSkillFind : ENTERPRISE_ESC_COPY.addSkillCreate

  /**
   * ★**本刀（用户冻结规格 §1①：「广场与精选默认不显示已安装的卡片」）**：这一面真正要铺的那批。
   *
   * 三条：
   *   ① **去掉**（不是灰化、不是打标）——连元素都不进树；
   *   ② 判据是**磁盘上已有同名技能**（`installedIds` ＝官方发现面给的 kebab 名集合），
   *      **不是账本**：账本只记"DSH 自己装过"的那几条，盘上有、账上没有的那些（用户手放进去的、
   *      官方内置的）点下去只会撞 `ENT_SKILL_NAME_CONFLICT` —— 拿账本判就是让界面替宿主说谎；
   *   ③ **系统广场与团队空间两个维度同一支**（都走这个 `visibleList`）——判据是同一个函数，
   *      精选行调的也是它（`esc-featured.tsx`）。
   * ★**刚装那一枚例外**（`cardMark.name`）：它留在原地（规格 §1②），标记的生命周期见
   *   `esc-skill-card.ts` 那枚 reducer（安装成功置上；列表重读 / 切维度撤掉）。
   * ★`initialLoading` 仍看 `list.length`（那是"这一面还没读到东西"，与"读到的东西该不该显示"是两件事）。
   */
  const visibleList = resourceType === 'skill'
    ? list.filter(item => !enterpriseEscSkillCardHidden({
        name: item.name,
        installedNames: installedIds,
        justInstalledSkillName: cardMark.name,
      }))
    : list
  /**
   * ★**本刀（第三句"为什么空"的真话）**：这一面到底是"没有数据"还是"都装过了"。
   *
   * 判据是**两个数**（不是在视图里判一句 `visibleList.length === 0`）：`list.length > 0` 而
   * `visibleList.length === 0` 只可能来自**隐藏规则把读到的每一枚都滤掉了** ⇒ 那时照旧画官方那句
   * 「暂无数据」就是**假话**（平台明明给了数据，是我们自己藏起来的）。
   * 判定与两句文案在纯投影 `enterpriseEscSkillAllInstalledEmpty` 里（可直调取证），本层只接线。
   */
  const allInstalled = enterpriseEscSkillAllInstalledEmpty({ listed: list.length, visible: visibleList.length })

  return createElement(
    'div',
    // ★本刀（用户裁决「移动端不要冻结、支持全屏滚动」）：内容区自己也是**滚动面**——
    //   桌面档它是 `overflow: hidden`（滚动在下面那口 `.esc-scroll` 格子里，工具栏钉死）；
    //   移动档（触屏/窄/矮）由样式表把它变成滚动容器 ⇒ 工具栏/精选/维度/分类与卡片一起滚。
    //   所以 `onScroll` 这里也挂一份：挪了滚动面之后，触底加载必须跟着挪（同一条 `handleScroll`，
    //   判据读 `currentTarget`，两档各自成立）。
    { className: 'esc-content', ref: boxRef, onScroll: handleScroll },
    // ★用户裁决④ + 本刀：三页签排进**工具栏第一栏左侧**（与「更多/搜索/已安装/添加」同处那一行
    //   ⇒ 同排由 flex 保证）；「精选」那一行走工具栏**第二栏**（`belowLeading`：三页签之下、
    //   维度标签之上），**专家页与技能页都挂**（两页只有 `targetType` 不同），连接器页不挂。
    //   ★原先这段注释写的是"精选只在技能页出现"——与实现不符，本刀按实现改正。
    createElement(EnterpriseEscToolbar, {
      // ★用户裁决④：三页签作为**主行左侧插槽**进去（与右块同一个 flex 行），不再是兄弟元素
      leading: onResourceTypeChange === undefined
        ? undefined
        : createElement(EnterpriseEscResourceTabs, {
            activeKey: resourceType,
            // ★**本刀**：切资源类型也是"切维度"⇒ 撤掉刚装标记（这一页的内容区随之整棵重挂，
            //   标记是**本页这一次列表**上的事实，不该跨到另一面列表上）。
            onSelect: next => { relistCards(); onResourceTypeChange(next) },
          }),
      // ★用户裁决：「精选」排在**第二栏**（三页签那一行之下、维度标签之上）
      //   ★口径 43：这一行的卡片改用**广场那张卡**，故已装技能名集合要一并交下去——
      //     否则精选里的技能卡只会画「+」，而同一条技能在下面广场里却画成「更多 + 去试试」，
      //     同一屏里同一件东西两种形态。用的是**同一份** `installedIds`（只读集合，不复制）。
      belowLeading:
        resourceType === 'skill' || resourceType === 'expert'
          ? createElement(EnterpriseEscFeatured, {
              api,
              targetType: resourceType === 'skill' ? 'Skill' : 'Agent',
              installedSkillNames: resourceType === 'skill' ? installedIds : undefined,
              /**
               * ★**本刀（S5a）**：精选行的卡片与广场**同一枚卡片**（口径 43），故「更多」那两枚
               * 本机管理动作也必须**同源**：把这个**同一个**计划工厂交下去（不是复制一份状态，
               * 而是同一个 `moreOf`）——两处因此不可能一处画得出、一处画不出，也不可能同时跑两条动作。
               */
              ...(resourceType === 'skill' ? { moreOf } : {}),
              /**
               * ★**本刀（S5b）**：精选行那枚「去试试」的计划工厂——与 `moreOf` **同一条手法**：
               * 交下去的正是**同一个** `tryOf`（不是复制一份状态），故精选行与广场网格在
               * "这一枚能不能试"上不可能给出两个答案。
               */
              ...(resourceType === 'skill' ? { tryOf } : {}),
              /**
               * ★**本刀（用户冻结规格 §2）**：那枚【＋】的计划工厂——**就是**广场网格调的那一个
               * `installOf`（同一个函数、同一个 `item` ⇒ 两处入参逐键相等）。改前**少递**这一格
               * ⇒ 精选卡退回兜底形态、把那句「这类技能没有可下载的技能包…」铺成独立一行
               * （用户真机看到的"描述三行"）。
               */
              ...(resourceType === 'skill' ? { installOf } : {}),
              /**
               * ★**本刀（用户冻结规格 §1②）**：刚装那一枚的名字——精选行与广场**同一条例外**
               * （它既让隐藏规则放它一马，又让卡片只显示「去试试」）。用的是**同一枚**标记。
               */
              ...(resourceType === 'skill' ? { justInstalledSkillName: cardMark.name } : {}),
            })
          : undefined,
      resourceType,
      installedCount,
      installedCountFailed: installedReadFailed,
      // ★口径 54 第四态：官方发现面自己说"还没发现完" ⇒ 工具栏据此换掉 title 那一句。
      installedCountDiscovering: installedDiscovering,
      source,
      onSourceChange: next => {
        setSource(next)
        // ★**本刀**：切维度就是"换了一面列表"⇒ 撤掉刚装标记（标记不许跨维度留着）。
        relistCards()
        // 系统广场（分类 key）、团队空间（空间 id）、已连接的（分类 key）各维度 key 命名空间不同，
        // 切换后清空选中回到"全部"（原文同口径）
        setCategory('')
      },
      categories,
      activeCategory: category,
      // ★**本刀**：换分类是"换了一面列表"⇒ 同样撤标记（与切维度同一条纪律）。
      onCategoryChange: next => { relistCards(); setCategory(next) },
      // ★口径 62：本维度那一排**数据驱动**的 chip（全部 + 有技能的来源根）。缺席 ⇒ 工具栏逐字回到
      //   后端分类那一支（专家/连接器页与另两枚维度都走它）。
      //   ★口径 53：第四枚维度「企业技能」同一条手法（全部 + 目录里真的出现过的分类），
      //     两者用**同一个** prop、**同一份** chip 机制 ⇒ 工具栏那一侧一个字都不用改。
      ...(source === 'skillhub'
        ? {
            /**
             * ★**本刀 ③**：这一维度**不做分类 chip**（用户明令：skillhub 的分类 v1 不引入）。
             *
             * ★**为什么必须显式给一枚空 chip 行**（而不是"什么都不给"）：工具栏那条降级判据是
             *   "`subTabs` 缺席 ⇒ 退回后端分类那一支"（平台那棵分类树，专家/技能/连接器的通用筛选）。
             *   什么都不给，这一维度上就会冒出一排**与 skillhub 毫无关系**的平台分类胶囊
             *   —— 那是"看着还能用"的死控件。给一枚空 chip 行 ⇒ `EnterpriseEscSubTabRow` 返回 null，
             *   分类行整排不出现（同一条手法也顺带压掉"分类暂时读不到"那句提示）。
             */
            subTabs: { chips: [], activeKey: '', onSelect: () => undefined },
          }
        : thirdPartySubTabs === undefined && catalogSubTabs === undefined
          ? {}
          : {
              subTabs: thirdPartySubTabs !== undefined
                ? { chips: thirdPartySubTabs.chips, activeKey: thirdPartySubTabs.activeKey, onSelect: setThirdPartyRoot }
                : { chips: catalogSubTabs!.chips, activeKey: catalogSubTabs!.activeKey, onSelect: setCatalogCategory },
            }),
      keyword: keywordInput,
      // ★**本刀**：改搜索词是"换了一面列表"⇒ 同样撤标记（每一次输入都撤；幂等，不会多渲染——reducer
      //   在"已经是空"时返回**同一引用**，`setState` 直接 bail out）。
      onKeywordChange: next => { relistCards(); setKeywordInput(next) },
      // 连接器页不展示"更多"入口（产品要求），专家/技能页保留
      showMore: resourceType !== 'connector',
      categoriesUnavailable: unavailable,
      // ★口径 46/60：那枚「上传技能」的**开窗**入口（写入口缺席时 `undefined` ⇒ 该项置灰 + 写明原因）。
      onAddSkill: skillImportPort === undefined ? undefined : () => { setSkillImportOpen(true) },
      // ★口径 47：那枚「已安装」的入口（切视图由页壳做）。
      onOpenInstalled,
      // ★口径 51：专家页那枚「我的专家」的入口（切视图由页壳做，本层只把它交上去）。
      //   ★连接器页那枚「添加连接器」**没有对应的一位**：本部署没有添加连接器管理接口，
      //     全仓也没有任何调用方会传 `onCustomConnectors` ⇒ 那一页的按钮恒置灰 + 行上写明原因
      //     （这不是"忘了接线"，是"没有这条能力"，故不在这里编一个假端口）。
      onOpenMyExperts,
      // ★口径 49：技能页那枚主按钮变成一个三项下拉——下面三件就是它的输入：
      //   ① 开合态与开合动作（本层持有，工具栏是纯投影）；
      //   ② 两项走会话的动作（各调各的、都由同一个 `runDraftWithAgent` 分派）；
      //   ③ 失败上报（真实失败原因落在下面那枚唯一提示件 + 稳定码上）。
      //   ★这三件**只在技能页给**：WorkBuddy 的专家页/连接器页那两枚根本不是下拉（进子页 / 开 MCP 弹窗），
      //     本刀按用户裁决只对齐那两页的尺寸与形态。工具栏那一侧也自带同一道闸（双保险，不是两份判据）：
      //     它只认 `resourceType === 'skill'`，其余页即便拿到这枚配置也不建 Menu。
      ...(resourceType !== 'skill' ? {} : {
        addSkillMenu: {
          open: addSkillMenuOpen,
          onClose: () => setAddSkillMenuOpen(false),
          onToggle: () => setAddSkillMenuOpen(open => !open),
        },
        onFindSkill: () => runDraftWithAgent('find'),
        onCreateSkill: () => runDraftWithAgent('create'),
        // 上报与"直接点那一项"走**同一枚**执行器（不是第二条通路），只是入口不同：
        // 前者给"键盘/程序触发到一枚 disabled 项"兜底，后者是菜单项自己的 onSelect。
        onSkillDraftFailure: (kind: EnterpriseEscDraftKind) => runDraftWithAgent(kind),
      }),
    }),
    // ★口径 60：本地导入那枚**导入弹窗**（挂在工具栏下方一格，与口径 46 那枚选择器同一个落点）。
    //   与商城页那三处落点同一条纪律：**触发钮在哪个视图里，落点就得在哪个视图里**——少挂一处
    //   就是"点了没反应"的死控件。★它换掉了口径 46 那枚恒不可见选择器（那枚仍活在商城页，一字未动）。
    createElement(EnterpriseSkillImportDialog, {
      open: skillImportOpen,
      onOpenChange: setSkillImportOpen,
      port: skillImportPort,
    }),
    /**
     * ★**口径 49**：下拉里「查找技能 / 创建技能」**没把话填进新会话**时的可见交代。
     *
     * 走**唯一**提示组件（人话 + 下一步 + 收进「技术信息」的稳定码 `ENT_ESC_DRAFT_UNAVAILABLE`），
     * `prefix` 说清是哪一项（查找技能 / 创建技能）没成 —— 不静默、也不把裸码砸在员工脸上。
     * 落点复用本页既有那枚错误类名 `esc-import-error`（与本地导入失败同一个视觉层，不新造样式）。
     */
    draftFailure === undefined
      ? null
      : createElement(EnterpriseErrorNotice, {
          className: 'esc-import-error',
          code: ENTERPRISE_ESC_DRAFT_FAILED_CODE,
          prefix: draftFailureLabel,
        }),
    /**
     * ★**本刀（Phase C D1：连接器广场）**：「系统广场」这一格（连接器页的默认维度）**整段**换成
     *   连接器广场那一支 —— 判据是**维度与资源类型这一对**（`resourceType === 'connector' && source === 'system'`），
     *   不是"列表为空"（按后果判会让将来任何一个空列表都掉进这一支）。
     *
     * ★**为什么必须整段换掉而不是"叠在上面"**（与企业技能 / 本地三方那两支逐条同因）：这一格的数据面
     *   不是平台目录 —— 平台那条连接器目录路由在这台部署上根本没有这个端点（回 `No static resource …`），
     *   故共享列表支（`useEnterpriseEscResourceList`）在这一格**恒空**；
     *   照旧往下走一趟就只剩一个 `EmptyBlock`（"暂无数据"）——那正是本仓明令禁止的"空又不加载又无错误"。
     * ★**连接器页另外两格（团队空间 / 已连接的）一字未动**：它们仍走平台那条目录面（本刀非目标）。
     */
    resourceType === 'connector' && source === 'system'
      ? createElement(EnterpriseEscConnectorPlaza, {
          // 端口缺席 ⇒ 广场自己出一句可见交代（判据是端口在不在场，不是界面写死 disabled）。
          ...(connectorPort === undefined ? {} : { port: connectorPort }),
          keyword,
        })
      /**
       * ★**口径 62**：「本地三方」维度下，右侧这三态（登录门 / 首屏加载 / 卡片网格-空态-失败行）
       * **整段不渲染** —— 这一维度的内容由下面那一支 `EnterpriseEscThirdParty` 铺。
       *
       * ★为什么必须**整段**换掉而不是"叠在上面"：本维度**没有**平台列表可取（适配器表里没有它那一支
       *   ⇒ `list` 恒空、`loading` 恒假、`error` 恒缺席），若照旧往下走一趟，页面上会出现
       *   `EmptyBlock`（「暂无数据」）——那正是口径 62 明令禁止的"空又不加载又无错误"的空白态。
       * ★判据取 `source === 'third-party'`（**不是**"列表为空"）：维度是唯一的事实，
       *   列表空只是它的后果；按后果判会让将来任何一个空列表维度都掉进这一支。
       */
      : source === 'third-party'
      ? createElement(EnterpriseEscThirdParty, {
          // ★真值与过滤都在**上面那一层**（chip 行住在工具栏，必须与候选列表同源）。
          state: thirdPartyState,
          /** 当前选中的来源根（空串 = 全部）；过滤发生在铺行那一层，四态投影拿的永远是整份真值。 */
          selectedRoot: thirdPartySubTabs?.activeKey ?? ENTERPRISE_ESC_SUB_TAB_ALL_KEY,
          api,
          onReload: onReloadThirdParty,
          // ★成功之后**同时**做两件事，且用的都是**既有**那两枚令牌：
          //   ① `onReloadThirdParty`（重新扫描本维度，真值由 Host 说，界面不乐观切换）；
          //   ② `onInstalledRefresh`（请「已安装」计数重读）—— 与口径 46 本地导入成功时用的是**同一枚**
          //      refresh token（`installedRefreshToken`），**不新造第二个**：装了东西就该让计数重数一遍，
          //      这件事在本页只有一条机制。
          onRefresh: () => {
            onReloadThirdParty()
            onInstalledRefresh()
          },
          /**
           * ★**本刀（②）**：已装那一档那两枚按钮的计划 —— **与广场是同一枚工厂**
           *   （同一个 `moreOf` / `tryOf`，不是复制一份状态）⇒ 同一枚技能在两处不可能一处能卸、
           *   一处卸不了。★这也是"换卡"最容易漏的那一步：卡片换了、计划不交下去，
           *   那一档就会退回"计划缺席"的禁用形态（用户会在真机上看到两处不同的动作）。
           */
          moreOf,
          tryOf,
        })
      /**
       * ★**口径 53（本刀）**：「企业技能」维度下，平台那三态（登录门 / 首屏加载 / 卡片网格-空态-失败行）
       * **整段不渲染** —— 这一维度的内容由下面那一支 `EnterpriseEscCatalog` 铺。
       *
       * ★为什么必须**整段**换掉而不是"叠在上面"：本维度**没有**平台列表可取（适配器表里没有它那一支
       *   ⇒ `list` 恒空、`loading` 恒假、`error` 恒缺席），若照旧往下走一趟，页面上会出现
       *   `EmptyBlock`（「暂无数据」）——那正是"空又不加载又无错误"的空白态（口径 62 起本仓明令禁止）。
       * ★判据取 `source === 'catalog'`（**不是**"列表为空"）：维度是唯一的事实，列表空只是它的后果。
       * ★**取数源与 chip 行都在上面那一层**（同源），这一支只画 + 把动作交上去。
       */
      : source === 'catalog'
      ? createElement(EnterpriseEscCatalog, {
          state: catalogState,
          keyword,
          category: catalogSubTabs?.activeKey ?? ENTERPRISE_ESC_SUB_TAB_ALL_KEY,
          skillPort,
          onReload: onReloadCatalog,
          // ★与「本地三方」那支**同一枚** refresh token（`installedRefreshToken`）：
          //   装了东西就该让顶栏计数重数一遍，这件事在本页只有一条机制。
          onInstalledRefresh,
        })
      /**
       * ★**本刀 ③（SkillHub 维度）**：这一维度下，平台那三态（登录门 / 首屏加载 / 卡片网格-空态-失败行）
       *   **整段不渲染** —— 内容由下面那一支 `EnterpriseEscSkillHub` 铺。
       *
       * ★为什么必须**整段**换掉而不是"叠在上面"（与「本地三方」「企业技能」逐条同因）：这一维度的
       *   数据面**不是平台目录**（`esc-list.ts` 的适配器表里没有它那一支 ⇒ `list` 恒空、`loading` 恒假、
       *   `error` 恒缺席），若照旧往下走一趟，页面上会出现 `EmptyBlock`（「暂无数据」）
       *   —— 那正是"空又不加载又无错误"的空白态（口径 62 起本仓明令禁止）。
       * ★判据取 `source === 'skillhub'`（**不是**"列表为空"）：维度是唯一的事实，列表空只是它的后果。
       */
      : source === 'skillhub'
      ? createElement(EnterpriseEscSkillHub, {
          // ★真值与查询串都在上面那一层（搜索框住在工具栏，必须与结果卡同源）。
          state: skillHubState,
          query: keyword,
          onReload: onReloadSkillHub,
          // ★装好一条之后请「已安装」计数重读 —— **复用**本页那一枚既有的 refresh token，
          //   **不新造第二个**（装了东西就该让计数重数一遍，这件事在本页只有一条机制）。
          onInstalledRefresh,
          // ★已装那一档那两枚按钮与广场**同一枚工厂**（同一个 `moreOf` / `tryOf`）⇒
          //   同一枚技能在两处不可能一处能卸、一处卸不了。
          ...(skillPort === undefined ? {} : { installFromResult: skillPort.installFromResult }),
          moreOf,
          tryOf,
        })
      : signedOut === true
      ? createElement(
          'div',
          { className: 'esc-gate' },
          createElement('div', { className: 'esc-gate-title', children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredTitle }),
          createElement('div', { className: 'esc-gate-body', children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredBody }),
          createElement(Button, { variant: 'outline', size: 'sm', onClick: retry, children: ENTERPRISE_ESC_LOCAL_COPY.retry }),
        )
      : initialLoading
        ? createElement(
            // ★口径 35④：官方那一态画的是 `components/custom/Loading`（一枚转圈图标 + 「加载中...」，
            //   居中、色走主色、字号 12、间距 8px）。原先是本页自造的六张骨架卡，现按官方换成同一枚。
            'div',
            { className: 'esc-loading', 'aria-busy': true },
            createElement(LoaderCircle, { size: 16, className: 'esc-loading-icon', 'aria-hidden': true }),
            createElement('span', { children: ENTERPRISE_ESC_COPY.loading }),
          )
        : visibleList.length > 0
          ? createElement(
              'div',
              { className: 'esc-scroll esc-scroll-hidden', ref: containerRef, onScroll: handleScroll },
              /**
               * ★**口径 64**：刚装好一枚那句可见反馈（`role="status"`；下一次动作开始时清掉）。
               * 落点复用既有 `.esc-catalog-status`（与另两枚维度的在途/成功交代同一套字号与颜色，
               * **零新增 CSS 类**）；它铺在网格**之上**，故不会让卡片列位次平移。
               */
              systemNotice === undefined
                ? null
                : createElement('p', {
                    className: 'esc-catalog-status',
                    role: 'status',
                    'data-esc-system-installed': 'true',
                    children: systemNotice,
                  }),
              /**
               * ★**本刀（S5a）**：那两枚本机管理动作的**成功交代**（「已卸载…」/「已打开…」）。
               *
               * 落点与上面那句同一条（`.esc-catalog-status` + `role="status"`，**零新增 CSS 类**）：
               * 两条通路说的是同一类事情（"刚才那一下成了"），没有理由长出第二种版式。
               * 可见性是这两枚动作的硬要求之一（卸载是破坏性的、打开文件夹是异步的）：
               * 动作一成功就得有一句能读到的话，而不是只靠"卡片上的 `⋯` 忽然不见了"。
               */
              moreNotice === undefined
                ? null
                : createElement('p', {
                    className: 'esc-catalog-status',
                    role: 'status',
                    'data-esc-skill-more-notice': 'true',
                    children: moreNotice,
                  }),
              /**
               * ★**本刀（S5b）**：「去试试」办成之后那句交代（「已在新会话的输入框里填好…按发送即可」）。
               *
               * 落点与上面几句同一条（`.esc-catalog-status` + `role="status"`，**零新增 CSS 类**）。
               * ★为什么必须说出来：那一下的可见结果是**官方把主视图切到了新会话**（我们**不**自己开页面），
               *   员工回到这一页时只看到按钮复原了；没有这句话，"刚才那一下到底成没成"就无从判断。
               * ★措辞**如实**：只填不发送（`enterpriseEscSkillTryFilledText` 说清了这一件）。
               */
              tryNotice === undefined
                ? null
                : createElement('p', {
                    className: 'esc-catalog-status',
                    role: 'status',
                    'data-esc-skill-try-notice': 'true',
                    children: tryNotice,
                  }),
              /**
               * ★**本刀（S5a）**：**本机自装清单读不到**时那句如实交代（降级必须可见）。
               *
               * ★为什么非说不可：那份清单是那两枚动作**唯一的可用性判据**，读不到 ⇒ 每张卡上都不会有
               *   `⋯`。若静默，员工只会看到"这页没有本机管理入口"，而不会知道那是**取数失败**。
               *   故按本仓既有口径出一句 `role="status"`（人话 + 下一步由唯一码表给，稳定码原样带上）。
               * ★它**不拖垮整页**：目录与已装计数照旧（自装清单是次级取数），只是那两枚动作这次不可用。
               */
              selfInstalledCode === undefined
                ? null
                : createElement('p', {
                    className: 'esc-catalog-degraded',
                    role: 'status',
                    'data-esc-skill-more-degraded': selfInstalledCode,
                    children: `${enterpriseErrorMessage(selfInstalledCode)}下一步：${enterpriseErrorAction(selfInstalledCode)}`,
                  }),
              createElement(
                'div',
                { className: 'esc-list-section' },
                visibleList.map((item) => {
                  /**
                   * ★**口径 64**：**系统广场 × 技能**这一格才构造安装终态 ——
                   * 专家（召唤）、连接器（连接/断开）两档与**团队空间**那枚维度都**不给**计划。
                   * ★**本刀（用户冻结规格 §2）**：这一枚终态**只在本层的 `installOf` 里构造一次**
                   *   （上面那一处），广场网格与精选行**共用它** ⇒ 同一份夹具下两处的卡片入参逐键相等；
                   *   改前这里就地构造、精选行拿不到 ⇒ 精选卡退回兜底形态（"描述三行"那一版）。
                   */
                  const install = installOf(item)
                  /**
                   * ★**本刀（S5b）**：这一枚技能装没装（**与卡片 `installed` 同源**：同一个
                   * `installedIds`、同一把名字键）。抽成局部量是**为了让它只算一次**——卡片那格与
                   * 「去试试」计划必须拿到**同一个**布尔，否则会出现"卡片画着已装、按钮却说还没装"。
                   * ★它同时是**隐藏规则**那把键（`visibleList` 用的是同一份 `installedIds`、同一个名字）。
                   */
                  const skillInstalled = resourceType === 'skill' && installedIds.has(item.name)
                  /**
                   * ★**本刀（S5b）**：这一枚技能卡的「去试试」计划（**唯一构造点** `tryOf`）。
                   *
                   * ★与 `more` 那道闸**刻意不同**：这里**不按维度限定**（`resourceType === 'skill'`
                   *   即可，系统广场 / 团队空间都算）——「去试试」不依赖任何本机管理路由，只要这枚技能
                   *   **装在本机**就该能试；按维度藏起来只会留下"同一枚技能在别的维度点得动、在这里
                   *   点不动"的第二种形态。
                   * ★计划**恒有值**（不可用是"禁用 + 行上可见原因"，不是"整枚不画"）——故这里不做
                   *   `undefined` 判断，直接交下去。
                   */
                  const tryNow = resourceType === 'skill' ? tryOf(item.name, skillInstalled) : undefined
                  /**
                   * ★**本刀（S5a + 用户冻结规格 §3）**：已装那一档那枚「更多」的计划（**唯一构造点** `moreOf`）。
                   *
                   * ★判据在纯投影里（`enterpriseEscSkillMorePlan`：这个名字在不在本机自装清单的
                   *   `names[]` 里 + 端口在不在场）⇒ 算出来 `undefined` 就**连 `⋯` 都不画**：
                   *   中心装下来的、官方内置的那批技能因此**没有卸载入口**（画了就是在暗示能卸）。
                   * ★它**只在技能卡**上给（`showUse` 那一档才有这枚下拉）；维度取系统广场
                   *   （团队空间那一支没有这枚动作，与安装计划同一条闸）。
                   * ★**本刀**：把**同一枚**「去试试」计划交给它 —— 「去对话」那一行的**可点性**与
                   *   动作都取自那一枚（同一份事实、同一个执行器），不另判一套。
                   */
                  const more = resourceType === 'skill' && source === 'system'
                    ? moreOf(item.name, tryNow)
                    : undefined
                  /**
                   * ★**本刀（用户冻结规格 §1②③ + §2）**：技能档的卡片入参**只**从这一枚共享投影来
                   *   （`esc-featured.tsx` 调的是**同一个函数**）⇒ 精选卡与广场卡逐键同源；
                   *   "刚装那一枚"在这一处就把 `more`/`install` 两格摘掉（只留「去试试」）。
                   * ★另两档（专家 / 连接器）的形状**逐字照改前**：它们的动作不在本刀里。
                   */
                  const cardProps = resourceType === 'skill'
                    ? enterpriseEscSkillCardSpec({
                        installed: skillInstalled,
                        justInstalled: item.name === cardMark.name,
                        ...(install === undefined ? {} : { install }),
                        ...(more === undefined ? {} : { more }),
                        ...(tryNow === undefined ? {} : { tryNow }),
                      })
                    : {
                        // 专家&专家团卡片图标裁圆（技能/连接器保持方形口径）
                        iconShape: resourceType === 'expert' ? 'circle' as const : 'square' as const,
                        showSummon: resourceType === 'expert',
                        showUse: false,
                        // ★本刀：技能卡按「这个技能在不在已装清单里」在两种动作形态间分流。
                        //   匹配键是**名字**（见上面那段实测纠正：packageId 与广场 id 不是一套坐标系）。
                        installed: skillInstalled,
                        // 底部那一行：★**口径 42** 起**专家卡也走标签行**（作者 + 三格统计，与技能卡同一行，
                        //   见 esc-card.tsx 的 tagRowLayout）⇒ 这一位现在只对**旧三层版式**生效：
                        //   连接器靠它不画那条空页脚（技能卡本就靠标签行、不看它）。
                        showStats: resourceType === 'expert',
                        showConnect: resourceType === 'connector',
                      }
                  const card = createElement(EnterpriseEscCard, {
                    key: item.id,
                    item,
                    ...cardProps,
                  })
                  /**
                   * ★**口径 64**：失败只落在**失败的那一行**上（坐标对得上才铺该行）。
                   *   它与"平台目录读不到"那条 `ErrorRow` **互不覆盖**（一个说这一条没装成，
                   *   一个说这一整面没读到）——两者可以同时成立，故各自有各自的落点。
                   */
                  const failure = resourceType === 'skill' && source === 'system'
                    && item.targetId !== undefined
                    && systemError !== undefined
                    && systemError.id === item.targetId
                    ? createElement(EnterpriseEscSystemInstallFailure, {
                        targetId: item.targetId,
                        code: systemError.code,
                        // ★"可重试"是真的重发：同一枚写入口、同一枚坐标（不是重画一下）。
                        onRetry: (targetId: number) => { runSystemInstall(targetId, item.name) },
                      })
                    : null
                  /**
                   * 失败块与卡片同格（`.esc-catalog-cell` 是既有那套"卡片 + 其下失败块"的列布局；零新增 CSS）。
                   *
                   * ★**本刀（用户裁决②：高度同源只收窄到"广场那张刚装卡"）**：刚装那一枚多一层**外层格**，
                   *   并在那一格上打一枚**显式属性** `data-esc-skill-just-installed="true"`——
                   *   `esc-style.ts` 那条"「去试试」高度与【＋】同源"的规则**就挂在这枚属性下**。
                   *   · **为什么不挂在卡片组件上**：那是这一页的**位置事实**（这一枚在广场里、是刚装的那一枚），
                   *     不是卡片自己的属性；卡片层本刀零改动（`esc-card.tsx` 一个字节都没碰）。
                   *   · **为什么只有这一档多包一层**：另两档（普通未装卡、有失败块的那一行）结构**一字未动**
                   *     ——不给"顺手把所有卡片都包一层"留口子（那会动到既有位置级结构锁）。
                   */
                  const justInstalled = resourceType === 'skill' && item.name === cardMark.name
                  const cellProps = {
                    key: item.id,
                    className: 'esc-catalog-cell',
                    ...(justInstalled ? { 'data-esc-skill-just-installed': 'true' } : {}),
                  }
                  return failure === null && !justInstalled
                    ? card
                    : createElement('div', cellProps, card, failure)
                }),
              ),
              // 触底加载中的提示 + 追加加载失败的如实行（原文只有 loader）
              // ★本刀：这行原先复用整屏态那枚 `.esc-state`（内衬 20px ⇒ 出现/消失会把列表顶一下，
              //   在"一遍遍空补拉"的场景里就是看得见的闪）。换成**定高紧凑行** `.esc-scroll-loader`。
              loading ? createElement('div', { className: 'esc-scroll-loader', children: '加载中…' }) : null,
              error !== undefined
                ? createElement(ErrorRow, { code: error.code, message: error.message, onRetry: retry })
                : null,
            )
          : error !== undefined
            ? createElement(ErrorRow, { code: error.code, message: error.message, onRetry: retry })
            /**
             * ★**本刀**：空态分两句不同的实话 —— `allInstalled` 在场（**读到了、全被滤掉**）时说
             * "都装到本机了" + 下一步；缺席（**确实没有数据**）时逐字回到改前那一态
             * （插图 + 官方那句「暂无数据」）。两者**共用同一个类名族**（`.esc-state` 一行），零新增 CSS。
             */
            : allInstalled === undefined
              ? createElement(EmptyBlock, {})
              : createElement(EmptyBlock, { note: allInstalled }),
  )
}

/**
 * ★**口径 62**：「本地三方」维度的**动作层**（内容区的最后一块）。
 *
 * ★**它现在只管"安装"这一件事**：取数与"哪几枚 chip、选中的是哪一枚"都提到了聚合层（理由见那里：
 *   chip 行住在工具栏、候选列表住在内容区，两者**必须同源**——取数留在这一层再由回调把 chip 交上去，
 *   就成了"子组件 fetch → 回调 setState → 父组件重渲染 → 子组件重建取数源"那种**自激**形状）。
 *   抽成子组件仍然值得：安装执行器需要一个**稳定的生命周期**（与"这一维度在不在场"同生共死），
 *   而它持的那两枚可见反馈（在哪一行、哪一句）也只属于这一块。
 *
 * ★三条纪律照既有通路（系统搜索/在线搜索）逐条对齐：
 *  ① **不中止在途的安装**：那是一次**写**动作（宿主可能已经把目录复制过去了），中止 fetch 并不会
 *     撤销它，只会让界面**不知道**结果 ⇒ 让它跑完（结算后照旧刷新，下次进来就看得到）。
 *     故这里的安装执行器拿的是**不会被打断**的信号（见 `esc-third-party-install.ts` 头注）。
 *  ② **成功后不乐观切换**：既不改本地那份清单里的 `status`，也不自己加减计数 —— 真值一律靠
 *     重新扫描（`onRefresh` 里那两件事）说出来。
 *  ③ **失败不吞**：安装失败只落在那一行上（`installError`），与"扫描失败"（`state.kind === 'failed'`）
 *     两件事互不覆盖。
 *
 * ★**一次只允许一条在途**由 `createEnterpriseThirdPartyInstaller` 保证（那是可直调取证的对象，
 *   本仓 vitest 没有 DOM）：被挡下的第二次点击**返回 false 且一条请求都不发**，界面那一侧
 *   看到的是"其余按钮都禁用 + 旁边写着为什么"。
 */
function EnterpriseEscThirdParty({
  api,
  state,
  selectedRoot,
  onReload,
  onRefresh,
  moreOf,
  tryOf,
}: {
  readonly api: EnterpriseEscApi
  /** 四态真值（**由聚合层持有**：chip 行与它同源）。 */
  readonly state: EnterpriseListState<EnterpriseThirdPartySkills>
  /** 当前选中的来源根（空串 = 全部）。 */
  readonly selectedRoot: string
  /** 重新扫描（失败态那枚【重试】与就绪态那枚【重新扫描】共用它；由聚合层持有）。 */
  readonly onReload: () => void
  /** 装好一枚之后要做的两件事（重扫本维度 + 请「已安装」计数重读）。 */
  readonly onRefresh: () => void
  /** ★**本刀（②）**：已装那一档那两枚按钮的计划工厂（**就是广场那一枚**，由聚合层持有）。 */
  readonly moreOf: (name: string, tryPlan?: EnterpriseEscSkillTryPlan | undefined) => EscCardMore | undefined
  readonly tryOf: (name: string, installed: boolean) => EscCardTryNow
}): ReactNode {
  /**
   * 安装执行器：**每次挂载一枚**（与这一维度的在场与否同一条生命周期）。
   *
   * ★它自己持"在途是哪一条"（不需要再造一枚 React state，也就不会出现"state 说没有、执行器说
   *   有"这种两处判据）；`useState` 那枚 `tick` 只是把它的变化**通知给渲染**（执行器是外部对象，
   *   快照又是一对 `isBusy/target` 而不是一枚稳定值，故用自增 tick 订阅它 —— 语义与
   *   `useSyncExternalStore` 相同、代码更短，且不引入第二份真值）。
   */
  const [tick, setTick] = useState(0)
  /** 安装的可见反馈：失败归到那一行（`id` + 稳定码）、成功是一句 `role="status"`。两者互斥。 */
  const [installError, setInstallError] = useState<{ readonly id: string; readonly code: string } | undefined>(undefined)
  const [installedNotice, setInstalledNotice] = useState<string | undefined>(undefined)
  const installer = useMemo(
    () => createEnterpriseThirdPartyInstaller({
      run: (target, signal) => api.installThirdPartySkill(target.id, signal),
      errorCode: enterpriseLocalErrorCode,
      onSettled: (target, settlement) => {
        setTick(current => current + 1)
        if (settlement.ok) {
          setInstalledNotice(enterpriseThirdPartyInstalledText(target.title))
          setInstallError(undefined)
          // ★成功：重扫本维度 + 请计数重读（两件事都在 `onRefresh` 里，用的是既有那两枚令牌）。
          onRefresh()
        } else {
          setInstalledNotice(undefined)
          setInstallError({ id: target.id, code: settlement.code })
        }
      },
    }),
    [api, onRefresh],
  )
  useEffect(() => installer.subscribe(() => { setTick(current => current + 1) }), [installer])
  /** ★这里**读** `tick` 是为了让订阅到的变化真的触发重渲染（执行器本身是外部可变对象）。 */
  void tick
  const busy = installer.target()
  return createElement(EnterpriseEscThirdPartyList, {
    state,
    selectedRoot,
    ...(busy === undefined ? {} : { busy }),
    ...(installError === undefined ? {} : { installError }),
    ...(installedNotice === undefined ? {} : { installedNotice }),
    // ★写入口的判据是**端口在不在场**（`api.installThirdPartySkill` 是必填方法，故这里恒在场）；
    //   门票仍在：`EnterpriseEscThirdPartyList` 按 `onInstall === undefined` 判"整条不在场"，
    //   故将来若要降级，只在这里停传即可（界面那一侧一个字都不用改）。
    onInstall: (id, name) => {
      // 开始一次新动作：清掉上一轮的两句反馈（否则失败行会与新一次安装并存）。
      setInstallError(undefined)
      setInstalledNotice(undefined)
      // ★被"一次一条"挡下时**返回 false**：那一条请求一条都没发，界面也不必多说一句
      //   ——正在装的那一行照旧写着"正在安装「X」…完成前不能安装别的技能。"，原因已经在屏幕上。
      installer.run({ id, title: name })
    },
    onReload,
    /**
     * ★**本刀（②）**：这两格**原样透传**（不是在这里再造一份计划表）：已装那一档那两枚按钮
     *   与广场网格、精选行拿的是**同一枚**工厂 ⇒ 同一枚技能在三处不可能给出两个答案。
     */
    moreOf,
    tryOf,
  })
}

/**
 * ★**本刀 ③（SkillHub 维度）**：「SkillHub」维度的**动作层**（有状态包装）。
 *
 * ★**为什么与纯渲染那一叶分开**（与 `EnterpriseEscThirdParty` / `EnterpriseEscCatalog` 同一条手法）：
 *   本仓的 vitest **没有 DOM**，而 `useState` 只能活在真渲染器里 ⇒ 三件状态（在途那一条 / 失败落在
 *   哪一条 / 刚成功那一句）与唯一执行路住在这里，**取数**（四态 + 真重发）住在聚合层，
 *   纯渲染那一叶（`esc-skillhub-list.tsx`）因此可以直调取证。
 *
 * ★**三条动作纪律照既有通路逐条对齐**：
 *   ① **一次只允许一条在途**：`pending` 在场时第二次点击**直接返回**（不排队、不重入），
 *      其余每一枚按钮随之禁用并在**各自的位置**写明原因（判据在纯投影里，视图只画）；
 *   ② **成功以宿主回执为准**：装成功只把那条坐标记进"本次会话已装"（那一格驱动结果卡走
 *      "已装"那一档）+ 请「已安装」计数重读（**复用聚合层那一枚** refresh token）——
 *      界面**不乐观切换**任何本机清单；
 *   ③ **失败不吞**：失败只落在**那一条结果**上（人话 + 下一步 + 稳定码），与"整次搜索读不到"
 *      （`state.kind === 'failed'`）两件事互不覆盖。
 */
function EnterpriseEscSkillHub({
  state,
  query,
  onReload,
  onInstalledRefresh,
  installFromResult,
  moreOf,
  tryOf,
}: {
  /** 四态真值（**由聚合层持有**：搜索框与结果卡必须同源）。 */
  readonly state: EnterpriseListState<EnterpriseOnlineSkillSearch>
  /** 搜索框里的当前文本（已防抖，由工具栏那一枚输入框持有）。 */
  readonly query: string
  /** 再搜一次（失败态那枚重试；**真的**再发一次请求）。 */
  readonly onReload: () => void
  /** 装好一条之后请「已安装」计数重读（**复用**聚合层那一枚 refresh token）。 */
  readonly onInstalledRefresh: () => void
  /** 写入口（缺席 ⇒ 那枚【＋】禁用 + **行上可见**写明原因；判据是端口，不写死 disabled）。 */
  readonly installFromResult?: ((source: string, signal: AbortSignal) => Promise<readonly EnterpriseInstalledSkill[]>) | undefined
  readonly moreOf: (name: string, tryPlan?: EnterpriseEscSkillTryPlan | undefined) => EscCardMore | undefined
  readonly tryOf: (name: string, installed: boolean) => EscCardTryNow
}): ReactNode {
  /** 本次会话里**已经装好**的那些坐标（宿主回执之后才记 → 界面不乐观切换）。 */
  const [installedSources, setInstalledSources] = useState<readonly string[]>([])
  /** 在途的那一条（坐标 + 只为那句可见文案念得出来的名字）。 */
  const [pending, setPending] = useState<{ readonly source: string; readonly name: string } | undefined>(undefined)
  /** 哪一条装失败了（坐标 + 稳定码）：只落在那一张卡上。 */
  const [installError, setInstallError] = useState<{ readonly source: string; readonly code: string } | undefined>(undefined)
  /** 刚刚装成功那一句（`role="status"`；下一次动作开始时清掉）。 */
  const [installedNotice, setInstalledNotice] = useState<string | undefined>(undefined)
  /**
   * 唯一写入口：`local-api.ts` 那条 `POST /skills/install-from-result`（由 `client.tsx` 接线）。
   *
   * ★**超时**与另两条安装通路**同一个数字**（120s：制品上限 50 MiB，且宿主要走
   *   「下载 → SHA-256 校验 → 解包 → 落盘」四步）—— 同一件事没有理由有两个超时口径。
   * ★**不中止在途的那一次**：那是一次**写**（宿主可能已经把目录落盘了），中止 fetch 并不会撤销它，
   *   只会让界面**不知道**结果；故这里给的是**超时**信号，不是"关掉这一维就取消"。
   */
  const runInstall = useCallback((source: string, name: string): void => {
    if (pending !== undefined) return
    if (installFromResult === undefined) return
    setPending({ source, name })
    setInstallError(undefined)
    setInstalledNotice(undefined)
    void installFromResult(source, AbortSignal.timeout(ENTERPRISE_ESC_SKILLHUB_INSTALL_TIMEOUT_MS)).then(
      () => {
        // ★以宿主回执为准：它回来了才算"这一条装过了"（界面不乐观翻态）。
        setInstalledSources(previous => previous.includes(source) ? previous : [...previous, source])
        setInstalledNotice(enterpriseSkillHubInstalledText(name))
        // ★同一枚 refresh token：装了东西就该让顶栏计数重数一遍。
        onInstalledRefresh()
      },
      (error: unknown) => {
        setInstallError({ source, code: enterpriseLocalErrorCode(error) })
      },
    ).finally(() => { setPending(undefined) })
  }, [pending, installFromResult, onInstalledRefresh])
  return createElement(EnterpriseEscSkillHubList, {
    state,
    query,
    installedSources,
    ...(pending === undefined ? {} : { busy: pending }),
    ...(installError === undefined ? {} : { installError }),
    ...(installedNotice === undefined ? {} : { installedNotice }),
    ...(installFromResult === undefined ? {} : { onInstall: runInstall }),
    moreOf,
    tryOf,
    onReload,
  })
}

/**
 * 「SkillHub」安装的超时（120s）。
 *
 * ★与「企业技能」那枚 `ENTERPRISE_CATALOG_INSTALL_TIMEOUT_MS`（`esc-catalog-list.tsx`）**同一个数字**：
 *   同一件"下载 + 校验 + 解包 + 落盘"的事，没有理由有两个超时口径。
 * ★为什么不用 `skillPort` 那一族（本机导入）的写法：那条是浏览器**交文件字节**，走的是另一条通路；
 *   这一条与「企业技能」那条**同族**（宿主自己去公开市场取制品）。
 */
const ENTERPRISE_ESC_SKILLHUB_INSTALL_TIMEOUT_MS = 120_000

/**
 * 空态：官方那一态画的是 antd `<Empty>`（一张插图 + 「暂无数据」四个字）。
 *
 * dsh 的原语里**没有** Empty/NoData 组件（清单见 `dsh-client-ui-primitives`），故按 dsh 的 token 画一张
 * 等价插图：一枚灰底圆角方块 + 里面的 lucide `Inbox`（与本页其它图标同一套图源）。文案仍**逐字**用官方那枚
 * `PC.Common.Global.emptyData`（`ENTERPRISE_ESC_COPY.emptyData`）——不翻译、不改写。
 *
 * ★**本刀**：同一枚空态块还要说**第三种"为什么空"**（读到了数据、可每一枚都被"已装隐藏"滤掉了 ⇒
 * "都装到本机了"）——故它多一格**可选**的 `note`（纯投影 `enterpriseEscSkillAllInstalledEmpty` 给的两句话）。
 * 三条自我约束：
 *   ① **两句不同的话**：第一句说**为什么空**、第二句说**下一步去哪儿**（只给一句，员工会以为出错了）；
 *   ② **复用既有类名、零新增 CSS**：插图仍是 `.esc-empty-art`，两句分别用既有 `.esc-state-title`
 *      与既有 `.esc-catalog-status`（两枚都早已在本文件样式表里声明过——门禁有一条反向锁盯住这件事）；
 *   ③ **缺席即逐字回到改前那一态**：另两处调用点（`list.length === 0` 与整屏态）一个字都不变。
 */
/** `EmptyBlock` 的入参（★本刀：第三种"为什么空"的两句话；缺席＝逐字回到改前那一态）。 */
interface EmptyBlockProps {
  readonly note?: { readonly title: string; readonly body: string } | undefined
}
function EmptyBlock({ note }: EmptyBlockProps): ReactNode {
  return createElement(
    'div',
    { className: 'esc-state' },
    createElement(
      'div',
      { className: 'esc-empty-art', 'aria-hidden': 'true' },
      createElement(Inbox, { size: 28, strokeWidth: 1.5 }),
    ),
    /**
     * ★**本刀**：第三种"为什么空"的两句话（**只有这一档**才出现；两句都用既有类名）。
     *
     * ⚠这一档与官方那句「暂无数据」**互斥**（下面那个三元就是判据）：这一格里不是"没有数据"，
     *   是"**都装过了**"——再画一句「暂无数据」，就是用一句假话盖住**我们自己那张隐藏规则**造成的空。
     */
    note === undefined
      ? createElement('div', { children: ENTERPRISE_ESC_COPY.emptyData })
      : createElement(
          'div',
          { 'data-esc-skill-all-installed': 'true' },
          createElement('div', { className: 'esc-state-title', children: note.title }),
          createElement('p', { className: 'esc-catalog-status', children: note.body }),
        ),
  )
}

/** 失败行：稳定码 + 平台原话 + 重试（原文在这一态画的是空态，故这是本页新增的一态）。 */
function ErrorRow({
  code,
  message,
  onRetry,
}: {
  readonly code: string
  /** 上游自由文本。★**故意不渲染**（见下面那行注释）——保留入参是为了调用方不必改签名。 */
  readonly message: string
  readonly onRetry: () => void
}): ReactNode {
  return createElement(
    'div',
    { className: 'esc-state' },
    createElement('div', { className: 'esc-state-title esc-state-error', children: enterpriseErrorMessage(code) }),
    /* ★平台那句**自由文本不再直接上屏**。真机截图里那行英文原话（`No static resource …` 之类）
       被人直接读到了——那是**上游的实现细节**，不是给用户看的话，
       而且它其实在说「NUWAX 那边没有这个端点」，用户读不出下一步该做什么。
       **保留**的是那一枚稳定码（`4040` 这类）：它可检索、能定位，且不含任何实现细节。
       这一条纪律与全仓 `no-silent-swallow` 那条一致——**说出来，但只说人话 + 稳定码**。 */
    createElement('div', { className: 'esc-state-code', children: code }),
    // ★不可重试的失败（部署缺能力那类）**不画「重试」**——重试对它永远无效，
    //   画一枚只会把人引向死路（全仓 error-messages 的 retryable 纪律）。
    enterpriseErrorRetryable(code)
      ? createElement(Button, { variant: 'outline', size: 'sm', onClick: onRetry, children: ENTERPRISE_ESC_LOCAL_COPY.retry })
      : null,
  )
}
