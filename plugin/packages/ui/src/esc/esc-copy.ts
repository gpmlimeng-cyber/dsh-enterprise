/**
 * [INPUT]: 无（纯字面量，只依赖本文件自身）
 * [OUTPUT]: 对外提供 `ENTERPRISE_ESC_COPY`——「专家·技能·连接器」页面的可见文案，逐条取自
 *   NUWAX 前端 `src/locales/i18n/zh-CN.ts` 的 `PC.Pages.ExpertSkillConnector.*`（外加五枚零散键，见下）
 * [POS]: esc 页面的**词汇真源**。原页面的文案走 `dict('PC.Pages.ExpertSkillConnector.x')` 的运行时字典；
 *   DSH 这一侧没有那套 i18n 运行时，故把**同一批中文原样**落成常量——不翻译、不改写、不"顺手润色"。
 *   ★与 NUWAX 的对应关系逐条可查（`node audit-esc-faithfulness.mjs` 把下面这些**逐字**对过一遍）：
 *   页内 15 句里抄了 **13** 句（`pageTitle` = '专家·技能·连接器' 等）；未抄的 2 句是
 *   `toggleEnabledFailed`（'切换启用状态失败'）与 `missingConnectionId`（'连接 id 缺失，无法切换连接状态'）——
 *   它们只服务于"切换启用/切换连接状态"这条本刀**不接入**的动作路径（按钮已置灰），故不放进词汇表。
 *   跨页**五**枚同样逐字复制，各自原键名：`paid`/`subscribed` = `PC.Pages.Square.SingleAgent.*`、
 *   `collect`/`cancelCollect` = `PC.Pages.HomeDrag.*`、`emptyData` = `PC.Common.Global.emptyData`。
 *   `connected`/`disconnected` 两枚**不是** i18n 取值：原页面就是 JSX 里的行内字面量
 *   （`ResourceCard/index.tsx:173` 的 `{connectStatusOn ? '已连接' : '未连接'}`）；这两个串在 i18n 表里
 *   另有归属键（如 `PC.Components.VncPreview.connected`），但**本页不使用它们**——照抄原页面的做法。
 *   ★只放**本刀真用得上**的：付费订阅、收藏、连接器接入等动作本刀不做，故只留它们在卡片上的展示位文案。
 *   ★**口径 49**：`searchPlaceholder`（搜索名称或描述...）被 `searchPlaceholder{Expert,Skill,Connector}`
 *   三枚**替换**（WorkBuddy 实机 i18n 原文；旧格已整枚删除，不留第二真源）；新增技能页下拉三项文案
 *   `addSkill{Find,Upload,Create}` 与两句预填提示词 `skillFindPrompt`/`skillCreatePrompt`
 *   （逐字取自 `analysis/workbuddy-add-skill-research.md` §1/§2）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 「专家·技能·连接器」的可见文案。
 *
 * 键名保持与 NUWAX 的 i18n 键尾同名（`pageTitle`/`menuExpert`/…），便于逐条对照原文件；
 * 值一律是 NUWAX `zh-CN.ts` 里的**原文**。
 */
export const ENTERPRISE_ESC_COPY = {
  /** 左栏标题（`PC.Pages.ExpertSkillConnector.pageTitle`）。 */
  pageTitle: '专家·技能·连接器',
  /** 左栏三项（`menuExpert`/`menuSkill`/`menuConnector`）。 */
  menuExpert: '专家&专家团',
  /**
   * ★**用户裁决**（「专家专家团，名字只显示专家即可」）：页签上显示的名字。
   *
   * 官方那串 `menuExpert`（`专家&专家团`）仍逐字留在上一格——两格分开是为了**保真记录**与**显示改写**不互相打架：
   * 页面上的资源类型药丸读这一格，词典里仍能查到官方原话。
   */
  menuExpertDisplay: '专家',
  menuSkill: '技能',
  menuConnector: '连接器',
  /** 主 tab：系统广场 / 团队空间 / 已连接的 / 我启用的。 */
  mainTabSystem: '系统广场',
  mainTabTeam: '团队空间',
  mainTabConnected: '已连接的',
  mainTabEnabled: '我启用的',
  /** 二级分类首位页签。 */
  tabAll: '全部',
  /**
   * ★**口径 49**：搜索框占位**随页变**——三枚逐字取自 WorkBuddy 实机的 i18n 摘录
   * （`skills.search.placeholder` = 搜索技能 / 同族的专家与连接器那两枚）。
   *
   * ★这里**刻意不留**旧那枚 `searchPlaceholder: '搜索名称或描述...'`：它是被这三枚**替换**的，
   *   留着就是一个"看起来还能用"的第二真源（下一个人会问"到底哪一枚生效"）。
   *   旧值只活在 git 历史与 `tests/esc.spec.ts` 那条**反向锁**里（"旧文案不许回来"）。
   * ★三枚**互不相同**由门禁逐字锁住 —— 它们各自只说这一页那一种资源，比笼统的"名称或描述"更能告诉
   *   员工"这个框在搜什么"。
   */
  searchPlaceholderExpert: '搜索专家',
  searchPlaceholderSkill: '搜索技能',
  searchPlaceholderConnector: '搜索连接器',
  more: '更多',
  /** 专家卡片主按钮 / 技能卡片主按钮。 */
  summon: '召唤',
  useNow: '立即使用',
  /**
   * ★**用户裁决**（「技能选中的使用图标有点丑还是换成使用俩字」）：技能卡片主按钮上显示的文字。
   *
   * 上一刀曾按用户要求（「『立即使用』太长了，改成一个机器人聊天的图标即可」）改成 icon-only；
   * 这一刀用户判定图标不好看，改回文字、且只要**两个字**。官方那串 `useNow`（`立即使用`）仍逐字留在上一格
   * —— 与 `menuExpert`/`menuExpertDisplay` 同一套做法：**保真记录**与**显示改写**分开，词典里仍查得到官方原话。
   */
  useNowDisplay: '使用',
  /** 卡片右下角角标（`PC.Pages.Square.SingleAgent.*`）。 */
  paid: '付费',
  subscribed: '已订阅',
  /** 收藏图标的无障碍名（`PC.Pages.HomeDrag.*`）。 */
  collect: '收藏',
  cancelCollect: '取消收藏',
  /** 空态（`PC.Common.Global.emptyData`）。 */
  emptyData: '暂无数据',
  /** 首屏加载（`PC.Common.Global.loading`，zh-CN 逐字 = '加载中...'）——口径 35 把加载态换成官方
   *  `components/custom/Loading` 那一枚（转圈 + 这句）之后才用得上，故补进这份逐字复制表。 */
  loading: '加载中...',
  /** 连接器卡片的连接状态行（原页面里是行内字面量，不在 i18n 表内）。 */
  connected: '已连接',
  disconnected: '未连接',

  /* ══════════════ 本刀（workbuddy 风格重构）：以下为 NUWAX 原页面**没有**的句子 ══════════════
   * 上面每一格都是逐字复制（键名与 NUWAX i18n 键尾同名，便于逐条对照）。这一段是 **DSH 侧新增**的
   * 可见文案，来源是用户给的 workbuddy 截图，故**不进**上面的逐字复制表，也不参与
   * `audit-esc-faithfulness.mjs` 的逐字复核——那一格是「保真记录」，这一格是「DSH 自己的产品文案」，
   * 两者混在一张表里会毁掉那份复核的意义。 */

  /** 顶栏右块：已装筛选（带计数，原页面没有这一枚）。 */
  installedFilter: '已安装',
  /** 顶栏右块：添加技能（动作本刀不接线）。 */
  addSkill: '添加技能',
  /**
   * ★**口径 49**：技能页主按钮下拉里的三项（逐字取自 WorkBuddy 实机的 `skills.*.button`，
   *   见 `analysis/workbuddy-add-skill-research.md` §1 的代码原文）。
   *
   * ★**为什么只有技能页有这三项**：WorkBuddy 自己在三页是三种不同交互——技能页是下拉、
   *   专家页「我的专家」进**子页**、连接器页「自定义连接器」开 **MCP 弹窗**（研究文件 §3 已证）。
   *   后两者都要新做页面/弹窗与数据面，**本刀只对齐尺寸与形态、文案暂不改**
   *   （用户裁决：等"我的专家"子页与 MCP 弹窗排期再改名）—— 所以专家页/连接器页那两枚
   *   仍写「添加技能」、动作仍是本地导入。
   */
  addSkillFind: '查找技能',
  addSkillUpload: '上传技能',
  addSkillCreate: '创建技能',
  /** 卡片：未安装时那枚「+」的无障碍名。 */
  installSkill: '安装',
  /** 卡片：已安装时的「更多」下拉触发钮。 */
  moreActions: '更多操作',
  /** 卡片：已安装时的「去试试」。 */
  tryNow: '去试试',
  /** 精选行标题栏右侧那枚「换一批」。 */
  refreshBatch: '换一批',
  /** 精选行的那行标题（workbuddy 版式；★非 NUWAX 原文案——它是 workbuddy 的版式词）。 */
  featuredTitle: '精选技能',
  /** ★专家页那一行的标题——**不能沿用「精选技能」**（真机截图里专家页也挂着"精选技能"，
   *  读起来像错别字）。两页共用同一套逻辑，只有这两个词不同。 */
  featuredTitleAgent: '精选专家',
  /** 卡片标签行：收藏量。 */
  statCollect: '收藏',
  /** 卡片标签行：安装量（平台暂未提供该字段，界面按缺口显示占位）。 */
  statInstall: '安装',
  /** 卡片标签行：使用量（同上）。 */
  statUsage: '使用',
} as const

/** 文案键类型（`ENTERPRISE_ESC_COPY` 的键）。 */
export type EnterpriseEscCopyKey = keyof typeof ENTERPRISE_ESC_COPY

/**
 * DSH 这一侧**新增**的文案（NUWAX 原页面没有对应句子，故不放在上面那份逐字复制表里）。
 *
 * 每一句都对应一处**如实缺口**或一处 DSH 体系差异，写明原因而不是留白：
 *  · `signInRequired*`：原页面的数据来自 NUWAX 平台会话，DSH 侧要先登录员工 NUWAX 账号；
 *  · ★口径 31 曾有过 `loadFailed`（「加载失败」）——**本刀（失败面收口）撤下**：失败态的"发生了什么"
 *    一律取自 `error-messages.ts` 那张**唯一码表**（人话 + 下一步），页内不再自留一句笼统前缀，
 *    否则同一件事会出现两套措辞（本页原先正是平台原话 + 这枚前缀拼出来的）；
 *  · `actionNotPorted`：召唤/立即使用/连接/启停/付费这些动作本刀不做，按钮置灰并写明原因；
 *  · `moreExternal`：「更多」在原页面 `history.push` 到 NUWAX 广场分类页；**用户裁决**改指向公开技能广场
 *    `https://skillhub.cn/`（见 `esc-constants.ts` 的 `ESC_RESOURCE_MORE_HREF`），这枚是那链接的说明文字；
 *  · ★口径 32 曾有过 `mockBannerTitle`/`mockBannerBody` 一对（演示数据免责横幅）——**已被用户裁决撤下**
 *    （原话「模拟数据提示不要」），故这里不再有那两句；"这一栏是演示数据"这件事仍可在协议层查到
 *    （宿主 `GET …/esc/mock` + 演示响应的 `mock: true`），只是不再占据页面。
 */
export const ENTERPRISE_ESC_LOCAL_COPY = {
  signInRequiredTitle: '请先登录 NUWAX 账号',
  signInRequiredBody: '这个页面读取的是 NUWAX 平台的专家、技能与连接器目录，登录后才能看到内容。',
  /** 分类字典读不到时的那句提示（列表本身仍可看，只是筛选少了）。 */
  categoriesUnavailable: '分类暂时读不到',
  actionNotPorted: '该动作尚未在 DSH 侧接入',
  moreExternal: '在 skillhub.cn 打开技能广场',
  retry: '重试',

  /* ══════════════ 本刀（workbuddy 风格重构）══════════════ */

  /**
   * 卡片底部标签行里「安装量 / 使用量」的**缺口占位符**。
   *
   * 平台那条列表接口目前只给 `stats` 的三格（人/会话/收藏），没有安装量与使用量。
   * 显示一个 `-` 而不是编一个数：`-` 如实说「这里本该有数字、现在没有」，0 会被读成「装过 0 次」。
   */
  statUnavailable: '-',

  /* ══════════════ 口径 49（技能页主按钮：三项下拉 + 尺寸/形态对齐）══════════════ */

  /**
   * 下拉里「查找技能 / 创建技能」**预填进新会话输入框**的那两句提示词——逐字取自 WorkBuddy 实机
   * （`skills.find.examplePrompt` = 请帮我查找并自动安装能「……」的 skill，
   *   `skills.create.examplePrompt` = 请帮我创建一个可以实现「……」的 skill）。
   *
   * ★**为什么留「……」**：那是给员工补的空。WorkBuddy 原话就是这样，预填后由员工把「……」改成
   *   自己真正要的东西再按发送；我们**不**替他编一个具体内容（也**不**发送，见
   *   `preset-launch.ts` 的口径：只 `setDraft`，输入框里那句要用户自己按发送）。
   * ★**为什么放在文案表而不在 `esc-toolbar.tsx` 里拼**：这两句是**产品文案**，与页面其余每一句同源；
   *   拼在组件里就成了"代码里的字符串字面量"，与本仓"文案真源只有一处"的口径不符。
   */
  skillFindPrompt: '请帮我查找并自动安装能「……」的 skill',
  /** 见上一格（WorkBuddy `skills.create.examplePrompt` 逐字）。 */
  skillCreatePrompt: '请帮我创建一个可以实现「……」的 skill',
  /**
   * 预填通路**这次没走成**时，下拉里那两项的悬浮说明（可见原因，绝不画一枚点了没反应/静默失败的菜单项）。
   *
   * 与 `actionNotPorted` 分开是因为**下一步不同**：整条写入口缺席是"本页还没接上"，
   * 而这里是"接上了、但这次没把话填进去"——真实原因落在唯一提示组件 + 稳定码
   * `ENT_ESC_DRAFT_UNAVAILABLE` 上（人话 + 下一步 + 码，走 `error-messages.ts` 那张唯一码表）。
   */
  draftUnavailable: '暂时无法把这句话填进新会话',

  /* ══════════════ 口径 46/47（本机技能：本地导入 + 已安装页）══════════════ */

  /** 工具栏那枚「添加技能」**可用**时的悬浮说明（不可用时仍走上面那句 `actionNotPorted`）。 */
  addSkillLocalImport: '从本机选一个技能包导入（.dshskill）',
  /** 工具栏那枚「已安装」**可用**时的悬浮说明。 */
  installedFilterOpen: '查看本机已装的技能',
  /** 已安装页的标题（括号里是总数，形态与工具栏那枚一致）。 */
  installedTitle: '已安装技能',
  installedBack: '返回列表',
  /** 两个分组的组名。 */
  installedGroupSelf: '用户自定义',
  installedGroupCenter: '来自市场',
  /** 一装都没有时的空态（与平台列表空态那句话不同：这里说的**只是本机**）。 */
  installedEmpty: '本机还没有装任何技能',
  /** 某一个分组读不到时的前缀（后面紧跟稳定码）。 */
  installedGroupFailed: '这一组暂时读不到：',
  /** 某一个分组读得到、但那一组空着（另一组可能不是空的，故与整页空态分开说）。 */
  installedGroupEmpty: '这一组还没有技能',
  /**
   * 「用户自定义」那一组开关**置灰的原因**（口径 47 的如实缺口）。
   *
   * 本机自装包**没有**中心雪花 id，宿主侧也就**没有**对应的卸载路由（只有企业已装包有
   * `POST /skills/uninstall`）。故这一组的开关只能置灰 + 写明原因——绝不画一枚拨了没反应的控件。
   */
  selfInstalledLocked: '本机导入的技能包暂不支持在这里卸载',
  /** 「来自市场」那一组开关的悬浮说明（写清拨下去会发生什么）。 */
  centerUninstallTitle: '关闭即卸载这枚技能包',
} as const
