/**
 * [INPUT]: 依赖 React（useEffect/useMemo/useState/useSyncExternalStore）、lucide-react 图标（技能行 Sparkles + 插件行 Package + 组件行三枚 + **配方行与配方详情的 BookMarked** + 详情面包屑的 ChevronDown / 文件树的 Folder 与 FileText / **在途安装那枚取消按钮的 X**）、官方 ui-primitives 的 Button/Switch/Tag/StateDot（pinned 0.1.5-rc.2 的 .d.ts 已导出，不走 official-ui 收窄接缝；**该 pin 不含 `SegmentedTabs`**，故页签条照 `account-view.tsx` 既有 tablist 手写自绘）、display-format 的 `formatByteSize`（文件大小唯一口径：行内字节提示与预览体积提示都取它）、account-state 的 `enterpriseSessionUsable` 与 account-store 的 `EnterpriseAccountStore`（订阅只发生在控制器 `useEnterpriseMarketController` 里）、local-api-decode 的技能 DTO（`EnterpriseRuntimeSkill` 目录 + 已装记录 `EnterpriseInstalledSkill`——「已装」只认后者这一份 Host 真值；**文件树条目 `EnterpriseSkillFileEntry` 与树里单个文本文件 `EnterpriseInstalledSkillFile`**——详情子页面左树右预览的两种输入）与失败码唯一投影 `enterpriseLocalErrorCode`（行内与详情里的错误码来源，与「技能」tab 同源）、**配方侧的两件复用件（均取自 `preset-market.tsx`，不新造第二份）**：配方目录取数源工厂 `createEnterprisePresetListSource`（「企业设置 → 配方」tab 用的同一个）与导入指令构造器 `buildPresetImportInstruction`（同一句指令，本页只复制不上屏）、消费官方 `plugins.item` owner props（`view`/`form`）；中心当前版本只从**详情投影** `store.api.skillDetail(id)` 取（列表投影的 `versionId` 恒为空串），且只对已装行取——未装行没有本机版本可比，不白跑请求、error-notice 的员工侧统一失败提示 `EnterpriseErrorNotice`（人话 + 下一步动作 + 收进「技术信息」的稳定码，样式走行内 `--dsw-*` token，跨页复用不新增可覆盖类）与 error-messages 的唯一一份码 → 人话映射
 * [REF]: **目录行的逐段真源是 `9723a97:plugin/packages/ui/src/marketplace-entry.tsx`**（技能行 = 官方两行卡片：第 1 行标题 `.own-market-cardId` + 版本签 + 分类签，第 2 行描述 `.own-market-cardDesc`，右侧 `[有更新] [Switch]`；插件行 = 图标 + 两行文案 + 状态点 + 官方状态词 + `Switch`；三个页签；组件节折叠），**不从记忆重写**；**详情子页面的框架真源是官方 `@deepseek-ai/dsh-client-ui-plugin-manager` 的 `ItemDetail`/`DetailTop` 与它那份 CSS module**（本机 node_modules 的 `lib/client.js`：`_detail`/`_detailTop`/`_crumb`+`_crumbIcon`/`_detailHead`+`_cardIcon`/`_detailMain`/`_detailTitle`/`_detailName`/`_detailDesc`/`_detailSections`/`_detailSection`/`_sectionHead`/`_sectionTitle`/`_sectionCount`），取值逐条抄进 `detailStyles` 的注释对照表；行版式统一那一刀留下的共享行子块 `EnterpriseMarketInlineRows` 与 `.own-market-storeTabs` 类名照旧。
 * [OUTPUT]: **一棵目录页外壳 + 一份逻辑 + 一个技能详情子页面**。**本刀（详情子页面 + 文件树）**：技能行**行本体**（图标 + 两行文案）是一枚真 `<button class="own-market-rowOpen">`——点它把面板**整页切到**详情子页面（`EnterpriseMarketLegacyShell` 按 `props.skillPage` 走两个 return 分支：详情那一支里列表 / 页签条 / 节容器**一字不挂载**）；`[有更新]` 与官方 `Switch` 是它在 `.own-market-rowLine` 里的**同级兄弟**（不在按钮内，故点动作既不用冒泡也不被藏起来），两者由**唯一一枚子块** `EnterpriseMarketSkillRowActions` 渲染（行上与详情里渲染的是同一枚子块、同一份 `facts`、同一个 `onToggleSkill`）。详情子页面是纯函数 `EnterpriseSkillDetailPage`（无 hook、可直接函数调用测试）：**面包屑「返回技能列表」**（`aria-label` 给完整动作语义，点它就是 `onBack` 回列表）+ `h3` 标题 + 版本徽标（官方 `Tag`）+ **等宽标识行**（`skillId`）+ 描述 + 分区 `detailSections` → `detailSection`（文件区：**左文件树 + 右文件预览**）。纯投影 `enterpriseSkillTreeRows`/`enterpriseSkillDefaultFilePath`/`enterpriseSkillFileCountText`/`enterpriseSkillTreeState`/`enterpriseSkillPreviewState` 与文案常量 `ENTERPRISE_SKILL_TREE_*`/`ENTERPRISE_SKILL_PREVIEW_*`/`ENTERPRISE_SKILL_DETAIL_{BACK_TEXT,BACK_LABEL,FILES_TITLE,RETRY}`/`ENTERPRISE_SKILL_CONTENT_FILENAME` 都在出口上；控制器新增详情目标 id 与四组文件状态（树条目 / 在途 / 错误、选中路径、预览正文 / 在途 / 错误）加两个取数 effect（**只在「详情打开 + 该包已装 + 有 store」时发请求**，未装一条都不发；取到树后默认选中并预览 `SKILL.md`；关详情 / 换包即 abort 且迟到结果不回填），并把 `skillPage` 塞进同一份 props。 以下为既有能力：**一份外壳 + 一份逻辑**。共享逻辑只有一处：控制器 hook `useEnterpriseMarketController`（store 订阅与取数、已装真值、安装/卸载动作、失败码归行、页签选中态、行开合态）、模型投影 `enterpriseMarketShellModel(props)`（组件清单行、目录门控、页签文案与计数、折叠态）与行级 facts `enterpriseMarketSkillRowFacts`/`enterpriseMarketPluginRowFacts`（受管态、开关口径、更新判定、两枚签取值、行键与开合、插件开关禁用口径）。目录行由共享子块 `EnterpriseMarketInlineRows` 铺出（技能行 = 图标 + 两行文案 + `[有更新]` + `Switch` + 失败提示；插件行 = 图标 + 两行文案 + 状态点与官方状态词 + `Switch` + 失败提示）。唯一入口 `EnterpriseMarketLegacyPage` 注册到官方 `plugins.item`，经宿主 `EnterpriseMarketShellHost` 接同一份控制器、同一棵外壳与同一个登录弹窗。其余出口：页签真源（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_DEFAULT_TAB`/`ENTERPRISE_MARKET_TAB_IDS`/`ENTERPRISE_MARKET_TABLIST_LABEL`/`enterpriseMarketTabLabel`）；组件清单与计数摘要投影（`ENTERPRISE_MARKET_COMPONENTS`/`ENTERPRISE_MARKET_PLAN`/`enterpriseMarketComponent` 六件投影）；行投影（`enterpriseMarketPluginRows`/`enterpriseMarketPluginSectionVisible`/`enterpriseMarketSkillRows`/`enterpriseMarketSkillSectionVisible`）；技能行标签与状态投影（`enterpriseMarketSkillVersionTag`/`enterpriseMarketSkillVersionLabel`/`enterpriseMarketSkillCategoryTag`/`enterpriseMarketSkillHasUpdate`/`enterpriseMarketSkillRowHasUpdate`/`enterpriseMarketSkillUpdateTag`/`ENTERPRISE_MARKET_SKILL_UPDATE_LABEL`/`ENTERPRISE_MARKET_SKILL_UPDATE_TAG`/`enterpriseMarketSkillState`/`enterpriseMarketSkillDot`/`enterpriseMarketSkillConfigTag`/`enterpriseMarketSkillStatusLabel`）；插件行状态投影（`enterprisePluginDot`/`enterpriseMarketPluginConfigTag`/`enterpriseMarketPluginStatusLabel`）；行键与开合投影（`enterpriseMarketRowKey`/`enterpriseMarketRowDetailsId`/`enterpriseMarketRowOpen`）；折叠真源（`ENTERPRISE_MARKET_DEFAULT_EXPANDED`/`enterpriseMarketSectionOpen`/`EnterpriseMarketSectionId`/`ENTERPRISE_MARKET_SECTION_IDS`）；失败可见反馈（`EnterpriseMarketActionError`/`enterpriseMarketActionErrorLabel`/`EnterpriseMarketRowError`）；badge 槽（`EnterpriseMarketBadge`/`BadgeView`/`enterpriseMarketVersionTag`）；注册常量 `ENTERPRISE_MARKET_ENTRY_ID`/`ENTERPRISE_MARKET_ENTRY_LABEL`/`ENTERPRISE_MARKET_ENTRY_ORDER`。卡片摘要与详情页正文**不重复同一句**——摘要只在 `summary` 视图出现（官方必渲染的那一份，`EnterpriseMarketSummaryLine`）。 **本刀（版本签只显示版本）**：技能行标题行的版本签**可见文案改成短号**——新增纯投影 `enterpriseMarketSkillVersionLabel`（含 `@` 取**最后一个** `@` 之后那段、不含 `@` 原样返回；空串/仅 `@`/尾部 `@` 一律 undefined = 不出签），行 facts 因此多一枚 `versionLabel`（原 `versionTag` 保留为**完整来源坐标**）；完整坐标挂在签外包装节点 `.own-market-skillVersionHint` 的 `title` 上（官方 `Tag` 的 .d.ts 只声明 tone/className/children、运行期也丢弃多给属性，故用一枚透明包装节点挂悬浮说明），详情页那枚徽标照旧显示**完整坐标**（信息更全）；签自身的类名（`.own-market-tag`/`.own-market-skillVersionTag`）/tone/位置（标题行、紧随标题、在分类签之前）一字未动，分类签与行上其余任何东西（动作区、状态点、开关、失败提示）一律不碰。 **本刀（失败文案降维 + 术语清扫）**：① **失败自愈**——五条员工可见失败路径（技能行装/卸、插件行装/卸、详情里的动作失败、文件树读取失败、文件正文读取失败）全部改渲染共享的 `EnterpriseErrorNotice`：一句人话（消息取 `error-messages.ts` 的唯一映射）+「下一步：…」+ `<details>`「技术信息」里原样保留稳定码（`data-enterprise-error-code`，支持排障照旧取得到）；行内提示的外层类名仍是 `.own-market-inlineError`（形制不变），`role="alert"` 不变，失败**不**禁用开关（再拨一次即重试）的口径不变。② **术语降维**——第三枚页签与它的节标题由「组件/包含的组件」改成「包含内容」，三行开关的无障碍名由 `启用组件 X` 改成 `启用X`、预留说明改成「预留：X暂未接入」；组件行里那条内部模块路径（`dsh-preset / .dshpreset` 等，含 preset 字样）**不再上屏**（数据仍留在 `ENTERPRISE_MARKET_COMPONENTS`，由反向锁用例守着它不上树，`.own-market-rowModule` 死样式一并删除）；详情页的版本徽标前补人话标签「来源」（`ENTERPRISE_SKILL_DETAIL_SOURCE_LABEL`，悬浮说明给出「来源站 / 发布方 @ 版本号」），等宽 `skillId` 行前补「标识」标签与悬浮说明（`ENTERPRISE_SKILL_DETAIL_NAME_LABEL` / `_NAME_TITLE`）；上游技能名里带技术缩写（MCP / YAML / manifest / Manifest / SKILL.md）时，旁边补一句「名称由技能发布方提供…」的人话（`enterpriseSkillUpstreamNameNote` 纯投影，名称与描述一律不改写，未命中不加噪音）。 **本刀（静默吞失败 → 显式失败态 + 可重试）**：新增唯一取数源工厂 `createEnterpriseSkillCatalogSource` 与唯一加载器 `loadEnterpriseSkillCatalog`（目录是主事实、失败原样抛；已装清单与逐行详情是次级事实、失败经 `enterpriseDegradedRead` 交出失败码）、四态投影 `enterpriseMarketPanelState` 与文案常量 `ENTERPRISE_MARKET_{SKILLS,PLUGINS}_{LOADING,EMPTY,FAILED}`、共享三态落点 `EnterpriseMarketListHint` 与次级降级交代 `EnterpriseMarketDegradedNotice`；控制器改为 `useSyncExternalStore` 订阅取数源（`skillsListState` + `onRetrySkills`），插件目录由 store 快照投影成 `pluginsListState` + `onRetryPlugins`——两个目录页签的加载/空/失败三态由此显式化，失败与空不再混同（失败 = 唯一提示组件 + 真重发）。 **本刀（资料库入口）**：组件清单新增第四行「资料库」——它是**可开关的功能**而不是预留件，`gate:'local'` 标明那枚 Switch 归**本机设置**（`library-gate` 的唯一真源，默认关）而不归企业会话，故开关可拨性、状态词（新增「未开启」）、悬浮说明（`enterpriseMarketComponentSwitchTitle`）与失败重试都在同一份投影里算；拨动走 `onToggleLibrary`（立刻生效、写失败在那一行渲染唯一提示组件 + **真的重发**的重试），`EnterpriseMarketShellProps`/控制器/host 因此新增 `libraryGate`/`onToggleLibrary`/`onRetryLibrarySave` 三件输入。 **本刀（企业配方页签）**：页签真源由三枚改**四枚**——「企业技能 / 企业插件 / **企业配方** / 包含内容」，`EnterpriseMarketTabId` 与 `ENTERPRISE_MARKET_TAB_IDS` 同步加 `presets`（`market-tab-presets`/`market-panel-presets`），`EnterpriseMarketDirectoryTabId`（有行列表的页签）也含它；组件清单里「配方」那一行由 `reserved:true` 改为 `reserved:false`（交付已落地，`包含内容` 页签不再说「预留」，门控随之变成与技能/插件同一条会话口径），`EnterpriseMarketPlan` 是历史规划元数据、不动。配方**行数据**取自既有取数源 `createEnterprisePresetListSource`（与「企业设置 → 配方」tab 同一个工厂，经 `store.api` 发出，**不新造宿主路由、不碰 local-api**），经唯一行投影 `enterpriseMarketPresetRows` 成行、由**同一枚共享行子块** `EnterpriseMarketInlineRows` 的 `presets` 分支渲染（图标 + 两行文案 + 版本短号签 + 可选分类签 + 动作区），行 facts 唯一入口 `enterpriseMarketPresetRowFacts`；动作区**不给假开关**——配方今天没有安装链路，只给本机真能用的那一条「复制导入指令」（沿用 `buildPresetImportInstruction`，指令正文不上屏、复制后按钮文案变「已复制」，`EnterpriseMarketPresetRowActions` 一枚子块同时供行与详情）。配方**详情**沿用技能详情的子页面形态（`presetPage` 非空即整页切换：面包屑「返回配方列表」+ `BookMarked` 图标 + 与行同一枚动作子块 + `h3` 标题/来源徽标/标识行/描述 + 分区「这份配方包含」），点**行标题**（行本体那枚 `<button>`）进详情；包含内容由纯投影族 `enterprisePresetDependencies` → `enterprisePresetContentsGroups` → `enterprisePresetContentsState` 算，按 `kind` 归成「技能 / 插件 / 其它」三组（未知 kind 不被静默丢掉）、每条显示 `id` 与「必需 / 可选」，`dependencies` **字段缺席或形状不对**时如实说「暂时无法读取包含内容」（详情取数失败另给唯一提示组件 + **真的重发**的重试），绝不白屏也绝不编造包含内容。四枚页签的计数、三态（加载/空/失败）与重试与技能/插件页签同规则：新增文案常量 `ENTERPRISE_MARKET_PRESET_*`（加载/空/失败**直接复用** `preset-market.tsx` 的那三句，不各写一套）。 **本刀（配方一键启用：真开关 + 自造授权弹层 + 三级降级链）**：配方行动作区由「复制导入指令」换成与技能/插件行**同款**的官方 `Switch` 并接上三条本机子路径——三态由纯投影 `enterprisePresetSwitchState` 算（`EnterpriseMarketPresetRowState` 按行 id 持有 `status`/`loading`/两条失败码），`EnterpriseMarketPresetRowFacts` 新增 `state`/`stateLabel`/`enabled`/`busy`/`switchDisabled`/`switchTitle`/`fallback`/`needsApproval`；**自造授权弹层** `EnterprisePresetApprovalDialog`（纯函数、`role="dialog"` 覆盖层）逐项列出 `disclosure.bundles`/`disclosure.mounts`、免责声明与官方原型逐字同句、一次授权绑当前 `fingerprint`（确认时经 `enablePreset(id, confirmFingerprint)` 回传）、指纹已变时如实说「内容变了，需要重新确认」；**三级降级链**由 `enterprisePresetFallbackPlan`（① 一键启用 → ② 新会话 + 填入指令 → ③ 复制到剪贴板）唯一决策、`enterprisePresetRouteUnsupported` 只把「路由没接线 / 本机没有落点」与不可重试的终态失败算成结构性不可用（两枚授权码除外），每一级都渲染 `EnterpriseMarketPresetFallbackNote` 那一句可见说明（不静默降级），第二级的接线（`preset-launch.ts`）经 `onOpenPresetInNewSession` 注入、缺席即如实降到第三级；新增 `EnterpriseMarketPresetRowActions` 的 `onToggle`/`onOpenInNewSession`/`onCopy` 三输入、`EnterprisePresetDetailPage` 的 `onTogglePreset`/`onOpenInNewSession`/`actionErrorCode` 与宿主里的授权弹层挂载点。 **本刀（收尾：启用成功的落地交代）**：`restart-required`/`needsNewSession` 原先只解码不上屏，现补成可见事实——`EnterpriseMarketPresetRowState.applied` 持有成功回执（`EnterprisePresetAppliedReceipt`：`application`/`officialApplication?`/`needsNewSession`/`alreadyInstalled?`），纯投影 `enterprisePresetAppliedNotice` 出三句常量之一（`ENTERPRISE_PRESET_APPLIED_{HOT,RESTART,OTHER}_TEXT`，三句都含「将在新会话生效」；另加 `ENTERPRISE_PRESET_APPLIED_EXISTING_TEXT` 交代「本次没有重复安装」），由 `EnterpriseMarketPresetAppliedNote` 以 `role="status"` 渲染在行下与详情里（同一份 facts、没有回执就整段不进 DOM），下一次动作开始时清掉。 **本刀（企业插件行的死开关改造）**：插件行原先「开关禁用 + 只挂一句 title」，是产品宪法禁止的死控件，本刀把它换成**可见原因 + 能走的动作**——① 插件行的禁用口径收敛到新叶 `plugin-install-gate.ts` 的唯一判定 `enterprisePluginLockReason`（写入口在不在 / 目录判定 / 在途），行 facts 因此新增 `lockReason`/`lockNotice`/`switchTitle` 三枚（`switchDisabled` 恒等于 `lockReason !== undefined`，不再各写一串 `||`）；② `EnterpriseMarketPluginRow` 由 `enterpriseMarketPluginRows` 从目录带上 `operatingSystems`——**数据面字段保留、但不再参与任何判断**（平台彻底退出决策面，行上与详情里一个字都不提系统），`enterpriseMarketPluginRowFacts` 因此回到两参（只有目录判定 / 写入口 / 在途三件现场）；③ `installErrorCode` 不再只进 title：行上渲染唯一提示组件（人话 +「下一步：」+ 技术信息里的码），该码 retryable 且 `onRetryPlugins` 在时另给一枚真重发的「重试」（终态码不给假重试）；④ 新增共享子块 `EnterprisePluginRowNotes`（行落点复用既有 `.own-market-rowNote`，**一个新 CSS 类都没加**，故 LEGACY_SHELL_OUTLINE / style 长度 / 校验和一字未动）与常量 `ENTERPRISE_PLUGIN_BLOCKED_RETRY_LABEL`。 **本刀（企业标签，走官方座位）**：①**详情页徽章**——官方 `plugins.detail.badge` 座位（`kind:'list'`/`scope:'root'`，声明 `@deepseek-ai/dsh-client-ui-plugin-manager` 的 `lib/types/client/slot-contract.d.ts:131`、运行时清单 `lib/client.js:3510`、渲染点 `lib/client.js:2138` 的 `renderSlot("plugins.detail.badge", { subject })`（就在 `ItemDetail` 的 `titleRow` 里 `h3` 之后）；**我们这行卡片确实走 `ItemDetail`**：`lib/client.js:3177` 把每个 `plugins.item` 条目渲染成 `ItemCard`、点开设 `{kind:'item',id}`，`:3333` 据此渲染 `ItemDetail`）里，`BadgeView` 在 `h3` 正后方先出一枚**「企业」徽章**、再接原「版本号 + 包名」。徽章与描述行胶囊**共用唯一一枚** `EnterpriseMarketBadgeTag`（新增出口）：官方 `Tag` 原语 + `tone="info"`（与官方「实验性」签同款 tone）+ 本文件既有定位类 `.own-market-tag`（只含 `flex:none`/`tabular-nums`，不碰颜色与尺寸）。②**描述行**——`ENTERPRISE_MARKET_SUMMARY` 由 `'企业插件 · 技能 · 配方'` 改成 `'技能 · 配方'`（句首四字改由「企业」徽章承载，描述行不再出现「企业插件」），新增常量 `ENTERPRISE_MARKET_BADGE_TEXT='企业'`，`EnterpriseMarketSummaryLine` 渲染成「[企业] 技能 · 配方」（官方把 `summary` 渲染两次：列表卡描述 + 详情页正文）。**样式：一个新 CSS 类都没加、CSS 一字未改**（`baseStyles`/`rowStyles`/`detailStyles` 三份字符串逐字节不变，`<style>` 长度 10507 与 FNV-1a 校验和 3008014743 不变）。**测试数字：本文件 +2 条（详情徽章/描述行 + 不新增 CSS 类的反向锁），ui 包 423 → 425 条，一条未删。** **本刀（企业标签移回标题行）**：按用户两次裁决**回退描述行并改掉实现路径**——① `ENTERPRISE_MARKET_SUMMARY` 由 `'技能 · 配方'` **恢复**为 `'企业插件 · 技能 · 配方'`，`EnterpriseMarketSummaryLine` 不再渲染胶囊（描述行整行回到纯文本，一个 `Tag` 元素都不出）；② 列表卡标题行那一枚「企业」签改走 **DOM 装饰**（新叶 `market-entry-badge.ts`，官方 `ItemCard` 的 `CardHead` 只有 `[标题按钮, tags]` 两个子位、`tags` 恒空，API 层次插不进去）：官方渲染完成后克隆官方 Tag 实物（首选「实验性」签，连它的哈希 `statusTag` 类一起）插到标题按钮**正后方**，文本换成「企业」；③ 详情页 `BadgeView` 的企业徽章**原样保留**（`plugins.detail.badge`，仍用 `EnterpriseMarketBadgeTag`）。 **本刀（企业插件安装的动态过程效果）**：插件行新增「安装中」那一条**真进度**——行 facts 多两枚 `progress`（`plugin-install-progress.ts` 的唯一投影：真阶段文字 + 恒不确定态 + 恒不可取消）与 `settledNotice`（动作收束时的真实受管态翻成的可见交代），由 `EnterprisePluginProgressNotes` / `EnterprisePluginSettledNote` 落在行下；进度可用 `role="progressbar"`（**不占** `role="status"|"alert"`）故既有「禁用即须有可见说明」反向锁的计数不受影响；新增 `EnterpriseMarketShellProps.pluginBusy` / `pluginSettled` / `pluginProgressErrorCode` 三件输入（控制器直接透传同一份 store 快照）；CSS 增 `own-market-progress*` 一族与 `@media (prefers-reduced-motion:reduce)`（样式校验和按动画**再基线化**，锁的形态不变）。 **本刀（企业插件真取消）**：那一条真进度多一枚**真取消按钮**（官方 `Button` 原语 + Lucide `X`，**一个新 CSS 类都没加**、CSS 一字未动）——只在 `progress.cancelable`（官方取消句柄真实存在的那个受管态 `INSTALLING`）**且** `onCancelPlugin` 在场时才画，点它经控制器调 store 的 `cancelPlugin`（同源 `POST /plugins/cancel`，正文关闭键集 `{packageName}`）；取消请求在途时按钮保持可见但 `disabled`、文案改「正在取消…」，同一落点的进行态交代以 `role="status"` 播报（**不是**死控件）；不能取消时**不画**按钮、改画 `progress.cancelNotice` 那句可见原因；`EnterpriseMarketShellProps` 因此多 `pluginCancelBusy`/`onCancelPlugin` 两件输入（控制器直接透传同一份 store 快照）。取消的**收束**也接在既有那一枚行内提示上：控制器把「这一行刚发起了取消」记进 `pluginAction`（`action: 'cancel'`，归行簿记），于是那次安装请求以 `ENT_PLUGIN_INSTALL_CANCELLED` 收束时，`EnterpriseMarketRowError` 照旧渲染「人话 + 下一步 + 技术信息里的码」——`enterpriseMarketActionErrorLabel('cancel')` 返回 `undefined`，故**不挂**「安装失败」那种前缀（取消不是失败，挂上去自相矛盾）。
 * **本刀（Codex 插件商店口径的目录卡片重构：分组两列网格 + 搜索/七类筛选 + 行动作不再用开关）**：
 *   ① 页签条 = 胶囊分段（灰轨 + 白底选中），标签行 = 页签在左、搜索框 + 漏斗筛选在右，搜索**真过滤**、
 *      筛选两组（状态 + 七类），「筛没了」与「目录为空 / 取数失败」三件事各有各的一句、互不混同；
 *   ② 列表 = 七类分组（组标题 + 它自己的 border-bottom 当分割线，行间再无分割线）+ 两列 grid（窄屏单列）；
 *      卡片 = 两行（`.own-market-cardId` 标题 / `.own-market-cardDesc` 描述），**标题行零签**
 *      （企业签/版本签/分类签一律撤下卡片；版本改到详情子页面看）；
 *   ③ **行动作区不再用开关**（用户口径「卡片操作按钮不要开关」）：未装 ⇒ 官方「安装」按钮那一格
 *      （`data-enterprise-{skill,plugin}-slot=install`）；已装 ⇒ 「⋯」子块（`EnterpriseMarketRowMenu`，
 *      按真实能力给项：技能 = 更新/卸载、插件 = 更新/启用·停用/卸载（卸载只给非内置项）、配方 = 停用），
 *      没有下拉宿主（详情子页面）时同一枚子块自动改成**平铺**（`.own-market-moreInline`）；
 *      技能/插件/配方三处动作**共用同一枚子块与同一份 facts**，故「行上与详情里同源」仍是结构性的；
 *   ④ 「有更新」不再是一枚独立标签，而是「⋯」里的第一项（破坏性动作永远在最后）；在途时两枚都禁用，
 *      而**失败不禁用**（再点一次就是重试）；禁用原因与可见说明仍全部来自 gate 叶的唯一判定；
 *   ⑤ 样式：新增 `own-market-categoryGroup · categoryTitle · more · query · filter · panel[hidden]` 一族，
 *      与 `plugin-market.tsx` 那份 `<style>` 的类名**零交集**（两处都是全局单类选择器）。
 *   ⑥ **本刀（版式照用户发的两张商店图再对齐一次）**：用户给的参考图（Xiaomi MiMo / Codex 商店）与我们旧取值
 *      逐项对完，按「无边框 + 大留白 + 强层级」重取：搜索框从页签行里**挪出来独立成行**（`.own-market-searchRow`
 *      = 40px 高的整行大搜索框 + 右端漏斗，照参考图的位置关系），页签条只留胶囊组；
 *      网格行距 4px → **28px**、列距 20px → 24px；卡片标题 14/500/20px → **15px/600/1.4**；
 *      描述改 `label-secondary` + `line-height:1.55`；图标去掉细描边、改 `background-secondary` + 10px 圆角
 *      （参考图是彩色品牌图，我们没有品牌资产，故用柔和底色块去掉「占位感」）；
 *      组标题 15px → **17px**、组间距 20px → 40px；卡片圆角 8px → 12px。
 *      **不采用的**：官方 DSH 插件管理器那套「`.5px` 描边 + `radius-xl` + 卡片底色」（`.FfBBxq_card`）——
 *      用户裁决是照参考图的无边框风格，故刻意不抄那一套；按钮形状仍用官方原语（胶囊 `radius:18px`）。
 *   ⑦ **本刀（四页签搬到标题右侧 + 用户四条 UI 收口）**：
 *      ① 页签渲染位置由**座位是否注入**决定——`client.tsx` 在 `apply` 里建一份
 *      `createEnterpriseMarketTabSeat()`，经 `plugins.item` 的 inject 交给页面（宿主在 `useEffect` 里
 *      **恒发布** tabEntries/activeTab/onSelect；`publish` 按签名比较，没变不通知，防自激重渲染），
 *      经 `plugins.detail.actions` 的 inject 交给订阅包装 `EnterpriseMarketDetailActionsLive`；
 *      宿主据此传 `tabsInTitle` ⇒ 页面那层不再画页签、标题行那一格画（页签左 `margin-right:auto`、
 *      两枚按钮右 `margin-left:auto`，用户裁决 A）。**两处绝不并存**：任何时刻全页只有一个 `tablist`；
 *      座位缺席（纯函数直调 / 未接线）时页签留在页面里，外壳仍自包含。
 *      详情子页面**也照常发布**（既有契约「进详情时页头与四枚页签保持可见、一字不改」）。
 *      ② 卡片 hover **只变背景**：删掉把标题/描述染主色的那条规则（反锁守着，谁加回来先红）。
 *      ③ 「安装 / 启用」按钮 = 官方同枚填充 token 的**纯色底 + 无 hover**（`.own-market-installBtn`
 *      同名双类抬特异性压掉官方 hover，**不用 !important、不动官方样式表**）。
 *      ④ 卡片标题/描述取值照官方 `_cardName`/`_cardDesc`（15px/600/1.4 + `label-primary`、
 *      13px/1.55 + `label-secondary`），并删掉「已停用把标题压成次级灰」这条本地偏离。
 *      ⑤ 标题行**不再显示包名**（`BadgeView` 里那行 `<code data-plugin-name>` 撤掉，由反锁守着）。
 *   本节所述为准；上面各「本刀」段落里凡是写「官方 `Switch` 是行主控件」「卡片标题行挂企业签/版本签」
 *   「本页没有任何卸载动作」的句子，均已被这一刀取代。
 * [POS]: ui 的企业市场入口（**唯一入口：官方插件页「官方」分组里的「插件市场」卡片**）。**本刀（详情子页面）**：技能行本体可点 → 面板整页切到该技能的详情子页面；**面板就是官方 `plugins.item` 的 page 视图、没有真实路由，故用一份视图状态切换（`skillDetailId` → `skillPage`），不硬造路由**。「返回技能列表」是唯一返回入口（面包屑按钮，键盘可达）。详情里的动作与行上**同源**：同一枚 `EnterpriseMarketSkillRowActions`、同一份 `enterpriseMarketSkillRowFacts`、同一个 `onToggleSkill` 回调、同一份 `skillActionError`，因此不存在第二套状态或第二个动作实现。文件树与预览只消费 Host 已有的两条只读子路由（`/enterprise/api/v1/local/skills/<id>/files` 与 `.../<id>/file?path=`，经 `store.api.skillFiles`/`store.api.skillFile` 发出）；**未安装就一条请求都不发**、如实说「安装后可浏览文件」，绝不伪造树；默认选中并预览 `SKILL.md`；预览是 `<pre>` 里的**纯文本子节点**（全文件无 `dangerouslySetInnerHTML`），长文件靠 `max-height` 滚动 + 字节提示；读取失败给 `role="alert"` + 稳定错误码 + 重试。**只读正文路由 `/skills/content` 按用户要求保留**（Host 侧注册与既有单测不动），本页统一走文件路由那一份路径实现。 以下为既有能力：企业插件行与组件行**不给**详情入口（用户只要求技能行；插件行本轮一字未动，组件行是交付排期清单）。**目录行的落点与行为**：点行本体进详情；`[有更新]`（真实 `<button>`，点击 = 更新到中心当前版本）与安装/卸载 `Switch` **常显在行上**且不触发详情；失败给 `role="alert"` + 稳定错误码且**不禁用**开关（再拨一次就是重试）。**三页签**（企业技能默认 / 企业插件 / 组件）共用 `EnterpriseMarketTabStrip` 一份实现：手写 `role="tablist"` + roving `tabIndex` + ←/→/Home/End 走焦并选中，`id`/`aria-controls`/`aria-labelledby` 三处同源；组件节是唯一还保留折叠语义的一节（折叠态列表整段不进 DOM）。**严禁**任何价格/交易/购买/购物车/客服之类的商业化字样——全树文本都不出现（由测试反向锁死）。`store` 与开登录回调均为可选注入：缺席时开关恒禁用、会话不可用时目录节不出现。**样式纪律**：本文件的类名与同包其他源文件**零交集**（两处 `<style>` 都是全局单类选择器，同名会互相覆盖）；主题只用 `--dsw-*` token，不新造颜色。 **本刀（版本签短号）**：真实 `sourceDshVersion` 是完整坐标（`skillhub.cn/dev-expert@2.0.3`），整串会把标题挤成一个字（真机截图已证）；故**列表里只显示版本号**（`enterpriseMarketSkillVersionLabel`，最后一个 `@` 之后），**完整坐标在签的 `title` 与详情徽标**；既有技能（无 `@` 的 `0.1.7-rc.2` 形态）显示形式一字不变，签的类名/tone/位置与行上其他东西不动。 **本刀（企业配方页签）**：配方行与配方详情用的是**同一批**类名（`.own-market-row*`/`.own-market-cardHead`/`.own-market-cardId`/`.own-market-cardDesc`/`.own-market-detail*`/`.own-market-skillTag`），**一个新类名都不加**——版式取值与技能/插件行逐值同源，故本刀 CSS 一字未动（`baseStyles`/`rowStyles`/`detailStyles` 三份字符串与改动前逐字节相同）。 **本刀**：三级降级链的调度与事实全在共享控制器一处（逐行读 `status`、真开关的 enable/disable、授权弹层的确认与取消），行上与详情里读的是同一份 facts、同一批回调；弹层不新增路由、不新增 slot。 **本刀（企业标签）**：徽章与胶囊只消费官方座位与官方原语——①「企业」徽章挂在官方 `plugins.detail.badge` 上（该座位在我们这条 item 详情页里真的会被渲染，已按官方实物核实，不是白挂）；② 与官方「实验性」签的**一致口径**是可验证的三件：同一枚官方 `Tag` 原语本体、同一个 `tone="info"`、props 恰好只有 `{className,tone,children}`（官方公开面之外一个属性都不给）；**拿不到的是官方那个本地尺寸覆盖类**（`PluginManagerPage` 的 `statusTag` = CSS module 哈希名 `X_2TxG_statusTag`，该包只导出 `NS`/`PANEL_ID`/`apply`/`inject`，`./src/*` 指向的 `src/` 未随包发布），故按「不新增 CSS 类」退到官方 primitives 公开面，尺寸差异如实记在 `EnterpriseMarketBadgeTag` 的注释里；③ 描述行与徽章同源（同一枚 `EnterpriseMarketBadgeTag`），两处不会漂成两个词。 **本刀（企业标签移回标题行）**：用户明确「企业应该在标题行，标题后面」两次，故描述行胶囊撤销、恢复纯文本；标题行那一枚**不再**由本文件渲染——它由 `market-entry-badge.ts` 在官方列表 DOM 上做装饰（克隆官方 Tag 实物，与官方「实验性」签逐像素一致），本文件只保留**详情页**那一枚 React 徽章；本文件与 `market-entry-badge.ts` 的分工是「React 槽 vs DOM 装饰」，两侧都读同一份 `ENTERPRISE_MARKET_BADGE_TEXT`，不会漂成两个词。 **本刀**：进度只在真的在装的那一行、只在有工序时进 DOM；多行各算各的（按包名归行），不影响别的行的可拨性。 **本刀（企业插件真取消）**：取消入口与进度**同一条链、同一份投影**——「能不能取消」由 Host 真受管态算（`plugin-install-progress.ts` 的 `ENTERPRISE_PLUGIN_CANCELABLE_STATES`），「在不在取消中」由同一份 store 快照的 `pluginCancelBusy` 算；不新增任何 CSS 类、不新增 slot、不新增路由，写入口与「企业设置 → 插件」那枚按钮同名同源（都是 `store.cancelPlugin`）；取消的收束走既有那条行内提示（`EnterpriseMarketRowError` + 唯一码表），不新造第二套「已取消」提示组件。
 * **本刀（插件行动分流，用户口径）**：插件行的动作区从「一枚开关 = 装/卸」改成**按状态分流**——未安装 ⇒ 一枚【＋】
 *   （`onInstallPlugin`，`data-enterprise-plugin-slot=install`）、已安装 ⇒ 一枚官方 `Switch` ＝ 启用 / 停用
 *   （`onTogglePluginEnabled`，`data-enterprise-plugin-slot=switch`）；分流真源是 `plugin-install-gate.ts` 的
 *   `enterprisePluginInstalled`（`desiredState` + **已落盘版本**两件真源，故「失败的首装」仍给 ＋ 重试而不是假开关）。
 *   ★**本刀（分组卡片重构，Codex 插件商店口径）已取代上面这一段的分流形态**：目录卡片**不再用开关**——
 *   未安装 ⇒ 一枚「安装」按钮（`data-enterprise-plugin-slot=install`），已安装 ⇒ 一枚「⋯」溢出菜单
 *   （未接下拉宿主时按**平铺**渲染同一枚子块），菜单项按这一行**真实能力**给：`更新`（两侧版本不同）/
 *   `启用·停用`（走 `onTogglePluginEnabled`）/ **`卸载`（只给非内置项**，`enterpriseMarketPluginBuiltin`＝
 *   「仍由企业目录提供」，故后台分配/预置的内置项动不了）——`store.removePlugin` 在本文件**恰好一处**。
 *   本轮之前那句「本页没有任何卸载动作」已作废；分流真源仍是 gate 叶的 `enterprisePluginInstalled`；
 *   插件行的启停标签词表也收敛到 gate 叶（`enterprisePluginEnabledLabel`，`已启用 / 已停用`），
 *   且只在 `ACTIVE` 那一格出「已安装 · 已启用 / 已停用」，其余受管态仍由官方状态词表说（失败不会被读成正常）。
 * **本刀（卡片标题 = 插件名称）**：企业插件行的标题由「包名」改成**插件名称**——取值经叶子投影
 *   `enterprisePluginDisplayName(plugin.displayName, plugin.packageName)`（与「企业设置 → 插件」卡片、
 *   详情弹窗**同一份真源**）：有 `displayName` 就用它，缺席/空白**回退包名**（不空白、不编造）。
 *   ★ **如实交代一处预期**：真实数据里 6 条企业目录插件，5 条的 npm 制品 sha256 与上架制品逐字节相同、
 *   其 `package.json` **一条都没写 `displayName`**（第 6 条未发布到 npm、本机无制品）⇒ 显示名 = 包名，
 *   **今天这批插件在界面上的标题与改前逐字相同**；只有声明了人类可读名的插件才看得出差别。
 *   ★ **市场面插件行没有详情页**（企业插件的详情在「企业设置 → 插件」那一面）⇒ 本行标题仍是纯文本，
 *   不造"_点了没反应"的假按钮；有详情入口的技能/配方行才是真 `<button>`，由 `plugin-card.spec.ts` 反向锁。 **本刀（插件行详情子页面，用户口径第 16 条，推翻第 15 条末尾那句批注）**：插件行标题改成真 `<button class="own-market-rowOpen">`（`data-enterprise-plugin-open` + 「查看企业插件 <名称> 详情」，**没有** `aria-haspopup`），点它把「企业插件」页签的**内容区**换成详情**子页面**（互斥由**复用的** `EnterprisePluginContentRegion` 保证、页头与四枚页签一字不改）；正文**原样复用** `plugin-market.tsx` 的 `EnterprisePluginDetailPage`（import 一处、渲染一处，零复制），它那份样式表由那边新导出的 `ENTERPRISE_PLUGIN_STYLES` 在详情态一并挂上（列表态一个字节都不多背）；动作区是行上**同一枚**新抽出的 `EnterpriseMarketPluginRowActions`（能装就装、已装就开关，本面**不引导卸载**）；返回两条真路径（返回按钮 + Esc，监听钉在本页根节点）；**浏览器返回键不接**（没有真实路由，不许硬造 `history`）；返回后按**同一枚** `scrollTargetOf` 的判定还原滚动位置、按包名把焦点还给那一枚标题按钮。 **本刀（插件市场详情补描述，用户口径第 19 条）**：本面（face B）把**行上第二行那条同一份真值**（`EnterpriseMarketPluginRow.description`）经 `EnterprisePluginDetailPage` 新增的**可选** prop `description` 传进详情 ⇒ 事实表之后多一段「描述」；face A 不传该 prop，故那一面输出逐字不变（additive 例外，同口径 18③）。 **本刀（口径 20：描述来自 README）**：详情「描述」段的**内容来源**从「制品 `package.json` 的短 `description`」换成「**插件制品里的 README**」——行投影新增**可选** `readme`（索引自目录项的 `PluginReadme`，缺席/null/空串一律不产出该键），正文由**唯一一枚**纯投影 `enterpriseMarketPluginDetailBody(readme, description)` 决定：**有 README 就用 README**，没有才**回落**到那枚短描述，两者都没有 ⇒ 整段不进 DOM（口径 19 的三态一条不丢，只是首选换了）。**行上第二行仍读短 `description`**（README 是整篇正文，不进两行 clamp 的卡片）。渲染方式与版式**一字未动**：仍是纯文本子节点 + `pre-wrap` 保换行 + 12 行块内滚动（全文件 `dangerouslySetInnerHTML` 零出现），**不新增依赖、不解析 Markdown**（全仓没有既有渲染器，技能正文也是 `<pre>` 纯文本）。face A（企业设置 → 插件）**不传** `readme`、也不传新的 prop ⇒ 它那一面的详情输出与口径 19 **逐字相同**（`plugin-card.spec.ts` 的字节级大纲快照原样绿）。 **本刀（口径 22：README 渲染成漂亮排版）**：README 不再当纯文本铺——详情那一段的**版式**改由新叶 `markdown-render.tsx` 的 `renderMarkdown` 排版（标题/段落/列表/代码块/引用/水平线/粗斜体/删除线/链接/行内代码/换行），本面只多传一枚**可选** prop `descriptionMarkdown`，取值来自**唯一一枚**纯投影 `enterpriseMarketPluginDetailMarkdown(page.row.readme)`（**有 README 才为真**；回落到短描述时仍为假 ⇒ 短描述那一支的版式与口径 19/20 **逐字相同**）。`description=` 那一行**一字未改**（口径 20 的正文判定点原样保留，两者同源同口径）。README 一律当**数据**：raw HTML 当纯文本、`javascript:`/`data:` 链接降级为文字、图片语法**绝不**渲染 `<img>`、全文件 `dangerouslySetInnerHTML`/`innerHTML` 零出现；解析在自写渲染器里（**不新增依赖**），块级逐行扫描 + 行内二分查找 + 深度/步数预算，病态输入也有界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { BookMarked, ChevronDown, FileText, Filter, Folder, Library, MoreHorizontal, Package, Plus, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { Button, StateDot, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, Ref } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { enterpriseSessionUsable, useAccount } from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import { formatByteSize } from './display-format.js'
import { ENTERPRISE_LIBRARY_GATE_DEFAULT, type EnterpriseLibraryGate, type EnterpriseLibraryGateSnapshot } from './library-gate.js'
import {
  ENTERPRISE_PLUGIN_STYLES,
  EnterprisePluginContentRegion,
  EnterprisePluginDetailPage,
  enterprisePluginCatalogVersionText,
  enterprisePluginDetailDescription,
  enterprisePluginStatePresentation,
  scrollTargetOf,
} from './plugin-market.js'
import type { EnterpriseInstalledSkill, EnterpriseInstalledSkillFile, EnterpriseLocalApi, EnterprisePluginCatalogItem, EnterprisePluginItem, EnterprisePresetApplicationKind, EnterprisePresetAuthorization, EnterprisePresetDisclosure, EnterprisePresetOfficialApplication, EnterprisePresetStatus, EnterpriseRuntimePreset, EnterpriseRuntimeSkill, EnterpriseSkillFileEntry, ManagedPluginState } from './local-api-decode.js'
import { enterpriseLocalErrorCode } from './local-api-decode.js'
import { EnterpriseErrorNotice } from './error-notice.js'
import { enterpriseErrorPresentation, enterpriseErrorRetryable } from './error-messages.js'
// 插件行「给哪一枚控件 / 为什么拨不动」的唯一口径（与「企业设置 → 插件」共用同一份）；平台不参与任何判断。
import {
  enterprisePluginEnabledLabel,
  enterprisePluginInstallLabel,
  enterprisePluginInstallTitle,
  enterprisePluginInstalled,
  enterprisePluginInstalledStatusLabel,
  enterprisePluginLockNotice,
  enterprisePluginLockReason,
  enterprisePluginSwitchTitle,
  type EnterprisePluginLockReason,
  type EnterprisePluginRowAction,
} from './plugin-install-gate.js'
// 「安装中」那一行**真进度**的唯一投影（与「企业设置 → 插件」共用同一份；阶段文字另取自上面那枚官方状态词表）：
// 进度只给**阶段**、不给百分比，故它是「不确定态流光 + 阶段文字」而不是会走满的进度条。
import {
  ENTERPRISE_PLUGIN_PROGRESS_CANCELLING,
  enterprisePluginProgress,
  enterprisePluginSettledNotice,
  type EnterprisePluginBusyFact,
  type EnterprisePluginProgress,
  type EnterprisePluginSettledFact,
} from './plugin-install-progress.js'
// 配方侧的两件**复用件**（都取自「企业设置 → 配方」那个 tab，本页不新造第二份）：
//   · `createEnterprisePresetListSource` = 配方目录的**唯一**取数源工厂（与设置弹窗同一份实现，经 `store.api` 发出）；
//   · `buildPresetImportInstruction` = 导入指令的**唯一**构造器（本页只把它写进剪贴板，指令正文不上屏）。
//   · 三句加载/空/失败文案也直接取它那一份，免得同一个页签在设置里和商店里说两套话。
import {
  ENTERPRISE_PRESET_LIST_EMPTY,
  ENTERPRISE_PRESET_LIST_FAILED,
  ENTERPRISE_PRESET_LIST_LOADING,
  buildPresetImportInstruction,
  createEnterprisePresetListSource,
} from './preset-market.js'
import {
  ENTERPRISE_LIST_RETRY,
  ENTERPRISE_LIST_RETRY_LABEL,
  createEnterpriseListSource,
  enterpriseDegradedRead,
  type EnterpriseListSource,
  type EnterpriseListState,
} from './list-state.js'
import type { EnterprisePresetLaunchPort } from './preset-launch.js'
import { EnterpriseLoginDialog, useEnterpriseLoginDialog } from './login-dialog.js'
// 卡片标识/文案叶子（与「企业设置 → 插件」卡片**共用同一份**）：徽章组件、版本签字面、标题取值、描述降级句。
// 这里既 import（本文件自己要用）又 re-export（保持原公开面与既有 import 路径不变）。
import {
  ENTERPRISE_MARKET_BADGE_TEXT,
  ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY,
  EnterpriseMarketBadgeTag,
  enterpriseMarketVersionTag,
  enterprisePluginDescriptionText,
  enterprisePluginDisplayName,
} from './enterprise-card-text.js'

/** 本入口在官方插件页占用的 slot id，同时是卡片 DOM 的 `data-plugin-item` 与详情页路由键。 */
export const ENTERPRISE_MARKET_ENTRY_ID = 'plugin-market'

/** 卡片与详情页共用的标题，官方把它渲染在卡片标题与详情页 `h3` 两处。 */
export const ENTERPRISE_MARKET_ENTRY_LABEL = '插件市场'

/** 在官方 `plugins.item` 中排在官方四个配置卡片（10/20/30/40）之后。 */
export const ENTERPRISE_MARKET_ENTRY_ORDER = 50

/**
 * 「企业」标签文案 / 徽章 / 版本签字面 / 描述降级句**都不再在本文件声明**——它们已下沉到叶子模块
 * `enterprise-card-text.tsx`（「企业设置 → 插件」卡片与本页因此共用同一份，不可能漂成两个词），
 * 本文件按原公开面**再导出**，故既有调用方与用例的 import 路径一字未变。
 */
export {
  ENTERPRISE_MARKET_BADGE_TEXT,
  ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY,
  EnterpriseMarketBadgeTag,
  enterpriseMarketVersionTag,
  enterprisePluginDescriptionText,
  enterprisePluginDisplayName,
} from './enterprise-card-text.js'

/**
 * 卡片与详情页描述行共用的那句话；官方会把 `summary` 渲染两次，故必须保持单行。
 * **本刀（企业标签移回标题行）**：描述行**恢复**成原来的「企业插件 · 技能 · 配方」——用户两次指出
 * 「企业」标签必须在**标题行、标题正后方**，在描述行是错的；描述行重新用完整四字交代这行是什么，
 * 列表标题行那枚签由 `market-entry-badge.ts` 的 DOM 装饰插在官方标题按钮正后方（官方 `CardHead` 不接受
 * `tags`，API 层次做不到，见该文件 [POS]）。
 */
export const ENTERPRISE_MARKET_SUMMARY = '企业插件 · 技能 · 配方'

/**
 * 组件清单真源：**四行按交付顺序**。
 *
 * `reserved` 决定「预留」状态与开关禁用；
 * `gate` 决定那枚开关**归谁管**：
 *   · `session` = 企业会话开关（登录后可用，界面不给假切换）；
 *   · `local`   = **本机设置**里的管理门（本刀新增的「资料库」：默认**关**，拨动即本机生效、不需要登录）。
 * `module` 是内部模块台账（**不上屏**，由反向锁用例守着它不出现在树上）。
 * **本刀（企业配方页签）**：`presets` 行由 `reserved:true` 改 `false`——配方已经不是预留件：
 * 它以「企业配方」页签与技能/插件并排出现在商店页里，故它那枚开关的语义与技能/插件行同一条
 * （会话口径：未登录可点去登录、登录后禁用防假切换），`包含内容` 页签也不再说它是「预留」。
 */
export const ENTERPRISE_MARKET_COMPONENTS = [
  { gate: 'session', id: 'plugins', label: '插件', module: 'enterprise plugins · remote.pluginManager', note: '企业发布的插件与官方插件包', reserved: false },
  { gate: 'session', id: 'skills', label: '技能', module: 'official skills/list', note: '企业发布的技能包与装配指令', reserved: false },
  { gate: 'session', id: 'presets', label: '配方', module: 'dsh-preset / .dshpreset', note: '企业配方广场', reserved: false },
  { gate: 'local', id: 'library', label: '资料库', module: 'library · local settings', note: '把资料集中收好，随时取用', reserved: false },
] as const

/**
 * 组件交付排期清单，按交付顺序（**历史规划元数据，不驱动任何渲染**——页签化之后真正的页签真源是
 * `ENTERPRISE_MARKET_TABS`；本刀不动它，故这里的「配方 = 预留」只作为当时的排期记录保留）。
 */
export const ENTERPRISE_MARKET_PLAN = [
  { id: 'plugins', label: '插件', note: '官方 / 已安装 / 企业插件 三分组' },
  { id: 'skills', label: '技能', note: '已排期' },
  { id: 'presets', label: '配方', note: '预留' },
] as const

/** `page` 视图**四枚**页签的 id（页签条顺序即 `ENTERPRISE_MARKET_TABS` 的数组顺序）。 */
export type EnterpriseMarketTabId = 'skills' | 'plugins' | 'presets' | 'components'

/**
 * 页签条真源：**顺序即渲染顺序**，第一项同时是默认选中项（见 `ENTERPRISE_MARKET_DEFAULT_TAB`）。
 * **术语降维**：第四枚页签原为「组件」（技术词）——现在叫「包含内容」，与节标题同词。
 * **本刀（企业配方页签）**：新增第三枚「企业配方」——用户指定的位次是**企业插件之后、包含内容之前**，
 * id 取新 id `presets`（**不复用**已按用户要求移除的旧「应用商店」那批 id/文案）。
 * **`label` 只是基础词**：渲染时经 `enterpriseMarketTabLabel(label, count)` 补上计数
 * （原先企业技能 / 企业插件两节内部各占一行的 `N 个` 计数行已退场，数字并入页签，见该投影）。
 */
export const ENTERPRISE_MARKET_TABS = [
  { id: 'skills', label: '企业技能' },
  { id: 'plugins', label: '企业插件' },
  { id: 'presets', label: '企业配方' },
  { id: 'components', label: '包含内容' },
] as const

/** 默认页签＝「企业技能」：用户的主战场，后台分配（预置）的技能一进页面就该看得见。 */
export const ENTERPRISE_MARKET_DEFAULT_TAB: EnterpriseMarketTabId = 'skills'

/** 页签条的无障碍名（`role="tablist"` 的 `aria-label`）。 */
export const ENTERPRISE_MARKET_TABLIST_LABEL = '企业市场'

/* ───────────────────── 分类真源（列表分组 + 筛选类型，用户口径） ───────────────────── */

/**
 * **七类真源**（用户裁决，顺序即展示顺序）：列表分组与筛选「类型」组分共用这一份。
 * 顺序刻意**不按数量重排**——分组位置稳定，用户扫一眼就知道去哪一类找。
 */
export const ENTERPRISE_MARKET_CATEGORIES = ['精选', '效率', '研究', '编程', '商业', '创意', '其他'] as const

export type EnterpriseMarketCategory = (typeof ENTERPRISE_MARKET_CATEGORIES)[number]

/** 未命中七类的**唯一**归处（分组与筛选共用同一个字面，不各写一份）。 */
export const ENTERPRISE_MARKET_CATEGORY_OTHER: EnterpriseMarketCategory = '其他'

/**
 * 条目分类 → 七类之一（用户裁决 A：**严格按七类，未命中的一律进「其他」**）。
 *
 * 命中判定是 **trim 后逐字相等**：不做同义词、包含、模糊或大小写折叠——分类是展示口径，
 * 猜错比归「其他」更糟。缺席 / null / 空白 / 不在七类里的（含「其他」本身）一律归「其他」；
 * 「其他」是兜底格而不是靠数据命中的格子，故数据里真写「其他」也落同一格（结果一致）。
 */
export function enterpriseMarketCategory(category: string | null | undefined): EnterpriseMarketCategory {
  if (category === undefined || category === null) return ENTERPRISE_MARKET_CATEGORY_OTHER
  const value = category.trim()
  const known: readonly string[] = ENTERPRISE_MARKET_CATEGORIES
  return known.includes(value) && value !== ENTERPRISE_MARKET_CATEGORY_OTHER
    ? (value as EnterpriseMarketCategory)
    : ENTERPRISE_MARKET_CATEGORY_OTHER
}

/** 一个分类分组（分类名 + 该组的行，行序＝入参行序，组内不再排序）。 */
export interface EnterpriseMarketCategoryGroup<T> {
  readonly category: EnterpriseMarketCategory
  readonly rows: readonly T[]
}

/**
 * 把行按七类分组，**只保留非空组**（空分类不出组头、不出分割线——不给用户看空壳）。
 * @param rows - 已过滤的行（顺序即组内展示顺序）。
 * @param categoryOf - 逐行取分类原始值的投影（行模型之间字段名不同，故由调用方给）。
 */
export function enterpriseMarketCategoryGroups<T>(
  rows: readonly T[],
  categoryOf: (row: T) => string | null | undefined,
): readonly EnterpriseMarketCategoryGroup<T>[] {
  const buckets = new Map<EnterpriseMarketCategory, T[]>()
  for (const row of rows) {
    const key = enterpriseMarketCategory(categoryOf(row))
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, [row])
    else bucket.push(row)
  }
  return ENTERPRISE_MARKET_CATEGORIES
    .filter(category => (buckets.get(category)?.length ?? 0) > 0)
    .map(category => ({ category, rows: buckets.get(category) as readonly T[] }))
}

/**
 * 搜索匹配：对若干字段做**大小写不敏感的子串**匹配；空查询恒真（＝不过滤）。
 * 只认传入的字段（标题 / 描述 / 标识），**不模糊、不猜**；字段缺席或非串一律不参与匹配。
 */
export function enterpriseMarketSearchMatch(
  query: string,
  fields: readonly (string | null | undefined)[],
): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return fields.some(field => typeof field === 'string' && field.toLowerCase().includes(needle))
}

/* ───────────────────── 筛选下拉的选项真源 ───────────────────── */

/** 状态筛选的三态（`all` 表示不筛）。 */
export type EnterpriseMarketStatusFilter = 'all' | 'enabled' | 'disabled'

/**
 * 筛选下拉的**两个组**：状态组（与页签无关）+ 类型组（＝上面那份七类真源，逐项同源）。
 * 类型组的 `id` 就是分类名本身（`'all'` 是唯一的非分类项），故选项与分组投影不可能漂成两套。
 */
export const ENTERPRISE_MARKET_FILTER_GROUPS = [
  {
    id: 'status',
    title: '状态',
    options: [
      { id: 'all', label: '全部' },
      { id: 'enabled', label: '已启用' },
      { id: 'disabled', label: '已停用' },
    ],
  },
  {
    id: 'category',
    title: '类型',
    options: [
      { id: 'all', label: '全部类型' },
      ...ENTERPRISE_MARKET_CATEGORIES.map(category => ({ id: category, label: category })),
    ],
  },
] as const

export type EnterpriseMarketFilterGroupId = (typeof ENTERPRISE_MARKET_FILTER_GROUPS)[number]['id']

/** 筛选下拉的开合无障碍名（触发钮 + 菜单）。 */
export const ENTERPRISE_MARKET_FILTER_LABEL = '筛选'
export const ENTERPRISE_MARKET_FILTER_MENU_LABEL = '筛选条件'
/** 选中标记（组头与当前项前那枚 ✓，照参考图）。 */
export const ENTERPRISE_MARKET_FILTER_CHECK = '✓'

/** 搜索框的无障碍名与占位（一个真输入框，不是一个摆设）。 */
export const ENTERPRISE_MARKET_SEARCH_LABEL = '搜索'
export const ENTERPRISE_MARKET_SEARCH_PLACEHOLDER = '搜索技能、插件、配方'
/**
 * 「过滤后为空」那一句（目录本身有数据、只是被搜索/状态/类型筛没了）。
 * **与「目录为空」「取数失败」都分得清**：这三件事的原因与下一步动作完全不同，不许混成一句。
 */
export const ENTERPRISE_MARKET_FILTER_EMPTY = '没有匹配的项目。换个关键词或筛选条件试试。'
/** 空态里那枚「一键清空」——不然用户被筛空后只能自己逐项撤回。 */
export const ENTERPRISE_MARKET_FILTER_CLEAR_LABEL = '清空筛选'


/**
 * 页签 ↔ 面板的固定 id 配对：`id` / `aria-controls` / `aria-labelledby` 三处同源，避免手抄漂移。
 * 两套外壳都**不能调 `useId`**（那会把外壳变成 hook 组件，破坏「可直接函数调用测试」的既有形状）；
 * 而本页同一时刻只有一份实例（官方 `plugins.item` 的 page 视图只渲染当前 item），故用常量 id 足够。
 */
export const ENTERPRISE_MARKET_TAB_IDS: Record<EnterpriseMarketTabId, { readonly tab: string; readonly panel: string }> = {
  skills: { tab: 'market-tab-skills', panel: 'market-panel-skills' },
  plugins: { tab: 'market-tab-plugins', panel: 'market-panel-plugins' },
  presets: { tab: 'market-tab-presets', panel: 'market-panel-presets' },
  components: { tab: 'market-tab-components', panel: 'market-panel-components' },
}

/**
 * 页签文案 = 基础词 + 计数（`企业技能 3`）。
 * **数字口径与原先那行节计数同源**：取该页签**真正要渲染的行数**（企业技能 / 企业插件受可见性门控，
 * 门控不过即 0；组件恒取组件清单长度）。
 * 为压缩详情页顶部的垂直空间，原先在两节内部各占一整行的 `.own-market-sectionMeta`（`N 个`）已退场，
 * 数字并入页签本身；计数用裸数字（不再带「个」字）以省字宽——页签仍是 13/20 的单行（`white-space:nowrap`），
 * 既不换行也不撑高页签条。
 */
export function enterpriseMarketTabLabel(label: string, count: number): string {
  return `${label} ${count}`
}

/**
 * **目录类**页签（有行列表的那三个 = 技能 / 插件 / 配方）：`EnterpriseMarketInlineRows` 与行 facts、行键投影都用它定位。
 * 「包含内容」页签恒四行（插件/技能/配方 + 资料库）、是台账式清单而不是目录，故不在这个联合里（它走 `EnterpriseMarketComponentsPanel`）。
 */
export type EnterpriseMarketDirectoryTabId = 'skills' | 'plugins' | 'presets'

/**
 * 行的开合状态真源（共享控制器 `useEnterpriseMarketController` 的 `useState<string | null>`）：
 * 行键 = `{页签}:{行 id}`——带页签前缀是为了「切页签不会误开同名行」（技能包 id 是雪花、插件是包名，两者不该互相命中）。
 */
export function enterpriseMarketRowKey(tab: EnterpriseMarketDirectoryTabId, id: string): string {
  return `${tab}:${id}`
}

/** 展开区容器的 DOM id（标题行按钮 `aria-controls` 的落点）：行 id 只留安全字符，包名里的 `@`/`/` 不会拿到非法选择器。 */
export function enterpriseMarketRowDetailsId(tab: EnterpriseMarketDirectoryTabId, id: string): string {
  return `market-details-${tab}-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`
}

/**
 * 某行是否展开——**单选**：同一时刻最多一行展开（照参考对象的 `expanded === item.id`）。
 * 显式给了 `expandedRow`（真运行时恒为 `string | null`）就按它；`undefined` 视为「没有给过状态」→ 全开，
 * 让纯函数直调拿到完整树（与 `enterpriseMarketSectionOpen` 的 `defaultOpen` 同一约定）。
 */
export function enterpriseMarketRowOpen(expandedRow: string | null | undefined, key: string): boolean {
  return expandedRow === undefined ? true : expandedRow === key
}

/** 计数摘要分段，照官方 `partsSummary` 口径；`off` 是本机开关那条（默认关的**可见**交代，见 `enterpriseMarketComponentState`）。 */
export type EnterpriseMarketSummary = { readonly total: number; readonly ready: number; readonly off: number; readonly reserved: number }

/**
 * 一次企业市场安装/卸载失败的行内提示（插件行与技能行共用同一形状）。
 * `id` 是行键（企业插件 = packageName、企业技能 = 技能包雪花 id），`code` 一律来自
 * `enterpriseLocalErrorCode` 这一份失败码唯一投影——界面只负责显示，不自造文案也不吞错误码。
 */
export interface EnterpriseMarketActionError {
  /** 出错的行键：与该行的 `data-enterprise-plugin-package` 同值。 */
  readonly id: string
  /**
   * 失败的动作：行内前缀文案由它决定（安装失败 / 卸载失败 / **启用失败 / 停用失败**）。
   *
   * `'cancel'`（既有）是**取消在途安装**那一条：取消**不是**失败，故它的前缀是 `undefined`
   * （见 {@link enterpriseMarketActionErrorLabel}）——那句人话本身已经完整，前缀只会读成自相矛盾。
   * `'enable'`/`'disable'`（本刀）是那枚开关拨动的两个方向：它们是**真失败**，
   * 前缀各自说清是哪一边失败了（绝不说成「卸载失败」——关掉开关不是卸载）。
   */
  readonly action: 'install' | 'uninstall' | 'cancel' | 'enable' | 'disable'
  /** 稳定错误码（`ENT_…`），与「技能」tab、插件设置页同一份投影。 */
  readonly code: string
}

/**
 * 失败动作 → 行内提示前缀，照「技能」tab 的行内提示口径（安装失败 / 卸载失败）。
 *
 * 取消那一支**不给前缀**：`ENT_PLUGIN_INSTALL_CANCELLED` 的人话是「这次安装被取消了。」，
 * 再挂一句「安装失败：」就是自相矛盾（用户明明是自己按的取消），挂「取消：」又是同义反复。
 * 返回 `undefined` 时 `EnterpriseErrorNotice` 只出人话 + 下一步 + 技术信息，形制一字未改。
 */
export function enterpriseMarketActionErrorLabel(error: EnterpriseMarketActionError): string | undefined {
  if (error.action === 'cancel') return undefined
  if (error.action === 'enable') return '启用失败'
  // 关闭开关＝**停用**，因此这里说的是「停用失败」而不是「卸载失败」——
  // 用户明确纠正过的语义，一个字的偏差都会把停用读成卸载。
  if (error.action === 'disable') return '停用失败'
  return error.action === 'install' ? '安装失败' : '卸载失败'
}

/**
 * 页面（目录页外壳 + 它里面的技能详情子页面）的 props —— 纯函数直调测试的唯一入口。
 * 业务真值（目录、已装清单、在途动作、两个失败码）与全部回调由共享控制器 `useEnterpriseMarketController` 统一注入；
 * UI 态（页签选中 / 行开合 / 组件节折叠 / **详情子页面及其文件树与预览**）也来自同一份控制器状态。
 * 纯函数直调时全部可选——缺席即按最保守的口径渲染（未登录、无目录、无失败、全展开、无详情），
 * 这样测试能直接函数调用拿到完整语义树。
 */
export interface EnterpriseMarketShellProps {
  /** 视图：卡片一句话用 `summary`，详情正文用 `page`（两套外壳都支持，入口侧各自恒定传 `page`）。 */
  readonly view: 'summary' | 'page'
  /**
   * 本页根节点（`section.own-market-entry`）的挂点 —— **只由共享控制器注入**：插件详情子页面那套
   * 运行期行为（Esc 只在本页回列表、返回后焦点还给那一行标题按钮、列表滚动位置写回）把监听与查找
   * 钉在**这一个节点**上，而不是 `document`（否则会抢走官方面板别处的 Esc）。
   * 纯函数直调时不传：那些行为都落在 `useEffect` 里，纯函数直调本来就不跑 —— 版面一个字节不受影响。
   */
  readonly sectionRef?: Ref<HTMLElement> | undefined
  /**
   * 官方对注册了配置命名空间的条目传入配置表单；本入口没有配置命名空间，
   * `PluginManagerPage.formFor()` 会提前返回 `undefined`，因此这里只声明不消费。
   */
  readonly form?: never
  /**
   * 企业账号共享 store：控制器订阅它并算出会话可用性/开登录回调后注入。外壳自身不订阅、不调 hook
   * （保持纯函数可直接调用），`store` 缺席时外壳拿到的 `sessionUsable` 是 false。
   */
  readonly store?: EnterpriseAccountStore | undefined
  /** 会话可用性直传（测试用）：真运行时由控制器订阅 store 算出后传入，缺席取 false。 */
  readonly sessionUsable?: boolean
  /** 打开企业登录弹窗的回调：未登录时拨动组件开关触发；缺席时开关恒禁用（不提供假切换）。 */
  readonly onOpenLogin?: (() => void) | undefined
  /**
   * 企业后台上传的真实插件目录（`store.pluginStatus.catalog` × 本机记录归并后的行投影）。
   * 仅当「插件」大组件开启（`sessionUsable`）且非空时在「企业插件」页签渲染；缺席 = 空目录。
   */
  readonly enterprisePlugins?: readonly EnterpriseMarketPluginRow[] | undefined
  /**
   * 企业技能目录（`store.api.skills()` 的列表投影；已装行的中心当前版本由控制器补详情归并）。
   * 与「企业插件」同规则：仅当「技能」大组件开启且目录非空时在「企业技能」页签渲染；
   * **列的是后台分配（预置）的全部技能**，不按「已装」过滤。缺席 = 空目录。
   */
  readonly enterpriseSkills?: readonly EnterpriseMarketSkillRow[] | undefined
  /**
   * 「企业技能」页签的**取数状态**（控制器从唯一取数源 `createEnterpriseSkillCatalogSource` 订阅得来）。
   * 它把「加载中 / 空 / 失败 / 就绪」四态显式交给外壳：缺席（纯函数直调 / 老调用方）即按行数的旧口径回落，
   * 真运行时一定注入——所以「目录取数失败」有自己的那一态，而不是一片空白加计数 0。
   */
  readonly skillsListState?: EnterpriseListState<EnterpriseSkillCatalog> | undefined
  /** 「企业技能」页签失败态的重试（真的重发一次取数）；缺席即不渲染重试按钮（不给死按钮）。 */
  readonly onRetrySkills?: (() => void) | undefined
  /**
   * 「企业插件」页签的取数状态（插件目录由账号 store 取；控制器把 `pluginsLoading`/`pluginErrorCode`
   * 与已取到的目录合成本状态）。与技能页签同形：缺席即按行数旧口径回落。
   */
  readonly pluginsListState?: EnterpriseListState<readonly EnterpriseMarketPluginRow[]> | undefined
  /** 「企业插件」页签失败态的重试（请 store 重新取一次企业插件投影）。 */
  readonly onRetryPlugins?: (() => void) | undefined
  /**
   * 企业配方目录（`store.api.presets()` 经共享取数源 `createEnterprisePresetListSource` 取到的列表，
   * 再由唯一行投影 `enterpriseMarketPresetRows` 铺成行）。
   *
   * 与「企业技能」「企业插件」同规则：仅当「配方」组件开启（= 会话可用）且目录非空时在
   * 「企业配方」页签渲染；缺席 = 空目录。取数**不新造宿主路由、不碰 local-api**：设置的配方 tab
   * 用的就是同一个取数源工厂。
   */
  readonly enterprisePresets?: readonly EnterpriseMarketPresetRow[] | undefined
  /** 「企业配方」页签的取数状态（控制器订阅共享取数源得来）；与另两个目录页签同形，缺席即按行数旧口径回落。 */
  readonly presetsListState?: EnterpriseListState<readonly EnterpriseMarketPresetRow[]> | undefined
  /** 「企业配方」页签失败态的重试（真的重发一次取数）；缺席即不渲染重试按钮（不给死按钮）。 */
  readonly onRetryPresets?: (() => void) | undefined
  /**
   * 打开某条**企业配方**的详情子页面（用户点行标题 = 行本体那枚按钮触发）。
   * 与技能详情同口径：只交回被点的那一行，详情里的一切由宿主用**同一份**真值投影；
   * 缺席时那枚按钮 `disabled` + `title='详情入口未接通'`（不给死按钮），真运行时恒由控制器供给。
   */
  readonly onOpenPresetDetail?: ((row: EnterpriseMarketPresetRow) => void) | undefined
  /**
   * 复制某条配方的导入指令（**降级链的第三级，只能是第三级**）。
   *
   * 指令正文由 `buildPresetImportInstruction`（与设置弹窗同一个构造器）产出并写进剪贴板、**不上屏**
   * （它含上游专名）；回调缺席即不渲染那枚按钮。只有在一键安装与「新建会话并填入指令」都不可用时
   * 它才成为那一行真正给出的动作，且必须配一句可见的「为什么走了这条路」（见 `fallback.note`）。
   */
  readonly onCopyPresetInstruction?: ((row: EnterpriseMarketPresetRow) => void) | undefined
  /** 刚刚复制过的那条配方 id（复制成功的可见反馈：按钮文案从「复制导入指令」变「已复制」）。 */
  readonly presetCopiedId?: string | undefined
  /**
   * **降级链第二级**：跳到新会话并把导入指令填进输入框（用户只需按发送）。
   *
   * 这条链的官方机制已查实（`@deepseek-ai/dsh-client-ui-workspace` 的 `UiWorkspace.openWorkspace`
   * 第二参 `beforeOpen(sessionId)` + `@deepseek-ai/dsh-client-ui-conversation` 的
   * `conversation.input.shell(id).actions.setDraft(text)`），由 `client.tsx` 在 apply 里接线后注入；
   * **缺席**即这一级不可用，降级链如实说明并落到第三级（绝不静默降级、也绝不假装点了有反应）。
   */
  readonly onOpenPresetInNewSession?: ((row: EnterpriseMarketPresetRow) => void) | undefined
  /**
   * 一条配方的**本机动作真值**（按配方包 id 归行）：`GET <local>/presets/<id>/status` 的结果、
   * 是否在途、以及 status / 动作两条失败码。行 facts 与授权弹层都只读它。
   */
  readonly presetStates?: Readonly<Record<string, EnterpriseMarketPresetRowState>> | undefined
  /**
   * 一行配方的**真开关**：`next` 就是官方 Switch 拨动后的目标态。
   *
   * 控制器接到后的编排（唯一一处）：`next === false` → 停用（用 status 里的声明 id）；
   * `next === true` 且**已授权** → 直接启用；`next === true` 且**未授权/指纹已变** → **先弹授权层**
   * （绝不替用户顺手授权），员工确认后才带 `confirmFingerprint` 发 enable。
   * 缺席时开关禁用（不给假切换），降级链随之走到第二级或第三级。
   */
  readonly onTogglePreset?: ((row: EnterpriseMarketPresetRow, next: boolean) => void) | undefined
  /** 当前有一条配方动作在途的那一行 id（进行中的开关不可连点；**失败不禁用重试**）。 */
  readonly pendingPresetId?: string | undefined
  /**
   * 配方行最近一次启用/停用失败（命中 `id` 的行渲染 `role="alert"` 行内提示 + 稳定码）。
   * 与技能/插件同口径：出现失败提示**不**禁用开关，再拨一次就是重试。
   */
  readonly presetActionError?: EnterpriseMarketActionError | undefined
  /**
   * **配方详情子页面**的输入（点配方行标题后才非空）：与技能详情同一形态——非空即整页切换
   * （列表 / 页签条 / 各面板一字不挂载），`undefined` = 正常列表视图。里面的每一件事实都由共享控制器
   * 用行上同一份真值构造（同一个 `EnterpriseMarketPresetRow`、同一份 `enterpriseMarketPresetRowFacts`、
   * 同一份详情取数结果、同一枚行动作子块），因此详情里不存在第二套状态。
   */
  readonly presetPage?: EnterprisePresetPageProps | undefined
  /**
   * 本机已装技能记录（Host 真值）：「已装」只认这份记录里的 `packageId`；「有更新」只用它的 `versionId`
   * 比行上的 `latestVersionId`（两侧都非空且不等）。缺席时所有行显示未装、开关一律关，两层外壳都不猜。
   */
  readonly installedSkills?: readonly EnterpriseInstalledSkill[] | undefined
  /** 当前正在安装/卸载的技能包动作（行键 + 方向）；命中行的开关禁用（在途不许再拨）。 */
  readonly pendingSkill?: EnterpriseMarketSkillPending | undefined
  /**
   * 未安装那一行那枚【＋】的安装动作；缺席时那一格不给假按钮（整枚不画）。
   *
   * 它**只**负责「装」：更新到目录当前版本也在这一条路上（版本由控制器从目录真值取），
   * 而【卸载】不在这条路上——卸载是破坏性操作，只在详情页给（列表行一个卸载入口都没有）。
   */
  readonly onInstallPlugin?: ((row: EnterpriseMarketPluginRow) => void) | undefined
  /**
   * 卸载一枚插件（用户口径：卡片「⋯」里的「卸载」）——**只对非内置项**开放，
   * 内置判定在行上由 `enterpriseMarketPluginBuiltin` 算，菜单里不放那一项。
   * 写入口与「企业设置 → 插件」是同一个 `store.removePlugin`，不新造第二套。
   */
  readonly onUninstallPlugin?: ((row: EnterpriseMarketPluginRow) => void) | undefined
  /**
   * 已安装那一行那枚【开关】的**启用 / 停用**动作；缺席时开关禁用（不提供假切换），并在行上说明为什么。
   *
   * ★ `next === false` 是**停用**，**绝不**等于卸载（用户明确纠正过的语义）：它只把这枚插件的
   * bundle 层从本机 profile 上摘下来，依赖与本机记录都留着；卸载走详情页那条带确认的路。
   */
  readonly onTogglePluginEnabled?: ((row: EnterpriseMarketPluginRow, next: boolean) => void) | undefined
  /**
   * 企业技能的一键安装/卸载动作；缺席时技能行开关禁用（与插件行同一降级口径）。
   * `next` 就是官方 Switch 拨动后的目标态：`true` = 装到本机 `~/.dsh/skills`、`false` = 卸掉。
   */
  readonly onToggleSkill?: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
  /**
   * 打开某条**企业技能**的详情弹层（用户点行本体触发，不是点开关/`[有更新]`）。
   *
   * 只交回被点的那一行——弹层里的名称/描述/分类/版本/skillId/已装态与动作全部由宿主用**同一份真值**
   * （同一个 `EnterpriseMarketSkillRow` + 同一个 `enterpriseMarketSkillRowFacts` + 同一个 `onToggleSkill`）
   * 投影出来，界面上不存在第二套状态。缺席时那枚按钮 `disabled` + `title='详情入口未接通'`
   * （照组件节节头「折叠动作未接通」的既有降级口径：**不给死按钮**，也不为此分叉第二套行结构），
   * 真运行时恒由共享控制器供给。
   */
  readonly onOpenSkillDetail?: ((row: EnterpriseMarketSkillRow) => void) | undefined
  /**
   * 打开某条**企业插件**的详情**子页面**（用户点插件行标题 = 行本体那枚按钮触发）。
   *
   * 与技能/配方详情**同一口径**：只交回被点的那一行，详情里的一切由宿主用**同一份**真值投影
   * （同一个 `EnterpriseMarketPluginRow` + 同一份 `enterpriseMarketPluginRowFacts` + 同一批回调），
   * 界面上不存在第二套状态或第二个动作实现。缺席时那枚按钮 `disabled` + `title='详情入口未接通'`
   * （照本文件既有降级口径：**不给死按钮**），真运行时恒由共享控制器供给。
   *
   * ★ 用户口径第 16 条：插件行的详情是**子页面**（内容区被替换），**不是弹窗** ——
   * 这一面因此一个 `<Modal>`、一个 `role="dialog"`、一个 `aria-haspopup` 都没有（由测试守着）。
   */
  readonly onOpenPluginDetail?: ((row: EnterpriseMarketPluginRow) => void) | undefined
  /**
   * 企业插件行最近一次安装/卸载失败（控制器把 store 已收下的 `pluginErrorCode` 归到刚发起动作的那一行）：
   * 命中 `packageName` 的行渲染 `role="alert"` 行内提示；缺席即无失败。
   * 有失败提示**不**禁用该行开关——用户要能原地重试。
   */
  readonly pluginActionError?: EnterpriseMarketActionError | undefined
  /**
   * **刚发出、还没结束**的那一次企业插件安装/卸载（store 的 `pluginBusy`）。
   *
   * 它只是「我们点了哪一行」的现场事实，**不是**进度本身：真进度是同一个 store 里被轮询刷新的
   * `pluginStatus.plugins[].state`（那一份由 `enterprisePlugins` 行投影带进来）。两者一起交给
   * `plugin-install-progress.ts` 的唯一投影，才能分清「请求已提交（`pending`）」与「Host 报到某一工序（`working`）」。
   * 缺席（纯函数直调 / 老调用方）即没有本客户端发起的动作，但**本机在途态**照样会出进度（见那一片的投影）。
   */
  readonly pluginBusy?: EnterprisePluginBusyFact | undefined
  /** 刚结束那一次安装/卸载的落地交代事实（store 按最终真实受管态记下）；命中行的行下出 `role="status"` 一句。 */
  readonly pluginSettled?: EnterprisePluginSettledFact | undefined
  /** 「安装中」那一路进度读不到时的稳定码：命中行多出一句「进度暂时读不到…」（安装本身不受影响）。 */
  readonly pluginProgressErrorCode?: string | undefined
  /**
   * **本客户端刚发出、还没结束**的取消请求（store 的 `pluginCancelBusy`）。
   *
   * 与 `pluginBusy` 分开两件事实（安装还在跑 / 我们刚请在途取消），一起交给
   * `plugin-install-progress.ts` 的唯一投影：命中本行时那枚取消按钮置为不可用、旁边出「正在取消…」，
   * 并以 `role="status"` 播报。缺席（纯函数直调 / 老调用方）即没有在途取消。
   */
  readonly pluginCancelBusy?: { readonly packageName: string } | undefined
  /**
   * 取消在途的那一次企业插件安装（接 store 的 `cancelPlugin`：同源 POST `/plugins/cancel`）。
   *
   * 它只在**真的能取消**的那一行渲染（`progress.cancelable`），缺席即整枚按钮不画
   * ——照本仓「没写入口就不给死按钮」的既有降级口径。
   */
  readonly onCancelPlugin?: ((row: EnterpriseMarketPluginRow) => void) | undefined
  /**
   * 企业技能行最近一次安装/卸载失败（行键 = 技能包 id）：命中该行时渲染 `role="alert"` 行内提示。
   * 与插件行同口径：提示出现不影响开关可拨性（失败后仍可再拨一次重试）。
   */
  readonly skillActionError?: EnterpriseMarketActionError | undefined
  /**
   * **资料库管理开关**（本机设置，默认关）的当前快照：组件行那枚 Switch 的 `checked`/`disabled`/悬浮说明
   * 与失败提示都从它算。真运行时由控制器订阅 `library-gate` 的唯一真源后注入；缺席（纯函数直调 / 老调用方）
   * 即按产品默认**关**处理，且开关禁用（没有写入口就绝不画一枚能拨的开关）。
   */
  readonly libraryGate?: EnterpriseLibraryGateSnapshot | undefined
  /**
   * 拨动资料库管理开关：`next` 就是官方 Switch 拨动后的目标态；控制器接到后调真源的 `setEnabled`
   * （**立刻生效**：侧栏入口随之出现/撤下，随后写本机设置）。缺席时那枚开关禁用（不给假切换）。
   */
  readonly onToggleLibrary?: ((next: boolean) => void) | undefined
  /** 本机设置写/读失败后的重试（真源的 `retry()`：**真的**再写/再读一次）；缺席即不渲染重试按钮。 */
  readonly onRetryLibrarySave?: (() => void) | undefined
  /**
   * 「组件」页签内部那份组件清单的折叠态（页签化后**只剩这一节还带折叠语义**，两套外壳同规则）。
   * 缺席视为展开（纯函数直调测试不传即得完整树）；真运行时由控制器的 `useState` 供给，初值 = `ENTERPRISE_MARKET_DEFAULT_EXPANDED`。
   */
  readonly expandedSections?: { readonly components: boolean } | undefined
  /** 折叠切换回调（点组件节节头按钮触发）；缺席时节头按钮禁用（不提供死按钮）。 */
  readonly onToggleSection?: ((section: EnterpriseMarketSectionId) => void) | undefined
  /**
   * 当前选中的页签。缺席按 `ENTERPRISE_MARKET_DEFAULT_TAB`（「企业技能」）。
   * 两套外壳共用这一个选择：页签条只有一份实现（`EnterpriseMarketTabStrip`），切到哪一套都同一套语义。
   */
  readonly activeTab?: EnterpriseMarketTabId | undefined
  /**
   * 页签切换回调。页签条**恒可交互**（roving `tabIndex` + ←/→/Home/End 走焦并选中）：选中态与键盘可达
   * 是 tablist 自身的语义，把当前页签做成禁用项会让人以为它坏了；缺席时点击是 no-op（只读页签条，真运行时恒由控制器供给）。
   */
  readonly onSelectTab?: ((tab: EnterpriseMarketTabId) => void) | undefined
  /**
   * 标签行最右那枚**筛选下拉**是否打开（用户口径：参考图的两组下拉）。
   * 纯函数约定与 `expandedSections` 同：缺席 = 关闭。
   */
  readonly filterOpen?: boolean | undefined
  /** 开/关筛选下拉（点触发钮）；缺席时触发钮点击是 no-op（不给死按钮——真运行时恒由控制器供给）。 */
  readonly onToggleFilter?: (() => void) | undefined
  /**
   * 搜索框的当前文本（**本刀起是真过滤**：标题 / 描述 / 标识的子串匹配，大小写不敏感）。
   * 缺席 = 空串 = 不过滤。
   */
  readonly searchText?: string | undefined
  /** 搜索框输入回调；缺席时输入框 `readOnly`（不给一个打了字没反应的假输入框）。 */
  readonly onSearchChange?: ((text: string) => void) | undefined
  /** 状态筛选（缺席 = `'all'`）。 */
  readonly filterStatus?: EnterpriseMarketStatusFilter | undefined
  /** 类型筛选（缺席 = `'all'`；其余取值恒为七类之一）。 */
  readonly filterCategory?: EnterpriseMarketCategory | 'all' | undefined
  /** 点选筛选项（状态组或类型组）——上层保存后**真的**驱动可见行。 */
  readonly onFilterSelect?: ((
    group: EnterpriseMarketFilterGroupId,
    option: string,
  ) => void) | undefined
  /** 一键清空搜索 + 两组筛选（「过滤后为空」那句旁边的唯一出路）；缺席即不画那枚按钮。 */
  readonly onClearFilters?: (() => void) | undefined
  /**
   * **页签是否改由「标题右侧」渲染**（用户裁决 A）：`true` ⇒ 页面这一层**不再**画页签条
   * （它们由官方 `plugins.detail.actions` 槽那一格渲染，两处靠 `EnterpriseMarketTabSeat` 接起来）；
   * 缺席/`false` ⇒ 页签留在页面里（外壳自包含的默认形态：纯函数直调、以及座位没接线的降级路径）。
   * 由宿主按「有没有注入座位」自动决定，故不需要每个调用方都传；两处**绝不会同时出现**页签。
   */
  readonly tabsInTitle?: boolean | undefined
  /**
   * 当前展开「⋯」的那一行（行键 = `enterpriseMarketRowKey(tab, 行 id)`；单选：同一时刻最多一行展开）。
   * `null`/缺席 = 全部收起。开合状态由控制器持（纯函数外壳不持状态），与 `filterOpen` 同一范式。
   */
  readonly menuRow?: string | null | undefined
  /** 开/关某一行的「⋯」（点触发钮）；缺席时触发钮点击是 no-op。 */
  readonly onToggleRowMenu?: ((key: string) => void) | undefined
  /**
   * **当前展开的那一行**（行键 = `enterpriseMarketRowKey(tab, 行 id)`；单选：同一时刻最多一行展开）。
   * `null` = 全部收起、`undefined` = 没给过状态（纯函数直调按「全开」拿完整树，与 `expandedSections` 同约定）。
   * **去折叠后两套外壳都不再消费它**：新外壳卡片改为动作常显，旧外壳的落点本来就是行内直出动作条。
   * 这份状态与下面的回调**按用户裁决先保留**在共享控制器里（不为了这次改动去动共享层）；行 facts 仍照它算 `open`。
   */
  readonly expandedRow?: string | null | undefined
  /** 行的开合回调（去折叠后两套外壳都不再调用；与上面的状态一起保留在共享层，缺席即 no-op）。 */
  readonly onToggleRow?: ((key: string) => void) | undefined
  /**
   * **技能详情子页面**的输入（点技能行本体后才非空）。
   *
   * 非空 = 这个面板**整页切换**成详情子页面（列表/页签整段不渲染，见 `EnterpriseMarketLegacyShell`
   * 的两个 return 分支）；`undefined` = 正常列表视图。它不走路由、不新增 slot，就是一份视图状态。
   * 里面的每一件事实都由共享控制器用**行上同一份**真值构造（同一个 `EnterpriseMarketSkillRow`、
   * 同一份 `enterpriseMarketSkillRowFacts`、同一条已装记录、同一个 `onToggleSkill`、同一份失败事实），
   * 因此详情里不存在第二套状态或第二个动作实现。
   */
  readonly skillPage?: EnterpriseSkillPageProps | undefined
  /**
   * **插件详情子页面**的输入（点插件行标题后才非空）—— 用户口径第 16 条。
   *
   * 与技能/配方详情**同一份纪律**：非空 = 插件页签的**内容区被详情子页面替换**（列表与它那四态提示
   * 一个元素都不挂载，见 `EnterprisePluginContentRegion` 的互斥），`undefined` = 正常列表视图；
   * 里面的每一件事实都由共享控制器用**行上同一份**真值构造（同一个 `EnterpriseMarketPluginRow`、
   * 同一份 `enterpriseMarketPluginRowFacts`、同一批回调），故详情里不存在第二套状态。
   *
   * 详情正文**原样复用** `plugin-market.tsx` 的纯组件 `EnterprisePluginDetailPage`（本文件不复制第二份）；
   * 页头与四枚页签**保持可见、一字不改**（用户口径：详情只占内容区），故这一支不像 `skillPage`/`presetPage`
   * 那样整页切走页签条。
   */
  readonly pluginPage?: EnterprisePluginPageProps | undefined
}

/**
 * 可折叠节的 id 联合。页签化之后**只剩「组件」页签内部那份组件清单还带折叠语义**：
 * 企业技能 / 企业插件两节的显隐已由页签承担，故这两个成员随折叠一起收敛掉（不留死字段）。
 */
export type EnterpriseMarketSectionId = 'components'

/** 节头的可点按钮 id 与内容区 id（`aria-controls` 用）；页签化后只有组件节用得到。 */
export const ENTERPRISE_MARKET_SECTION_IDS = {
  components: 'components',
} as const

/**
 * 唯一剩下可折叠的那一节（「组件」页签内部的组件清单）的初始展开态（共享控制器 `useEnterpriseMarketController` 的 `useState` 初值）。
 * 页签化之后企业技能 / 企业插件两节已无折叠语义，故本常量随之收敛为单字段：
 * 进「组件」页签就直接看得见插件/技能/配方/资料库四行，用户仍可手动折叠。
 */
export const ENTERPRISE_MARKET_DEFAULT_EXPANDED: Record<EnterpriseMarketSectionId, boolean> = {
  components: true,
}

/** 「企业插件」节的一行：企业后台上传的插件（catalog）+ 本机安装态。 */
export interface EnterpriseMarketPluginRow {
  readonly packageName: string
  /** 企业目录版本；已不在目录则取本机版本，都无则 null。 */
  readonly version: string | null
  /** 本机受管态（未安装/安装中/已装…）；无本机记录则 EXPECTED（可选安装）。 */
  readonly state: ManagedPluginState
  /** 企业目录是否仍提供（false = 已下架但本机仍装着）。 */
  readonly inCatalog: boolean
  /**
   * 制品 `package.json` 的 `displayName`（契约 `PluginDisplayName`，1..120）——**卡片标题**的取值。
   * **可为缺席**：新服务端/新 Host 永远带它（验包器缺省回退包名），只有旧 Host 才缺席；
   * 渲染时一律经 `enterprisePluginDisplayName` 取值 ⇒ **缺省回退包名**（不空白、不编造）。
   */
  readonly displayName?: string | undefined
  /**
   * 制品 `package.json` 的 `description`（契约 `PluginDescription`，≤1000）：**卡片第二行**的取值。
   * **为缺失设计**：解码层已把缺席/null/空串归一成「没有这个键」，故这里缺席 ＝ 没有描述
   * ＝ 第二行如实说「暂无描述」（不空白、不编造、不拿版本充数）。已下架的行里没有目录事实，
   * 第二行照旧说「已不在企业目录中」（那一句是既有口径，不丢）。
   */
  readonly description?: string | undefined
  /**
   * 制品 tar 里那份 README 的纯文本（契约 `PluginReadme`，≤65536）：**插件详情「描述」段的首选取值**
   * （用户口径第 20 条：描述应该来自插件的 README）。
   * **为缺失设计**：解码层已把缺席/null/空串归一成「没有这个键」，故这里缺席 ＝ 制品没有 README
   * ＝ 详情那一段回落到上面那一枚短 `description`（`enterpriseMarketPluginDetailBody` 是唯一判定点）；
   * 两者都没有 ⇒ 整段不进 DOM（不画「暂无描述」空壳——那是**行上第二行**的口径）。
   * 它只上**详情**，行上第二行照旧读短 `description`（README 是整篇正文，不适合塞进两行 clamp 的卡片）。
   */
  readonly readme?: string | undefined
  /**
   * 服务端新增的**可选分类**（`category`）——插件行**列表分组**与**筛选类型**的取值（本刀新增）。
   *
   * 与技能行 / 配方行的 `category` **逐字同一口径**：只有解码层真拿到非空串才产出这个键。
   * 渲染层经 `enterpriseMarketCategory` 归一：**不在七类里的一律归「其他」**——行上不显示分类签、
   * 也绝不替服务端编一个分类；「已下架」（目录缺席）的行同样没有分类 ⇒ 归「其他」。
   */
  readonly category?: string | undefined
  /**
   * 目录里这一版**声明的操作系统**（契约三平台名，取值门禁在 `local-api-decode.ts:720`）。
   * **数据面字段：只随行携带，不参与任何判断、也不上屏**——插件行的可拨性与文案与它完全无关
   * （声明含当前平台 / 不含 / 根本没有该字段，三种形态渲染结果逐字相同）。
   */
  readonly operatingSystems?: readonly string[] | undefined
  /** 目录里的安装不可用原因（如不兼容），有则禁安装（原因由唯一提示组件连下一步一起说，不只挂 title）。 */
  readonly installErrorCode?: string | undefined
  /**
   * 目录里这一版制品的体积（契约 `sizeBytes`，目录项上恒有）。
   *
   * **数据面字段**：行上不显示它，只有插件**详情子页面**「大小」那一格读它（本刀把详情接到这一面后
   * 那一格不再缺席）；已下架（目录没有这一条）时自然没有这个键 ⇒ 那一格整格不出，不编造。
   */
  readonly sizeBytes?: number | undefined
  /**
   * 本机记录说的「该装着吗」（`INSTALLED`/`ABSENT`）；无本机记录时 `undefined`。
   *
   * 与下面 `recordVersion` 一起是「**已安装**」那一个判定的两件真源
   * （`plugin-install-gate.ts` 的 `enterprisePluginInstalled`）。上面那枚 `version` 是
   * **目录版本与本机版本归并后**的展示值，不能拿它判装没装：一次失败的首装记录里本机 `version`
   * 是 `null`，而目录里有版本——那一行要给的仍是「重试安装」（【＋】），不是一枚开关。
   */
  readonly desiredState?: 'INSTALLED' | 'ABSENT' | undefined
  /** 本机记录里**已落盘**的版本（`null` = 还没有制品落到本机：进行中 / 失败）。 */
  readonly recordVersion?: string | null | undefined
  /**
   * 这一枚本机**启用着吗**（用户显式停用后为 `false`；无本机记录 / 旧 Host 时按 `true`）。
   *
   * 它是已安装那一行那枚【开关】的 `checked` 真源，**与「装没装」正交**：
   * 装没装由上面两件真源判，启停位只由这一枚说。
   */
  readonly enabled: boolean
}

/** 目录 + 本机态 → 可渲染的「企业插件」行（纯函数，按 packageName 归并，目录顺序优先）。 */
export function enterpriseMarketPluginRows(
  catalog: readonly EnterprisePluginCatalogItem[] = [],
  local: readonly EnterprisePluginItem[] = [],
): EnterpriseMarketPluginRow[] {
  const localByName = new Map(local.map(item => [item.packageName, item]))
  const names = [...new Set([...catalog.map(item => item.packageName), ...localByName.keys()])]
  return names.map((packageName) => {
    const cat = catalog.find(item => item.packageName === packageName)
    const rec = localByName.get(packageName)
    return {
      packageName,
      version: cat?.version ?? rec?.version ?? null,
      state: rec?.state ?? 'EXPECTED',
      inCatalog: cat !== undefined,
      desiredState: rec?.desiredState,
      recordVersion: rec?.version ?? null,
      // 启停位照解码层同一口径：无本机记录 = 未安装（那一行根本不渲染开关），有记录则如实取。
      enabled: rec?.enabled ?? true,
      // 显示名照解码层同一口径：只有真拿到非空串才产出这个键（缺席/null/空串都不产出，
      // 渲染层据此**回退包名**而不是画一条空标题）。目录缺席（已下架）时自然也没有显示名。
      ...(cat?.displayName === undefined ? {} : { displayName: cat.displayName }),
      // 描述照解码层同一口径：只有真拿到非空串才产出这个键（缺席/null/空串都不产出，
      // 界面第二行据此说「暂无描述」而不是画一行空白）。目录缺席（已下架）时自然也没有描述。
      ...(cat?.description === undefined ? {} : { description: cat.description }),
      // 分类（本刀：列表分组 + 筛选类型）照解码层同一口径带上来：只有真拿到非空串才产出这个键。
      // 渲染层把「缺席」与「不在七类里」一并归入「其他」——分类归组是**展示口径**，
      // 故在分组投影里做，不在这一层编造一个「其他」字面（数据层如实保持缺席）。
      ...(cat?.category === undefined ? {} : { category: cat.category }),
      // README（口径 20）同样照解码层同一口径带上来：只有真拿到非空串才产出这个键（缺席/null/空串都不产出）。
      // 它在**详情**里是「描述」段的首选取值，在**行上**不出现（第二行读的仍是上面那枚短 description）。
      ...(cat?.readme === undefined ? {} : { readme: cat.readme }),
      operatingSystems: cat?.operatingSystems,
      installErrorCode: cat?.installErrorCode,
      // 体积同样**照解码层同一口径**带上来：目录项上恒有它，只有目录缺席（已下架）时才没有这个键
      // （详情子页面「大小」那一格据此如实整格不出，绝不编造）。
      ...(cat?.sizeBytes === undefined ? {} : { sizeBytes: cat.sizeBytes }),
    }
  })
}

/**
 * 插件**详情「描述」段的正文**的唯一判定点（纯投影，测试直调）——用户口径第 20 条：
 * 「描述应该来自插件的 README」。
 *
 * ```text
 * ① 有 README（非空白）      ⇒ 用 README（整篇正文，含原始换行与 Markdown 记号）
 * ② 没有 README             ⇒ **回落**到行上第二行那条短 `description`（口径 19 的既有行为，不丢）
 * ③ 两者都没有              ⇒ `undefined` ⇒ 详情里那一整段不进 DOM（不画「暂无描述」空壳）
 * ```
 *
 * 两个分支都过 `plugin-market.tsx` 的**同一枚**归一投影 `enterprisePluginDetailDescription`
 * （它把 `undefined`/`null`/空串/纯空白一律折成 `undefined`，有值则**原样**返回，不 trim、不截断）——
 * 故本函数这里不存在第二套「什么算没有」的口径，README 与短描述的空值语义天然一致。
 *
 * ★README 一律当**数据**：这里只做取值，不解析 Markdown、不查标签、不注入 HTML；
 * 渲染仍是 `pre-wrap` 的纯文本子节点，限长靠详情那一段的高度上限 + 块内滚动（不删字）。
 * **口径 22 起**：正文交给详情那一段之后，**版式**由下面那枚 `enterpriseMarketPluginDetailMarkdown` 决定——
 * 本函数仍然只管「哪一份是正文」，一个字都没改（口径 20 的既有语义与全部用例原样保留）。
 */
export function enterpriseMarketPluginDetailBody(
  readme: string | null | undefined,
  description: string | null | undefined,
): string | undefined {
  return enterprisePluginDetailDescription(readme) ?? enterprisePluginDetailDescription(description)
}

/**
 * 插件**详情「描述」段的版式**的唯一判定点（纯投影，测试直调）——用户口径第 22 条：
 * 「README 渲染成漂亮排版」。
 *
 * ```text
 * ① 有 README（非空白）  ⇒ true  ⇒ 详情那一段按 **Markdown 排版**（`markdown-render.tsx` 的 renderMarkdown）
 * ② 没有 README          ⇒ false ⇒ 回落到短 description，且版式与口径 19/20 **逐字相同**（纯文本，不改）
 * ```
 *
 * 与 `enterpriseMarketPluginDetailBody` **同一枚**归一投影（`enterprisePluginDetailDescription`）判定，
 * 故「正文里出现的是不是 README」与「正文从哪来」不可能各说一套：本函数返回 true 时，正文必然**就是**
 * 那一份 README（两者都只认「非空白才算有值」这一条口径）。
 */
export function enterpriseMarketPluginDetailMarkdown(readme: string | null | undefined): boolean {
  return enterprisePluginDetailDescription(readme) !== undefined
}

/** 「企业插件」节是否该渲染（「插件」组件开启且有目录/本机记录）。 */
export function enterpriseMarketPluginSectionVisible(
  pluginsComponentEnabled: boolean,
  rows: readonly EnterpriseMarketPluginRow[],
): boolean {
  return pluginsComponentEnabled && rows.length > 0
}
/**
 * 一个目录页签内容区的**四态投影**（纯函数，测试直调）：隐藏 / 加载中 / 空 / 失败 / 就绪。
 *
 * 「隐藏」只在对应大组件未开启（会话不可用）时出现——与既有门控一字不变；
 * 一旦组件开启，就**必须**命中其余四态之一：取数期间给轻提示（不空白）、空列表说清为什么空、
 * 失败给人话 + 下一步 + 重试。**失败绝不再回落成空列表**（本刀要消灭的正是 `catch(() => [])` 那个静默）。
 */
export type EnterpriseMarketPanelState =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'loading'; readonly hint: string }
  | { readonly kind: 'empty'; readonly hint: string }
  | { readonly kind: 'failed'; readonly code: string; readonly prefix: string }
  | { readonly kind: 'ready' }

/**
 * 由「组件是否开启 + 列表取数状态 + 行数」投影出一个页签内容区该说什么（纯函数）。
 *
 * `list` 缺席（纯函数直调 / 老调用方）时**严格保持旧口径**：有行就就绪、没有行就隐藏；
 * 真运行时控制器一定会注入 `list`，因此空目录会落到 `empty`（有交代）而不是「什么都没有」。
 */
export function enterpriseMarketPanelState<T>(input: {
  readonly enabled: boolean
  readonly loadingHint: string
  readonly emptyHint: string
  readonly failedPrefix: string
  readonly list?: EnterpriseListState<T> | undefined
  readonly rowCount: number
}): EnterpriseMarketPanelState {
  if (!input.enabled) return { kind: 'hidden' }
  const list = input.list
  if (list === undefined) return input.rowCount > 0 ? { kind: 'ready' } : { kind: 'hidden' }
  if (list.kind === 'loading') return { kind: 'loading', hint: input.loadingHint }
  if (list.kind === 'empty') return { kind: 'empty', hint: input.emptyHint }
  if (list.kind === 'failed') return { kind: 'failed', code: list.code, prefix: input.failedPrefix }
  return { kind: 'ready' }
}

/** 「企业技能」页签取数中的轻提示（首帧就看得见，不空白、不跳版）。 */
export const ENTERPRISE_MARKET_SKILLS_LOADING = '正在加载企业技能…'
/** 「企业技能」页签取数成功但列表为空：说清「为什么空」+ 下一步。 */
export const ENTERPRISE_MARKET_SKILLS_EMPTY = '企业还没有发布任何技能。请联系企业管理员发布，或稍后刷新再看。'
/** 「企业技能」页签取数失败的动作前缀（人话与下一步由 `error-messages.ts` 的唯一映射给）。 */
export const ENTERPRISE_MARKET_SKILLS_FAILED = '技能目录加载失败'
/** 「企业插件」页签取数中的轻提示。 */
export const ENTERPRISE_MARKET_PLUGINS_LOADING = '正在加载企业插件…'
/** 「企业插件」页签取数成功但列表为空。 */
export const ENTERPRISE_MARKET_PLUGINS_EMPTY = '企业还没有发布任何插件。请联系企业管理员发布，或稍后刷新再看。'
/** 「企业插件」页签取数失败的动作前缀。 */
export const ENTERPRISE_MARKET_PLUGINS_FAILED = '插件目录加载失败'

/**
 * 「企业技能」页签的一份取数结果。
 *
 * 主事实是 `rows`（目录 + 已装行的中心当前版本归并后的行投影），`installed` 决定每行开关的 checked。
 * `installedCode` / `detailCode` 是**次级取数降级**的如实交代（旧 Host 没有 `/skills/installed`、
 * 某一行详情没读出来）：目录照列，但界面必须说明「这份事实没读出来」+ 可重试——
 * 绝不 `catch(() => [])` 把失败变成「企业技能 0」或「全部未装」。
 */
export interface EnterpriseSkillCatalog {
  readonly rows: readonly EnterpriseMarketSkillRow[]
  readonly installed: readonly EnterpriseInstalledSkill[]
  /** 本机已装清单这次没读出来（降级为「未知」）：稳定码原样保留。 */
  readonly installedCode?: string | undefined
  /** 至少有一行的中心详情没读出来（该行无法判「有更新」）：稳定码原样保留。 */
  readonly detailCode?: string | undefined
}

/**
 * 「企业技能」页签**唯一**的取数实现（非 React，可注入假 api 直测）。
 *
 * 三条口径：
 *  ① 目录（`skills()`）失败**原样抛出**——由 `createEnterpriseSkillCatalogSource` 收敛成显式失败态，
 *     绝不再回落空目录（改前是 `.catch(() => [] as readonly EnterpriseRuntimeSkill[])`，用户只见「企业技能 0」+ 空白）；
 *  ② 已装清单与逐行详情是**次级事实**，允许降级，但降级要**交出失败码**（`installedCode`/`detailCode`），
 *     由界面如实说明「这份事实没读出来」+ 可重试（`enterpriseDegradedRead` 的显式降级，不是静默默认值）；
 *  ③ 迟到的结果由取数源的代际守卫丢弃（此处只负责把 `signal` 透传给每一个请求）。
 *
 * @param api - 同源本地 API（只用到 `skills`/`installedSkills`/`skillDetail` 三个只读方法）。
 * @param signal - 取数源的取消信号（中止后所有在途请求一并作废）。
 * @returns 行投影 + 已装清单 + 两个次级取数的降级码。
 */
export async function loadEnterpriseSkillCatalog(
  api: Pick<EnterpriseLocalApi, 'skills' | 'installedSkills' | 'skillDetail'>,
  signal: AbortSignal,
): Promise<EnterpriseSkillCatalog> {
  // 两条取数并行：目录是主事实（失败即抛，收敛成失败态），已装清单是次级事实（失败降级 + 记码）。
  const [items, installedRead] = await Promise.all([
    api.skills(signal),
    enterpriseDegradedRead(api.installedSkills(signal), [] as readonly EnterpriseInstalledSkill[]),
  ])
  // 只对**已装行**按需取详情（中心列表投影不带 `versionId`；没有本机版本的未装行无从比较）：
  // 某行详情失败即如实记下失败码（该行不判「有更新」，界面在列表顶部说明这份事实没读全 + 可重试）。
  const detailReads = await Promise.all(installedRead.value.map(record =>
    enterpriseDegradedRead(api.skillDetail(record.packageId, signal), undefined as EnterpriseRuntimeSkill | undefined),
  ))
  const details = detailReads.flatMap(read => (read.value === undefined ? [] : [read.value]))
  const detailCode = detailReads.find(read => read.code !== undefined)?.code
  return {
    rows: enterpriseMarketSkillRows(items, details),
    installed: installedRead.value,
    ...(installedRead.code === undefined ? {} : { installedCode: installedRead.code }),
    ...(detailCode === undefined ? {} : { detailCode }),
  }
}

/**
 * 「企业技能」页签的取数源（唯一实例由控制器持有；组件只是它的订户）。
 * 重试 = `source.retry()`，**真的重发**目录 + 已装 + 详情（见 `tests/list-state.spec.ts` 的请求计数取证）。
 */
export function createEnterpriseSkillCatalogSource(
  api: Pick<EnterpriseLocalApi, 'skills' | 'installedSkills' | 'skillDetail'>,
): EnterpriseListSource<EnterpriseSkillCatalog> {
  return createEnterpriseListSource<EnterpriseSkillCatalog>({
    load: signal => loadEnterpriseSkillCatalog(api, signal),
    isEmpty: catalog => catalog.rows.length === 0,
  })
}

/** 没有 store（卡片视图 / 纯函数直调）时 `useSyncExternalStore` 用的恒定快照与空订阅：引用必须稳定。 */
const ENTERPRISE_MARKET_CATALOG_LOADING: EnterpriseListState<EnterpriseSkillCatalog> = { kind: 'loading' }
const ENTERPRISE_MARKET_CATALOG_SNAPSHOT = (): EnterpriseListState<EnterpriseSkillCatalog> => ENTERPRISE_MARKET_CATALOG_LOADING
const ENTERPRISE_MARKET_CATALOG_SUBSCRIBE = (): (() => void) => () => undefined

/**
 * 没有 store 时**配方**取数源那份恒定的「加载中」快照（引用必须稳定，`useSyncExternalStore` 的要求）。
 * 与技能那份分开是因为两者的 `T` 不同（技能是目录 + 已装 + 降级码，配方是配方列表原样）。
 */
const ENTERPRISE_MARKET_PRESET_LOADING: EnterpriseListState<readonly EnterpriseRuntimePreset[]> = { kind: 'loading' }
const ENTERPRISE_MARKET_PRESET_SNAPSHOT = (): EnterpriseListState<readonly EnterpriseRuntimePreset[]> => ENTERPRISE_MARKET_PRESET_LOADING

/** 没有注入资料库管理门（纯函数直调 / 老调用方）时用的恒定快照与空订阅：按产品默认**关**，引用必须稳定。 */
const ENTERPRISE_MARKET_LIBRARY_GATE_SNAPSHOT: EnterpriseLibraryGateSnapshot = {
  enabled: ENTERPRISE_LIBRARY_GATE_DEFAULT,
  persisted: false,
  saving: false,
}
const ENTERPRISE_MARKET_LIBRARY_GATE_GET_SNAPSHOT = (): EnterpriseLibraryGateSnapshot => ENTERPRISE_MARKET_LIBRARY_GATE_SNAPSHOT
const ENTERPRISE_MARKET_LIBRARY_GATE_SUBSCRIBE = (): (() => void) => () => undefined

/**
 * 「企业技能」节的一行：企业后台上传的技能包。
 * 版式 = **官方插件清单卡片**（参考对象 jingyun 的卡片结构）：标题行（displayName + 版本签 + 分类签
 * + 状态点 + 一枚「已装/未装」标签）+ 始终可见的描述行（官方 12/18、两行 clamp）+ 卡片内**常显**的动作条
 * （[有更新时的辅助动作] [官方 Switch]，开关是主控件）与紧随其后的失败提示。
 * **卡片不折叠**：展开区与 chevron 已移除——展开区里原先只有对用户近乎无用的 `skillId` 和两个真正的动作，
 * 而动作藏进一次点击之后、列表又只有 3–5 行，折叠在这里没有意义（用户裁决）。故动作直接常显在卡片上。
 * 不再堆状态点 + 元信息。「复制装配指令」仍是「技能」tab 的第二条路，这里给的是「一键落盘」。
 */
export interface EnterpriseMarketSkillRow {
  /** 技能包雪花 id，同时是详情取数键（`store.api.skillDetail(id)`）与安装动作入参。 */
  readonly id: string
  /** manifest.json 的稳定标识（kebab-case 等），进 `data-enterprise-skill-id`。 */
  readonly skillId: string
  readonly displayName: string
  /** 空描述归一为固定占位，与技能 tab 详情弹窗同一句话。 */
  readonly description: string
  /**
   * **列表投影里就有**的 DSH 来源版本（`EnterpriseRuntimeSkill.sourceDshVersion`，形如 `0.1.7-rc.3`）：
   * 它就是「企业技能」行**标题行**紧跟标题那枚**版本签**的取值，**不需要任何服务端改动**。
   * 解码层已保证它是非空串，故行上恒带；万一为空则不出这枚签（`enterpriseMarketSkillVersionTag`）。
   */
  readonly sourceDshVersion: string
  /**
   * 服务端新增的**可选分类**（`category`，列表与详情投影都会有）。**为缺失设计**：解码层已把
   * 缺席 / null / 空串一律归一成「没有这个键」，故这里缺席 ＝ 没有分类 ＝ 标题行不出分类签
   * （安静缺席是预期行为，绝不塞占位文案、也不猜分类）。
   */
  readonly category?: string
  /**
   * 中心当前版本的 `versionId`（判定「有更新」的另一侧）。**列表投影不带这个字段**——`skill-api-decode`
   * 的列表解码把 `versionId` 写死为空串，只有 `GET /skills/{id}` 详情投影才是真值；故由 hook 入口
   * **只对已装行**逐个取详情后经 `enterpriseMarketSkillRows(skills, details)` 按 id 归并进来。
   * 取不到/失败即空串 ＝ 该行不判更新（宁可少说一句，也不猜「有更新」）。
   */
  readonly latestVersionId: string
}

/**
 * 技能目录 → 可渲染的「企业技能」行（纯函数，按目录顺序原样投影，**不做任何过滤**）。
 * 后台分配（预置）的技能全都要列出来，装没装只影响该行右侧那枚开关的 checked，不影响这行出不出现。
 * 版本签直接取列表投影的 `sourceDshVersion`，分类签取可选字段 `category`（有非空值才产出该键）。
 * @param skills - `store.api.skills()` 的列表投影（摘要；`versionId` 恒为空串）。
 * @param details - 可选的中心详情投影（`store.api.skillDetail(id)`），只用来补中心当前版本；
 *   按 id 归并，缺该行详情即留空串——未装行不需要它（没有本机版本可比）。
 */
export function enterpriseMarketSkillRows(
  skills: readonly EnterpriseRuntimeSkill[] = [],
  details: readonly EnterpriseRuntimeSkill[] = [],
): EnterpriseMarketSkillRow[] {
  const latestById = new Map(details.map(detail => [detail.id, detail.versionId]))
  return skills.map(skill => ({
    id: skill.id,
    skillId: skill.skillId,
    displayName: skill.displayName,
    description: skill.description === '' ? '（暂无描述）' : skill.description,
    sourceDshVersion: skill.sourceDshVersion,
    // 分类照解码层同一口径：只有非空串才产出这个键（缺席/null/空串都不产出，界面据此不出分类签）。
    ...(skill.category !== undefined && skill.category !== '' ? { category: skill.category } : {}),
    latestVersionId: latestById.get(skill.id) ?? '',
  }))
}

/**
 * 行上 `sourceDshVersion` 的**完整来源坐标**投影（行上签的 `title` 与详情页那枚徽标用它）。
 * 真实导入的技能，这个字段是完整坐标（形如 `skillhub.cn/dev-expert@2.0.3`），**不加 `v` 前缀**——
 * `v{version}` 是本入口 badge 槽的口径（`enterpriseMarketVersionTag`），这里照字段原值说，不造第二套字面。
 * 行上签的**可见文案**是它的短号（`enterpriseMarketSkillVersionLabel`）：短号给列表、完整坐标给
 * 悬浮说明（签上 `title`）与详情（信息更全）。
 * @param sourceDshVersion - 行上的 `sourceDshVersion`。
 * @returns 完整坐标；空串返回 undefined（不渲染空签，也不塞占位）。
 */
export function enterpriseMarketSkillVersionTag(sourceDshVersion: string): string | undefined {
  return sourceDshVersion === '' ? undefined : sourceDshVersion
}

/**
 * 行**标题行版本签的可见短号**（用户裁决：卡片标签只显示版本）。
 * 真实导入的 `sourceDshVersion` 是完整坐标（`skillhub.cn/dev-expert@2.0.3`），整串显示会把标题挤成一个字
 * （真机 chrome 截图已证），故行上只显示版本身份那一段：
 * **含 `@` → 取最后一个 `@` 之后的部分；不含 `@` → 原样返回**（`0.1.7-rc.4` 这类既有技能显示形式一字不变）。
 * 边界都有确定行为：空串 → undefined；仅 `@` 或以 `@` 结尾（尾段为空）→ undefined（不渲染空药丸）；
 * 多个 `@` → 取最后一个之后的段；不做 trim（尾段原样，投影是纯文本映射、不猜业务）。
 * 完整坐标不丢——它挂在签外包装节点的 `title` 上（悬停可见），详情子页面照旧整串显示。
 * @param sourceDshVersion - 行上的完整 `sourceDshVersion`。
 * @returns 版本短号；没有可显示的版本段时返回 undefined。
 */
export function enterpriseMarketSkillVersionLabel(sourceDshVersion: string): string | undefined {
  if (sourceDshVersion === '') return undefined
  const at = sourceDshVersion.lastIndexOf('@')
  const label = at === -1 ? sourceDshVersion : sourceDshVersion.slice(at + 1)
  return label === '' ? undefined : label
}

/**
 * 「企业技能」行**标题行**分类签的可见文案。
 * **为缺失设计**：字段尚未上线时这里恒得 undefined，分类签就安静缺席（预期行为）——绝不塞占位文案、不猜分类。
 * 这是标题行标签的**最后一道防线**：解码层已把 null/空串归一为缺席，这里再兜一次 `undefined`/`null`/纯空白，
 * 使「直接构造行」的调用方也不会画出空药丸。分类名不做任何加工，原值照说。
 * @param category - 行上的可选分类（`EnterpriseMarketSkillRow.category`）。
 * @returns 标签文案；没有分类返回 undefined。
 */
export function enterpriseMarketSkillCategoryTag(category: string | null | undefined): string | undefined {
  if (category === undefined || category === null) return undefined
  return category.trim() === '' ? undefined : category
}

/**
 * 「企业技能」行现在的受管态（与 `data-enterprise-skill-state` 同源）：
 * `AVAILABLE` 未装可装、`INSTALLED` 已落盘且与中心同版本、`UPDATE_AVAILABLE` 已落盘但中心有别的版本、
 * `INSTALLING`/`REMOVING` 动作在途。
 * 它就是那两枚控件的口径：`INSTALLED`/`UPDATE_AVAILABLE`（卸载在途时也是）→ 开关 `checked`，
 * 两个在途态 → 开关 `disabled`；辅助标签只在 `UPDATE_AVAILABLE` 的**事实**（见 `enterpriseMarketSkillRowHasUpdate`）上出现。
 */
export type EnterpriseMarketSkillState = 'AVAILABLE' | 'INSTALLED' | 'UPDATE_AVAILABLE' | 'INSTALLING' | 'REMOVING'

/** 开关左侧那枚辅助标签唯一的可见文案（改文案只改这一处；其余态由 Switch + 状态点表达，不再各造一枚签）。 */
export const ENTERPRISE_MARKET_SKILL_UPDATE_LABEL = '有更新'

/** 辅助标签的 `data-enterprise-skill-tag` 取值：这枚按钮的身份就是「更新」。 */
export const ENTERPRISE_MARKET_SKILL_UPDATE_TAG = 'UPDATE_AVAILABLE'

/** 「企业技能」行当前在途的动作：行键 + 方向（`true` = 安装/更新、`false` = 卸载），与 hook 入口的 `pendingSkill` 同形。 */
export interface EnterpriseMarketSkillPending {
  readonly packageId: string
  readonly next: boolean
}

/**
 * 本机已装记录与中心当前版本是否不一致（=「有更新」）。
 * 两侧都必须拿得到非空 `versionId` 才判：未装、详情没取到（旧 Host 没有详情路由）都返回 false——不猜版本。
 * 比的是 `versionId` 而不是 `sha256`：`sha256` 按本包契约在解码时校验形状后即丢（`skill-api-decode`
 * 的「sha256 不出界面」同策），本层能拿到的版本身份只有这一份 `versionId`。
 * @param installedVersionId - 本机已装记录的 `versionId`（`EnterpriseInstalledSkill.versionId`）。
 * @param latestVersionId - 中心当前版本的 `versionId`（行上的 `latestVersionId`）。
 * @returns 是否有更新。
 */
export function enterpriseMarketSkillHasUpdate(installedVersionId: string, latestVersionId: string): boolean {
  return installedVersionId !== '' && latestVersionId !== '' && installedVersionId !== latestVersionId
}

/**
 * 某一行是否「有更新」：先按行键命中 Host 回传的已装记录，再比两侧 `versionId`。
 * 这是辅助标签出现与否的**唯一判定点**（与 `enterpriseMarketSkillState` 共用，禁止另写一份）。
 * @param installedSkills - Host 回传的已装记录（缺席＝全部未装，界面不猜）。
 * @param row - 已投影的目录行（带中心当前版本）。
 * @returns 是否有更新。
 */
export function enterpriseMarketSkillRowHasUpdate(
  installedSkills: readonly EnterpriseInstalledSkill[] | undefined,
  row: EnterpriseMarketSkillRow,
): boolean {
  const record = installedSkills?.find(item => item.packageId === row.id)
  return record !== undefined && enterpriseMarketSkillHasUpdate(record.versionId, row.latestVersionId)
}

/**
 * 开关左侧那枚辅助标签的可渲染投影（文案 / 无障碍名 / 悬浮说明一次产出）。
 * 它**不是**主控件——主控件始终是右侧那枚官方 `Switch`；这枚标签只在「有更新」时补一条
 * 「把本机旧版本换成中心当前版本」的快捷路。
 */
export interface EnterpriseMarketSkillUpdateTag {
  /** 可见文案，恒为 `ENTERPRISE_MARKET_SKILL_UPDATE_LABEL`。 */
  readonly label: string
  /** 无障碍名（动作语义，读屏与键盘听到的就是它）。 */
  readonly ariaLabel: string
  /** 悬浮说明：点它 = 更新到中心当前版本。 */
  readonly title: string
}

/**
 * 技能名 → 辅助标签投影。
 * @param displayName - 技能显示名，进无障碍名。
 * @returns 标签投影（在途时的 `disabled` 由渲染层按 `pendingSkill` 给，不在这里混说状态）。
 */
export function enterpriseMarketSkillUpdateTag(displayName: string): EnterpriseMarketSkillUpdateTag {
  return {
    label: ENTERPRISE_MARKET_SKILL_UPDATE_LABEL,
    ariaLabel: `更新企业技能 ${displayName}`,
    title: '点此更新到中心当前版本',
  }
}

/**
 * 一行技能包当前的受管态（唯一判定点，纯函数直调可测）。
 * 优先级：在途 > 未装 > 有更新 > 已装——在途时界面只说「正在进行、先别拨」，不混说版本。
 * @param installedSkills - Host 回传的已装记录（缺席＝全部未装，界面不猜）。
 * @param pending - 当前在途动作；命中本行时按方向出 `INSTALLING`/`REMOVING`。
 * @param row - 已投影的目录行（带中心当前版本）。
 * @returns 受管态。
 */
export function enterpriseMarketSkillState(
  installedSkills: readonly EnterpriseInstalledSkill[] | undefined,
  pending: EnterpriseMarketSkillPending | undefined,
  row: EnterpriseMarketSkillRow,
): EnterpriseMarketSkillState {
  if (pending?.packageId === row.id) return pending.next ? 'INSTALLING' : 'REMOVING'
  if (installedSkills?.some(item => item.packageId === row.id) !== true) return 'AVAILABLE'
  return enterpriseMarketSkillRowHasUpdate(installedSkills, row) ? 'UPDATE_AVAILABLE' : 'INSTALLED'
}

/**
 * 技能行受管态 → 官方 `StateDot` 语义（它就是标题行那枚状态点的唯一映射点）：
 * 已装 `done` / 有更新 `warning`（要人注意，但还不是失败）/ 未装 `idle`（没有活动的事实）/ 在途 `ongoing`（旋转弧）。
 * 在途用 `ongoing` 是**我们补的短板**：官方与参考对象都只画静态点，我们让「安装中/卸载中」在标题行就能看出来。
 */
export function enterpriseMarketSkillDot(state: EnterpriseMarketSkillState): StateDotState {
  if (state === 'INSTALLED') return 'done'
  if (state === 'UPDATE_AVAILABLE') return 'warning'
  if (state === 'INSTALLING' || state === 'REMOVING') return 'ongoing'
  return 'idle'
}

/**
 * 状态点旁那行可见状态文案（官方 `StateDot` 是 `aria-hidden`，文档要求「与文字配对」）。
 * **安静态不出文字**：`AVAILABLE`/`INSTALLED` 的事实已由那枚「启用/已装」标签说清，再写一遍就是噪音；
 * 只有「有更新」与两个在途态（用户此刻最需要知道的）才补一行文字。
 * @param state - 行受管态。
 * @returns 文案；安静态返回 undefined（不渲染、也不塞占位）。
 */
export function enterpriseMarketSkillStatusLabel(state: EnterpriseMarketSkillState): string | undefined {
  if (state === 'UPDATE_AVAILABLE') return '有更新'
  if (state === 'INSTALLING') return '安装中'
  if (state === 'REMOVING') return '卸载中'
  return undefined
}

/**
 * 标题行那枚「启用/已装」标签的渲染投影（照参考对象的 `configTag data-enabled`，视觉改用官方 `Tag` 原语）。
 * 它是**只读事实**：`enabled` 同时给 `data-enterprise-row-enabled` 与 `Switch.checked` 用，避免两处各判一次。
 */
export interface EnterpriseMarketConfigTag {
  /** 事实：该行是否已落盘/已启用（技能=已装，插件=ACTIVE）。 */
  readonly enabled: boolean
  /** 可见文案。 */
  readonly label: string
  /** 官方 `Tag` 的调色（已启用 `success`，否则 `neutral`）——不自定义颜色。 */
  readonly tone: 'success' | 'neutral'
}

/** 技能行的「已装/未装」标签：在途（安装中）与卸载在途分别落到 未装/已装，与 `Switch.checked` 同源。 */
export function enterpriseMarketSkillConfigTag(state: EnterpriseMarketSkillState): EnterpriseMarketConfigTag {
  const enabled = state === 'INSTALLED' || state === 'UPDATE_AVAILABLE' || state === 'REMOVING'
  return { enabled, label: enabled ? '已装' : '未装', tone: enabled ? 'success' : 'neutral' }
}

/** 企业插件行的「已启用/未启用」标签：只有本机 `ACTIVE` 才算已启用（在途/等待重启/失败都不是）。 */
export function enterpriseMarketPluginConfigTag(enabled: boolean): EnterpriseMarketConfigTag {
  // 词表只有一处：`plugin-install-gate.ts` 的 `enterprisePluginEnabledLabel`（「已启用 / 已停用」）。
  // 原先这里自己写一套 `state === 'ACTIVE' ? '已启用' : '未启用'`，就是同一件事的第二套说法（已退场）。
  return { enabled, label: enterprisePluginEnabledLabel(enabled), tone: enabled ? 'success' : 'neutral' }
}

/** 「企业技能」节是否该渲染（「技能」组件开启且目录非空），与企业插件节同规则。 */
export function enterpriseMarketSkillSectionVisible(
  skillsComponentEnabled: boolean,
  rows: readonly EnterpriseMarketSkillRow[],
): boolean {
  return skillsComponentEnabled && rows.length > 0
}

/**
 * 一节当前是否展开（照官方 `PluginInventorySettingsTab` 的 `searching || (open ?? false)`：
 * 官方搜索时强制展开，我们当前无搜索故退化为 `open ?? defaultOpen`）。
 * 页签化后只剩「组件」页签内部的组件清单还问这个问题（企业技能/企业插件两节的显隐已由页签承担）。
 * @param expandedSections - 当前折叠态（缺席＝按 `defaultOpen`，测试直调不传即得完整树）。
 * @param section - 节 id（现在只有 `'components'`）。
 * @param defaultOpen - 缺席时的默认展开值。
 * @returns 是否展开。
 */
export function enterpriseMarketSectionOpen(
  expandedSections: Record<EnterpriseMarketSectionId, boolean> | undefined,
  section: EnterpriseMarketSectionId,
  defaultOpen = false,
): boolean {
  if (expandedSections === undefined) return defaultOpen
  return expandedSections[section]
}

/** 企业插件受管态 → 官方 StateDot 语义（已装绿/进行中蓝/等待或失败红棕/其余灰）。 */
export function enterprisePluginDot(state: ManagedPluginState): StateDotState {
  if (state === 'ACTIVE') return 'done'
  if (state === 'FAILED') return 'error'
  if (state === 'DOWNLOADING' || state === 'INSTALLING' || state === 'REMOVING') return 'ongoing'
  if (state === 'RESTART_REQUIRED' || state === 'REMOVE_PENDING' || state === 'ROLLBACK') return 'warning'
  return 'idle'
}

/**
 * 企业插件行状态点旁那行可见状态文案（插件侧口径与技能侧同：安静态不出文字）。
 * 文案仍取自本仓唯一那份官方状态词表 `enterprisePluginStatePresentation`（不新造第二套说法）：
 * `ACTIVE`（已启用标签已说清）与 `EXPECTED`（未启用标签已说清）不出文字，其余（在途/等待重启/失败）如实出。
 * @param state - 本机受管态。
 * @returns 文案；两个安静态返回 undefined。
 */
export function enterpriseMarketPluginStatusLabel(state: ManagedPluginState): string | undefined {
  return state === 'ACTIVE' || state === 'EXPECTED' ? undefined : enterprisePluginStatePresentation(state).title
}

/** 入口卡片与详情页描述行共用的一句话。 */
export const enterpriseMarketEntrySummary = (): string => ENTERPRISE_MARKET_SUMMARY

/** 详情页预留的页签清单，按交付顺序。 */
export const enterpriseMarketEntryPlan = (): typeof ENTERPRISE_MARKET_PLAN => ENTERPRISE_MARKET_PLAN

/** 组件清单原样投影，按交付顺序。 */
export const enterpriseMarketComponents = (): typeof ENTERPRISE_MARKET_COMPONENTS => ENTERPRISE_MARKET_COMPONENTS

/** 组件行开关的归属：企业会话（登录后可用）或**本机设置**（资料库那条，默认关）。 */
export type EnterpriseMarketComponentGate = 'session' | 'local'

/** 组件状态行的可见文案：预留 → 预留；可用 → 可用；本机开关关着 → 未开启；否则 → 需登录。 */
export type EnterpriseMarketComponentState = '预留' | '可用' | '需登录' | '未开启'

/** 某一行的开关归属（id 不认识时 undefined）。 */
export function enterpriseMarketComponentGate(id: string): EnterpriseMarketComponentGate | undefined {
  return ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)?.gate
}

/** 每行组件当前是否可用（配方恒预留不可用；资料库随**本机设置**；插件与技能行随企业会话真值）。 */
export function enterpriseMarketComponentEnabled(id: string, sessionUsable: boolean, libraryEnabled = false): boolean {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined || row.reserved) return false
  if (row.gate === 'local') return libraryEnabled
  return sessionUsable
}

/** 组件状态行的可见文案（唯一口径，逐行独立）：预留 / 可用 / 未开启 / 需登录。 */
export function enterpriseMarketComponentState(
  id: string,
  sessionUsable: boolean,
  libraryEnabled = false,
): EnterpriseMarketComponentState {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined || row.reserved) return '预留'
  if (row.gate === 'local') return libraryEnabled ? '可用' : '未开启'
  return sessionUsable ? '可用' : '需登录'
}

/** 组件状态点：只有「可用」是 done，其余（预留 / 未开启 / 需登录）都是 idle（照官方 StateDot 语义）。 */
export function enterpriseMarketComponentDot(id: string, sessionUsable: boolean, libraryEnabled = false): StateDotState {
  return enterpriseMarketComponentState(id, sessionUsable, libraryEnabled) === '可用' ? 'done' : 'idle'
}

/**
 * 组件行开关是否禁用。三类口径：
 *  · 预留行恒禁用（配方：没有可拨的东西）；
 *  · **本机设置行**（资料库）：写入口缺席时禁用（不给死开关），写入在途时禁用（官方 `Switch` 的口径：在途不许连点），
 *    **写失败后不禁用**——再拨一次就是重试；
 *  · 企业会话行：回调缺席或已可用时禁用（防假切换；登录态本身在「企业设置」里改）。
 */
export function enterpriseMarketComponentSwitchDisabled(
  id: string,
  sessionUsable: boolean,
  hasLoginAction: boolean,
  libraryEnabled = false,
  hasLibraryAction = false,
  librarySaving = false,
): boolean {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined || row.reserved) return true
  if (row.gate === 'local') return !hasLibraryAction || librarySaving
  if (!hasLoginAction) return true
  return sessionUsable
}

/**
 * 组件行开关的悬浮说明（唯一口径）：说清这枚开关管什么、为什么点不动。
 * 文案与状态词**同源**（都从 id + 会话真值 + 本机开关真值算），不各写一份。
 */
export function enterpriseMarketComponentSwitchTitle(
  id: string,
  sessionUsable: boolean,
  libraryEnabled = false,
  librarySaving = false,
): string {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined) return ''
  if (row.reserved) return `预留：${row.label}暂未接入`
  if (row.gate === 'local') {
    if (librarySaving) return '正在保存到本机设置'
    return libraryEnabled ? '资料库入口已打开，可在左侧进入' : '打开后左侧会出现「资料库」入口'
  }
  return sessionUsable ? '请在企业账号中退出登录' : '登录企业账号后启用'
}

/**
 * 计数摘要四段：总数 / 可用 / 未开启 / 预留，照官方 `partsSummary` 的口径拆段。
 * 「未开启」这一段是**本机开关那条的可见交代**（默认即最佳，但默认值必须看得见）。
 */
export function enterpriseMarketComponentSummary(
  rows: readonly { readonly id: string }[] = ENTERPRISE_MARKET_COMPONENTS,
  sessionUsable = false,
  libraryEnabled = false,
): EnterpriseMarketSummary {
  const present = rows.filter(row => ENTERPRISE_MARKET_COMPONENTS.some(item => item.id === row.id))
  const count = (state: EnterpriseMarketComponentState): number =>
    present.filter(row => enterpriseMarketComponentState(row.id, sessionUsable, libraryEnabled) === state).length
  return { total: present.length, ready: count('可用'), off: count('未开启'), reserved: count('预留') }
}

/** 计数摘要四段拼成一行，照官方 `partsSummary` 的「共 N 个 · N 可用 · N 未开启 · N 预留」口径（为零的段不出现）。 */
export function enterpriseMarketComponentSummaryText(
  rows: readonly { readonly id: string }[] = ENTERPRISE_MARKET_COMPONENTS,
  sessionUsable = false,
  libraryEnabled = false,
): string {
  const summary = enterpriseMarketComponentSummary(rows, sessionUsable, libraryEnabled)
  return [
    `共 ${summary.total} 个`,
    summary.ready > 0 ? `${summary.ready} 可用` : '',
    summary.off > 0 ? `${summary.off} 未开启` : '',
    summary.reserved > 0 ? `${summary.reserved} 预留` : '',
  ].filter(Boolean).join(' · ')
}
/**
 * 组件清单行的渲染投影（组件节每行 + 该行的启用/状态/状态点/开关禁用/开关悬浮说明）。
 * 外壳只消费这个投影结果，故「仅配方 reserved」「本机开关没开＝未开启」「未登录则需登录」三条口径不可能分叉。
 */
export interface EnterpriseMarketComponentRow {
  readonly id: string
  readonly label: string
  readonly module: string
  readonly note: string
  readonly reserved: boolean
  /** 这枚开关归谁管（`session` 企业会话 / `local` 本机设置）——渲染层据此决定 `onChange` 走哪一条动作。 */
  readonly gate: EnterpriseMarketComponentGate
  readonly enabled: boolean
  readonly state: EnterpriseMarketComponentState
  readonly dot: StateDotState
  readonly switchDisabled: boolean
  /** 开关的悬浮说明（唯一口径：`enterpriseMarketComponentSwitchTitle`）。 */
  readonly switchTitle: string
}

/** 一个页签的渲染真源：id + 基础词 + 计数 + 最终文案（文案 = `enterpriseMarketTabLabel(label, count)`）。 */
export interface EnterpriseMarketTabEntry {
  readonly id: EnterpriseMarketTabId
  readonly label: string
  readonly count: number
  readonly text: string
}

/**
 * 两套外壳**共用的同一份模型**：props → 外壳需要的一切派生事实（组件行、目录门控、页签文案与计数、过滤后的可见行、折叠态）。
 * 它是「逻辑只保留一份」的**可测证明点**：两套外壳都只调它，因此「页签计数不一致 / 门控不一致 / 过滤口径不一致」
 * 不需要靠人工对齐——结构上只有这一处可改（纯函数、无 hook、无状态，测试可对同一组输入逐字段比对）。
 */
export interface EnterpriseMarketShellModel {
  /** 当前选中的页签（`props.activeTab` 缺席即 `ENTERPRISE_MARKET_DEFAULT_TAB`）。 */
  readonly activeTab: EnterpriseMarketTabId
  /** 会话可用性（`props.sessionUsable` 缺席即 false）。 */
  readonly sessionUsable: boolean
  /** 组件清单四行（含状态点、开关禁用口径与开关悬浮说明）。 */
  readonly componentRows: readonly EnterpriseMarketComponentRow[]
  /** 「组件」页签是否展开（唯一还带折叠语义的一节）。 */
  readonly componentsOpen: boolean
  /** 折叠回调是否接通（缺席时不给死按钮）。 */
  readonly canToggleSection: boolean
  /** 组件节计数摘要（共 N 个 · N 可用 · N 未开启 · N 预留）。 */
  readonly componentSummaryText: string
  /** 资料库开关最近一次本机设置失败（稳定码）；没有失败就没有这个键（组件行据此渲染唯一提示组件 + 重试）。 */
  readonly libraryError?: string | undefined
  /** 资料库开关失败的重试是否接通（缺席即不渲染重试按钮——不给死按钮）。 */
  readonly canRetryLibrary: boolean
  /** 三个页签的文案与计数。 */
  readonly tabEntries: readonly EnterpriseMarketTabEntry[]
  /** 页签计数按 id 查（与 `tabEntries[].count` 同源，HERO 的两枚 chip 也取它）。 */
  readonly tabCounts: Record<EnterpriseMarketTabId, number>
  /** 「企业技能」页签门控通过（技能组件开启**且**目录非空）。 */
  readonly skillsVisible: boolean
  /** 「企业插件」页签门控通过（插件组件开启**且**目录非空）。 */
  readonly pluginsVisible: boolean
  /** 「企业配方」页签门控通过（配方组件开启**且**目录非空）——与另两个目录页签同一条口径。 */
  readonly presetsVisible: boolean
  /** 「企业技能」页签内容区此刻该画什么（隐藏 / 加载中 / 空 / 失败 / 就绪——四态互斥）。 */
  readonly skillsPanel: EnterpriseMarketPanelState
  /** 「企业插件」页签内容区此刻该画什么（同上）。 */
  readonly pluginsPanel: EnterpriseMarketPanelState
  /** 「企业配方」页签内容区此刻该画什么（同上）。 */
  readonly presetsPanel: EnterpriseMarketPanelState
  /** 实际渲染的技能行（= 目录经搜索/状态/类型三道过滤后的可见行，顺序＝目录顺序）。 */
  readonly visibleSkills: readonly EnterpriseMarketSkillRow[]
  /** 实际渲染的插件行（同上）。 */
  readonly visiblePlugins: readonly EnterpriseMarketPluginRow[]
  /** 实际渲染的配方行（同上）。 */
  readonly visiblePresets: readonly EnterpriseMarketPresetRow[]
  /** 技能可见行按七类分好的组（只含非空组，顺序＝七类顺序）。 */
  readonly skillGroups: readonly EnterpriseMarketCategoryGroup<EnterpriseMarketSkillRow>[]
  /** 插件可见行按七类分好的组（同上）。 */
  readonly pluginGroups: readonly EnterpriseMarketCategoryGroup<EnterpriseMarketPluginRow>[]
  /** 配方可见行按七类分好的组（同上）。 */
  readonly presetGroups: readonly EnterpriseMarketCategoryGroup<EnterpriseMarketPresetRow>[]
  /** 这一帧是否真的在过滤（搜索非空 / 状态非「全部」/ 类型非「全部类型」）——空态文案据此二选一。 */
  readonly filtering: boolean
}

/**
 * 两套外壳的唯一逻辑入口（纯函数）。装配顺序：组件行 → 目录门控 → 搜索过滤 → 页签计数。
 * @param props - 两套外壳共用的 `EnterpriseMarketShellProps`。
 * @returns 外壳渲染需要的全部派生事实。
 */
export function enterpriseMarketShellModel(props: EnterpriseMarketShellProps): EnterpriseMarketShellModel {
  const sessionUsable = props.sessionUsable ?? false
  const hasLoginAction = typeof props.onOpenLogin === 'function'
  // 本机开关（资料库）的三件事实：当前值、是否正在写、写入口是否接通。
  // 缺席（纯函数直调 / 老调用方）即按产品默认**关**，且开关禁用（没有写入口就绝不画一枚能拨的开关）。
  const libraryEnabled = props.libraryGate?.enabled ?? ENTERPRISE_LIBRARY_GATE_DEFAULT
  const librarySaving = props.libraryGate?.saving ?? false
  const hasLibraryAction = typeof props.onToggleLibrary === 'function'
  const enterprisePlugins = props.enterprisePlugins ?? []
  const enterpriseSkills = props.enterpriseSkills ?? []
  const enterprisePresets = props.enterprisePresets ?? []
  const componentRows: EnterpriseMarketComponentRow[] = ENTERPRISE_MARKET_COMPONENTS.map(row => ({
    ...row,
    enabled: enterpriseMarketComponentEnabled(row.id, sessionUsable, libraryEnabled),
    state: enterpriseMarketComponentState(row.id, sessionUsable, libraryEnabled),
    dot: enterpriseMarketComponentDot(row.id, sessionUsable, libraryEnabled),
    switchDisabled: enterpriseMarketComponentSwitchDisabled(
      row.id,
      sessionUsable,
      hasLoginAction,
      libraryEnabled,
      hasLibraryAction,
      librarySaving,
    ),
    switchTitle: enterpriseMarketComponentSwitchTitle(row.id, sessionUsable, libraryEnabled, librarySaving),
  }))
  // 两个目录页签的门控同规则：只在对应大组件开启（= 会话可用）且目录非空时出内容。
  const skillsEnabled = enterpriseMarketComponentEnabled('skills', sessionUsable)
  const pluginsEnabled = enterpriseMarketComponentEnabled('plugins', sessionUsable)
  // 「企业配方」页签与它们**同一条**门控口径（配方行已由 reserved:true 改 false：它是已交付的页签，不是预留件）。
  const presetsEnabled = enterpriseMarketComponentEnabled('presets', sessionUsable)
  const skillsVisible = enterpriseMarketSkillSectionVisible(skillsEnabled, enterpriseSkills)
  const pluginsVisible = enterpriseMarketPluginSectionVisible(pluginsEnabled, enterprisePlugins)
  const presetsVisible = presetsEnabled && enterprisePresets.length > 0
  // 内容区四态：组件未开启 → 隐藏（既有门控一字不变）；开启后取数状态说话——加载中/空/失败/就绪各有一态，
  // 失败态与空态**绝不混同**（失败要人话 + 下一步 + 重试，空要说清为什么空）。
  const skillsPanel = enterpriseMarketPanelState<EnterpriseSkillCatalog>({
    enabled: skillsEnabled,
    loadingHint: ENTERPRISE_MARKET_SKILLS_LOADING,
    emptyHint: ENTERPRISE_MARKET_SKILLS_EMPTY,
    failedPrefix: ENTERPRISE_MARKET_SKILLS_FAILED,
    rowCount: enterpriseSkills.length,
    list: props.skillsListState,
  })
  const pluginsPanel = enterpriseMarketPanelState<readonly EnterpriseMarketPluginRow[]>({
    enabled: pluginsEnabled,
    loadingHint: ENTERPRISE_MARKET_PLUGINS_LOADING,
    emptyHint: ENTERPRISE_MARKET_PLUGINS_EMPTY,
    failedPrefix: ENTERPRISE_MARKET_PLUGINS_FAILED,
    rowCount: enterprisePlugins.length,
    list: props.pluginsListState,
  })
  // 配方页签的四态与另两个目录页签**同一条**规则（三句文案直接取设置弹窗那一份）。
  const presetsPanel = enterpriseMarketPanelState<readonly EnterpriseMarketPresetRow[]>({
    enabled: presetsEnabled,
    loadingHint: ENTERPRISE_MARKET_PRESETS_LOADING,
    emptyHint: ENTERPRISE_MARKET_PRESETS_EMPTY,
    failedPrefix: ENTERPRISE_MARKET_PRESETS_FAILED,
    rowCount: enterprisePresets.length,
    list: props.presetsListState,
  })
  // ── 真过滤（用户裁决「真过滤」）＋ 分类分组（用户裁决：严格七类，未命中进「其他」） ──────────
  // 过滤与分组**只在这一处**做，`visible*` 是列表唯一消费的可见行；分组再按七类切。
  // 三道条件：① 搜索（标题/描述/标识的子串，大小写不敏感）② 状态（已启用/已停用）③ 类型（七类之一）。
  // 状态口径**逐页签走各自的 row facts**（`enabled` 是「这一行现在处于启用中」的唯一真源，
  // 三套 facts 都已算好）——不在这里另写第二份「什么叫启用」，也不跨页签借字段。
  const statusFilter: EnterpriseMarketStatusFilter = props.filterStatus ?? 'all'
  const categoryFilter: EnterpriseMarketCategory | 'all' = props.filterCategory ?? 'all'
  const searchText = props.searchText ?? ''
  const enabledOnly = statusFilter === 'all' ? undefined : statusFilter === 'enabled'
  const passStatus = (enabled: boolean): boolean => enabledOnly === undefined || enabled === enabledOnly
  const visibleSkills = enterpriseSkills.filter(skill => (
    passStatus(enterpriseMarketSkillRowFacts(props, skill).enabled)
    && (categoryFilter === 'all' || enterpriseMarketCategory(skill.category) === categoryFilter)
    && enterpriseMarketSearchMatch(searchText, [skill.displayName, skill.description, skill.skillId])
  ))
  const visiblePlugins = enterprisePlugins.filter(plugin => (
    passStatus(enterpriseMarketPluginRowFacts(props, plugin).enabled)
    && (categoryFilter === 'all' || enterpriseMarketCategory(plugin.category) === categoryFilter)
    && enterpriseMarketSearchMatch(searchText, [
      enterprisePluginDisplayName(plugin.displayName, plugin.packageName),
      plugin.description,
      plugin.packageName,
    ])
  ))
  const visiblePresets = enterprisePresets.filter(preset => (
    passStatus(enterpriseMarketPresetRowFacts(props, preset).enabled)
    && (categoryFilter === 'all' || enterpriseMarketCategory(preset.category) === categoryFilter)
    && enterpriseMarketSearchMatch(searchText, [preset.displayName, preset.description, preset.presetId])
  ))
  // 过滤是否真的动过：决定空态那句说「没有匹配」还是「目录为空」（两件事必须分得清）。
  const filtering = searchText.trim() !== '' || statusFilter !== 'all' || categoryFilter !== 'all'
  // 分组：只保留非空组，组头顺序恒为七类顺序。
  const skillGroups = enterpriseMarketCategoryGroups(visibleSkills, row => row.category)
  const pluginGroups = enterpriseMarketCategoryGroups(visiblePlugins, row => row.category)
  const presetGroups = enterpriseMarketCategoryGroups(visiblePresets, row => row.category)
  // 页签计数取该页签**真正要渲染的行数**：目录门控不过即如实记 0，绝不在面板空白时还喊「有 N 条」。
  const tabCounts: Record<EnterpriseMarketTabId, number> = {
    skills: skillsVisible ? enterpriseSkills.length : 0,
    plugins: pluginsVisible ? enterprisePlugins.length : 0,
    presets: presetsVisible ? enterprisePresets.length : 0,
    components: ENTERPRISE_MARKET_COMPONENTS.length,
  }
  return {
    activeTab: props.activeTab ?? ENTERPRISE_MARKET_DEFAULT_TAB,
    sessionUsable,
    componentRows,
    componentsOpen: enterpriseMarketSectionOpen(props.expandedSections, 'components', true),
    canToggleSection: typeof props.onToggleSection === 'function',
    componentSummaryText: enterpriseMarketComponentSummaryText(componentRows, sessionUsable, libraryEnabled),
    ...(props.libraryGate?.errorCode === undefined ? {} : { libraryError: props.libraryGate.errorCode }),
    canRetryLibrary: typeof props.onRetryLibrarySave === 'function',
    tabEntries: ENTERPRISE_MARKET_TABS.map(tab => ({
      id: tab.id,
      label: tab.label,
      count: tabCounts[tab.id],
      text: enterpriseMarketTabLabel(tab.label, tabCounts[tab.id]),
    })),
    tabCounts,
    skillsVisible,
    pluginsVisible,
    presetsVisible,
    skillsPanel,
    pluginsPanel,
    presetsPanel,
    visibleSkills,
    visiblePlugins,
    visiblePresets,
    skillGroups,
    pluginGroups,
    presetGroups,
    filtering,
  }
}

/**
 * 技能行的**同一份**派生事实（两套外壳共用；行版式不同但事实完全相同）。
 * 「受管态 → 开关 checked」「受管态 → 在途禁用」「有更新」三条都只在这里算一次：
 * 旧外壳的官方两行卡片与新外壳的可展开卡片都读它，故两边不可能各判一套。
 */
export interface EnterpriseMarketSkillRowFacts {
  /** 行键（`{页签}:{行 id}`）。**去折叠后两套外壳都不再消费它**，作为共享层（控制器 `expandedRow` + 行键投影）的一份保留事实。 */
  readonly rowKey: string
  /** 展开区容器 id（行 id 已归一成安全字符）。**去折叠后没有展开区**，同为共享层的保留事实（纯投影仍可用）。 */
  readonly detailsId: string
  /** 该行此刻是否展开（`expandedRow` 缺席视为全开）。**去折叠后两套外壳都不再消费它**，保留给共享层。 */
  readonly open: boolean
  /** 受管态（`AVAILABLE`/`INSTALLED`/`UPDATE_AVAILABLE`/`INSTALLING`/`REMOVING`）。 */
  readonly state: EnterpriseMarketSkillState
  /** 「已装/未装」标签投影（新外壳的 Tag 用它，文案与 tone 都从这一份来）。 */
  readonly config: EnterpriseMarketConfigTag
  /** 开关与「已装/未装」标签同源的事实：`config.enabled`。 */
  readonly enabled: boolean
  /** 官方 `StateDot` 语义（新外壳的行尾状态点用它：已装 done / 有更新 warning / 未装 idle / 在途 ongoing）。 */
  readonly dot: StateDotState
  /** 在途（安装中/卸载中）：开关与辅助动作都禁用，但辅助动作**不消失**。 */
  readonly busy: boolean
  /** 是否「有更新」（两侧 `versionId` 都拿得到且不等）。 */
  readonly hasUpdate: boolean
  /** 辅助动作的文案投影（文案/无障碍名/悬浮说明）。 */
  readonly updateTag: EnterpriseMarketSkillUpdateTag
  /**
   * **完整来源坐标**（`sourceDshVersion` 原值；空串即 undefined = 不渲染）。行上签的 `title` 与详情页
   * 那枚徽标用它——行上签的**可见文案**是下面的短号，完整坐标因此不会因为「只显示版本」而丢失。
   */
  readonly versionTag: string | undefined
  /** 标题行版本签的**可见短号**（最后一个 `@` 之后那段；见 `enterpriseMarketSkillVersionLabel`；无版本段即 undefined）。 */
  readonly versionLabel: string | undefined
  /** 标题行分类签的可见文案（缺席/null/空串即 undefined = 整枚不渲染）。 */
  readonly categoryTag: string | undefined
}

/**
 * 技能行 facts 的唯一入口。
 * @param props - 共享 props（要 `installedSkills`/`pendingSkill`/`expandedRow`）。
 * @param row - 已投影的目录行（带中心当前版本）。
 * @returns 该行在两套外壳里共用的事实。
 */
export function enterpriseMarketSkillRowFacts(props: EnterpriseMarketShellProps, row: EnterpriseMarketSkillRow): EnterpriseMarketSkillRowFacts {
  const state = enterpriseMarketSkillState(props.installedSkills, props.pendingSkill, row)
  const rowKey = enterpriseMarketRowKey('skills', row.id)
  return {
    rowKey,
    detailsId: enterpriseMarketRowDetailsId('skills', row.id),
    open: enterpriseMarketRowOpen(props.expandedRow, rowKey),
    state,
    // 开关的 checked 与「已装/未装」标签**同源**：只有一个判定点（`enterpriseMarketSkillConfigTag`）。
    config: enterpriseMarketSkillConfigTag(state),
    enabled: enterpriseMarketSkillConfigTag(state).enabled,
    dot: enterpriseMarketSkillDot(state),
    busy: state === 'INSTALLING' || state === 'REMOVING',
    hasUpdate: enterpriseMarketSkillRowHasUpdate(props.installedSkills, row),
    updateTag: enterpriseMarketSkillUpdateTag(row.displayName),
    versionTag: enterpriseMarketSkillVersionTag(row.sourceDshVersion),
    versionLabel: enterpriseMarketSkillVersionLabel(row.sourceDshVersion),
    categoryTag: enterpriseMarketSkillCategoryTag(row.category),
  }
}

/**
 * 企业插件行的**同一份**派生事实（两套外壳共用）。
 * 「开关 checked / 开关禁用 / 状态点 / 状态文案」四条都只在这里算一次：旧外壳的「状态点 + 官方状态词恒出」
 * 与新外壳的「状态点 + 一枚 Tag + 安静态不出文字」读的是同一批事实，只对**呈现**做各自的选择。
 */
export interface EnterpriseMarketPluginRowFacts {
  readonly rowKey: string
  readonly detailsId: string
  readonly open: boolean
  /** 这一行给哪一枚控件：未安装 ⇒ `'install'`（＋）；已安装 ⇒ `'switch'`（启用/停用）。 */
  readonly slot: EnterprisePluginRowAction
  /** 「这一行装没装」——分流的真源（`plugin-install-gate.ts` 的唯一判定）。 */
  readonly installed: boolean
  /** 这一枚的**启停位**（开关的 `checked`；未安装的行不渲染开关，这一枚恒 `true`）。 */
  readonly enabled: boolean
  /** 官方 `StateDot` 语义（已装 done / 失败 error / 在途 ongoing / 等待 warning / 其余 idle）。 */
  readonly dot: StateDotState
  /** 「已启用/已停用」标签投影（新外壳的 Tag 用它）。 */
  readonly config: EnterpriseMarketConfigTag
  /** 需要人留意时的可见状态文案（安静态 undefined；新外壳用）。 */
  readonly statusLabel: string | undefined
  /** 官方状态词表的原值（旧外壳的落点：状态点旁**恒**出一行文案，安静态也说）。 */
  readonly stateTitle: string
  /**
   * 开关是否禁用（无回调 / 在途 / 等重启 / 别的操作用着）。
   * 口径收敛到 `enterprisePluginLockReason` 那**唯一一处**判定，行内开关与「企业设置 → 插件」不会分叉。
   * **目录判定不在这条路上**：已安装的行即使企业目录里已下架/判不可安装，也要能停用。
   */
  readonly switchDisabled: boolean
  /**
   * 【＋】是否禁用（未安装那一格）：比开关多**一条**——目录判定（不可安装就不给装）。
   * 两支各自一个字段而不是共用一个布尔：它们的成因集合真的不同（见 `plugin-install-gate.ts`）。
   */
  readonly installDisabled: boolean
  /** 禁用的原因（`undefined` = 可拨）；它决定可见那一句话与悬浮说明取哪条。 */
  readonly lockReason: EnterprisePluginLockReason | undefined
  /** 禁用原因的**可见**一句话；`undefined` = 没有要说的（可拨，或原因由唯一提示组件说）。 */
  readonly lockNotice: string | undefined
  /** 开关的悬浮说明（补充，不替代可见那一句）。 */
  readonly switchTitle: string
  /** 【＋】的悬浮说明（同上，它是图标按钮，语义主要靠无障碍名）。 */
  readonly installTitle: string
  /** 【＋】的无障碍名（唯一一份口径在 gate 叶里）。 */
  readonly installLabel: string
  /**
   * 这一行**此刻**的安装/卸载/启用/停用进度（`undefined` = 没有工序在进行）。
   *
   * 它是 `plugin-install-progress.ts` 的**唯一**投影产物：只给真阶段 + 不确定态指示，绝无百分比；
   * `progress.phase === 'pending'` = 请求刚提交、Host 还没报到在途阶段。同一份 facts 供「企业设置 → 插件」
   * 的卡片行与详情弹窗读，故两处不可能各说一套进度。
   */
  readonly progress: EnterprisePluginProgress | undefined
  /** 刚结束那一次动作（装 / 卸 / 启用 / 停用）的落地交代（命中本行才有一句）；`undefined` = 没有要说的。 */
  readonly settledNotice: string | undefined
}

/**
 * 插件行 facts 的唯一入口。
 *
 * **与系统声明无关**：目录行带的 `operatingSystems` 只随行携带、不参与这里的任何一步，
 * 所以「声明含当前平台 / 不含 / 根本没有该字段」三种形态在这一行上渲染结果逐字相同。
 *
 * **本刀（动作分流）**：`slot`（未安装 ⇒ ＋ / 已安装 ⇒ 开关）由 gate 叶的唯一判定算一次，
 * 行上只照它渲染；两块禁用口径各自成字段（`installDisabled` 含目录判定、`switchDisabled` 不含）。
 *
 * @param props - 共享 props（要 `onInstallPlugin`/`onTogglePluginEnabled`/`sessionUsable`，进度还要 `pluginBusy`/`pluginSettled`/`pluginProgressErrorCode`）。
 * @param row - 目录 + 本机态归并后的插件行。
 * @returns 该行在两套外壳里共用的事实。
 */
export function enterpriseMarketPluginRowFacts(
  props: EnterpriseMarketShellProps,
  row: EnterpriseMarketPluginRow,
): EnterpriseMarketPluginRowFacts {
  const rowKey = enterpriseMarketRowKey('plugins', row.packageName)
  // 启停位同样**为缺失设计**：旧 Host 的投影 / 测试里直接构造的行不带这个键 ⇒ 按「启用」归一
  // （缺省就是启用）。客户端**绝不**从 `state` 反推它（那是本项目已经清掉的第二套口径）。
  const pluginEnabled = row.enabled ?? true
  const config = enterpriseMarketPluginConfigTag(pluginEnabled)
  const installed = enterprisePluginInstalled({
    desiredState: row.desiredState,
    version: row.recordVersion,
    state: row.state,
  })
  const slot: EnterprisePluginRowAction = installed ? 'switch' : 'install'
  // 两块禁用口径各自一处：＋ 那一格看「写入口在不在 / 目录判定 / 在途」，
  // 开关那一格**不**看目录判定（不可安装 ≠ 不能停用，停用是用户的自救动作）。
  // **不**传 `fatal`/`busy`/`restartPending`——这一节的「目录取数失败」有自己的面板失败态
  // （`enterpriseMarketPanelState`，`failed` 时整段不铺行，见 `enterpriseMarketLegacyShell`），
  // 压根到不了「行上一个禁用控件」。
  const installLockReason = enterprisePluginLockReason({
    hasAction: props.onInstallPlugin !== undefined,
    state: row.state,
    installErrorCode: row.installErrorCode,
  })
  const switchLockReason = enterprisePluginLockReason({
    hasAction: props.onTogglePluginEnabled !== undefined,
    state: row.state,
  })
  // 可见那一句按**这一行实际给的那枚控件**取：未安装的行说的是「为什么不能装」，
  // 已安装的行说的是「为什么不能停用」——两者不会串台（原先这里是两支 `??` 连挂）。
  const lockReason = slot === 'switch' ? switchLockReason : installLockReason
  const stateTitle = enterprisePluginStatePresentation(row.state).title
  // 进度与交代都只经那**一份**投影：阶段文字取自上面那枚官方状态词表（全仓唯一一份状态词），
  // 故「行上状态词」与「安装中阶段文字」永远同一个词，不可能一个说「正在下载」另一个说「下载中」。
  const progress = enterprisePluginProgress({
    packageName: row.packageName,
    busy: props.pluginBusy,
    state: row.state,
    stageText: stateTitle,
    readErrorCode: props.pluginProgressErrorCode,
    // 取消在途那份事实也进来：它决定那一行的取消按钮是「可点」还是「正在取消…（不可用）」。
    cancelBusy: props.pluginCancelBusy,
  })
  const settledNotice = enterprisePluginSettledNotice({
    packageName: row.packageName,
    settled: props.pluginSettled,
  })
  /**
   * 只在**已经落地**的那一格（`ACTIVE`）把可见状态词收敛成「已安装 · 已启用 / 已停用」。
   *
   * 其余受管态一律让唯那份官方状态词表说话（「正在安装」「处理失败」「等待重启」…）——
   * 那些态说的是**工序**，被「已安装」盖掉就把失败读成了正常。
   */
  const installedStatusLabel = installed && row.state === 'ACTIVE'
    ? enterprisePluginInstalledStatusLabel(pluginEnabled)
    : undefined
  return {
    rowKey,
    detailsId: enterpriseMarketRowDetailsId('plugins', row.packageName),
    open: enterpriseMarketRowOpen(props.expandedRow, rowKey),
    slot,
    installed,
    enabled: pluginEnabled,
    dot: enterprisePluginDot(row.state),
    config,
    // 已安装那一行的可见状态词收敛成「已安装 · 已启用 / 已停用」——与「企业设置 → 插件」
    // 卡片行页脚读的是**同一枚**投影（`enterprisePluginInstalledStatusLabel`），不会再一处说
    // 「已启用」另一处说「已安装」；未安装那一格照旧出官方状态词表里的「未安装」。
    statusLabel: installedStatusLabel ?? enterpriseMarketPluginStatusLabel(row.state),
    stateTitle: installedStatusLabel ?? stateTitle,
    switchDisabled: switchLockReason !== undefined,
    installDisabled: installLockReason !== undefined,
    lockReason,
    lockNotice: enterprisePluginLockNotice(lockReason),
    switchTitle: enterprisePluginSwitchTitle({ enabled: pluginEnabled, lockReason: switchLockReason }),
    installTitle: enterprisePluginInstallTitle({
      lockReason: installLockReason,
      installErrorCode: row.installErrorCode,
    }),
    installLabel: enterprisePluginInstallLabel(row.packageName),
    progress,
    settledNotice,
  }
}

/**
 * **插件详情子页面**的输入（用户口径第 16 条）—— 纯数据，页面由外壳渲染。
 *
 * 为什么不是直接把 `EnterprisePluginDetailPage` 的那一整份 props 摊在这里：详情那一件的**每一条事实**
 * 都要么来自行投影（`row`）、要么来自行 facts（`facts`）——控制器只交这两件**行上同一份**真值，
 * 剩下三件（版本那一格的文案 / 门禁那一格的文案 / 返回与取消两枚写入口）由外壳在渲染时确定地投影出来。
 * 于是「详情与行同源」是结构性的：详情里读的 `facts` 就是行上那一份，不存在第二个副本。
 */
export interface EnterprisePluginPageProps {
  /** 详情那一行的**当前**投影（控制器从当前目录投影里按包名 `find`，目录刷新后不停在旧副本上）。 */
  readonly row: EnterpriseMarketPluginRow
  /** 行 facts（与行上**同一个**入口 `enterpriseMarketPluginRowFacts` 算出的同一份事实）。 */
  readonly facts: EnterpriseMarketPluginRowFacts
  /** 详情「企业版本」那一格的取值（纯投影 `enterprisePluginCatalogVersionText` 算出后传进来）。 */
  readonly catalogVersionText: string
  /** 【返回】的唯一动作（清掉详情目标即回列表）。 */
  readonly onBack: () => void
  /** 进度条上那枚真取消入口（与行上同一个写入口）；缺席即整枚不画。 */
  readonly onCancelInstall?: ((packageName: string) => void) | undefined
  /** 详情容器（进入详情时那个程序化聚焦的落点范围）。 */
  readonly pageRef?: Ref<HTMLDivElement> | undefined
}

/* ══════════════════════════ 企业配方（第三枚目录页签 + 一键启用） ══════════════════════════
 *
 * 与「企业设置 → 配方」那个 tab（`preset-market.tsx`）的**共用面**只有三处，且每处都只有一份实现：
 *   ① 目录取数 = `createEnterprisePresetListSource`（那个 tab 用的**同一个工厂**；它自带一枚
 *      `createEnterpriseLocalApi()` 实例、本页用共享 store 的那一枚，两者都打同一条同源路径
 *      `/enterprise/api/v1/local/presets`）；
 *   ② 导入指令 = `buildPresetImportInstruction`（同一句指令；本页只在**第三级兜底**时复制，正文不上屏）；
 *   ③ 加载/空/失败三句文案 = 那三个 `ENTERPRISE_PRESET_LIST_*` 常量。
 *
 * **本刀（真开关 + 授权弹层 + 三级降级链）**：配方行的动作区由「复制导入指令」这条唯一的药丸
 * 换成与技能/插件行同款的官方 `Switch`，并把三条本机子路径（`status` / `enable` / `disable`）接起来。
 * 三级降级链与「为什么走了这条路」的可见说明见 `enterprisePresetFallbackPlan`。
 */

/** 「企业配方」页签的三条取数文案：直接复用设置弹窗那一份（同一个页签不许在商店里说第二套话）。 */
export const ENTERPRISE_MARKET_PRESETS_LOADING = ENTERPRISE_PRESET_LIST_LOADING
export const ENTERPRISE_MARKET_PRESETS_EMPTY = ENTERPRISE_PRESET_LIST_EMPTY
export const ENTERPRISE_MARKET_PRESETS_FAILED = ENTERPRISE_PRESET_LIST_FAILED

/** 第三级兜底那枚按钮的两种文案（复制成功与否的可见反馈）。 */
export const ENTERPRISE_PRESET_COPY_TEXT = '复制导入指令'
export const ENTERPRISE_PRESET_COPIED_TEXT = '已复制'

/* ─────────────────────────── 三级降级链（用户指定的下限） ───────────────────────────
 *
 * 口径来源：`docs/plan/enterprise-presets.md` 末尾附录「动作区必须是一键安装，下限是跳新会话并填入指令」。
 *   ① 一键安装（行上那枚真开关 → `POST /presets/<id>/enable`）
 *   ② 一键安装不可用时：跳到新会话并把导入指令**填进输入框**（用户只需按发送）
 *   ③ 复制到剪贴板（**只能是第三级**）
 * 每级之间切换必须**可见说明为什么走了这条路**（不静默降级）。
 */

/** 降级链的三级；数字即优先级（① 最优）。 */
export const ENTERPRISE_PRESET_FALLBACK_LEVELS = ['one-click', 'new-session', 'clipboard'] as const
export type EnterprisePresetFallbackLevel = typeof ENTERPRISE_PRESET_FALLBACK_LEVELS[number]

/** 第二级 / 第三级那两枚按钮的可见文案（唯一实现，行上与详情里共用）。 */
export const ENTERPRISE_PRESET_NEW_SESSION_TEXT = '在新会话里打开'
export const ENTERPRISE_PRESET_NEW_SESSION_LABEL = '新建会话并填入导入指令'
export const ENTERPRISE_PRESET_COPY_LABEL = '复制企业配方的导入指令'

/** 走了第二级时的可见说明（模板里 `{reason}` 是一键启用不可用的原因）。 */
export function enterprisePresetNewSessionReason(reason: string): string {
  return `一键启用暂时不可用（${reason}）。已改为在新会话里填入导入指令，你只需按发送。`
}

/** 走了第三级时的可见说明。 */
export function enterprisePresetClipboardReason(reason: string): string {
  return `一键启用与新建会话都不可用（${reason}）。已改为复制导入指令，请粘贴给助手。`
}

/**
 * 三级降级链的**唯一**决策点（纯函数、无 React、可直接直调）。
 *
 * 判定顺序写死为 ① → ② → ③：**只要有一键安装就不降级**（哪怕 ② 也可用）；
 * 只有 ① 不可用才看 ②，只有 ② 也不可用才落到 ③。`reason` 只填**第一枚**导致降级的硬原因，
 * 界面把它原样拼进可见说明里——因此每一级都有「为什么走了这条路」这一手事实，不存在静默降级。
 */
export interface EnterprisePresetFallbackPlan {
  readonly level: EnterprisePresetFallbackLevel
  /** 一键启用不可用的硬原因（`level === 'one-click'` 时为 undefined）。 */
  readonly reason: string | undefined
  /** 那一级的可见说明（`level === 'one-click'` 时不渲染任何降级说明）。 */
  readonly note: string | undefined
}

export function enterprisePresetFallbackPlan(input: {
  /** 一键启用这条链是否真的可用（端口在 + 路由被 Host 认 + 上一次失败不是终态）。 */
  readonly oneClickAvailable: boolean
  /** 一键启用不可用的原因（人话，一句话）。 */
  readonly oneClickReason?: string | undefined
  /** 第二级（跳新会话并填入指令）是否接通。 */
  readonly newSessionAvailable: boolean
  /** 第三级（复制到剪贴板）是否接通。 */
  readonly clipboardAvailable: boolean
}): EnterprisePresetFallbackPlan {
  const reason = input.oneClickReason ?? '当前版本暂不支持在这台设备上一键启用'
  if (input.oneClickAvailable) return { level: 'one-click', reason: undefined, note: undefined }
  if (input.newSessionAvailable) {
    return { level: 'new-session', reason, note: enterprisePresetNewSessionReason(reason) }
  }
  if (input.clipboardAvailable) {
    return { level: 'clipboard', reason, note: enterprisePresetClipboardReason(reason) }
  }
  // 三级全不可用：仍然是**显式**的说明，绝不留一枚点了没反应的按钮。
  return {
    level: 'clipboard',
    reason,
    note: `一键启用与新建会话都不可用（${reason}），这台设备上也复制不了。请联系企业管理员。`,
  }
}

/**
 * 路由/端口级「一键启用不在这台设备上」的稳定码集合。
 *
 * 只有这几种才算**结构性不可用**（该走降级链）；安装/卸载失败（`ENT_PRESET_INSTALL_FAILED` 等）
 * 是**可重试**的运行时失败，仍留在第一级让员工「再拨一次即重试」（D1 第 4 条）。
 */
const ENTERPRISE_PRESET_ROUTE_UNSUPPORTED_CODES: readonly string[] = [
  // Host 那条子路径没接线（`dispatchPresetAction` 对缺席端口如实按非法请求拒）→ 400。
  'ENT_INVALID_REQUEST',
  // 这条配方在本机没有可用的落点（路由/制品都不在）→ 404。
  'ENT_RESOURCE_NOT_FOUND',
]

/** 这个码是否说明「这台设备上的一键启用整条链没接通」（而不是一次可重试的失败）。 */
export function enterprisePresetRouteUnsupported(code: string | undefined): boolean {
  return code !== undefined && ENTERPRISE_PRESET_ROUTE_UNSUPPORTED_CODES.includes(code)
}

/**
 * 两枚「下一步是员工重新确认」的授权码。
 *
 * 它们在 `error-messages.ts` 里是 `retryable: false`（同样的请求再发一次必然还是被拒），
 * 但这不是「一键启用不可用」——第一级自己就有重确认的流程（弹层）。
 * 把它们算进降级链会把员工从「重新确认」直接甩到复制指令，那是把可恢复的状态说成不可用。
 */
const ENTERPRISE_PRESET_RECONFIRM_CODES: readonly string[] = [
  'ENT_PRESET_AUTHORIZATION_REQUIRED',
  'ENT_PRESET_AUTHORIZATION_STALE',
]

/** 配方详情的面包屑：可见文案照官方 `crumbText`（列表名），无障碍名给完整动作语义。 */
export const ENTERPRISE_PRESET_DETAIL_BACK_TEXT = '配方列表'
export const ENTERPRISE_PRESET_DETAIL_BACK_LABEL = '返回配方列表'
/** 配方详情里「这份配方包含」那一节的标题（用户指定的措辞）。 */
export const ENTERPRISE_PRESET_CONTENTS_TITLE = '这份配方包含'
/** 详情取数中的轻提示（首帧就看得见，不空白）。 */
export const ENTERPRISE_PRESET_CONTENTS_LOADING = '正在读取配方详情…'
/**
 * **字段缺席时的如实交代**：服务端 runtime 投影的 `dependencies` 这一刀正在落地（解码器那一路在改），
 * 这份界面按「可能还没有这个字段」防御性处理——读不到就说这句话，**绝不白屏、也绝不假装「不包含」**。
 */
export const ENTERPRISE_PRESET_CONTENTS_UNAVAILABLE = '暂时无法读取包含内容'
/** 详情读到了、字段也在，但这条配方确实没有依赖：如实说「不包含」而不是留白。 */
export const ENTERPRISE_PRESET_CONTENTS_EMPTY = '这份配方不包含技能或插件'
/** 包含内容读取失败的前缀（人话与下一步由唯一映射 `error-messages.ts` 给）。 */
export const ENTERPRISE_PRESET_DETAIL_FAILED = '配方详情加载失败'
/** 依赖项的「必需 / 可选」两种可见文案（只认服务端给的 `required` 布尔，不猜）。 */
export const ENTERPRISE_PRESET_DEPENDENCY_REQUIRED = '必需'
export const ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL = '可选'

/**
 * 依赖类型 → 分组标签。`kind` 是服务端字段，界面只认识 `skill`/`plugin` 两种；
 * **未知类型归入「其它」而不是被静默丢掉**（丢了就是假数据：界面会显得这份配方什么都没有）。
 */
export const ENTERPRISE_PRESET_DEPENDENCY_LABELS = { skill: '技能', plugin: '插件', other: '其它' } as const
export type EnterprisePresetContentsGroupKind = keyof typeof ENTERPRISE_PRESET_DEPENDENCY_LABELS

/**
 * 一条配方的「包含内容」依赖项（服务端 runtime 投影 `dependencies` 的条目）。
 *
 * **为字段缺席/形状变化设计**：解码这一路正在给员工端加这个键名，故本页从 `unknown` 结构读它，
 * 不在类型上绑死（不假设它一定会来、也不假设不会有第三种 `kind`）。
 *
 * 与解码层那份契约投影（`local-api-decode.ts` 的 `EnterprisePresetDependency`，`kind`/`mode` 是**闭合**联合）
 * 有意不同：这里是**展示层的加宽形态**（`kind`/`mode` 都是 `string`）。理由正是解码器自己那条注释里的教训
 * （「员工端比服务端严 ⇒ 静默炸」）：服务端若先多出一种 `kind`，解码那层会先拒；而**万一**有一份没走解码的
 * 对象到了这里，界面也必须**显示得出来**（归入「其它」）而不是崩掉、更不是把这条依赖静默丢掉。
 */
export interface EnterpriseMarketPresetDependency {
  /** 服务端给的类型（`skill`/`plugin`；未知值原样保留，由分组投影归入「其它」）。 */
  readonly kind: string
  /** 依赖的身份标识（技能标识 / 插件包名），就是界面上要显示的那串。 */
  readonly id: string
  /** 服务端给的取用方式（`pinned`/`latest`）；本页不上屏，但**原样保留**这份事实不丢。 */
  readonly mode: string
  /** 固定版本时的版本标识（只有 `mode === 'pinned'` 才有）；缺席即没有这个键。 */
  readonly versionId?: string | undefined
  /** 是否必需（只有**严格等于 `true`** 才算必需：服务端字段缺席/异常时不猜、按「可选」如实呈现）。 */
  readonly required: boolean
}

/** 读配方详情对象上的 `dependencies` 原始值（`undefined` = 字段缺席 / 根本不是对象）。 */
function enterprisePresetDependenciesField(preset: unknown): unknown {
  if (preset === null || typeof preset !== 'object') return undefined
  return (preset as { readonly dependencies?: unknown }).dependencies
}

/** 配方的可选分类（服务端**可能**新增的 `category`）：缺席/null/空白一律归一成「没有这个键」。 */
export function enterprisePresetCategory(preset: unknown): string | undefined {
  if (preset === null || typeof preset !== 'object') return undefined
  const value = (preset as { readonly category?: unknown }).category
  // 与技能行的分类签**同一个归一投影**（`enterpriseMarketSkillCategoryTag`）：不新造第二份分类口径。
  return typeof value === 'string' ? enterpriseMarketSkillCategoryTag(value) : undefined
}

/**
 * 一份配方的依赖清单（纯投影，**字段缺席按空数组看待**，测试可直调）。
 *
 * 三条口径：
 *  ① `dependencies` 缺席 / 不是数组 / 条目形状不对 → 返回空数组（**不抛、不编**：界面另有「读不到」的如实交代）；
 *  ② 只收「有非空字符串 `id`」的条目——没有身份的东西不上屏（也进不了分组）；
 *  ③ `kind`/`mode`/`versionId` 原样保留、`required` 只认严格 `true`（界面据此说「必需/可选」，不猜）。
 */
export function enterprisePresetDependencies(preset: unknown): readonly EnterpriseMarketPresetDependency[] {
  const field = enterprisePresetDependenciesField(preset)
  if (!Array.isArray(field)) return []
  const dependencies: EnterpriseMarketPresetDependency[] = []
  for (const entry of field as readonly unknown[]) {
    if (entry === null || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const id = item['id']
    if (typeof id !== 'string' || id === '') continue
    const versionId = item['versionId']
    dependencies.push({
      kind: typeof item['kind'] === 'string' ? item['kind'] : '',
      id,
      mode: typeof item['mode'] === 'string' ? item['mode'] : '',
      ...(typeof versionId === 'string' && versionId !== '' ? { versionId } : {}),
      required: item['required'] === true,
    })
  }
  return dependencies
}

/** 依赖清单里的一组（同一 `kind` 归一组，组内保持服务端给的顺序）。 */
export interface EnterprisePresetContentsGroup {
  readonly kind: EnterprisePresetContentsGroupKind
  readonly label: string
  readonly items: readonly EnterpriseMarketPresetDependency[]
}

/**
 * 依赖清单 → 分组（纯投影）：**技能一组、插件一组**，其余类型归「其它」一组；
 * 组序恒为 技能 → 插件 → 其它，空组不出现。未知类型因此**不会被丢掉**（丢掉就是假数据）。
 */
export function enterprisePresetContentsGroups(
  dependencies: readonly EnterpriseMarketPresetDependency[],
): readonly EnterprisePresetContentsGroup[] {
  return (['skill', 'plugin', 'other'] as const)
    .map(kind => ({
      kind,
      label: ENTERPRISE_PRESET_DEPENDENCY_LABELS[kind],
      items: dependencies.filter(item => (kind === 'other'
        ? item.kind !== 'skill' && item.kind !== 'plugin'
        : item.kind === kind)),
    }))
    .filter(group => group.items.length > 0)
}

/** 「这份配方包含」那一节的四态（纯投影，测试可直调）：读取中 / 读不到 / 确实不包含 / 有分组。 */
export type EnterprisePresetContentsState =
  | { readonly kind: 'loading'; readonly hint: string }
  | { readonly kind: 'unavailable'; readonly hint: string }
  | { readonly kind: 'empty'; readonly hint: string }
  | { readonly kind: 'available'; readonly groups: readonly EnterprisePresetContentsGroup[]; readonly count: number }

/**
 * 由「详情是否在途 + 详情取数结果」投影出「这份配方包含」这一节该说什么（纯函数）。
 *
 * 判定顺序写死为 **没取到 → 字段缺席/形状不对 → 空 → 有分组**：
 *  · 详情还没到（在途）→ 轻提示；详情没取到且不在途（失败 / 未发请求）→ 「暂时无法读取包含内容」；
 *  · 详情到了但 `dependencies` 这个键**缺席**（解码这一路还没带上它）或不是数组 → 同样如实说「暂时无法读取包含内容」，
 *    **绝不**把那当成「这条配方什么都不包含」（那是编造）；
 *  · 详情到了、字段也在、确实是空数组 → 说「这份配方不包含技能或插件」。
 */
export function enterprisePresetContentsState(input: {
  readonly loading: boolean
  readonly detail?: unknown | undefined
}): EnterprisePresetContentsState {
  if (input.detail === undefined || input.detail === null) {
    return input.loading
      ? { kind: 'loading', hint: ENTERPRISE_PRESET_CONTENTS_LOADING }
      : { kind: 'unavailable', hint: ENTERPRISE_PRESET_CONTENTS_UNAVAILABLE }
  }
  if (!Array.isArray(enterprisePresetDependenciesField(input.detail))) {
    return { kind: 'unavailable', hint: ENTERPRISE_PRESET_CONTENTS_UNAVAILABLE }
  }
  const dependencies = enterprisePresetDependencies(input.detail)
  if (dependencies.length === 0) return { kind: 'empty', hint: ENTERPRISE_PRESET_CONTENTS_EMPTY }
  return { kind: 'available', groups: enterprisePresetContentsGroups(dependencies), count: dependencies.length }
}

/** 节头右那枚计数文案（只在这一节真的有分组时出现）。 */
export function enterprisePresetContentsCountText(count: number): string {
  return `共 ${count} 项`
}

/** 一条依赖项的「必需 / 可选」可见文案（唯一判定点：只有严格 `true` 才是必需）。 */
export function enterprisePresetDependencyRequiredText(required: boolean): string {
  return required ? ENTERPRISE_PRESET_DEPENDENCY_REQUIRED : ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL
}

/**
 * 「企业配方」节的一行：企业后台上传的配方（`store.api.presets()` 的列表投影）。
 *
 * 版式与技能行**同级同款**（图标 + 两行文案 + 版本短号签 + 可选分类签 + 动作区），因此字段也照技能行的口径保留：
 * 分类是服务端的**可选**字段（可能没有），版本短号取自 `sourceDshVersion`（完整坐标挂在签的 `title` 上）。
 * 这里**多带** `sizeBytes`/`updatedAt`/`versionId` 不是给界面看的，而是让这一行仍然是一份**完整的配方投影**
 * （复制导入指令要 `id`/`presetId`/`displayName`/`versionId`，见 `buildPresetImportInstruction`）。
 */
export interface EnterpriseMarketPresetRow {
  /** 配方包雪花 id，同时是详情取数键（`store.api.presetDetail(id)`）与行键的一部分。 */
  readonly id: string
  /** manifest 的稳定标识，进详情里那行等宽「标识」。 */
  readonly presetId: string
  readonly displayName: string
  /** 空描述归一为固定占位（与技能行同一句话的约定），不在行上留白。 */
  readonly description: string
  /** 完整来源坐标（行上签显示**短号**、`title` 给完整坐标，与技能行同一投影）。 */
  readonly sourceDshVersion: string
  readonly sizeBytes: number
  readonly versionId: string
  readonly updatedAt: string
  /** 服务端**可能**新增的可选分类：缺席/null/空白即没有这个键（标题行不出分类签，安静缺席）。 */
  readonly category?: string | undefined
}

/**
 * 配方目录 → 可渲染的「企业配方」行（纯函数，按目录顺序原样投影，**不做任何过滤**）。
 * @param presets - `createEnterprisePresetListSource` 取到的配方列表（与设置弹窗同一份取数）。
 */
export function enterpriseMarketPresetRows(presets: readonly EnterpriseRuntimePreset[] = []): EnterpriseMarketPresetRow[] {
  return presets.map((preset) => {
    // 分类走与技能行同一个归一投影（服务端还没这个字段时恒 undefined ⇒ 不出签，不塞占位、不猜分类）。
    const category = enterprisePresetCategory(preset)
    return {
      id: preset.id,
      presetId: preset.presetId,
      displayName: preset.displayName,
      description: preset.description === '' ? '（暂无描述）' : preset.description,
      sourceDshVersion: preset.sourceDshVersion,
      sizeBytes: preset.sizeBytes,
      versionId: preset.versionId,
      updatedAt: preset.updatedAt,
      ...(category === undefined ? {} : { category }),
    }
  })
}

/**
 * 一条配方在本机上的**动作真值**（控制器按行 id 持有；行 facts 只读它、不自己发请求）。
 *
 * 三件事实分开持有是有意的：`status` 决定三态与披露内容、`loading` 决定开关能不能拨、
 * `errorCode` 决定「这台设备上的一键启用整条链是否接通」——把三者揉成一个字段就再也说不清
 * 「还没读到」与「读到了但没授权」的区别（那正是本刀要消灭的含混）。
 */
export interface EnterpriseMarketPresetRowState {
  /** `GET /presets/<id>/status` 的成功结果；缺席 = 还没读到。 */
  readonly status?: EnterprisePresetStatus | undefined
  /** status 在途（首帧与重试都算）：开关不可连点，但不给「假的已授权」。 */
  readonly loading: boolean
  /** status 取数失败的稳定码（路由未接线时会在这里出现 400）。 */
  readonly errorCode?: string | undefined
  /** 最近一次 enable/disable 失败的稳定码（与 status 的失败分开记）。 */
  readonly actionErrorCode?: string | undefined
  /**
   * 最近一次**成功**启用回执里的落地事实（`application` / `needsNewSession` / `alreadyInstalled`）。
   *
   * 它与 `status` 分开持有：`status` 只说「装没装上」，**说不出「什么时候生效」**——而
   * `docs/notes/preset-approval-spike.md` §5.1 第 3 条要求官方两种落地方式都诚实呈现
   * （`applied` = 热生效 / `restart-required` = 要重启）。少了这一枚，员工点完启用只看得到开关翻了一下，
   * 那正是「不静默」要消灭的含混。下一次动作开始时清掉（不残留一句对已经变了的状态的断言）。
   */
  readonly applied?: EnterprisePresetAppliedReceipt | undefined
}

/**
 * 一次**成功**启用回执里给员工看的那几件落地事实（`POST …/enable` 的 200 投影）。
 *
 * 字段逐个照 `local-api-decode.ts` 的 `EnterprisePresetEnableResult`：这里只留「什么时候生效」这一手，
 * `installedNames` / `disclosure` / `fingerprint` 不在这里重复持有（它们的真源是 `status`）。
 */
export interface EnterprisePresetAppliedReceipt {
  /** 官方落地方式三态（`hot` = 立刻生效、`restart-required` = 要重启、`other` = 其余官方原值）。 */
  readonly application: EnterprisePresetApplicationKind
  /** 官方原值（`applied` / `restart-required` / `overridden` / …）；Host 只在拿到时才产出这个键。 */
  readonly officialApplication?: EnterprisePresetOfficialApplication | undefined
  /** Host 的「已存在会话不会改变」事实——成功路径**恒**为 true（`install.ts:536` / `:465`）。 */
  readonly needsNewSession: boolean
  /** 同配方同指纹且 link 仍在：本次没有真的再装一遍。 */
  readonly alreadyInstalled?: boolean | undefined
}

/**
 * 启用成功后的可见交代（三种落地方式各一句，**三句都含**「将在新会话生效」这句硬事实）。
 *
 * 为什么三句都要说：Host 的成功路径 `needsNewSession` 恒为 true（`install.ts:536` 与 `:465`），
 * 即「已经打开的会话拿不到新配方」永远成立；`restart-required` 只比它多一件「要先重开客户端」。
 */
export const ENTERPRISE_PRESET_APPLIED_HOT_TEXT = '已启用，将在新会话生效；已经打开的会话不会改变。'
export const ENTERPRISE_PRESET_APPLIED_RESTART_TEXT = '已启用。需要重新打开客户端，将在新会话生效。'
export const ENTERPRISE_PRESET_APPLIED_OTHER_TEXT = '已启用，将在新会话生效。'
/** 同配方同指纹、本次没有重复安装时补在前面的一句（`alreadyInstalled`）。 */
export const ENTERPRISE_PRESET_APPLIED_EXISTING_TEXT = '这条配方之前已经装好，本次没有重复安装。'

/**
 * 落地方式 → 那一句可见交代（纯函数；没有回执就没有这句话，绝不拿 `undefined` 上屏）。
 *
 * @param receipt - 成功启用回执；缺席（还没启过 / 动作已重新开始）即 `undefined`。
 * @returns 可见交代原文，或 `undefined` = 这一段不进 DOM。
 */
export function enterprisePresetAppliedNotice(
  receipt: EnterprisePresetAppliedReceipt | undefined,
): string | undefined {
  if (receipt === undefined) return undefined
  const main = receipt.application === 'restart-required'
    ? ENTERPRISE_PRESET_APPLIED_RESTART_TEXT
    : receipt.application === 'hot'
      ? ENTERPRISE_PRESET_APPLIED_HOT_TEXT
      : ENTERPRISE_PRESET_APPLIED_OTHER_TEXT
  return receipt.alreadyInstalled === true ? `${ENTERPRISE_PRESET_APPLIED_EXISTING_TEXT}${main}` : main
}

/** 没有本机真值时的兜底（行 facts 在缺 `presetStates[id]` 时读它）：与「还没读到」同义。 */
const ENTERPRISE_PRESET_ROW_STATE_UNKNOWN: EnterpriseMarketPresetRowState = { loading: true }

/** 开关的三态（未授权 → 关、已授权未装 → 关、已装 → 开；指纹已变单独一态以便弹层说明）。 */
export const ENTERPRISE_PRESET_SWITCH_STATES = [
  'unknown', 'needs-authorization', 'authorized', 'installed', 'fingerprint-changed',
] as const
export type EnterprisePresetSwitchState = typeof ENTERPRISE_PRESET_SWITCH_STATES[number]

/** 开关右侧那枚只读状态词（安静态也说，与插件行的「状态点 + 官方状态词」同款）。 */
export const ENTERPRISE_PRESET_STATE_LABELS: Readonly<Record<EnterprisePresetSwitchState, string | undefined>> = {
  unknown: undefined,
  'needs-authorization': '未确认',
  authorized: '未启用',
  installed: '已启用',
  'fingerprint-changed': '内容已更新',
}

/**
 * 三态判定（纯函数）：**已装**压过其余一切（它就是「开」），其次看授权三态。
 *
 * `installed` 取的是 Host 的已装记录（`status.installed !== null`），不是本地乐观值——
 * 界面绝不比磁盘更乐观（与技能行同一条纪律）。
 */
export function enterprisePresetSwitchState(input: {
  readonly authorization: EnterprisePresetAuthorization | undefined
  readonly installed: boolean
  readonly reading: boolean
}): EnterprisePresetSwitchState {
  if (input.installed) return 'installed'
  if (input.authorization === undefined || input.reading) return 'unknown'
  return input.authorization
}

/** 配方行的**同一份**派生事实（行渲染与配方详情子页面共用；测试可直调）。 */
export interface EnterpriseMarketPresetRowFacts {
  /** 行键（`presets:{行 id}`，与共享控制器的开合态同一个投影）。 */
  readonly rowKey: string
  readonly detailsId: string
  readonly open: boolean
  /** 完整来源坐标（行上签的 `title` 用它；空串即 undefined = 不出签）。 */
  readonly versionTag: string | undefined
  /** 行上签的可见短号（最后一个 `@` 之后那段）。 */
  readonly versionLabel: string | undefined
  /** 分类签的可见文案（没有分类即 undefined = 整枚不渲染）。 */
  readonly categoryTag: string | undefined
  /** 开关的三态（`unknown` = 真值还没读到）。 */
  readonly state: EnterprisePresetSwitchState
  /** 只读状态词（`unknown` 即 undefined = 那枚词不出）。 */
  readonly stateLabel: string | undefined
  /** 官方 `Switch.checked`：**已装 = 开**（未授权与已授权未装都是关）。 */
  readonly enabled: boolean
  /** 进行中（status 在途 / 本机报告 inFlight / 本行动作在途）：开关不可连点。 */
  readonly busy: boolean
  /** 开关禁用口径：没有写入口 / 真值还没读到 / 进行中——**失败不禁用**（再拨即重试）。 */
  readonly switchDisabled: boolean
  /** 开关的悬浮说明（唯一口径，行上与详情里同源）。 */
  readonly switchTitle: string
  /** 三级降级链的决策结果（可见说明从它的 `note` 取）。 */
  readonly fallback: EnterprisePresetFallbackPlan
  /** 这条行**是否要弹授权层**（点开关时）：未授权或指纹已变。 */
  readonly needsApproval: boolean
  /** 第三级那枚按钮是否接通（回调缺席即不渲染——不给死按钮）。 */
  readonly canCopyInstruction: boolean
  /** 刚刚复制过这一行（行上与详情里的按钮文案同时变「已复制」，因为读的是同一份事实）。 */
  readonly copied: boolean
  /** 第二级那枚按钮是否接通（官方「新建会话 + 填入输入框」的端口的接线结果）。 */
  readonly canOpenInNewSession: boolean
  /**
   * 最近一次**成功**启用后的可见交代（「将在新会话生效」那一句）；`undefined` = 这段不进 DOM。
   * 行上与详情里读的是同一份 facts，故两处不可能各说一句。
   */
  readonly appliedNotice: string | undefined
}

/**
 * 配方行 facts 的唯一入口。
 *
 * 它是**行上 / 详情里 / 授权弹层**三处读同一份事实的唯一落点：
 * 三态、可拨性、降级级别与可见说明全部只在这里算一次。
 *
 * @param props - 共享 props（要 `presetStates`/`onTogglePreset`/`onOpenPresetInNewSession`/
 *   `onCopyPresetInstruction`/`presetCopiedId`/`expandedRow`）。
 * @param row - 已投影的配方行。
 */
export function enterpriseMarketPresetRowFacts(
  props: EnterpriseMarketShellProps,
  row: EnterpriseMarketPresetRow,
): EnterpriseMarketPresetRowFacts {
  const rowKey = enterpriseMarketRowKey('presets', row.id)
  const local: EnterpriseMarketPresetRowState = props.presetStates?.[row.id] ?? ENTERPRISE_PRESET_ROW_STATE_UNKNOWN
  const status = local.status
  const reading = status === undefined && local.loading
  const state = enterprisePresetSwitchState({
    authorization: status?.authorization,
    installed: status?.installed !== null && status?.installed !== undefined,
    reading,
  })
  const writePort = typeof props.onTogglePreset === 'function'
  // 进行中：status 在途、Host 报告 inFlight、或本行正有一个动作在途 → 不可连点（D1：但**不禁用重试**）。
  const busy = reading || local.loading || status?.inFlight === true || props.pendingPresetId === row.id
  const clipboardAvailable = typeof props.onCopyPresetInstruction === 'function'
  const newSessionAvailable = typeof props.onOpenPresetInNewSession === 'function'
  // 「一键启用不在这台设备上」的两条硬证据：写入口缺席、或真值/动作的失败码说明路由没接线。
  const routeUnsupported = enterprisePresetRouteUnsupported(local.errorCode)
    || enterprisePresetRouteUnsupported(local.actionErrorCode)
  /**
   * 终态失败（再试一次必然还是同一个结果）才算「这条链在这台设备上走不通」。
   *
   * **两枚授权码除外**：`AUTHORIZATION_REQUIRED` / `_STALE` 在 error-messages 里都是 `retryable: false`
   * （再发同样的请求必然还是被拒），但它们的**下一步是员工重新确认**——那是第一级自己的流程，
   * 不是「一键启用不可用」。把它们算进降级会把员工从「弹层重确认」直接甩到复制指令，那是错的。
   */
  const failureCode = local.actionErrorCode ?? local.errorCode
  const actionTerminal = failureCode !== undefined
    && !ENTERPRISE_PRESET_RECONFIRM_CODES.includes(failureCode)
    && !enterpriseErrorRetryable(failureCode)
  const oneClickAvailable = writePort && !routeUnsupported && !actionTerminal
  const oneClickReason = !writePort
    ? '这台设备上的入口还没接通'
    : routeUnsupported
      ? '这台设备上的入口还没接好'
      : local.actionErrorCode !== undefined
        ? enterpriseErrorPresentation(local.actionErrorCode).message
        : undefined
  const fallback = enterprisePresetFallbackPlan({
    oneClickAvailable,
    ...(oneClickReason === undefined ? {} : { oneClickReason }),
    newSessionAvailable,
    clipboardAvailable,
  })
  const switchDisabled = !oneClickAvailable || busy || status === undefined
  const enabled = state === 'installed'
  /**
   * 成功启用后的可见交代：只在**有成功回执**时出。
   *
   * 它与失败提示并存于同一行（一行说结果、一行说没成），但成功那一刻本来就没有失败码可残留
   * （`runPresetEnable` 开头会清 `presetActionError`），故界面上不会同时看到两句话。
   */
  const appliedNotice = enterprisePresetAppliedNotice(local.applied)
  return {
    rowKey,
    detailsId: enterpriseMarketRowDetailsId('presets', row.id),
    open: enterpriseMarketRowOpen(props.expandedRow, rowKey),
    versionTag: enterpriseMarketSkillVersionTag(row.sourceDshVersion),
    versionLabel: enterpriseMarketSkillVersionLabel(row.sourceDshVersion),
    categoryTag: enterpriseMarketSkillCategoryTag(row.category),
    state,
    stateLabel: ENTERPRISE_PRESET_STATE_LABELS[state],
    enabled,
    busy,
    switchDisabled,
    switchTitle: !oneClickAvailable
      ? fallback.note ?? '这台设备上暂时不能一键启用'
      : status === undefined
        ? '正在读取这条配方在本机上的状态'
        : busy
          ? '动作进行中，暂不可操作'
          : enabled
            ? '点此停用'
            : state === 'authorized'
              ? '点此启用'
              : '点此查看它会带来什么，确认后启用',
    fallback,
    needsApproval: !enabled && (state === 'needs-authorization' || state === 'fingerprint-changed'),
    canCopyInstruction: clipboardAvailable,
    copied: props.presetCopiedId === row.id,
    canOpenInNewSession: newSessionAvailable,
    appliedNotice,
  }
}

/**
 * 两套外壳**共用**的样式：节容器、组件节（`.own-market-rows`/`.own-market-row*`）、行内失败提示、页签条与面板、
 * 标题行那两枚签（`.own-market-cardHead`/`.own-market-skillTitle`/`.own-market-tag`）、技能行那颗「有更新」药丸。
 * 这些规则在旧新两套外观里逐值相同，故只保留一份——旧外壳不必抄第二份，也就不会在后续改动里悄悄跟新外壳分叉。
 * 类名一律避开 `plugin-market.tsx` 已占用的同前缀名字（`.own-market-card`/`.own-market-tabs`/`.own-market-query` 等），
 * 因为两处都注入全局单类选择器的 `<style>`，同名会互相覆盖（本仓已踩过，7557ffd 已改名）。
 */
const baseStyles = `
.own-market-entry{color:var(--dsw-alias-label-primary,#101828);font-size:13px;letter-spacing:0;min-width:0}
.own-market-entry *{box-sizing:border-box}
.own-market-entry-summary{color:var(--dsw-alias-label-secondary,#667085)}
/* 包名在 badge 槽内换行成标题下独立一行（照官方 .detailName：mono 12/18 tertiary）。
   flex-basis:100% 借官方 titleRow 的 flex-wrap:wrap 让它独占一行，落在标题下、描述上。 */
.own-market-badge-name{flex-basis:100%;min-width:0;margin-top:4px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#98a2b3);overflow-wrap:anywhere}
.own-market-tag{flex:none;font-variant-numeric:tabular-nums}
/* 版本签外面那枚**只承载完整来源坐标 title** 的包装节点（官方 Tag 只吃 tone/className/children）：
   display:inline-flex 让包装节点自身也是一个真实盒子（悬停命中可靠，title 必然生效），flex:none 与
   签同口径——它绝不压缩、不换行，故标题行的行高与排布与加包装之前逐值相同。 */
.own-market-skillVersionHint{display:inline-flex;flex:none;min-width:0}
/* 节容器：顶部间距从官方 RowsSection 口径的 24 收到 12（详情页顶部压缩），节内 gap 仍是 12。 */
.own-market-section{display:flex;flex-direction:column;gap:12px;min-width:0;margin-top:12px}
.own-market-sectionHead{display:flex;align-items:baseline;gap:10px;min-width:0}
.own-market-sectionTitle{margin:0;font-size:14px;line-height:20px;font-weight:500}
/* 节头可点按钮：照官方 groupToggle（flex none + gap8 + 无边框 + 透明 + 左对齐 + focus-ring）。 */
.own-market-groupToggle{display:flex;flex:none;align-items:center;gap:8px;border:0;padding:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.own-market-groupToggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-market-groupToggle[disabled]{cursor:default}
.own-market-groupTitle{font-size:14px;line-height:22px;font-weight:500;color:var(--dsw-alias-label-primary,#101828)}
/* chevron：收起 rotate(-90°) → 展开 rotate(0)，照官方 groupToggle 的 .chevron 口径。 */
.own-market-chevron{flex:none;transform:rotate(-90deg);transition:transform .15s ease}
.own-market-groupToggle[aria-expanded='true'] .own-market-chevron{transform:none}
.own-market-sectionCount{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:18px;overflow-wrap:anywhere}
/* ── 分组 + 两列卡片网格（用户口径：参考图的分组样式＝组标题 + 分割线） ────────────────────
   为什么是网格而不是原来的单列行：用户给了参考图并裁决 A（完全照图）。行结构（li.own-market-row
   → .own-market-rowLine → 行本体按钮 + 动作）**一字未动**——只把外层容器从单列 flex 换成两列 grid，
   故所有行级选择器与既有测试的树形断言照旧成立。 */
.own-market-categoryGroup{display:flex;flex-direction:column;gap:16px;min-width:0}
.own-market-categoryGroup + .own-market-categoryGroup{margin-top:40px}
/* 组标题 + 它下方那条**分割线**：分割线是标题自己的 border-bottom（不是一枚额外元素），
   故标题与线不可能错位；行间不再有任何分割线（用户口径：列表去除分割线）。
   类名**不叫 groupTitle**：组件节那枚折叠节头已经占了这个名字，同名会让两条规则互相覆盖。 */
.own-market-categoryTitle{margin:0;padding-bottom:12px;border-bottom:0.5px solid var(--dsw-alias-border-l2,#e4e7ec);font-size:17px;line-height:26px;font-weight:600;color:var(--dsw-alias-label-primary,#101828)}
.own-market-rows{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 24px;min-width:0}
/* 卡片：左右内衬 + 圆角，hover 整块变灰（用户口径：卡片级 hover、背景变灰）。
   hover 取值照官方卡片实物（app.asar 里的 ._card:hover:not(._cardActive) 规则）：
   background:var(--dsw-alias-interactive-bg-hover)——不新造颜色、不用 color-mix 猜。 */
.own-market-row{padding:10px 12px;border:0;border-radius:12px;min-width:0;transition:background .12s ease}
.own-market-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
/* ── 卡片操作区的「⋯」更多菜单（用户口径：卡片不放开关键——未安装给「安装」、已安装给「⋯」；
   菜单项按各行真实能力给：更新 / 启用·停用 / 卸载）。hover 与 focus 取值照官方菜单实物
   （同一枚 --dsw-alias-interactive-bg-hover），与左邻右舍的 token 用法保持一致。 */
.own-market-more{position:relative;flex:none}
.own-market-moreBtn{display:inline-grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:var(--dsw-radius-md,6px);background:transparent;color:var(--dsw-alias-label-secondary,#667085);cursor:pointer}
.own-market-moreBtn:hover,.own-market-moreBtn[aria-expanded='true']{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary,#101828)}
.own-market-moreBtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:1px}
.own-market-moreMenu{position:absolute;top:calc(100% + 4px);right:0;z-index:30;min-width:120px;padding:4px;border:1px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-background-primary,#fff);box-shadow:var(--dsw-shadow-lv2,0 8px 24px rgba(16,24,40,.12));display:flex;flex-direction:column;gap:2px}
.own-market-moreItem{display:block;width:100%;padding:6px 10px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary,#101828);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.own-market-moreItem:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.own-market-moreItem:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:-1px}
.own-market-moreItem:disabled{color:var(--dsw-alias-label-tertiary,#98a2b3);cursor:default}
/* 详情子页面没有下拉宿主 ⇒ 操作**平铺**（同一枚子块、同一份文案，只是不套一层菜单）。 */
.own-market-moreInline{display:flex;flex:none;align-items:center;gap:4px}
.own-market-moreInline .own-market-moreItem{width:auto}
/* 「安装 / 启用」按钮：**纯色底 + 无 hover 变化**（用户口径）。
   官方 Button 每个变体都自带 hover，故把类名写两遍把特异性抬到官方那条之上
   （.own-market-installBtn.own-market-installBtn:hover ＞ .toolbar:hover），
   **不写 !important、也不动官方样式表**；底色取官方同一枚按钮填充 token，不新造颜色。 */
.own-market-installBtn{background:var(--dsw-alias-button-tool-bar-fill)}
.own-market-installBtn.own-market-installBtn:hover:not(:disabled),
.own-market-installBtn.own-market-installBtn:active:not(:disabled){background:var(--dsw-alias-button-tool-bar-fill)}
@media (prefers-reduced-motion: reduce){.own-market-row{transition:none}}
/* 窄屏回落单列：网格在极窄容器里会把标题挤成一个字（真机截图早已证过同类问题）。 */
@media (max-width: 560px){.own-market-rows{grid-template-columns:minmax(0,1fr)}}
/* 未安装那一行那枚【＋】（圆形图标按钮）——与「企业设置 → 插件」卡片行那枚同形。
   值逐条取自 workdsh 的 .wd-skills .install（showcase 仓：skills/src/client/styles.ts:144-147）；
   类名不同是刻意的：本文件与 plugin-market.tsx 各自挂一块全局单类选择器的 <style>，
   两处类名必须零交集（同名会互相覆盖），故各自一枚名字、值逐字相同。 */
.own-market-rowLine{display:flex;align-items:center;gap:16px;min-width:0}
.own-market-rowIcon{display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;width:40px;height:40px;border:0;border-radius:10px;background:var(--dsw-alias-background-secondary,#f2f4f7);color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowMain{display:flex;flex:1;flex-direction:column;gap:2px;min-width:0}
.own-market-rowId{font-size:13.5px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary,#101828);overflow-wrap:anywhere}
.own-market-row[data-state='off'] .own-market-rowId{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowNote{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
/* 降级链那两句可见说明与行内失败提示共用同一行落点（行下、动作之后），形制一致、只换配色。 */
.own-market-rowNote[data-enterprise-preset-fallback-level='clipboard']{color:var(--dsw-alias-state-warn-primary,#b54708)}
/* ── 企业插件行「**安装中**」那一条真进度（阶段文字 + 不确定态流光） ─────────────────
   为什么是流光而不是会填满的进度条：这条链从 Host 只拿得到**阶段**（真源与实证写在
   plugin-install-progress.ts 的文件头），**没有百分比**。任何从左往右「填满」的条都是假装进度，
   故这里画的是一条轨道 + 一段**来回滑动**的高光：transform 只动那个装饰层，不表达任何完成度。
   文字与动效是**两件东西**——阶段文字是上面那句独立文本节点，关掉动效（下面那条 media query）
   后阶段文字与进度语义一字不少。类名与同包其他源文件零交集（两处 style 都是全局单类选择器）。 */
.own-market-progress{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}
.own-market-progressFlow{position:relative;display:block;flex:0 1 96px;width:96px;height:4px;border-radius:2px;background:var(--dsw-alias-background-secondary,#f2f4f7);overflow:hidden}
.own-market-progressFlow::after{content:'';position:absolute;top:0;bottom:0;width:40%;border-radius:2px;background:var(--dsw-alias-accent-primary,#2563eb);animation:own-market-progress-flow 1.3s ease-in-out infinite}
.own-market-progressText{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px}
.own-market-progressNote{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:19px;overflow-wrap:anywhere}
.own-market-progressSettled{margin:0;color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
@keyframes own-market-progress-flow{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
/* 尊重「减少动态效果」：滑动关掉，那条装饰层改成静态淡色；阶段文字与进度条语义
   （aria-valuetext）都不受影响（信息从来没有放在动效里）。 */
@media (prefers-reduced-motion: reduce){.own-market-progressFlow::after{width:100%;opacity:.4;animation:none;transform:none}}
/* ── 自造授权弹层（配方一键启用） ────────────────────────────────────────────────
   官方 Web 界面面根本没有「装插件」的授权弹层（只有一句信任声明），故这一层是我们自己的：
   覆盖层 + 居中卡片，类名一律 .own-market-approval*，与同包其他源文件零交集。 */
.own-market-approvalBackdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-1,rgba(16,24,40,.45))}
.own-market-approval{display:flex;flex-direction:column;gap:12px;width:min(100%,520px);max-height:100%;overflow:auto;padding:20px;border-radius:12px;background:var(--dsw-alias-background-primary,#fff);color:var(--dsw-alias-label-primary,#101828);box-shadow:var(--dsw-shadow-lv2,0 12px 32px rgba(16,24,40,.18))}
.own-market-approvalTitle{margin:0;font-size:15px;line-height:22px;font-weight:600}
.own-market-approvalSubject{margin:0;font-size:13.5px;line-height:20px;font-weight:500;overflow-wrap:anywhere}
.own-market-approvalStale{margin:0;padding:8px 10px;border-radius:6px;background:var(--dsw-alias-background-secondary,#f2f4f7);color:var(--dsw-alias-state-warn-primary,#b54708);font-size:12.5px;line-height:19px}
.own-market-approvalList{display:flex;flex-direction:column;gap:6px;min-width:0}
.own-market-approvalListTitle{margin:0;font-size:12.5px;line-height:19px;font-weight:500;color:var(--dsw-alias-label-secondary,#667085)}
.own-market-approvalItems{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.own-market-approvalItem{display:flex;flex-direction:column;gap:2px;min-width:0;padding:8px 10px;border:0.5px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:6px}
.own-market-approvalDisclaimer{margin:0;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-background-secondary,#f2f4f7);color:var(--dsw-alias-state-warn-primary,#b54708);font-size:12.5px;line-height:19px}
.own-market-approvalActions{display:flex;justify-content:flex-end;gap:8px}
/* 标题 + 两枚签：**单行 nowrap flex**，行高锁 20px（官方 Tag 固定 19px 高 < 20px，故加签不改变这一行的高度）。
   标签过多时**标题先让步**：标题 flex:0 1 auto + min-width:0 先省略，两枚签 .own-market-tag 的 flex:none 保持可见；
   head 自身 overflow:hidden 兜底，绝不换行、绝不撑高。两套外壳的标题行都用这一份取值。
   版本签只显示**短号**（完整坐标挂在 .own-market-skillVersionHint 的 title 上）——这也是标签不再挤掉标题的前提。 */
.own-market-cardHead{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;line-height:20px;overflow:hidden}
.own-market-skillTitle{flex:0 1 auto;min-width:0}
.own-market-rowState{display:inline-flex;flex-shrink:0;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#667085);font-size:12.5px;line-height:18px;white-space:nowrap}
.own-market-row[data-state='off'] .own-market-rowState{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowStateFailed{color:var(--dsw-alias-state-error-primary,#c4320a)}
/* 技能行右侧那枚「有更新」辅助动作（两套外壳同一取值）：无边框圆角淡底（标签观感，不是第二枚开关）、
   键盘可达 + focus-ring、禁用态降透明——它是开关左侧的快捷路，不抢主控件的位置。 */
.own-market-skillTag{flex:none;border:0;border-radius:999px;padding:1px 10px;background:var(--dsw-alias-background-secondary,#f2f4f7);font-size:12.5px;line-height:18px;color:var(--dsw-alias-accent-primary,#2563eb);font-variant-numeric:tabular-nums;cursor:pointer}
.own-market-skillTag:hover:not(:disabled){background:var(--dsw-alias-border-l2,#e4e7ec);color:var(--dsw-alias-label-primary,#101828)}
.own-market-skillTag:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-market-skillTag:disabled{cursor:default;opacity:.6}
/* page 视图顶部的页签条（手写，不用官方 SegmentedTabs——工程 pin 的 primitives 0.1.5-rc.2 不含它）：
   **两套外壳共用同一份渲染**。类名 .own-market-storeTabs/.own-market-storeTab 与 plugin-market.tsx
   的旧名 .own-market-tabs 零交集（两份全局单类 <style> 同名会互相覆盖，7557ffd 已改名）。
   flex-wrap:nowrap + 页签 white-space:nowrap 保证「文案带计数」后页签不换行、不撑高。
   ── 本刀：从下划线式改成**胶囊分段**样式（用户口径：照「公开 / 个人」那种标签按钮，参考图 1）：
   · 容器 = 圆角浅灰轨道（官方 background-secondary，与参考图 #f3f3f3 轨道同量级），无底部横线；
   · 页签 = 轨道内胶囊，当前项（aria-selected=true）实心白底 + 轻投影（参考图「公开」那枚）；
   · 未选中 = 透明底 + 次级字色；focus-ring 与 role/tabIndex/aria 语义一字未改。 */
.own-market-storeTabs{display:flex;flex-wrap:nowrap;align-items:center;gap:2px;min-width:0;margin:0;padding:3px;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-background-secondary,#f2f4f7);border-bottom:0;width:max-content;max-width:100%}
.own-market-storeTab{background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-label-secondary,#667085);cursor:pointer;font:inherit;font-size:13px;line-height:20px;padding:5px 12px;white-space:nowrap}
.own-market-storeTab:hover{color:var(--dsw-alias-label-primary,#101828)}
.own-market-storeTab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:1px}
.own-market-storeTab[aria-selected='true']{background:var(--dsw-alias-background-primary,#fff);color:var(--dsw-alias-label-primary,#101828);font-weight:500;box-shadow:var(--dsw-shadow-lv1,0 1px 2px rgba(16,24,40,.06))}
.own-market-titleTabs{margin-right:auto}
.own-market-titleActions{margin-left:auto}
/* ── 标签行：胶囊组在左、筛选触发钮在**最右**（参考图 1：标签靠左、≡ 靠右） ──
   整行改成 space-between；触发钮是一枚透明图标按钮（漏斗），点开下方下拉。 */
.own-market-tabBar{display:flex;align-items:center;gap:12px;min-width:0;margin-top:0}
/* 搜索框在**左**、筛选钮在**右**（用户口径）：两者同属一枚控件行，整体靠右、搜索框吃掉剩余宽度。
   搜索是真输入框：回调缺席时上层会传 readOnly，故不会出现「打了字没反应」的假控件。 */
.own-market-searchRow{display:flex;align-items:center;gap:8px;min-width:0;margin-bottom:12px}
.own-market-query{display:flex;flex:1 1 auto;align-items:center;gap:8px;min-width:0;height:40px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:var(--dsw-radius-md,6px);background:var(--dsw-alias-background-primary,#fff);color:var(--dsw-alias-label-tertiary,#98a2b3)}
.own-market-query:focus-within{border-color:var(--dsw-alias-border-l3,#d0d5dd);outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:1px}
.own-market-queryIcon{flex:none}
.own-market-queryInput{flex:1 1 auto;min-width:0;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-primary,#101828);font:inherit;font-size:13px;line-height:20px}
.own-market-queryInput:focus{outline:none}
.own-market-queryInput::placeholder{color:var(--dsw-alias-label-tertiary,#98a2b3)}
.own-market-filterBtn{display:inline-grid;place-items:center;flex:none;width:32px;height:32px;padding:0;border:0;border-radius:var(--dsw-radius-md,6px);background:transparent;color:var(--dsw-alias-label-secondary,#667085);cursor:pointer}
.own-market-filterBtn:hover{background:var(--dsw-alias-background-secondary,#f2f4f7);color:var(--dsw-alias-label-primary,#101828)}
.own-market-filterBtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:1px}
/* ── 筛选下拉（参考图 2 的两组：状态 + 类型；组头带勾、组内可选；本刀只做壳，过滤下一刀）── */
.own-market-filterWrap{position:relative;flex:none}
.own-market-filterMenu{position:absolute;top:calc(100% + 6px);right:0;z-index:30;min-width:168px;padding:6px;border:1px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-background-primary,#fff);box-shadow:var(--dsw-shadow-lv2,0 8px 24px rgba(16,24,40,.12));display:flex;flex-direction:column;gap:2px}
.own-market-filterGroup{display:flex;flex-direction:column;gap:2px}
.own-market-filterGroup + .own-market-filterGroup{margin-top:6px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l2,#e4e7ec)}
.own-market-filterOption{display:flex;align-items:center;gap:8px;width:100%;border:0;border-radius:6px;padding:6px 8px;background:transparent;color:var(--dsw-alias-label-primary,#101828);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.own-market-filterOption:hover{background:var(--dsw-alias-background-secondary,#f2f4f7)}
.own-market-filterOption:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:-1px}
.own-market-filterOption[aria-checked='true']{color:var(--dsw-alias-label-primary,#101828);font-weight:500}
.own-market-filterCheck{flex:none;width:14px;color:var(--dsw-alias-label-primary,#101828);text-align:center}
.own-market-filterLabel{flex:1;min-width:0}
/* 面板：非当前页签只留一个 hidden 空壳（内容整段不挂载），显式补一条 [hidden] 规则，
   免得将来给 .own-market-panel 加上 display 类选择器后覆盖 UA 的 [hidden]{display:none}（本仓已踩过）。 */
.own-market-panel{min-width:0}
.own-market-panel[hidden]{display:none}
/* 页签化后的节：企业技能 / 企业插件两节已无折叠也**无独立计数行**（计数并入页签文案，
   故 .own-market-sectionMeta 规则随之一并删除——不留死样式）；只有组件节的节头按钮
   （.own-market-groupToggle）还带折叠，它的计数仍用 .own-market-sectionCount 与标题同排。 */
/* 行内失败提示（企业插件行/企业技能行共用，两套外壳同值）：取值照「技能」tab 的 .own-skill-inlineError
   （error 色 + 12/19 + 左对齐 + 无内衬）。那份 CSS 归 skill-market 的 <style> 持有、切到本页时并不在 DOM，
   故这里补一份同值规则，不借道未挂载的样式表。 */
.own-market-inlineError{padding:0;text-align:left;font-size:12px;line-height:19px;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary,#c4320a)}
/* 目录页签内容区的三态落点（加载中 / 空 / 失败）：与行内失败提示同一份字号与色板。
   取值刻意中性（次级色），失败那一步的红由 .own-market-inlineError 承担——加载与空不是错误。 */
.own-market-listState{padding:10px 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#667085)}
.own-market-listHint{margin:0}
.own-market-listRetry{margin-top:8px}
/* 次级取数降级的可见交代：非打扰（不是错误色、不是 alert），但看得见 + 可重试。 */
.own-market-degraded{margin:8px 0;color:var(--dsw-alias-label-secondary,#667085);font-size:12.5px;line-height:19px;overflow-wrap:anywhere}
`

/**
 * **目录行取值**（`baseStyles` 之外的那两条行内文案规则）：`.own-market-cardId`（标题 14/20-500-省略）
 * 与 `.own-market-cardDesc`（描述 13/18-tertiary-**单行**省略），逐值取自 `9723a97`。
 * 行的唯一实现点 `EnterpriseMarketInlineRows` 渲染它，故取值只有这一份——改一次就处处一致，不会再分叉。
 * 渲染顺序：列表视图 = `baseStyles` + 这份行取值（与改动前逐字节相同）；详情子页面 = 再加一份 `detailStyles`。
 */
const rowStyles = `
.own-market-cardId{font-size:15px;line-height:1.4;font-weight:600;color:var(--dsw-alias-label-primary,#101828);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.own-market-cardDesc{color:var(--dsw-alias-label-secondary,#667085);font-size:13px;line-height:1.55;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
/* 技能行**行本体**（图标 + 标题 + 描述那一片）是一枚真 button 元素：整片可点、原生键盘可达（Enter/Space）、
   有 focus 环与 hover 提示（光标 + 标题/描述转主色调）。取值照本文件既有口径：行图标与文案之间仍是 16px
   （= .own-market-rowLine 的 gap），因此包上这枚按钮**不改变行的几何**。
   **动作不会被藏起来、也不会被这枚按钮吞掉**：[有更新] 与官方 Switch 是它在 .own-market-rowLine 里的
   **兄弟节点而不是后代**——点它们根本不会冒泡进详情（不是靠 stopPropagation 拦，而是结构上就不在可点区域内），
   .own-market-rowLine/li 自身没有任何 onClick。 */
.own-market-rowOpen{display:flex;flex:1;align-items:center;gap:16px;min-width:0;border:0;padding:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;border-radius:8px}
.own-market-rowOpen:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
/* 回调缺席时那枚按钮是 disabled：UA 会给 default 光标，但上面的 cursor:pointer 优先级更高，故显式收回。 */
.own-market-rowOpen:disabled{cursor:default}
`

/**
 * **技能详情子页面**独有的样式（只有这条路径用它：视图状态切进详情时由外壳连 `baseStyles`+`rowStyles` 一起挂载）。
 *
 * **框架逐值照官方插件详情页**（`@deepseek-ai/dsh-client-ui-plugin-manager` 的 `ItemDetail`/`DetailTop`
 * 与它那份 CSS module，本机 node_modules 下 `lib/client.js` 里的 `_detail`/`_detailTop`/`_crumb`/`_crumbIcon`/
 * `_detailHead`/`_cardIcon`/`_detailMain`/`_detailTitle`/`_detailName`/`_detailDesc`/`_detailSections`/
 * `_detailSection`/`_sectionHead`/`_sectionTitle`/`_sectionCount`/`_versionTag` 一组取值）：
 *   · `.own-market-detail` = `_detail`（flex column）
 *   · `.own-market-detailTop` = `_detailTop`（padding-top:28px）
 *   · `.own-market-crumb` = `_crumb`（tertiary 12.5px、gap 6、无边框透明按钮、hover 转主色、focus 环）
 *   · `.own-market-crumbIcon` = `_crumbIcon`（rotate 90deg，把 chevron-down 转成「返回」箭头）
 *   · `.own-market-detailHead` = `_detailHead`（图标 + 动作：margin:32px 0 0、两端对齐、gap 12）
 *   · `.own-market-detailIcon` = `_cardIcon`（48×48、`.5px` border-l3、radius-lg、secondary）
 *   · `.own-market-detailMain` = `_detailMain`（margin-top:20px、flex column、gap 8）
 *   · `.own-market-titleRow` = `_titleRow`（flex-wrap + gap 8）
 *   · `.own-market-detailTitle` = `_detailTitle`（20/28-500）；版本徽标就是官方 `Tag` + `.own-market-tag`
 *     （`_versionTag` 的 tabular-nums 口径在 baseStyles 里已有）
 *   · `.own-market-detailName` = `_detailName`（tertiary 12/18 + `<code>` 等宽，就是那行等宽标识行）
 *   · `.own-market-detailDesc` = `_detailDesc`（secondary 14/22）
 *   · `.own-market-detailSections` = `_detailSections`（margin-top:32px、gap 32）
 *   · `.own-market-detailSection` = `_detailSection`（flex column、gap 12）
 *   · `.own-market-sectionHead`/`.own-market-sectionTitle`/`.own-market-sectionCount` 复用 `baseStyles` 里已有那三条
 *     （与官方 `_sectionHead`/`_sectionTitle`/`_sectionCount` 同值），**不重复声明**。
 *
 * 文件树 / 预览的取值仍沿用本文件既有官方口径（`.5px` 发丝线 + radius-md、13/20、mono 11.5/17、tertiary 说明 12/19），
 * **不新造一套视觉**；预览是 `<pre>` 里的**纯文本子节点**，没有任何 HTML 注入点。
 * 错误提示也不在这里另起一份：与行上同一条 `baseStyles` 的 `.own-market-inlineError`（同一句话 + 稳定错误码）。
 */
const detailStyles = `
.own-market-detail{display:flex;flex-direction:column;min-width:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#101828)}
.own-market-detailTop{display:flex;flex-direction:column;padding-top:28px}
.own-market-crumb{display:inline-flex;flex:none;align-items:center;gap:6px;border:0;padding:0;background:0 0;color:var(--dsw-alias-label-tertiary,#98a2b3);font:inherit;font-size:12.5px;cursor:pointer}
.own-market-crumb:hover{color:var(--dsw-alias-label-primary,#101828)}
.own-market-crumb:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#2563eb));outline-offset:2px}
.own-market-crumbIcon{transform:rotate(90deg)}
.own-market-detailHead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:32px 0 0}
.own-market-detailIcon{display:inline-flex;flex:none;align-items:center;justify-content:center;width:48px;height:48px;border:.5px solid var(--dsw-alias-border-l3,#d0d5dd);border-radius:var(--dsw-radius-lg,16px);color:var(--dsw-alias-label-secondary,#667085)}
.own-market-detailMain{display:flex;flex-direction:column;gap:8px;min-width:0;margin-top:20px}
.own-market-titleRow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}
.own-market-detailTitle{margin:0;font-size:20px;font-weight:500;line-height:28px}
.own-market-detailName{margin:0;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.own-market-detailName code{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}
.own-market-detailDesc{margin:0;color:var(--dsw-alias-label-secondary,#667085);font-size:14px;line-height:22px;overflow-wrap:anywhere}
.own-market-detailActions{display:flex;flex:none;align-items:center;gap:16px}
.own-market-detailSections{display:flex;flex-direction:column;gap:32px;margin-top:32px}
.own-market-detailSection{display:flex;flex-direction:column;gap:12px;min-width:0}
/* 左文件树 + 右文件预览：容器不够宽时按**容器查询**回落成上下两段（树在上、预览在下）。 */
.own-market-fileSplit{display:grid;grid-template-columns:minmax(160px,240px) minmax(0,1fr);gap:12px;min-width:0;container-type:inline-size}
@container (max-width: 520px){.own-market-fileSplit{grid-template-columns:minmax(0,1fr)}}
.own-market-fileTree{display:flex;flex-direction:column;gap:2px;min-width:0;max-height:360px;overflow:auto;padding:6px;border:.5px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:var(--dsw-radius-md,12px)}
.own-market-fileRows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;min-width:0}
.own-market-fileRow{min-width:0;margin:0;padding:0}
/* 目录行：**不是按钮**（点它不会取任何东西，也不该冒充可预览），与文件行在视觉上可区分（tertiary 色 + 无 hover 底）。 */
.own-market-fileDir{display:flex;align-items:center;gap:6px;min-width:0;padding:3px 6px;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12.5px;line-height:18px}
/* 文件行：可点（真 button），选中态用淡底 + 主色 + 加粗，键盘可达且有 focus 环。 */
.own-market-fileOpen{display:flex;width:100%;align-items:center;gap:6px;min-width:0;border:0;border-radius:var(--dsw-radius-sm,8px);padding:3px 6px;background:0 0;color:var(--dsw-alias-label-secondary,#667085);font:inherit;font-size:12.5px;line-height:18px;text-align:left;cursor:pointer}
.own-market-fileOpen:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,#f2f4f7));color:var(--dsw-alias-label-primary,#101828)}
.own-market-fileOpen:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#2563eb));outline-offset:1px}
.own-market-fileOpen[data-enterprise-file-selected='true']{background:var(--dsw-alias-bg-layer-3,#f2f4f7);color:var(--dsw-alias-label-primary,#101828);font-weight:500}
.own-market-fileGlyph{flex:none;color:var(--dsw-alias-label-tertiary,#98a2b3)}
.own-market-fileName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.own-market-fileSize{flex:none;margin-left:auto;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}
.own-market-filePreview{display:flex;flex-direction:column;gap:6px;min-width:0}
.own-market-filePreviewHead{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0}
.own-market-filePreviewPath{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);color:var(--dsw-alias-label-secondary,#667085);font-size:11.5px;line-height:16px;overflow-wrap:anywhere}
.own-market-filePreviewMeta{margin-left:auto;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}
/* 正文：纯文本 <pre>（长文件靠 max-height 滚动看全，不做截断；空白保留、超长行软换行）。 */
.own-market-fileText{margin:0;max-height:360px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-background-secondary,#f2f4f7);font:11.5px/17px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-primary,#101828)}
/* ── 标题区：去掉官方那枚 48×48 图标（用户口径） ──────────────────────────
   官方 DetailTop 的 cardIcon（ui-plugin-manager/PluginManagerPage.module.css:233，48×48 +
   hairline + radius-lg）渲染在改不了的官方源码里，且是 CSS module（运行时哈希类名 css.cardIcon）
   ⇒ 拿不到类名、.detailHead 同样是哈希。故只能按**官方非哈希标记**定位：详情容器
   [data-plugin-item-detail="<条目 id>"]（PluginManagerPage.tsx:534，值＝条目 id）里，
   那枚图标是**唯一一个 aria-hidden 的 span**（PluginManagerPage.tsx:441 <span aria-hidden>；
   它右侧 .detailActions 里是我们的 button，没有裸 span）。
   若将来官方在详情里加了别的 span[aria-hidden]，本规则会多隐藏一个——退而求其次：优先按
   span+aria-hidden 隐藏，命中不到即原样显示（官方版式不失效、不留半成品）。 */
[data-plugin-item-detail="plugin-market"] span[aria-hidden="true"]{display:none}
.own-market-fileHint{margin:0;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:19px}
.own-market-fileRetry{display:flex;align-items:center;gap:8px}
/* 术语降维新增（详情页专用，列表那份 <style> 不带这些规则）：
   · 来源徽标的包装节点 + 「来源」小标签：完整坐标前给一个人话标签；
   · 「标识」小标签：skillId 那行的人话标签（悬停给说明）；
   · 上游名称解释行：名称里带技术缩写时补一句，只在命中时渲染。 */
.own-market-detailSource{display:inline-flex;align-items:center;gap:4px}
.own-market-detailSourceLabel{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:18px}
.own-market-detailNameLabel{margin-right:6px;color:var(--dsw-alias-label-tertiary,#98a2b3)}
.own-market-upstreamNote{margin:2px 0 0;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:11.5px;line-height:18px}
`

/** 组件行图标：四枚 lucide 图标按 id 定位，避免借用官方 `*Regular` 图标（资料库行与侧栏入口用同一族的 Library）。 */
const COMPONENT_GLYPHS = { plugins: Package, skills: Sparkles, presets: BookMarked, library: Library } as const

function ComponentGlyph({ id }: { readonly id: string }): ReactNode {
  const Glyph = COMPONENT_GLYPHS[id as keyof typeof COMPONENT_GLYPHS] ?? Package
  return <Glyph size={18} aria-hidden="true" />
}

/**
 * 官方 `plugins.detail.badge` 贡献（titleRow 里 h3 旁）：只对本入口出「企业徽章 + 版本号 + 包名」，
 * 其余 subject 返回 null（官方槽语义）。hook 组件：订阅 store 取版本。
 *
 * **座位实物（取证）**：座位在官方包里声明为 `kind: 'list'` / `scope: 'root'`
 * （`@deepseek-ai/dsh-client-ui-plugin-manager`：`lib/types/client/slot-contract.d.ts:131`，
 * 运行时清单 `lib/client.js:3510`），由官方 `ItemDetail` 渲染为
 * `renderSlot("plugins.detail.badge", { subject })`（同包 `lib/client.js:2138`，slot 就在 `titleRow` 的 `h3` 之后），
 * subject 形如 `kind: 'item'` 加 `id: item.id`；**我们这行「插件市场」正是走 `ItemDetail`**
 * （`lib/client.js:3177` 把每个 `plugins.item` 条目渲染成 `ItemCard`，点开设 `kind:'item'` 加 `id`，
 * `lib/client.js:3333` 据此渲染 `ItemDetail`），所以这枚徽章**进得去**。注册形状照官方：`{ name, id, inject }`
 * （注册面在 `client.tsx`），条目只需一个渲染函数，没有 order/条件字段。
 */
export function EnterpriseMarketBadge({ subject, store }: {
  readonly subject: { readonly kind: string; readonly id?: string }
  readonly store?: EnterpriseAccountStore | undefined
}): ReactNode {
  if (subject.kind !== 'item' || subject.id !== ENTERPRISE_MARKET_ENTRY_ID) return null
  const snapshot = useAccount(store as EnterpriseAccountStore)
  return <BadgeView version={snapshot.status?.bundleVersion} />
}

/**
 * 版本签文案（`v{version}`）与「企业」徽章组件的**声明已下沉**到叶子模块 `enterprise-card-text.tsx`：
 * 「企业设置 → 插件」卡片标题行（`plugin-market.tsx`）与本页的列表行/详情徽章现在读**同一份**实现，
 * 不可能漂成两套字面。本文件只在文件顶部 import + re-export（公开面与既有 import 路径一字未变），
 * 这里不再重复声明。
 */

/**
 * badge 槽的纯呈现（照智能体团队 titleRow：企业徽章 + 版本号 + 包名），不调 hook —— 测试直接调用。
 * 产品决策：标题行不再放可拨开关（拨不动的开关像坏的），也不放状态签（只读头部，状态由组件行体现）；
 * **「预览版」文字签也已移除**——它对用户没有任何信息量，却和标题、版本签挤在同一行（窄屏会把它挤到第二行、
 * 白撑高 titleRow）。版本签留（`v{version}` 是真信息）。
 * **本刀（企业标签）**：标题行 `h3` 正后方先挂那枚「企业」徽章（`EnterpriseMarketBadgeTag`），版本签随后。
 * 包名走 `flex-basis:100%` 在官方 `titleRow` 的 `flex-wrap:wrap` 下换行成独立一行——官方 `ItemDetail`
 * 只有 `titleRow → desc` 两行、描述之间无独立插点，包名借官方换行落在标题下、描述上（贴智能体团队 标题→包名→描述）。
 * @param props - `version` 插件 bundle 版本（来自 store status）。
 * @returns 标题行内的「企业」徽章 + 「版本号」签 + 独立换行的「包名」。
 */
export function BadgeView({ version }: { readonly version?: string | undefined }): ReactNode {
  const versionTag = enterpriseMarketVersionTag(version)
  return (
    <>
      <EnterpriseMarketBadgeTag />
      {versionTag === undefined ? null : <Tag className="own-market-tag" tone="neutral">{versionTag}</Tag>}
    </>
  )
}

/* ─────────────────── 标题区右侧动作（官方 plugins.detail.actions 槽） ─────────────────── */

/**
 * 注册面用的**包装组件**：在这里订阅座位源，再把状态交给纯函数 `EnterpriseMarketDetailActions`。
 * 分两层是为了保住「纯函数可直调测试」的既有形状——带 hook 的只有这一层。
 */
export function EnterpriseMarketDetailActionsLive({ subject, tabSeat }: {
  readonly subject: { readonly kind: string; readonly id?: string }
  readonly tabSeat?: EnterpriseMarketTabSeat | undefined
}): ReactNode {
  const state = useEnterpriseMarketTabSeat(tabSeat)
  return <EnterpriseMarketDetailActions subject={subject} tabSeat={state} />
}

/** 标题区右侧两枚按钮的文案真源（用户口径：本刀**都先占位**，不接真动作——刷新的 `store.refreshPlugins()` 与「添加插件」的企业上传语义留下一刀）。 */
export const ENTERPRISE_DETAIL_ACTION_REFRESH_LABEL = '刷新'
export const ENTERPRISE_DETAIL_ACTION_ADD_LABEL = '添加插件'

/**
 * 标题区右侧动作的**纯呈现**（照 `BadgeView`：不调 hook、测试直调）——挂在**官方 `plugins.detail.actions` 槽**上。
 *
 * 为什么走官方槽而不是 DOM 装饰（拿到官方源码后的确证，非推测）：官方 `ItemDetail` 的 `DetailTop`
 * （`ui-plugin-manager/PluginManagerPage.tsx:540`）在 `cardIcon` **右侧**渲染
 * `renderSlot('plugins.detail.actions')`，槽声明 `slot-contract.ts:116` 为 `kind:'list'/scope:'root'`
 * （与 badge 槽 `:121` 同形）⇒ 官方 API 层次**直接给了标题右侧的动作位**，DOM 装饰那条脆路不必走。
 *
 * 两枚都是**占位**（用户裁决 B）：点击 no-op，但走原生 `<button>` + 官方 `Button` 原语 ⇒ 键盘可达、
 * 不禁用、不给假进度；无障碍名如实带「占位」语义，**不冒充能用的动作**（产品宪法：不造死控件）。
 *
 * ★ **必须按 subject 过滤**（与 `EnterpriseMarketBadge` 同一条范式）：官方这个槽是 `kind:'list'/scope:'root'`，
 * `ItemDetail`（`PluginManagerPage.tsx:540`）**和** `RowDetail`（`:583`）、`PackageDetail`（`:642`）三种详情页
 * 都会 `renderSlot('plugins.detail.actions', { subject })` ⇒ 不过滤就是**每个 item 的详情页都出这两枚按钮**
 * （真机实测的泄漏；官方对 list 槽**没有** `only` 过滤，过滤只能自己做——badge 槽正是这么过滤的）。
 * 只对我们这条 item（`kind==='item'` + `id==='plugin-market'`）出，其余一律 `null`。
 * @returns 标题右侧的【刷新】【添加插件】两枚占位按钮（无包装容器——官方 `detailActions` 已是 flex 容器）。
 */
export function EnterpriseMarketDetailActions({ subject, tabSeat }: {
  readonly subject: { readonly kind: string; readonly id?: string }
  /**
   * 页签座位状态（用户口径：4 个页签放到**标题右侧**）。纯函数直调不传 ⇒ 只出两枚按钮、不出页签
   * （本函数保持「无 hook、可直调」的既有形状；订阅在 `EnterpriseMarketDetailActionsLive` 里做）。
   */
  readonly tabSeat?: EnterpriseMarketTabSeatState | undefined
}): ReactNode {
  if (subject.kind !== 'item' || subject.id !== ENTERPRISE_MARKET_ENTRY_ID) return null
  // 两枚按钮**逐项用官方 `Button` 原语本体与官方变体**（用户口径：用官方的样式和执行效果）：
  // · 刷新 = `variant="ghost"` + 前置图标，且**只给图标**（无可见文字 ⇒ `aria-label` 必须完整）
  // · 添加插件 = `variant="primary"` + 前置 `Plus` 图标（`md` = 36px 胶囊，与官方 Figma 按钮同形）
  // 官方原语自带 hover / active / focus-visible / disabled 四态，故「执行效果」不再由本文件自绘。
  return (
    <>
      {/* 页签在**左**、两枚按钮在**右**（用户裁决 A）：页签靠 `margin-right:auto` 占左，刷新那枚靠
          `margin-left:auto` 兜底（没有页签时它自己也会被推到右边）。 */}
      {tabSeat === undefined ? null : (
        <EnterpriseMarketTabList
          entries={tabSeat.entries}
          activeTab={tabSeat.activeTab}
          onSelect={tabSeat.onSelect}
          className="own-market-titleTabs"
        />
      )}
      <Button
        size="md"
        variant="ghost"
        className="own-market-titleActions"
        icon={<RefreshCw aria-hidden size={16} />}
        aria-label={ENTERPRISE_DETAIL_ACTION_REFRESH_LABEL}
        title="占位：本刀未接真刷新，下一刀接 store.refreshPlugins()"
      />
      <Button
        size="md"
        variant="primary"
        icon={<Plus aria-hidden size={16} />}
        aria-label={ENTERPRISE_DETAIL_ACTION_ADD_LABEL}
        title="占位：企业插件由企业后台上传，员工端入口留下一刀"
      >{ENTERPRISE_DETAIL_ACTION_ADD_LABEL}</Button>
    </>
  )
}

/**
 * 标题区那枚 48×48 官方图标的**隐藏**（CSS 级，非 DOM 装饰）：官方 `DetailTop` 的 `cardIcon`
 * （`PluginManagerPage.module.css:233`，48×48 + hairline + radius-lg）在我们改不了的官方源码里，
 * 故只能按官方**稳定结构标记** `data-plugin-item-detail`（`PluginManagerPage.tsx:534`，值＝条目 id）
 * 定位到详情容器，再沿 `.detailHead > .cardIcon` 关系隐藏它——**不猜 CSS module 哈希类名**，
 * 靠的是官方 DOM 关系（`.detailHead` 直系第一个 48×48 盒子）。
 * 样式写在本文件 `detailStyles` 的一条覆盖规则里（下一刀落），命中不到即原样显示（官方版式，不失效、不报错）。
 */
export const ENTERPRISE_DETAIL_CONTAINER_SELECTOR = `[data-plugin-item-detail="${ENTERPRISE_MARKET_ENTRY_ID}"]`

/**
 * 卡片一句话（`summary` 视图）：官方会把它渲染两次（列表卡描述 + 详情页正文），故必须保持单行——
 * 两套外壳共用这一份实现。**本刀（企业标签移回标题行）**：描述行恢复纯文本「企业插件 · 技能 · 配方」，
 * **不再**在这里出胶囊——「企业」标签只在列表标题行（`market-entry-badge.ts` 的 DOM 装饰）与详情页
 * `plugins.detail.badge`（`BadgeView`）两处出现，位置都由用户指定。
 */
function EnterpriseMarketSummaryLine(): ReactNode {
  return (
    <span className="own-market-entry-summary">
      {ENTERPRISE_MARKET_SUMMARY}
    </span>
  )
}

/**
 * 页签条（**两套外壳共用同一份渲染**）：手写 `role="tablist"` + roving `tabIndex` + ←/→/Home/End 走焦并选中。
 * 视觉取值逐值来自 `9723a97` 的 `.own-market-tabs`/`.own-market-tab`（13/20、选中态 2px 下划线、hover/focus 环），
 * 类名改用 `.own-market-storeTabs`/`.own-market-storeTab`——旧名与 `plugin-market.tsx` 同名，两份全局单类
 * `<style>` 会互相覆盖（7557ffd 已因此改名），旧外壳不许退回旧名。
 * 纯函数体**不能持 `ref`**（调 `useRef` 就变成 hook 组件、直调测试即崩），故键盘走焦在 keydown 里从事件源向上
 * 找 `[role="tablist"]`、按同序取第 `index` 个 `[role="tab"]` 调 `focus()`：只在真浏览器事件里执行。
 */
/**
 * 胶囊页签组（`role="tablist"`）的**唯一一份实现**——它现在由**标题右侧那一格**渲染
 * （官方 `plugins.detail.actions` 槽，见 `EnterpriseMarketDetailActions`），而面板仍在页面里，
 * 两处靠 `createEnterpriseMarketTabSeat` 那一份共享源接起来。
 *
 * 手写而不用官方 `SegmentedTabs`：本包编译期 pin 的 primitives 0.1.5-rc.2 不含它（运行时有、直接 import 会 TS 报错）。
 * 纯函数体**不能持 `ref`**（调 `useRef` 就变 hook 组件、直调测试即崩），故键盘走焦在 keydown 里从事件源向上
 * 找 `[role="tablist"]`、按同序取第 `index` 个 `[role="tab"]` 调 `focus()`：只在真浏览器事件里执行。
 * `id` / `aria-controls` / `aria-labelledby` 与面板仍三处同源（面板 id 是常量，跨子树解析不受影响）。
 */
export function EnterpriseMarketTabList({ entries, activeTab, onSelect, className }: {
  readonly entries: EnterpriseMarketShellModel['tabEntries']
  readonly activeTab: EnterpriseMarketTabId
  readonly onSelect?: ((tab: EnterpriseMarketTabId) => void) | undefined
  /** 额外类名（标题行那格用它把页签靠左、与右侧按钮分开）。 */
  readonly className?: string | undefined
}): ReactNode {
  const focusTab = (source: EventTarget | null, index: number): void => {
    const element = source as HTMLElement | null
    if (element === null || typeof element.closest !== 'function') return
    const tablist = element.closest('[role="tablist"]')
    tablist?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus()
  }
  /** ←/→ 循环、Home/End 跳首尾，且都是「走焦 + 选中」一步到位（WAI-ARIA tabs 的自动激活口径）。 */
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number
    switch (event.key) {
      case 'ArrowRight': nextIndex = (index + 1) % entries.length; break
      case 'ArrowLeft': nextIndex = (index - 1 + entries.length) % entries.length; break
      case 'Home': nextIndex = 0; break
      case 'End': nextIndex = entries.length - 1; break
      default: return
    }
    const next = entries[nextIndex]
    if (next === undefined) return
    event.preventDefault()
    onSelect?.(next.id)
    focusTab(event.currentTarget, nextIndex)
  }
  return (
    <div
      role="tablist"
      aria-label={ENTERPRISE_MARKET_TABLIST_LABEL}
      className={className === undefined ? 'own-market-storeTabs' : `own-market-storeTabs ${className}`}
    >
      {entries.map((tab, index) => {
        const selected = tab.id === activeTab
        return (
          <button
            key={tab.id}
            id={ENTERPRISE_MARKET_TAB_IDS[tab.id].tab}
            type="button"
            role="tab"
            className="own-market-storeTab"
            aria-selected={selected}
            aria-controls={ENTERPRISE_MARKET_TAB_IDS[tab.id].panel}
            tabIndex={selected ? 0 : -1}
            onClick={() => { onSelect?.(tab.id) }}
            onKeyDown={(event) => { onTabKeyDown(event, index) }}
          >{tab.text}</button>
        )
      })}
    </div>
  )
}

/* ───────────────── 标题右侧页签的「共享座位」（页面发布、官方槽订阅） ───────────────── */

/** 座位状态：页签条目 + 当前选中 + 选中回调。 */
export interface EnterpriseMarketTabSeatState {
  readonly entries: EnterpriseMarketShellModel['tabEntries']
  readonly activeTab: EnterpriseMarketTabId
  readonly onSelect?: ((tab: EnterpriseMarketTabId) => void) | undefined
}

/** 页签座位源（非 React）：两个注册面是**两棵 React 树**（页面树 / 官方标题行槽），只能靠它接起来。 */
export interface EnterpriseMarketTabSeat {
  subscribe(listener: () => void): () => void
  getSnapshot(): EnterpriseMarketTabSeatState | undefined
  publish(next: EnterpriseMarketTabSeatState | undefined): void
}

/**
 * 建一份页签座位源。`publish` 按「当前选中 + 各页签文案」做**签名比较**，签名没变就**不通知**——
 * 页面每帧都会发布（它在 render 后同步调），没有这道闸就会把订阅方拖进无限重渲染。
 * `onSelect` **不进签名**：它在控制器里每帧重建，进签名等于每帧通知；而它闭包住的只有两个 `setState`
 * （本身稳定），故保留首次那枚在语义上完全等价。
 */
export function createEnterpriseMarketTabSeat(): EnterpriseMarketTabSeat {
  let state: EnterpriseMarketTabSeatState | undefined
  let signature: string | undefined
  const listeners = new Set<() => void>()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot() { return state },
    publish(next) {
      const nextSignature = next === undefined
        ? undefined
        : `${next.activeTab}|${next.entries.map(entry => `${entry.id}:${entry.text}`).join(',')}`
      if (nextSignature === signature) return
      signature = nextSignature
      state = next
      for (const listener of listeners) listener()
    },
  }
}

const EMPTY_SEAT_SUBSCRIBE = (): (() => void) => () => undefined
const EMPTY_SEAT_SNAPSHOT = (): EnterpriseMarketTabSeatState | undefined => undefined

/**
 * 订阅座位（**只在注册面的包装组件里调**——纯函数外壳不许持 hook）。
 * 座位缺席（纯函数直调 / 旧注册面）时：订阅与快照都退到模块级常量，行为恒为 `undefined`。
 */
export function useEnterpriseMarketTabSeat(
  seat: EnterpriseMarketTabSeat | undefined,
): EnterpriseMarketTabSeatState | undefined {
  return useSyncExternalStore(
    seat === undefined ? EMPTY_SEAT_SUBSCRIBE : seat.subscribe,
    seat === undefined ? EMPTY_SEAT_SNAPSHOT : seat.getSnapshot,
    seat === undefined ? EMPTY_SEAT_SNAPSHOT : seat.getSnapshot,
  )
}

function EnterpriseMarketTabStrip({
  model, onSelectTab, searchText, onSearchChange, filterOpen, onToggleFilter,
  filterStatus, filterCategory, onFilterSelect, tabsInTitle,
}: {
  readonly model: EnterpriseMarketShellModel
  readonly onSelectTab?: ((tab: EnterpriseMarketTabId) => void) | undefined
  /** 搜索文本（缺席 = 空串 = 不过滤）。 */
  readonly searchText?: string | undefined
  readonly onSearchChange?: ((text: string) => void) | undefined
  /** 筛选下拉开合（缺席 = 关闭；点触发钮 no-op，不给死菜单）。 */
  readonly filterOpen?: boolean | undefined
  readonly onToggleFilter?: (() => void) | undefined
  /** 两组当前选中值（缺席按各自默认；纯函数不持状态，值从外部传）。 */
  readonly filterStatus?: EnterpriseMarketStatusFilter | undefined
  readonly filterCategory?: EnterpriseMarketCategory | 'all' | undefined
  /** 选中一项（上层保存后真的驱动可见行）。 */
  readonly onFilterSelect?: ((group: EnterpriseMarketFilterGroupId, option: string) => void) | undefined
  /** 座位已接管页签 ⇒ 这一层只画搜索行（页签在标题行那一格）。 */
  readonly tabsInTitle?: boolean | undefined
}): ReactNode {
  /** 某一组当前生效的选项 id（状态组与类型组各取各的；缺席一律落 `'all'`）。 */
  const selectedOf = (group: EnterpriseMarketFilterGroupId): string => (
    group === 'status' ? (filterStatus ?? 'all') : (filterCategory ?? 'all')
  )
  return (
    <>
      {/* 搜索栏 + 筛选钮（照参考图：搜索框**独立整行**、40px 高；筛选钮在它右端）。
          搜索是真过滤（标题/描述/标识的子串匹配）；回调缺席时输入框 readOnly，不给假输入框。 */}
      <div className="own-market-searchRow">
        <span className="own-market-query">
          <Search aria-hidden size={16} className="own-market-queryIcon" />
          <input
            type="search"
            className="own-market-queryInput"
            aria-label={ENTERPRISE_MARKET_SEARCH_LABEL}
            placeholder={ENTERPRISE_MARKET_SEARCH_PLACEHOLDER}
            value={searchText ?? ''}
            readOnly={onSearchChange === undefined}
            onChange={(event) => { onSearchChange?.(event.currentTarget.value) }}
          />
        </span>
        <div className="own-market-filterWrap">
          <button
            type="button"
            className="own-market-filterBtn"
            aria-label={ENTERPRISE_MARKET_FILTER_LABEL}
            aria-expanded={filterOpen === true}
            onClick={() => { onToggleFilter?.() }}
          ><Filter aria-hidden size={16} /></button>
          {filterOpen === true ? (
            <div role="menu" aria-label={ENTERPRISE_MARKET_FILTER_MENU_LABEL} className="own-market-filterMenu">
              {ENTERPRISE_MARKET_FILTER_GROUPS.map(group => (
                <div key={group.id} role="group" aria-label={group.title} className="own-market-filterGroup">
                  {group.options.map(option => {
                    // 选中值缺席 ⇒ 默认「全部」；两组各读各的真值（状态组 / 类型组互不影响）。
                    const checked = selectedOf(group.id) === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={checked}
                        className="own-market-filterOption"
                        onClick={() => { onFilterSelect?.(group.id, option.id) }}
                      >
                        <span className="own-market-filterCheck" aria-hidden="true">
                          {checked ? ENTERPRISE_MARKET_FILTER_CHECK : ''}
                        </span>
                        <span className="own-market-filterLabel">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {tabsInTitle === true ? null : (
        <div className="own-market-tabBar">
          <EnterpriseMarketTabList
            entries={model.tabEntries}
            activeTab={model.activeTab}
            onSelect={onSelectTab}
          />
        </div>
      )}
    </>
  )
}

/**
 * 一个页签的面板外壳（**两套外壳共用**）：`id` / `aria-controls` / `aria-labelledby` 三处同源，
 * 非当前页签只留一个 `hidden` 空壳——既让 `aria-controls` 恒能解析，又保证**内容整段不挂载**
 * （页签已经承担「显隐」，不必为隐藏的页签再渲染一次）。两套外壳都走它，aria 配对不可能在某一套里漂移。
 */
function EnterpriseMarketPanel({ tab, activeTab, children }: {
  readonly tab: EnterpriseMarketTabId
  readonly activeTab: EnterpriseMarketTabId
  readonly children: ReactNode
}): ReactNode {
  return (
    <div
      id={ENTERPRISE_MARKET_TAB_IDS[tab].panel}
      role="tabpanel"
      aria-labelledby={ENTERPRISE_MARKET_TAB_IDS[tab].tab}
      hidden={activeTab !== tab}
      className="own-market-panel"
    >
      {children}
    </div>
  )
}

/**
 * 行内失败提示（**两套外壳共用同一份渲染与文案投影**）：只有行键命中时才出现，`role="alert"` 交给读屏立刻播报，
 * 稳定错误码放在 `code` 里。照「技能」tab 的行内提示口径（`安装失败`/`卸载失败` + `<code>{code}</code>`），
 * 且**不**参与该行开关的 `disabled` 计算——失败恰恰是最需要能再拨一次的场景。
 */
export function EnterpriseMarketRowError({ error, id }: {
  readonly error: EnterpriseMarketActionError | undefined
  readonly id: string
}): ReactNode {
  if (error?.id !== id) return null
  // 术语降维 + 失败自愈：人话 + 下一步动作 + 「技术信息」里的稳定码（唯一映射见 error-messages.ts）。
  return (
    <EnterpriseErrorNotice
      className="own-market-inlineError"
      code={error.code}
      prefix={enterpriseMarketActionErrorLabel(error)}
    />
  )
}

/** 「重新检查这个插件能不能装」那枚按钮的无障碍名（重试的就是目录那次取数）。 */
export const ENTERPRISE_PLUGIN_BLOCKED_RETRY_LABEL = '重新检查这个插件能不能装'

/**
 * 插件行的**可见**状态说明（「为什么现在拨不动」）。
 *
 * 它存在的理由就是产品宪法那条门禁：**禁用控件不许只挂一句 `title`**——原因必须在行上看得见。
 * 原文由 `enterprisePluginLockNotice` 唯一产出（口径真源在 `plugin-install-gate.ts`，
 * 「企业设置 → 插件」读的是同一份），这里只负责落版；没有要说的就整段不进 DOM（安静态不加噪音），
 * 行落点与配方降级链那一句同款（同一个类名）。
 */
export function EnterprisePluginRowNotes({ id, facts }: {
  readonly id: string
  readonly facts: EnterpriseMarketPluginRowFacts
}): ReactNode {
  if (facts.lockNotice === undefined) return null
  return (
    <p className="own-market-rowNote" role="status" data-enterprise-plugin-lock={id}>
      {facts.lockNotice}
    </p>
  )
}

/**
 * 插件行「**安装中**」那一条**真进度**（本刀新落点）。
 *
 * 三件事刻意分开写，免得将来被"顺手"改回假进度：
 *  ① 语义是**不确定态**——`role="progressbar"` 且**不给** `aria-valuenow`/`aria-valuemin`/`aria-valuemax`
 *     （ARIA 口径：没有 `aria-valuenow` 的 progressbar 就是「不知道还剩多少」），
 *     只把**真阶段文字**放进 `aria-valuetext`；故读屏听到的是「正在下载」而不是任何百分比。
 *  ② `aria-live="polite"` + 可见的阶段文字：阶段一推进，文字就换，读屏随之播报「安装中 → 完成」
 *     （收束那一句由下面的 `EnterprisePluginSettledNote` 以 `role="status"` 接着报）。
 *     **文字与动效是两件东西**：关掉动效（`prefers-reduced-motion`）时文字一字不少。
 *  ③ 那条流光 `aria-hidden`：它只是"还在动"的视觉暗示，本身不承载任何信息。
 *
 * 没有进度（`facts.progress === undefined`）时整段不进 DOM——安静的行走安静的路，不给任何行挂装饰。
 *
 * **本刀（真取消）**：`progress.cancelable` 为真时多一枚**真按钮**（官方 `Button` 原语 + Lucide `X`，
 * **一个新 CSS 类都没加**，落在既有 `.own-market-progress` 那一行里）——点它就是 `onCancel(该行)`，
 * 由控制器转给 store 的同源 `POST /plugins/cancel`；取消请求在途时按钮保持可见但 `disabled`、文案改
 * 「正在取消…」，旁边那句进行态交代以 `role="status"` 播报（**不是**死控件）。
 * 不能取消时不画按钮，改画 `progress.cancelNotice` 那句**可见原因**（什么时候可以 / 这条路为什么没有取消面）。
 * `onCancel` 缺席（纯函数直调 / 老调用方）时整枚不渲染——没写入口就不画死按钮。
 */
export function EnterprisePluginProgressNotes({ id, facts, onCancel }: {
  readonly id: string
  readonly facts: EnterpriseMarketPluginRowFacts
  readonly onCancel?: (() => void) | undefined
}): ReactNode {
  const progress = facts.progress
  if (progress === undefined) return null
  return (
    <div
      className="own-market-progress"
      data-enterprise-plugin-progress={id}
      data-enterprise-plugin-progress-phase={progress.phase}
      data-enterprise-plugin-progress-stage={progress.state}
      data-enterprise-plugin-progress-indeterminate={progress.indeterminate ? 'true' : 'false'}
      data-enterprise-plugin-progress-cancelable={progress.cancelable ? 'true' : 'false'}
      data-enterprise-plugin-progress-canceling={progress.canceling ? 'true' : 'false'}
    >
      <span
        className="own-market-progressFlow"
        role="progressbar"
        aria-live="polite"
        aria-label={`${id} 安装进度`}
        aria-valuetext={progress.stageText}
      />
      <span className="own-market-progressText">{progress.stageText}</span>
      {progress.readFailedNotice === undefined ? null : (
        <span className="own-market-progressNote">{progress.readFailedNotice}</span>
      )}
      {/* 真取消入口：只有官方取消句柄真的在（`cancelable`）且写入口在场时才画。 */}
      {progress.cancelable && onCancel !== undefined ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={progress.canceling}
          title={progress.canceling ? ENTERPRISE_PLUGIN_PROGRESS_CANCELLING : `取消安装 ${id}`}
          aria-label={progress.canceling ? `正在取消 ${id} 的安装` : `取消安装 ${id}`}
          icon={<X size={14} aria-hidden />}
          onClick={() => { onCancel() }}
        >
          {progress.canceling ? '正在取消…' : '取消安装'}
        </Button>
      ) : null}
      {/* 不能取消就说清为什么（可见、不静默）；正在取消时这里是进行态并以 `role="status"` 播报。 */}
      {progress.cancelNotice === undefined ? null : (
        <span className="own-market-progressNote" role={progress.canceling ? 'status' : undefined}>
          {progress.cancelNotice}
        </span>
      )}
    </div>
  )
}

/**
 * 插件行「刚结束的那一次安装/卸载」的**落地交代**（"完成/需重启"的明确收束）。
 *
 * `role="status"`（不是 `alert`）：它不是打断，但读屏要能接着进度那条播报收到「安装完成…」。
 * 失败**不**走这里——失败由 `EnterpriseMarketRowError` 那条 `role="alert"` + 可重拨的开关负责，
 * 两件事不会同时出（`enterprisePluginProgress` 在失败态直接返回 `undefined`）。
 */
export function EnterprisePluginSettledNote({ id, facts }: {
  readonly id: string
  readonly facts: EnterpriseMarketPluginRowFacts
}): ReactNode {
  if (facts.settledNotice === undefined) return null
  return (
    <p className="own-market-progressSettled" role="status" data-enterprise-plugin-settled={id}>
      {facts.settledNotice}
    </p>
  )
}

/**
 * **目录页签内容区的三态落点**（两套外壳共用；加载中 / 空 / 失败）。
 * 就绪态由调用方直接铺行（`EnterpriseMarketInlineRows`），这里只负责「还没有行」的那三种：
 *  · 加载中：`role="status"` 的轻提示（首帧就看得见，不空白）；
 *  · 空：说清「为什么空」+ 下一步（不是失败、也不假装没数据）；
 *  · 失败：复用唯一提示组件（人话 + 下一步 + 「技术信息」里的码）+ 重试按钮（**真的重发**取数）。
 * 重试回调缺席时不渲染按钮（照本仓「不给死按钮」的既有降级口径）。
 */
export function EnterpriseMarketListHint({ state, onRetry }: {
  readonly state: EnterpriseMarketPanelState
  readonly onRetry?: (() => void) | undefined
}): ReactNode {
  if (state.kind === 'hidden' || state.kind === 'ready') return null
  return (
    <div className="own-market-listState" data-market-list-state={state.kind}>
      {state.kind === 'failed' ? (
        <>
          <EnterpriseErrorNotice className="own-market-inlineError" code={state.code} prefix={state.prefix} />
          {onRetry === undefined ? null : (
            <div className="own-market-listRetry">
              <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} aria-label={ENTERPRISE_LIST_RETRY_LABEL}
                onClick={() => { onRetry() }}>
                {ENTERPRISE_LIST_RETRY}
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="own-market-listHint" role="status">{state.hint}</p>
      )}
    </div>
  )
}

/**
 * **「过滤后为空」的唯一落点**（本刀新增）：目录本身有数据、只是被搜索 / 状态 / 类型筛没了。
 *
 * 为什么单独一枚而不是复用 `EnterpriseMarketListHint`：那枚说的是「目录为空 / 加载中 / 取数失败」，
 * 原因与下一步动作**完全不同**——把「筛没了」说成「没有数据」会让用户以为后台没东西可发。
 * 「清空筛选」按钮只在真的给了回调时才画（回调缺席 = 不给点了没反应的按钮）。
 */
export function EnterpriseMarketFilteredHint({ onClear }: {
  readonly onClear?: (() => void) | undefined
}): ReactNode {
  return (
    <div className="own-market-listState" data-market-list-state="filtered">
      <p className="own-market-listHint" role="status">{ENTERPRISE_MARKET_FILTER_EMPTY}</p>
      {onClear === undefined ? null : (
        <div className="own-market-listRetry">
          <Button size="sm" onClick={() => { onClear() }}>
            {ENTERPRISE_MARKET_FILTER_CLEAR_LABEL}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * **次级取数降级的可见交代**（非打扰但可见）：目录本身读到了，但「已装状态」或「部分技能的最新版本」
 * 这次没读出来——这句话如实说明是哪一件事实没读全，并给按钮重试整份取数。
 *
 * 措辞**全部取自唯一映射**（`error-messages.ts` 的人话与下一步），本组件不新造第二套错误文案；
 * 用 `role="status"`（不是 `alert`）：它是降级提示，不是打断。
 */
export function EnterpriseMarketDegradedNotice({ code, subject, onRetry }: {
  readonly code: string
  /** 没读全的那件事实（如「已装状态」「部分技能的最新版本」）。 */
  readonly subject: string
  readonly onRetry?: (() => void) | undefined
}): ReactNode {
  const presentation = enterpriseErrorPresentation(code)
  return (
    <p className="own-market-degraded" role="status">
      {`${subject}暂时没有读取到：${presentation.message}下一步：${presentation.action}`}
      {onRetry === undefined ? null : (
        <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} aria-label={ENTERPRISE_LIST_RETRY_LABEL}
          onClick={() => { onRetry() }}>
          {ENTERPRISE_LIST_RETRY}
        </Button>
      )}
    </p>
  )
}

/**
 * 「组件」页签的内容（**两套外壳共用**）：这是页签化后**唯一还带折叠语义**的一节。
 * 节头照官方 groupToggle button（chevron + 标题 + 计数同排，`aria-expanded`/`aria-controls`），
 * 折叠态列表整段条件渲染不进 DOM（照官方 groupBody 的 `{open ? <div> : null}`——`.own-market-rows{display:flex}`
 * 类选择器会覆盖 UA 的 `[hidden]{display:none}`，用 hidden 属性列表不会消失，本仓实测已抓出）。
 */
function EnterpriseMarketComponentsPanel({ model, onToggleSection, onOpenLogin, onToggleLibrary, onRetryLibrarySave }: {
  readonly model: EnterpriseMarketShellModel
  readonly onToggleSection: ((section: EnterpriseMarketSectionId) => void) | undefined
  readonly onOpenLogin: (() => void) | undefined
  /** 本机开关（资料库）的拨动；缺席时那一行的 Switch 禁用（模型里已算好禁用口径）。 */
  readonly onToggleLibrary: ((next: boolean) => void) | undefined
  /** 本机开关失败后的重试；缺席即不渲染那枚重试按钮（不给死按钮）。 */
  readonly onRetryLibrarySave: (() => void) | undefined
}): ReactNode {
  return (
    <section className="own-market-section">
      <div className="own-market-sectionHead">
        <button
          type="button"
          className="own-market-groupToggle"
          aria-expanded={model.componentsOpen}
          aria-controls={`market-section-${ENTERPRISE_MARKET_SECTION_IDS.components}`}
          disabled={!model.canToggleSection}
          title={model.canToggleSection ? undefined : '折叠动作未接通'}
          onClick={() => { onToggleSection?.('components') }}
        >
          <ChevronDown className="own-market-chevron" size={12} aria-hidden="true" />
          <span className="own-market-groupTitle">内容清单</span>
        </button>
        <span className="own-market-sectionCount">{model.componentSummaryText}</span>
      </div>
      {model.componentsOpen ? (
        <ul className="own-market-rows" id={`market-section-${ENTERPRISE_MARKET_SECTION_IDS.components}`}>
          {model.componentRows.map(row => (
            <li
              key={row.id}
              className="own-market-row"
              data-market-component={row.id}
              data-state={row.enabled ? 'on' : 'off'}
            >
              <div className="own-market-rowLine">
                <span className="own-market-rowIcon"><ComponentGlyph id={row.id} /></span>
                <div className="own-market-rowMain">
                  <span className="own-market-rowId">{row.label}</span>
                  <span className="own-market-rowNote">{row.note}</span>
                  {/* 术语降维：`row.module`（如 `dsh-preset / .dshpreset`）是内部模块路径，
                      按产品宪法「manifest / YAML / preset / bundle 不上屏」**不再渲染**；
                      它只留在 `ENTERPRISE_MARKET_COMPONENTS` 里作交付台账（有反向锁用例守着它不上树）。 */}
                </div>
                <span className="own-market-rowState">
                  <StateDot state={row.dot} />
                  {row.state}
                </span>
                {/* 开关的归属决定 `onChange` 走哪条动作：企业会话行请登录（既有口径一字未动），
                    本机设置行（资料库）真的拨动那个本地开关——**立刻生效**（侧栏入口随之出现/撤下）。 */}
                <Switch
                  checked={row.enabled}
                  label={`启用${row.label}`}
                  disabled={row.switchDisabled}
                  title={row.switchTitle}
                  onChange={(next) => {
                    if (row.gate === 'local') {
                      onToggleLibrary?.(next)
                      return
                    }
                    onOpenLogin?.()
                  }}
                />
              </div>
              {/* 本机开关失败：唯一提示组件（人话 + 下一步 + 收进「技术信息」的稳定码）+ **真的重发**的重试。
                  失败**不**禁用开关（再拨一次就是重试），故这里只补一行可见交代。 */}
              {row.gate === 'local' && model.libraryError !== undefined ? (
                <>
                  <EnterpriseErrorNotice className="own-market-inlineError" code={model.libraryError} />
                  {model.canRetryLibrary ? (
                    <div className="own-market-listRetry">
                      <Button
                        size="sm"
                        icon={<RefreshCw aria-hidden size={14} />}
                        aria-label={ENTERPRISE_LIST_RETRY_LABEL}
                        onClick={() => { onRetryLibrarySave?.() }}
                      >
                        {ENTERPRISE_LIST_RETRY}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/**
 * **技能行那两个动作的唯一实现**（`[有更新]` 辅助标签 + 官方 `Switch`）。
 *
 * 行的可点本体（`EnterpriseMarketInlineRows`）与**详情子页面**（`EnterpriseSkillDetailPage`）渲染的是
 * **同一枚子块**，吃同一份 `facts`（唯一入口 `enterpriseMarketSkillRowFacts`）与同一个 `onToggleSkill` 回调——
 * 「详情里的动作与行上同源」因此是结构性的：文案、禁用口径、无障碍名与悬浮说明全部只在 facts 里算一次，
 * 两个落点不可能各说一套，也不可能有第二个状态副本。
 *
 * 返回**数组**而不是 Fragment：行线的 DOM 大纲与 `[有更新]`/`Switch` 的相对顺序是既有测试的取证点，
 * 数组让这两个元素在树里仍然是行线的直属同级项（Fragment 会成为中间节点、把顺序取证挡在外面）。
 * 详情子页面那边也按数组渲染（收在 `.own-market-detailActions` 里），因此顺序语义与行上完全一致。
 *
 * @param row - 这一行的目录投影（标题与动作语义从它取）。
 * @param facts - 行 facts（`enterpriseMarketSkillRowFacts` 的产出）。
 * @param onToggleSkill - 与行上同一个回调；缺席即禁用（不提供假切换）。
 * @returns `[有更新（命中才出）, 官方 Switch]`。
 */
/**
 * 卡片操作区的**两件文案真源**（用户口径：不要开关——未安装给「安装」按钮、已安装给「⋯」）。
 * 就地取词，不各写一份。
 */
export const ENTERPRISE_MARKET_INSTALL_TEXT = '安装'
export const ENTERPRISE_MARKET_ENABLE_TEXT = '启用'
export const ENTERPRISE_MARKET_DISABLE_TEXT = '停用'
export const ENTERPRISE_MARKET_UNINSTALL_TEXT = '卸载'
export const ENTERPRISE_MARKET_MORE_LABEL = '更多操作'

/**
 * 「内置」的**唯一判定**（用户口径：后台分配 / 预置的算内置，内置项**不给「卸载」**）。
 *
 * 为什么落在 `inCatalog` 上：这是现有数据面里**唯一**能表达「后台还在给这一项」的事实——
 * 仍由企业目录提供 ＝ 后台分配/预置（内置，员工动不了）；已不在目录 ＝ 员工自己装的或已被下架
 * （非内置，允许卸载）。**核心包不在这份列表里**（用户口径），故不参与判定。
 * 将来若企业有专门的受保护清单，Host 只需多下发一个布尔事实，**只改这一枚投影**即可。
 */
export function enterpriseMarketPluginBuiltin(row: EnterpriseMarketPluginRow): boolean {
  return row.inCatalog
}

/**
 * 插件行的「**有更新**」判定（用户口径：更多菜单按实际功能需求显示，可能包括更新）。
 *
 * 两件真源：本机记录版本 `recordVersion` 与目录版本 `version` —— 都在且**不相等** ⇒ 目录上有别的版本。
 * 任一缺席/为空一律**不判更新**（宁可少说一句，也不猜「有更新」——与技能侧
 * `enterpriseMarketSkillRowHasUpdate` 的同一口径：取不到事实就不说）。
 */
export function enterpriseMarketPluginHasUpdate(row: EnterpriseMarketPluginRow): boolean {
  const local = row.recordVersion ?? null
  const catalog = row.version
  return local !== null && local !== '' && catalog !== null && catalog !== '' && local !== catalog
}

/** 「⋯」菜单的一项（`onSelect` 缺席 ⇒ 该项禁用；不给点了没反应的项）。 */
export interface EnterpriseMarketRowMenuItem {
  readonly id: string
  readonly label: string
  readonly onSelect?: (() => void) | undefined
  readonly disabled?: boolean | undefined
  readonly title?: string | undefined
}

/**
 * 行操作区的**唯一一枚溢出菜单**（「⋯」）：未安装/未启用不画它（那时给一枚「安装」按钮）。
 *
 * 开合状态**不在本组件内**（纯函数不持状态）：由 `open` + `onToggle` 从上层供给，与筛选下拉同一范式。
 * 一项都没有 ⇒ 整段不渲染（不给一枚点开是空的按钮）。
 * **ARIA**：`role="menu"` + `role="menuitem"`；触发钮**不挂** `aria-haspopup`——本页既有测试锁
 * 「全树零 aria-haspopup」，那条锁的意图是禁掉 dialog 语义，菜单的开合用 `aria-expanded` 表达。
 */
export function EnterpriseMarketRowMenu({ subject, open, onToggle, items }: {
  readonly subject: string
  readonly open?: boolean | undefined
  readonly onToggle?: (() => void) | undefined
  readonly items: readonly EnterpriseMarketRowMenuItem[]
}): ReactNode {
  if (items.length === 0) return null
  const label = `${ENTERPRISE_MARKET_MORE_LABEL}：${subject}`
  const renderItem = (item: EnterpriseMarketRowMenuItem, inMenu: boolean): ReactNode => (
    <button
      key={item.id}
      type="button"
      role={inMenu ? 'menuitem' : undefined}
      className="own-market-moreItem"
      disabled={item.disabled === true}
      title={item.title}
      onClick={() => { item.onSelect?.() }}
    >{item.label}</button>
  )
  // 没有下拉宿主（详情子页面那种纯展示场景）⇒ **直接平铺**操作，而不是画一枚点不开的「⋯」。
  if (typeof onToggle !== 'function') {
    return <span className="own-market-moreInline">{items.map(item => renderItem(item, false))}</span>
  }
  return (
    <span className="own-market-more">
      <button
        type="button"
        className="own-market-moreBtn"
        aria-label={label}
        aria-expanded={open === true}
        onClick={() => { onToggle?.() }}
      ><MoreHorizontal aria-hidden size={16} /></button>
      {open === true ? (
        <span role="menu" aria-label={label} className="own-market-moreMenu">
          {items.map(item => renderItem(item, true))}
        </span>
      ) : null}
    </span>
  )
}

/**
 * **技能行动作区的唯一实现**（`EnterpriseMarketSkillRowActions`）：用户口径「卡片操作按钮不要开关」——
 * 未安装 ⇒ 一枚「安装」按钮；已安装 ⇒ 「⋯」菜单（有更新时第一项是「更新」，其后是「卸载」）。
 *
 * 与技能侧同一条结构纪律：行本体与**技能详情子页面**渲染的是**同一枚子块**，吃同一份 `facts` 与同一个回调
 * ——「详情里的动作与行上同源」因此是结构性的。技能由**员工自己点安装**，故技能侧没有「内置不可卸载」这回事
 * （`enterpriseMarketPluginBuiltin` 只用于插件行）。
 */
export function EnterpriseMarketSkillRowActions({ row, facts, onToggleSkill, menuOpen, onToggleMenu }: {
  readonly row: EnterpriseMarketSkillRow
  readonly facts: EnterpriseMarketSkillRowFacts
  readonly onToggleSkill: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
  /** 「⋯」是否展开（缺席 = 关闭）。 */
  readonly menuOpen?: boolean | undefined
  readonly onToggleMenu?: (() => void) | undefined
}): ReactNode {
  const blocked = onToggleSkill === undefined || facts.busy
  const blockedTitle = onToggleSkill === undefined ? '企业账号未登录，暂不可操作' : '动作进行中，暂不可操作'
  // 未安装 ⇒ 「安装」按钮（取代原先那枚 Switch）。
  if (!facts.enabled) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="own-market-installBtn"
        data-enterprise-skill-slot="install"
        disabled={blocked}
        title={blocked ? blockedTitle : '安装到 ~/.dsh/skills'}
        aria-label={`安装企业技能 ${row.displayName}`}
        onClick={() => { onToggleSkill?.(row, true) }}
      >{ENTERPRISE_MARKET_INSTALL_TEXT}</Button>
    )
  }
  // 已安装 ⇒ 「⋯」：这一行**真实**能做的事（有更新才有「更新」；「卸载」恒有——技能是员工自己装的）。
  return (
    <EnterpriseMarketRowMenu
      subject={row.displayName}
      open={menuOpen}
      onToggle={onToggleMenu}
      items={[
        ...(facts.hasUpdate ? [{
          id: 'update',
          label: facts.updateTag.label,
          title: blocked ? blockedTitle : facts.updateTag.title,
          disabled: blocked,
          onSelect: () => { onToggleSkill?.(row, true) },
        }] : []),
        {
          id: 'uninstall',
          label: ENTERPRISE_MARKET_UNINSTALL_TEXT,
          title: blocked ? blockedTitle : '从本机卸载这份技能',
          disabled: blocked,
          onSelect: () => { onToggleSkill?.(row, false) },
        },
      ]}
    />
  )
}

/**
 * **配方行动作区的唯一实现**（`EnterpriseMarketPresetRowActions`）：一枚与技能/插件行**同款**的官方 `Switch`
 * （三态：未授权 → 关、已授权未装 → 关、已装 → 开），外加**降级链**在 ① 不可用时给的那两枚动作。
 *
 * 与技能侧同一条结构纪律：行本体（`EnterpriseMarketInlineRows` 的 presets 分支）与**配方详情子页面**
 * 渲染的是**同一枚子块**，吃同一份 `facts`（唯一入口 `enterpriseMarketPresetRowFacts`）与同一批回调——
 * 「详情里的动作与行上同源」因此是结构性的；三态、可拨性、降级级别与可见说明全部只在 facts 里算一次。
 *
 * 三件不可让步的口径：
 *   · **绝不静默降级**：只要走了第二级或第三级，就一定会有一句 `facts.fallback.note` 上屏
 *     （由 `EnterpriseMarketPresetFallbackNote` 渲染在行下），说明为什么没走一键启用；
 *   · **失败不禁用**：`switchDisabled` 只看「没写入口 / 进行中 / 真值没读到」，**不看**失败码——
 *     再拨一次就是重试（D1 第 4 条）；
 *   · **不给死按钮**：任何回调缺席就整枚不渲染，而不是画一枚点了没反应的控件。
 *
 * @param row - 这一行的配方投影（动作语义从它取）。
 * @param facts - 行 facts（`enterpriseMarketPresetRowFacts` 的产出）。
 * @param onToggle - 真开关的拨动（与行上同一个回调）；缺席即降级链往下走。
 * @param onOpenInNewSession - 降级链第二级（跳新会话并填入指令）；缺席即这一级不可用。
 * @param onCopy - 降级链第三级（复制到剪贴板）；缺席即不渲染那枚按钮。
 * @returns 动作元素数组（Switch 或降级动作）。
 */
export function EnterpriseMarketPresetRowActions({ row, facts, onToggle, onOpenInNewSession, onCopy, menuOpen, onToggleMenu }: {
  readonly row: EnterpriseMarketPresetRow
  readonly facts: EnterpriseMarketPresetRowFacts
  readonly onToggle: ((row: EnterpriseMarketPresetRow, next: boolean) => void) | undefined
  readonly onOpenInNewSession: ((row: EnterpriseMarketPresetRow) => void) | undefined
  readonly onCopy: ((row: EnterpriseMarketPresetRow) => void) | undefined
  /** 「⋯」是否展开（缺席 = 关闭）。 */
  readonly menuOpen?: boolean | undefined
  readonly onToggleMenu?: (() => void) | undefined
}): ReactNode {
  // ① 一键启用不可用：给出 ②（优先）与 ③（兜底），绝不放一枚拨不动的开关。
  if (facts.fallback.level !== 'one-click') {
    return [
      facts.canOpenInNewSession && onOpenInNewSession !== undefined ? (
        <button
          key="new-session"
          type="button"
          className="own-market-skillTag"
          data-enterprise-preset-new-session={row.id}
          aria-label={`${ENTERPRISE_PRESET_NEW_SESSION_LABEL}：${row.displayName}`}
          title={ENTERPRISE_PRESET_NEW_SESSION_LABEL}
          onClick={() => { onOpenInNewSession(row) }}
        >
          {ENTERPRISE_PRESET_NEW_SESSION_TEXT}
        </button>
      ) : null,
      facts.canCopyInstruction && onCopy !== undefined ? (
        <button
          key="copy"
          type="button"
          className="own-market-skillTag"
          data-enterprise-preset-copy={row.id}
          aria-label={`${ENTERPRISE_PRESET_COPY_LABEL}：${row.displayName}`}
          title={facts.copied ? '已复制到剪贴板' : '复制后粘贴给助手，即可按提示导入这条配方'}
          onClick={() => { onCopy(row) }}
        >
          {facts.copied ? ENTERPRISE_PRESET_COPIED_TEXT : ENTERPRISE_PRESET_COPY_TEXT}
        </button>
      ) : null,
    ]
  }
  // ① 一键启用可用：用户口径「卡片操作按钮不要开关」——未启用 ⇒ 一枚「启用」按钮；
  // 已启用 ⇒ 「⋯」菜单（配方只有启用/停用这一件事，故菜单里只有「停用」）。
  if (!facts.enabled) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="own-market-installBtn"
        data-enterprise-preset-slot="enable"
        disabled={onToggle === undefined || facts.switchDisabled}
        title={onToggle === undefined ? '企业账号未登录，暂不可操作' : facts.switchTitle}
        aria-label={`${ENTERPRISE_MARKET_ENABLE_TEXT}企业配方 ${row.displayName}`}
        onClick={() => { onToggle?.(row, true) }}
      >{ENTERPRISE_MARKET_ENABLE_TEXT}</Button>
    )
  }
  return (
    <EnterpriseMarketRowMenu
      subject={row.displayName}
      open={menuOpen}
      onToggle={onToggleMenu}
      items={[{
        id: 'disable',
        label: ENTERPRISE_MARKET_DISABLE_TEXT,
        title: onToggle === undefined ? '企业账号未登录，暂不可操作' : facts.switchTitle,
        disabled: onToggle === undefined || facts.switchDisabled,
        onSelect: () => { onToggle?.(row, false) },
      }]}
    />
  )
}

/**
 * 降级链那一句**可见说明**（第二级 / 第三级时才有；① 可用时整个元素不进 DOM）。
 *
 * 它就是为了「三级之间切换必须可见说明为什么走了这条路」而存在的：`note` 由
 * `enterprisePresetFallbackPlan` 唯一产出，行上与详情里读的是同一份 facts，因此不存在第二条说明。
 */
export function EnterpriseMarketPresetFallbackNote({ facts, id }: {
  readonly facts: EnterpriseMarketPresetRowFacts
  readonly id: string
}): ReactNode {
  if (facts.fallback.note === undefined) return null
  return (
    <p
      className="own-market-rowNote"
      role="status"
      data-enterprise-preset-fallback={id}
      data-enterprise-preset-fallback-level={facts.fallback.level}
    >
      {facts.fallback.note}
    </p>
  )
}

/**
 * **启用成功后**那一句可见交代（「将在新会话生效」）。
 *
 * 它就是为了让官方两种落地方式（热生效 / 需重启）都诚实呈现（`docs/notes/preset-approval-spike.md`
 * §5.1 第 3 条）而存在的：没有它，员工点完启用只看得到开关翻了一下，**看不到「什么时候在哪生效」**
 * ——那正是本刀要消灭的含混。原文由 `enterprisePresetAppliedNotice` 唯一产出，行上与详情里同源。
 */
export function EnterpriseMarketPresetAppliedNote({ facts, id }: {
  readonly facts: EnterpriseMarketPresetRowFacts
  readonly id: string
}): ReactNode {
  if (facts.appliedNotice === undefined) return null
  return (
    <p
      className="own-market-rowNote"
      role="status"
      data-enterprise-preset-applied={id}
    >
      {facts.appliedNotice}
    </p>
  )
}

/** 授权弹层的免责声明（逐字对齐官方原型的信息密度；官方那句是 zh 版）。 */
export const ENTERPRISE_PRESET_APPROVAL_DISCLAIMER = '请确认插件来源可信。插件在本机以你的权限运行，来源不明的插件可能损坏 DeepSeek Harness，或读取和泄露你的数据。'
/** 弹层标题（不带技术词）。 */
export const ENTERPRISE_PRESET_APPROVAL_TITLE = '确认启用这条配方'
/** 会装的东西那一节标题（与官方安装确认同款口径：逐项列出「会装什么」）。 */
export const ENTERPRISE_PRESET_APPROVAL_BUNDLES_TITLE = '会安装的内容'
/** 会挂载的模块那一节标题。 */
export const ENTERPRISE_PRESET_APPROVAL_MOUNTS_TITLE = '会挂载的模块'
/** 指纹已变时那句可见说明（**必须**说清是「内容变了」而不是泛泛的重试）。 */
export const ENTERPRISE_PRESET_APPROVAL_STALE_NOTE = '这条配方的内容变了，需要重新确认后才能启用。'
/** 两枚按钮的文案（弹层自己造，不必照抄官方那套「允许一次」的 per-call 语义）。 */
export const ENTERPRISE_PRESET_APPROVAL_CONFIRM = '确认并启用'
export const ENTERPRISE_PRESET_APPROVAL_CANCEL = '取消'
/** 清单确实为空时的如实交代（不白屏、也不假装列过了）。 */
export const ENTERPRISE_PRESET_APPROVAL_EMPTY = '这条配方没有额外要安装或挂载的内容。'

/**
 * 授权弹层的输入（**唯一构造点**是共享控制器：所有事实都取自行上同一份真值）。
 */
export interface EnterprisePresetApprovalProps {
  readonly row: EnterpriseMarketPresetRow
  readonly facts: EnterpriseMarketPresetRowFacts
  /** 这次要员工确认的那份披露清单（`status.disclosure`；与随后 enable 校验的是同一次渲染）。 */
  readonly disclosure: EnterprisePresetDisclosure
  /** 指纹已变（员工此前确认的是另一份内容）→ 弹层出 `ENTERPRISE_PRESET_APPROVAL_STALE_NOTE`。 */
  readonly fingerprintChanged: boolean
  /** 上一次确认尝试的失败码（如确认瞬间内容又变了 → `ENT_PRESET_AUTHORIZATION_STALE`）。 */
  readonly errorCode?: string | undefined
  /** 提交中：两枚按钮禁用防连点；失败后重新可用（失败不禁用重试）。 */
  readonly busy: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/**
 * **自造授权弹层**（`docs/notes/preset-approval-spike.md` §5.3：官方只在 Agent 工具面有一套 per-call 弹层，
 * Web 界面面根本没有，授权 UX 归我们）。
 *
 * 与官方那句信任声明**同等信息密度**，并且比它多两件事：
 *   ① **逐项披露**——会装哪些内容（`disclosure.bundles`：名称 + 简述）、会挂载哪些模块（`disclosure.mounts`）；
 *   ② **一次授权绑当前指纹**——员工点确认时回传的是 `disclosure.fingerprint`，Host 侧要求它与当前配方逐字
 *      相等；内容变了就是 `ENT_PRESET_AUTHORIZATION_STALE`，弹层会说明「内容变了，需要重新确认」。
 *
 * 它是纯函数（无 hook、不发请求），因此可以直接函数调用测试；渲染用自造的 `role="dialog"` 覆盖层
 * 而不是官方 `Modal`——授权弹层里**不该**出现任何「允许一次」这样的 per-call 语义，那是官方闸门的短板。
 */
export function EnterprisePresetApprovalDialog(props: EnterprisePresetApprovalProps): ReactNode {
  const titleId = `enterprise-preset-approval-title-${props.row.id}`
  return (
    <div className="own-market-approvalBackdrop" data-enterprise-preset-approval={props.row.id}>
      <div className="own-market-approval" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h3 className="own-market-approvalTitle" id={titleId}>{ENTERPRISE_PRESET_APPROVAL_TITLE}</h3>
        <p className="own-market-approvalSubject" data-enterprise-preset-approval-subject={props.row.id}>
          {props.row.displayName}
        </p>
        {props.fingerprintChanged ? (
          <p className="own-market-approvalStale" role="status" data-enterprise-preset-approval-stale="true">
            {ENTERPRISE_PRESET_APPROVAL_STALE_NOTE}
          </p>
        ) : null}
        <div className="own-market-approvalList" data-enterprise-preset-approval-bundles={props.row.id}>
          <h4 className="own-market-approvalListTitle">{ENTERPRISE_PRESET_APPROVAL_BUNDLES_TITLE}</h4>
          {props.disclosure.bundles.length === 0 ? (
            <p className="own-market-rowNote">{ENTERPRISE_PRESET_APPROVAL_EMPTY}</p>
          ) : (
            <ul className="own-market-approvalItems">
              {props.disclosure.bundles.map(item => (
                <li className="own-market-approvalItem" key={item.name} data-enterprise-preset-approval-bundle={item.name}>
                  <span className="own-market-cardId">{item.name}</span>
                  <span className="own-market-cardDesc">{item.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="own-market-approvalList" data-enterprise-preset-approval-mounts={props.row.id}>
          <h4 className="own-market-approvalListTitle">{ENTERPRISE_PRESET_APPROVAL_MOUNTS_TITLE}</h4>
          {props.disclosure.mounts.length === 0 ? (
            <p className="own-market-rowNote">{ENTERPRISE_PRESET_APPROVAL_EMPTY}</p>
          ) : (
            <ul className="own-market-approvalItems">
              {props.disclosure.mounts.map(item => (
                <li className="own-market-approvalItem" key={item.name} data-enterprise-preset-approval-mount={item.name}>
                  <span className="own-market-cardId">{item.name}</span>
                  <span className="own-market-cardDesc">{item.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* 免责声明：与官方原型逐字同句（信息密度对齐），不额外承诺「已通过安全检测」（我们没做扫描）。 */}
        <p className="own-market-approvalDisclaimer" data-enterprise-preset-approval-disclaimer="true">
          {ENTERPRISE_PRESET_APPROVAL_DISCLAIMER}
        </p>
        {props.errorCode === undefined ? null : (
          <EnterpriseErrorNotice className="own-market-inlineError" code={props.errorCode} prefix="启用失败" />
        )}
        <div className="own-market-approvalActions">
          <Button
            size="sm"
            disabled={props.busy}
            onClick={() => { props.onCancel() }}
          >
            {ENTERPRISE_PRESET_APPROVAL_CANCEL}
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={props.busy}
            data-enterprise-preset-approval-confirm={props.row.id}
            onClick={() => { props.onConfirm() }}
          >
            {ENTERPRISE_PRESET_APPROVAL_CONFIRM}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * 详情子页面里**一条文件树行**（纯投影、无 DOM，测试直调）。
 *
 * Host 回传的是**扁平**条目（`path` + `kind` + `sizeBytes`，按 `path` 码元升序），
 * 层级感由路径本身给出：`depth` = 相对技能目录的嵌套层数（技能目录那一层是 0），
 * `parent` = 所在目录的路径（根为 `''`）。界面据 `depth` 缩进、据 `kind` 区分文件与目录。
 */
export interface EnterpriseSkillTreeRow {
  readonly path: string
  /** 路径最后一段（缩进之后真正显示的名字）。 */
  readonly name: string
  readonly kind: 'file' | 'directory'
  readonly sizeBytes: number
  /** 相对技能目录的嵌套层数（0 = 技能目录本身，1 = 它里面的文件/子目录，依此类推）。 */
  readonly depth: number
  /** 所在目录的路径（根目录为 `''`）。 */
  readonly parent: string
}

/**
 * 扁平条目 → 树行（纯函数）。
 *
 * 排序照 Host 的同一口径（`path` 码元升序）：`'/'`（0x2F）排在所有名字字符之前，
 * 因此这个顺序天然是「父目录紧跟其后代」的先序遍历，按 `depth` 缩进出来就是一棵树；
 * 这里**再排一次**是为了让「直接构造条目」的调用方（测试、将来别的数据源）也拿到同一棵树。
 *
 * @param entries - Host 文件树条目（或同形状的构造输入）。
 * @returns 按先序排列的树行（`depth`/`parent`/`name` 已算好）。
 */
export function enterpriseSkillTreeRows(entries: readonly EnterpriseSkillFileEntry[]): EnterpriseSkillTreeRow[] {
  return [...entries]
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
    .map((entry) => {
      const segments = entry.path.split('/')
      return {
        path: entry.path,
        name: segments[segments.length - 1] ?? entry.path,
        kind: entry.kind,
        sizeBytes: entry.sizeBytes,
        depth: segments.length - 1,
        parent: segments.slice(0, -1).join('/'),
      }
    })
}

/** 技能正文的固定文件名（官方 `skill-filesystem` 的发现面约定，与 bundle 的 `SKILL_CONTENT_FILENAME` 逐字同值）。 */
export const ENTERPRISE_SKILL_CONTENT_FILENAME = 'SKILL.md'

/**
 * **默认选中并预览**的文件：本包已装记录里第一个技能目录下的 `SKILL.md`。
 *
 * 判据是「这条路径**真的在 Host 回传的树里**且是文件」——界面绝不凭空拼一条路径去请求；
 * 万一树里没有它（理论上不会：安装契约就要求 `skills/<name>/SKILL.md`），退而选树里第一个文件，
 * 再没有文件就返回 undefined（预览说「在左侧选择一个文件」而不是编一个空路径）。
 *
 * @param skillName - Host 已装记录里的第一个技能目录名（`names[0]`）。
 * @param entries - Host 回传的文件树条目。
 * @returns 默认预览的相对路径；树里没有任何文件时 undefined。
 */
export function enterpriseSkillDefaultFilePath(
  skillName: string,
  entries: readonly EnterpriseSkillFileEntry[],
): string | undefined {
  const preferred = `${skillName}/${ENTERPRISE_SKILL_CONTENT_FILENAME}`
  if (entries.some(entry => entry.path === preferred && entry.kind === 'file')) return preferred
  return entries.find(entry => entry.kind === 'file')?.path
}

/** 节头右那枚计数文案：只数**文件**（目录是结构、不是内容）。 */
export function enterpriseSkillFileCountText(entries: readonly EnterpriseSkillFileEntry[]): string {
  return `共 ${entries.filter(entry => entry.kind === 'file').length} 个文件`
}

/** 左文件树的四态（纯投影，测试直调）：未安装 / 读取失败 / 读取中 / 空树 / 有树。 */
export type EnterpriseSkillTreeState =
  | { readonly kind: 'not-installed'; readonly hint: string }
  | { readonly kind: 'loading'; readonly hint: string }
  | { readonly kind: 'failed'; readonly code: string; readonly hint: string }
  | { readonly kind: 'empty'; readonly hint: string }
  | { readonly kind: 'available'; readonly rows: readonly EnterpriseSkillTreeRow[] }

/** 未安装时那句提示：文件只在本机已装的技能里，中心详情投影只有 frontmatter 脱敏事实、**不含任何文件**。 */
export const ENTERPRISE_SKILL_TREE_NOT_INSTALLED = '安装后可浏览文件（企业中心只发布脱敏摘要，技能文件在本机已装技能里）。'
/** 文件树读取中的提示。 */
export const ENTERPRISE_SKILL_TREE_LOADING = '正在读取文件列表…'
/** 文件树读取失败的提示前缀（后半句是稳定错误码）。 */
export const ENTERPRISE_SKILL_TREE_FAILED = '技能文件列表读取失败'
/** 树里一个文件都没有（Host 回了 200 但空树：如实说，不假装有内容）。 */
export const ENTERPRISE_SKILL_TREE_EMPTY = '这个技能包里没有文件'

/**
 * 由「已装与否 + 读取态 + 树条目」投影出**左文件树**该说什么。
 *
 * 优先级写死为「未装 → 失败 → 读取中 → 有树/空树」：未装的包根本不该发文件请求，
 * 因此未装永远说那句提示；失败优先于「读取中」，否则一次失败会被下一轮 loading 盖成「正在读取」而看不到错误码。
 */
export function enterpriseSkillTreeState(input: {
  readonly installed: boolean
  readonly loading: boolean
  readonly errorCode?: string | undefined
  readonly entries?: readonly EnterpriseSkillFileEntry[] | undefined
}): EnterpriseSkillTreeState {
  if (!input.installed) return { kind: 'not-installed', hint: ENTERPRISE_SKILL_TREE_NOT_INSTALLED }
  if (input.errorCode !== undefined) return { kind: 'failed', code: input.errorCode, hint: ENTERPRISE_SKILL_TREE_FAILED }
  if (input.loading || input.entries === undefined) return { kind: 'loading', hint: ENTERPRISE_SKILL_TREE_LOADING }
  const rows = enterpriseSkillTreeRows(input.entries)
  if (rows.length === 0) return { kind: 'empty', hint: ENTERPRISE_SKILL_TREE_EMPTY }
  return { kind: 'available', rows }
}

/** 右文件预览的五态（纯投影，测试直调）：未安装 / 读取失败 / 读取中 / 没选文件 / 有正文。 */
export type EnterpriseSkillPreviewState =
  | { readonly kind: 'not-installed'; readonly hint: string }
  | { readonly kind: 'loading'; readonly hint: string }
  | { readonly kind: 'failed'; readonly code: string; readonly hint: string }
  | { readonly kind: 'none'; readonly hint: string }
  | { readonly kind: 'available'; readonly path: string; readonly sizeBytes: number; readonly text: string }

/** 还没选文件时的提示（树里没有文件、或默认文件都不在时）。 */
export const ENTERPRISE_SKILL_PREVIEW_NONE = '在左侧选择一个文件查看内容'
/** 文件读取中的提示。 */
export const ENTERPRISE_SKILL_PREVIEW_LOADING = '正在读取文件…'
/** 文件读取失败的提示前缀（后半句是稳定错误码）。 */
export const ENTERPRISE_SKILL_PREVIEW_FAILED = '技能文件读取失败'
/** 空文件的兜底文案（Host 回了 200 但文件是空的：如实说，不假装有内容）。 */
export const ENTERPRISE_SKILL_PREVIEW_EMPTY = '（文件为空）'

/**
 * 由「已装与否 + 读取态 + 已取到的文件」投影出**右文件预览**该说什么。
 * 与左树同一套优先级（未装 → 失败 → 读取中 → 没选 / 有正文），两个面板因此不会各说一套状态。
 */
export function enterpriseSkillPreviewState(input: {
  readonly installed: boolean
  readonly loading: boolean
  readonly errorCode?: string | undefined
  readonly file?: EnterpriseInstalledSkillFile | undefined
}): EnterpriseSkillPreviewState {
  if (!input.installed) return { kind: 'not-installed', hint: ENTERPRISE_SKILL_TREE_NOT_INSTALLED }
  if (input.errorCode !== undefined) return { kind: 'failed', code: input.errorCode, hint: ENTERPRISE_SKILL_PREVIEW_FAILED }
  if (input.file === undefined) {
    return input.loading
      ? { kind: 'loading', hint: ENTERPRISE_SKILL_PREVIEW_LOADING }
      : { kind: 'none', hint: ENTERPRISE_SKILL_PREVIEW_NONE }
  }
  return { kind: 'available', path: input.file.path, sizeBytes: input.file.sizeBytes, text: input.file.text }
}

/** 面包屑的**可见文案**（照官方 `crumbText`：那里是父级名，这里是「技能列表」）。 */
export const ENTERPRISE_SKILL_DETAIL_BACK_TEXT = '技能列表'
/** 面包屑的**无障碍名**（照官方 `crumbLabel`：完整动作语义，读屏与键盘听到的就是它；同时是悬浮说明）。 */
export const ENTERPRISE_SKILL_DETAIL_BACK_LABEL = '返回技能列表'
/** 文件区那节的标题（官方 `_sectionTitle` 的位置：h4 + 右侧计数）。 */
export const ENTERPRISE_SKILL_DETAIL_FILES_TITLE = '技能文件'
/**
 * 详情里那枚坐标徽标的人话标签（术语降维）：完整坐标（如 `skillhub.cn/dev-expert@2.0.3`）
 * 不再是一条裸字符串，前面补「来源」二字，员工一眼知道这枚签在说什么。
 */
export const ENTERPRISE_SKILL_DETAIL_SOURCE_LABEL = '来源'
/** 来源徽标的悬浮说明（说明坐标由「来源站 / 发布方 @ 版本号」构成）。 */
export const ENTERPRISE_SKILL_DETAIL_SOURCE_TITLE = '来源与版本：由发布方提供的坐标（来源站 / 发布方 @ 版本号）'
/**
 * 等宽标识行的人话标签（术语降维）：`skillId`（如 `code-review`）是技能的内部标识，
 * 官方详情页在这里只有一条裸等宽字符串；我们保留位置与取值，但补一个「标识」标签与悬浮说明。
 */
export const ENTERPRISE_SKILL_DETAIL_NAME_LABEL = '标识'
/** 标识行的悬浮说明（回答员工「这串东西是什么」）。 */
export const ENTERPRISE_SKILL_DETAIL_NAME_TITLE = '这是该技能的内部标识，安装与排障时会用到'
/**
 * 上游技能名里可能出现的技术缩写（**上游正式名称的一部分，一律不改写**）；
 * 命中时在旁边补一句人话解释，避免员工被名称里的缩写劝退。
 */
export const ENTERPRISE_SKILL_UPSTREAM_TECH_WORDS = ['MCP', 'YAML', 'manifest', 'Manifest', 'SKILL.md'] as const
/** 命中上游技术缩写时补的那一句人话（只说「名字是发布方给的」，不解释、不改写名称）。 */
export const ENTERPRISE_SKILL_UPSTREAM_NAME_NOTE = '名称由技能发布方提供，其中的英文缩写属于该技能的自有名称。'

/**
 * 上游技能名是否需要在旁边补一句人话解释（纯投影，可单测）。
 * 只认上游名称里出现的技术缩写；不改写名称、不改写描述。
 *
 * @param displayName - 技能在目录里的显示名（原样来自中心/上游）。
 * @returns 需要时返回那句人话，否则 undefined（安静缺席，不无差别加噪音）。
 */
export function enterpriseSkillUpstreamNameNote(displayName: string): string | undefined {
  return ENTERPRISE_SKILL_UPSTREAM_TECH_WORDS.some(word => displayName.includes(word))
    ? ENTERPRISE_SKILL_UPSTREAM_NAME_NOTE
    : undefined
}

/** 读取失败时那枚重试按钮的文案（树与预览共用同一个词，不各说一套）。 */
export const ENTERPRISE_SKILL_DETAIL_RETRY = '重试'

/**
 * 详情子页面交给纯呈现的那一组输入。
 *
 * **唯一构造点是共享控制器**（`useEnterpriseMarketController` 的 `skillPage`），因此这里每一件事实
 * 都与行上同源：同一个 `EnterpriseMarketSkillRow`、同一份 `EnterpriseMarketSkillRowFacts`、
 * 同一条 Host 已装记录、同一个 `onToggleSkill`、同一份失败事实；
 * 文件树 / 预览的数据也只由控制器那一个 effect 取（本组件**不持 hook、不发请求**，测试可直接函数调用）。
 */
export interface EnterpriseSkillPageProps {
  readonly row: EnterpriseMarketSkillRow
  readonly facts: EnterpriseMarketSkillRowFacts
  /** Host 回传的已装记录；缺席 = 未安装（此时文件区只说「安装后可浏览文件」，一条请求都不发）。 */
  readonly installed?: EnterpriseInstalledSkill | undefined
  readonly actionError?: EnterpriseMarketActionError | undefined
  readonly onToggleSkill?: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
  /** Host 回传的文件树条目；未装 / 未取到即空数组（界面从不编树）。 */
  readonly fileEntries: readonly EnterpriseSkillFileEntry[]
  readonly filesLoading: boolean
  readonly filesErrorCode?: string | undefined
  /** 当前选中并预览的相对路径（默认 `SKILL.md`；未装或树里没有文件时缺席）。 */
  readonly selectedPath?: string | undefined
  readonly file?: EnterpriseInstalledSkillFile | undefined
  readonly fileLoading: boolean
  readonly fileErrorCode?: string | undefined
  /** 点树里一个文件：只交回那条**来自 Host 树**的路径，界面不拼路径。 */
  readonly onSelectFile: (path: string) => void
  /** 文件树读取失败后的重试（缺席即不渲染重试按钮，不给死路）。 */
  readonly onReloadFiles?: (() => void) | undefined
  /** 文件读取失败后的重试（同上）。 */
  readonly onReloadFile?: (() => void) | undefined
  /** 面包屑「返回技能列表」：把视图状态切回列表（唯一的返回入口）。 */
  readonly onBack: () => void
}

/**
 * **技能详情子页面**（纯函数、无 hook，可直接函数调用测试）。
 *
 * 结构与取值**逐项照官方插件详情页**（`ItemDetail` + `DetailTop`）：
 *   ① 面包屑「返回技能列表」（`button.own-market-crumb` + 旋转 90° 的 chevron，`aria-label` 给完整动作语义）；
 *   ② 头部（`detailHead`）：48×48 图标框 + 右侧动作区——动作渲染的正是**行上同一枚子块**
 *      `EnterpriseMarketSkillRowActions`（同一份 facts、同一个 `onToggleSkill`），故详情与行不可能各说一套；
 *   ③ 正文头（`detailMain`）：`h3` 标题 + 版本徽标（官方 `Tag`），随后是**等宽标识行**（`skillId`）与描述；
 *   ④ 分区（`detailSections` → `detailSection`）：文件区一节 —— **左文件树 + 右文件预览**。
 *
 * 文件区三条硬约束：
 *   · 树与预览都只消费 Host 的两条子路由（`/skills/<id>/files` 与 `/skills/<id>/file?path=`），
 *     未安装时**一条请求都不发**（不伪造树、不伪造正文，只说提示）；
 *   · 预览是 `<pre>` 里的**纯文本子节点**（React 转义），全文件没有 `dangerouslySetInnerHTML`；
 *   · 读取失败可见（`role="alert"` + 稳定错误码 + 重试），不静默。
 */
export function EnterpriseSkillDetailPage(props: EnterpriseSkillPageProps): ReactNode {
  const tree = enterpriseSkillTreeState({
    installed: props.installed !== undefined,
    loading: props.filesLoading,
    ...(props.filesErrorCode === undefined ? {} : { errorCode: props.filesErrorCode }),
    entries: props.fileEntries,
  })
  const preview = enterpriseSkillPreviewState({
    installed: props.installed !== undefined,
    loading: props.fileLoading,
    ...(props.fileErrorCode === undefined ? {} : { errorCode: props.fileErrorCode }),
    ...(props.file === undefined ? {} : { file: props.file }),
  })
  const versionTag = props.facts.versionTag
  const upstreamNameNote = enterpriseSkillUpstreamNameNote(props.row.displayName)
  return (
    <div className="own-market-detail" data-enterprise-skill-detail={props.row.id}>
      {/* ① 面包屑 + 头部（图标 + 动作）：逐项照官方 DetailTop。 */}
      <div className="own-market-detailTop">
        <button
          type="button"
          className="own-market-crumb"
          aria-label={ENTERPRISE_SKILL_DETAIL_BACK_LABEL}
          title={ENTERPRISE_SKILL_DETAIL_BACK_LABEL}
          onClick={() => { props.onBack() }}
        >
          <ChevronDown className="own-market-crumbIcon" size={12} aria-hidden="true" />
          <span>{ENTERPRISE_SKILL_DETAIL_BACK_TEXT}</span>
        </button>
        <div className="own-market-detailHead">
          <span className="own-market-detailIcon" aria-hidden="true"><Sparkles size={24} /></span>
          <div className="own-market-detailActions">
            <EnterpriseMarketSkillRowActions row={props.row} facts={props.facts} onToggleSkill={props.onToggleSkill} />
          </div>
        </div>
      </div>
      {/* ③ 标题 + **来源/版本**徽标（术语降维：完整坐标前加人话标签「来源」，不再是一条裸字符串） / 标识行 / 描述。 */}
      <div className="own-market-detailMain">
        <div className="own-market-titleRow">
          <h3 className="own-market-detailTitle">{props.row.displayName}</h3>
          {versionTag === undefined ? null : (
            <span className="own-market-detailSource" title={ENTERPRISE_SKILL_DETAIL_SOURCE_TITLE}>
              <span className="own-market-detailSourceLabel">{ENTERPRISE_SKILL_DETAIL_SOURCE_LABEL}</span>
              <Tag className="own-market-tag own-market-skillVersionTag" tone="neutral">{versionTag}</Tag>
            </span>
          )}
        </div>
        {upstreamNameNote === undefined ? null : <p className="own-market-upstreamNote">{upstreamNameNote}</p>}
        <p className="own-market-detailName">
          <span className="own-market-detailNameLabel" title={ENTERPRISE_SKILL_DETAIL_NAME_TITLE}>{ENTERPRISE_SKILL_DETAIL_NAME_LABEL}</span>
          <code>{props.row.skillId}</code>
        </p>
        <p className="own-market-detailDesc">{props.row.description}</p>
      </div>
      {props.actionError === undefined ? null : (
        <EnterpriseErrorNotice
          className="own-market-inlineError"
          code={props.actionError.code}
          prefix={enterpriseMarketActionErrorLabel(props.actionError)}
        />
      )}
      {/* ④ 分区：文件区一节 = 左文件树 + 右文件预览。 */}
      <div className="own-market-detailSections">
        <section
          className="own-market-detailSection"
          aria-label={ENTERPRISE_SKILL_DETAIL_FILES_TITLE}
          data-enterprise-skill-files={props.row.id}
        >
          <div className="own-market-sectionHead">
            <h4 className="own-market-sectionTitle">{ENTERPRISE_SKILL_DETAIL_FILES_TITLE}</h4>
            {tree.kind === 'available' ? (
              <span className="own-market-sectionCount">{enterpriseSkillFileCountText(props.fileEntries)}</span>
            ) : null}
          </div>
          <div className="own-market-fileSplit">
            {/* 左：文件树。目录不是按钮（点它不取任何东西），文件是按钮（点它换预览）。 */}
            <div className="own-market-fileTree">
              {tree.kind === 'available' ? (
                <ul className="own-market-fileRows" aria-label="技能文件树">
                  {tree.rows.map(row => (
                    <li
                      key={row.path}
                      className="own-market-fileRow"
                      data-enterprise-file-path={row.path}
                      data-enterprise-file-kind={row.kind}
                      data-enterprise-file-depth={row.depth}
                      style={{ paddingLeft: `${row.depth * 14}px` }}
                    >
                      {row.kind === 'directory' ? (
                        <span className="own-market-fileDir">
                          <Folder className="own-market-fileGlyph" size={13} aria-hidden="true" />
                          <span className="own-market-fileName">{row.name}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="own-market-fileOpen"
                          data-enterprise-file-open={row.path}
                          data-enterprise-file-selected={props.selectedPath === row.path ? 'true' : 'false'}
                          aria-label={`预览 ${row.path}`}
                          title={row.path}
                          onClick={() => { props.onSelectFile(row.path) }}
                        >
                          <FileText className="own-market-fileGlyph" size={13} aria-hidden="true" />
                          <span className="own-market-fileName">{row.name}</span>
                          {row.sizeBytes === 0 ? null : (
                            <span className="own-market-fileSize">{formatByteSize(row.sizeBytes)}</span>
                          )}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="own-market-fileHint">{tree.hint}</p>
              )}
              {tree.kind === 'failed' ? (
                <EnterpriseErrorNotice className="own-market-inlineError" code={tree.code} prefix={ENTERPRISE_SKILL_TREE_FAILED} />
              ) : null}
              {tree.kind === 'failed' && props.onReloadFiles !== undefined ? (
                <div className="own-market-fileRetry">
                  <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} onClick={() => { props.onReloadFiles?.() }}>
                    {ENTERPRISE_SKILL_DETAIL_RETRY}
                  </Button>
                </div>
              ) : null}
            </div>
            {/* 右：文件预览。正文是 <pre> 里的纯文本子节点（无 innerHTML），长文件靠 max-height 滚动 + 字节提示。 */}
            <div
              className="own-market-filePreview"
              data-enterprise-file-preview={preview.kind === 'available' ? preview.path : undefined}
            >
              <div className="own-market-filePreviewHead">
                <span className="own-market-filePreviewPath" data-enterprise-file-preview-path={props.selectedPath}>
                  {props.selectedPath ?? ''}
                </span>
                {preview.kind === 'available' ? (
                  <span className="own-market-filePreviewMeta">{formatByteSize(preview.sizeBytes)}</span>
                ) : null}
              </div>
              {preview.kind === 'available' ? (
                <pre className="own-market-fileText" data-enterprise-file-content={preview.path}>
                  {preview.text === '' ? ENTERPRISE_SKILL_PREVIEW_EMPTY : preview.text}
                </pre>
              ) : (
                <p className="own-market-fileHint">{preview.hint}</p>
              )}
              {preview.kind === 'failed' ? (
                <EnterpriseErrorNotice className="own-market-inlineError" code={preview.code} prefix={ENTERPRISE_SKILL_PREVIEW_FAILED} />
              ) : null}
              {preview.kind === 'failed' && props.onReloadFile !== undefined ? (
                <div className="own-market-fileRetry">
                  <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} onClick={() => { props.onReloadFile?.() }}>
                    {ENTERPRISE_SKILL_DETAIL_RETRY}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

/**
 * **配方详情子页面**交给纯呈现的那一组输入。
 *
 * **唯一构造点是共享控制器**（`useEnterpriseMarketController` 的 `presetPage`），因此这里每一件事实
 * 都与行上同源：同一个 `EnterpriseMarketPresetRow`、同一份 `EnterpriseMarketPresetRowFacts`、
 * 同一个 `onCopyPresetInstruction`、同一个 `presetCopiedId`；详情取数（`store.api.presetDetail(id)`）
 * 也只由控制器那一个 effect 发（本组件**不持 hook、不发请求**，测试可直接函数调用）。
 */
export interface EnterprisePresetPageProps {
  readonly row: EnterpriseMarketPresetRow
  readonly facts: EnterpriseMarketPresetRowFacts
  /**
   * 详情取数结果（`store.api.presetDetail(id)`）。**类型就是 `unknown`**：本页只消费其中的
   * `dependencies` 一个键，而解码这一路正在给员工端加这个键名——故这里刻意不绑死形状，
   * 由纯投影 `enterprisePresetContentsState` 按「可能还没有这个字段」防御性读取。
   */
  readonly detail?: unknown | undefined
  /** 详情在途（首帧就看得见轻提示，不空白）。 */
  readonly detailLoading: boolean
  /** 详情取数失败（稳定码）：唯一提示组件 + 重试；包含内容那一节同时如实说「暂时无法读取包含内容」。 */
  readonly detailErrorCode?: string | undefined
  /** 与行上**同一枚**真开关的拨动回调（缺席即降级链往下走，与列表里同源）。 */
  readonly onTogglePreset?: ((row: EnterpriseMarketPresetRow, next: boolean) => void) | undefined
  /** 与行上**同一枚**降级动作（第二级：跳新会话并填入指令）。 */
  readonly onOpenInNewSession?: ((row: EnterpriseMarketPresetRow) => void) | undefined
  /** 与行上**同一枚**降级动作（第三级：复制导入指令）。 */
  readonly onCopyInstruction?: ((row: EnterpriseMarketPresetRow) => void) | undefined
  /** 详情里的启用/停用失败（稳定码）：与行上同一份 `presetActionError`。 */
  readonly actionErrorCode?: string | undefined
  /** 详情取数失败后的重试（缺席即不渲染重试按钮，不给死路）。 */
  readonly onReloadDetail?: (() => void) | undefined
  /** 面包屑「返回配方列表」：把视图状态切回列表（唯一的返回入口）。 */
  readonly onBack: () => void
}

/**
 * **配方详情子页面**（纯函数、无 hook，可直接函数调用测试）。
 *
 * 与技能详情**同一形态**（同一套官方框架取值 + 同一个"整页切换、面包屑返回"的视图约定）：
 *   ① 面包屑「返回配方列表」（`button.own-market-crumb` + 旋转 90° 的 chevron，`aria-label` 给完整动作语义）；
 *   ② 头部（`detailHead`）：48×48 图标框 + 右侧动作区——动作渲染的正是**行上同一枚子块**
 *      `EnterpriseMarketPresetRowActions`（同一份 facts、同一个 `onCopyInstruction`）；
 *   ③ 正文头（`detailMain`）：`h3` 标题 + 来源徽标（官方 `Tag`，完整坐标）+ 等宽**标识行**（`presetId`）+ 描述；
 *   ④ 分区（`detailSections` → `detailSection`）：**「这份配方包含」**一节 —— 按 `kind` 分组列出
 *      技能 / 插件（未知类型归「其它」，不会被静默丢掉），每条显示 `id` 与「必需 / 可选」。
 *
 * 这一节的三条硬约束：
 *   · `dependencies` **字段缺席**（解码这一路还没带上它）或形状不对 → 如实说「暂时无法读取包含内容」，
 *     **绝不**当成「这条配方什么都不包含」（那是编造），也绝不白屏；
 *   · 详情取数失败 → 同一句话 + 唯一提示组件（人话 + 下一步 + 「技术信息」里的码）+ **真的重发**的重试；
 *   · 不新增 CSS：版式全部复用技能详情那套类名（列表/详情共用同一份 `<style>` 取值）。
 */
export function EnterprisePresetDetailPage(props: EnterprisePresetPageProps): ReactNode {
  const contents = enterprisePresetContentsState({
    loading: props.detailLoading,
    ...(props.detail === undefined ? {} : { detail: props.detail }),
  })
  return (
    <div className="own-market-detail" data-enterprise-preset-detail={props.row.id}>
      {/* ① 面包屑 + 头部（图标 + 动作）：与技能详情同一套 `DetailTop` 取值。 */}
      <div className="own-market-detailTop">
        <button
          type="button"
          className="own-market-crumb"
          aria-label={ENTERPRISE_PRESET_DETAIL_BACK_LABEL}
          title={ENTERPRISE_PRESET_DETAIL_BACK_LABEL}
          onClick={() => { props.onBack() }}
        >
          <ChevronDown className="own-market-crumbIcon" size={12} aria-hidden="true" />
          <span>{ENTERPRISE_PRESET_DETAIL_BACK_TEXT}</span>
        </button>
        <div className="own-market-detailHead">
          <span className="own-market-detailIcon" aria-hidden="true"><BookMarked size={24} /></span>
          <div className="own-market-detailActions">
            <EnterpriseMarketPresetRowActions
              row={props.row}
              facts={props.facts}
              onToggle={props.onTogglePreset}
              onOpenInNewSession={props.onOpenInNewSession}
              onCopy={props.onCopyInstruction}
            />
          </div>
        </div>
      </div>
      {/* 降级链的可见说明（① 可用时这一句整段不进 DOM；走了 ②/③ 就必须说清为什么）。 */}
      <EnterpriseMarketPresetFallbackNote facts={props.facts} id={props.row.id} />
      {/* 启用成功后的落地交代（「将在新会话生效」）：没有成功回执时整段不进 DOM。 */}
      <EnterpriseMarketPresetAppliedNote facts={props.facts} id={props.row.id} />
      {props.actionErrorCode === undefined ? null : (
        <EnterpriseErrorNotice className="own-market-inlineError" code={props.actionErrorCode} prefix="启用失败" />
      )}
      {/* ③ 标题 + 来源徽标（完整坐标）+ 标识行 + 描述：来源/标识两枚人话标签与技能详情**同源**（同一份常量）。 */}
      <div className="own-market-detailMain">
        <div className="own-market-titleRow">
          <h3 className="own-market-detailTitle">{props.row.displayName}</h3>
          {props.facts.versionTag === undefined ? null : (
            <span className="own-market-detailSource" title={ENTERPRISE_SKILL_DETAIL_SOURCE_TITLE}>
              <span className="own-market-detailSourceLabel">{ENTERPRISE_SKILL_DETAIL_SOURCE_LABEL}</span>
              <Tag className="own-market-tag own-market-skillVersionTag" tone="neutral">{props.facts.versionTag}</Tag>
            </span>
          )}
        </div>
        <p className="own-market-detailName">
          <span className="own-market-detailNameLabel" title={ENTERPRISE_SKILL_DETAIL_NAME_TITLE}>{ENTERPRISE_SKILL_DETAIL_NAME_LABEL}</span>
          <code>{props.row.presetId}</code>
        </p>
        <p className="own-market-detailDesc">{props.row.description}</p>
      </div>
      {/* ④ 分区：「这份配方包含」——按 kind 分组（技能 / 插件 / 其它），每条给 id 与「必需 / 可选」。 */}
      <div className="own-market-detailSections">
        <section
          className="own-market-detailSection"
          aria-label={ENTERPRISE_PRESET_CONTENTS_TITLE}
          data-enterprise-preset-contents={props.row.id}
          data-enterprise-preset-contents-state={contents.kind}
        >
          <div className="own-market-sectionHead">
            <h4 className="own-market-sectionTitle">{ENTERPRISE_PRESET_CONTENTS_TITLE}</h4>
            {contents.kind === 'available' ? (
              <span className="own-market-sectionCount">{enterprisePresetContentsCountText(contents.count)}</span>
            ) : null}
          </div>
          {contents.kind === 'available' ? contents.groups.map(group => (
            <div key={group.kind} className="own-market-rowMain" data-enterprise-preset-group={group.kind}>
              <span className="own-market-cardId">{group.label}</span>
              <ul className="own-market-rows">
                {group.items.map(item => (
                  <li
                    key={item.id}
                    className="own-market-row"
                    data-enterprise-preset-dependency={item.id}
                    data-enterprise-preset-required={item.required ? 'true' : 'false'}
                  >
                    <div className="own-market-rowLine">
                      <div className="own-market-rowMain">
                        <span className="own-market-cardId">{item.id}</span>
                        <span className="own-market-cardDesc">{enterprisePresetDependencyRequiredText(item.required)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )) : (
            // 「读不到」与「确实不包含」都走这一行可见说明（文案由四态投影给）：**不空白、不编造**。
            <p className="own-market-fileHint" role="status">{contents.hint}</p>
          )}
          {props.detailErrorCode === undefined ? null : (
            <EnterpriseErrorNotice className="own-market-inlineError" code={props.detailErrorCode} prefix={ENTERPRISE_PRESET_DETAIL_FAILED} />
          )}
          {props.detailErrorCode === undefined || props.onReloadDetail === undefined ? null : (
            <div className="own-market-fileRetry">
              <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} onClick={() => { props.onReloadDetail?.() }}>
                {ENTERPRISE_SKILL_DETAIL_RETRY}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/**
 * **插件行那一枚控件（未安装 ⇒【＋】/ 已安装 ⇒【开关】）的唯一实现**（纯函数、无 hook）。
 *
 * 目录行（`EnterpriseMarketInlineRows`）与**插件详情子页面**（本刀的落点）渲染的是**同一枚子块**，
 * 吃同一份 `facts`（唯一入口 `enterpriseMarketPluginRowFacts`）与同一批回调 —— 「详情里的动作与行上同源」
 * 因此是结构性的：分流（未安装 ⇒ ＋ / 已安装 ⇒ 开关）、禁用口径、无障碍名与悬浮说明全部只在 facts 里
 * 算一次，两个落点不可能各说一套，也不可能有第二个状态副本。
 *
 * ★ 两件刻意的事：① 详情里**不**引导卸载 —— 这一面本来就没有卸载动作（用户口径第 16 条只要求
 * 「能装就装、已装就进「⋯」」），卸载与「企业设置 → 插件」详情共用**同一个** `store.removePlugin` 写入口
 * （源码级反向锁守着）；② 返回值是**单个元素**（不是数组），故 `[＋]或[开关]` 仍然是行线的直属同级项，
 * 行块的 DOM 大纲与改前逐项相同（详情那边把它连同上面那条可见说明一起放进动作区）。
 *
 * @param packageName - 这一行的包名（动作的钥匙，也是开关无障碍名的取值）。
 * @param facts - 行 facts（`enterpriseMarketPluginRowFacts` 的产出）。
 * @param onInstall - 【＋】的写入口（与行上同一条写路径）；缺席即禁用（不提供假按钮）。
 * @param onToggleEnabled - 【开关】的写入口（与行上同一条写路径）；缺席即禁用（不提供假切换）。
 * @returns 该行此刻该给的那一枚控件。
 */
export function EnterpriseMarketPluginRowActions({
  packageName, facts, onInstall, onToggleEnabled, onUninstall, builtin, hasUpdate, menuOpen, onToggleMenu,
}: {
  /**
   * ★ 只收**包名**，不收整行对象：行对象上带着 `operatingSystems` 这类**数据面字段**，
   * 把它当 prop 传进来就等于让「目录声明的平台」重新出现在行子树里（`plugin-install-gate.spec.ts`
   * 有一条「三种声明形态渲染出的行子树逐字相同」的不变式守着）。子块本来也只需要包名。
   */
  readonly packageName: string
  readonly facts: EnterpriseMarketPluginRowFacts
  readonly onInstall: (() => void) | undefined
  readonly onToggleEnabled: ((next: boolean) => void) | undefined
  readonly onUninstall: (() => void) | undefined
  /**
   * 这一项是不是**内置**（后台分配/预置的，由 `enterpriseMarketPluginBuiltin` 判定）。
   * **只收布尔**、不收整行——理由同上那条「行子树里不出现数据面字段」的不变式。
   */
  readonly builtin: boolean
  /** 这一行**有更新**吗（由 `enterpriseMarketPluginHasUpdate` 判定）；为真时菜单多一项「更新」。 */
  readonly hasUpdate: boolean
  /** 「⋯」是否展开（缺席 = 关闭）。 */
  readonly menuOpen?: boolean | undefined
  readonly onToggleMenu?: (() => void) | undefined
}): ReactNode {
  // 未安装 ⇒ 一枚「安装」文字按钮（用户口径：不要开关、也不要那个圆形【＋】）。
  if (facts.slot === 'install') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="own-market-installBtn"
        disabled={facts.installDisabled}
        title={facts.installTitle}
        aria-label={facts.installLabel}
        data-enterprise-plugin-slot="install"
        onClick={() => { onInstall?.() }}
      >{ENTERPRISE_MARKET_INSTALL_TEXT}</Button>
    )
  }
  // 已安装 ⇒ 「⋯」：菜单项**按这一行真实能力**给（用户口径：可能包括更新等）——
  //   ① 有更新 ⇒ 「更新」（走安装同一个写入口，装目录那一版）
  //   ② 启用 / 停用（按当前启停位给相反的那一枚，不给一枚点了没变化的）
  //   ③ **非内置**才给「卸载」（后台分配/预置的内置项动不了）
  return (
    <EnterpriseMarketRowMenu
      subject={packageName}
      open={menuOpen}
      onToggle={onToggleMenu}
      items={[
        ...(hasUpdate ? [{
          id: 'update',
          label: '更新',
          title: '更新到企业目录上的版本',
          disabled: onInstall === undefined || facts.installDisabled,
          onSelect: () => { onInstall?.() },
        }] : []),
        {
          id: 'toggle',
          label: facts.enabled ? ENTERPRISE_MARKET_DISABLE_TEXT : ENTERPRISE_MARKET_ENABLE_TEXT,
          title: facts.switchTitle,
          disabled: facts.switchDisabled,
          onSelect: () => { onToggleEnabled?.(!facts.enabled) },
        },
        ...(builtin ? [] : [{
          id: 'uninstall',
          label: ENTERPRISE_MARKET_UNINSTALL_TEXT,
          title: '从本机卸载这枚插件',
          disabled: onUninstall === undefined,
          onSelect: () => { onUninstall?.() },
        }]),
      ]}
    />
  )
}

/**
 * **目录行的唯一实现点**：按目录页签把整段 `<ul className="own-market-rows">`
 * 连行一起铺出来——技能行 = 行图标 + 两行文案（标题行 `.own-market-cardHead`：标题 + 版本签 + 可选分类签；
 * 描述行 `.own-market-cardDesc`）+ 右侧 `[有更新]` 与官方 `Switch` + 行下失败提示；插件行 = 行图标 + 两行文案 +
 * 状态点与官方状态词 + `Switch` + 行下失败提示；**配方行（本刀）** = 行图标 + 两行文案（标题行：标题 + 版本短号签
 * + 可选分类签）+ 右侧「复制导入指令」+ **没有开关**（配方今天没有安装链路，不给假开关）。
 * 插件页「插件市场」（唯一入口）的目录行只经它渲染，故类名、取值、行 facts、
 * 动作落点（辅助动作严格排在开关左侧）与失败提示（`role="alert"` + 稳定错误码）在整页只有一份实现。
 * 纯函数、无 hook：事实一律来自 `enterpriseMarketShellModel` 与行 facts，本子块只负责铺版面。
 */
export function EnterpriseMarketInlineRows({ tab, model, props }: {
  readonly tab: EnterpriseMarketDirectoryTabId
  readonly model: EnterpriseMarketShellModel
  readonly props: EnterpriseMarketShellProps
}): ReactNode {
  /**
   * 把一组可见行铺成「**组标题 + 分割线 + 两列卡片网格**」（用户口径：参考图的分组样式）。
   * 空组已被 `enterpriseMarketCategoryGroups` 剔掉，故这里不判空、不给空壳；组内行序＝目录序。
   * `data-enterprise-market-group` 是分组观测点（值与组标题同一份字面，测试与排查都取它）。
   */
  const renderGrouped = <T,>(
    groups: readonly EnterpriseMarketCategoryGroup<T>[],
    renderRow: (row: T) => ReactNode,
  ): ReactNode =>
    groups.map(group => (
      <section key={group.category} className="own-market-categoryGroup" data-enterprise-market-group={group.category}>
        <h4 className="own-market-categoryTitle">{group.category}</h4>
        <ul className="own-market-rows">
          {group.rows.map(row => renderRow(row))}
        </ul>
      </section>
    ))
  if (tab === 'presets') {
    // 配方行与技能行**同级同款**：同一串行类名与同一份标题行取值（`.own-market-cardHead`/`cardId`/`cardDesc`
    // + `.own-market-skillVersionHint` 包装完整坐标的 title），故本刀一个新类名都不加。
    return (
      <>
        {renderGrouped(model.presetGroups, preset => {
          const facts = enterpriseMarketPresetRowFacts(props, preset)
          return (
            <li
              key={preset.id}
              className="own-market-row"
              data-enterprise-preset-package={preset.id}
              data-enterprise-preset-id={preset.presetId}
            >
              <div className="own-market-rowLine">
                {/* **行标题可点开详情**（用户口径）：行本体（图标 + 两行文案）是一枚真 `<button>`，
                    点它把面板整页切到配方详情子页面；动作是它的**同级兄弟**（结构性保证，不靠 stopPropagation）。
                    回调缺席时 disabled + 说明性 title（照既有降级口径，不给死按钮）。 */}
                <button
                  type="button"
                  className="own-market-rowOpen"
                  data-enterprise-preset-open={preset.id}
                  aria-label={`查看企业配方 ${preset.displayName} 详情`}
                  disabled={props.onOpenPresetDetail === undefined}
                  title={props.onOpenPresetDetail === undefined ? '详情入口未接通' : '查看详情'}
                  onClick={() => { props.onOpenPresetDetail?.(preset) }}
                >
                  <span className="own-market-rowIcon"><BookMarked size={18} aria-hidden="true" /></span>
                  <div className="own-market-rowMain">
                    <span className="own-market-cardHead">
                      {/* **两行结构**（用户口径：上面标题、下面描述），故第 1 行**只有标题**——
                          版本签 / 分类签一律不留：分类已由分组标题承载（再挂一枚是重复信息），
                          版本改在详情子页面看。标题单独 500/14 一行，不再与签混排。 */}
                      <span className="own-market-cardId own-market-skillTitle">{preset.displayName}</span>
                    </span>
                    <span className="own-market-cardDesc">{preset.description}</span>
                  </div>
                </button>
                {/* 动作区：与技能/插件行**同款**的真开关（三态由 facts 算），
                    一键启用不可用时由降级链给出 ②/③ 两枚动作——绝不放一枚拨不动的开关。 */}
                <EnterpriseMarketPresetRowActions
                  row={preset}
                  facts={facts}
                  menuOpen={props.menuRow === enterpriseMarketRowKey('presets', preset.id)}
                  onToggleMenu={props.onToggleRowMenu === undefined
                    ? undefined
                    : () => { props.onToggleRowMenu?.(enterpriseMarketRowKey('presets', preset.id)) }}
                  onToggle={props.onTogglePreset}
                  onOpenInNewSession={props.onOpenPresetInNewSession}
                  onCopy={props.onCopyPresetInstruction}
                />
              </div>
              {/* 降级链的可见说明（① 可用时整段不进 DOM）。 */}
              <EnterpriseMarketPresetFallbackNote facts={facts} id={preset.id} />
              {/* 启用成功后的落地交代（「将在新会话生效」）：行上与详情里读同一份 facts。 */}
              <EnterpriseMarketPresetAppliedNote facts={facts} id={preset.id} />
              {/* 启用/停用失败的可见反馈：与技能/插件行同款（`role="alert"` + 稳定码），且**不**禁用开关。 */}
              <EnterpriseMarketRowError error={props.presetActionError} id={preset.id} />
            </li>
          )
        })}
      </>
    )
  }
  if (tab === 'skills') {
    return (
      <>
        {renderGrouped(model.skillGroups, skill => {
          const facts = enterpriseMarketSkillRowFacts(props, skill)
          return (
            <li
              key={skill.id}
              className="own-market-row"
              data-enterprise-skill-package={skill.id}
              data-enterprise-skill-id={skill.skillId}
              data-enterprise-skill-state={facts.state}
            >
              <div className="own-market-rowLine">
                {/* **行本体**（图标 + 两行文案）是一枚真 `<button>`：点它 = 打开该技能详情。
                    它是 `.own-market-rowLine` 的第一个子节点，下面那两枚动作是它的**兄弟**——
                    点 `[有更新]` / 拨 `Switch` 既不会冒泡进来、也不在可点区域内（结构性保证，不靠 stopPropagation）。
                    回调缺席时 disabled + 说明性 title（照组件节节头的既有降级口径，不给死按钮）。 */}
                <button
                  type="button"
                  className="own-market-rowOpen"
                  data-enterprise-skill-open={skill.id}
                  aria-label={`查看企业技能 ${skill.displayName} 详情`}
                  disabled={props.onOpenSkillDetail === undefined}
                  title={props.onOpenSkillDetail === undefined ? '详情入口未接通' : '查看详情'}
                  onClick={() => { props.onOpenSkillDetail?.(skill) }}
                >
                  <span className="own-market-rowIcon"><Sparkles size={18} aria-hidden="true" /></span>
                  <div className="own-market-rowMain">
                    {/* 第 1 行 = 标题 + 两枚只读签（版本签取 `sourceDshVersion` 的**短号**、分类签取可选 `category`）：
                        单行 nowrap，标签过多时标题先省略、两枚签保持可见，行高不变。
                        短号外面那枚 span 只承载**完整来源坐标**的 `title`：官方 `Tag` 的接缝只吃
                        tone/className/children（0.1.5-rc.2 的 .d.ts 如此，运行期也把多给的属性丢掉），
                        故用一枚透明包装节点挂悬浮说明——它的位置就是签的位置，签自身类名/tone 一字未动。 */}
                    <span className="own-market-cardHead">
                      {/* **两行结构**：第 1 行只有标题（版本签 / 分类签按用户口径撤掉，理由见配方行同处注释）。 */}
                      <span className="own-market-cardId own-market-skillTitle">{skill.displayName}</span>
                    </span>
                    {/* 第 2 行 = 描述（官方 13/18-tertiary 单行省略，不换行撑高卡片）。 */}
                    <span className="own-market-cardDesc">{skill.description}</span>
                  </div>
                </button>
                {/* 动作与行上**同一枚子块**（也是详情子页面渲染的那一枚）：同一份 facts、同一个回调。 */}
                <EnterpriseMarketSkillRowActions
                  row={skill}
                  facts={facts}
                  onToggleSkill={props.onToggleSkill}
                  menuOpen={props.menuRow === enterpriseMarketRowKey('skills', skill.id)}
                  onToggleMenu={props.onToggleRowMenu === undefined
                    ? undefined
                    : () => { props.onToggleRowMenu?.(enterpriseMarketRowKey('skills', skill.id)) }}
                />
              </div>
              {/* 失败可见反馈：失败即在该行给 role="alert" + 稳定错误码，且**不**禁用开关（再拨一次就是重试）。 */}
              <EnterpriseMarketRowError error={props.skillActionError} id={skill.id} />
            </li>
          )
        })}
      </>
    )
  }
  return (
    <>
      {renderGrouped(model.pluginGroups, plugin => {
          const facts = enterpriseMarketPluginRowFacts(props, plugin)
          return (
            <li
              key={plugin.packageName}
              className="own-market-row"
              data-enterprise-plugin-package={plugin.packageName}
              data-enterprise-plugin-state={plugin.state}
              // 「安装中」这一行对辅助技术如实自报忙（`undefined` 时属性不进 DOM，安静行一字不多）。
              aria-busy={facts.progress === undefined ? undefined : true}
            >
              <div className="own-market-rowLine">
                {/* **行标题可点进详情子页面**（用户口径第 16 条）：行本体（图标 + 两行文案）是一枚真
                    `<button>`——与同面技能行/配方行**同款同枚**（同一个类名、同一个无障碍名句式、同一个
                    「未接线即禁用 + 说明」降级口径），点它把插件页签的**内容区**换成该插件的详情子页面；
                    状态词与动作是它的**同级兄弟**（结构性保证，不靠 `stopPropagation`），点它们绝不进详情。
                    ★ 这里**没有** `aria-haspopup`：详情是子页面、不是弹窗，挂 dialog 语义会说错话。 */}
                <button
                  type="button"
                  className="own-market-rowOpen"
                  data-enterprise-plugin-open={plugin.packageName}
                  aria-label={`查看企业插件 ${enterprisePluginDisplayName(plugin.displayName, plugin.packageName)} 详情`}
                  disabled={props.onOpenPluginDetail === undefined}
                  title={props.onOpenPluginDetail === undefined ? '详情入口未接通' : '查看详情'}
                  onClick={() => { props.onOpenPluginDetail?.(plugin) }}
                >
                  <span className="own-market-rowIcon"><Package size={18} aria-hidden="true" /></span>
                  <div className="own-market-rowMain">
                    {/* 第 1 行 = 标题 + 「企业」签 + 版本短号签——**与技能行的标题行同款同枚**（同一串类名、
                        同一个 tone、同一枚官方 `Tag` 原语、每个类名都取自本文件既有声明，故一个新类都没有）。
                        版本信息因此**没丢**：它从第二行搬到了这枚签上，字面仍是 `v{version}`（官方 badge 槽同一枚字面）。 */}
                    <span className="own-market-cardHead">
                      {/* **标题 = 插件名称**（制品 package.json 的 displayName），缺省/空白**回退包名**——
                          用户口径「插件卡片标题显示插件名称，而非包名」。它与上面那枚按钮的无障碍名是**同一枚**
                          投影（`enterprisePluginDisplayName`），故读屏听到的名字与用户看到的字永远一致。
                          **两行结构**：第 1 行只有标题——「企业」签、版本签按用户口径一并撤掉
                          （每张卡都挂同一枚「企业」签＝零信息量；版本改在详情里看）。 */}
                      <span className="own-market-cardId own-market-skillTitle">
                        {enterprisePluginDisplayName(plugin.displayName, plugin.packageName)}
                      </span>
                    </span>
                    {/* 第 2 行 = **插件描述**。有描述说描述；没有描述如实说「暂无描述」（不空白、不编造）；
                        已下架的行照旧说「已不在企业目录中」（那一句是既有口径，与有没有描述无关）。 */}
                    <span className="own-market-cardDesc">
                      {plugin.inCatalog
                        ? enterprisePluginDescriptionText(plugin.description)
                        : '已不在企业目录中'}
                    </span>
                  </div>
                </button>
                {/* 状态点旁**恒**出一行官方状态词（安静态也说），文案取自本仓唯一那份官方状态词表。 */}
                <span className="own-market-rowState">
                  <StateDot state={facts.dot} />
                  {facts.stateTitle}
                </span>
                {/* 动作区**按状态分流**（唯一分流点在 `enterpriseMarketPluginRowFacts` 的 `slot`）：
                    未安装 ⇒ 「安装」按钮；已安装 ⇒ 「⋯」（菜单项按真实能力给：更新 / 启用·停用 / 卸载）。
                    这里是**唯一实现**，详情子页面渲染的是同一枚子块（同一份 facts、同一批回调）。
                    「卸载」只给**非内置**项（`enterpriseMarketPluginBuiltin`：仍由企业目录提供＝后台分配/预置
                    ⇒ 内置、动不了）；核心包不在这份列表里，故不参与判定。 */}
                <EnterpriseMarketPluginRowActions
                  packageName={plugin.packageName}
                  facts={facts}
                  builtin={enterpriseMarketPluginBuiltin(plugin)}
                  hasUpdate={enterpriseMarketPluginHasUpdate(plugin)}
                  onInstall={props.onInstallPlugin === undefined ? undefined : () => { props.onInstallPlugin?.(plugin) }}
                  onToggleEnabled={props.onTogglePluginEnabled === undefined
                    ? undefined
                    : (next) => { props.onTogglePluginEnabled?.(plugin, next) }}
                  onUninstall={props.onUninstallPlugin === undefined
                    ? undefined
                    : () => { props.onUninstallPlugin?.(plugin) }}
                  menuOpen={props.menuRow === enterpriseMarketRowKey('plugins', plugin.packageName)}
                  onToggleMenu={props.onToggleRowMenu === undefined
                    ? undefined
                    : () => { props.onToggleRowMenu?.(enterpriseMarketRowKey('plugins', plugin.packageName)) }}
                />
              </div>
              {/* 禁用时的**可见**解释（无写入口 / 在途 / 等重启 / 别的操作用着）。 */}
              <EnterprisePluginRowNotes id={plugin.packageName} facts={facts} />
              {/* **安装中**那一条真进度（阶段文字 + 不确定态流光 + 真取消入口/取消不了的原因）：
                  只在真的在装时才进 DOM；取消写入口缺席时那枚按钮不画。 */}
              <EnterprisePluginProgressNotes
                id={plugin.packageName}
                facts={facts}
                {...(props.onCancelPlugin === undefined ? {} : { onCancel: () => { props.onCancelPlugin?.(plugin) } })}
              />
              {/* 刚结束那一次动作的落地交代（完成 / 需重启）：`role="status"` 把「安装中 → 完成」接上。 */}
              <EnterprisePluginSettledNote id={plugin.packageName} facts={facts} />
              {/* 目录判定不可安装：原因（人话）+「下一步：」+「技术信息」里的稳定码，全部**可见**。 */}
              {plugin.installErrorCode === undefined ? null : (
                <EnterpriseErrorNotice className="own-market-inlineError" code={plugin.installErrorCode} />
              )}
              {/* 该码可原地再试时给出**能走的动作**（真的重取一次企业插件目录、重跑服务端判定）。
                  不可重试的终态（例如「与当前客户端不兼容」）不给假重试——它的下一步由上面那句负责。 */}
              {plugin.installErrorCode === undefined
                || !enterpriseErrorRetryable(plugin.installErrorCode)
                || props.onRetryPlugins === undefined ? null : (
                  <p className="own-market-rowNote">
                    <Button
                      size="sm"
                      icon={<RefreshCw aria-hidden size={14} />}
                      aria-label={ENTERPRISE_PLUGIN_BLOCKED_RETRY_LABEL}
                      onClick={() => { props.onRetryPlugins?.() }}
                    >
                      {ENTERPRISE_LIST_RETRY}
                    </Button>
                  </p>
                )}
              <EnterpriseMarketRowError error={props.pluginActionError} id={plugin.packageName} />
            </li>
          )
        })}
    </>
  )
}

/**
 * **插件详情子页面在本面的唯一渲染点**（纯函数）：把控制器交来的行投影 + 行 facts 翻成
 * `EnterprisePluginDetailPage` 的那一整份 props —— 组件本体**原样复用**（`plugin-market.tsx` 的同一枚纯组件，
 * 本文件不复制第二份详情、也不重写任何一句文案），本函数只负责把「行上同一份真值」接上去：
 *
 *  · 「企业版本」那一格 = 纯投影 `enterprisePluginCatalogVersionText`（与设置页详情**同一枚**投影）；
 *  · 「大小」「安装状态」两格直接读行投影（行上没有这两件事实时整格不出，不编造）；
 *  · 「暂时不能安装」那一格只在**这一行给的就是【＋】**时才出：`facts.lockNotice` 是**这一行那一枚控件**
 *    的禁用原因，装在开关那格上说「不能安装」会串台（开关不可拨 ≠ 不能安装）；
 *  · 动作区 = 行上**同一枚**子块 `EnterpriseMarketPluginRowActions`（同一份 facts、同一批写入口）
 *    ＋ 行上那句**可见**的禁用说明（详情里没有行下那句说明，不带过去就会留下一枚「点不动又不说话」的控件）；
 *  · 进度与落地交代取 `facts`（与行上同一份投影）——详情不可能说「没在装」而行上在装。
 *
 * ★ 详情里**没有**卸载：这一面本来就没有卸载动作（用户口径第 16 条：能装就装、已装就开关）。
 */
function enterpriseMarketPluginDetail(page: EnterprisePluginPageProps, props: EnterpriseMarketShellProps): ReactNode {
  /*
   * 描述（用户口径第 19 条 → 第 20 条）：这一段吃 `enterpriseMarketPluginDetailBody` 那**唯一一枚**投影 ——
   * **有 README 就用 README**（口径 20：描述应该来自插件的 README），没有才**回落**到行上第二行那条
   * 同一份真值 `EnterpriseMarketPluginRow.description`（口径 19 的既有行为，不丢）；两者都没有 ⇒
   * 详情里那一段整段不进 DOM，不画「暂无描述」空壳。
   * `EnterprisePluginDetailPage` 的这个 prop 是 **additive** 的：face A（企业设置 → 插件）不传它，
   * 故那一面的详情输出逐字不变（由 `plugin-card.spec.ts` 的详情大纲逐字快照锁着）。
   *
   * 版式（用户口径第 22 条）：再传一枚同源的 `descriptionMarkdown`——它由**唯一一枚**纯投影
   * `enterpriseMarketPluginDetailMarkdown(page.row.readme)` 判定，**有 README 才按 Markdown 排版**；
   * 回落到短描述时仍传假 ⇒ 那一支的版式与口径 19/20 逐字相同（本面的短描述路径一个像素都没动）。
   * 下面 `description=` 那一行**一字未改**（口径 20 的既有判定点原样保留）。
   */
  return (
    <EnterprisePluginDetailPage
      packageName={page.row.packageName}
      displayName={page.row.displayName}
      description={enterpriseMarketPluginDetailBody(page.row.readme, page.row.description)}
      descriptionMarkdown={enterpriseMarketPluginDetailMarkdown(page.row.readme)}
      catalogVersionText={page.catalogVersionText}
      installed={page.facts.installed}
      installedVersion={page.row.recordVersion}
      sizeBytes={page.row.sizeBytes}
      installErrorCode={page.row.installErrorCode}
      installLockNotice={page.facts.slot === 'install' ? page.facts.lockNotice : undefined}
      progress={page.facts.progress}
      settledNotice={page.facts.settledNotice}
      onBack={page.onBack}
      onCancelInstall={page.onCancelInstall}
      actions={<>
        {/* 详情子页面：同一枚动作子块、同一份 facts、同一批回调。这里**不传** `onToggleMenu`
            ⇒ 菜单自动改成**平铺**（详情没有下拉宿主，绝不画一枚点不开的「⋯」）。 */}
        <EnterpriseMarketPluginRowActions
          packageName={page.row.packageName}
          facts={page.facts}
          builtin={enterpriseMarketPluginBuiltin(page.row)}
          hasUpdate={enterpriseMarketPluginHasUpdate(page.row)}
          onInstall={props.onInstallPlugin === undefined ? undefined : () => { props.onInstallPlugin?.(page.row) }}
          onToggleEnabled={props.onTogglePluginEnabled === undefined
            ? undefined
            : (next) => { props.onTogglePluginEnabled?.(page.row, next) }}
          onUninstall={props.onUninstallPlugin === undefined
            ? undefined
            : () => { props.onUninstallPlugin?.(page.row) }}
        />
        <EnterprisePluginRowNotes id={page.row.packageName} facts={page.facts} />
      </>}
      pageRef={page.pageRef}
    />
  )
}

/**
 * **目录页外壳**（唯一一棵）：官方插件页「官方」分组里的「插件市场」卡片点进去的详情页正文
 * （官方 `plugins.item` 的 `page` 视图）。逐段取自 `9723a97`：
 *  · 技能行 = 行图标 + 官方两行卡片（第 1 行 `.own-market-cardId` 标题 + 紧随的版本签/分类签、第 2 行 `.own-market-cardDesc` 描述）
 *    + 右侧 `[有更新（命中才出）] [Switch]` + 行下失败提示；
 *  · 插件行 = 行图标 + 两行文案 + 状态点 + 官方状态词 + `Switch` + 行下失败提示；
 *  · 配方行（本刀）= 行图标 + 两行文案 + 版本短号签 + 可选分类签 + 「复制导入指令」（无开关）；
 *  · **四个页签**共用 `EnterpriseMarketTabStrip`，组件节共用 `EnterpriseMarketComponentsPanel`。
 *
 * **本刀（技能详情子页面）**：`props.skillPage` 非空时**整页切换**成 `EnterpriseSkillDetailPage`
 * ——列表、页签条、节容器整段**不渲染**（两个 return 分支，不是叠一层弹层），面包屑「返回技能列表」
 * 把视图状态清空即回到这里。它没有路由、没有新增 slot：面板本来就是官方 `plugins.item` 的 page 视图，
 * 切换只发生在这一个视图状态上。**配方详情（本刀）**：`props.presetPage` 走**同一条**形态
 * （`EnterprisePresetDetailPage`，面包屑「返回配方列表」），两者由控制器保证互斥（同一时刻只可能有一个非空）。
 *
 * 纯函数、无 hook（`useState` 在共享控制器里）：事实一律来自 `enterpriseMarketShellModel` 与行 facts，本组件只负责铺版面。
 */
export function EnterpriseMarketLegacyShell(props: EnterpriseMarketShellProps): ReactNode {
  if (props.view === 'summary') return <EnterpriseMarketSummaryLine />
  // 详情子页面：整页切换（列表那一支一字不挂载），样式把 detailStyles 一并带上。
  if (props.skillPage !== undefined) {
    return (
      <section ref={props.sectionRef} className="own-market-entry" aria-label={ENTERPRISE_MARKET_ENTRY_LABEL}>
        <style>{baseStyles}{rowStyles}{detailStyles}</style>
        <EnterpriseSkillDetailPage {...props.skillPage} />
      </section>
    )
  }
  // 配方详情子页面：与技能详情**同一条**整页切换形态（同一份 `<style>`，因为不新增任何 CSS）。
  if (props.presetPage !== undefined) {
    return (
      <section ref={props.sectionRef} className="own-market-entry" aria-label={ENTERPRISE_MARKET_ENTRY_LABEL}>
        <style>{baseStyles}{rowStyles}{detailStyles}</style>
        <EnterprisePresetDetailPage {...props.presetPage} />
      </section>
    )
  }
  const model = enterpriseMarketShellModel(props)
  /**
   * 插件详情子页面（用户口径第 16 条）的**唯一渲染点**：`undefined` = 「企业插件」页签照常铺列表。
   *
   * 三道门都要过：控制器给了目标、当前就停在「企业插件」页签、且这一节真的可见（「插件」大组件开启）。
   * 第二道门同时是「点别的页签 = 回列表」这条行为的兜底——控制器切页签时已经清掉目标，
   * 这里再判一次，纯函数直调（测试传 `pluginPage` + `activeTab:'skills'`）也不会渲染出第二个详情。
   */
  const pluginDetail = props.pluginPage === undefined || model.activeTab !== 'plugins' || model.pluginsPanel.kind === 'hidden'
    ? undefined
    : enterpriseMarketPluginDetail(props.pluginPage, props)
  return (
    <section ref={props.sectionRef} className="own-market-entry" aria-label={ENTERPRISE_MARKET_ENTRY_LABEL}>
      {/* 页面级 CSS：列表那份照旧（**一个字节都不多背**，故那份字节级基线在列表视图里照旧不变）。
          **只有**插件详情在场时才另挂一份「企业设置 → 插件」的样式表——复用的 `EnterprisePluginDetailPage`
          的版面正是照它写的（`.own-market-toolbar`/`.own-market-facts`/`.own-market-actions`/`.own-plugin-progress*`）。
          两份表类名**零交集**（`marketplace-entry.spec.ts` 的隔离不变量逐类守着），同页并存不会互相覆盖。 */}
      <style>{baseStyles}{rowStyles}</style>
      {pluginDetail === undefined ? null : <style>{ENTERPRISE_PLUGIN_STYLES}</style>}
      <EnterpriseMarketTabStrip
        model={model}
        onSelectTab={props.onSelectTab}
        searchText={props.searchText}
        onSearchChange={props.onSearchChange}
        filterOpen={props.filterOpen}
        onToggleFilter={props.onToggleFilter}
        filterStatus={props.filterStatus}
        filterCategory={props.filterCategory}
        onFilterSelect={props.onFilterSelect}
        tabsInTitle={props.tabsInTitle}
      />
      {/* 「企业技能」页签（默认页签，用户主战场）：与企业插件页签同规则——「技能」大组件开启（= 会话可用）
          且目录非空才出现。列的是后台分配（预置）的全部技能：未装的照列，装不装由用户拨右侧那枚开关决定。
          **内容区四态**：就绪铺行；加载中 / 空 / 失败各有一态（失败 = 人话 + 下一步 + 重试，绝不假装「没有数据」）。 */}
      <EnterpriseMarketPanel tab="skills" activeTab={model.activeTab}>
        {model.activeTab === 'skills' && model.skillsPanel.kind !== 'hidden' ? (
          <section className="own-market-section" data-market-section="enterprise-skills">
            {model.skillsPanel.kind === 'ready' ? ([
              // 过滤把这一页筛空了 ⇒ 说「没有匹配」并给一键清空；否则照常铺分组卡片。
              // 两者互斥：同一帧要么是空态那句话，要么是一组组卡片，不会同时出现。
              model.visibleSkills.length === 0 && model.filtering
                ? <EnterpriseMarketFilteredHint key="filtered-empty" onClear={props.onClearFilters} />
                : <EnterpriseMarketInlineRows key="rows" tab="skills" model={model} props={props} />,
              // 次级取数降级的可见交代（已装状态 / 部分技能的最新版本没读全）：非打扰但看得见 + 可重试。
              // 用数组而不是 Fragment：行的结构大纲是既有取证点，Fragment 会在其中留下一个不透明节点。
              props.skillsListState?.kind === 'ready' && props.skillsListState.value.installedCode !== undefined
                ? <EnterpriseMarketDegradedNotice key="installed-degraded" code={props.skillsListState.value.installedCode} subject="本机已装状态" onRetry={props.onRetrySkills} />
                : null,
              props.skillsListState?.kind === 'ready' && props.skillsListState.value.detailCode !== undefined
                ? <EnterpriseMarketDegradedNotice key="detail-degraded" code={props.skillsListState.value.detailCode} subject="部分技能的最新版本" onRetry={props.onRetrySkills} />
                : null,
            ]) : (
              <EnterpriseMarketListHint state={model.skillsPanel} onRetry={props.onRetrySkills} />
            )}
          </section>
        ) : null}
      </EnterpriseMarketPanel>
      {/* 「企业插件」页签内容：仅当「插件」大组件开启时出现，列企业后台上传的真实插件目录（四态同技能页签）。
          **本刀（插件详情子页面，用户口径第 16 条）**：详情在场时**这一页签的内容区整段换成详情**——
          列表与它那四态提示一个元素都不挂载，互斥由**复用的** `EnterprisePluginContentRegion` 保证
          （`detail ?? list`，与「企业设置 → 插件」那一面**同一枚**容器、同一个 `data-enterprise-plugin-region`
          判据：不是叠层、没有遮罩、没有 portal、没有 dialog 语义）；页头与四枚页签**保持可见、一字不改**。 */}
      <EnterpriseMarketPanel tab="plugins" activeTab={model.activeTab}>
        {model.activeTab === 'plugins' && model.pluginsPanel.kind !== 'hidden' ? (
          <section className="own-market-section" data-market-section="enterprise-plugins">
            <EnterprisePluginContentRegion
              detail={pluginDetail}
              list={model.pluginsPanel.kind === 'ready' ? (
                model.visiblePlugins.length === 0 && model.filtering
                  ? <EnterpriseMarketFilteredHint onClear={props.onClearFilters} />
                  : <EnterpriseMarketInlineRows tab="plugins" model={model} props={props} />
              ) : (
                <EnterpriseMarketListHint state={model.pluginsPanel} onRetry={props.onRetryPlugins} />
              )}
            />
          </section>
        ) : null}
      </EnterpriseMarketPanel>
      {/* 「企业配方」页签内容（本刀）：与「企业插件」同规则——「配方」组件开启（= 会话可用）且目录非空才出现，
          列企业后台上传的真实配方目录（四态同技能/插件页签，取值来自与设置弹窗同一个取数源）。
          行上**没有开关**：配方今天没有安装链路，动作区只给「复制导入指令」。 */}
      <EnterpriseMarketPanel tab="presets" activeTab={model.activeTab}>
        {model.activeTab === 'presets' && model.presetsPanel.kind !== 'hidden' ? (
          <section className="own-market-section" data-market-section="enterprise-presets">
            {model.presetsPanel.kind === 'ready' ? (
              model.visiblePresets.length === 0 && model.filtering
                ? <EnterpriseMarketFilteredHint onClear={props.onClearFilters} />
                : <EnterpriseMarketInlineRows tab="presets" model={model} props={props} />
            ) : (
              <EnterpriseMarketListHint state={model.presetsPanel} onRetry={props.onRetryPresets} />
            )}
          </section>
        ) : null}
      </EnterpriseMarketPanel>
      {/* 「组件」页签：唯一还带折叠语义的一节。 */}
      <EnterpriseMarketPanel tab="components" activeTab={model.activeTab}>
        {model.activeTab === 'components' ? (
          <EnterpriseMarketComponentsPanel model={model} onToggleSection={props.onToggleSection} onOpenLogin={props.onOpenLogin} onToggleLibrary={props.onToggleLibrary} onRetryLibrarySave={props.onRetryLibrarySave} />
        ) : null}
      </EnterpriseMarketPanel>
    </section>
  )
}

/**
 * 共享控制器的产出：**一份**外壳 props + 登录弹窗的最小接线。
 * `shellProps` 是整页唯一的事实来源（业务真值 + 回调 + UI 态全在里面，详情子页面也收在它的 `skillPage` 里），
 * `loginOpen`/`closeLogin` 交给宿主同树渲染登录弹窗。
 */
export interface EnterpriseMarketController {
  /** 页面 props（控制器是唯一构造点；详情子页面的输入就是其中的 `skillPage`）。 */
  readonly shellProps: EnterpriseMarketShellProps
  /** 授权弹层的输入（`undefined` = 没有待确认的配方；宿主据此决定要不要挂那一层）。 */
  readonly presetApproval?: EnterprisePresetApprovalProps | undefined
  /** 登录弹窗当前是否打开。 */
  readonly loginOpen: boolean
  /** 关闭登录弹窗（含「登录中先取消」的既有语义，由 login-dialog 自己判）。 */
  readonly closeLogin: () => void
}

/**
 * 共享控制器（**唯一一份逻辑**）：订阅企业账号 store、按会话可用性取技能目录/已装清单/中心版本、
 * 组装安装/卸载动作与失败码归行，并持有四份 UI 态（页签选中、组件节折叠、行开合、**技能详情子页面的目标与它的文件树/预览**）。
 * 唯一一个 hook 入口（`EnterpriseMarketLegacyPage`）只经本 hook 取 **同一份** `EnterpriseMarketShellProps`
 * ——取数、动作、失败处理与状态归属在这里只有一份，外壳只负责画。
 *
 * 技能目录不在 store 快照里，故按会话可用性就地取（`store.api.skills()`，同源固定路径）；
 * **取数状态只有一个来源**——唯一取数源 `createEnterpriseSkillCatalogSource`（本 hook 用 `useSyncExternalStore` 订阅它）：
 * 加载中 / 空 / 失败 / 就绪四态互斥，失败**不**回落成空目录（那是本刀消灭的静默），空也不再与失败混同。
 * 已装态与目录**并行**取（`store.api.installedSkills()`），并**只对已装行**再补一次详情
 * （`store.api.skillDetail(id)`：中心列表投影的 `versionId` 恒为空串，判定「有更新」只能靠详情里的它）；
 * 这两条是**次级事实**：失败不拖垮目录，但要如实交码，由界面出一句「暂时没有读取到」+ 可重试。
 * 已装只用来决定那枚开关的 checked / disabled 与辅助动作出不出现，本页不做乐观切换。
 * @param props - `view` 透传入口侧视图（`summary` 不预取技能目录）；`store` 由注册面的 `inject` 注入。
 * @returns 一份外壳 props + 登录弹窗的最小接线。
 */
export function useEnterpriseMarketController({ view, store, libraryGate, presetLaunch }: {
  readonly view: 'summary' | 'page'
  readonly store?: EnterpriseAccountStore | undefined
  /**
   * 资料库**管理开关**的唯一真源（本机设置，由 `client.tsx` 在 `apply` 里建一份、经 `inject` 注入）。
   * 控制器只订阅它并把快照直传外壳；拨动仍走同一个真源的 `setEnabled`，因此**侧栏入口的注册面**
   * 与这一行开关读的是同一份状态（不存在第二个副本）。
   */
  readonly libraryGate?: EnterpriseLibraryGate | undefined
  /**
   * **降级链第二级**的接线（跳到新会话并填入导入指令）。
   *
   * 官方机制（`docs/notes/preset-approval-spike.md` 之后查实）：
   * `@deepseek-ai/dsh-client-ui-workspace` 的 `UiWorkspace.openWorkspace(workspaceId, beforeOpen)` 第二参
   * 在选定会话后同步回调 `sessionId`，再经 `@deepseek-ai/dsh-client-ui-conversation` 的
   * `conversation.input.shell(sessionId).actions.setDraft(text)` 把指令**填进输入框**（不发送）。
   * 这段接线在 `preset-launch.ts`，由 `client.tsx` 在 apply 里建；**缺席 = 这一级不可用**，
   * 降级链会如实说明为什么走了第三级（绝不静默降级）。
   */
  readonly presetLaunch?: EnterprisePresetLaunchPort | undefined
}): EnterpriseMarketController {
  const snapshot = useAccount(store as EnterpriseAccountStore)
  const dialog = useEnterpriseLoginDialog(store as EnterpriseAccountStore)
  const sessionUsable = enterpriseSessionUsable(snapshot.status?.state)
  // 本机开关（资料库）：没有真源时用恒定快照（默认关 + 无写入口 ⇒ 开关禁用），引用稳定，uSES 不会误重订阅。
  const librarySnapshot = useSyncExternalStore(
    libraryGate?.subscribe ?? ENTERPRISE_MARKET_LIBRARY_GATE_SUBSCRIBE,
    libraryGate?.getSnapshot ?? ENTERPRISE_MARKET_LIBRARY_GATE_GET_SNAPSHOT,
    libraryGate?.getSnapshot ?? ENTERPRISE_MARKET_LIBRARY_GATE_GET_SNAPSHOT,
  )
  // 拨动 = 真源的 `setEnabled`（先立刻生效、再写本机设置）；失败码留在快照里由组件行显示 + 重试。
  const onToggleLibrary: ((next: boolean) => void) | undefined = libraryGate === undefined
    ? undefined
    : next => { libraryGate.setEnabled(next) }
  const onRetryLibrarySave: (() => void) | undefined = libraryGate === undefined
    ? undefined
    : () => { libraryGate.retry() }
  // 页签：初值取 `ENTERPRISE_MARKET_DEFAULT_TAB`——**默认落在「企业技能」**（用户的主战场：
  // 后台分配/预置的技能一进页面就列出来），组件与「企业插件」要靠点页签才进去。
  const [activeTab, setActiveTab] = useState<EnterpriseMarketTabId>(ENTERPRISE_MARKET_DEFAULT_TAB)
  // 折叠态：初值取 `ENTERPRISE_MARKET_DEFAULT_EXPANDED`——页签化后**只剩「组件」页签内部**那一节还带折叠。
  const [expandedSections, setExpandedSections] = useState<Record<EnterpriseMarketSectionId, boolean>>(ENTERPRISE_MARKET_DEFAULT_EXPANDED)
  const onToggleSection = (section: EnterpriseMarketSectionId): void => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  // 搜索 + 筛选（标签行：搜索框在左、筛选下拉在右）。**本刀起是真过滤**——这三个状态经
  // `enterpriseMarketShellModel` 真的切可见行；分类筛选的取值恒为七类之一或 `'all'`。
  const [searchText, setSearchText] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<EnterpriseMarketStatusFilter>('all')
  const [filterCategory, setFilterCategory] = useState<EnterpriseMarketCategory | 'all'>('all')
  // 「⋯」更多菜单的开合（**单选**：同一时刻只开一行；行键 = `enterpriseMarketRowKey(tab, id)`）。
  // 与筛选下拉同一范式：状态在控制器、纯函数外壳只读。点开另一行即切过去，页面滚动/动作后不动它。
  const [menuRow, setMenuRow] = useState<string | null>(null)
  const onToggleRowMenu = (key: string): void => {
    setMenuRow(prev => (prev === key ? null : key))
  }
  /**
   * 行展开态：**单选**（同一时刻最多一行展开），行键 = `{页签}:{行 id}`，初值 `null` = 全部收起。
   * **去折叠后没有任何落点消费它**（用户裁决 A：卡片去掉折叠、动作常显）。
   * 按「不为这次改动去动共享层」的要求，那份状态与 `onToggleRow` **原样保留**：行 facts 仍照 `expandedRow`
   * 算 `open`/`detailsId`，纯投影 `enterpriseMarketRowOpen`/`enterpriseMarketRowKey` 也仍在出口上。
   * 将来若要收敛，须连同 `EnterpriseMarketShellProps.expandedRow`/`onToggleRow`、行 facts 的三枚字段与
   * 整条控制器状态一起删，并同步测试——那是独立的一次清理，不夹带在本轮里。
   */
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const onToggleRow = (key: string): void => {
    setExpandedRow(current => (current === key ? null : key))
  }
  const hasStore = store !== undefined
  const openLogin = hasStore ? dialog.openDialog : undefined
  const pluginStatus = snapshot.pluginStatus
  const catalog = pluginStatus?.catalog ?? []
  const local = pluginStatus?.plugins ?? []
  const enterprisePlugins = enterpriseMarketPluginRows(catalog, local)
  // 技能目录：只在 `page` 视图（企业技能页签的宿主）+ 有 store + 会话可用时取；卡片视图不预取。
  // **取数状态只有一个来源**：下面这个非 React 的取数源（`useSyncExternalStore` 订阅它）。
  // 会话不可用 / 依赖变化即 `reset()`（中止在途、回到初始加载态），迟到结果由源的代际守卫丢弃。
  const catalogApi = store?.api
  const catalogSource = useMemo(
    () => (catalogApi === undefined ? undefined : createEnterpriseSkillCatalogSource(catalogApi)),
    [catalogApi],
  )
  // 没有 store（卡片视图 / 纯函数直调）时那份恒定的「加载中」快照：`useSyncExternalStore` 要求引用稳定。
  const catalogState: EnterpriseListState<EnterpriseSkillCatalog> = useSyncExternalStore(
    catalogSource?.subscribe ?? ENTERPRISE_MARKET_CATALOG_SUBSCRIBE,
    catalogSource?.getSnapshot ?? ENTERPRISE_MARKET_CATALOG_SNAPSHOT,
    catalogSource?.getSnapshot ?? ENTERPRISE_MARKET_CATALOG_SNAPSHOT,
  )
  useEffect(() => {
    if (catalogSource === undefined) return
    if (view !== 'page' || !sessionUsable) {
      catalogSource.reset()
      return
    }
    catalogSource.load()
    return () => { catalogSource.reset() }
  }, [catalogSource, view, sessionUsable])
  // 就绪（或空）时才把取数结果摊开：加载中 / 失败都是**没有行**，界面据此出三态而不是「空列表」。
  const catalogValue = catalogState.kind === 'ready' || catalogState.kind === 'empty' ? catalogState.value : undefined
  const enterpriseSkills: readonly EnterpriseMarketSkillRow[] = catalogValue?.rows ?? []
  // 已装清单：种子来自取数源（每次取数成功都刷新它），安装/卸载动作**用 Host 回传的清单覆盖**它
  // （本页不做乐观切换）。它是行上「已装/有更新/在途」的事实源，与目录行分开持有是为了动作后不整页闪。
  const [installedSkills, setInstalledSkills] = useState<readonly EnterpriseInstalledSkill[]>([])
  useEffect(() => {
    if (catalogValue !== undefined) setInstalledSkills(catalogValue.installed)
  }, [catalogValue])
  const [pendingSkill, setPendingSkill] = useState<EnterpriseMarketSkillPending>()
  const versionIdByPackage = new Map(catalog.map(item => [item.packageName, item.pluginVersionId]))
  /**
   * 「企业插件」页签的四态（**不许用行数反推状态**——目录取数失败时行数恰好也是 0，
   * 那正是「假装没数据」这个 bug 的来源）。三条事实都来自账号 store：
   *   · 插件投影一次都没取到过（`pluginStatus === undefined`）→ 有失败码就是失败态，否则还在加载；
   *   · 取到过就以它为准：有行是就绪、没行是**空**（说清为什么空，而不是一片空白）。
   * 失败态的重试 = 请 store 重新取一次企业插件投影（在途时 `pluginsLoading` 会把它带回加载中）。
   */
  const pluginsListState: EnterpriseListState<readonly EnterpriseMarketPluginRow[]> =
    pluginStatus !== undefined
      ? (enterprisePlugins.length === 0
        ? { kind: 'empty', value: enterprisePlugins }
        : { kind: 'ready', value: enterprisePlugins })
      : snapshot.pluginErrorCode !== undefined
        ? { kind: 'failed', code: snapshot.pluginErrorCode }
        : { kind: 'loading' }
  const onRetryPlugins: (() => void) | undefined = hasStore
    ? () => { void store!.refreshPlugins() }
    : undefined
  // 技能页签的重试 = 取数源 `retry()`（真的重发目录 + 已装 + 详情三条取数）；没有 store 就没有按钮。
  const onRetrySkills: (() => void) | undefined = catalogSource === undefined
    ? undefined
    : () => { catalogSource.retry() }
  // 「企业配方」页签：取数源用的是**设置弹窗那份**取数源工厂（`createEnterprisePresetListSource`，
  // 与「企业设置 → 配方」tab 逐字同一个），经同一个 `store.api` 发出——本页不新造宿主路由、不碰 local-api。
  // 启动/中止纪律与技能目录完全一致：只在 `page` 视图 + 有 store + 会话可用时取，否则 `reset()`。
  const presetSource = useMemo(
    () => (catalogApi === undefined ? undefined : createEnterprisePresetListSource(catalogApi)),
    [catalogApi],
  )
  const presetState: EnterpriseListState<readonly EnterpriseRuntimePreset[]> = useSyncExternalStore(
    presetSource?.subscribe ?? ENTERPRISE_MARKET_CATALOG_SUBSCRIBE,
    presetSource?.getSnapshot ?? ENTERPRISE_MARKET_PRESET_SNAPSHOT,
    presetSource?.getSnapshot ?? ENTERPRISE_MARKET_PRESET_SNAPSHOT,
  )
  useEffect(() => {
    if (presetSource === undefined) return
    if (view !== 'page' || !sessionUsable) {
      presetSource.reset()
      return
    }
    presetSource.load()
    return () => { presetSource.reset() }
  }, [presetSource, view, sessionUsable])
  const presetValue = presetState.kind === 'ready' || presetState.kind === 'empty' ? presetState.value : undefined
  // 行投影只有这一处（`enterpriseMarketPresetRows`）：行的动作、详情页的动作都从它产出的行再算同一份 facts。
  const enterprisePresets: readonly EnterpriseMarketPresetRow[] = enterpriseMarketPresetRows(presetValue ?? [])
  // 配方页签的重试 = 取数源 `retry()`（真的重发一次配方目录取数）；没有 store 就没有按钮。
  const onRetryPresets: (() => void) | undefined = presetSource === undefined
    ? undefined
    : () => { presetSource.retry() }
  // 失败可见反馈（两行共用同一份口径）：
  // · 技能侧：动作 promise 的 catch 直接拿到错误对象（行键 = 技能包 id）；
  // · 插件侧：`store.#pluginAction` 把失败**吞**进 `snapshot.pluginErrorCode`（不 rethrow，设置页插件
  //   市场正是靠它出头号提示），所以这里记住「刚发起动作的那一行与动作」，再把 store 已收下的稳定码
  //   归到该行；`localCode` 只用于本地就能判定、根本没发出请求的那一种（目录里已无可安装版本）。
  // 每次发起动作都先清掉旧提示，成功后自然不会再出现。
  const [skillActionError, setSkillActionError] = useState<EnterpriseMarketActionError>()
  /**
   * 被点开详情的那条技能行的**技能包 id**（不是行对象本身）：详情里的一切都在渲染时从**当前**目录投影
   * 里按这个 id 重新取（`enterpriseSkills.find`），所以目录刷新（中心发新版本、字段变化）后详情不会停在
   * 旧副本上；目录里已经没有这个 id（会话不可用/条目消失）时弹层自己就不渲染了。`undefined` = 弹层关闭。
   */
  const [skillDetailId, setSkillDetailId] = useState<string>()
  const [pluginAction, setPluginAction] = useState<{
    readonly packageName: string
    readonly action: 'install' | 'uninstall' | 'cancel' | 'enable' | 'disable'
    readonly localCode?: string
  }>()
  const pluginErrorCode = pluginAction?.localCode ?? snapshot.pluginErrorCode
  const pluginActionError: EnterpriseMarketActionError | undefined =
    pluginAction !== undefined && pluginErrorCode !== undefined
      ? { id: pluginAction.packageName, action: pluginAction.action, code: pluginErrorCode }
      : undefined
  /**
   * **插件详情子页面的目标行**（用户口径第 16 条）：只存**包名**，不存行对象。
   *
   * 详情里的一切在渲染时从**当前**目录投影里 `find`（目录刷新后详情不停在旧副本上；
   * 目录里已经没有这一条时会话不可用/下架/卸载清空时 `pluginPage` 自己就是 undefined，
   * 界面自然回到列表——与技能/配方详情同一条纪律）。`undefined` = 「企业插件」页签照常铺列表。
   */
  const [pluginDetailName, setPluginDetailName] = useState<string>()
  /** 本页根节点（`section.own-market-entry`）：Esc 的监听范围与「返回时按名字找回那一行」的查找范围都钉在它上面。 */
  const marketRoot = useRef<HTMLElement>(null)
  /** 插件详情容器：进入详情时那个聚焦 effect 从这里取落点（就是它里面的详情标题）。 */
  const pluginDetailPage = useRef<HTMLDivElement>(null)
  /** 进详情前那一刻的滚动位置（**点击那一下**读，之后列表就被替换了；判定复用 `scrollTargetOf`）。 */
  const pluginScrollMemory = useRef<{ readonly target: HTMLElement; readonly top: number } | undefined>(undefined)
  /** 是哪一行的标题开的详情：返回时按**包名**把焦点还给它（列表是重新挂载的，旧 DOM 引用已经失效）。 */
  const pluginOpener = useRef<string | undefined>(undefined)
  /**
   * 【返回】的两条真路径（与「企业设置 → 插件」那份详情**同一套接法**）：① 详情里左上角那枚返回按钮；
   * ② Esc。
   *
   * 监听钉在本页根节点上（**不是** `document`）：只有焦点落在本页里时 Esc 才回列表，不去抢官方面板别处的
   * Esc；命中后 `stopPropagation`，免得这一下继续冒泡把外层一起关掉。**浏览器返回键没接**——本页是官方
   * `plugins.item` 的 page 视图、**没有真实路由**（与同面技能/配方详情同一形态），硬造 `history` 会与
   * 宿主自己的返回处理打架，故不假装有路由。
   */
  useEffect(() => {
    if (pluginDetailName === undefined) return
    const node = marketRoot.current
    if (node === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setPluginDetailName(undefined)
    }
    node.addEventListener('keydown', onKeyDown)
    return () => { node.removeEventListener('keydown', onKeyDown) }
  }, [pluginDetailName])
  /**
   * 进入详情：焦点落到详情标题（那枚 `tabIndex={-1}` 的程序化聚焦点），读屏因此立刻报出「插件详情」。
   * 用 `useLayoutEffect`：在浏览器绘制前就把焦点放好，用户看不到「焦点还留在已经不在的那枚按钮上」那一帧。
   */
  useLayoutEffect(() => {
    if (pluginDetailName === undefined) return
    pluginDetailPage.current?.querySelector<HTMLElement>('[data-enterprise-plugin-detail-title]')?.focus()
  }, [pluginDetailName])
  /**
   * 返回：把滚动位置与焦点**还原到进入详情前那一眼**（`useLayoutEffect` 在绘制前落定，看不见跳动）。
   *
   * 焦点按**包名**找回那一枚标题按钮，而不是按旧 DOM 引用：返回时列表是**重新挂载**的，
   * 进入详情前那个节点已经不可用（`isConnected === false`），照旧引用 focus 会静默失败。
   */
  useLayoutEffect(() => {
    if (pluginDetailName !== undefined) return
    const saved = pluginScrollMemory.current
    pluginScrollMemory.current = undefined
    if (saved !== undefined && saved.target.isConnected) saved.target.scrollTop = saved.top
    const name = pluginOpener.current
    pluginOpener.current = undefined
    if (name === undefined) return
    const buttons = marketRoot.current?.querySelectorAll<HTMLElement>('[data-enterprise-plugin-open]')
    if (buttons === undefined) return
    for (const button of buttons) {
      if (button.dataset['enterprisePluginOpen'] === name) { button.focus(); return }
    }
  }, [pluginDetailName])
  /**
   * 未安装那一行那枚【＋】的安装动作（唯一写入口；行上的 ＋ 与详情里那枚「更新版本」都走它）。
   *
   * 版本号从目录真值取（`versionIdByPackage`）；目录里已经没有可安装的版本（下架/版本被撤）时
   * 不发请求、也不留静默 no-op，而是把 `ENT_RESOURCE_NOT_FOUND` 归到这一行如实说明。
   */
  const onInstallPlugin: ((row: EnterpriseMarketPluginRow) => void) | undefined = hasStore
    ? (row) => {
      const versionId = versionIdByPackage.get(row.packageName)
      if (versionId === undefined) {
        // 企业目录里已经没有可安装的版本：不发请求，也不留静默 no-op。
        setPluginAction({ packageName: row.packageName, action: 'install', localCode: 'ENT_RESOURCE_NOT_FOUND' })
        return
      }
      setPluginAction({ packageName: row.packageName, action: 'install' })
      void store!.installPlugin(row.packageName, versionId)
    }
    : undefined
  /**
   * 已安装那一行那枚【开关】的启用 / 停用动作。
   *
   * ★ `next === false` 是**停用**（`store.setPluginEnabled(name,false)`，同源 `POST /plugins/disable`），
   * **不是**卸载：卸载是同一枚「⋯」里的另一项（`store.removePlugin`），只给非内置项、且**不给确认弹层**
   * （破坏性确认归「企业设置 → 插件」详情那一面）。
   * 失败与安装同一条收束：store 把稳定码写进 `pluginErrorCode`，`EnterpriseMarketRowError` 出
   * 人话 + 下一步 + 技术信息里的码，开关仍在（状态没变）⇒ 再拨一次就是重试。
   */
  const onTogglePluginEnabled: ((row: EnterpriseMarketPluginRow, next: boolean) => void) | undefined = hasStore
    ? (row, next) => {
      setPluginAction({ packageName: row.packageName, action: next ? 'enable' : 'disable' })
      void store!.setPluginEnabled(row.packageName, next)
    }
    : undefined
  /**
   * 取消**在途**的那一次企业插件安装（本刀）。
   *
   * 与 `onInstallPlugin` 同一条降级口径：没有 store 就没有这一枚（界面那枚按钮整枚不画）。
   * 先把「这一行刚发起了取消」记下来（`pluginAction` 就是那枚**归行**用的簿记：store 把失败码收在
   * `pluginErrorCode` 里、没有行键），于是取消的收束（`ENT_PLUGIN_INSTALL_CANCELLED`，或取消请求自己
   * 的失败码）会经**既有**的 `EnterpriseMarketRowError` 落在这一行上——人话 + 下一步 + 技术信息里的码，
   * 前缀那支由 `enterpriseMarketActionErrorLabel('cancel')` 决定（取消不是失败，故不给「安装失败」前缀）。
   * 失败不外抛也不吞；按钮仍在（状态没变）⇒ 再点一次就是重试。
   */
  const onCancelPlugin: ((row: EnterpriseMarketPluginRow) => void) | undefined = hasStore
    ? row => {
      setPluginAction({ packageName: row.packageName, action: 'cancel' })
      void store!.cancelPlugin(row.packageName)
    }
    : undefined
  /**
   * 卸载一枚插件（本刀：卡片「⋯」里的「卸载」）。
   *
   * 与 `onTogglePluginEnabled` 同一条归行口径：先把动作记进 `pluginAction`（失败码据此落在这一行），
   * 再走**同一个** `store.removePlugin`（同源 `POST /plugins/remove`）——不新造第二套写入口。
   * 界面上这一项**只对非内置项**出现（`enterpriseMarketPluginBuiltin`），故这里不必再拦一次。
   */
  const onUninstallPlugin: ((row: EnterpriseMarketPluginRow) => void) | undefined = hasStore
    ? row => {
      setPluginAction({ packageName: row.packageName, action: 'uninstall' })
      void store!.removePlugin(row.packageName)
    }
    : undefined
  const onToggleSkill: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined = hasStore
    ? (row, next) => {
      // 与企业插件同一并发纪律：同一时刻只允许一个技能动作，动作返回的已装清单直接覆盖本地真值。
      if (pendingSkill !== undefined) return
      setPendingSkill({ packageId: row.id, next })
      setSkillActionError(undefined)
      const signal = AbortSignal.timeout(120_000)
      const operation = next ? store!.api.installSkill : store!.api.uninstallSkill
      void operation.call(store!.api, row.id, signal)
        .then(items => setInstalledSkills(items))
        .catch((error: unknown) => {
          // 失败就把该行退回未装态：不保留乐观已装，避免界面比磁盘更乐观。
          if (next) setInstalledSkills(previous => previous.filter(item => item.packageId !== row.id))
          // 并把失败摆到这一行上（稳定错误码 + 安装/卸载前缀）：原先这里只吞错误，用户拨了开关没有任何反应。
          setSkillActionError({ id: row.id, action: next ? 'install' : 'uninstall', code: enterpriseLocalErrorCode(error) })
        })
        .finally(() => setPendingSkill(undefined))
    }
    : undefined
  /**
   * 详情子页面打开时那条技能行的**当前投影**与它的**已装记录**。
   *
   * 详情目标只存**包 id**（不是行对象）：行在渲染时从**当前**目录投影里 `find` 出来，
   * 所以目录刷新（中心发新版本、字段变化）后详情不会停在旧副本上；目录里已经没有这个 id
   * （会话不可用 / 下架）时 `skillPage` 自己就是 undefined，界面自然回到列表。
   */
  const skillPageRow = skillDetailId === undefined
    ? undefined
    : enterpriseSkills.find(item => item.id === skillDetailId)
  const skillPageInstalled = skillPageRow === undefined
    ? undefined
    : installedSkills.find(item => item.packageId === skillPageRow.id)
  const api = store?.api
  const detailPackageId = skillPageInstalled?.packageId
  // 已装记录里的第一个技能目录名（`names` 在解码层保证非空且按 kebab 收窄）——默认预览路径由它与 SKILL.md 拼。
  const detailSkillName = skillPageInstalled?.names[0]
  /** 详情子页面的文件树状态（左栏）。状态挂在控制器上：纯视图组件不持 hook、不发请求。 */
  const [fileEntries, setFileEntries] = useState<readonly EnterpriseSkillFileEntry[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesErrorCode, setFilesErrorCode] = useState<string>()
  const [filesAttempt, setFilesAttempt] = useState(0)
  const [selectedPath, setSelectedPath] = useState<string>()
  /** 详情子页面的文件预览状态（右栏）。 */
  const [file, setFile] = useState<EnterpriseInstalledSkillFile>()
  const [fileLoading, setFileLoading] = useState(false)
  const [fileErrorCode, setFileErrorCode] = useState<string>()
  const [fileAttempt, setFileAttempt] = useState(0)
  /**
   * **文件树取数**（详情子页面左栏）：只在「详情打开 + 该包已装 + 有 store」这三件同时成立时发这一条请求。
   * 未装 / 关着详情走到这里直接清状态返回——**一条请求都不发、也不伪造树**，界面只说「安装后可浏览文件」。
   * 取到树后**默认选中并预览 `SKILL.md`**（`enterpriseSkillDefaultFilePath`：那条路径必须先真实出现在树里）。
   * 关详情 / 换包 / 卸载即中止在途请求，迟到结果不回填（`signal.aborted` 三处守卫）。
   */
  useEffect(() => {
    if (api === undefined || detailPackageId === undefined || detailSkillName === undefined) {
      setFileEntries([])
      setFilesErrorCode(undefined)
      setFilesLoading(false)
      setSelectedPath(undefined)
      return
    }
    const controller = new AbortController()
    setFileEntries([])
    setFilesErrorCode(undefined)
    setFilesLoading(true)
    setSelectedPath(undefined)
    void api.skillFiles(detailPackageId, controller.signal)
      .then((files) => {
        if (controller.signal.aborted) return
        setFileEntries(files.entries)
        setSelectedPath(enterpriseSkillDefaultFilePath(detailSkillName, files.entries))
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFilesErrorCode(enterpriseLocalErrorCode(error))
      })
      .finally(() => { if (!controller.signal.aborted) setFilesLoading(false) })
    return () => { controller.abort() }
  }, [api, detailPackageId, detailSkillName, filesAttempt])
  // 选中路径必须**就是树里那一条文件条目**：界面从不拼路径，只有回显 Host 给过的路径才可能发请求。
  const selectedEntry = selectedPath === undefined
    ? undefined
    : fileEntries.find(entry => entry.path === selectedPath && entry.kind === 'file')
  /**
   * **文件预览取数**（详情子页面右栏）：路径只可能是被点中/默认选中的那条树条目。
   * 没有选中条目（未装、树为空、树还在读）即不发请求，并把上一份正文清干净（不残留别的包/别的文件的内容）。
   */
  useEffect(() => {
    if (api === undefined || detailPackageId === undefined || selectedEntry === undefined) {
      setFile(undefined)
      setFileErrorCode(undefined)
      setFileLoading(false)
      return
    }
    const controller = new AbortController()
    setFile(undefined)
    setFileErrorCode(undefined)
    setFileLoading(true)
    void api.skillFile(detailPackageId, selectedEntry.path, controller.signal)
      .then(value => { if (!controller.signal.aborted) setFile(value) })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFileErrorCode(enterpriseLocalErrorCode(error))
      })
      .finally(() => { if (!controller.signal.aborted) setFileLoading(false) })
    return () => { controller.abort() }
  }, [api, detailPackageId, selectedEntry?.path, fileAttempt])
  /**
   * **配方详情的三件状态**（点配方行标题后才非空）：目标只存**行 id**（行对象在渲染时从当前目录投影里
   * `find` 出来，目录刷新后详情不停在旧副本上）、详情取数结果、在途与失败码。
   *
   * 详情取数（`store.api.presetDetail(id)`）与技能详情同一纪律：只在「配方详情打开 + 有 store」时发，
   * 关详情 / 换配方即 abort 且迟到结果不回填；失败**记稳定码**（由详情里那节出一句话 + 唯一提示组件 + 真重发），
   * 绝不静默回落、也绝不把「没读到」当成「不包含」。
   */
  const [presetDetailId, setPresetDetailId] = useState<string>()
  const [presetDetail, setPresetDetail] = useState<unknown>()
  const [presetDetailLoading, setPresetDetailLoading] = useState(false)
  const [presetDetailCode, setPresetDetailCode] = useState<string>()
  const [presetDetailAttempt, setPresetDetailAttempt] = useState(0)
  /** 刚刚复制过的那条配方（复制成功的可见反馈；同一份事实同时给行上与详情里的那枚按钮）。 */
  const [presetCopiedId, setPresetCopiedId] = useState<string>()
  useEffect(() => {
    if (api === undefined || presetDetailId === undefined) {
      setPresetDetail(undefined)
      setPresetDetailCode(undefined)
      setPresetDetailLoading(false)
      return
    }
    const controller = new AbortController()
    setPresetDetail(undefined)
    setPresetDetailCode(undefined)
    setPresetDetailLoading(true)
    void api.presetDetail(presetDetailId, controller.signal)
      .then(value => { if (!controller.signal.aborted) setPresetDetail(value) })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setPresetDetailCode(enterpriseLocalErrorCode(error))
      })
      .finally(() => { if (!controller.signal.aborted) setPresetDetailLoading(false) })
    return () => { controller.abort() }
  }, [api, presetDetailId, presetDetailAttempt])
  /**
   * **复制导入指令**（**降级链的第三级，只能是第三级**）：正文由 `buildPresetImportInstruction`
   * ——与「企业设置 → 配方」弹窗**同一个**构造器——产出（同一句指令、同一个配方坐标），
   * 写进剪贴板后把这条行 id 记下来（按钮文案随之变「已复制」）。
   * 指令正文**不上屏**（它含上游专名，本页术语要求不上这些词）。
   * 它只在 ① 一键启用 与 ② 新建会话都不可用时，才成为那一行真正给出的动作（并由 `fallback.note` 说明为什么）。
   * 与 `preset-market.tsx` 的复制按钮同一条写法（那边也是 `void navigator.clipboard.writeText(...)`）。
   */
  const onCopyPresetInstruction: ((row: EnterpriseMarketPresetRow) => void) | undefined = hasStore
    ? (row) => {
      const instruction = buildPresetImportInstruction(row, snapshot.status?.platformUrl ?? null)
      void navigator.clipboard.writeText(instruction).then(() => { setPresetCopiedId(row.id) })
    }
    : undefined
  /**
   * **配方一键启用**（本刀）：本机真值、真开关与授权弹层的唯一编排点。
   *
   * 三条纪律：
   *   ① **真值先读**：行上三态只能来自 `GET /presets/<雪花 id>/status`（授权三态 + 已装记录 + 披露清单），
   *      绝不乐观切换——界面绝不比磁盘更乐观（与技能行同一条）；
   *   ② **不替用户授权**：未授权 / 指纹已变时点开关**只弹授权层**，员工确认后才带 `confirmFingerprint`
   *      发 enable（`confirmFingerprint` 就是弹层展示的那份 `disclosure.fingerprint`）；
   *   ③ **失败不禁用**：失败只记行内提示 + 稳定码，开关照旧可拨（再拨一次即重试，D1 第 4 条）。
   */
  const [presetStates, setPresetStates] = useState<Record<string, EnterpriseMarketPresetRowState>>({})
  const [pendingPresetId, setPendingPresetId] = useState<string>()
  const [presetActionError, setPresetActionError] = useState<EnterpriseMarketActionError>()
  /** 授权弹层的当前目标（只存行 id，行对象在渲染时从当前目录投影里取，故目录刷新后不会停在旧副本上）。 */
  const [presetApprovalId, setPresetApprovalId] = useState<string>()
  const [presetApprovalRunning, setPresetApprovalRunning] = useState(false)
  const [presetApprovalCode, setPresetApprovalCode] = useState<string>()
  /**
   * 逐行读一次本机真值（`status`）。目录一变（换会话 / 刷新 / 新增配方）就重读一轮；
   * 迟到结果按 `AbortSignal` 丢弃。行数即请求数（配方目录本来就不大），故不需要虚拟化取数。
   */
  const presetIdList = enterprisePresets.map(item => item.id).join(',')
  useEffect(() => {
    if (api === undefined || view !== 'page' || !sessionUsable) return
    const ids = presetIdList === '' ? [] : presetIdList.split(',')
    if (ids.length === 0) return
    const controller = new AbortController()
    setPresetStates((previous) => {
      const next: Record<string, EnterpriseMarketPresetRowState> = { ...previous }
      for (const id of ids) next[id] = { ...(next[id] ?? { loading: false }), loading: true, errorCode: undefined }
      return next
    })
    for (const id of ids) {
      void api.presetStatus(id, controller.signal).then(
        (status) => {
          if (controller.signal.aborted) return
          setPresetStates(previous => ({ ...previous, [id]: { status, loading: false } }))
        },
        (error: unknown) => {
          if (controller.signal.aborted) return
          setPresetStates(previous => ({
            ...previous,
            [id]: { ...(previous[id] ?? { loading: false }), loading: false, errorCode: enterpriseLocalErrorCode(error) },
          }))
        },
      )
    }
    return () => { controller.abort() }
  }, [api, presetIdList, view, sessionUsable])
  /**
   * 一条配方的 enable / disable **动作编排**（唯一一处）。
   *
   * `fingerprint` **只在**员工于授权弹层点过「确认并启用」时才非空：它就是弹层展示的那一枚
   * `disclosure.fingerprint`，Host 侧会要求它与当前配方逐字相等，否则回 `ENT_PRESET_AUTHORIZATION_STALE`。
   * 成功或失败后都重读一次该行的 `status`（成功 = 新真值；失败 = 让界面回到真值而不是留在乐观态）。
   */
  const runPresetEnable = (rowId: string, fingerprint: string | undefined): void => {
    if (api === undefined) return
    setPendingPresetId(rowId)
    setPresetActionError(undefined)
    setPresetApprovalCode(undefined)
    // 上一次成功的那句「将在新会话生效」在这里退场：新的动作开始，它就不再是对当前状态的断言。
    setPresetStates(previous => ({ ...previous, [rowId]: { ...(previous[rowId] ?? { loading: false }), applied: undefined } }))
    const signal = AbortSignal.timeout(180_000)
    void api.enablePreset(rowId, fingerprint, signal)
      .then((result) => {
        setPresetApprovalId(undefined)
        // 成功回执里那一手「什么时候生效」先落进本行状态——`status` 只说装没装上，说不出这件事。
        // 随后重读的 `status` 用**合并**写（否则刚记下的回执会被一次重读抹掉）。
        const applied: EnterprisePresetAppliedReceipt = {
          application: result.application,
          ...(result.officialApplication === undefined ? {} : { officialApplication: result.officialApplication }),
          needsNewSession: result.needsNewSession,
          ...(result.alreadyInstalled === undefined ? {} : { alreadyInstalled: result.alreadyInstalled }),
        }
        setPresetStates(previous => ({
          ...previous,
          [rowId]: { ...(previous[rowId] ?? { loading: false }), applied, loading: false, errorCode: undefined },
        }))
        return api.presetStatus(rowId, signal).then(
          status => setPresetStates(previous => ({
            ...previous,
            [rowId]: { ...(previous[rowId] ?? { loading: false }), status, loading: false },
          })),
          () => undefined,
        )
      })
      .catch((error: unknown) => {
        const code = enterpriseLocalErrorCode(error)
        setPresetActionError({ id: rowId, action: 'install', code })
        if (code === 'ENT_PRESET_AUTHORIZATION_STALE') {
          // 确认的瞬间内容又变了：弹层**留在原地**并如实说「内容变了」，同时刷新披露（不给死按钮）。
          setPresetApprovalRunning(false)
          setPresetApprovalCode(code)
          void api.presetStatus(rowId, AbortSignal.timeout(30_000)).then(
            status => setPresetStates(previous => ({ ...previous, [rowId]: { status, loading: false } })),
            () => undefined,
          )
        }
      })
      .finally(() => setPendingPresetId(undefined))
  }
  const rendererActionUnavailable = api === undefined || !hasStore
  const onTogglePreset: ((row: EnterpriseMarketPresetRow, next: boolean) => void) | undefined =
    rendererActionUnavailable ? undefined : (row, next) => {
      // 进行中不许连点（D1：但**失败不禁用**，因为失败不设 pending）。
      if (pendingPresetId !== undefined) return
      const status = presetStates[row.id]?.status
      if (!next) {
        const declarationId = status?.declarationId
        if (declarationId === undefined) {
          // 停用需要 Host 归一化后的声明 id；真值没读到就如实说，而不是拿雪花 id 去猜。
          setPresetActionError({ id: row.id, action: 'uninstall', code: 'ENT_PRESET_STATE_INVALID' })
          return
        }
        setPendingPresetId(row.id)
        setPresetActionError(undefined)
        // 停用是「状态已变」的动作：上一次成功那句落地交代随之退场（不再是对当前状态的断言）。
        setPresetStates(previous => ({ ...previous, [row.id]: { ...(previous[row.id] ?? { loading: false }), applied: undefined } }))
        const signal = AbortSignal.timeout(180_000)
        void api!.disablePreset(declarationId, signal)
          .then(() => api!.presetStatus(row.id, signal).then(
            value => setPresetStates(previous => ({ ...previous, [row.id]: { status: value, loading: false } })),
            () => undefined,
          ))
          .catch((error: unknown) => {
            setPresetActionError({ id: row.id, action: 'uninstall', code: enterpriseLocalErrorCode(error) })
          })
          .finally(() => setPendingPresetId(undefined))
        return
      }
      if (status !== undefined && status.authorization === 'authorized') {
        runPresetEnable(row.id, undefined)
        return
      }
      // 未授权 / 指纹已变：**只弹授权层**，绝不替用户顺手授权（一次授权绑当前指纹）。
      setPresetApprovalCode(undefined)
      setPresetApprovalRunning(false)
      setPresetApprovalId(row.id)
    }
  /**
   * **降级链第二级**（跳到新会话并把导入指令填进输入框）：指令正文与第三级是**同一个**构造器产出的同一句，
   * 只是落点不同（那边写剪贴板、这边交给官方 `uiWorkspace` + `conversation` 的接线端口）。
   * 端口缺席 → 这一级不可用，降级链如实说明并落到第三级；端口返回 false / 抛错 → 行内给一句人话 + 稳定码。
   */
  const onOpenPresetInNewSession: ((row: EnterpriseMarketPresetRow) => void) | undefined =
    presetLaunch === undefined || !hasStore ? undefined : (row) => {
      const instruction = buildPresetImportInstruction(row, snapshot.status?.platformUrl ?? null)
      setPresetActionError(undefined)
      const failed = (): void => {
        setPresetActionError({ id: row.id, action: 'install', code: 'ENT_PRESET_LAUNCH_FAILED' })
      }
      void presetLaunch(instruction).then(ok => { if (!ok) failed() }, failed)
    }
  /**
   * 目录行与详情子页面**共用**的那一份 props（**不含** `skillPage`/`presetPage`，否则自引用）：
   * 行 facts 的唯一入口吃它，详情里的动作再吃同一份 facts，两处因此不可能各说一套。
   */
  const baseShellProps: EnterpriseMarketShellProps = {
    view,
    sessionUsable,
    onOpenLogin: openLogin,
    // 本机开关（资料库）：快照直传 + 拨动/重试两条动作；都没有真源时缺席 ⇒ 那一行开关禁用（不给假切换）。
    libraryGate: librarySnapshot,
    ...(onToggleLibrary === undefined ? {} : { onToggleLibrary }),
    ...(onRetryLibrarySave === undefined ? {} : { onRetryLibrarySave }),
    enterprisePlugins,
    enterpriseSkills,
    enterprisePresets,
    // 两个目录页签的四态与重试（唯一事实源：技能来自取数源、插件来自账号 store 的投影）。
    skillsListState: catalogState,
    ...(onRetrySkills === undefined ? {} : { onRetrySkills }),
    pluginsListState,
    ...(onRetryPlugins === undefined ? {} : { onRetryPlugins }),
    // 配方页签（本刀）：与另两个目录页签同形的四态 + 重试；动作是行上那枚**真开关**，
    // 降级链的第二/第三级各自只在接通时才渲染（缺席绝不画死按钮）。
    presetsListState: presetState,
    ...(onRetryPresets === undefined ? {} : { onRetryPresets }),
    onCopyPresetInstruction,
    ...(presetCopiedId === undefined ? {} : { presetCopiedId }),
    ...(onOpenPresetInNewSession === undefined ? {} : { onOpenPresetInNewSession }),
    presetStates,
    ...(onTogglePreset === undefined ? {} : { onTogglePreset }),
    ...(pendingPresetId === undefined ? {} : { pendingPresetId }),
    ...(presetActionError === undefined ? {} : { presetActionError }),
    onInstallPlugin,
    onTogglePluginEnabled,
    onUninstallPlugin,
    installedSkills,
    pendingSkill,
    onToggleSkill,
    pluginActionError,
    // 「安装中」的真进度三件事实：直接来自同一份 store 快照（在途动作 + 轮询刷新的真实受管态 +
    // 那一路读不到的码），行 facts 拿到后经 `plugin-install-progress.ts` 的唯一投影折成进度与交代。
    ...(snapshot.pluginBusy === undefined ? {} : { pluginBusy: snapshot.pluginBusy }),
    ...(snapshot.pluginSettled === undefined ? {} : { pluginSettled: snapshot.pluginSettled }),
    ...(snapshot.pluginProgressErrorCode === undefined
      ? {}
      : { pluginProgressErrorCode: snapshot.pluginProgressErrorCode }),
    // 取消那一族两件（本客户端的取消请求在不在路上 + 写入口）：与上面三件同一份 store 快照，
    // 缺席即那一行不画取消按钮（没写入口就不给死按钮）。
    ...(snapshot.pluginCancelBusy === undefined ? {} : { pluginCancelBusy: snapshot.pluginCancelBusy }),
    ...(onCancelPlugin === undefined ? {} : { onCancelPlugin }),
    skillActionError,
    expandedSections,
    onToggleSection,
    activeTab,
    // 切页签 = 换一份目录，插件详情随之关掉（详情只占「企业插件」页签的内容区；页签本身保持可见，
    // 用户点别的页签就是明确地在换页，不该再看到上一页的详情）。技能/配方详情是整页切换，页签那会儿
    // 根本不在 DOM 里，故这里只需管插件详情这一份状态。
    onSelectTab: (tab) => { setActiveTab(tab); setPluginDetailName(undefined) },
    // 搜索 + 筛选（标签行：搜索框在左、筛选下拉在右）。**本刀起真过滤**——三个状态经模型切可见行。
    // 点选筛选项后关菜单（照常规下拉交互）；搜索框不关菜单（用户可能边搜边调筛选）。
    searchText,
    onSearchChange: (text) => { setSearchText(text) },
    filterOpen,
    onToggleFilter: () => { setFilterOpen(prev => !prev) },
    filterStatus,
    filterCategory,
    onFilterSelect: (group, option) => {
      // 两组各写各的状态；`option` 在类型组里就是分类名（与选项真源同一份字面）。
      if (group === 'status') {
        setFilterStatus(option === 'enabled' || option === 'disabled' ? option : 'all')
      } else {
        setFilterCategory(option === 'all' ? 'all' : enterpriseMarketCategory(option))
      }
      setFilterOpen(false)
    },
    onClearFilters: () => {
      // 三件一起清（搜索 + 状态 + 类型）——「清空筛选」就该回到完整目录，不是只清一样。
      setSearchText('')
      setFilterStatus('all')
      setFilterCategory('all')
      setFilterOpen(false)
    },
    // 「⋯」更多菜单：开合态与行键都在控制器；未安装行不画它，故这里不必判行类型。
    menuRow,
    onToggleRowMenu,
    expandedRow,
    onToggleRow,
    // 点行本体 = 把**那一行**记成当前详情目标；行的开关与 `[有更新]` 有自己的回调，不经过这里。
    // 点行本体只记**包 id**；行对象在渲染时从当前目录投影里取，详情与行因此永远看同一份数据。
    // **本刀（企业配方页签）**：配方行同理——点行标题只记配方 id，详情与行看同一份目录投影
    // （故三个详情目标天然互斥：点某一行的标题只会把那一行的目标写进状态、顺手清掉另两个）。
    onOpenSkillDetail: (row) => { setSkillDetailId(row.id); setPresetDetailId(undefined); setPluginDetailName(undefined) },
    onOpenPresetDetail: (row) => { setPresetDetailId(row.id); setSkillDetailId(undefined); setPluginDetailName(undefined) },
    /**
     * 插件行标题那枚按钮的唯一回调（用户口径第 16 条）：**在点击这一刻**把两件事记下来 ——
     *  ① 滚动位置（列表一被替换，浏览器就会把容器的 `scrollTop` 夹回去，事后再读就晚了）；
     *  ② 是哪一行开的详情（返回时列表重新挂载，旧 DOM 引用已经不可用，故记**包名**）。
     * 判定复用 `scrollTargetOf`（与「企业设置 → 插件」那面同一枚实现，两面不会一处还原一处不还原）。
     */
    onOpenPluginDetail: (row) => {
      const target = scrollTargetOf(marketRoot.current)
      pluginScrollMemory.current = target === undefined ? undefined : { target, top: target.scrollTop }
      pluginOpener.current = row.packageName
      setPluginDetailName(row.packageName)
      setSkillDetailId(undefined)
      setPresetDetailId(undefined)
    },
    // 本页根节点的挂点（控制器是唯一注入点）：Esc / 焦点还原 / 滚动还原都钉在这一个节点上。
    sectionRef: marketRoot,
  }
  /**
   * 详情子页面的输入**只在这里构造一次**：行投影、行 facts（与行上同一个函数）、已装记录（同一份
   * `installedSkills`）、失败事实（同一份 `skillActionError`）与动作回调（同一个 `onToggleSkill`）。
   * 子页面因此不可能持有第二份「已装」或第二套动作逻辑；文件树/预览数据也只由上面两个 effect 取。
   * 面包屑「返回技能列表」= 清掉这个目标 id，面板随即回到列表视图（没有路由，就是一份视图状态）。
   *
   * 它吃的 `baseShellProps` 与目录行吃的是**同一份对象**（行 facts 的唯一入口就在这里调一次），
   * 因此详情与行上的「已装 / 有更新 / 是否在途」不可能算出两个答案。
   */
  const skillPage: EnterpriseSkillPageProps | undefined = skillPageRow === undefined ? undefined : {
    row: skillPageRow,
    facts: enterpriseMarketSkillRowFacts(baseShellProps, skillPageRow),
    ...(skillPageInstalled === undefined ? {} : { installed: skillPageInstalled }),
    ...(skillActionError?.id === skillPageRow.id ? { actionError: skillActionError } : {}),
    ...(onToggleSkill === undefined ? {} : { onToggleSkill }),
    fileEntries,
    filesLoading,
    ...(filesErrorCode === undefined ? {} : { filesErrorCode }),
    ...(selectedPath === undefined ? {} : { selectedPath }),
    ...(file === undefined ? {} : { file }),
    fileLoading,
    ...(fileErrorCode === undefined ? {} : { fileErrorCode }),
    onSelectFile: (path) => { setSelectedPath(path) },
    onReloadFiles: () => { setFilesAttempt(current => current + 1) },
    onReloadFile: () => { setFileAttempt(current => current + 1) },
    onBack: () => { setSkillDetailId(undefined) },
  }
  /**
   * **配方详情子页面的输入只在这里构造一次**（与技能详情同一条纪律，理由逐条相同）：行投影来自当前配方目录、
   * facts 走**行上同一个**入口 `enterpriseMarketPresetRowFacts`、动作是行上**同一个** `onCopyPresetInstruction`。
   * 详情取数结果（只消费 `dependencies`）与在途/失败码来自上面那一个 effect；面包屑「返回配方列表」= 清掉目标 id。
   */
  const presetPageRow = presetDetailId === undefined
    ? undefined
    : enterprisePresets.find(item => item.id === presetDetailId)
  const presetPage: EnterprisePresetPageProps | undefined = presetPageRow === undefined ? undefined : {
    row: presetPageRow,
    facts: enterpriseMarketPresetRowFacts(baseShellProps, presetPageRow),
    ...(presetDetail === undefined ? {} : { detail: presetDetail }),
    detailLoading: presetDetailLoading,
    ...(presetDetailCode === undefined ? {} : { detailErrorCode: presetDetailCode }),
    ...(onTogglePreset === undefined ? {} : { onTogglePreset }),
    ...(onOpenPresetInNewSession === undefined ? {} : { onOpenInNewSession: onOpenPresetInNewSession }),
    ...(onCopyPresetInstruction === undefined ? {} : { onCopyInstruction: onCopyPresetInstruction }),
    ...(presetActionError?.id === presetPageRow.id ? { actionErrorCode: presetActionError.code } : {}),
    onReloadDetail: () => { setPresetDetailAttempt(current => current + 1) },
    onBack: () => { setPresetDetailId(undefined) },
  }
  /**
   * **插件详情子页面（用户口径第 16 条）的输入只在这里构造一次**（与技能/配方详情同一条纪律）：
   * 行投影来自**当前**目录投影（`enterprisePlugins.find`，目录刷新后不停在旧副本上）、facts 走
   * **行上同一个**入口 `enterpriseMarketPluginRowFacts`（因此详情与行不可能各说一套已装/在途/进度）、
   * 动作与取消都交回**行上同一批**回调（`baseShellProps` 里那几枚）——纯组件 `EnterprisePluginDetailPage`
   * 只负责铺版面与写入口注入，本文件不复制第二份详情。
   *
   * 「企业版本」那一格用**与设置页详情同一枚**投影 `enterprisePluginCatalogVersionText`：目录里有这一版
   * 就说版本号；这一行已不在目录里（`inCatalog === false`）就如实说「已下架」（此刻 `row.version`
   * 是**本机**版本，不能拿它冒充企业版本）。行只在**就绪**态才渲染，故这里传 `ready`。
   * 【返回】= 清掉目标包名，页签里的内容区随即回到列表（没有路由，就是一份视图状态）。
   */
  const pluginPageRow = pluginDetailName === undefined
    ? undefined
    : enterprisePlugins.find(item => item.packageName === pluginDetailName)
  const pluginPage: EnterprisePluginPageProps | undefined = pluginPageRow === undefined ? undefined : {
    row: pluginPageRow,
    facts: enterpriseMarketPluginRowFacts(baseShellProps, pluginPageRow),
    catalogVersionText: enterprisePluginCatalogVersionText({
      catalogState: { kind: 'ready' },
      ...(pluginPageRow.inCatalog && pluginPageRow.version !== null ? { version: pluginPageRow.version } : {}),
    }),
    ...(onCancelPlugin === undefined
      ? {}
      : {
        // 取消写入口与行上同一枚：它只认行对象，而详情此刻就是这一行，故按包名回指当前目标行。
        onCancelInstall: (packageName: string) => {
          const target = enterprisePlugins.find(item => item.packageName === packageName)
          if (target !== undefined) onCancelPlugin(target)
        },
      }),
    onBack: () => { setPluginDetailName(undefined) },
    pageRef: pluginDetailPage,
  }
  const shellProps: EnterpriseMarketShellProps = {
    ...baseShellProps,
    ...(skillPage === undefined ? {} : { skillPage }),
    ...(presetPage === undefined ? {} : { presetPage }),
    ...(pluginPage === undefined ? {} : { pluginPage }),
  }
  /**
   * **授权弹层的输入只在这里构造一次**：行对象从当前目录投影里 `find`（目录刷新后不停在旧副本上）、
   * facts 走**行上同一个**入口、披露清单取**同一份** `status.disclosure`——因此弹层里列的逐项内容
   * 与随后 `enable` 校验的指纹必然来自 Host 的同一次渲染。
   * 目录里已经没有这个 id（下架 / 会话不可用）时它自己就是 undefined，弹层自然关闭。
   */
  const presetApprovalRow = presetApprovalId === undefined
    ? undefined
    : enterprisePresets.find(item => item.id === presetApprovalId)
  const presetApprovalStatus = presetApprovalId === undefined ? undefined : presetStates[presetApprovalId]?.status
  const presetApproval: EnterprisePresetApprovalProps | undefined =
    presetApprovalRow === undefined || presetApprovalStatus === undefined ? undefined : {
      row: presetApprovalRow,
      facts: enterpriseMarketPresetRowFacts(baseShellProps, presetApprovalRow),
      disclosure: presetApprovalStatus.disclosure,
      fingerprintChanged: presetApprovalStatus.authorization === 'fingerprint-changed',
      ...(presetApprovalCode === undefined ? {} : { errorCode: presetApprovalCode }),
      busy: presetApprovalRunning || pendingPresetId === presetApprovalRow.id,
      // 确认 = 把弹层展示的那一枚指纹原样回传（一次授权绑当前指纹）；Host 会要求它与当前配方逐字相等。
      onConfirm: () => {
        setPresetApprovalRunning(true)
        runPresetEnable(presetApprovalRow.id, presetApprovalStatus.fingerprint)
      },
      // 取消不留任何状态：清掉目标即可，授权写入**只**发生在 Host 收到 confirmFingerprint 时。
      onCancel: () => { setPresetApprovalId(undefined) },
    }
  return {
    // 页面 props **只在这里构造一次**：目录行与详情子页面拿到的是同一个形状、同一批事实。
    shellProps,
    ...(presetApproval === undefined ? {} : { presetApproval }),
    loginOpen: dialog.open,
    closeLogin: dialog.closeDialog,
  }
}

/**
 * 唯一的宿主：含 hook 的接线——控制器 → 目录页外壳（或它里面的详情子页面）→ 登录弹窗 + 授权弹层。
 * 详情子页面由外壳按 `shellProps.skillPage` **整页切换**渲染，故本宿主不必再持第二份详情状态；
 * 视图状态（哪个技能、树/预览读到哪、哪条配方正在等确认）全部在控制器里，这里只负责把三件弹窗/页面挂上。
 */
export function EnterpriseMarketShellHost({ view, store, libraryGate, presetLaunch, tabSeat }: {
  readonly view: 'summary' | 'page'
  readonly store?: EnterpriseAccountStore | undefined
  readonly libraryGate?: EnterpriseLibraryGate | undefined
  /**
   * 降级链第二级的接线（由 `client.tsx` 在 apply 里建，见 `preset-launch.ts`）。
   * 缺席 = 这台设备上这一级不可用，降级链如实说明并落到第三级。
   */
  readonly presetLaunch?: EnterprisePresetLaunchPort | undefined
  /**
   * 标题右侧页签的座位源（由 `client.tsx` 在 apply 里建、两处注册面共用）。
   * **发布只发生在这里**（页面是这两棵 React 树里持有控制器的那一棵）；缺席即不发布，
   * 标题行那一格就只出两枚按钮（降级路径，不报错）。
   */
  readonly tabSeat?: EnterpriseMarketTabSeat | undefined
}): ReactNode {
  const controller = useEnterpriseMarketController({ view, store, libraryGate, presetLaunch })
  // 把「页签条目 + 当前选中 + 选中回调」发布给标题行那一格。
  // 依赖里刻意**不放**数组引用（模型每帧重建数组），签名比较在 `publish` 里做，故不会自激重渲染。
  // **恒发布**（详情子页面也发）：既有契约是「进详情时页头与四枚页签保持可见、一字不改」，
  // 详情里停发会让标题行那格空掉。
  const tabEntries = enterpriseMarketShellModel(controller.shellProps).tabEntries
  const tabActive = controller.shellProps.activeTab
  const tabSelect = controller.shellProps.onSelectTab
  useEffect(() => {
    tabSeat?.publish(tabEntries === undefined || tabActive === undefined || tabSelect === undefined
      ? undefined
      : { entries: tabEntries, activeTab: tabActive, onSelect: tabSelect })
  }, [tabSeat, tabEntries, tabActive, tabSelect])
  return (
    <>
      <EnterpriseMarketLegacyShell {...controller.shellProps} tabsInTitle={tabSeat !== undefined} />
      {controller.presetApproval === undefined
        ? null
        : <EnterprisePresetApprovalDialog {...controller.presetApproval} />}
      <EnterpriseLoginDialog store={store as EnterpriseAccountStore} open={controller.loginOpen} onClose={controller.closeLogin} />
    </>
  )
}

/**
 * 官方 `plugins.item` 的真实入口（**唯一入口**）：官方插件页「官方」分组里的「插件市场」卡片点进去的详情页。
 * @param props - `view` 由官方透传（卡片 `summary` / 详情 `page`）；`store`/`libraryGate`/`presetLaunch` 由注册面的 `inject` 注入。
 */
export function EnterpriseMarketLegacyPage({ view, store, libraryGate, presetLaunch, tabSeat }: {
  readonly view: 'summary' | 'page'
  readonly store?: EnterpriseAccountStore | undefined
  readonly libraryGate?: EnterpriseLibraryGate | undefined
  readonly presetLaunch?: EnterprisePresetLaunchPort | undefined
  readonly tabSeat?: EnterpriseMarketTabSeat | undefined
}): ReactNode {
  return (
    <EnterpriseMarketShellHost
      view={view}
      store={store}
      libraryGate={libraryGate}
      presetLaunch={presetLaunch}
      tabSeat={tabSeat}
    />
  )
}
