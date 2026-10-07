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
  /** 搜索框占位与「更多」。 */
  searchPlaceholder: '搜索名称或描述...',
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
} as const

/** 文案键类型（`ENTERPRISE_ESC_COPY` 的键）。 */
export type EnterpriseEscCopyKey = keyof typeof ENTERPRISE_ESC_COPY

/**
 * DSH 这一侧**新增**的文案（NUWAX 原页面没有对应句子，故不放在上面那份逐字复制表里）。
 *
 * 每一句都对应一处**如实缺口**或一处 DSH 体系差异，写明原因而不是留白：
 *  · `signInRequired*`：原页面的数据来自 NUWAX 平台会话，DSH 侧要先登录员工 NUWAX 账号；
 *  · `loadFailed`：原页面读不到数据时静默画空态；本刀改为**说出来**（仓库的 no-silent-swallow 门禁也要求如此）；
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
  loadFailed: '加载失败',
  /** 分类字典读不到时的那句提示（列表本身仍可看，只是筛选少了）。 */
  categoriesUnavailable: '分类暂时读不到',
  actionNotPorted: '该动作尚未在 DSH 侧接入',
  moreExternal: '在 skillhub.cn 打开技能广场',
  retry: '重试',
} as const
