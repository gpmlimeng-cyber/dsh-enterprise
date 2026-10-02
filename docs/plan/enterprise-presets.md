<!--
[INPUT]: 依赖仓库既有配方实现（V30 三表、server preset 纵向、console/features/presets、plugin/packages/ui/src/preset-market.tsx、
         marketplace-entry.tsx 的 ENTERPRISE_MARKET_COMPONENTS、contracts/components|paths/preset.yaml、docs/compose/spec/preset-square.md）、
         本会话对官方 Harness 0.2.0-rc.2 安装目录的只读取证（dsh-agent-preset / dsh-agent-preset-registry / dsh-agent-presets /
         dsh-client-ui-agent-preset / dsh-web-app/presets/*.patch.yml，以及 skills/editing-cordis-compositions 与 skills/cordis-composition-reference）、
         既有规划 docs/plan/enterprise-marketplace-phase2.md、skill-install-sources.md、skill-ingest-center.md、borrow-from-skillhub.md。
[OUTPUT]: 给出「配方 / Agent 预设」进入企业商城的方案规划：地基真实状态、官方 preset 语义抽取（格式/构成/生效/有无导入面）、
          引用 vs 快照的版本耦合取舍、包格式与落点、分发与权限、治理与信任、员工端体验契约、服务端与前端改动清单、
          P0/P1/P2 人日与前置依赖、开放问题、明确不做、与其它规划的关系、不确定项。
[POS]: docs/plan 下的方案规划文档（**只规划、不实现**）。本文不替代 docs/compose/spec/preset-square.md（一期已交付的实现真源），
       而是它的下一期：把「浏览 + 复制导入指令」推进到「企业分发的一份配方能被员工点一下启用」。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md。
-->

# 企业配方 / Agent 预设 · 规划（Preset 二期）

> **本文只出方案，不含任何实现、不改任何源文件、不新增依赖。**
> 所有「现状」都是本会话读到的源码或官方安装目录；**读不到/官方能力面不明确的一律进 §M 不确定项**，
> 不编造格式、字段名或端点。引用仓库事实给 `路径:行号`，引用官方能力给 **包名 + 文件 + 行号**，服务端文件给绝对路径。

---

## 0. 一句话结论（先看这段）

**地基比「技能」更厚，但比「技能」少一条腿。**

- **厚的一半**：配方（`.dshpreset`）在企业控制面**已经是完整实现**——库表三张、服务端纵向（验包/幂等/CAS/发布/退休/可见范围/授权下载/审计五事件）、
  控制台纵向（上传/发布/退休/范围）、员工端列表与详情**全部已交付**（`docs/compose/spec/preset-square.md:13` 自述「delivered」、`:218-224` T1–T7 全部 `[x]`）。
- **少的一条腿**：官方 Harness `0.2.0-rc.2` **没有「从外部文件导入一个 preset」的能力面** —— preset 只能由 **bundle patch 安装**进入 profile
  （`dsh-agent-preset-registry` README 第 48 行、`editing-cordis-compositions` SKILL 第 4 句）。
  所以我们今天能做的「员工端消费」只有**复制一段给 Agent 看的导入指令**（`preset-market.tsx:36-52`），**没有任何一键启用**。
- **因此本方案的主线不是「再造一个配方广场」（那已经有了），而是补这一条腿**：
  把官方唯一的安装面（bundle patch）包成一份**企业配方包的安装器**，装进员工本机 profile，再由官方 picker 选择生效。

---

## A. 定位：配方是什么，与技能/插件的边界

| 资产 | 一句话 | 解决的问题 | 消费方式 |
|---|---|---|---|
| **技能**（`.dshskill`） | **能力** | 「这个 Agent 会做某件事」 | 落盘到 `<dshHome>/skills`，官方 `skill-filesystem` watcher 免重启发现 |
| **插件**（tgz/npm） | **扩展** | 「这个 Agent 多几个工具/面板/服务」 | 装进 profile，重启生效 |
| **配方**（`.dshpreset`） | **把前两者组装成能干活的智能体** | 「这个 Agent 是谁、用哪个模型、带哪些技能和插件、守什么规矩」 | **由官方 picker 选择一份 composition，会话从它组装** |

**配方 = 一份 Agent composition（官方称 agent preset / Cordis composition）+ 一份企业管理元数据。**

它的增量价值**不是**「又一种包」，而是三条：

1. **预组装**：员工不必自己挑插件、装技能、写人设，登录后选一份「报销专员 / 代码评审 / 新成员上手」就能干活。
2. **可治理**：技能和插件是**原子能力**，配方是**组合**；组合比原子更容易出安全事故（一个能读文件的工具 + 一个默认挂载的 bash），
   所以它必须走与插件同级的**管理员独占发布 + 可见范围裁决**（`docs/compose/spec/preset-square.md:36`）。
3. **可复现**：配方钉住「哪一套组合跑得通」，这是技能/插件单件分发给不了的东西。

**边界（必须写进产品文案）**：配方**不携带**能力，它**指向**能力。装一份配方不会把技能和插件塞进本机——
这是 D 节「引用 vs 快照」的全部由来。

---

## A1. 已有地基的真实状态（逐条 + 出处）

### A1.1 服务端：**完整实现**，不是「只建了表」

| 事实 | 出处（绝对路径） |
|---|---|
| **三张表已建**：`ent_preset_package`（preset_id/display_name/status/revision，tenant 内 unique）、`ent_preset_version`（source_dsh_version/artifact_ref/size_bytes/sha256/status/created_by/revision，`uq(package_id, source_dsh_version)` + `uq(tenant_id, sha256)`）、`ent_preset_assignment`（subject_type/subject_id/status）+ 两条 partial unique index | `/data/user/0/com.deepcode.shell/files/dsh-enterprise/server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V30__enterprise_preset_square.sql:6-75` |
| **权限码 `ent:preset:read` / `ent:preset:write` 已授予 `enterprise_admin` 与 `plugin_admin`** | 同上 `:77-92` |
| **审计 action 白名单已扩五条**：`PRESET_VERSION_UPLOADED / _PUBLISHED / _RETIRED / PRESET_ASSIGNMENTS_REPLACED / PRESET_DOWNLOAD_AUTHORIZED` | 同上 `:94-108`；`AuditAction.java:35-39` |
| **验包闸门（单遍流式、不解压到文件系统）**：拒绝 `..`/绝对路径/反斜杠/重复 entry/超 entry/超解压体积；要求根 `manifest.json` 且 `preset/agent.cordis.yml` **存在**；manifest 校验 `format=dsh-preset`、`version=1`、`id` 正则、`name ≤120`、`sourceDshVersion ≤64`、`description ≤2000` | `.../preset/artifact/PresetArtifactInspector.java:39-120`（关键行：`:66-68`、`:77-78`、`:109-119`） |
| **状态机 `VALIDATED → PUBLISHED → RETIRED`，无第四态** | `PresetVersion.java`；DDL 约束 `V30…sql:40`；契约枚举 `contracts/components/preset.yaml:15-17` |
| **写路径三步全在**：`upload()` 幂等（同 presetId+sourceDshVersion，或同 sha256 → 返回既有行 `created=false`）、`publish()`、`retire()`；`from` 态不匹配抛 `NOT_PUBLISHED` | `.../preset/application/PresetCatalogService.java:88-163`、`:165-177`、`:238-260` |
| **可见范围全量原子替换**（禁增量补丁）、`ALL` 至多一条、`USER` 去重 + 成员存在性检查、CAS revision 冲突 | 同上 `:179-236` |
| **管理端 5 个 operation 已实现**：GET 列表（cursor）、POST multipart 上传、publish、retire、assignments/batch；artifact 路径不进响应 | `.../preset/web/AdminPresetController.java:57-143`；`PresetViews.java:20-45` |
| **员工端 3 个 operation 已实现**：列表、详情、授权下载（Range/ETag/nosniff/`application/vnd.dsh.preset+zip`） | `.../preset/web/RuntimePresetController.java:44-87` |
| **每次下载重算可见性**（不缓存授权）：`findPublishedVersionForUser` 校验 `v.status='PUBLISHED' AND p.status='ACTIVE'` + assignment exists | `.../preset/application/PresetRuntimeService.java:87-95`；`.../perset/persistence`→`.../preset/persistence/JdbcPresetStore.java:245-262` |
| **运行时列表只取每个 package 的「最新 PUBLISHED」那一版** | `JdbcPresetStore.java:192-217`（子查询 `order by created_at desc, id desc limit 1`） |
| **投影差异（重要）**：**运行时光滑的列表投影不含 `versionId`**（`PresetViews.runtime` 只输出 7 字段），详情投影才含 `versionId` + `sha256` | `PresetViews.java:37-42` vs `:44-50`；契约 `contracts/components/preset.yaml:163-185`（`RuntimePresetSummary` 无 versionId，`RuntimePresetDetail` 有） |

**如实结论：服务端是「完整实现」，不是半套。** 唯一"半套"的地方是**它管的是「一个 ZIP 制品」，而不是「一份可被选中的 Agent composition」**——
服务端**不解析、不校验、不消费** `agent.cordis.yml` 的语义（`docs/compose/spec/preset-square.md:57` 明确「服务端不解析/执行 Cordis YAML」）。
也就是说：**今天我们无法回答「这份配方引用了哪些插件/技能，它们在本机装没装」。** 这是 D 节与 G 节要补的核心缺口。

### A1.2 控制台：**能做上传/发布/退休/分配**，管理面完整

| 能力 | 出处 |
|---|---|
| 独立产品纵向路由 `/presets`，`allowedRoles: ['enterprise_admin', 'plugin_admin']`，归类在侧栏「技能与插件」 | `console/src/app/product-routes.ts:22`、`:47` |
| 页头文案已如实写「托管 Desktop dsh-preset v1 包；发布后员工可在设置中浏览并复制导入指令」 | `console/src/features/presets/preset-management-page.tsx:338` |
| 两段工作台：**配方版本**（发布/退休按钮 + 状态筛选 + 搜索 + 上传按钮）与**可见范围**（成员名解析 + 配置范围按钮） | 同上 `:209-330`（`canWrite = bootstrap.permissions.includes('ent:preset:write')` 在 `:209`） |
| 上传对话框：`accept=".dshpreset,application/vnd.dsh.preset+zip,application/zip"`，**只校验扩展名**，服务端才是真验包 | `preset-editors.tsx:58-59`、`:81`；`CLAUDE.md:9`（「只收集产品语义，不解析 ZIP」） |
| multipart 契约：`artifact` 保持 `File` 本体，`metadata` 走 `application/json` 的 Blob（Spring `@RequestPart`） | `preset-management-page.tsx:73-80`；测试锁 `preset-management-page.test.ts` |
| 上传/发布/退休/范围全部带 `Idempotency-Key` 与 `If-Match: revision` | 同上 `:229`、`:239`、`:256` |

**如实结论：管理面没有缺口。** 「上传 → 发布 → 分配」今天就能跑通。

### A1.3 员工端 `preset-market.tsx`：**只读浏览 + 复制一段指令**，没有启用

| 事实 | 出处 |
|---|---|
| 数据源是 **Host 本地 API**（Client 不持 Access Token），经 `store.api.presets()` / `presetDetail(id)` | `preset-market.tsx:14`、`:79`、`:98` |
| 承载位置：**设置弹窗内的「配方」tab**（不是主内容区、不是独立页） | `account-view.tsx:70`（`SettingsTab` 含 `'presets'`）、`:278`、`:349-350` |
| 列表卡片 = 图标 + `displayName` + `description` + 一行 meta `DSH {sourceDshVersion} · {sizeBytes}`；**没有开关、没有按钮、没有状态签** | `preset-market.tsx:134-147`（meta 在 `:144`） |
| 详情弹窗 = 橙色信任提示（「自定义 Preset 是可执行配置…」）+ 描述 + `预设 ID` + **只读 textarea 里的一段指令** + 「复制导入指令」 | 同上 `:150-169`（提示文案在 `:154`） |
| 「启用」的**替身**是一段给 Agent 读的自然语言：读取 Preset Square Skill → 下载 → 检查安全信息 → **向用户确认** → 导入；含 `Preset: {downloadUrl}` / `名称` / `预设 ID` / `建议目标标识：{presetId}-ent` | 同上 `:36-52` |
| 零死按钮纪律已落地：未登录不显示列表给「登录后可浏览」、加载/空/错误三态分明、错误给稳定码 `role="alert"`、复制成功变「已复制」 | 同上 `:125-133`、`:130`、`:166` |
| 明确的边界自述：「一期不扩展 plugin-distribution 状态机」「不自动下载/导入」 | 同上文件头 `[POS]`/`[OUTPUT]` 第 3-4 行；`docs/compose/spec/preset-square.md:37` |

**条目模型与状态表达**：契约 `EnterpriseRuntimePreset = { id, presetId, displayName, description, sourceDshVersion, sizeBytes, updatedAt, versionId }`
（`plugin/packages/ui/src/local-api-decode.ts:121-131`），但**列表投影里 `versionId` 恒为 `''`**——
解码器把它标为可选并回落空串（`:723` 的 key 白名单把 `versionId`/`sha256` 放 optional 位，`:738` 回落 `''`），
真值只在详情投影。所以**列表行今天拿不到「可下载的那一版」**，只有点了详情才有。这与技能端「列表 `versionId` 恒空」是同一族问题（`docs/plan/enterprise-marketplace-phase2.md` 已记该 N+1 债）。

**本机路由（两条）**：
- exact `GET /enterprise/api/v1/local/presets`（列表）
- prefix `GET /enterprise/api/v1/local/presets/<packageId>`（详情，`packageId` 必须匹配 `^[1-9][0-9]{0,18}$`）
出处：`plugin/packages/platform-client/src/local-api.ts:49`（`PRESET_DETAIL_PREFIX_ROUTE`）、`:717-763`；上游是 `platform-service.ts:638-647`。
本地 API 前缀常量：`local-api.ts:28`（`LOCAL_API_PREFIX = '/enterprise/api/v1/local'`），与技能路径同族（`plugin/packages/bundle/src/skill-route.ts:15`）。

### A1.4 商城的「配方」格子：**`reserved: true`，真形状抄录如下**

`plugin/packages/ui/src/marketplace-entry.tsx:34-39`：

```ts
/** 详情页组件列表真源：三行按交付顺序，`reserved` 决定状态点与开关禁用。 */
export const ENTERPRISE_MARKET_COMPONENTS = [
  { id: 'plugins', label: '插件', module: 'enterprise plugins · remote.pluginManager', note: '企业发布的插件与官方插件包', reserved: false },
  { id: 'skills',  label: '技能', module: 'official skills/list', note: '企业发布的技能包与装配指令', reserved: false },
  { id: 'presets', label: '配方', module: 'dsh-preset / .dshpreset', note: '企业配方广场', reserved: true },
] as const
```

同文件 `:41-49` 是「交付排期清单」（历史元数据、**不驱动渲染**）：

```ts
export const ENTERPRISE_MARKET_PLAN = [
  { id: 'plugins', label: '插件', note: '官方 / 已安装 / 企业插件 三分组' },
  { id: 'skills',  label: '技能', note: '已排期' },
  { id: 'presets', label: '配方', note: '预留' },
] as const
```

`reserved` 的五处行为（全部纯函数，可直接引用为「转正」时的改动点）：

| 投影 | 配方行的取值 | 出处 |
|---|---|---|
| `enterpriseMarketComponentEnabled(id, usable)` | 恒 `false` | `:621-625` |
| `enterpriseMarketComponentState(...)` | 恒 `'预留'` | `:628-632` |
| `enterpriseMarketComponentDot(...)` | 恒 `'idle'` | `:635-637` |
| `enterpriseMarketComponentSwitchDisabled(...)` | 恒 `true`（官方 `Switch` 拨不动） | `:640-646` |
| 计数摘要 | 「共 3 个 · N 可用 · **1 预留**」 | `:649-666` |

图标：`COMPONENT_GLYPHS = { plugins: Package, skills: Sparkles, presets: BookMarked }`（`:1061`），配方已有自己的一枚 `BookMarked`。
页签真源里**没有**配方页签：`ENTERPRISE_MARKET_TABS` 只有 `企业技能 / 企业插件 / 组件`（`:76-80`），默认页签是 `skills`（`:84`）。
入口卡片的一句话是「企业插件 · 技能 · 配方」（`ENTERPRISE_MARKET_SUMMARY`）。

> **注意** `docs/plan/enterprise-marketplace-phase2.md:210`、`:244`、`:366` 那张「配方（预留）· 排期外」的表与 `ENTERPRISE_MARKET_COMPONENTS.presets.reserved`
> 是**同一件事的两处记录**；二期商店整页（侧栏一级菜单 + 主内容区多页签）尚未实现，本文 §H 的「转正」改动点同时适用于**现状（设置弹窗 tab）**与**二期整页（页签）**两种承载。

---

## A2. 官方的 preset 语义（最关键的一节）

> 取证对象：官方 DeepSeek Harness **`0.2.0-rc.2`**（`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/package.json:4`），**只读**，未改动。
> 两枚官方技能的实际落点：`<dsh>/node_modules/@deepseek-ai/dsh-agent-preset/skills/{editing-cordis-compositions,cordis-composition-reference}/SKILL.md`。

### A2.1 文件格式与落点

| 问题 | 官方答案 | 出处 |
|---|---|---|
| preset 是什么？ | **一条 `@deepseek-ai/dsh-agent-preset` 声明**，carried by bundle patches。**没有任何东西就地编辑声明**；创建/修改 = 装一个 bundle，其 patch 声明或覆盖它 | `editing-cordis-compositions/SKILL.md` 第 3-4 句 |
| 落点在哪？ | 出厂的 Web preset 是 **`@deepseek-ai/dsh-web-app` bundle 的 `presets/<id>.patch.yml`**（ids: `standard`/`ptc`/`minimal`/`cordis`）；安装后 bundle 从 dsh 安装目录解析，不在 profile | 同上第 6 句；实体文件：`<dsh>/node_modules/@deepseek-ai/dsh-web-app/presets/{standard,ptc,minimal,cordis}.patch.yml`（本会话已读 `standard`/`cordis`/`minimal` 三份） |
| 声明的字段？ | `id`（必需，小写字母/数字/连字符）、`plugins`（必需 Cordis entry list）、可选 `name`/`description`/`order`（roster 位置） | 同上「声明行有这些 config 字段」段 |
| Loader row id 约定 | `preset-<id>` | 同上 |
| **patch 方言** | `insert: [rows]` 追加；带 `id` 且无 `insert` 的 patch **覆盖该 row**，`config` 是**整体替换、绝不深合并**（必须重述所有字段）；`group: true` + `name: cordis:group` 让 `config` 成为嵌套 entry list 并可被按 id 插入；`cordis:include` 从 `config.path` 载入 YAML/JSON；`disabled` 接受布尔/null/`!!js` 表达式；`isolate` 把服务名映射到 `true` 或 realm 标签 | `cordis-composition-reference/SKILL.md`「Loader patch dialect」节 |
| `!!js` 规则 | 是 Loader 表达式，**不是 `!js`**；在 `config` 内于该 row 的 injections 激活后求值、对着**该插件自己的 ctx**（故 `!!js dshHomePath('sessions')`、`!!js "!ctx.get('profileContext')"` 合法）；**其他 row 元数据保持字面量** | 同上 |
| 兼容老格式？ | **老目录格式 `<dshHome>/.agent-presets/<id>/{preset.yml,agent.cordis.yml}` 已经没有任何东西读它**；迁移方法 = 造一个 bundle，声明取目录名做 `id`、`preset.yml` 取 name/description/order、`agent.cordis.yml` **逐字**做 `plugins`，并**逐个核对插件包名**（改过名的包会在激活时失败） | `editing-cordis-compositions/SKILL.md`「Migrate a legacy preset」段 |

**本机实证**：该老目录**确实还在**，并带一份真实配方——`/data/user/0/com.deepcode.shell/files/home/.dsh/.agent-presets/phone-control/`
（`preset.yml` 三字段 `name/description/order`；`agent.cordis.yml` 是一份完整 standard 组合，含 `insert` 之外的全部方言用法：
`disabled: !!js process.platform === 'win32'`、`cordis:group` + `isolate: {planMode: true}`、`customSkillDirs` 指向包内 `skills/`）。
**它是「新格式下的合法素材」而非「可被读取的配置」**——这一点直接决定我们的包格式（§C）。

### A2.2 一份 preset 由什么组成

**官方答案：只有一份 Cordis entry list。** preset 自己不"包含"模型/技能/规则，它是**挂载哪些插件**的声明；模型、技能、规则、工具白名单全部是**被挂载插件的能力**：

| 企业配方想表达的东西 | 官方里靠哪个 row 实现 | 出处（本会话已读到的真实行） |
|---|---|---|
| 模型与参数 | **不在 preset 里**。`persona` 用 `{{model}}`/`{{cwd}}` 从 **agent 自己的 route 与 workspace** 解析；模型路由属于 Host 组合 | `dsh-web-app/presets/standard.patch.yml:11-15`（`persona` 的 `prefix`/`suffix`）；`dsh-web-app/presets/cordis.patch.yml:23-26`（`{{model}}`/`{{cwd}}` + 「The host composition…keeps the model route」在文件头注释里） |
| 人设 / 起始提示词 | `@deepseek-ai/dsh-persona` 的 `config.prefix`/`suffix`/`complete` | `standard.patch.yml:11-15`；`minimal.patch.yml:11-15`（`persona` 是**唯一** row，带 `complete: true`, `includeRuntimeContext: false`） |
| 规则文件（CLAUDE.md/AGENTS.md） | `@deepseek-ai/dsh-agent-instructions`（`maxBytes`）——它读工作区里的指令文件 | `standard.patch.yml:16-19`（`maxBytes: 65536`） |
| 技能集合 | `@deepseek-ai/dsh-skill-filesystem`（`customSkillDirs`）+ `@deepseek-ai/dsh-tool-skill`；`cordis` preset 把 `customSkillDirs` 指到**包内 `skills/`** | `standard.patch.yml:34-37`；`cordis.patch.yml:143-149`（`customSkillDirs` 的 `!!js … createRequire(baseUrl).resolve('@deepseek-ai/dsh-agent-preset/package.json') … join … 'skills'`） |
| 插件集合 | **就是 `plugins` 里那些 row**（`name` 是包 specifier）；本地相对路径 **anchored beside their patch file** | `cordis-composition-reference/SKILL.md`「A row has…」段 |
| 工具白名单 | 少挂 = 白名单（`minimal` 只有 `persona` + 一个持久 shell 组）；`disabled` 可在**每次 mount 决策**时按表达式开关 | `minimal.patch.yml:1-5`（文件头注释「minimal」语义）；`cordis-composition-reference/SKILL.md` `disabled` 条 |
| 权限预设 / 沙箱 | **不是 preset 的职责**——沙箱与批准栈留在 Host 组合 | 本机既有的 composition 正文里写得很直白（`/data/user/0/com.deepcode.shell/files/home/.dsh/.agent-presets/phone-control/agent.cordis.yml:7-9`）：「The host composition (`base.cordis.yml` + `web.cordis.yml`) keeps everything a preset must not own: the registries themselves, **the sandbox and approval stack**, persistence, and the model route」 |
| 工作区上下文 | 由 `{{cwd}}` 与 workspace 服务给；preset 只声明 `agent-instructions` 这类消费者 | `standard.patch.yml:11-19` |
| 隔离 | 提供**服务**的 preset 插件必须把 provider 与全部 consumer 隔离进同一 realm；`isolate` 控制服务实例，`scope` 控制贡献与事件可见性 | `editing-cordis-compositions/SKILL.md`「Choose plugin placement」段；`cordis-composition-reference/SKILL.md` `isolate` 条 |

> **对企业方案的直接含义**：我们要的「模型 / 温度 / 工具白名单 / 起始提示词」**不是四种数据**，而是「挂 `persona` + 挂/不挂某些工具 row + 由 Host 决定模型」。
> 配方包里**写不下，也不该写**「模型 = X」——那属于企业平台侧的**模型/访问策略域**（§B.1）。

### A2.3 怎么被选中与生效

| 问题 | 官方答案 | 出处 |
|---|---|---|
| 谁来选？ | **每个会话**（session）选一份；一个进程可同时跑多份不同的 preset，状态互不串 | `dsh-agent-presets` README「Use this package」第 1 段：「give each session the tools, prompt sections, and skills named by one preset's `agent.cordis.yml`… One process can run sessions with different presets while keeping their state separate」 |
| 谁能切？ | **只有空会话能切**（`only an empty session may switch presets`）；子 agent 加入**父 agent 的组合** | 同上第 2 句；同 README「What a preset gives a session」 |
| 默认值？ | 部署默认来自 `agent-preset-registry` 的 `config.default`（出厂 `standard`）；**用户默认**存在该 entry 的 `selectedDefault` 易失字段，新会话在部署默认之上解析它；用户默认也可由 settings 命名空间 `agent-presets: {default: ...}` 分层 | `dsh-web-app/cordis.patch.yml:559-565`（`agent-preset-registry` + `default: standard`）；`dsh-agent-preset-registry/README.md:46-47`；`dsh-agent-presets/README.md`「Choosing the default preset」 |
| 改一份已装 preset 的影响面？ | **已存在会话与其子会话保留它们启动时的那一版插件修订**；要验证新行为必须开新会话 | `editing-cordis-compositions/SKILL.md`「Verify」段；`dsh-agent-preset/README.md`「KV Cache effect」：「A live Agent's composition stays stable; new Agents can use an updated definition」 |
| 登记与回滚？ | 声明**急切激活一次**并被选择它的 Agent 共享；更新/移除一份声明会**退役上一修订**，最后一个引用释放时销毁退役树；`plugin_manager list_plugins` 报每行 `enabled`/`fiberPhase`，`set_plugin`/`set_bundle` 在被更高优先级层压过时回 `overridden` | `editing-cordis-compositions/SKILL.md`；`dsh-agent-preset-registry/README.md`「Understand the implementation」；`cordis-composition-reference/SKILL.md` 末段 |
| 失败会怎样？ | **激活失败的声明留在 roster 上并带诊断**，在 bundle 修好重装之前**不能组成会话**；老会话不受影响 | `editing-cordis-compositions/SKILL.md`「Verify」段 |
| Web 上怎么看？ | 设置里按「内置 / 自定义」卡片组、默认高亮、卡片体选择；每张卡「View configuration」把声明的**只读 YAML（含 `!!js` 条件）**打开展示；页面**什么都不编辑**，「Creator」入口开一个 Creator-mode 任务去**以 bundle 形式**author/override | `dsh-client-ui-agent-preset/README.md:28`、`:40` |
| 远程面有哪些？ | 只有 `agentPresets/list`（roster + 标记当前默认）与 `agentPresets/read`（读一份声明的 YAML）；**「nothing accepts YAML back」** | `dsh-client-ui-agent-preset/README.md:40`；`dsh-agent-preset-registry/README.md:48` |

### A2.4 ★有没有「从外部导入一个 preset」的能力面？——**没有**

**结论（逐条证据）：**

1. **registry 明说不扫描目录、不接受 preset 路径**：
   「The Web definitions come from the `dsh-web-app` bundle. **Definitions are ordinary plugin rows; the registry neither scans directories nor accepts preset paths.**」
   —— `dsh-agent-preset-registry/README.md:46`。
2. **registry 明说没有任何东西接受 YAML 回来，唯一入口是 bundle patch**：
   「The registry writes no declarations… **nothing accepts YAML back.** A new preset or an override of a shipped one is a bundle patch: an `insert` of a `@deepseek-ai/dsh-agent-preset` row, or a patch keyed by that row's id, **installed into the profile with `plugin_manager`**」
   —— `dsh-agent-preset-registry/README.md:48`。
3. **`@deepseek-ai/dsh-agent-preset` 声明「no directory, file-copy or file-delete operations」** —— `dsh-agent-preset/README.md:84`。
4. **`editing-cordis-compositions` 把唯一的安装动作写成 `plugin_manager install_bundle`，并明确它需要在 Host 进程执行代码 / Full access 或批准**：
   「Install with `plugin_manager`, `action: install_bundle`, `target` set to the absolute bundle directory… **Installing a bundle executes plugin code in the Host process, so it requires Full access or approval.**」
   —— `editing-cordis-compositions/SKILL.md`「Create a preset」与「Verify」段。
5. **本会话穷举搜索结果**：在 `<dsh>/node_modules` 全树 grep `preset.import` / `presetImport` / `importPreset` —— **零命中**；
   在 `@deepseek-ai/dsh-api-remotes/lib/index.js` 里 preset 相关只有一条事件名 `agent-preset/selected`（`:19`）。
   即：**当前 0.2.0-rc.2 不存在任何 preset 导入端点**（含 Web/loopback）。

**但要说清楚两件"看似存在"的东西：**

| 看着像导入面的东西 | 真相 | 判定 |
|---|---|---|
| `@deepseek-ai/dsh-agent-presets` 这个包**确实扫描目录**（`roots`：`[]`，每项 `{path, trust}`；`includeShippedRoot`/`includeUserRoot` 默认 true，后者 = `<dshHome>/.agent-presets`） | 它是**另一套**（session 级 composition + 目录发现 + authoring/`compositionInventory`）。**本 profile 没有挂它**：`dsh-web-app/cordis.patch.yml:562-565` 挂的是 `agent-preset-registry`，本会话在其依赖树/配置里没找到 `dsh-agent-presets` 的挂载点（它只作为 `dsh-host-apiproxy` 的依赖存在，`package.json:80`/`:85`） | **不能作为方案地基**（§M 记为不确定项：不能排除某些部署形态挂着它） |
| 一期文案里的 `POST $DSH_WEB_URL/api/agent-preset.import?agentPreset=<targetId>&install=1` | 只在 `docs/compose/spec/preset-square.md:180` 作为**Desktop 侧的约定**写下，**在 0.2.0-rc.2 安装目录里零命中** | 属于 **Desktop（另一条产品线）的能力面**，不能算进本方案的可达路径 |

**因此我们"能不能真的分发一份配方"？——能，但路径不是「导入」，而是「安装一个 bundle」。**
替代路径（§C 详述）：

```text
我们自己的 .dshpreset（企业包）
  → 服务端验包/发布/分配（已有）
  → 员工端「启用」= 由客户端把 preset/agent.cordis.yml 包装成一个最小 bundle 目录（package.json + cordis.patch.yml）
  → 走官方唯一安装面（plugin_manager install_bundle 等价动作）
  → 官方 registry 急切激活该声明 → picker 里出现 → 用户/默认选中
```

**这条路径的三个硬风险（必须写进方案，不许含糊）：**

1. **它执行代码**：官方明说装 bundle 会在 **Host 进程执行插件代码**、需要 Full access 或批准。
   我们的一键启用**必然**触发一次**权限语义**（不是"下载个文件"那么轻）。
2. **官方没有"预置信任"的入口**：没有签名信任根、没有"企业源免确认"。我们**无法**绕开官方这套判断，只能把「谁签的、sha256 多少、来源是哪个企业」当**我们自己的**信任材料展示在确认前。
3. **改动要开新会话才能看到**：已存在会话钉住启动时的修订（§2.3）。所以「启用后立刻可用」只在**新会话**成立；这也正好是我们 UX 契约里的"零等待感"要诚实标注的地方。

---

## B. 配方的构成（逐项：引用 or 快照 · 引用不到怎么办）

**总口径（先行）**：**配方的主键是「组合」，不是「内容」。** 所以：

- **组合本身必须是快照**（挂哪些 row、每个 row 的 config）——它就是 `agent.cordis.yml` 的正文，天然是快照。
- **组合所依赖的外部资产**（技能包、插件包）**默认引用**（跟中心最新），**关键项可钉版本**（§D）。

| # | 构成项 | 建议 | 引用 vs 快照 | 引用不到时 |
|---|---|---|---|---|
| B.1 | **模型与参数**（温度等） | **不进配方包**。配方只声明"我需要 persona/instructions"，模型由 **Host 组合 + 企业「模型/访问策略」域**决定（`{{model}}` 解析）。若企业要绑定模型，写进**我们的 manifest 的 `modelPolicy` 字段**（引用企业侧模型集 id），由客户端在启用前**校验该用户有没有该模型的授权** | **引用**（引企业模型策略，不复制模型） | **fail-closed**：没有该模型授权 → 禁用「启用」并给可行动提示（去申请/联系管理员）。**绝不**静默降级成别的模型（那是安全面） |
| B.2 | **技能集合** | **引用中心已发布的技能包**（`skillId` + 版本约束），**不内嵌**。理由：① 内嵌会让同一份 SKILL.md 在中心与本机各存一份、必然漂移；② 技能有自己的安装管线与 watcher（`docs/plan/skill-install-sources.md:36-44`），配方再管一遍就是第二套 | **引用**（默认跟最新 PUBLISHED，可钉 `versionId`，见 §D） | **降级 + 显式告知**：缺失技能**不阻止**配方启用（配方还有别的能力），但员工端必须**一眼看到「缺 N 个技能」并可一键装**；不得静默 |
| B.3 | **插件集合** | **引用中心已发布的插件包**（npm specifier / 企业 managed plugin），不内嵌。与 B.2 同理，且插件重启成本更高 | **引用**（默认跟最新，可钉版本） | **fail-closed（关键项）/ 降级（可选性）**：配方 manifest 给每个插件标 `required: true|false`；`required` 缺失 → **不给启用**（半份配方跑起来比不跑更危险）；可选项缺失 → 提示可补 |
| B.4 | **规则文件**（CLAUDE.md / AGENTS.md 之类） | **快照**。它们是被 `@deepseek-ai/dsh-agent-instructions` 读的**逐字文本**，没有版本坐标可引；改一个字行为就变 | **快照**（进包，随 `agent.cordis.yml` 一起） | 不适用（在包里） |
| B.5 | **工具白名单 / 权限预设** | **快照**（就是"少挂与 `disabled`"）。**但要在我们的 manifest 里另给一份"可读的声明"**（工具清单 + 每项是否必需），供员工端"一眼可读"与治理审计读；**不试图覆盖官方沙箱/批准栈** | **快照**（组合即白名单） | 不适用。若本机沙箱档位比配方预期更宽/更窄 → **提示但不阻断**（沙箱是 Host 面，不是配方能改的） |
| B.6 | **起始提示词 / 欢迎语** | 人设进 `persona`（快照，在 `agent.cordis.yml` 里）；**「欢迎语」不进包**（它是产品 UI 文案，不是 composition），放我们 manifest 的展示字段 | 提示词 = **快照**；欢迎语 = **展示元数据** | 不适用 |
| B.7 | **允许的会话 / 工作区上下文** | **不进包**（composition 里 `<dshHome>` 与工作区是用户态）。manifest 可声明 `recommendedCwd`/`suggestedSessionMode` 之类的**建议**，由客户端展示为提示 | **建议，不绑定** | 不适用；**明确不做"锁定工作区"**（见 §K） |

**一句话概括 B 节**：
> **组合快照、资产引用、策略不装、能力不搬。** 配方包里唯一必须逐字携带的是 `preset/agent.cordis.yml`（+ 规则文件），
> 其余全是**坐标 + 约束**，由客户端在启用时对着本机与企业中心**现算**。

---

## C. 包格式与落点

### C.1 建议：**保持现有 `.dshpreset` ZIP 不变，只增一份我们的 manifest 扩展位**

**不要发明第二套包格式。** 今天服务端验包闸门、契约、控制台上传、员工端下载全绑在这个形状上（`PresetArtifactInspector.java:39-120`；
`contracts/paths/preset.yaml:21-57`），改格式等于把已交付的一期全部推倒。

**现状形状（必须逐字兼容）**：

```text
manifest.json                       # 根，必需
preset/
├── agent.cordis.yml                # 必需（.yaml 也接受）
├── preset.yml                      # optional
└── skills/ plugins/ …              # preset-owned assets（我们的方案里「不内嵌技能/插件」，故这一层通常只有规则文件）
```

出处：`docs/compose/spec/preset-square.md:46-51`；实现 `PresetArtifactInspector.java:53-68`（`manifest.json` 抓字节、`preset/agent.cordis.yml|yaml` 存在性检查）、`:94-97`（路径白名单：**只允许根或 `preset/` 下**）。

**建议的增量（进 `manifest.json`，全部可选，未知顶层键不影响验包）**：

| 字段 | 语义 | 为什么放 manifest 而不是别的文件 |
|---|---|---|
| `compatibility.dsh` | 期望的 DSH 语义版本区间（现有 `sourceDshVersion` 是**单值字符串**，语义偏"导出基线"） | 与既有字段并存、不破坏 `sourceDshVersion` 的现有含义 |
| `requires.skills[]` | `{ skillId, version?, required }` | B.2 的引用坐标 |
| `requires.plugins[]` | `{ package, version?, required }` | B.3 的引用坐标 |
| `modelPolicy` | 引企业模型/访问策略域的 id（B.1） | 让"模型授权"可校验 |
| `tools[]` | 可读的工具声明（B.5） | 员工端"一眼可读"与治理审计 |
| `license` / `provenance` | 见 §F | 治理 |

> **诚实标注**：`manifest.json` 的"未知顶层键不报错"是**技能侧实测结论**（`docs/plan/skill-install-sources.md:572`：`validateManifest` 只按名取 5 个字段，未知键既不报错也不保存）。
> 配方侧 `PresetArtifactInspector.validateManifest`（`:101-120`）**只按名取 `format/version/id/name/sourceDshVersion/description`**，
> 从代码行为看同样是**只读已知键、不 reject 未知键**，但**本会话没有跑测试实证** → 列入 §M 不确定项，实现前必须先补一条验包单测。

**为什么不直接只用官方 `agent.cordis.yml` + 一份我们的 manifest？**
——这正是建议本身。官方的 composition 就是 `preset/agent.cordis.yml`（旧目录格式里同名，`editing-cordis-compositions`「Migrate a legacy preset」段），
**我们不改它一个字符**，只在 `manifest.json` 加我们的治理字段。这样：
① 一期的验包/契约/控制台零改动；② 将来官方加导入面时我们直接可用；③ 不会出现"两套 YAML 方言"。

### C.2 服务端存什么、客户端落什么、官方从哪里读

```text
【服务端（企业控制面）】已有，不改：
  ent_preset_package / ent_preset_version / ent_preset_assignment
  artifact 内容寻址落盘（sha256），DB 只存 artifact_ref + sha256 + size_bytes
  —— 服务端【绝不】解析 agent.cordis.yml 的语义（一期冻结决策，docs/compose/spec/preset-square.md:57）
  ★新增（§H）：ent_preset_version.dependencies jsonb —— 从 manifest 抄下来的引用坐标（B.2/B.3/B.5），
    供「引用是否还有效」「哪些配方被 X 引用」这类查询，不需要服务端懂 Cordis 方言

【客户端（员工本机）】★这是本方案要新建的一段：
  <dshHome>/enterprise/preset-artifacts/<sha256>.dshpreset     # 复用技能侧的「内容寻址下载内核」
  <dshHome>/enterprise/preset-installs/installed.json          # 本机已启用记录（原子写，照技能侧 installed.json 形状）
  <dshHome>/enterprise/preset-staging/<...>/                   # 解压暂存（解压后绝不就地覆盖）
  <dshHome>/<某目录>/<presetId>-ent/                            # ★真正交给官方的东西：一个最小 bundle 目录
      package.json   { name: "@enterprise/<presetId>-ent", dsh: { bundle: { patch: "./cordis.patch.yml" } } }
      cordis.patch.yml   - insert: [ { id: preset-<presetId>-ent, name: '@deepseek-ai/dsh-agent-preset', config: <逐字抄 agent.cordis.yml 的 plugins/id/name/description/order> } ]

【官方从哪里读】
  官方 registry 只认「bundle patch 装进 profile」（dsh-agent-preset-registry/README.md:48）。
  所以客户端做完上面一步后，【必须走官方唯一安装面】把该目录装进 profile ——
  与 editing-cordis-compositions/SKILL.md「Create a preset」段描述的动作等价（那里是让模型调 plugin_manager install_bundle）。
```

**本条最重要的三个取舍（写清楚，避免实现时走偏）：**

1. **不做"把 preset 文件塞进 `.agent-presets` 目录"**。虽然 `dsh-agent-presets`（另一套包）确实扫这个目录，
   **当前 profile 没挂它**，而官方 skill 明确说 `Nothing reads that directory any more.`（`editing-cordis-compositions/SKILL.md`「Migrate a legacy preset」段首句）。
   靠它 = 靠一个没挂载的包 + 一个官方宣布退役的目录。
2. **`presetId` 必须带企业后缀**（一期已规定 `建议目标标识：{presetId}-ent`，`preset-market.tsx:50`）。
   理由：与出厂 `standard`/`minimal`/`ptc`/`cordis` 同 id 会撞（`Duplicate preset IDs fail declaration loading`，`dsh-agent-preset/README.md:84`），
   且**覆盖出厂 preset 的 `config` 是整体替换**（`cordis-composition-reference/SKILL.md`），风险极高。
3. **bundle 目录名与包名要稳定且可逆**：`@enterprise/<presetId>-ent`。停用 = 卸载该 bundle（`plugin_manager` 的 remove_bundle 等价动作）+ 删本机记录；
   **官方声明被移除会退役上一修订**（`dsh-agent-preset-registry/README.md`「Understand the implementation」），已开会话不受影响 —— 这给了我们干净的回退语义（§E）。

---

## D. ★版本耦合：引用 vs 快照（本文最关键的取舍）

### D.1 问题拆开成三层

| 层 | 变了会怎样 | 现在的机制 |
|---|---|---|
| **L1 composition 本体**（挂哪些 row、config 怎么写） | 行为直接变 | 在包里 = **快照**，天然钉住 |
| **L2 被引用的技能/插件**（B.2/B.3） | 行为可能变（升级/修 bug/回归） | **未定义** —— 今天配方根本不记录引用 |
| **L3 平台侧策略**（企业模型授权、可见范围） | 能不能用变 | 服务端逐请求现算（已实现） |

**D 节只谈 L2**，因为 L1 已经是快照、L3 已经是现算。

### D.2 三种口径与推荐

| 口径 | 好处 | 坏处 | 我们怎么用 |
|---|---|---|---|
| **引用式（跟最新）** | 自动拿到修复；中心只有一份真相 | 「今天能跑的配方明天行为变了」；升级破坏组合的静默性 | **默认**，用于**非关键**引用（可选技能、可选插件、工具型技能） |
| **快照式（钉版本）** | 稳定可复现；可做灰度与回归 | 要人工升级；安全修复到不了；中心要长期保留老版本产物 | **用于关键项**（`required: true` 的插件、决定安全面的技能） |
| **混合式（推荐）** | 关键钉、非关键跟；语义可解释 | 需要一套"哪些算关键"的判定 | **★推荐** |

**推荐口径（一句话）**：
> **`required: true` 的一切引用默认钉死到 `versionId`；`required: false` 的默认跟最新 PUBLISHED，但配方可显式钉。**
> 「钉死」是**配方作者在上传时的选择**，不是系统猜的；界面必须显示「这份配方钉了 3 个版本 / 跟最新 2 个」。

### D.3 理由（为什么不是"全钉"或"全跟"）

1. **全钉 = 安全修复到不了**。企业配方的价值之一是"管理员审过的组合"，但把有漏洞的技能永久钉在配方里，等于用配方绕过了中心的退休机制。
2. **全跟 = 组合不可复现**。配方存在的意义就是"这一套跑得通"；引用一升级就静默变形，等于配方没有承诺。
3. **关键/非关键的区分是真实存在的**：一个提供文件读写工具的插件挂了会伤及整个 Agent；一个"查报销标准"的技能挂了只是少一个能力。
   把这两者用同一个策略处理，必然在两端都错。
4. **这与仓库已有的两处口径一致**：技能侧的多渠道安装明确"落盘目录 = 信任域"、不混排（`docs/plan/skill-install-sources.md:642`、`:682`）；
   插件侧的"退休只停止新安装，不远程撤回"（`docs/compose/spec/preset-square.md:200`）。

### D.4 怎么落进数据模型

**只加一列，不新开表**（在 `ent_preset_version` 上加）：

| 列 | 类型 | 语义 |
|---|---|---|
| `dependencies` | `jsonb not null default '[]'::jsonb` | 从 `manifest.json` 抄下来的引用数组，照技能侧 `ent_skill_version.skills jsonb` 的先例（`V35__enterprise_skill_catalog.sql:37` 是 `skills jsonb not null default '[]'::jsonb`，同文件 `:49` 建 GIN 索引，`jsonb_path_ops`） |

单条引用的建议形状（**建议，不是既有字段**）：

```jsonc
{
  "kind": "skill" | "plugin",
  "id": "<skillId | npm specifier>",
  "mode": "pinned" | "latest",
  "versionId": "…",        // mode=pinned 时必需
  "required": true,
  "resolvedVersionId": "…" // 可选：服务端在发布时算一次的"当时最新"，只做展示与变更提示，不做运行时真源
}
```

**为什么用 `jsonb` 而不是引用表**：引用只被两类查询用（"这份配方引用什么"、"谁引用了 X"），
且**绝对不能在服务端做语义解析**（一期冻结决策，`docs/compose/spec/preset-square.md:57`）。
`jsonb` + GIN（`jsonb_path_ops`）足够，且**上传时写入、之后不可改**（版本一旦上传，依赖也冻结）——
这与"上传即 `VALIDATED`、发布才可见"的状态机天然一致。

**明确不做**：不在 `ent_preset_version` 上做**跨包外键**（技能/插件在别的表、甚至可能是"跟最新"）。引用是**软约束**，由发布时的校验与运行时的解析负责。

### D.5 被引用的技能/插件【退休/下架】时，配方怎么办

**这是 D 节必须回答的第二问。三种可选策略：**

| 策略 | 做法 | 代价 |
|---|---|---|
| ① **阻止退休** | 退休一个被 `required` 引用的版本 → 409 | 简单粗暴，但**引入跨域耦合**（插件退休被配方卡住）；且"跟最新"的引用根本拦不住 |
| ② **失效提示（推荐）** | 允许退休；服务端新增「受影响配方」查询（`dependencies` 上的 containment 查询）；员工端与管理员**双端显式提示** | 需要一条查询与两处 UI；但语义最诚实 |
| ③ 静默 | 什么都不做 | **不可接受**：员工会看到"配方启用了但少了一半能力" |

**推荐：②为主，①为辅（只管 `required: true` 的最窄情形），且按状态分档：**

| 谁 | 什么时候 | 看到什么 |
|---|---|---|
| **管理员（控制台）** | 退休前 | 「此版本被 N 份配方引用（其中 M 份为 required）」，列出配方名，**不阻止**（按钮仍是退休，但给一句后果） |
| **管理员** | 退休后 | 配方详情页出现「引用已失效」标；可一键「改钉到最新」或「随它去」（产生新版本、走发布） |
| **员工（列表/详情）** | 打开配方时 | `required` 引用缺失 → **禁用启用**并说缺哪个（fail-closed）；可选引用缺失 → **允许启用但显式列出缺项**（降级 + 告知） |
| **员工（已启用）** | 本机已启用、中心把它退休了 | **不远程撤回**（沿用一期口径"退休只停新下载"，`docs/compose/spec/preset-square.md:200`）；只在下次进入时提示「中心已退休，本机仍可用，建议改订」 |

**一个必须承认的事实**：因为官方 preset 是**急切激活一次并共享**（`editing-cordis-compositions/SKILL.md`），
**已开着的会话钉住启动时的修订**，所以「退休」对**正在跑的会话零影响**——这不是缺陷，是正确的稳定性语义，但必须写进产品文案避免误解。

---

## E. 分发与权限（复用现有机制）

### E.1 版本坐标：**我们已经踩过 `(package_id, source_dsh_version)` 的坑，配方必须写清怎么生成**

**现状（配方）**：`ent_preset_version` 有 `uq (package_id, source_dsh_version)`（`V30…sql:42`），
值来自 manifest 的 `sourceDshVersion`（`PresetArtifactInspector.java:117`）。

**坑是什么**：这个字段**语义偏"目标 DSH 版本"**（一期口径：manifest 里写 Desktop 基线版本），
而技能侧在真实导入场景里**被用成了"上游坐标"**（`docs/plan/skill-install-sources.md:330`：原型实际写 `skillhub.cn/<slug>@<version>`，如 `skillhub.cn/dev-expert@2.0.3`）。
一边是"基线版本"，一边是"来源坐标"，**同一个列名两种语义** → 唯一的自然键会把两种不同含义的上传判成冲突或不同行。

**配方的建议（明确、可执行）**：

| 语义 | 建议 |
|---|---|
| `sourceDshVersion` 保持"**目标 DSH 基线**" | 与一期冻结决策一致（`docs/compose/spec/preset-square.md:53`），**不改语义** |
| "来源坐标"另开字段 | `manifest.json` 加 `provenance.source`（如 `dshdesktop.com/preset/<slug>` 或企业内部路径），**落 `ent_preset_version` 的新列或进 `dependencies` 同级的一个 `provenance jsonb`**（§F） |
| 自然键继续用 `(package_id, source_dsh_version)` | **但发布前必须校验：同一 `package_id` 下 `sourceDshVersion` 单调/不可复用**，否则"修个 bug 重新导出同一基线"会被幂等当成老版本（`PresetCatalogService.java:110-113` 的 `findExistingVersion` 会直接返回既有行，`created=false`） |
| 员工端展示 | 列表用**短号**（照技能已做的"只显示最后一个 `@` 之后那段"，`marketplace-entry.tsx` 文件头 `[OUTPUT]`「本刀（版本签只显示版本）」条），完整坐标放 `title` 与详情徽标 |

> **一句话**：**配方的版本坐标 = `presetId`（包的逻辑标识）+ `sourceDshVersion`（目标 DSH 基线）；来源坐标是另一件事，不许混进自然键。**

### E.2 发布 / 退休 / 分配

| 动作 | 现状 | 建议 |
|---|---|---|
| 上传 | ✅ 幂等（同 presetId+sourceDshVersion 或同 sha256 → 既有行） | 保持；**上传时多一步：解析 `manifest.json` 的引用字段写入 `dependencies`** |
| 发布 | ✅ `VALIDATED → PUBLISHED`，`If-Match` CAS | 保持；**发布时多一步：校验 `required` 引用的技能/插件在中心**存在且已 PUBLISHED**，不存在 → 400 且**不允许发布**（fail-closed 落在发布口，不是启用口） |
| 退休 | ✅ `PUBLISHED → RETIRED` | 保持；按 §D.5 加"受影响配方"提示 |
| **分配** | ✅ `subject_type ∈ {ALL, USER}`（`V30…sql:58`），`ALL` 至多一条（partial unique index `:71-73`） | 见下 |

### E.3 **若把 `subject_type` 扩 `DEPT`，代价要写清**

**现状代价盘点**（全部是必须同步改的点）：

| 层 | 具体位置 | 改动性质 |
|---|---|---|
| DDL 约束 | `V30…sql:58`（`ck_ent_preset_assignment_subject_type check (subject_type in ('ALL','USER'))`）、`:59-62`（`ALL` 必空 / `USER` 必非空的复合约束） | 加值 + 改复合约束 |
| 索引 | `:67-73` 两条 partial unique index（按 `subject_type` 分叉） | 需要第三条 DEPT 分支，或改成统一表达式索引 |
| 契约枚举 | `contracts/components/preset.yaml:21-23`（`PresetSubjectType: enum [ALL, USER]`） | 加 `DEPT`；**会牵动 `contracts generate` 与前端类型** |
| 领域/持久化 | `PresetAssignment.java`（enum `SubjectType`）、`JdbcPresetStore.java:183-190`（`subjectExists` 只查 ALL/USER）、`:192-262`（三处可见性 SQL 的 `(a.subject_type='ALL'… or 'USER'…)` 分叉） | 三处 SQL 都要加 DEPT 分支 |
| 服务校验 | `PresetCatalogService.java:187-200`（`hasAll` / `users` 去重 / `subjectExists`） | 加 DEPT 去重与存在性 |
| 控制台 | `preset-editors.tsx:109-207`（范围对话框）、`preset-management-page.tsx:271-278`（成员名解析 `subjectType === 'ALL' ? '所有成员' : memberNames.get(...)`） | 加部门选择与部门名解析 |

**更重要的两条现实约束：**

1. **产品已移除部门资源**：一期明确「无 DEPT 可见范围（**产品已移除部门资源**）」（`docs/compose/spec/preset-square.md:63`），
   且 `V18__product_access_scopes.sql` 把模型/配额侧的 `DEPT` **删掉并迁成 `ALL_MEMBERS`/`MEMBER`**（`:6`、`:42-43`、`:46-48`）。
   ——**在配方上把 DEPT 加回来，等于逆着一次已经做过的产品收敛走。**
2. **二期规划里 DEPT 是 P2 且待拍板**：`docs/plan/enterprise-marketplace-phase2.md:370`（P2-3「`subject_type` 增 `GROUP`/`DEPT`」，3–5 人日，前置 **开放问题 Q2 拍板**）。
   **它不是"尚不存在的能力"，而是"已决定不做、待用户改主意"的能力。**

**建议**：**本期不扩 DEPT**；用 `USER` 的批量分配满足"某部门 n 个人"的当前需求（与技能侧现状一致），把 DEPT 留给二期统一拍板。

### E.4 `PENDING_REVIEW` 是否要接？

**现状**：配方与技能**都没有**这一档（`VALIDATED → PUBLISHED → RETIRED`，`V30…sql:40`）。
**既有口径**：`docs/plan/borrow-from-skillhub.md:33-35`（§2「设计上值得抄的」第 1 条，标注该文自定的 P0 借鉴项），
`docs/plan/skill-ingest-center.md:295-307`、`:370-373` 把它判为 **P1**（对导入线 P0 用 `VALIDATED` 草稿即可达成同等防护），
并注明**依赖"尚不存在的能力"**（`SkillVersion.Status` 只有三态、DDL 约束、契约枚举、publish 的 `from` 参数、前端筛选第四档，`:708`）。

**建议**：
- **本期（P0/P1）不接**，沿用 `VALIDATED` 当"草稿"，发布就是唯一的人审关口（与技能侧同一口径）。
- **P2 与技能侧"第二人复核"一起做**：理由是**同一条审批语义只该有一套实现**；
  配方单独先做（三张表 + 契约 + 控制台筛选 + from 参数）会造出第二套状态机，而收益是"待审可查询"。
- **接口上留位**：`dependencies` 与审计事件命名（§F）按"将来会有第四态"写，避免 P2 时改契约。

### E.5 员工端：配方列表怎么呈现、"启用"意味着什么、启用后如何回退

| 问题 | 建议 |
|---|---|
| **列表怎么呈现** | 见 §G（卡片契约）。一句话：**两行卡片 + 三枚签**（版本短号 / 引用计数 / 状态），键操作只有一个「启用/停用」 |
| **"启用"意味着什么** | **诚实三分**：① 本机解压并落一份 bundle 目录（幂等、内容寻址）；② 走官方唯一安装面把该 bundle **装进 profile**（这一步执行代码，需要权限/批准）；③ 官方 registry 激活该声明 → **pickers 里出现** + 我们把它设为该用户的默认（若要）。**不自动开会话**，UI 明确说"新会话生效" |
| **启用后如何回退** | **三档，逐档更彻底**：① `Switch` 关掉 = 卸载 bundle（官方会退役该声明的修订）+ 保留本机 `.dshpreset` 缓存（下次启用零下载）；② 详情页「删除本机副本」= 清 `<dshHome>/enterprise/preset-*` 记录与暂存；③ 中心侧退休/取消分配 = 不再出现在列表（**不远程撤回本机已装**，沿用一期口径） |
| **失败重试** | 失败**不禁用**开关（再拨一次就是重试），失败给 `role="alert"` + 稳定错误码 —— 与技能/插件行同一动作纪律（`marketplace-entry.tsx` 文件头 `[POS]`「失败给 `role="alert"` + 稳定错误码且**不禁用**开关（再拨一次就是重试）」） |

---

## F. 治理与信任

### F.1 谁能建

| 角色 | 能做什么 | 理由 |
|---|---|---|
| `enterprise_admin` / `plugin_admin` | 上传 / 发布 / 退休 / 分配（**现状即如此**，`V30…sql:86-90`） | 与插件市场同一治理心智；可执行配置必须过审（`docs/compose/spec/preset-square.md:36`） |
| **从技能/插件组合出配方** | **建议不做成员工自助**，而是**管理员侧一个"从现有资产起草配方"的表单**：选技能 + 选插件 + 填人设 → **服务端生成一份 `agent.cordis.yml` 草稿** → 仍走 `VALIDATED` 人工审核 | 让创建变简单，但**不绕过审核**；"员工投稿"是一期已明确 Out of Scope（`docs/compose/spec/preset-square.md:206`） |
| 员工 | **只读 + 启用/停用** | 员工无控制台角色 |

### F.2 provenance

**现状**：配方有 `created_by` + `created_at`（`V30…sql:31-32`）+ 五条审计事件（`:106-107`），
**但没有"来源坐标"**（这是 §E.1 那个坑的另一面）。

**建议**（与技能侧同构，`docs/plan/skill-install-sources.md:773` 已给出技能侧的坐标字段设计）：

| 字段 | 位置 | 说明 |
|---|---|---|
| `provenance.source` | manifest（建议） | 原始地址/来源标识（`dshdesktop.com/preset/<slug>`、企业内路径、空 = 本企业自建） |
| `created_by` / `created_at` | DB（已有） | 谁在什么时候上传的 |
| `sha256` / `size_bytes` | DB（已有） | 完整性（每次下载逐字校验） |
| 审计五事件 | DB（已有） | 上传/发布/退休/范围替换/授权下载 |

> **明确诚实**：我们**不签名**（一期 Out of Scope，`docs/compose/spec/preset-square.md:207`「`.dshpreset` Ed25519 签名与信任根」）。
> 所以"信任"只能靠 **① 管理员独占发布 ② 可见范围 ③ sha256 完整性 ④ 审计**，**不能**声称"已验证来源"。

### F.3 许可（配方本身 + 它引用的东西）

| 对象 | 现状 | 建议 |
|---|---|---|
| 配方包 | 无许可字段 | manifest 建议加可选 `license`（SPDX 表达式）；**不强制**（企业内部分发通常无此需求） |
| 被引用的技能 | 技能侧已有 `license` 的讨论（`docs/plan/skill-install-sources.md:572` 提到 `license` 字段） | **配方不重复声明**，只在详情页**聚合展示**引用项的许可（缺就说"未声明"） |
| 被引用的插件 | 插件包自带 package.json license | 同上，聚合展示 |

**明确不做**：不做许可**自动兼容性判断**（那是法务工具，不是商城）。

### F.4 内容安全缺口的默认档位（我们不做扫描）

**必须先说清现状**：`docs/plan/borrow-from-skillhub.md:30`（「**为什么不直连它做服务端源**：耦合未冻结的第三方 API，且我们**没有内容安全扫描**」）与 `:61`（🔴「不要做『订阅 + 自动发布』——我们自己**没有内容安全扫描**，等于把供应链风险…」）
——**配方是比技能更高危的对象**：技能是文本，配方是**可执行配置**（`docs/compose/spec/preset-square.md:24`「自定义 Preset 是**可执行配置**…需要管理员独占发布与可见范围裁决」）。

**默认档位（建议，逐条可执行）**：

| 档位 | 内容 |
|---|---|
| **① 结构闸门（已有）** | 只允许根/`preset/` 路径、拒 `..`/绝对路径/反斜杠/符号链接类 entry、体积与 entry 上限（`PresetArtifactInspector.java:82-99`） |
| **② 语义闸门（建议加，低成本）** | 上传时对 `agent.cordis.yml` 做**只读文本检查**（**不是解析方言**，而是保守的字符串/行级规则）：数一数挂了几个 `tool-*` row、有没有 `disabled: !!js`、有没有 `isolate` 服务行；把结果写进审计 metadata 与详情页的「工具面」签 |
| **③ 人工审（唯一真正的关口）** | 上传者 = `plugin_admin`/`enterprise_admin`；发布是显式动作；控制台详情页必须显示那枚橙色可执行配置提示（员工端已有同款文案 `preset-market.tsx:154`，控制台侧应对齐） |
| **④ 不做的** | **不做**包内 YAML/skill 正文的扫描或静态分析；**不做**沙箱/权限的策略注入；**不做**签名与信任根（一期 Out of Scope） |
| **⑤ 默认档位的措辞** | 对用户的默认承诺只能是「**企业管理员审过的配方 + 每次下载校验 sha256 + 装的时候你会被官方要求确认**」，**不能**说"安全扫描通过" |

### F.5 审计事件命名

**现状（已实现，不改）**：`PRESET_VERSION_UPLOADED` / `_PUBLISHED` / `_RETIRED` / `PRESET_ASSIGNMENTS_REPLACED` / `PRESET_DOWNLOAD_AUTHORIZED`
（`V30…sql:106-107`、`AuditAction.java:35-39`）。

**建议新增（命名沿既有 `PRESET_*` 前缀，与 `PLUGIN_*`/`SKILL_*` 族平行）**：

| action | 何时 | metadata（建议） |
|---|---|---|
| `PRESET_ENABLED` | 员工在客户端走完官方安装面、声明激活成功 | `presetId, versionId, deviceId, memberId, bundleId, presetRevision` |
| `PRESET_DISABLED` | 员工停用（卸载 bundle） | 同上 + `reason`（user/preflight-failed/conflict） |
| `PRESET_REFERENCE_UNRESOLVED` | 客户端启用前预检发现 `required` 引用在本机/中心缺失 | `presetId, versionId, kind, refId, required, deviceId` |
| `PRESET_DEPENDENCY_RETIRED` | 管理员退休一个被配方引用的技能/插件版本 | `refKind, refId, versionId, affectedPackageIds[]`（**注意：这是跨域的**，若不想在插件/技能动作里写配方语义，可改为一条独立的"影响面查询"事件，见 §M） |

> **命名纪律**：`AuditAction` 是**封闭枚举**（`AuditAction.java:35-39` 是枚举体），加值要**同时**改 `ent_audit_event` 的 action 白名单约束
> （照 `V30…sql:94-108` 的 `drop constraint` + `add constraint` 模式）——**漏一处就会在写入时炸**（技能侧已踩过：`docs/plan/skill-ingest-center.md:495-497` 实测「DDL 放行、Java 层写不出去」）。

---

## G. 员工端体验（★"优秀的客户体验"契约）

> 下面 12 条是**验收契约**（用户在本会话刚提过"我要达到优秀的客户体验"）。每条给"配方语境下的落地动作"，
> 可以逐条对着现有 `preset-market.tsx` 与官方 picker 勾。

| # | 契约 | 配方语境的落地动作 |
|---|---|---|
| G1 | **零等待感** | 列表**一次请求**（现有 `api.presets()` 已经是"一次请求不缓存 Token"，`platform-service.ts:638`）；详情按需取；**启用前**把体积/引用数**已在列表上**给出，不点进去才发现"要下 30 MB" |
| G2 | **零死按钮** | `reserved` 的假开关**不能出现在正式界面**（今天配方行的开关恒禁用，`:640-646`）；转正后**每个按钮都必须有真实动作**；未登录时**不给开关**，只给"登录后可启用" |
| G3 | **错误可行动** | 复用 `preset-market.tsx:129-130` 的 `role="alert"` + 稳定错误码；**新增三类要人话 + 下一步**：`ENT_PRESET_REQUIRES_MISSING`（缺必需依赖 → 给"去装 X"）、`ENT_PRESET_MODEL_UNAUTHORIZED`（→"去申请模型权限"）、`ENT_PRESET_INSTALL_DENIED`（→"需要完全访问权限，去设置"） |
| G4 | **一次点击即达** | 「启用」是**唯一主按钮**，点击后由客户端串完"下载 → 校验 → 解包 → 装 bundle → 激活"五步，**不要求用户理解这五步**；只有 G3 的失败才让人介入 |
| G5 | **一眼可读** | 见下"列表卡片"与"详情页"两段 |
| G6 | **大内容不卡** | 列表**不拉正文**（现在就不拉：`decodeEnterprisePresets` 明确"不投影 SHA、artifact 路径或包内 YAML"，`local-api-decode.ts:713`）；`agent.cordis.yml` 的只读 YAML 预览若要有，**只在详情页按需取**并 `<pre>` + `max-height` 滚动（照技能详情页文件预览的既有做法） |
| G7 | **可撤回可重试** | `Switch` 关 = 卸载；失败不禁用开关（§E.5）；卸载后**保留本机缓存**所以再启用是快的（幂等：同 sha256 命中缓存零网络，`docs/plan/skill-install-sources.md:37`） |
| G8 | **信任可见（企业分发 vs 本机自装）** | ★**这一条最容易做错**。必须**视觉分区 + 文案分区**：企业分发的配方带「企业」签与橙色可执行提示；本机自装的配方**不许混进同一列表**（照技能侧"同一落盘目录 = 同一信任域"的结论，`docs/plan/skill-install-sources.md:642`、`:682`——混排是**信任误导**）。若官方 picker 会把两类都列出来，**我们必须在那之前用文案把差异说清**，因为 picker 界面不是我们的 |
| G9 | **一处一致** | 同一份 `facts` 投影同时喂列表行与详情页动作（照技能行"同一枚子块、同一份 facts、同一个回调"的既有形状，`marketplace-entry.tsx` 文件头 `[OUTPUT]` 第 1 段）；**不造第二套状态或第二个动作实现** |
| G10 | **可达** | 列表行本体可真点（按钮），键操作有 `aria-label`；对话框有 `closeLabel`（现有 `:150` 已有）；状态用文字而非只靠颜色 |
| G11 | **不打断** | 启用过程**不弹阻塞模态**（进度放行内）；失败时**不抢焦点**；不自动跳转到别的页签 |
| G12 | **可验证** | 每条状态都有**可测的纯函数投影**（照仓库既有风格：`enterpriseMarket*` 系列全是纯函数、可直接函数调用测试），使 UI 文案与状态机可被单测锁死 |

### G.1 列表卡片长什么样（建议：**两行 + 三枚签 + 一个开关**）

```text
┌──────────────────────────────────────────────────────────────┐
│ [BookMarked]  报销专员                          [企业] [v1.2] │  ← 行1：图标 + 标题 + 企业签 + 版本短号
│               差旅与费用报销的标准流程与票据要求               │  ← 行2：描述（单行截断）
│               3 技能 · 1 插件 · DSH 0.2.0 · 42.1 KiB   [Switch]│  ← 行3（meta）：引用计数 + 基线 + 体积 + 开关
└──────────────────────────────────────────────────────────────┘
```

**每枚签的存在理由（缺一不可）**：

| 签 | 值 | 理由 |
|---|---|---|
| 「企业」 | 常量 | G8 信任可见；**本机自装的不在这个列表里** |
| 版本短号 | `sourceDshVersion` 的短形（最后一个 `@` 之后，照技能行做法） | 整串会把标题挤成一行字（技能侧真机截图已证） |
| 引用计数 | `3 技能 · 1 插件` | G5。"这份配方包含哪些技能/插件"的**第一眼**答案 |
| （引用缺失时） | 红色 `缺 1 必需` | G3 可行动；**只有缺必需项才红** |
| 状态点/文字 | 已启用 / 未启用 / 需登录 | 沿用官方 `StateDot` 语义（`:635-637`）；**不再出现"预留"** |

**明确不做**：不显示下载量、不显示星级、不显示价格（商业化字样全树禁止，照 `marketplace-entry.tsx` 文件头 `[POS]`「**严禁**任何价格/交易/购买/购物车/客服之类的商业化字样」）。

### G.2 详情页放什么

按**信息优先级**（从上到下）：

1. **一句它是什么**（`displayName` + `description`）
2. **橙色可执行配置提示**（沿用 `preset-market.tsx:154` 的文案，**这是我们的信任底线**）
3. **「这份配方包含」分区**：三组列表 —— **技能**（名 + 版本 + 已装/未装）、**插件**（名 + 版本 + 已装/未装）、**工具**（从 manifest `tools[]` 或组合作保守统计）
4. **规则文件**：列出 `preset/` 下的规则文件（只读、可展开预览）
5. **回退与缓存**：本机已装版本、`.dshpreset` 缓存大小、「删除本机副本」按钮
6. **许可与来源**：`license` + `provenance.source` + sha256 前 12 位（**不显示完整 sha256**，界面不友好）
7. **动作**：唯一主按钮「启用/停用」

**"这份配方包含哪些技能/插件怎么一眼看清"** —— 三重冗余（不同场景各有其一）：
① 列表行的 `3 技能 · 1 插件`；② 详情页分区列表（带已装/未装）；③ 缺项时行内红色签 + 可行动按钮。

---

## H. 服务端与前端改动清单（文件级）

> **迁移号**：现最新是 `V37__enterprise_skill_category.sql`（`ls .../db/migration/ | sort -V | tail -3` 实测）。
> **`V38` 已被 `docs/plan/skill-ingest-center.md:489` 预定**（`V38__enterprise_skill_import.sql`）——**用户提醒的正是这件事，核对结果：确已被占用**。
> **建议本方案取 `V39__enterprise_preset_dependencies.sql`**；若 skill-ingest-center 先落 `V38`，则本方案的号顺延到 `V39`；
> **两个方案的实施者必须先对齐一次号**（同一分支并行改 Flyway 是硬冲突）。

### H.1 服务端（`/data/user/0/com.deepcode.shell/files/dsh-enterprise/server/owndsh-modules/owndsh-enterprise/`）

| # | 文件 | 改动 |
|---|---|---|
| S1 | `src/main/resources/db/migration/V39__enterprise_preset_dependencies.sql`（**新建**） | `ent_preset_version` 加 `dependencies jsonb not null default '[]'::jsonb` + `provenance jsonb`（可选）；GIN (`jsonb_path_ops`)；`ent_audit_event` action 白名单加 §F.5 的新值（`drop constraint` + `add constraint`，照 `V30…sql:94-108` 模式） |
| S2 | `.../preset/artifact/PresetArtifactInspector.java` | `validateManifest` 增读可选键 → 扩 `InspectedPreset` record（现 4 字段，`:148-154`）；**只读已知键、不 reject 未知键**的行为要先被一条单测锁住（§M 不确定项）；`preset/` 路径下**新增允许**规则文件（现状只白名单路径、不限制文件名，`:94-97`，需确认） |
| S3 | `.../preset/domain/PresetVersion.java` | 加 `dependencies` / `provenance` 字段（record） |
| S4 | `.../preset/persistence/PresetStore.java` + `JdbcPresetStore.java` | 插入/查询带上新列（`insertVersion` 在 `:176` 一带；`findVisiblePublished`/`findVisiblePublishedById` 在 `:192-243`）；**新增一条 containment 查询**：`findVersionsReferencing(kind, refId, versionId)` 供 §D.5 的"受影响配方" |
| S5 | `.../preset/application/PresetCatalogService.java` | 上传时写入 `dependencies`（`upload()` `:88-163`）；**发布前新增引用校验**（`publish()` `:165-170` 之前）：`required` 引用不存在/未 PUBLISHED → 拒绝（新错误码，§H.3） |
| S6 | `.../preset/web/PresetViews.java` | 管理详情投影加 `dependencies`/`provenance`；**运行时列表投影是否加"引用计数"**要定（现在 `runtime()` `:37-42` 刻意很瘦；建议加 `requiresSummary: {skills:N, plugins:M, missingRequired:K}`，**不加正文**） |
| S7 | `.../preset/web/AdminPresetController.java` | 若"受影响配方"要有独立端点，加一条 GET（或复用列表 + 查询参数）；其余不动 |
| S8 | `.../preset/application/PresetAuditMetadata.java` | 加 §F.5 的新 metadata record（现 5 个：`Upload/Publish/Retire/Assignments/Download`） |
| S9 | `.../audit/AuditAction.java` | 加 §F.5 新枚举值（现 `:35-39`） |
| S10 | **（建议，独立小项）** 发布口/管理详情：`GET /enterprise/admin/v1/presets/{id}` 单包详情（现只有列表 `:57-80`）——**控制台要做详情页就需要它**；否则只能靠列表页全量拿（现状就是列表里带 versions+assignments，`PresetViews.packageView` `:20-32`） |

### H.2 契约（`.../contracts/`）

| # | 文件 | 改动 |
|---|---|---|
| C1 | `contracts/components/preset.yaml` | `PresetVersion` 加 `dependencies`（数组，`maxItems` 上限建议 200，与 assignment 同量级）；新增 `PresetDependency` schema；`RuntimePresetSummary` 加 `requiresSummary`（**保持"不加正文"的投影纪律**，`:3` 的 `[POS]` 已明确"不投影 artifact 路径、包内 YAML 或签名私钥"） |
| C2 | `contracts/paths/preset.yaml` | 若加"受影响配方"/单包详情端点则加 Path Item；`PresetVersionUpload` 的 multipart 形状**不变** |
| C3 | `contracts/enterprise-openapi.yaml` | 错误码封闭枚举加 §H.3 的新值（现 `ENT_PRESET_INVALID_PACKAGE/_NOT_PUBLISHED/_VISIBILITY_DENIED/_TOO_LARGE` 在 `:239`、`:255-256`、`:278`）；**`EnterpriseErrorCode` 与 `x-enterprise-error-statuses` 必须同步扩**，否则 `contracts generate` 失败（技能侧已踩过：`docs/compose/spec/preset-square.md:17`） |
| C4 | `contracts/fixtures/preset-*.json` | 现有 3 个 fixture（`preset-package-list-success` / `preset-version-success` / `runtime-preset-detail-success`）按新投影更新 |
| C5 | 生成物 | `contracts/generated/**` 与 `plugin/packages/contracts/src/generated/**` 由生成器产出（**不手改**） |

### H.3 错误码（新增 / 复用）

| 码 | HTTP | 场景 | 新/复用 |
|---|---|---|---|
| `ENT_PRESET_INVALID_PACKAGE` | 400 | manifest/结构不合法（含**新增**：引用字段类型非法） | 复用 |
| `ENT_PRESET_TOO_LARGE` | 413 | 超包体/entry 上限 | 复用 |
| `ENT_PRESET_NOT_PUBLISHED` | 403/409 | 未发布/已退休仍请求下载或发布态非法 | 复用 |
| `ENT_PRESET_VISIBILITY_DENIED` | 403 | 列表/下载裁决不可见 | 复用 |
| **`ENT_PRESET_REQUIRES_MISSING`** | 409/422 | **新增**：发布前或启用前，`required` 引用的技能/插件不存在或未 PUBLISHED | 新 |
| **`ENT_PRESET_MODEL_UNAUTHORIZED`** | 403 | **新增**：`modelPolicy` 指向的模型/策略对该用户无授权（B.1 fail-closed） | 新 |
| **`ENT_PRESET_INSTALL_DENIED`** | 403 | **新增**：客户端走官方安装面被拒（权限/批准缺失） | 新 |
| **`ENT_PRESET_CONFLICT_EXISTING`** | 409 | **新增**：本机同 `presetId` 已被**非本配方**占用（照技能侧 `ENT_SKILL_NAME_CONFLICT` 的"绝不就地半覆盖"口径，`docs/plan/skill-install-sources.md:42`） | 新 |

### H.4 审计事件

见 §F.5（五条既有 + 四条新增）。**落点**：`PresetCatalogService.audit()`（`:304-316`，管理侧）、`PresetRuntimeService.audit()`（`:101-108`，下载侧）、以及**新的客户端启用/停用要经由一条 Host 本地路由回传审计**（见 H.5）。

### H.5 员工端插件（`plugin/packages/ui/**`、`plugin/packages/platform-client/**`、`plugin/packages/bundle/**` —— **本会话只读，未改一字**）

| # | 文件 | 改动 |
|---|---|---|
| P1 | `plugin/packages/bundle/src/preset-install.ts`（**新建**） | 启用/停用的主干：**复用**技能侧那条"详情取权威 sha256/size → 下载 → 强制 size+SHA-256 → 解包 → 落点预检 → 暂存 → 原子改名 → 原子写状态文件"（`skill-install.ts:297-432`）与共用下载内核 `downloadVerifiedArtifact`（`plugin-distribution/src/verification.ts:184-247`）；**新增**：把 `preset/agent.cordis.yml` 包成一个最小 bundle 目录（§C.2）并走官方安装面 |
| P2 | `plugin/packages/bundle/src/preset-route.ts`（**新建**） | Host 本地路由：`POST {local}/presets/<id>/enable`、`POST .../disable`、`GET .../installed`（照技能侧 `bundle/src/skill-route.ts:15`、`:31` 的 exact/prefix 双注册纪律；**注册 path 不带尾斜杠**，否则会重演空体 404 —— 见 `platform-client/src/local-api.ts:30-47` 那段血泪注释） |
| P3 | `plugin/packages/platform-client/src/local-api.ts` | 透传新路由（现有 preset 两条在 `:717-763`）+ 把 §H.3 新错误码接进 `enterpriseLocalErrorCode` 投影 |
| P4 | `plugin/packages/ui/src/preset-market.tsx` | 列表卡片按 §G.1 重排（加三枚签 + `Switch`）；详情页加「这份配方包含」分区 + 三档回退；**主按钮从"复制导入指令"变成"启用"**（复制指令**保留为次要入口**，因为它在"官方安装面不可用"时是唯一退路） |
| P5 | `plugin/packages/ui/src/local-api-decode.ts` | `EnterpriseRuntimePreset`（`:121-131`）加 `requiresSummary` 等字段；`decodeEnterprisePresets`（`:714-740`）的**严格 exact-keys 白名单**必须同步扩，否则新字段一来就 `ENT_LOCAL_RESPONSE_INVALID` |
| P6 | `plugin/packages/ui/src/marketplace-entry.tsx` | 组件节的**配方行转正**：`ENTERPRISE_MARKET_COMPONENTS` 的 `presets.reserved: true → false`（`:38`）、`ENTERPRISE_MARKET_PLAN` 的 `note: '预留' → '已排期'`（`:48`）——`reserved` 的五处行为（`:621-646`）**零改动**即可自动正确。**若二期商店整页已落地**，再加配方页签（现在 `ENTERPRISE_MARKET_TABS` 只有三项，`:76-80`） |
| P7 | `plugin/packages/ui/src/account-view.tsx` | 「配方」tab（`:70`、`:278`、`:349-350`）已存在，**不改**；若迁到二期整页则按二期方案迁移 |

### H.6 控制台（`console/src/**` —— **本会话只读，未改一字**）

| # | 文件 | 改动 |
|---|---|---|
| A1 | `console/src/features/presets/preset-management-page.tsx` | 配方版本表加「引用」列（`3 技能 · 1 插件`，缺项红）；详情/抽屉显示 `dependencies` 与失效标；发布前若服务端回 `ENT_PRESET_REQUIRES_MISSING` 要给可行动提示（`requireSuccess` 在 `:230`、`:244`、`:259`） |
| A2 | `console/src/features/presets/preset-editors.tsx` | 上传对话框**保持"只收集语义、不解析 ZIP"**（`CLAUDE.md:9`）；可增"引用检查预览"但那要等上传返回 |
| A3 | `console/src/app/product-routes.ts` | **不改**（`/presets` 已在，`:22`） |

---

## I. 分期与人日

> 人日口径沿用仓库既有调研：**1 人日 = 1 名熟悉本仓库的工程师有效工作 6 小时，含实现 + 测试 + 文档**，不含排期等待与跨团队协调（`docs/plan/enterprise-marketplace-phase2.md:337` 引 `docs/research/iflytek-skillhub-integration.md:368`）。

### P0 — 最小可用：**"引用可见 + 员工能真启用"**（**9–15 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P0-1 | 迁移 `V39`（`dependencies`/`provenance` 列 + GIN + 审计白名单）**先与 skill-ingest-center 对齐迁移号** | 1–1.5 | ⚠️ **迁移号冲突**（`V38` 已被预定，§H 开头） |
| P0-2 | 契约：`PresetDependency` + `PresetVersion.dependencies` + `RuntimePresetSummary.requiresSummary` + 4 个新错误码；`contracts generate` | 1.5–2.5 | P0-1；⚠️ **错误码枚举漏扩会让 generate 失败**（`docs/compose/spec/preset-square.md:17`） |
| P0-3 | 服务端：inspector 读可选键 + store/service 写读 `dependencies` + 发布前 required 校验 | 2–3 | P0-1、P0-2 |
| P0-4 | 员工端主干：`preset-install.ts` + `preset-route.ts` + local-api 透传（**复用**技能侧下载/校验/原子落盘 + 共用下载内核） | 3–4.5 | P0-3；⚠️ **依赖官方唯一安装面的可达性**（§2.4，三个硬风险） |
| P0-5 | 员工端 UI：列表三枚签 + `Switch` + 详情「这份配方包含」+ 失败可行动（**"复制导入指令"保留为次要退路**） | 1.5–2.5 | P0-4 |
| P0-6 | 联调 + 验收（未分配不可见、缺必需项 fail-closed、装/卸幂等、失败重试、错误码逐条覆盖） | 1.5–3 | P0-1…P0-5 |

**P0 合计 ≈ 10.5–17 人日**（逐项区间相加：min 1+1.5+2+3+1.5+1.5 = 10.5；max 1.5+2.5+3+4.5+2.5+3 = 17.0）。
**P0 的硬依赖（"尚不存在"的能力）**：
1. **官方 preset 导入面（不存在）** → P0-4 走"装 bundle"的替代路径，**必须先在真机上验证一次**（§M 第 1 条）。
2. **迁移号 `V38` 被占（已存在但不是我们的）** → 必须先对齐。

### P1 — 治理与一致性（**6–10 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P1-1 | 控制台：引用列 + 失效标 + 「受影响配方」查询与提示（§D.5 ②） | 1.5–2.5 | P0-1…P0-3 |
| P1-2 | 审计四事件全链路（含客户端启用/停用回传） | 1–1.5 | P0-4 |
| P1-3 | 员工端「一眼可读」完整版：工具面统计（§F.4 ②）、规则文件只读预览、许可/来源聚合 | 1.5–2.5 | P0-5 |
| P1-4 | 版本耦合的**显式**能力：配方可钉/可跟（写路径 + 详情展示 + 变更提示） | 1.5–2.5 | P0-3 |
| P1-5 | 管理侧「从现有技能/插件起草配方」表单（选资产 → 生成 `agent.cordis.yml` 草稿，仍走人工审） | 1–1.5 | P0-3 |

### P2 — 生态与扩展（**8–13 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P2-1 | `PENDING_REVIEW` 状态机（**与技能侧一起做**，避免第二套审批） | 2–3 | ⚠️ **依赖"尚不存在"的能力**：三态 → 四态要改 `PresetVersion.Status`、DDL 约束、契约枚举、`publish` 的 `from` 参数、控制台筛选（与 `docs/plan/skill-ingest-center.md:708` 完全同构） |
| P2-2 | 「配方」页签/入口转正（二期商店整页 + `ENTERPRISE_MARKET_COMPONENTS.presets.reserved → false`） | 1.5–2.5 | ⚠️ **依赖二期整页**（`docs/plan/enterprise-marketplace-phase2.md:366` P2-1「配方页签转正 3–5」，本文与之重叠，**需合并排期**） |
| P2-3 | `DEPT` 可见范围 | 3–5 | ⚠️ **依赖"已决定不做、待用户拍板"的能力**：产品已移除部门资源（`docs/compose/spec/preset-square.md:63`）、`V18` 已收敛（§E.3）；前置是二期 **开放问题 Q2**（`docs/plan/enterprise-marketplace-phase2.md:370`） |
| P2-4 | 签名/信任根（`.dshpreset` Ed25519） | 1.5–2.5 | 一期 Out of Scope（`docs/compose/spec/preset-square.md:207`）；建议**与插件签名策略一起拍板** |

**★"依赖尚不存在的能力"汇总（开工前必须处理）**：

| 依赖 | 现状 | 影响 |
|---|---|---|
| 官方 preset 导入面 | **不存在**（§2.4，五条证据 + 穷举搜索零命中） | P0-4 必须走替代路径，且要接受"执行代码 + 无预置信任 + 改动要新会话"三个风险 |
| `PENDING_REVIEW` | **不存在**（三态，`V30…sql:40`） | P2-1，且应与技能侧合并 |
| `DEPT` 分配 | **已被产品移除**（`V18__product_access_scopes.sql:6`、`:42-48`；`docs/compose/spec/preset-square.md:63`） | P2-3，逆着既有收敛走，需用户拍板 |
| 迁移号 `V38` | **已被 `skill-ingest-center` 预定**（`docs/plan/skill-ingest-center.md:489`） | P0-1 起始动作 |
| `dsh-agent-presets`（目录扫描那套） | 本 profile **未挂载**（`dsh-web-app/cordis.patch.yml:562-565` 挂的是 registry） | 不作为地基（§M 不确定项） |

---

## J. 开放问题（≤6 条）

1. **一键启用要不要做？** 它必然触发"装 bundle = 在 Host 进程执行代码 + 需要 Full access/批准"（`editing-cordis-compositions/SKILL.md`「Verify」段）。
   员工点一下"启用"就被要权限，与"零摩擦"体验冲突。**我们是否接受把权限确认纳入"启用"的正常流程**，还是永远停在"复制指令 + 让 Agent 代做"？
2. **厂商 id 后缀策略**：`{presetId}-ent` 会改变官方 picker 里的显示标识。是否要为"企业配方"用一个**可识别的统一前缀**（如 `ent-<presetId>`），还是每个配方各带自己的 `-ent`？（一期已建议后者，但没做过真机 picker 观察。）
3. **配方的"默认"语义**：启用一份配方后，要不要**把它设成该员工的默认 preset**（`agent-preset-registry` 的 `selectedDefault`/settings 命名空间）？
   若设，"我启用了 A 但新会话还是 standard"的困惑消失；若不设，"启用"到底改变了什么会被质疑。
4. **`required` 的粒度**：`required` 标在**引用项**上（本文建议）还是标在**类型**上（"技能都可缺、插件都必需"）？前者灵活但要作者判断，后者简单但可能过严。
5. **"受影响配方"的跨域责任**：当插件/技能退休时，提示应该出现在**插件/技能的退休流程里**（跨域写配方语义），还是做成一条**独立的"影响面"查询**（不改别人的流程）？本文倾向后者，但控制台就要多一个入口。
6. **本机自装配方的隔离方式**：G8 要求"企业分发 vs 本机自装"不混排，但**官方 picker 会同时列出 shipped + 我们装的**，
   picker 界面不是我们的。我们只能控制**装之前**的确认与**装之后**的命名区分。这个妥协是否可接受？

---

## K. 明确不做（≥4 条 + 理由）

1. **不做"企业自己的一套 preset 运行时/选择器"。** 官方已有一份 picker + registry（`dsh-client-ui-agent-preset/README.md:28`、`:40`）。
   自建 = 与官方抢 composition 的权威，必然在"哪份配置真的生效"上产生两个真相。**我们只在官方安装面上做手脚。**
2. **不把技能/插件内嵌进配方包。** 理由三条：① 同一份内容在中心与本机各存一份必然漂移；② 技能/插件各有自己的安装管线与 watcher（少一套分发机制）；③ 内嵌会让"配方"变成"发行版"，退休与升级语义立刻失控（§B.2/B.3）。
3. **不在服务端解析 `agent.cordis.yml` 的语义。** 一期冻结决策（`docs/compose/spec/preset-square.md:57`），且实现方言的权威在官方 Loader（`cordis-composition-reference/SKILL.md`）。
   服务端只抄 manifest 的引用字段，不做 YAML 语义判断。
4. **不把"配方"做成能改沙箱/权限/审批栈的东西。** 官方 composition 自己就写明这些留在 Host 组合（`/data/user/0/com.deepcode.shell/files/home/.dsh/.agent-presets/phone-control/agent.cordis.yml:7-9`）。配方若声称能改，就是**假装有安全能力**——比没有更危险。
5. **不做内容安全扫描，也不声称做了。** 现状无扫描（`docs/plan/borrow-from-skillhub.md:30`、`:61`）；默认档位只能承诺"管理员审过 + sha256 完整 + 装的时候官方要你确认"（§F.4）。**任何"已通过安全检测"的文案都是说谎。**
6. **不做商用化元素**（价格、购买、购物车、客服、星级、下载量排行）。一期已明确（`docs/compose/spec/preset-square.md:162`、`:210`），且市场页全树文本已由测试反向锁死（`marketplace-entry.tsx` 文件头 `[POS]`）。
7. **不做"退休时远程撤回员工本机已装的配方"。** 沿用插件与配方共同的既有口径（`docs/compose/spec/preset-square.md:200`）；本机文件语义下远程撤回既越权又不可靠。
8. **不做"员工投稿 + 自助发布"。** 一期 Out of Scope（`docs/compose/spec/preset-square.md:206`）；可执行配置的自助上传会直接摧毁 F 节的全部治理假设。

---

## L. 与其它规划的关系（逐份一句话）

| 文档 | 一句话关系 |
|---|---|
| `docs/compose/spec/preset-square.md` | **一期已交付实现的真源**；本文是它的下一期，**不推翻它的任何冻结决策**（包格式、状态机、无签名、无 DEPT、服务端不解析 YAML），只补"引用坐标 + 员工端真启用"。 |
| `docs/plan/enterprise-marketplace-phase2.md` | **承载形态与三场景口径的真源**；它的 P2-1「配方页签转正（3–5 人日，预留位 → 实体）」（`:366`）与本文的 P2-2 **是同一件事，必须合并排期**；它 §2.2 那句「与 `ENTERPRISE_MARKET_COMPONENTS` 的 `presets.reserved` 一致，二期只留位」（`:244`）在本文之后应更新为"已排期"。 |
| `docs/plan/skill-install-sources.md` | **客户端安装管线与信任模型的真源**；本文的 P0-4 **整体复用**它记录的那条主干（`skill-install.ts:297-432` + `verification.ts:184-247` + `installed.json` 原子写），并沿用它的"同一落盘目录 = 同一信任域、不混排"结论（`:642`、`:682`）作为 G8 的依据。 |
| `docs/plan/skill-ingest-center.md` | **中心侧导入治理的真源**；两处直接耦合：① **迁移号 `V38` 已被它预定**（`:489`）→ 本文取 `V39`；② `PENDING_REVIEW` 的口径（`:295-307`、`:370-373`、`:708`）**必须与本文 P2-1 一起做**，否则会有两套审批语义。 |
| `docs/plan/borrow-from-skillhub.md` | **借鉴决策的真源**；它把 `PENDING_REVIEW` 列为 P0 借鉴项、并且明确"我们**没有内容安全扫描**"（`:30`、`:61`）——后者正是本文 §F.4 默认档位的依据；它的"多技能套件是**引用式**（不复制文件）"（`docs/plan/borrow-from-skillhub.md:42-43`）正是本文 D 节推荐口径的先例。 |
| `docs/plan/add-skill-flow-reference.md` | **官方"添加插件"流程的逐元素 UX 规格**；本文 §G 只规定**不可让步的口径**（信任分区、错误可行动、一次点击、可回退），逐元素布局若要做到位应以该文为准。 |
| `docs/plan/enterprise-presets.md`（本文） | 只规划，不实现；**与上述各文档无口径冲突**，唯一的排期冲突已标在 §I 与 §L 第一/第四行。 |

---

## M. 不确定项（读不到 / 官方能力面不明确）

1. **替代路径在真机上是否成立，未验证。** 本文设计的"客户端把 `agent.cordis.yml` 包成最小 bundle → 走官方安装面"这条链，
   **是读官方 skill/README 推出的**（`editing-cordis-compositions/SKILL.md`「Create a preset」段 + `dsh-agent-preset-registry/README.md:48`），
   **本会话没有真机执行过一次**。风险点：① 从**客户端（Web GUI）侧**发起装 bundle 与从**会话内**发起（模型调 `plugin_manager`）是否同一条面；
   ② 装完之后 **profile 是否需要重启**才能让 Host 侧 bundle 生效（客户端 bundle 有 HMR，Host 侧没有）。**开工第一步必须先做一次真机 spike。**
2. **`manifest.json` 的未知顶层键到底会不会被拒，没有实证。** 推理依据是 `PresetArtifactInspector.validateManifest`（`:101-120`）
   **只按名取 6 个键、没有任何"拒绝未知键"的分支**；技能侧的同构实现已被实测证明"未知键既不报错也不保存"（`docs/plan/skill-install-sources.md:572`）。
   但**配方侧本会话没有跑测试**。实现前必须补一条验包单测。
3. **`dsh-agent-presets`（目录扫描那套）在某些部署形态下是否被挂载，不确定。** 本 profile 挂的是 `agent-preset-registry`（`dsh-web-app/cordis.patch.yml:562-565`），
   且官方 skill 说老目录 `Nothing reads that directory any more.`；但 `dsh-agent-presets` 包**仍在安装目录里**、仍被 `dsh-host-apiproxy` 依赖（`package.json:80`/`:85`），
   它的 README 也仍然描述 `roots`/`includeUserRoot` 的目录扫描能力。**若某个部署把它挂上，本文 §C.2 的最优路径要重新评估。**
4. **`POST /api/agent-preset.import` 的真实归属与现状未知。** 它只出现在 `docs/compose/spec/preset-square.md:180` 作为 **Desktop 侧约定**；
   本会话在 0.2.0-rc.2 安装目录 **零命中**。它可能属于 DSH Desktop（另一条产品线、不在本机），也可能已退役。**本方案不依赖它。**
5. **服务端"受影响配方"查询的成本未测。** `dependencies` 上做 containment（`jsonb_path_ops` GIN）在**万级版本**下的表现未知；
   若成本高，§D.5 的"退休前提示"要改成异步/按需。
6. **官方 picker 对"我们装的 bundle"的呈现未观察过。** 它是按 `trust`（`system`/`user`）分组？还是按"内置/自定义"？
   `dsh-client-ui-agent-preset/README.md:28` 说的是"built-in and custom card groups"，但我们装的 bundle 会被算作哪一组、显示名取 `config.name` 还是别的，**没有真机观察**。这直接影响 G8 与 §J 第 6 条。
7. **两个 `agentPreset` 家族的长期归属未知。** `dsh-agent-presets`（session 级 + 目录发现 + `trust: system` 的 `roots`）与 `dsh-agent-preset-registry`（bundle patch + eager activation）
   在 0.2.0-rc.2 里**同时存在**。官方两枚 skill 只讲 registry 那一套。**若上游把两者合并/切换，本文 §C.2 的落点要重做。**
8. **控制台需要"单包详情端点"这件事未确认。** 现有只有列表（`AdminPresetController.java:57-80`），列表项里已经带 versions + assignments（`PresetViews.packageView:20-32`），
   所以在"配方数量不大"的前提下控制台**可能不需要**新端点（§H S10）。这一条取决于产品对分页与响应体积的要求，本会话没有拍。

---

## 附录：本会话取证索引（供复核）

**仓库内（只读）**
- `docs/compose/spec/preset-square.md`（224 行，一期实现真源）
- `server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V30__enterprise_preset_square.sql`（108 行）
- `.../src/main/java/com/owndsh/enterprise/preset/**`（23 个 Java 文件，共 2017 行：application 5 / artifact 3 / domain 4 / persistence 2 / web 5 / 配置 2 等）
- `contracts/components/preset.yaml`（194 行）、`contracts/paths/preset.yaml`（221 行）
- `console/src/features/presets/{preset-management-page.tsx,preset-editors.tsx,CLAUDE.md}`、`console/src/app/product-routes.ts:22`
- `plugin/packages/ui/src/preset-market.tsx`（173 行）、`marketplace-entry.tsx`（`ENTERPRISE_MARKET_COMPONENTS` 在 `:34-39`）、`account-view.tsx:70,278,349-350`、`local-api-decode.ts:121-131,714-740`
- `plugin/packages/platform-client/src/local-api.ts:28,49,717-763`、`platform-service.ts:638-647`
- `docs/plan/{enterprise-marketplace-phase2,skill-install-sources,skill-ingest-center,borrow-from-skillhub,add-skill-flow-reference}.md`

**官方安装目录（只读，`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/`，版本 `0.2.0-rc.2`）**
- `node_modules/@deepseek-ai/dsh-agent-preset/{README.md,skills/editing-cordis-compositions/SKILL.md,skills/cordis-composition-reference/SKILL.md}`
- `node_modules/@deepseek-ai/dsh-agent-preset-registry/README.md`（`:46` 不扫目录、`:48` 唯一入口是 bundle patch）
- `node_modules/@deepseek-ai/dsh-agent-presets/README.md`（另一套：目录 `roots`，本 profile 未挂载）
- `node_modules/@deepseek-ai/dsh-client-ui-agent-preset/README.md`（`:28` 卡片与只读 YAML、`:40` list/read 两个 Remote）
- `node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:562-565`、`node_modules/@deepseek-ai/dsh-web-app/presets/{standard,ptc,minimal,cordis}.patch.yml`

**本机实证（只读）**
- `/data/user/0/com.deepcode.shell/files/home/.dsh/.agent-presets/phone-control/{preset.yml,agent.cordis.yml,skills/phone-control/SKILL.md}`（老目录格式仍存在，但已无人读取）

---

## 决策记录

### D1 · 一键启用采用【方案 A】(用户裁定 2026-10-02)

用户原话回「a」。即:**接受把"装 bundle 需要完全访问权限或批准"纳入正常流程**,以换取真正的
"一键启用"（满足产品宪法「开箱即用 · 小白零门槛」）。

**设计约束**（依据 `docs/research/agent-preset-best-practices.md` 的社区事实标准 +
`docs/notes/product-charter.md`）：

1. **首次启用弹一次授权**，授权界面必须逐项列出：这份配方会安装哪些插件、各自能做什么
   （读/写/对外发送）、是否需要联网；附一句免责（我们不扫描内容，社区同样如此）。
2. **一次授权、后续免打扰**：同一份配方（同一插件集合）不再重复弹；
   **插件集合发生变化时必须重新确认**（集合指纹变化 = 重新授权）。
3. **随时可停用/卸载**；停用后不残留运行中的能力。
4. **失败不禁用按钮**：再点即重试；失败按 `error-messages` 的人话 + 下一步呈现。
5. **员工侧术语**：不出现 bundle / patch / Cordis / preset；统一说「启用」「停用」「连接」。

**前置条件（P0 的开工门槛）**：方案 §M 已标明"替代路径未真机验证"。
→ 必须先完成 spike：① 从 Web 客户端侧发起装 bundle 是否与会话内 `plugin_manager` 同一条面；
② 装完 Host 是否需重启；③ 官方 preset picker 是否列出它、以什么名字分组；
④ 新会话能否选中；⑤ 能否干净卸载。**spike 不通过则本决策需重议。**

---

## 附录 · 商店页签要求（用户指定，2026-10-02）

> 用户原话：「配方也要放到**插件商店**，作为**企业配方页签**与**企业技能**、**企业插件**并排」

**硬要求**：配方必须出现在**插件商店（企业市场）页**里，作为一个与「企业技能」「企业插件」**并排的页签**，
不再只存在于设置弹窗的配方 tab 里。

**现状与差距（本会话已查实）**：
- 市场页签真源 `ENTERPRISE_MARKET_TABS` 当前只有 **企业技能 / 企业插件 / 包含内容** —— **没有配方页签** ✗
- 配方列表与详情今天只挂在**设置弹窗**的配方 tab（`plugin/packages/ui/src/preset-market.tsx`）
- 员工端配方详情**今天还是坏的** ✗（服务端 runtime 投影漏发未声明字段 `downloadPath`，关闭键集解码整条判失败；
  正在按切片 B 的处置删除该字段，ui 侧只需补 `dependencies` 一个键名）

**落点建议（实施时照此）**：
- 在市场页新增页签「**企业配方**」，位置在「企业插件」之后、「包含内容」之前；
  页签 id 取新 id（例如 `presets`），**不要**复用旧「应用商店」相关 id（那批已按用户要求移除）
- 列表行**复用现有共享行渲染**（`EnterpriseMarketInlineRows` 与其行 facts），不要新造第二套行；
  配方行展示与技能/插件行**同级同款**：图标 + 两行文案 + 版本短号签 + 分类签 + 动作区开关
- 详情沿用**子页面**形态（与技能详情同源：面包屑返回 + 官方框架 + 分区），
  并在详情里显示「这份配方包含」的技能/插件清单（依赖切片 B 的 runtime `dependencies`）
- 设置弹窗里的配方 tab：**保留**（作为一个次要入口）还是移除，实施前给结论；默认建议保留以避免丢入口

**与"能力中心"信息架构的关系**：
`docs/plan/capability-center-ia.md`（在写）规划的是把市场页重组为「能力中心（专家/技能/连接器/行业应用）」。
本条要求与该重组**不冲突**：它约束的是"配方必须与技能/插件并排出现在商店页"，
重组只是页签的命名与分组问题 ⇒ 合流时以「配方（或专家）必须有与技能/插件并排的页签」为不变式。
