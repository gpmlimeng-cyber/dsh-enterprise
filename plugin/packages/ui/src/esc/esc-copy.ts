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
 *   ★**口径 51**：`ENTERPRISE_ESC_COPY` 新增两枚主按钮文案 `myExperts`（专家页，进子页）与
 *   `customConnector`（连接器页，WorkBuddy 那边开 MCP 弹窗、本刀不做故置灰）——`addSkill` 因此
 *   **收口成技能页专用**（三页三种文案，与 WorkBuddy 实机三页一一对应）；`ENTERPRISE_ESC_LOCAL_COPY`
 *   新增「我的专家」子页的整份 chrome 文案（返回/标题/两个 tab/搜索 placeholder/创建专家/两格分段）
 *   与两句**行上可见原因**（`customConnectorLocked` / `createExpertLocked`，产品宪法"禁用即须有可见说明"）。
 *   ★**用户裁决（读不到 ⇒ 0）**：`ENTERPRISE_ESC_LOCAL_COPY` 新增 `installedCountUnreadable`
 *   （「本机已装数量暂时读不到，先按 0 显示」）——它是**计数读不到专用**的一枚，与 `categoriesUnavailable`
 *   （分类读不到）彻底分开：计数位不再借分类那句词（那正是真机上"按钮指错原因"的根子）。
 *   ★**口径 55（本刀）**：`mainTabEnabled`（技能页那枚页签的文案）**整格删除** —— 它唯一用处就是那枚
 *     维度，维度删了这一格也就没有用处；留着就是"看着还能用"的第二真源（同口径 49 删旧 placeholder）。
 *   ★**口径 54（本刀）**：已安装族按**来源**改写——`installedGroup{Center,Self,Project,Bundled}`（组名即
 *     "谁放进去的"）+ `installedGroupOther`（未知来源 = 「其它来源（原样枚举）」）、`installedDiscovering`
 *     （「…还在发现中，这个数字还会变」，句子里**一个数字都没有**）、`installedMetaFailed` 与
 *     `installedMeta{Version,Digest}`（两份老记录降级后的元信息半句）；`selfInstalledLocked` 的措辞
 *     随判据改写（旧判据是"哪一组"、新判据是"有没有中心包 id"）。
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
  /**
   * 主 tab：系统广场 / 团队空间 / 已连接的。
   *
   * ★**口径 55（用户裁决）**：`mainTabEnabled` 这一格**整格删除**（用户原话是那枚页签的文案
   *   「删掉，他和已安装重复」）。这一格**唯一**的用处就是技能页那枚维度页签，页签删了它也就没有了
   *   用处 ⇒ 留在表里就是一个"看着还能用"的第二真源（与口径 49 删旧搜索占位符同一条纪律：
   *   被替换的那一格必须**整格不在**，而不是留一句注释说它不再生效）。
   *   ★机器判据落在**值**上（`'mainTabEnabled' in ENTERPRISE_ESC_COPY === false`，且
   *   `JSON.stringify(表)` 里不再出现那四个字）——注释里写沿革说明是允许的，那正是"保真记录"
   *   该在的地方；反向锁挡的是**表里还有这么一格**。
   *   ★连接器页那第三枚「已连接的」（`mainTabConnected`）不受影响，一字未动。
   */
  mainTabSystem: '系统广场',
  mainTabTeam: '团队空间',
  mainTabConnected: '已连接的',
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
  /**
   * 顶栏右块：**技能页**那枚主按钮的文案。
   *
   * ★**口径 51 收口**：它现在**只属于技能页**——workbuddy 三页里技能页那枚才是「添加技能」，
   *   专家页写「我的专家」（进子页）、连接器页写「自定义连接器」（开 MCP 弹窗）；后两枚的文案
   *   由下面 `myExperts` / `customConnector` 两格承担（口径 49 曾刻意暂缓改名，本刀补上）。
   */
  addSkill: '添加技能',
  /**
   * ★**口径 51**：**专家页**那枚主按钮的文案——逐字取自 WorkBuddy 实机
   *   （`unifiedMarket.myExperts`，研究文件 §3：点它是**进一个子页**，不是下拉、不是弹窗）。
   */
  myExperts: '我的专家',
  /**
   * ★**口径 51**：**连接器页**那枚主按钮的文案——WorkBuddy 实机那一枚开的是「MCP 服务管理」弹窗
   *   （研究文件 §3）。本刀**不做**那个弹窗，故文案改了、按钮同时置灰并**行上写明原因**
   *   （`ENTERPRISE_ESC_LOCAL_COPY.customConnectorLocked`）——绝不让一枚"说自定义连接器、
   *   点开却是选文件"的按钮继续说谎。
   */
  customConnector: '自定义连接器',
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
  /**
   * ★**口径 54**：已安装的两组**来源标注**（组名即"谁把这枚技能放进去的"）。
   *
   * 用户裁决把「已安装」的真源换成**官方发现面**（本机 DSH 真的装着什么）之后，
   * 分组不再按"我们哪份记录里有它"分，而按**官方给的 `source`** 分（再把"企业中心装下来的"
   * 那一类单独认出来 —— 它落盘在 `user-dsh` 根里，只有我们那份企业记录能说清它与众不同）。
   * 措辞里必须能读出**谁放进去的**，故这四枚都带主语：企业 / 本机 / 项目 / 官方。
   */
  installedGroupCenter: '企业装下来的',
  installedGroupSelf: '本机导入的',
  installedGroupProject: '项目里的',
  installedGroupBundled: '官方内置',
  /**
   * 未知来源（官方 `source` 是**开放取值域**，将来可能新增）的组名前缀。
   *
   * 组名 = `${installedGroupOther}（${原样 source}）`：宁可显示一个英文枚举，也不把它
   * 硬塞进上面四类里假装知道 —— 那时员工看到的"谁放进去的"就是一句**假话**。
   * 见 `enterpriseEscInstalledSourceLabel`（唯一取值口）。
   */
  installedGroupOther: '其它来源',
  /**
   * 某一条已发现技能**这条记录里的版本/摘要**那一行的前缀（元信息降级后的落点）。
   *
   * 老那两份记录不再作"是否已装"的判据，但它们仍是**真事实**：企业记录有 `versionId`，
   * 自装记录有 `sha256`。子页把这半句挂在卡片描述之后 —— 有就写、没有就不写（不编）。
   */
  installedMetaVersion: '版本',
  installedMetaDigest: '摘要',
  /**
   * ★**口径 54**：官方发现面说"还没发现完"（`complete === false`）时**必须说出来**的那一句。
   *
   * 两处落点：① 顶栏那枚「已安装(N)」的 `title`（数字位画的是**真的读到的那几个**，
   * 但那个数**还会变**）；② 已安装子页里一条可见的 `role="status"` 提示。
   * ★**不许当 0、不许写死数字**：句子里一个数字都没有 —— 数字由真源给。
   */
  installedDiscovering: '本机技能还在发现中，这个数字还会变',
  /** 一装都没有时的空态（与平台列表空态那句话不同：这里说的**只是本机**）。 */
  installedEmpty: '本机还没有装任何技能',
  /** 某一个分组读不到时的前缀（后面紧跟稳定码）。 */
  installedGroupFailed: '这一组暂时读不到：',
  /**
   * ★**口径 54**：两份**元信息**（企业已装记录 / 本机自装记录）读不到时的前缀。
   *
   * 列表本身**不受影响**（它来自官方发现面），读不到的是那半句版本/摘要与"能不能在这里卸载"的判据
   * —— 静默吞掉会让员工以为"这枚技能本来就不能卸"，故必须走唯一提示件说出来。
   */
  installedMetaFailed: '技能的版本与摘要暂时读不到',
  /** 某一个分组读得到、但那一组空着（另一组可能不是空的，故与整页空态分开说）。 */
  installedGroupEmpty: '这一组还没有技能',
  /**
   * 某一枚已发现技能的开关**置灰的原因**（口径 47/54 的如实缺口）。
   *
   * 卸载要的是**中心雪花包 id**，而它只在**企业那份记录**里（发现面给的是磁盘上的名字）；
   * 名字对不上企业记录 ⇒ 没有卸载路由可走。故那一枚开关只能置灰 + 写明原因
   * —— 绝不画一枚拨了没反应的控件。
   */
  selfInstalledLocked: '这一枚没有对应的企业技能包，暂不支持在这里卸载',
  /** 有企业包可卸时那枚开关的悬浮说明（写清拨下去会发生什么）。 */
  centerUninstallTitle: '关闭即卸载这枚技能包',
  /**
   * ★**用户裁决（读不到 ⇒ 0）**：顶栏「已安装(N)」那枚的计数**读不到**时，按钮的 `title`（＝无障碍名）。
   *
   * ★**它是"计数读不到"专用**：与 `categoriesUnavailable`（分类字典读不到）**分成两枚**。真机上那枚
   *   `？` 挂的正是「分类暂时读不到」，而**分类那一面本身是好的**（同一台机器上分类 chips 全在）——
   *   借那句话就是让按钮**指错原因**；两件事两个面，谁都不许再借谁的词。
   * ★句子里**先**说"读不到"、**再**说"按 0 显示"这两件事：数字位现在画 `(0)`（用户裁决：读不到与
   *   真 0 在按钮上**同形**），若 `title` 不说，这一趟读失败就被静默吞掉了（本仓硬纪律：不许静默）。
   * ★它**只服务于计数这一处**：已安装子页里某一组读不到有自己的交代（`installedGroupFailed`），
   *   别处也不许借这一句。
   */
  installedCountUnreadable: '本机已装数量暂时读不到，先按 0 显示',

  /* ══════════════ 口径 51（专家页「我的专家」子页 + 连接器页改名）══════════════ */

  /**
   * 「我的专家」子页的**页头**（返回 + 标题）——标题与主按钮文案同值但**不同格**：
   * 前者是子页的页标题、后者是入口按钮上的字，两件事各自演化（workbuddy 实机这两处也是两个键）。
   */
  myExpertsTitle: '我的专家',
  /** 子页左上角【返回】的可见文字（workbuddy 那一枚只有箭头；本仓子页一贯给文字，故逐字取「返回」）。 */
  myExpertsBack: '返回',
  /** 子页那两个 tab 的文案（workbuddy 实机是「专家 6 / 专家团 1」，本仓**不画计数**，见下）。 */
  myExpertsTabExpert: '专家',
  myExpertsTabTeam: '专家团',
  /**
   * 子页搜索框的 placeholder——逐字取自 WorkBuddy 实机（研究文件 §3）。
   *
   * 刻意与工具栏那三枚「搜索专家 / 搜索技能 / 搜索连接器」不同值：这一枚说的是"**我创建的**"，
   * 而工具栏那一枚说的是"全平台目录"——两处搜的根本不是同一件事，同值会让员工以为在搜广场。
   */
  myExpertsSearchPlaceholder: '搜索我创建的专家',
  /** 子页那枚主按钮的文案（workbuddy 实机是「+ 创建专家」，加号由图标承担、文字只这两字起）。 */
  myExpertsCreate: '创建专家',
  /** 子页那枚分段控件的两格（workbuddy 实机：我创建的 / 我购买的）。 */
  myExpertsSegmentOwned: '我创建的',
  myExpertsSegmentPurchased: '我购买的',
  /**
   * ★**产品宪法**（禁用控件不许只挂一句 `title`）：连接器页那枚按钮**行上可见**的原因。
   *
   * 写短句是因为它落在工具栏那一行里（与搜索框同排），长句会把一行撑成两行；
   * 完整的"发生了什么 + 下一步 + 稳定码"由 `EnterpriseErrorNotice` 在页面里承担
   * （本部署这条今天没有码可报——它压根不是一次失败的请求，而是"没有这个接口"，
   * 故这里如实写成部署事实，而不是造一枚假错误码）。
   */
  customConnectorLocked: '本部署还没有自定义连接器管理接口',
  /**
   * 连接器页那枚按钮**可用**时的悬浮说明（就是 WorkBuddy 那一枚的去向：MCP 服务管理）。
   *
   * ★今天走不到这一支（全仓没有任何调用方会传 `onCustomConnectors`），但它必须**与禁用那句不同**：
   * 一支说"点它会打开什么"、另一支说"为什么现在点不动"——两件事共用一个字符串，
   * 下一个接线的人就会在按钮可用的那一天看到一句"本部署还没有…"的鬼话。
   */
  customConnectorOpenTitle: '管理自定义连接器（MCP 服务）',
  /** 同一枚纪律，落在「我的专家」子页那枚「+ 创建专家」上（写入口不存在 ⇒ 置灰 + 行上写原因）。 */
  createExpertLocked: '本部署还没有创建专家的接口',
  /** ★**口径 51**：专家页那枚主按钮**可用**时的悬浮说明（不可用时仍走上面那句 `actionNotPorted`）。 */
  myExpertsOpenTitle: '查看我创建的专家与专家团',
} as const
