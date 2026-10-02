# workdsh 仓库「除资料库之外」功能调研

> 调研对象：`techflag/workdsh`（本机克隆 `/data/data/com.deepcode.shell/files/home/.sshwork/workdsh`，全程只读）
> 范围：**除「资料库」之外**的全部功能。资料库已另有 `docs/research/workdsh-knowledge-base.md`（974 行）与 `docs/plan/library-port.md`（708 行），本文只在对比处顺带提一句，不展开。
> 证据约定：所有 `文件:行号` 均相对于仓库根 `/data/data/com.deepcode.shell/files/home/.sshwork/workdsh`。读不到的一律写「未取到」，不编造模块名/字段名/接口名。
> 本文路径前缀说明：`workdsh-web/` = Web/插件 workspace；`dsh-plugin-desktop/` = Electron 桌面壳；`.agents/notes/` = 仓库内可读的架构笔记。

---

## 0 一句话结论

**它除资料库外最值钱的是「专家（experts）」模块**：一个 6646 行代码、把「专家资产 → 不可变修订 → 官方 Agent preset 编译 → 官方 Agent Teams 装配」串成闭环的实现，并配了一套**发布确认凭证**（challenge → 一次性 proof → consume，拒绝模型自我确认）的授权模式；其次是**治理三件套**（identity-local + access + audit 共 1019 行，形状完整、可移植）与**Office 交付工具链**（5951 行、8 个 `content_*` 工具 + 实时编辑器）。而它自称的另一个大卖点「技能市场 SkillHub」实际只有**一个 88 行的 UI 面板**，真正的搜索/安装能力来自第三方 DSH 插件 `@cocofhu/skillhub@0.2.16`，插件市场同理来自 `dshmarket@1.66.1`——**这两个都不是它自己的实现**。

---

## 1 模块地图

### 1.1 仓库规模与结构（复核）

| 项 | 值 | 证据 |
| --- | --- | --- |
| 全仓文件（不含 `.git`） | **1017** | `find . -type f -not -path './.git/*' \| wc -l` |
| 其中 `.gitkeep` 占位 | **203** | `find . -name .gitkeep \| wc -l` |
| `workdsh-web/` 文件 | 791 | 同上 |
| `dsh-plugin-desktop/` 文件 | 75 | 同上 |
| `packages/*/package.json` 数 | **15** | `find workdsh-web/packages -name package.json \| wc -l` |
| `workdsh-web/packages/**` 代码行数 | 23093（`.ts/.tsx/.mts/.js/.mjs`） | `xargs wc -l` |
| workspace 定义 | `packages/*`、`packages/plugins/*`、`packages/providers/*`、`examples/*`（排除 `examples/univer-browser-edit`） | `workdsh-web/pnpm-workspace.yaml:1-7` |
| 上游锁定 | `deepseek-harness@0.1.7-rc.2`，commit `477b4f420553e8a52c2fbccc464d7561b239c443` | `upstream.json:1-6` |

`workdsh-web/packages/` 下三个分类目录都不是 npm 包，只做归类，各自子目录独立版本化：

- `workdsh-web/packages/plugins/README.md:1-7`：plugins 父目录仅分类；每插件独立包/版本/迁移/CHANGELOG。
- `workdsh-web/packages/providers/README.md:1-10`：「当前均为规划骨架，未声明可执行入口」。

### 1.2 全部 workspace 包（15 个）与骨架目录（11 个）

「代码行数」= 包内 `.ts/.tsx/.mts/.js/.mjs` 行数合计（含包内 `tests/`，不含 `resources/` 下的 Markdown/Python 与字体二进制）。

| # | 目录 | 包名 | 版本 | 非占位文件 | 代码行 | 包内测试 | README | `dsh.bundle` patch | 可安装（12 之一） |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `plugins/experts` | `workdsh-plugin-experts` | 0.1.0-alpha.9 | 52 | 6646 | 0（集成测试在仓库层） | Y | Y | ✅ |
| 2 | `plugins/office` | `workdsh-plugin-office` | 0.1.0-alpha.9 | 80 | 5951 | 0（集成测试在仓库层） | Y | Y | ✅ |
| 3 | `plugins/skills` | `workdsh-plugin-skills` | 0.1.0-alpha.34 | 54 | 2654 | 0（集成测试在仓库层） | Y | Y | ✅ |
| 4 | `plugins/library` | `workdsh-plugin-library` | 0.1.0-alpha.5 | 24 | 1465 | `tests/library.test.mjs` 215 行 | Y | Y | ✅（本文不展开） |
| 5 | `plugins/projects` | `workdsh-plugin-projects` | 0.1.0-alpha.4 | 26 | 1007 | 3 个 `.mjs`（12+17+35 行） | Y | Y | ✅ |
| 6 | `bundle` | `workdsh-bundle` | 0.1.0-alpha.53 | 21 | 858 | `tests/browser-view*.mjs` 3 个（123+65+66 行） | Y | Y | ✅ |
| 7 | `providers/browser-session` | `workdsh-provider-browser-session` | 0.1.0-alpha.2 | 15 | 804 | 2 个（112+30 行） | Y | 由 bundle patch 插入 | ✅ |
| 8 | `plugins/connectors` | `workdsh-plugin-connectors` | 0.1.0-alpha.4 | 18 | 715 | 0（靠 `scripts/probe-connectors.mjs` 7005 B） | Y | Y | ✅ |
| 9 | `plugins/access` | `workdsh-plugin-access` | 0.1.0-alpha.7 | 11 | 654 | 0（`tests/integration/tool-access-bridge.test.mjs` 269 行） | Y | Y | ✅ |
| 10 | `plugins/activity` | `workdsh-plugin-activity` | 0.1.0-alpha.6 | 15 | 280 | `tests/projection.test.mjs` 116 行 | Y | Y | ✅ |
| 11 | `providers/identity-local` | `workdsh-provider-identity-local` | 0.1.0-alpha.7 | 9 | 252 | 0（`tests/integration/local-identity*.test.mjs` 116 行） | Y | Y | ✅ |
| 12 | `plugins/audit` | `workdsh-plugin-audit` | 0.1.0-alpha.6 | 9 | 113 | 0（并入 access-audit 集成测试） | Y | Y | ✅ |
| 13 | `contracts` | `workdsh-contracts` | 0.1.0-alpha.9 | 13 | 1333（纯类型） | 0 | Y | – | 基础包 |
| 14 | `ui` | `workdsh-ui` | 0.1.0-alpha.7 | 14 | 246 | 0 | Y | – | 基础包 |
| 15 | `plugins/workbench` | `workdsh-plugin-workbench` | 0.1.0-alpha.12 | 11 | 115 | 0 | Y | – | 仅展示层 |

**骨架目录（11 个，只有 README + `.gitkeep`，代码 0 行、无 `package.json`）**：

- 插件侧 8 个：`plugins/admin`（15 个 `.gitkeep`）、`plugins/applications`、`plugins/automations`、`plugins/identity`、`plugins/model-policy`、`plugins/pages`、`plugins/tables`、`plugins/usage`（各 8 个 `.gitkeep`）
- Provider 侧 3 个：`providers/identity-oidc`、`providers/library-team`、`providers/runtime-isolated`（各 8 个 `.gitkeep`）

这 11 个的 README 首段一律是「**规划中，尚未实现**。目录已建立，不代表功能完成」，并且都有同一句纪律：「先验证公开接口，再实现；**目前仅保留骨架，不声明加载入口、假工具或成功响应**」。例如 `plugins/admin/README.md:3`、`plugins/automations/README.md:3`、`providers/identity-oidc/README.md:3`。

### 1.3 成熟度分档与判据

判据：①非占位文件数 ②是否有可加载入口（`cordis.patch.yml` / `dsh.bundle`）③是否有测试 ④代码里是否有真实业务逻辑（不是只有 client 展示）⑤README 自述状态。

| 档 | 判据 | 模块 | 数量 |
| --- | --- | --- | --- |
| **A 已实现** | 有实质 Host 业务代码 + 有可加载入口 + 有测试（包内或仓库层集成测试） | experts、office、skills、library、projects、access、audit、identity-local、browser-session、activity、bundle | 11 |
| **B 半成品** | 有实现但要害未完成 / 无测试 / 无独立制品 | `connectors`（715 行、功能真实，但无任何测试目录，README 自述「交互式 OAuth、多账号、公共授权、写操作确认和审计场景」全缺，`plugins/connectors/README.md:9`）、`workbench`（115 行纯 client 展示，无 `dsh.bundle`，`plugins/workbench/README.md:9` 自述「尚无独立 `dsh.bundle` 安装层」） | 2 |
| **C 基础包（非功能模块）** | 只有类型/展示组件，无业务 | `contracts`（1333 行纯类型）、`ui`（246 行 React 组件） | 2 |
| **D 骨架** | 只有 README + `.gitkeep`，代码 0 行 | admin、applications、automations、identity、model-policy、pages、tables、usage、identity-oidc、library-team、runtime-isolated | 11 |

### 1.4 它自己的「12 个可安装模块」清单在哪定义

**不在 README 里逐条列**，`workdsh-web/README.md:35` 只有一句「The alpha.14 bundle includes **12 installable modules**」。权威清单在打包脚本的硬编码数组：

`workdsh-web/scripts/pack-project-release.mjs:12-25` —— `packageDirectories` 数组，逐条 ① 是：

| # | 目录（`pack-project-release.mjs` 行号） | 包名 | 一句话 |
| --- | --- | --- | --- |
| 1 | `packages/providers/identity-local`（:13） | `workdsh-provider-identity-local` | 本地单用户身份/个人组织/owner 成员关系，写入官方 Storage Domain |
| 2 | `packages/providers/browser-session`（:14） | `workdsh-provider-browser-session` | 受管 Chromium：让官方 Playwright MCP 工具与右栏操作同一个页面 |
| 3 | `packages/plugins/audit`（:15） | `workdsh-plugin-audit` | 不可变审计日志追加/排空 |
| 4 | `packages/plugins/access`（:16） | `workdsh-plugin-access` | 操作级资源授权、持久 grant、Session 绑定、撤权、工具流水线审计 |
| 5 | `packages/plugins/skills`（:17） | `workdsh-plugin-skills` | 技能管理 + 本地技能目录（SkillHub 页签只是 UI）+ 三个草稿工具 |
| 6 | `packages/plugins/experts`（:18） | `workdsh-plugin-experts` | 专家/专家团资产、不可变修订、官方 Agent preset 编译、官方 Team 装配 |
| 7 | `packages/plugins/connectors`（:19） | `workdsh-plugin-connectors` | MCP 连接器（stdio / Streamable HTTP）+ 按会话工具隔离 |
| 8 | `packages/plugins/office`（:20） | `workdsh-plugin-office` | 8 个 `content_*` 工具 + 右侧实时编辑器（Word/PPT/Excel/PDF/HTML/CSV） |
| 9 | `packages/plugins/library`（:21） | `workdsh-plugin-library` | 资料库（**本文不展开**） |
| 10 | `packages/plugins/projects`（:22） | `workdsh-plugin-projects` | 项目工作台：项目/配置修订/计划/资产引用/任务关联/活动 |
| 11 | `packages/plugins/activity`（:23） | `workdsh-plugin-activity` | 顶部一行活动/协作状态条（纯展示投影） |
| 12 | `packages/bundle`（:24） | `workdsh-bundle` | 组合包：品牌、工作台导航、社区市场嵌入、Agent 浏览器页、诊断页 |

**注意两处口径差**：①`workdsh-web/packages/plugins/README.md:7` 与 `workdsh-web/packages/providers/README.md:10` 都把权威清单指向 `workdsh-web/docs/modules.json`——该文件**未取到**（`workdsh-web/docs/` 被 `.gitignore` 排除，目录根本不存在，`ls workdsh-web/docs` → `No such file or directory`）。②12 个清单**不含** `workdsh-contracts` 与 `workdsh-ui`（它们是 workspace 内依赖，不单独发 tgz），也**不含** `workdsh-plugin-workbench`（README 明说它随展示产物编译、无独立制品，`workdsh-web/packages/bundle/README.md:23`）。

### 1.5 每个模块的对外入口一览

| 模块 | Host 服务（Context 上） | Host 工具 | HTTP / Remote 路由 | Client slot / 页面 |
| --- | --- | --- | --- | --- |
| skills | `ctx.workdshSkills`（契约 `workdsh-contracts/skills`，`contractVersion=1`，`plugins/skills/README.md:44-46`） | `workdsh_save_skill_draft` / `workdsh_validate_skill_draft` / `workdsh_publish_skill_draft`（`src/services/lifecycle-tools.ts:31,59,73`） | `/api/workdsh-skills`、`/api/workdsh-skills/import`、`/api/workdsh-skills/icon`（`src/services/connection-api.ts:6-7`、`src/services/catalog.ts:14`） | `main` 键 `workdsh-skills`（`src/client.tsx:95`）、`sidebar.panellist` id `workdsh-skills`（:96-98）、`conversation.input.overlay` id `workdsh-skill-draft`（:99）；命令 `/workdsh-skill-creator`（`README.md:57`、`plugins/skills/README.md:57`） |
| experts | `ctx.workdshExperts`（`experts/src/index.ts:68`） | 11 个 `workdsh_expert_*`（`src/tools/management-tools.ts:291,319,343,358,368,389,432,452,470,498,524`） | `/api/workdsh-experts`、`/api/workdsh-experts/import`、`/api/workdsh-experts/export`（`src/services/connection-api.ts:29-31`） | `main` 键 `workdsh-experts`（`src/client.tsx:171-172`）、`conversation.input.overlay` id `workdsh-expert-draft`（:175）；**不注册 sidebar**（自述见 `src/client.tsx:29`） |
| office | `ctx.workdshOfficeContent`（`src/content/service.ts:37`） | **8 个**：`content_import_pptx`、`content_export`、`content_open`、`content_preview_styles`、`content_read`、`content_capabilities`、`content_edit`、`content_present`（守卫清单 `src/content/tools.ts:203-211`，注册点 :218/:233/:265/:308/:326/:343/:364/:413） | `/api/workdsh-office`（`src/content/connection.ts:48-50`，endpoint 枚举 :11-42） | `sidebar.right.tab.document`（`src/client.tsx:71`）、`sidebar.right.pane.tab`（:150-153）；命令 `/office` + `@` 工作副本引用（`README.md:71-79`） |
| connectors | `ctx.workdshConnectors`（`src/manager.ts:30`） | 无自有工具（只隔离官方 `mcp__<server>__*`） | `/api/workdsh-connectors`（`src/connection-api.ts:4`） | `main` 键 `workdsh-connectors`（`src/client.tsx:20-21`）、`conversation.input.left`（:24） |
| library | `ctx.workdshLibrary` | 7 个 `library_*`（`src/tools/library-tools.ts:12,33,48,59,66,73,80`） | `/api/workdsh-library`（`src/remote/connection-api.ts:6`） | `main` 键 `workdsh-library`、`sidebar.right.pane.tab` 键 `workdsh-library-preview`、`conversation.input.left`（`src/client.tsx:146-148`） |
| projects | `ctx.workdshProjects`（`src/services/project-manager.ts:21`） | **无**（纯页面 + 上下文注入） | 有 `remote/connection-api.ts`（未展开） | `main` 键 `workdsh-projects`、`workdsh-project-detail`（`src/client.tsx:146-147`）、`conversation.input.overlay`（:123）、`conversation.session.header.actions`（:139） |
| access | `ctx.workdshAccess`、`ctx.workdshSessionAccess`、`ctx.workdshToolAccess`（`plugins/access/src/index.ts:70-77`） | 无（靠官方事件钩子） | 无自有 HTTP（README:7 明说「尚未生成企业外部 Session Remote」） | 无页面 |
| audit | `ctx.workdshAudit`（`plugins/audit/src/index.ts:31-35`） | 无 | 无（查询/导出未实现，`README.md:3`） | 无页面 |
| identity-local | `ctx.workdshIdentity`（`providers/identity-local/src/index.ts:111-115`） | 无 | 无 | 无页面 |
| browser-session | `ctx.workdshBrowserSession`（`providers/browser-session/src/index.ts:39-41`） | 无自有工具（提供 Playwright MCP 的浏览器） | `/api/workdsh-browser-session`（`src/remote.ts:9`） | `sidebar.right.pane.tab` 键由 `src/client.tsx:37-38` 注册 |
| activity | 无 Host 服务（`src/index.ts:1-3` 明确 Host 为空实现） | 无 | 无 | 仅 client：`activityPresentation` 契约（`src/client.tsx:6-9`） |
| bundle | `workdsh-installation-probe`（`src/probe.ts:10`） | 无 | 复用官方 `remote.pluginInventory`（`src/client/harness/client.ts:115`） | 品牌 `sidebar.brand.name/mark`（:105-106）、`plugins.item` 社区市场卡（:39-42）、`sidebar.right.pane.tab` Agent 浏览器（:67）、`main` 键 `workdsh-probe`（诊断，:112-123）、`shell.overlay`（:89,107） |
| workbench | 无 | 无 | 无 | `sidebar.panellist`（仅 `pending:false` 的项，`src/harness/client.ts:19-28`）、`conversation.input.dock`（:18） |

---

## 2 逐个功能

按「价值 × 规模」排序；骨架模块合并成 §2.14 一句带过。

### 2.1 技能管理 / 技能市场（`workdsh-plugin-skills`）

**① 是什么 / 给谁用**
一句话：让本地用户在不发 npm 包的前提下，「浏览/安装/编辑/启停/卸载/回收」技能资产，并把「技能页」同时当成技能市场页；给最终用户和「用对话造技能」的用户。

**② 实现规模 · 测试**
- 关键源码：`src/services/manager.ts` **888 行**（核心）、`src/services/import-staging.ts` 188、`src/services/catalog.ts` 232、`src/services/connection-api.ts` 218、`src/client/SkillsPanel.tsx` 305、`src/client/styles.ts` 199、`src/client/ImportSkillModal.tsx` 114、`src/client/SkillHubPanel.tsx` **88**、`src/services/lifecycle-tools.ts` 100、`src/client.tsx` 100。合计 2654 行。
- 内置技能资源：`resources/skills/` 下 5 个目录（`workdsh-skill-creator` 216 行 SKILL.md + 3 个 Python 脚本 337/114/84 行、`workdsh-ppt-design`、`workdsh-word-design`、`workdsh-excel-design`、`workdsh-web-design`）；由 `scripts/generate-builtin-skills.mjs:9-21` 在 **build 期**用官方 provider 解析 Markdown 单向生成 `src/authoring/professional.ts`（`generate-builtin-skills.mjs:17-19` 的输出头注释）。
- 测试：包内无 `tests/`；仓库层集成测试 `tests/integration/skill-manager.test.mjs` 454 行、`skill-plugin-lifecycle.test.mjs` 96、`skill-persistence.test.mjs` 82、`skill-loading.test.mjs` 85、`skill-session.test.mjs` 130、`skill-creator-host.test.mjs` 105；探针 `scripts/probe-skills-package.mjs` 20287 B；质量脚本自测 `scripts/quality/audit-skills.test.mjs`。

**③ 数据与存储**
- 技能本体**不是自建数据库**，而是官方技能根下的**文件**：`$DSH_AGENTS_HOME/skills`（默认 `~/.agents/skills`），Profile 范围才是 `$DSH_HOME/skills`（`plugins/skills/README.md:57`）。
- 自建状态目录 `stateRoot` 下三样：回收站 `agentsHome/.workdsh-trash/skills`（`manager.ts:168`）、回收凭据 `stateRoot/trash-receipts`（:172）、导入暂存 `stateRoot/imports`（:175-176）。
- 技能目录（市场数据）路径：`WORKDSH_SKILL_CATALOG` 或 `agentsHome/.workdsh-catalog`（`manager.ts:174`）。
- 目录文件格式（**纯数据**，非代码）：`catalog.json`，`schema: 1`、`kind: 'workdsh-skill-catalog'`、`entries[]`，条目字段 `name/title/description/categories/version/examples/icon/payload/installable/installLimits`（`src/services/catalog.ts:15-16,26-45`）；图标按 sha256 前 12 位做 revision 缓存（`catalog.ts:226-227`）。
- 跨端共享：是。Host 侧 `SkillManager` + Client 通过官方 Connection 认证 Fetch 路由（`connection-api.ts:6-7`）共享同一服务。

**④ 与 Agent 的集成**
有，三条：
1. **官方技能注册**：`ctx.skills.register({..., source:'bundled', resourceBase:{kind:'directory', ...}})`（`src/index.ts:21-35`）——注册到官方 SkillRegistry，内容按需加载。
2. **三个 Host 工具**：`workdsh_save_skill_draft`、`workdsh_validate_skill_draft`、`workdsh_publish_skill_draft`（`src/services/lifecycle-tools.ts:31,59,73`）——走「私有草稿 → 校验 → 精确 revision → 确认发布」，`README.md` 强调「经过私有草稿、校验、精确 revision 和确认发布」。
3. **依赖检查契约**：`registerDependencyInspector()`（`manager.ts:469`），供别的领域登记「卸载影响」。

**⑤ 工程取舍 / 它说不做的事**
- 不复用/不重造执行器：「复用官方 Skill provider、工具和 Conversation；不重造执行器，**导入不运行脚本**」（`README.md:19`）。
- 不提供第二套安装器：「安装仍走官方受管导入路径（全局名称锁、内容指纹复核、原子发布）……**不提供第二套安装器**」（`README.md:53`）。
- 不伪造状态：「目录缺失或损坏时页面仅展示真实状态与诊断，**不伪选空目录**」（`README.md:53`）。
- 明确的未实现：「**不可变 SkillRevision、专家执行快照租约和多用户授权尚未实现**」（`README.md:49`）。
- 后置：公共 SkillHub 服务、企业服务器与管理 Web（`README.md:75`）。
- 导入硬上限：50 MiB / 400 文件 / 6 层目录（`import-staging.ts:7-8`，错误文案 `connection-api.ts:40-41`）。

**⑥ 可借鉴点**
- 「**目录是数据、不是代码**」：`catalog.json` 只有元数据 + 惰性 payload 目录，安装走既有导入路径；`catalog.ts:177-231` 的 `inside()` 越界校验 + `lstat` 拒符号链接 + `payloadPath()` 校验 `SKILL.md` 存在，是「不可信数据目录」的干净样例。**落到技能线**。
- **SkillHub 的真相**：`SkillHubPanel.tsx:26` 用 `fetch(new URL('./skillhub', document.baseURI))` 打第三方插件路由，`:36` 注释直说「Reuse the installed DSH plugin's search and verified installation path」；`README.md:85` 致谢 `@cocofhu/skillhub`。**即：它没有自己的 SkillHub 协议实现、没有依赖审查、没有风险旗标**——只有「卡片 + ＋安装 + 分页 + 来源页外链（`https://skillhub.cn/skills/<slug>`，`SkillHubPanel.tsx:81`）」。**与我们的技能线重叠度高，独有增量仅在于「本地目录数据化」与「独立安装制品」。**

---

### 2.2 专家 / 专家团 / 人设（`workdsh-plugin-experts`）★ 它最有价值的非资料库模块

**① 是什么 / 给谁用**
一句话：把「专家」当**资产**管理（作者身份、不可变修订、可移植包），把「执行」全权交给官方 Agent Teams；给要做「团队/角色化交付」的用户与团队。

**② 实现规模 · 测试**
- 关键源码：`src/services/experts-manager.ts` **1767 行**、`src/tools/management-tools.ts` 553、`src/services/portability.ts` 356、`src/services/connection-api.ts` 398、`src/client/styles.ts` 394、`src/client/ExpertsPanel.tsx` 336、`src/client/ExpertDraftEditor.tsx` 317、`src/domain/definition.ts` 291、`src/runtime/preset-compiler.ts` 220、`src/client/management.ts` 198、`src/client/ExpertDetailModal.tsx` 176、`src/client.tsx` 176、`src/storage/domain.ts` 165、`src/authoring/documents.ts` 139、`src/runtime/confirmation.ts` 116、`src/domain/values.ts` 102、`src/index.ts` 80、`src/domain/templates.ts` 73、`src/authoring/guide.ts` 71、`src/runtime/execution-guard.ts` 67、`src/domain/digest.ts` 59、`src/authoring/package-resources.ts` 45、`src/runtime/plans.ts` 45、`src/domain/team-workflow.ts` 22。合计 6646 行。
- 内置管理技能 `resources/skills/workdsh-expert-manager/`：SKILL.md 50 行 + references 5 篇（`agent-md-spec.md` 179、`plugin-json-spec.md` 183、`avatar-spec.md` 162、`team-spec.md` 120、`authoring-api.md` 33）+ `runtime/team-lead.md` 11。
- 测试：`tests/integration/expert-manager.test.mjs` **939 行**、`expert-authoring-skill.test.mjs` 63、`expert-package-authoring.test.mjs` 64、`expert-native-presets.test.mjs` 44、`expert-results.test.mjs` 51、`preset-authoring.test.mjs` 53、`preset-projection.test.mjs` 19；探针 6 个（`probe-experts-package.mjs` 22951 B、`probe-native-expert-team.mjs` 17618 B、`probe-native-team-web.mjs` 21617 B、`probe-experts-professional.mjs` 13919 B、`probe-official-expert-composition.mjs` 20199 B、`probe-experts-crossdomain.mjs` 16223 B）。

**③ 数据与存储**
自建 Storage Domain `workdsh_experts`，`version:1`，`layout:'per-record'`，**6 张表**（`src/storage/domain.ts:127-139`）：

| 表 | 关键字段（行号） |
| --- | --- |
| `experts` | `id`、`owner{organizationId,ownerPrincipalId,scope:personal\|organization\|project,projectId?}`、`origin:default\|personal\|organization`、`availability:enabled\|disabled\|archived`、`revision`、`draftRevision`、`publishedRevisionRef{expertId,revisionId}`、`teamParentId?`（:51-62） |
| `drafts` | `expertId`、`revision`、`definition`、`validationIssues[]`（:64-69） |
| `revisions`（不可变） | `definition`、`definitionDigest`、`dependencyLock[]`（技能修订引用 `{skillId,revisionId,name,contentDigest}`）、`dependencyLockDigest`、`teamMembers`、`presetRevisionRef`、`compilerVersion`、`compositionDigest`、`publishedAt`、`publishedBy`（:71-84） |
| `bindings` | `sessionId`、`expertRevisionRef`、`presetRevisionRef`、`compositionDigest`、`skillRevisionRefs[]`、`owner`、`workspaceRef?`、`createdFrom?`、`delegation?`（旧数据只读兼容）、`creationOperationId`（:86-103） |
| `preferences` | `principalId`、`expertId`、`pinned`、`lastUsedAt?`、`revision`（:105-111） |
| `operations` | `operationId`、`actorRef`、`action`、`payloadDigest`、`phase:prepared\|applying\|committed\|failed\|reconciling\|cancelled`、`auditDelivery:delivered\|pending\|failed`（:113-125） |

存储设计的两个硬点写在注释里：①`per-record` 布局 + **默认 `invalidRecords` 拒绝**，坏记录「fail loud 而不是静默消失」（:16-21）；②所有写入走 `KvTable.update` 做 CAS（:21）。复合键用 `_` 而非 NUL，因为后端要求 `/^[a-zA-Z0-9_-]+$/`（:141-165）。

跨端共享：是，Host 服务 + Client 页面 + Host 工具**共用同一个** `ExpertManager`（`README.md:9`「页面与 Agent 管理工具使用同一 Host 服务」）。

**④ 与 Agent 的集成（本文最值得细看的部分）**

（a）**装配三个官方 Agent Teams 插件 + 停用旧 subagent**：`plugins/experts/cordis.patch.yml:1-20`
```
disabled: tool-subagent-control / tool-subagent-list-agents / tool-subagent / tool-subagent-fork
insert:   dsh-experimental-agent-team (config.maxMembers: 16)
          dsh-experimental-tool-agent-team
          dsh-experimental-client-ui-agent-team
          workdsh-plugin-experts
```
九个官方团队工具名（`README.md:38`）：`spawn_teammate`、`send_message`、`list_agents`、`wait_agent`、`interrupt_agent`、`team_task_create`、`team_task_list`、`team_task_get`、`team_task_update`。

（b）**在官方 Agent 生命周期里做「资产准入 + 角色装配」**：`src/runtime/execution-guard.ts:62-66` 订阅 `agent/created` 与 `agent/pre-step`，`prepare()` 里：
- 从 `ctx.agentTeams.tryMembership(agent)` 取团队根与角色（:17-18）
- `ctx.workdshIdentity.resolve({sessionId})` 解析主体（:19）
- `ctx.workdshExperts.resolveNativeRole(...)` 解析该会话绑定的专家修订（:22）
- 校验 `role.binding.presetRevisionRef === header.agentPreset`（:35）
- 成员额外校验父会话与 cwd 一致、**成员与主任务同一主体/组织**（:36-40）
- 用 `agent.ctx.plugin(Persona, expertPersonaConfig(...))` 与 `agent.ctx.plugin(SkillFiles, skills)` 在 **Agent 局部 scope** 装配 persona 与技能目录（:52-57），并按 `compositionDigest` 幂等去重（:43,59）
- 注释明确：「**Asset admission and role composition only. No child driver, mailbox or Team state.**」（:11）

（c）**preset 编译（declarative presets）**：`src/runtime/preset-compiler.ts`
- `COMPILER_VERSION = 'workdsh-expert-compiler/0.4-declarative-presets'`（:14）
- presetId = `wd-exp-<kebab(expertId)>-<digest>`，digest 覆盖 `{compiler, base, definition, snapshotDirs, teamMembers}` ⇒ **同内容同 id，天然幂等**（:63-72）
- 预设目录落在 `$DSH_AGENTS_HOME/.workdsh-state/experts/presets/<presetId>`（:78-81）
- 编译时从**官方 Loader 的 profile 声明里取 base preset**（`ctx.loader.entries()` 找 `@deepseek-ai/dsh-agent-preset` 且 `config.id === basePresetId`），再就地替换 `@deepseek-ai/dsh-persona` 与 `@deepseek-ai/dsh-skill-filesystem` 两行 config、补 `@deepseek-ai/dsh-tool-skill`（:126-139）
- 原子发布：`mkdtemp` 暂存 → 写 `preset.json`（`flag:'wx'`）→ `rename` 到目标；`EEXIST/ENOTEMPTY` 时**不覆盖**，改为递归复验既有结果（:143-168）
- 防漂移：`registerExpertPreset()` 用 `sha256(text)` 与期望 digest 比对（:94-107）；`verifyPackageFiles()` 逐文件比对内容与可执行位、拒符号链接（:184-209）

（d）**人设注入点**：`expertPersonaConfig()`（:211-219）把 `team-lead.md`（团队时）+ 成员 JSON + 作者人设拼成 `prefix`，`compilePersonaSuffix(definition)` 做 `suffix`，并注入「专家作品资源目录：<packageRoot>」（:217），`{complete:false, includeRuntimeContext:true}`。
- 旧版团队工具会**被改写**而不会残留：`migrateLegacyTeamInstructions()` 把 `workdsh_expert_team_*` 映射到官方九工具文案（:20-33），`preset-compiler.ts:21-27` 逐条列出。

（e）**发布确认凭证（最可复用的授权模式）**：`src/runtime/confirmation.ts`
- 顶部注释即结论：「A model-supplied `confirmed:true`、一句重述或 prompt 文本**都不是授权**」（:5-14）
- 三段式：`request()` 生成绑定精确内容摘要的**短时 challenge**（TTL 5 分钟，:16；token = sha256(nonce∥definitionDigest∥dependencyLockDigest)，:100-102）→ `confirm(token, principalId)` 只由**可信 UI 动作**换出一次性 `ConfirmationProof`（:64-74）→ `consume(proof, check)` 在发布提交点**再校验主体/过期/内容摘要是否仍一致**，并标记 used 后删除（:80-98）；`safeEqual` 用 `timingSafeEqual`（:112-116）。

（f）**团队场景校验（只管指令、不管运行）**：`src/domain/team-workflow.ts:4-22` 校验阶段 id 合法且不重复、无循环依赖、`worker !== reviewer`（独立评审必须换人）、依赖不重复。注释：「**Validate authored instructions only; runtime tasks and transitions belong to DSH.**」（:3）

**⑤ 工程取舍 / 它说不做的事**
- **已退役自建专家团执行器**：`AGENTS.md`（`workdsh-web/AGENTS.md` 末段「2026-09-15 官方 Team 替换决定」）明令「**禁止恢复 TeamRunsManager、workdsh_expert_team_*、workdsh-expert provider 或新建等价运行表**」；`README.md:47-51` 复述；`preset-compiler.ts:20-33` 只保留文案迁移。反例清单本身就是「不该做什么」的现成教材。
- 「**任务标记完成不等于专业成果已经验收**」（`README.md:19`）。
- 官方 Team 仍是实验能力；`README.md:74` 记录一个上游可复现缺陷 `seeded session constructor seed must equal its inherited prefix`（fork 历史查询），默认用 fresh 成员。
- 企业远程多用户、完整热卸载未验收（`README.md:74`）。
- 团队运行状态机/邮箱/执行表**全部不建**（`execution-guard.ts:11`、`README.md:41`）。

**⑥ 可借鉴点**
- ★**发布确认凭证三段式**：任何「模型可提议、只有人能批准」的动作都该用「绑定内容摘要的短时 challenge + 一次性 proof + 提交点复验」。**落到控制台/治理线**，成本很低（116 行）。
- ★**不可变修订 + 内容摘要幂等**：`revisions` 表冻结 `definition/dependencyLock/preset/compositionDigest`；产物 id 由内容派生 ⇒ 重放安全、无需锁。**落到配方线**。
- ★**在官方生命周期钩子上做准入而不是自建执行器**：`agent/created` + `agent/pre-step` 双钩子 + Agent 局部 scope 装配 + digest 幂等。**落到配方线/技能线**，这是「怎么接官方 Team」的完整答案。
- **只读旧数据而不迁移**：`bindings.delegation` 保留读、新成员不再写（`storage/domain.ts:95-100`）——旧数据兼容的干净做法。
- **与我们的重叠**：`docs/plan/enterprise-presets.md`（93437 B）与 `docs/research/agent-preset-best-practices.md`（76306 B）已在做「打包并分发 Agent 配置」这条线，**语义高度重叠**；WorkDSH 的独有增量是「不可变修订 + 确认凭证 + 官方 Team 装配钩子」这三块工程实现。

---

### 2.3 Office 交付（`workdsh-plugin-office`）

**① 是什么 / 给谁用**
一句话：让 Agent 把成果写进**右侧实时工作副本**（Word/PPT/Excel/PDF/HTML/CSV），再经官方 present 卡交付真实文件；给要「对话直接产出可编辑文档」的用户。

**② 实现规模 · 测试**
- 关键源码：`src/content/service.ts` **805 行**、`src/live/model.ts` 603、`src/content/tools.ts` 438、`src/content/model.ts` 394、`src/live/Toolbar.tsx` 363、`src/live/adapter.ts` 338、`src/live/DocumentPage.tsx` 245、`src/client.tsx` 202、`src/live/docx.ts` 199、`src/live/import-docx.ts` 157、`src/content/connection.ts` 156、`src/content/export.ts` 113、`src/csv/CsvDocument.tsx` 111、`src/editor.ts` 101、`src/excel-adapter.js` 90、`src/OfficeDocument.tsx` 84、`src/content/authoring.ts` 35（内含 5 段超长 system prompt guide）、`src/content/service.ts` 等；另有 `src/pdf/fonts/NotoSansSC.ttf`（94296「行」= 二进制，无意义）与 20 个 `tiptap-ui/*` 图标组件。合计 5951 行。
- 依赖（`package.json:47-68`）：`@tiptap/* 3.31.0`（core/extension-image/extension-table/extension-text-align/extension-text-style/pm/starter-kit）、`@univerjs/preset-sheets-core 0.25.1`、`@univerjs/presets 0.25.1`、`docx-preview 0.4.0`、`exceljs 4.4.0`、`papaparse 5.7.0`、`pdf-lib 1.17.1`、`pdfjs-dist 5.4.624`、`pptx-react-viewer 3.16.5`、`pptx-viewer-core 3.14.3`；`README.md:141` 提到「完整 199 项打包依赖」。
- 测试：包内无；仓库层 `tests/integration/office-content.test.mjs` **889 行**、`office-download.test.mjs` 355、`office-csv-preview.test.mjs` 110、`office-rich-editor.test.mjs` 73、`office-import.test.mjs` 41、`office-input.test.mjs` 38、`office-html.test.mjs` 17、`office-pdf.test.mjs` 14、`ppt-style-preview.test.mjs` 37；探针 8 个（`probe-office-live.mjs` **62214 B**、`probe-office-native.mjs` 20161 B、`probe-office.mjs` 4792 B 等）。

**③ 数据与存储**
自建 Storage Domain `workdsh_office`，`version:1`，`layout:'per-record'`，单表 `documents`（`src/content/service.ts:150-155`）。记录 schema 的判别式约束：`kind==='document'?'blocks' in state : kind==='presentation'?'deck' in state : kind==='pdf'?'pages' in state : kind==='html'?'html' in state : 'sheets' in state`（:147-149）。每份文档带 `revision`（整数）、`lease{token,clientId,principalId,generation,expiresAt,appliedRevision}` 租约（:126-146）、`revision` 单调递增（提交时 `current.revision + 1`，:635）。
并发控制：`editHuman` 带 `{token,clientId}` 租约；`ensure(existing.revision===value.baseRevision, 'REVISION_CONFLICT')` 做乐观锁（:555,563）；lease 动作 `acquire|renew|release`（:683-703），并要求 `lease.generation === this.generation`（进程代次，:556,582-583）。
跨端共享：是，Host 服务 + Client 页面 + 工具共用；HTTP endpoint 枚举见 `src/content/connection.ts:11-42`（`open/read/pdfBytes/list/pending/edit/lease/ack`）。

**④ 与 Agent 的集成**
- **8 个工具**（注意 README 说「六个原生工具」，`README.md:20,83`，与代码不符）：
  `content_import_pptx`（:218）、`content_export`（:233）、`content_open`（:265）、`content_preview_styles`（:308）、`content_read`（:326）、`content_capabilities`（:343）、`content_edit`（:364）、`content_present`（:413）。启动时会先检查这 8 个名字未被注册（:203-211）。
- **system prompt 注入**：`registerAuthoringGuide()` 用 `ctx.systemPrompt.section({name:'workdsh:office-authoring', order: ctx.systemPrompt.getSectionOrder('TOOL_REPORT'), text: authoringGuide + htmlGuide + pdfGuide + presentationGuide? + spreadsheetGuide?})`（`src/content/authoring.ts:23-31`）。这是它「让模型自然用工具」的核心手段：`authoringGuide` 明确要求**先 `content_open` 再分批 `content_edit`**、禁止去写脚本/用 PptxGenJS/officecli、禁止把图表做成 PNG、禁止编造数据（`authoring.ts:5-13`）。
- **输入意图序列化**：`/office` 输出标签 + `@` 工作副本引用，由官方 reference chip 承载，提交时经原生 codec 序列化为模型可见 JSON（`README.md:71-79`）。文件导入走官方 `ctx.fs.readBytes`（`tools.ts:226-228`，8 MiB 上限）。
- **交付链复用官方策略**：`content_export` 明确「Uses official bash approval and requires bash/present in this Session」（:36），不接受本地 Office/服务器转换（`README.md:60`）。

**⑤ 工程取舍 / 它说不做的事**（README 的「当前限制」表最诚实，`README.md:110` 附近）
- 不开发画布与多维表格；停止新建候选展示（`README.md:1`）。
- `.csv` **只读**，不编辑不导出；超 1500 行/120 列/24000 单元格只显示前缀（`README.md:112`）。
- `.xlsx`：格式/合并/图表/实时 XLSX 导入未接入；含高级对象禁止导出。
- `.docx`：不是完整排版编辑器，页眉页脚/分页/复杂浮动/嵌套表格/单元格内图片未完成。
- 不支持旧 `.doc/.ppt/.xls`、密码文档；当前文件上限 10 MB（部分通道 8/30 MiB）。
- 导出是**浏览器下载副本**，未实现覆盖 Host 原件及冲突检测；切 Tab/刷新可能丢未导出内容。
- 「不使用服务端 Office 转换，不依赖本机 Office/LibreOffice，不向第三方上传文件」（`README.md:60`）。
- 许可缺项如实报告：「10 个依赖版本尚未收集到随包许可文本，`@univerjs/telemetry@0.25.1` 元数据未声明许可证」（`README.md:141-143`）。

**⑥ 可借鉴点**
- ★**「先开文档再写」的 system prompt 引导 + 分批提交**：把「产物先行、可见进度、批次有界」写成模型必须遵守的流程，而不是靠用户说清（`authoring.ts:5-13`）。**落到配方线/控制台**。
- ★**租约 + 乐观锁 + 进程代次（generation）三件套**：人类编辑拿 lease，AI 提交用 `baseRevision`，进程重启靠 `generation` 使旧 lease 失效（`service.ts:126-146,555-565,697-703`）。这是「人和 AI 同编一份文档」的最小正确解。
- ★**交付走官方 present/bash，不自己画成果卡**（`tools.ts:36`、`README.md:129`）。
- 反面：**8 个工具名 vs README「六个」**说明它的文档与代码有漂移，读它的文档要交叉验证代码。
- **与我们的重叠**：`docs/plan/library-port.md` 已覆盖资料库侧；Office 这条线我们没有对等物，属于**它的独有增量**，但依赖极重（见 §3.2）。

---

### 2.4 连接器 / MCP（`workdsh-plugin-connectors`）

**① 是什么 / 给谁用**
一句话：把 MCP server（stdio / Streamable HTTP）当「连接器」配置管理，并让**每个会话只能看到自己勾选的连接器工具**；给要接外部系统的用户。

**② 实现规模 · 测试**
- `src/manager.ts` **231 行**（全部逻辑）、`src/connection-api.ts` 46、`src/storage.ts` 40、`src/shared.ts` 54、`src/index.ts` 22、`src/example-server.mjs` 77（随包示例 MCP server）、`src/client/ConnectorPicker.tsx` 96、`src/client/ConnectorsPanel.tsx` 61、`src/client/management.ts` 36、`src/client/styles.ts` 24、`src/client.tsx` 28。合计 **715 行——是 12 个模块里最小的业务模块之一**。
- 测试：包内 0；靠 `scripts/probe-connectors.mjs` 7005 B + `scripts/probe-mcp-resources.mjs` 3158 B。

**③ 数据与存储**
两个独立 Storage Domain（`src/storage.ts`）：
- `workdsh_connectors` v1，`global {seededExample:boolean}` + 表 `definitions`（`connectorDefinitionSchema`：`id/title/description/serverName(正则 ^[A-Za-z0-9_-]{1,32}$)/transport:stdio|streamable-http/command?/args?/url?/authorizationCredentialRef?(正则 ^[A-Z_][A-Z0-9_]*$)/enabled/createdAt/updatedAt`，:4-17）
- `workdsh_connector_selections` v1，表 `selections`（`sessionId/connectorIds[](max 32)/updatedAt`，:21-25）

凭据**不进自建库**：只存 `authorizationCredentialRef` 名字，实际值写官方凭据服务 `ctx.credentials.set(...)`（`manager.ts:80,94`），命名规范 `WORKDSH_CONNECTOR_<SERVER>_AUTHORIZATION`（:209）；读回时只返回「是否已配置 / 是否可写」（:65-70）。

**④ 与 Agent 的集成**
- **不自建 MCP 传输**：直接 `this.ctx.plugin(McpClient, {serverName, transport, command/url, headers, failOnStartupError, toolCallTimeoutMs:10000, maxInstructionBytes:8192, reconnect:{enabled,initialDelayMs:250,maxDelayMs:5000,maxAttempts:4}})`（`manager.ts:151-152`），全部生命周期交给官方 `@deepseek-ai/dsh-mcp-client`（`manager.ts:6` 导入）。stdio 只传**显式空 env**（:149 `env: {}`）；HTTP 的 `Authorization` 在服务端由凭据层解析（:144-147）。
- **按会话收敛工具命名空间**：`agent/created` 时 `applyRestriction(agent)`（:52），用 `agent.ctx.tools.restrict({deny: <未选中连接器的 mcp__<server>__* 工具名>})`（:214-222）；选中变化后 `reapplyRestrictions()`（:84,99,107,118,223）。
- **健康检查是真的**：不只看配置，而是实际调 `list_mcp_resources` / `list_mcp_resource_templates`（若官方工具存在），失败才判 offline（:170-195）；注释明确「有不工作的资源端点不该让一个有工具可用的 server 被判 offline」（:182-183）。
- **示例 server 随包**，用官方 `@deepseek-ai/dsh-mcp-client@0.1.7-rc.2` 连本地子进程，暴露 `mcp__workdsh-example__connector_status` / `search_catalog` 与资源 `workdsh://connector/guide`、`workdsh://catalog/{id}`（`README.md:28`）。

**⑤ 工程取舍 / 它说不做的事**
- 「**MCP client 是一种执行适配**，复用官方 stdio/Streamable HTTP 生命周期、工具发现和重连」（`README.md:20`）。
- 「**专用 API 与 Web provider 不强制转换成 MCP**」（`README.md:20`）。
- 「成员使用权限不允许读取密钥；**禁止跨账号回退**」（`README.md:12`）。
- 未完成：交互式 OAuth、多账号身份切换、公共授权、安装目录、完整审计、写操作确认（`README.md:9,32`）。
- 已验证的亮点：腾讯文档令牌写入官方凭据后建立真实连接、**发现 224 个工具**、在只选该连接器的会话里完成账号文档查询（`README.md:8`）。

**⑥ 可借鉴点**
- ★**「薄封装 + 官方传输」的比率**：231 行拿到「多实例、凭据引用、健康检查、按会话隔离、增删改启停」。这直接回答「连接器内核该写多厚」——**我们的 `docs/plan/connector-architecture.md`（66915 B）若自建传输就是重复劳动**。
- ★**按会话 `tools.restrict(deny)` 收敛命名空间**：比读时过滤更硬，且用官方 API（`manager.ts:214-222`）。**落到连接器线**。
- ★**密钥只存引用名 + 命名规范 + 只回「已配置」**（:65-70,209）。**落到连接器线/治理线**。
- 短板提醒：它**没有做依赖审查/风险旗标**，市场/目录侧完全没有安全分级——这正是我们 `docs/research/jingyun-dsh-appstore.md` 里在市场线上要补的。

---

### 2.5 项目 / 工作区（`workdsh-plugin-projects`）

**① 是什么 / 给谁用**
一句话：把「指令 + 能力选择 + 计划 + 资产引用 + 原生任务」按项目聚合，并且**新任务固定引用创建时的配置修订**；给做长期目标/多人交付的用户。

**② 实现规模 · 测试**
`src/client.tsx` 148、`src/client/styles.ts` 131、`src/runtime/deliverable-attribution.ts` 150、`src/services/project-manager.ts` **仅 50 行（但每行都极长，是压缩式写法）**、`src/client/ProjectsPanel.tsx` 97、`src/client/management.ts` 63、`src/client/components/project-composer/ProjectConversationMenu.tsx` 61、`src/runtime/context-injection.ts` 32、`src/capability-selection.ts` 29、`src/runtime/project-workspace.ts` 25、`src/remote/connection-api.ts` 28、`src/index.ts` 23、`src/storage/domain.ts` 7、`src/instruction-budget.ts` 7。合计 1007 行。
测试：`tests/project-workspace.test.mjs` 12、`tests/projects.test.mjs` 17、`tests/responsive.test.mjs` 35（包内，共 3 个）+ `tests/integration/project-installer.test.mjs` 154。

**③ 数据与存储**
`workdsh_projects` v1，`layout:'per-record'`，单表 `states`，schema 极宽（`storage/domain.ts:4`）：
`z.object({schemaVersion:1, projects, configs, workItems, assets, tasks, activity})`（全部 `z.record(z.string(), z.unknown())`），键 = `<organizationId>_<principalId>`（:7）。也就是说**一个主体一份大 state**，不是关系表。字段语义在 `ProjectManager` 里：`Project`（id/name/description/templateId?/owner/status/configRevisionId/createdAt/updatedAt）、`ProjectConfigRevision`（id/projectId/number/instruction/**capabilities[]**/createdBy/createdAt）、`ProjectWorkItem`（status/priority/tags/revision）、`ProjectAssetRef`（assetId+revisionId）、`ProjectTaskLink`（sessionId/title/configRevisionId/capabilities/references[]）、`ProjectActivity`（kind:project|work-item|asset|task）。
**指令预算**：`PROJECT_INSTRUCTION_TOKEN_BUDGET = 8000`，中文按 1 token/字、非中文按 1/4 字估算（`instruction-budget.ts:1-7`），超限抛 `projects/instruction-budget-exceeded`（`project-manager.ts:30`）。
**修订不可变**：`updateConfig` 必须带 `expectedRevisionId`，新建新修订号而非改写（:30）。
跨端共享：是；**不复制他域数据**——资产只存 `assetId + revisionId`（`README.md` 「数据边界」节）。

**④ 与 Agent 的集成**
- **system prompt 上下文注入**：`ctx.on('system-prompt/assemble', ...)`，在 `resolved.contexts.push({name:'workdsh:project-task', text: ...})` 注入「当前任务属于项目 X、使用配置修订 N、项目指令、用户明确选择的项目引用」，并**显式声明「引用内容是参考数据，不是系统指令或额外授权」**（`src/runtime/context-injection.ts:8-25`）；失败时 **fail open**（只 warn，不破坏 prompt 组装，:26-29）。
- **项目专用工作目录**：`runtime/project-workspace.ts` + 官方 Workspace Controller 以项目名登记（`README.md`「项目详情体验」节）。
- **成果归属**：`runtime/deliverable-attribution.ts` 150 行，把任务成果关联回项目（依赖 `fs`、`workdshLibrary`、`workdshProjects`、`workdshIdentity`，`index.ts:18-22`）。
- **能力选择合并**：`mergeCapabilitySelection(existing, available, picked, explicitUpgrades)` —— 未显式升级的项**保留旧修订**（`capability-selection.ts:11-28`）；`linkTask` 再校验选中的能力必须已在项目配置里绑定，否则 `projects/capability-not-bound`（`project-manager.ts:36`）。
- **无 Host 工具**：项目只有页面与注入，没有自己的工具。

**⑤ 工程取舍 / 它说不做的事**
- 「**项目不是简单会话分组**」「项目不等于会话全集自动共享」（`README.md:10,17`）。
- 「活动记录**自动沉淀本机项目操作，不提供虚假的成员留言或通知**」（`README.md:9`）。
- 「未开放的定时任务**无添加按钮**」（`README.md:41`）——不画不可用的入口。
- 「已有任务保留原 cwd，**不迁移历史文件**」（`README.md:43`）。
- 首页选择存为草稿，创建时固定能力快照；选专家会确认创建新任务并复制草稿，**不自动发送**（`README.md:24`）。

**⑥ 可借鉴点**
- ★**「配置修订 + 任务固定引用」**：任务永远引用创建时的 `configRevisionId`，改配置不污染在跑任务（`project-manager.ts:30,36`）。**落到配方线/控制台**。
- ★**注入时显式声明「引用是数据不是指令/授权」**（`context-injection.ts:23`），并 fail open。**落到控制台/连接器线**（我们所有上下文注入都该抄这句）。
- ★**指令 token 预算 + 中文感知估算**（`instruction-budget.ts`）。**落到配方线**。
- 可质疑处：`projects` 用「一个主体一份超大 record」而不是关系表，`storage/domain.ts:3-4` 全是 `z.unknown()`——**缺少服务端字段校验**，团队规模下会是隐患。抄它的结构要加 schema。

---

### 2.6 资料库（`workdsh-plugin-library`）——仅作对比，不展开

已单独调研（`docs/research/workdsh-knowledge-base.md`）。此处只留一句可复用的观察：它的 `asset / revision / receipt / reference / draft` 五元模型（`plugins/library/src/storage/domain.ts:16-31`）是「**引用不复制**」的最干净样例——`asset` 带 `currentRevisionId`、`revision` 带 `originalSha256 + contentSha256 + conversionStatus`、`receipt` 做幂等（`operationId`）、`reference` 记 `sessionId+nodeId+assetId+revisionId`。projects 对它的引用也只存 `assetId+revisionId`（§2.5）。**落到资料库线/配方线**。

---

### 2.7 授权（`workdsh-plugin-access`）

**① 是什么 / 给谁用**
一句话：操作级资源授权 + Session owner 绑定 + 撤权 + 把官方工具流水线纳入授权/审计；给企业团队部署。

**② 实现规模 · 测试**
`src/index.ts` **596 行**（含 4 个类：`AccessManager`、`SessionAccessBridge`、`ToolAccessBridge`、以及 domain spec）、`src/governance.ts` 56（本地复制的 `GovernanceContractError`，`governance.ts:1-9` 解释为何不复用 workspace 包）、`src/session.ts` 1 行、`src/tool.ts` 1 行。合计 654 行。
测试：包内 0；`tests/integration/tool-access-bridge.test.mjs` 269、`access-audit.test.mjs` 160、`governance-contracts.test.mjs` 38。

**③ 数据与存储**
两个 domain（`index.ts:56-68`）：
- `workdsh_access` v1 表 `grants`：`AccessGrant{id, organizationId, subjectPrincipalId, resource{domain,id,revision?}, actions:['read'|'use'|'edit'|'manage'][], revision}`（:39-46）
- `workdsh_runtime_binding` v1 表 `sessions`：`SessionOwnerBinding{sessionId, organizationId, ownerPrincipalId, workspaceId?, revision}`（:48-54）
授权状态摘要 = sha256(membershipRevision ∥ 按 id 排序的 grant.id+grant.revision)（`authorizationRevision()`，:96-106）——**撤权即摘要变化**，可据此让在途请求失效。

**④ 与 Agent 的集成（三条官方钩子）**
`ToolAccessBridge`（:497-）：
- `ctx.on('tools/pre-execute', async (exec, next) => this.authorizeTool(exec, next))`（:510）→ 解析主体、确保 Session 有 owner（个人 Profile 允许首调自动绑定，`autoBindPersonalSessions`，:130,151-159）、`resolveRuntime` 通过则放行，否则 `{kind:'deny', reason:'WorkDSH denied this tool call (<code>)'}`（:145-172）
- `ctx.on('tools/result', (exec, result) => this.observeResult(...))`（:511-514）→ 按 `ABORTED` 区分 `cancelled/failed/succeeded`，串行追加审计（:175-188）
- `ctx.on('session/flush', ...)` + `ctx.effect`（:515-516）→ 排空
`SessionAccessBridge`（:394-）：
- `create()` 先生成 sessionId → `bindSession()` 持久绑定 owner → 再委托官方 `ctx.sessionController.create()`；显式 id 但无 owner 时先 `inspect()`，**存在即拒绝并写审计**（`access/unbound-session-adoption`，:475-483）
- `resolveAgent()` 先授权再 `sessionController.resolveAgent()`（:443-467）
- 自述「**它不会修改或包装官方服务，也不会在本版本声明为生成式 Remote**」（`README.md:26`）

**⑤ 工程取舍 / 它说不做的事**
- 「**页面过滤不构成授权**」「所有 allow/deny 均先写入 Audit」（`README.md:9`）。
- 「管理员不隐式读取个人内容」「跨组织默认拒绝」（`README.md:9`）。
- 边界：「成员使用权限不允许读取密钥」（连接器侧）。
- 未完成：企业外部 Session Remote、文件与其他 Remote 入口未接（`README.md:3`）。
- 企业组合必须关掉 `autoBindPersonalSessions` 并在受信创建入口显式 `bindSession()`（`README.md:19`）。

**⑥ 可借鉴点**
- ★**用官方 `tools/pre-execute` / `tools/result` / `session/flush` 三点接入治理**，而不是包一层工具执行器。**落到控制台/治理线**。
- ★**「默认拒绝 + 先审计后决策 + 摘要式授权版本」**：`authorizationRevision` 让撤权可判定（:96-106）。**落到治理线**。
- ★**无 owner 的既有 Session 拒绝收养**（:475-483）——多主体下的关键负例。**落到治理线**。
- **与我们的重叠**：`docs/owndsh-governance-mvp-design.md`（115311 B，含「§6 身份、平台会话与设备 / §7 固定 RBAC / §13 审计 / §16 Harness 插件详细设计」）与 `t04-identity-adapter-acceptance.md`、`t19-audit-closure-acceptance.md`、`t20-security-fault-acceptance.md` 已在做同一条线。**WorkDSH 的独有增量 = 「不改官方服务、只用官方三钩子接入」的具体接法 + 摘要式授权版本。**

---

### 2.8 审计（`workdsh-plugin-audit`）

**① 是什么 / 给谁用**：不可变、可排空的审计事件日志；给企业合规。
**② 规模 · 测试**：`src/index.ts` **98 行** + `src/governance.ts` 15。测试并入 access 的集成测试。
**③ 存储**：`workdsh_audit` v1，表 `events`，`AuditEvent{id, occurredAt, requestId, principalId, organizationId, action, target{domain,id,revision?}?, outcome:'succeeded'|'denied'|'failed'|'cancelled'|'unknown', code, sessionId?, runId?, references?}`（`index.ts:9-29`）。
**④ 与 Agent 集成**：无自有工具；被 `ToolAccessBridge` 与 `SessionAccessBridge` 注入调用（`access/src/index.ts:109`）。`flush()` 供 Session durability checkpoint 与卸载等待（`audit/index.ts:67`、`README.md:16`）。
**⑤ 取舍**：**拒绝敏感引用键**——`/(credential|password|prompt|secret|token)/i` 命中即抛 `audit/sensitive-reference`（:37,44-47）；拒绝重复事件 id（:75）；引用长度/控制字符校验（:48-50）；「**不记录明文凭据和默认完整提示词**」（`README.md:9`）。
**⑥ 借鉴**：★**写入即校验 + 敏感键黑名单 + 序列化 append tail**（98 行做到「不可变 + 可排空」）。**落到治理线**。

---

### 2.9 本地身份（`workdsh-provider-identity-local`）

**① 是什么 / 给谁用**：可信单用户 Profile 的身份/个人组织/owner 成员关系提供方；给本地部署做主体来源。
**② 规模 · 测试**：`src/index.ts` **213 行** + `src/governance.ts` 39。测试 `tests/integration/local-identity.test.mjs` 34、`local-identity-storage.test.mjs` 82。
**③ 存储**：`workdsh_identity_local` v1，**无表、只有一个 global 记录**，schema 是 `z.discriminatedUnion('initialized', [uninitializedState, initializedState])`（`index.ts:57-65`）；`initializedState` 含 `providerId/principalId/organization{id,kind:'personal',name,revision}/membership{organizationId,principalId,principalKind:'human',role:'owner',state:'active',revision}`（:35-53）——**「三个相互关联的对象放进同一原子 global 记录」**（`README.md:16`）。
**④ 与 Agent 集成**：无工具无页面；`ctx.provide` 出 `workdshIdentity`（:111-115），被 access/experts/office/library/projects 消费。`resolve(evidence)` 只接受 `sessionId/runId` 作为**可信 Host 关联**，注释两处强调「never selects the principal or organization」（:27-31）。
**⑤ 取舍**：★**配置与持久记录必须一致**：启动时若 Host 配置与已存 profile 不符即抛 `identity-local/config-conflict`（:182-190），防止同一数据目录被静默切成另一主体；**不复用官方匿名安装 ID 当用户身份**（`README.md:20`）；「**无免鉴权远程部署模式**」（`README.md:9`）。
**⑥ 借鉴**：★**单原子 global 记录 + 启动期一致性断言**。**落到治理线**。

---

### 2.10 活动条（`workdsh-plugin-activity`）

**① 是什么 / 给谁用**：会话顶部一行「活动/协作状态」，按需展开成员；给用户一眼看「在跑什么」。
**② 规模 · 测试**：`src/projection.ts` 52、`src/team-status.ts` 44、`src/styles.ts` 39、`src/registry.ts` 16、`src/client.tsx` 10、`src/index.ts` **3（Host 空实现）**。合计 280 行。测试 `tests/projection.test.mjs` 116 行。
**③ 存储**：**无**。「No network, execution or persisted state.」（`projection.ts:6`）
**④ 与 Agent 集成**：★**纯事件投影**——`projectActivity(entries, running)` 折叠**结构化事件**（不读推理散文），消费的事件类型：`turn/start`、`tool/call`、`tool/result`、`subagent/catalog`、`deliverables/presented`、`turn/end`、`assistant/live-chunk`、`assistant/message`（`projection.ts:14-36`）。阶段机 `idle|working|waiting|completed|interrupted|failed`，`tool/call` 为 `ask_user_question` 时转 `waiting`（:19），Host running 状态**覆盖旧终态**（:38-40）。另有 `summarizeTeamActivity()` 只投影官方 Team 视图事实，注释「**never infer work from model prose**」（`team-status.ts:14-43`）。
**⑤ 取舍**：Host 侧零实现（`index.ts:1-3`）；偏好按浏览器保存；系统 `prefers-reduced-motion` 始终生效；「**未运行成员不显示假进度**」「尚未核实交接事件，**不展示虚构的交接光点**」（`README.md:11,17`）。
**⑥ 借鉴**：★**「只折叠结构化事件、绝不猜模型散文」的活动状态机**，而且 Host 侧 0 行、纯 client。**落到控制台**，成本极低。

---

### 2.11 组合包（`workdsh-bundle`）— 品牌 / 市场桥 / Agent 浏览器 / 诊断

**① 是什么 / 给谁用**：把导航、品牌、市场入口、浏览器页与诊断页装进官方 UI；给最终用户入口。
**② 规模 · 测试**：`src/browser-view.ts` 151、`src/client/harness/client.ts` 129、`src/client/components/AgentBrowserPage.tsx` 105、`DiagnosticsPanel.tsx` 54、`CommunityMarket.tsx` 61、`NavigationLocation.tsx` 47、`probe.ts` 24、`Brand.tsx` 14、`ShellAppearance.tsx` 11。合计 858 行（含 3 个测试 254 行）。`cordis.patch.yml` 25 行。CHANGELOG **203 行**（信息量很大，是它的「迭代日志」）。
**③ 存储**：无自有存储。
**④ 与 Agent 集成**：
- `probe.ts:15-19` 注入 system prompt 段 `workdsh:browser-in-sidebar`，指示「网站/页面操作用 Playwright MCP 工具，它们在右栏可见可操作；不要另开系统浏览器」。
- `client.tsx:35-43` `ctx.inject(['market'], ...)` 把**第三方 dsh-market 插件的 `market` 服务**渲染成「发现社区插件」卡片（`CommunityMarket.tsx:49-60`，`MarketHost{version,render,setSettingsVisible}`），并临时隐藏市场自己的设置入口（`client.tsx:37-38`）。
- `client.tsx:59-66` 探测 `/api/workdsh-browser-session` 是否 404 决定是否注册**旧版** Playwright 浏览器 Tab——「Desktop provider owns a different Session page」（:57-58）。
- `client.tsx:111-125` 诊断页调官方 `ctx.remote.pluginInventory.list()`，只列 `workdsh-` 前缀模块与其 `fiberPhase`（:117-119）——**不造假业务响应**（`bundle/README.md:29`）。
- `cordis.patch.yml` 装配的官方能力：`dsh-computer-use`、`dsh-experimental-computer-use-cua-driver-native`、`dsh-browser-use`、`dsh-experimental-browser-use-playwright-mcp`（按 `DSH_ELECTRON_EXECUTABLE` 条件禁用并配 `mode:launch, headless:true`）、`workdsh-provider-browser-session`（无 Electron 时禁用）、`dsh-experimental-auto-review`，并把 `ui-sidebar-browser` 置 `disabled:false`。
**⑤ 取舍**：`bundle/README.md:20-27` 明确「**不实现 Agent loop 或私有启动器**」；品牌与导航只做增量；「可选功能接入通过公开契约与生命周期注入」；Skill 已拆为独立包，bundle 不再导入其初始化函数。
**⑥ 借鉴**：★**「把第三方市场插件当 service 嵌入自己的页面」的桥接法**（`ctx.inject(['market'])` + 版本校验 + 收回设置可见性）——比自己实现市场便宜得多，但要接受耦合。★**条件装配**（`disabled: !!js`）按环境开关插件。**落到控制台/市场线**。

---

### 2.12 工作台导航（`workdsh-plugin-workbench`）

**① 是什么 / 给谁用**：侧栏业务导航 + 输入框执行提示条；给最终用户。
**② 规模**：`src/client/components/BusinessPanel.tsx` 47、`TaskExecutionNotice.tsx` 30、`src/harness/client.ts` 29、`src/index.ts` 1。合计 115 行，**无测试**，**无 `dsh.bundle`**（README:9 自述「尚无独立安装层，不宣称已独立分发」）。
**③/④**：无存储、无工具、无 Host 服务；纯 `ctx.slots.inject`。
**⑤ 取舍**：★**`pending` 纪律**：`businessPanels` 五项里「助理 / 定时任务 / 更多」标 `pending:true`，`apply()` 里 `if (panel.pending) continue`（`BusinessPanel.tsx:16-22`、`harness/client.ts:20`）——**规划中的功能不注册侧栏入口、也不注册占位页**，注释写得非常直白（`BusinessPanel.tsx:12-13`、`harness/client.ts:9-12`）。「工作区、会话、新会话、搜索、筛选、创建工作区、工作区菜单、会话菜单和设置**全部保留 Harness 官方 Sidebar occupant**，WorkDSH 不替换整块 sidebar」（`README.md:5`）。
**⑥ 借鉴**：★★**「不替换官方 sidebar，只 `sidebar.panellist` 增量；未实现的功能连占位页都不注册」**——这条纪律可以直接抄进我们的控制台规则。**落到控制台**。

---

### 2.13 受管浏览器会话（`providers/browser-session`）

**① 是什么 / 给谁用**：让官方 Playwright MCP 工具和右栏操作**同一个**受管 Chromium；给「看 Agent 在网页上做什么」的用户。
**② 规模 · 测试**：`src/index.ts` 222、`src/managed-electron.ts` 97、`src/client/BrowserSessionPane.tsx` 89、`src/remote.ts` 81、`src/client.tsx` 65、`src/managed-chromium.ts` 63、`src/client/api.ts` 29、`src/client/styles.ts` 16。合计 804 行。测试 `tests/session-provider.test.mjs` 112、`tests/managed-chromium.test.mjs` 30。
**③ 存储**：无持久数据。每 Session 一个**临时 Chromium profile + 随机本机 CDP 端点**（`README.md:7`）；清理归官方 `SessionResources`（`index.ts:8,72-73`）。
**④ 与 Agent 集成**：★**复用官方三层**：`@deepseek-ai/dsh-experimental-browser-use-runtime` 的 `SessionResources` 做串行队列与释放（`index.ts:83`）、官方 `McpClient` 连 `@playwright/mcp`（:68, MCP_NAME=`workdsh-playwright`，:59）、官方 `sidebar.right.pane.tab` 注册 client 页（`client.tsx:37-38`）。Host 内部服务 `ctx.provide('workdshBrowserSession', {available,active,capture,click,type,press,scroll,navigate})`（:101-120+）。Remote 路由 `/api/workdsh-browser-session` 只对**当前个人本机身份**开放，按 Session ID 再解析实时 Agent，失效 Session 与非个人身份被拒（`README.md:13`、`src/remote.ts:9`）。**原始 CDP 端点只留在 Host**（`README.md:13`）。
**⑤ 取舍**：README 非常诚实：「组件已构建，但**尚未装入默认 bundle**，也未做浏览器实机视觉/交互验收」「**现阶段不得将其描述为已完成的浏览器侧栏体验**」（`README.md:15`）；「该规则只覆盖个人本机部署，**团队身份还没有会话归属授权，不能启用同一路由**」（`README.md:13`）；「用户明确要求 Desktop 不额外打包浏览器」（:15）——Desktop 复用 Electron 自带 Chromium（`managed-electron.ts`）。
**⑥ 借鉴**：★**「Electron 自带 Chromium 当 Agent 浏览器」+ 只暴露 JPEG 帧与控制动词、CDP 端点不出 Host**（`index.ts:77-99`、`workdsh-main.ts:69-95`）。**落到桌面/跨平台 + 连接器线**。

---

### 2.14 骨架模块群（11 个）——一句带过

全部只有 README + `.gitkeep`，代码 0 行，无 `package.json`、无入口、无假工具。它们唯一的价值是**负面清单与纪律**：

- `plugins/admin`（P1/P3）：组织/成员/分发/连接/模型政策/审计界面；「**不另建特权绕过通道**」（`README.md:7`）。
- `plugins/applications`（P1）：行业应用；「**应用不等于 Profile**，不改已有任务绑定」（:7）。
- `plugins/automations`（P2）：周期任务/时区/去重/取消/运行历史；边界写得最细——「官方 Job 是进程内活跃运行表，Webhook 是**无队列、重试、去重、完成状态和崩溃重放的 fire-and-forget runtime**，二者都不替代本插件的 AutomationRule、Delivery、Occurrence 与 AutomationRun」（:7）；「HTTP 202 只表示接收，不表示自动化成功」（:19）。
- `plugins/identity`（P0/P1）：「身份由服务端建立，**不信任模型或客户端自报身份**」（:7）。
- `plugins/model-policy`（P1/P3）：「**不重写官方 LLM 路由**；策略未执行不得宣称受管」（:7）。
- `plugins/pages`（P3）：与 Office 分工明确——「Office 拥有 HTML 源码编辑/隔离预览/导出，本插件拥有业务数据绑定/审阅/发布/撤销；HTML 导出不等于发布」（:9-11）。
- `plugins/tables`（P3）：「**CSV 文件不冒充事务数据库**」；与 Office 分工「显式导入副本须新建 ID 并记录来源，**不能声称实时双向同步**」（:7,11）。
- `plugins/usage`（P1/P3）：「**缺指标不是零**，不重复消费重放事件」（:7）。
- `providers/identity-oidc`（P3）：「**不能仅解码未验证 token**」（:7）。
- `providers/library-team`（P3）：「保持资产契约；**不直接访问本地插件数据表**」（:7）。
- `providers/runtime-isolated`（P3）：「**无隔离不开放团队执行**」（:7）。

---

### 2.15 桌面壳 / 跨平台（`dsh-plugin-desktop` + 上游 patch）

**① 是什么 / 给谁用**
一句话：一个「**极薄 Electron carrier + 打包内固定版本 DSH Profile + 打包内 Node/Python**」，让普通用户下载即用；给不想装 Node 的最终用户。

**② 实现规模 · 测试**
- 应用源码只有 **2 个文件**：`src/workdsh-main.ts` **245 行**、`src/runtime-compatibility.ts` 70 行。（`architecture.md:5`「`dsh-plugin-desktop/src/workdsh-main.ts` 是安装包唯一的应用入口」）
- 构建/打包脚本很厚：`scripts/build-windows-nsis-ab.ts` 433、`scripts/run-windows-nsis-ab.ps1` 1338、`scripts/release-preflight.ts` 249、`scripts/prepare-workdsh-runtime.mjs` **342**、`scripts/verify-electron-fuses.ts` 371、`scripts/generate-windows-app-icon.mjs` 215、`scripts/package-win.ts` 187、`scripts/inspect-windows-installed-app.ts` 204、`scripts/verify-mac-smoke.ts` 197、`scripts/package-mac.ts` 162 等。
- 测试：**14 个 vitest spec**（`tests/*.spec.ts`），较重的有 `windows-nsis-ab.spec.ts` 572、`verify-electron-fuses.spec.ts` 280、`verify-mac-release.spec.ts` 96、`verify-mac-smoke.spec.ts` 201、`release-preflight.spec.ts` 168、`package-win.spec.ts` 176、`package-mac.spec.ts` 169、`release-mac.spec.ts` 163、`runtime-compatibility.spec.ts` 106、`package-dir.spec.ts` 72、`verify-win-installer.spec.ts` 89、`verify-win-portable.spec.ts` 61、`verify-workdsh-carrier.spec.ts` 11。
- 工具链：`tsdown 0.22.2` 打包 + `electron 43.3.0` + `electron-builder 26.15.7` + `vitest 4.1.8` + `@electron/fuses 1.8.0` + `sharp 0.35.3`（`package.json:50-61`）。桌面版本 `2.0.6-alpha.1`（`package.json:3`）。

**③ 桌面壳特有能力的逐项核查**（有就给 `file:line`，没有就明说「无」）

| 能力 | 结论 | 证据 |
| --- | --- | --- |
| 托盘 Tray | **无实现**（只有图标生成脚本，无 `new Tray`） | 仓库内 `Tray` 仅出现在 `package.json:20-21,92-93,102-103,130-133,165-168` 与 `scripts/generate-tray-icons.mjs:1,10,16,20-25`；`architecture.md:16`「当前外壳**没有旧版的托盘**、模式切换、多 Profile 选择或自动更新管理器」；`plugin-development.md:9`「旧 `desktopProfiles`、`desktopPnpm`、窗口模式与**托盘 service 已随未发布的旧 Host/Client 实现移除**」 |
| 全局快捷键 / 菜单 | **无**（carrier 无 `Menu`/`globalShortcut`） | `src/workdsh-main.ts` 全文无 `Menu`/`globalShortcut` |
| 自动更新器 | **无**（carrier 无 updater；`electron-updater` 不在依赖里） | `package.json:50-61` 无 updater 依赖；`why-desktop.md:7`「托盘、自动更新、多 Profile 选择……**不应误写成已交付能力**」 |
| 文件关联 / 自定义协议 | **carrier 无**；**上游 patch 版有 `dsh-app:` 协议** | carrier：`dsh-plugin-desktop/package.json` 无 `protocols`/`fileAssociations`；patch 版 `workdsh-web/scripts/desktop/patches/upstream/apps/desktop/src/main.ts:23,30-40,228-235`（`protocol.registerSchemesAsPrivileged` + `protocol.handle`，`shell`/`app` 两个 hostname） |
| 单实例锁 | **有** | `src/workdsh-main.ts:216-223`（`requestSingleInstanceLock` + `second-instance` 恢复最小化/聚焦） |
| 窗口状态持久化 | **无** | 窗口固定 `1440x960, min 960x640`（`workdsh-main.ts:136-139`），无存取逻辑 |
| 原生目录选择器 | **carrier 无**（由官方 DSH 插件提供） | carrier 全文无 `dialog` |
| 复用 Electron Chromium 作 Agent 浏览器 | **有（开发态已验证，安装包未验证）** | `workdsh-main.ts:57-95`（`--workdsh-browser-worker-port/profile` → 隐藏窗口 + `offscreen:true` + `remote-debugging-port`），`startRuntime()` 注入 `DSH_ELECTRON_EXECUTABLE: process.execPath`（:174）；验收状态见 `providers/browser-session/README.md:15` |
| 打包内 Node/Python 运行时 | **有（Node 确定，Python 见下）** | `workdsh-main.ts:39-55,166-167`（`primary-runtime/dependencies/node/bin/node`）；`README.md:69`「Desktop installers include Node.js and Python runtimes by default」；`package.json:173-183` `extraResources` 打包 `primary-runtime/**`；Python 的具体打包脚本未在 carrier 内取到（可能在 `scripts/prepare-workdsh-primary-runtime.mjs` 68 行里，未逐行展开） |
| 安全设置 | **有且严格** | `contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`、`webSecurity:true`（`workdsh-main.ts:145-149`；worker 窗口另加 `offscreen/backgroundThrottling` :79-86）；`setWindowOpenHandler` 全 deny 且 http(s) 交系统浏览器（:155-158, 88）；`page-title-updated` 强制标题（:151-154） |
| macOS / Windows 打包签名 | **有完整流水线** | `package.json:63-183`（`appId: io.techflag.dsh.ssh`、`asar smartUnpack`、`electronFuses{enableEmbeddedAsarIntegrityValidation, onlyLoadAppFromAsar, resetAdHocDarwinSignature, runAsNode}`、`afterPack: verify-workdsh-carrier.ts`、`afterAllArtifactBuild: verify-electron-fuses.ts`、mac `hardenedRuntime:true + notarize:true`、win `nsis` oneClick:false）、`scripts/package-mac.ts` 162、`scripts/package-win.ts` 187、`scripts/verify-mac-release.ts` 124 |

**④ `runtime-compatibility.ts` 与 `workdsh-main.ts` 主流程**
- `runtime-compatibility.ts`：把随包发行的**精确版本豁免（exact-version grants）**合并进用户的 `compatibility.json`，规则是 —— ①按 `runtimeVersion` 做一次性标记，**同版本重启不重复授予**（:45）；②用 `.workdsh-desktop-bundled-grants.json` 记住「上次随包授予了什么」，**用户已撤销的项不再重新授予**（:58-66）；③用户文件损坏时**只警告不动它**，交给 DSH 自己报（:54-57）；④写入用 `mode 0o600` + 临时文件 + `rename`（:27-35）；⑤键与版本用两个正则严格校验（:8-9,18-19）。
- `workdsh-main.ts` 主流程（按行）：
  - `materializeRuntimeProfile(home)`（:97-132）：把 `resources/workdsh-runtime/profiles/workdsh` 复制到 `<userData>/dsh-home/profiles/workdsh`，**`node_modules` 用 symlink/junction 指回包内**（:126-128）；版本标记 = `bundle.version + '+dsh-' + dsh.version`（:108）；若目标已有**非符号链接**的 node_modules，**报错并让用户手动移走**而不是删（:115-125）；迁移后调 `syncBundledCompatibility`（:129）。
  - `startRuntime(home, profileDir)`（:163-203）：用**包内 Node** 跑 Profile 内 CLI `@deepseek-ai/dsh/lib/bin.js --profile workdsh --no-open`（:164-168），env 注入 `DSH_HOME` / `DSH_AGENTS_HOME=<home>/agents` / `DSH_BUNDLED_PRIMARY_RUNTIME` / `DSH_ELECTRON_EXECUTABLE`（:171-174），并把 `ELECTRON_RUN_AS_NODE` 显式置空（:175）。
  - 就绪探测：正则 `READY_PATTERN = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+\/?\?token=[^\s]+)/` 从子进程输出里抓本机 token URL（:21,187-192,159）。
  - 生命周期：`before-quit` 停子进程（:224,205-209）；子进程非 0 退出即 `app.quit()`（:199-202）；macOS `activate` 时**relaunch 而不是复用**（:228-234，注释说明「healthy runtime always owns a window」）。
  - 双模式：`browserWorkerRequest()` 命中参数时**同一入口变成浏览器 worker**（:211-213,57-95）。

**⑤ 与上游交互 / patch 边界**
- carrier **不直接依赖 DSH npm 包**，`app.asar` 只含 Electron 入口（`architecture.md:20`；`desktop-boundaries.md:3-8`）。
- Profile 选择并直接依赖**恰好五个** WorkDSH 产品包（experts/skills/connectors/library/projects），支撑包作为可选运行时依赖，**不成为可独立管理的产品插件**（`desktop-boundaries.md:28-35`）；清单由 `dsh-plugin-desktop/scripts/workdsh-package-boundary.mjs`（24 行）共享。
- `prepare-workdsh-runtime.mjs`：`profileLayout = 'five-product-plugins-skillhub-dshmarket-v1'`（:18），钉死 `@cocofhu/skillhub@0.2.16`（:19-20）与 `dshmarket@1.66.1`（:21-22），用 pnpm `add --save-exact` 装进 Profile（:201），把两者写入 `dsh.profile.bundles`（:206-208），并用 `dsh --dump-config` 输出里必须出现 `id: skillhub` 来断言装配成功（:217）。
- 另一条**独立**的桌面线（与 carrier 不同）：`workdsh-web/scripts/desktop/` 基于**官方 `apps/desktop` 的隔离快照**（tag `dsh-v0.1.5-rc.1`）打 `WORKDSH TEST PATCH`，产出**未签名 macOS arm64 本地测试版**（`workdsh-web/scripts/desktop/README.md:1-13`）；补丁存档 9 个文件（`:20-21`），`pack-desktop.mjs` 每次运行逐文件 SHA-256 比对防漂移（:1-13）。patch 版的上游 main.ts 具备 carrier 没有的：`dsh-app:` 协议、`Menu.setApplicationMenu`、原生 `dialog`、`DesktopUpdateCoordinator`、插件安装/卸载 IPC（`pluginsList/Add/Remove/Update`，main.ts:249-268）、独立 `pluginWindow`、IPC 发送者来源校验（:108-115）。**这套 patch 属测试打包，不是发行路径。**
- `upstream.json` + 对齐脚本：`scripts/verify-desktop-dsh-alignment.mjs`、`scripts/verify-web-desktop-dsh-alignment.mjs`、`scripts/verify-layout.mjs`、`scripts/check-local-web-plan.mjs`（`package.json` 根 `check` 串联）。

**⑥ 明确「不做」/已知缺陷**
- `architecture.md:16-18`：**没有托盘、模式切换、多 Profile 选择、自动更新管理器**；「市场与 Fabric 目前只保留设计文档，不随安装包运行」。
- `why-desktop.md:7`：托盘/自动更新/多 Profile/社区市场/手机远程**不得写成已交付**。
- `desktop-boundaries.md:43-55`：插件管理器会列出 WorkDSH 支撑包（因为 manifest 是 `private`），Profile 布局把它们移出两个 inventory 输入；**安装态验收仍需在真机跑 `listBundles()` 与各功能流程**。
- `README.md`（desktop）：升级 DSH 要「同时更新 submodule pin 与 runtime 准备版本」；「pre-release 需明确产品决策」。
- macOS DMG **未签名**（`workdsh-web/README.md:20`）。

**⑦ 对我们的可借鉴点**（基于实际代码）
- ★★**「薄 carrier + symlink 复用包内 node_modules + 版本标记」的 profile 物化法**（`workdsh-main.ts:97-132`）：不复制依赖树、不产生第二个 DSH 依赖树，版本变了才重建，遇到用户手改的目录**报错而不是删**。**落到桌面/跨平台**。
- ★★**「就绪靠 stdout 正则抓 token URL」**（:21,187-192）：不做健康检查端口、不写自定义协议，最少接口。
- ★**兼容性豁免的「只授予一次 + 尊重用户撤销」语义**（`runtime-compatibility.ts:45,58-66`）——这是升级机制里最容易做错的地方。**落到桌面/跨平台**。
- ★**Electron 复用为浏览器 worker**（:57-95）——见 §2.13。
- ★**electron fuses + afterPack/afterAllArtifactBuild 断言**（`package.json:70-80`）+ 14 个打包 spec：把「安装包必须满足的结构」变成 CI 断言。**落到桌面/跨平台**。
- ★（设计笔记，源码已删）`.agents/notes/` 里 **57 篇**笔记中有一整代「高级桌面壳」设计：托盘模式切换（`2026-08-15-desktop-advanced-shell.zh.md`）、更新生命周期所有权（`2026-08-19-desktop-update-lifecycle-ownership.zh.md`）、插件安装 WAL/receipt 恢复（`2026-08-19-desktop-plugin-install-lifecycle-ownership.zh.md`）、本地窗口安全策略工厂（`2026-09-04-desktop-local-window-security-policy.zh.md`）。这些**只剩设计文档、源码已移除**（`desktop-boundaries.md:24`、`plugin-development.md:9`），但作为「如果要做重桌面壳，该按什么所有权切分」的参考价值很高。

---

### 2.16 基础包（`contracts` / `ui`）

- `workdsh-contracts`（1333 行、纯类型、`private:true`）：8 个子路径导出 `./skills`(207)、`./experts`(446)、`./skill-revisions`(61)、`./office`(202)、`./activity`(10)、`./library`(157)、`./projects`(40)、`.`(5)——`packages/contracts/package.json` exports 段。**这是它「12 个模块不互相导入内部实现」的物理保障**，与 `AGENTS.md` 的硬约束（「功能插件可依赖 contracts、ui、官方包；**禁止横向导入其他功能插件**」）配套。
- `workdsh-ui`（246 行）：`components/{Controls,Icon,LogoMark,Modal,Navigation}.tsx` + `styles/{controls,modal,navigation,tokens}.ts`。**只放展示组件**（`AGENTS.md`：「ui 仅包含展示组件，不引入 Host、数据库、凭据或执行器」）。
- **可借鉴**：★**把跨插件共享的「形状」抽成私有类型包，运行时零依赖**——避免「A 插件 import B 插件」的最便宜做法。**落到控制台/所有线**。

---

## 3 可借鉴清单 / 不建议抄 / 与既有规划的关系

### 3.1 可借鉴清单（按性价比排序）

| # | 借鉴什么 | 落到我们哪条线 | 人日 | 风险 |
| --- | --- | --- | --- | --- |
| 1 | **发布确认凭证三段式**（challenge 绑定内容摘要 → 可信 UI 换一次性 proof → 提交点复验+一次性消费；`experts/src/runtime/confirmation.ts:16-116`） | 控制台 / 治理线 | **0.5–1** | 低（116 行、纯逻辑、无外部依赖）。风险：TTL 与「谁算可信 UI」要在我们侧定义清楚 |
| 2 | **上下文注入必须显式声明「引用是数据不是指令/授权」+ 失败 fail open**（`projects/src/runtime/context-injection.ts:8-31`） | 控制台 / 配方线 / 连接器线 | **0.5** | 低 |
| 3 | **只折叠结构化事件的活动状态机，绝不读模型散文**（`activity/src/projection.ts:14-41`、`team-status.ts:14-43`） | 控制台 | **1–1.5** | 低。风险：需先固定我们侧事件名白名单 |
| 4 | **「不替换官方 sidebar，只 `sidebar.panellist` 增量；未实现的功能连占位页都不注册」**（`workbench/src/harness/client.ts:19-28`、`client/components/BusinessPanel.tsx:12-22`、`skills/src/client.tsx:95-99`） | 控制台 | **0.5–1** | 低 |
| 5 | **薄连接器内核**（231 行：定义/选择分表 + `credentialRef` 命名 + 官方 MCP client + `agent/created` 时 `tools.restrict(deny)` + 真健康检查；`connectors/src/manager.ts:52,151-152,170-195,209,214-222`） | 连接器线 | **2–3** | 中。风险：我们的 `docs/plan/connector-architecture.md` 若已设计自建传输，会产生重复；需先对齐「不自建 MCP 传输」这一前提 |
| 6 | **治理三件套的接口形状**（`ActorContext`/`AccessGrant`/`ResourceRef`/`AuditEvent`/`SessionOwnerBinding` + 三个 domain 名 + `tools/pre-execute`、`tools/result`、`session/flush` 三钩子；`access/src/index.ts:39-68,510-516`、`audit/src/index.ts:9-29`、`identity-local/src/index.ts:35-65`） | 治理线 / 控制台 | **3–5** | 中。风险：与我们既有 `owndsh-governance-mvp-design.md`（服务端 RBAC/审计/配额）**语义重叠但不完全同层**——它的主体来自 Host 配置，我们的来自服务端登录；需要先定「主体由谁建立」 |
| 7 | **不可变修订 + 内容摘要幂等产物 id**（`revisions` 六字段 + `presetIdFor` 内容派生 id + `rename` 原子发布 + `EEXIST` 时复验而非覆盖；`experts/src/runtime/preset-compiler.ts:63-72,94-107,143-168`） | 配方线 | **2–3** | 中。风险：依赖官方 `agentPresets.register()` 与我们预设装载方式的兼容性 |
| 8 | **桌面壳「薄 carrier」三件套**：profile 物化用 symlink + 版本标记、就绪靠 stdout 正则抓 token URL、单实例 + 外链委托 + 安全默认（`dsh-plugin-desktop/src/workdsh-main.ts:21,97-132,134-161,163-203,216-223`） | 桌面 / 跨平台 | **2–3** | 中。风险：我们若已有桌面方案（`docs/desktop-client.md`、`docs/desktop-2.0.3-harness-rc2-migration.md`）需先比对，避免二次实现 |
| 9 | **兼容性豁免「只授予一次 + 尊重用户撤销 + 损坏文件不动」**（`dsh-plugin-desktop/src/runtime-compatibility.ts:45,54-66`） | 桌面 / 跨平台 | **0.5–1** | 低 |
| 10 | **Electron 复用为 Agent 浏览器 worker**（隐藏 offscreen 窗口 + 随机 CDP 端口 + 只暴露 JPEG/控制动词，CDP 不出 Host；`workdsh-main.ts:57-95`、`providers/browser-session/src/index.ts:59,77-120`） | 桌面 / 跨平台 + 连接器线 | **2–4** | 中高。风险：打包态 Windows/macOS worker 启动未验收（`providers/browser-session/README.md:15`）；团队身份下会话归属授权未解决 |
| 11 | **Skill 目录「纯数据 + 惰性 payload + 越界/符号链接校验 + 图标内容寻址」**（`skills/src/services/catalog.ts:15-45,143-175,177-231`） | 技能线 | **1–2** | 低。风险：与 `docs/plan/skill-install-sources.md`、`skill-ingest-center.md` 已有设计重叠，需先去重 |
| 12 | **导入预检 / 内容指纹复核 / 原子发布 / 名称锁**（`skills/src/services/import-staging.ts:7-8`、`manager.ts:93-128,288-289,423-433,448`） | 技能线 | **3–5** | 中。风险：我们若走「中心化技能库」形态，本机原子发布的必要性下降 |
| 13 | **技能质量审查（advisory 规则而非硬门禁）**（`scripts/quality/audit-skills.mjs:9-24`：描述缺失/过长/全局触发措辞/正文过长/无条件指令） | 技能线 | **0.5** | 低 |
| 14 | **私有类型包承载跨模块契约**（`packages/contracts` 8 个子路径导出 + `AGENTS.md`「禁止横向导入其他功能插件」） | 所有线 | **0.5–1** | 低 |
| 15 | **`.agents/notes/` 的「所有权切分」笔记**（更新生命周期、插件安装 WAL/receipt、本地窗口安全工厂）——**设计参考，源码已删** | 桌面 / 控制台 | 设计 **0.5**；若要实现 **8–15** | 高。风险：这些是别的产品形态（多 Profile、系统托盘、原生材质）的取舍，直接搬会拖重我们的桌面 |

**前三条（性价比最高）**：#1 发布确认凭证（0.5–1 人日）、#2 上下文注入声明 + fail open（0.5 人日）、#3 结构化事件活动状态机（1–1.5 人日）。三条合计 **≤3 人日**，全部是纯逻辑、零重依赖、不需要改动官方底座。

### 3.2 明显不值得抄的（≥3 条 + 理由）

1. **Office 的多格式实时编辑器全家桶**（`office/src/content/service.ts` 805 行 + 8 个 `content_*` 工具 + `live/` 2700 余行 + 10 个前端库 + NotoSansSC.ttf 字体 + 手写 DOCX Chart XML）。
   *理由*：①依赖极重——`@tiptap/*` 7 个包、`@univerjs/*` 2 个、`pptx-react-viewer` + `pptx-viewer-core`、`docx-preview`、`exceljs`、`pdfjs-dist`、`pdf-lib`、`papaparse`，`README.md:141` 自述「完整 **199 项**打包依赖」；②它自己也未验收完（八类格式里只有 Word 工作副本实时就绪，其余菜单显示「实时编辑待接入」，`README.md:79`）；③保真度是长尾无底洞（页眉页脚/分页/嵌套表格/复杂对象全部未完成）；④与我们的交付形态（企业平台）相关度不确定。要文档产出应优先「调官方能力/外部转换」而不是自建渲染器。

2. **各模块手写的 UI 样式与自绘 client 引导**（`experts/src/client/styles.ts` 394 行、`skills/src/client/styles.ts` 199、`projects/src/client/styles.ts` 131、`office` 内 `tiptap-ui/` 20 个自制图标组件、`csv/csv.css` 等）。
   *理由*：没有共享设计系统，每个模块各自维护几百行 CSS 与自绘图标；抄过来等于把「4 套并行样式」一并继承，而我们已有控制台设计（`docs/phase-2-product-console-design.md` 的 §5「Beautiful UI 采用设计」）。**只该抄它的 slot 增量纪律，不该抄它的样式实现。**

3. **11 个骨架模块本身**（admin/applications/automations/identity/model-policy/pages/tables/usage + 3 个 provider）。
   *理由*：代码 0 行、只有 README + `.gitkeep`，没有任何可抄的实现。唯一可抄的是它们的**文档纪律**（「不声明加载入口、假工具或成功响应」「CSV 不冒充事务数据库」「缺指标不是零」「不能仅解码未验证 token」），这属于写法而非代码。

4. **自建专家团执行器（历史上存在过，现已退役）**——`TeamRunsManager`、SOP 状态机、`workdsh_expert_team_*` 工具、`workdsh-expert` provider、团队运行表。
   *理由*：`workdsh-web/AGENTS.md`（2026-09-15 决定）与 `experts/README.md:47-51` 明确**禁止恢复**，执行权全交官方 Agent Teams。这是一份现成的「不要自己写团队运行时」反例，我们若做多智能体应直接复用官方 Team，而不是照抄它已经删掉的那套。

5. **每个 workspace 包各写一份样板**（`GovernanceContractError` 在 `access/src/governance.ts:10-15` 与 `audit/src/governance.ts:10-15` 各复制一份、`identity-local/src/governance.ts` 再有第三份；各包的 `connection-api.ts` 反复手写错误码中文映射，如 `skills` 的 39 条映射 `connection-api.ts:19-57`）。
   *理由*：这是「Host 包必须自包含、不能运行时依赖私有 workspace 包」这条约束的**代价**（`audit/src/governance.ts:1-9` 解释了原因）。我们如果不承担同样的安装自包含约束，就没必要复制这套重复；即便承担，也应生成而非手抄。

### 3.3 与我们既有规划的关系（逐条对照）

| 我们的线 | 对应 WorkDSH 模块 | 判断 |
| --- | --- | --- |
| **技能线**（`docs/plan/skill-authoring.md`、`skill-ingest-center.md`、`skill-install-sources.md`、`add-skill-flow-reference.md`、`docs/research/iflytek-skillhub-integration.md`、`docs/plan/borrow-from-skillhub.md`） | `workdsh-plugin-skills` | **我们已有/已在做**。重叠度最高：技能管理、目录/市场、导入、校验、发布、内置技能。WorkDSH 的**独有增量**只有两点：①「目录是纯数据 + 惰性 payload + 越界/符号链接校验」的本地实现（`catalog.ts`）；②「技能作为独立可安装 tgz + 独立生命周期探针」的交付形态。**它的 SkillHub 面板不值得抄**——那只是把第三方插件路由（`SkillHubPanel.tsx:26,36`）画成卡片，不含协议、不含依赖审查、不含风险旗标；我们的 `iflytek-skillhub-integration.md` 已在做真正的协议与转换规格。 |
| **配方线**（`docs/plan/enterprise-presets.md`、`docs/research/agent-preset-best-practices.md`） | `workdsh-plugin-experts` 的 preset 编译 + `projects` 的 5 个内置模板 | **部分重叠 + 它的独有增量不少**。语义同层（打包并分发 Agent 配置），但 WorkDSH 有三块我们未见的工程实现：①不可变修订 + 内容派生 id 幂等；②发布确认凭证；③在官方 `agent/created` / `agent/pre-step` 上做资产准入与 Agent 局部装配（含主体/组织校验、成员父关系校验）。**这三块建议直接借鉴**（§3.1 #1、#5、#7）。 |
| **连接器线**（`docs/plan/connector-architecture.md`，66915 B） | `workdsh-plugin-connectors`（715 行）+ `providers/browser-session` | **我们已有/已在做，但可拿它做「厚薄校准」**。它的核心结论值得照单全收：**不自建 MCP 传输**，只做「定义/选择分表 + 凭据引用 + 健康检查 + 按会话 `tools.restrict`」。若我们的连接器内核计划了自建传输/多协议适配层，那就是重复劳动。 |
| **资料库线**（`docs/plan/library-port.md`） | `workdsh-plugin-library` | 已单独调研，本文不展开。仅指出：`projects`/`library` 的「引用只存 `assetId+revisionId`」是对我们资料库线有用的交叉证据。 |
| **控制台**（`docs/phase-2-product-console-design.md`、`docs/personal-center-menu-changes.md`） | `workdsh-plugin-workbench`、`bundle`、`activity` | **它的独有增量 = 三条纪律**，都不是"功能"而是"边界"：①不替换官方 sidebar、只 slot 增量；②`pending` 的功能不注册入口也不注册占位页；③状态条只折叠结构化事件、不猜散文。另外 `bundle/src/client/harness/client.ts:35-43` 的**「把第三方市场插件当 service 嵌入自己页面」**是一条低成本的市场/插件页集成路径（对应我们的 `docs/plan/enterprise-marketplace-phase2.md`、`docs/research/jingyun-dsh-appstore.md`），但要接受「市场能力归第三方」的耦合。 |
| **桌面 / 跨平台**（`docs/desktop-client.md`、`desktop-restart-reload-reference.md`、`desktop-2.0.3-harness-rc2-migration.md`、`github-workflows-CLAUDE.md`） | `dsh-plugin-desktop`（2 个源文件）+ `.agents/notes/` 桌面笔记 | **它的独有增量**：①「薄 carrier + symlink profile 物化 + stdout 抓 token URL」的最小可行桌面壳（245 行）；②兼容性豁免的「只授予一次 + 尊重撤销」语义；③Electron 复用为 Agent 浏览器 worker；④electron fuses + 打包结构断言。**我们该抄 ①②④，谨慎评估 ③**，**不要**照搬 `.agents/notes/` 里那套多 Profile + 托盘 + 原生材质 + 自建更新器的重型方案（源码已被它自己删掉）。 |
| **治理线**（`docs/owndsh-governance-mvp-design.md`、`t04-identity-adapter`、`t09-quota-management`、`t19-audit-closure`、`t20-security-fault`） | `access` + `audit` + `identity-local`（合计 1019 行） | **层次不同但可互补**。我们的设计是**服务端**建立身份/RBAC/配额/审计落库；WorkDSH 是**Host 本地**建立主体、用官方三个钩子把「工具调用」纳入授权与审计。它的独有增量是**「怎么在不改官方服务的前提下把官方工具流水线与 Session 生命周期纳入治理」**——这一点我们的设计文档里未必覆盖，建议借鉴 §2.7 的三钩子接法与「无 owner Session 拒绝收养」负例。 |

**一句话归纳**：WorkDSH 与我们的**技能线、连接器线、资料库线、控制台、桌面线全部重叠**；它真正不重叠、值得单独抄的是 —— **① 专家资产/修订/官方 Team 装配（experts）、② 发布确认凭证、③ 治理三钩子接法、④ 兼容性豁免与薄 carrier 的桌面工程细节**。

---

## 4 下一个最该参考的功能（明确建议）

### 建议：**专家模块（`workdsh-plugin-experts`）**

**为什么是它**（回答「资料库之后该看它哪个」）：

1. **规模与完整度都是第一**：6646 行源码、52 个非占位文件、939 行专项集成测试、6 个真实探针。12 个可安装模块里它是唯一「资产层 + 编译层 + 运行准入层」三层齐全的。
2. **它是我们配方线之外的真正增量**：资料库解决「材料进来」，而专家解决「**谁来做、用什么能力、按哪一版配置做、谁批准发布**」。我们的 `enterprise-presets.md` / `agent-preset-best-practices.md` 目前主要在「打包与分发」维度，**不可变修订、确认凭证、官方生命周期准入**这三块是缺的，而它们恰好是 WorkDSH 最扎实的部分。
3. **它的可复用部分是"不依赖 DSH 特性"的纯模式**：确认凭证（116 行）、内容摘要幂等 id、`rename` 原子发布 + `EEXIST` 复验、`per-record` + CAS + 拒绝坏记录——这些拿去任何平台都成立，风险低。
4. **它替我们回答了最贵的问题**：官方 Agent Teams 到底该怎么接（双钩子 + Agent 局部 scope 装配 + digest 幂等 + `tryMembership` 校验主体/父关系），以及**哪些东西绝对不能自己建**（团队执行器/邮箱/运行表）。这比读官方文档更省时间。
5. **它自带反例**：README 与 AGENTS 里「已删除自建 TeamRunsManager / SOP 状态机 / workdsh_expert_team_*」的完整说明，是一份现成的「多智能体别自己造运行时」论证。

**人日估算**：
- **精读 + 提炼可移植模式（不改代码）**：**2–3 人日**（对应本文 §2.2 的深度即可产出可直接落地的设计输入）。
- **把「确认凭证 + 不可变修订幂等 id + 发布流程」落到我们配方线**：**+4–6 人日**。
- **把「官方 Team 双钩子准入 + Agent 局部 persona/skill 装配」接到我们的 preset 装载路径**：**+5–8 人日**（取决于我们与官方 `agentPresets` 的装载方式差异）。
- 合计建议按 **8–12 人日** 立项，先做前两项（低风险、不依赖 Team 实验能力）。

**备选（若团队更关心企业治理而非配方）**：`access + audit + identity-local` 三件套（1019 行）。它的人日更低（**3–5 人日**）但**与我们 `owndsh-governance-mvp-design.md` 的服务端治理语义重叠**，增量偏「接法」而非「模型」。**只有当我们的治理设计里还没决定「Host 侧工具调用怎么纳入授权/审计」时才应优先它。**

**明确不建议作为"下一个"的**：Office（依赖 199 项、自身未验收完，投入产出比最差）、SkillHub（只是第三方插件的 UI 壳，没有可抄的协议）、骨架 11 模块（无代码）。

---

## 5 不确定项（逐条写为什么不确定）

1. **`workdsh-web/docs/` 整目录不可读**（`ls workdsh-web/docs` → `No such file or directory`；`workdsh-web/AGENTS.md:3` 说明该目录被 `.gitignore` 排除、「新检出仓库可能没有该目录」）。因此 **PLAN / STATUS / CONTRACTS / ACCEPTANCE / ADR / PLUGIN-DELIVERY / MODULE-VERSIONS / UI-DESIGN / TEAM-DESIGN / `modules.json` / `development-order.json` 全部未取到**。后果：①各模块 README 里大量 `../../../docs/...` 链接是死链，我无法核实其「计划阶段/验收证据」；②「12 个可安装模块」的权威清单我改从 `scripts/pack-project-release.mjs:12-25` 取得，**不能排除** `docs/modules.json` 里还有别的口径（例如是否含 `workbench`、版本线划分）。
2. **`deepseek-harness` 子模块未 checkout**（`.gitmodules:1-3` 声明，目录存在但内容未取）。因此所有**官方接口名**（slot 名、事件名、`storageDomain` API、`agentPresets.register` 签名、`tools.restrict` 语义、`sessionController` 行为）我都只能**从 WorkDSH 的调用侧反推**，无法核对官方定义。任何我写「官方 X」的地方，准确表述是「WorkDSH 以 X 之名调用」。
3. **全程只读、未构建未运行**。我没有执行 `pnpm install` / `build` / `typecheck` / `test`，也没有 Electron 环境。因此：①「代码行数」≠「可用代码」；②它 README 声称的探针通过（例如「腾讯文档 224 个工具」「官方 Team 探针通过」）**我无法复核**，只能转述并标注为「它自述」。
4. **`tests/` 下的测试是否真能跑未知**：例如 `tests/integration/expert-manager.test.mjs` 939 行依赖官方包与真实 Loader；未安装依赖时无法运行，我只能统计行数与文件名。
5. **SkillHub 的真实后端不可读**：搜索/安装协议、是否校验依赖、是否有风险旗标，全部在第三方包 `@cocofhu/skillhub@0.2.16` 内（`dsh-plugin-desktop/scripts/prepare-workdsh-runtime.mjs:19-20`），**该包不在本仓库**。我只能确认 WorkDSH 的 UI 会 POST `/api/.../skillhub` 式的相对路由（`SkillHubPanel.tsx:25-34`）并把 `pageUrl` 外链到 `https://skillhub.cn/skills/<slug>`（:81）。**「它怎么接 skillhub.cn」的准确答案：WorkDSH 自己不接，是第三方插件接的。** 但第三方插件具体走什么 API，未取到。
6. **dsh-market 同理不可读**：`dshmarket@1.66.1`（`prepare-workdsh-runtime.mjs:21-22`）不在本仓库；我只能确认 WorkDSH 通过 `ctx.inject(['market'])` 消费它的 `MarketHost{version,render,setSettingsVisible}`（`bundle/src/client/components/CommunityMarket.tsx:49-60`、`client/harness/client.ts:35-43`）。**依赖审查/风险旗标是否存在，未取到**（本仓内除 README 的一句免责声明外无任何实现）。
7. **README 与代码的口径冲突**：Office 的「六个原生工具」（`office/README.md:20,83`）与代码守卫清单的 **8 个**（`office/src/content/tools.ts:203-211`）不一致。我按代码记录，并在 §2.3 标注；**哪个是"当前真相"我无法判定**（可能 README 未随代码更新，也可能有 2 个工具在打包时被裁剪）。同理 README 里多处提及的历史版本（alpha.2/alpha.5/alpha.8）与 `package.json` 的 alpha.9 的差异，我未逐条比对 CHANGELOG。
8. **`.agents/notes/` 的 57 篇笔记描述的是"已实现"但源码已不在本仓的旧桌面壳**（例如托盘、更新器、插件安装 WAL、原生材质）。我引用的只是**设计意图**，其实现代码位置未知；这些笔记的 `Status: implemented` 指的是**它当时那个分支**，不代表当前 release 分支可用。§2.15 我已按此标注。
9. **桌面打包路径未验证**：`dsh-plugin-desktop/scripts/prepare-workdsh-primary-runtime.mjs`（68 行）我只读了文件名与大小，**未逐行确认 Python 运行时的打包方式**（README:69 声称含 Python）。同样，`scripts/desktop/pack-desktop.mjs` 需要 macOS arm64 + `.artifacts/desktop-pack-test/` 快照，本机（Android 环境）无法运行。
10. **`wc -l` 对二进制的荒谬值**：如 `office/src/pdf/fonts/NotoSansSC.ttf` 报 94296「行」、`build/app-icon-mac.png` 报 1729「行」。我在表里已排除或标注，但若有人复核行数请以代码文件为准。
11. **`workdsh-web/scripts/quality/audit-skills.mjs` 的规则是 advisory 还是门禁**，我只能看到函数 `inspectSkill` 返回 findings（:23），**未取到调用它的 CI 步骤**（`scripts/quality/audit-skills.test.mjs` 只是自测）。因此 §3.1 #13 的「advisory」定性来自文件头注释「Advisory content checks only」（`audit-skills.mjs:8`）。
12. **`.github/workflows/ci.yml` 只做了摘要级阅读**（jobs: changes / check / web-source-check / desktop-windows / desktop-macos / upstream-command-windows / publish-desktop-release，行号 21-283）。其中 `ci.yml:293,298` 的 release notes 文本提到「技能页接入 SkillHub 目录」与「SkillHub 和 dsh-market 是独立第三方来源；目录内容并非全部预装或经 WorkDSH 审核」——与 §5.5/§5.6 一致，但我**没有逐行读完整 12398 B**。

---

## 6 取证索引（关键文件:行号）

> 路径相对仓库根 `/data/data/com.deepcode.shell/files/home/.sshwork/workdsh`。未取到的已在 §5 说明。

### 6.1 结构与清单

| 主题 | 位置 |
| --- | --- |
| **12 个可安装模块的权威清单** | `workdsh-web/scripts/pack-project-release.mjs:12-25` |
| 12 个模块的打包/清单生成 | 同上 `:30-36`（pack）、`:48-63`（sha256+manifest）、`:85-86`（拷贝 installer 与 release notes） |
| 「12 个可安装模块」的文字出处 | `workdsh-web/README.md:35`、`workdsh-web/README.zh-CN.md:35` |
| 5 个可直接依赖的产品包 | `docs/desktop-boundaries.md:28-35`、`dsh-plugin-desktop/scripts/workdsh-package-boundary.mjs:1-24` |
| workspace 定义 | `workdsh-web/pnpm-workspace.yaml:1-7` |
| 上游版本锁定 | `upstream.json:1-6` |
| plugins 目录只是分类 | `workdsh-web/packages/plugins/README.md:1-7` |
| providers 全为骨架 | `workdsh-web/packages/providers/README.md:1-10` |
| 根 `check` 串联的校验脚本 | `package.json:1-40`（`check:layout`/`check:desktop-dsh-alignment`/`check:web-dsh-alignment`/`check:web-plan`） |
| 构建顺序（build/typecheck 的包序） | `workdsh-web/package.json`（`scripts.build` / `scripts.typecheck`，逐 filter 列出 13 个包） |
| 跨模块约束（禁止横向导入等） | `workdsh-web/AGENTS.md`（规则 1-10、Harness 优先复用硬约束、数据与执行、团队版首期硬约束、逐插件硬约束、UI 硬约束） |

### 6.2 skills

| 主题 | 位置 |
| --- | --- |
| Host 入口与注册 | `workdsh-web/packages/plugins/skills/src/index.ts:14-38` |
| `contractVersion 1` 契约说明 | `packages/plugins/skills/README.md:44-49` |
| 三个 Host 工具 | `src/services/lifecycle-tools.ts:31,59,73` |
| HTTP 路由 | `src/services/connection-api.ts:6-7`；图标 `src/services/catalog.ts:14` |
| 错误码中文映射（39 条） | `src/services/connection-api.ts:19-57` |
| dispatch 端点全集 | `src/services/connection-api.ts:61-120+` |
| client slot 三处 | `src/client.tsx:94-99` |
| SkillHub 面板（第三方路由） | `src/client/SkillHubPanel.tsx:25-34`（fetch `./skillhub`）、`:36`（注释「Reuse the installed DSH plugin's…」）、`:81`（`https://skillhub.cn/skills/`） |
| 技能页双页签（本地/SkillHub） | `src/client/SkillsPanel.tsx:69,266-267` |
| **catalog 文件 schema** | `src/services/catalog.ts:15-16,26-45`（`schema:1` / `kind:'workdsh-skill-catalog'` / entries 字段） |
| catalog 越界/符号链接/图标摘要 | `src/services/catalog.ts:53-56,143-156,216-231` |
| catalog 缺失/损坏状态（不伪选空目录） | `src/services/catalog.ts:177-201` |
| 本地目录路径 / 回收站 / 暂存 / stateRoot | `src/services/manager.ts:164-176` |
| 导入上限 | `src/services/import-staging.ts:7-8`；文案 `connection-api.ts:40-41` |
| 原子写 + 冲突检测 + 指纹复核 | `src/services/manager.ts:288-289`、`:323,345-353,389-393`、`:423-433` |
| 依赖检查器注册 | `src/services/manager.ts:469` |
| 内置技能 build 期生成 | `workdsh-web/scripts/generate-builtin-skills.mjs:9-21` |
| 本地目录构建器（从 WorkBuddy/SkillHub 镜像） | `workdsh-web/scripts/build-skill-catalog.mjs:1-13,25-36,38-54` |
| 质量审查规则 | `workdsh-web/scripts/quality/audit-skills.mjs:8-24` |
| 内置技能目录（5 个） | `packages/plugins/skills/resources/skills/`（`ls`） |
| 技能管理集成测试 | `workdsh-web/tests/integration/skill-manager.test.mjs`（454 行）等 6 个 |

### 6.3 experts

| 主题 | 位置 |
| --- | --- |
| Host 入口 / inject / 子插件 | `packages/plugins/experts/src/index.ts:28-35,56-80` |
| 官方 Team 装配 patch | `packages/plugins/experts/cordis.patch.yml:1-20` |
| 九工具与版本/上限说明 | `packages/plugins/experts/README.md:38` |
| 存储 6 表 schema | `src/storage/domain.ts:51-139` |
| per-record + CAS + 拒绝坏记录 | `src/storage/domain.ts:14-21` |
| 键编码约束（`_` 而非 NUL） | `src/storage/domain.ts:141-165` |
| **双钩子准入 + Agent 局部装配** | `src/runtime/execution-guard.ts:11-66` |
| **preset 编译 / 幂等 id / 原子发布 / 防漂移** | `src/runtime/preset-compiler.ts:14-33,63-72,94-107,109-168,184-209` |
| persona 注入点 | `src/runtime/preset-compiler.ts:211-219` |
| **发布确认凭证** | `src/runtime/confirmation.ts:5-14,16,31-74,80-98,100-102,112-116` |
| 团队场景校验（只管指令） | `src/domain/team-workflow.ts:1-22` |
| 进程内 TTL 存储（不做持久化） | `src/runtime/plans.ts:1-6` |
| 11 个管理工具 | `src/tools/management-tools.ts:291,319,343,358,368,389,432,452,470,498,524` |
| Manager 公开方法（27 个） | `src/services/experts-manager.ts`（`list/get/createDraft/updateDraft/copy/validate/requestPublishConfirmation/confirmPublish/publish/.../prepareExecution/createExecution/consumeHandoff/prepareHandoff/createHandoff/resolveNativeRole/verifyBinding/stageImport/previewImport/commitImport/export/operation`） |
| HTTP 路由三处 | `src/services/connection-api.ts:29-31` |
| 退役自建 Team 的禁令 | `workdsh-web/AGENTS.md`（「2026-09-15 官方 Team 替换决定」节）、`experts/README.md:47-51` |
| 专家管理集成测试 | `workdsh-web/tests/integration/expert-manager.test.mjs`（939 行）+ 6 个相关 |

### 6.4 office

| 主题 | 位置 |
| --- | --- |
| **8 个工具守卫清单** | `src/content/tools.ts:203-211` |
| 各工具注册点 | 同上 `:218,233,265,308,326,343,364,413` |
| system prompt 注入（5 段 guide） | `src/content/authoring.ts:5-13`（Word）、`:15-21`（PPT）、`:22`（Excel）、`:33`（HTML）、`:35`（PDF）、`:23-31`（注册） |
| 存储 domain + 判别式 schema | `src/content/service.ts:147-155` |
| 租约与进程代次 | `src/content/service.ts:126-146,555-565,635,683-703` |
| Host 服务名 | `src/content/service.ts:37` |
| HTTP endpoint 枚举 | `src/content/connection.ts:11-42`、路径 `:48-50` |
| 文件导入走官方 fs | `src/content/tools.ts:226-228` |
| 交付走官方 bash/present | `src/content/tools.ts:36` |
| 依赖清单 | `packages/plugins/office/package.json:47-68` |
| 格式能力与限制表 | `packages/plugins/office/README.md`（限制表与各格式节） |
| 「六个工具」口径 | `packages/plugins/office/README.md:20,83`（与代码不符） |
| 许可缺项如实报告 | `packages/plugins/office/README.md:141-143` |
| 集成测试 | `workdsh-web/tests/integration/office-*.test.mjs`（9 个，最大 889 行） |

### 6.5 connectors

| 主题 | 位置 |
| --- | --- |
| 定义 schema（含 serverName 正则、凭据 ref 正则） | `src/storage.ts:4-17` |
| 选择 schema（每会话） | `src/storage.ts:21-25` |
| 两个 domain | `src/storage.ts:29-39` |
| 服务名与 inject | `src/manager.ts:22-23,30` |
| 官方 MCP client 装配参数 | `src/manager.ts:151-152` |
| stdio 空 env / HTTP Authorization 服务端解析 | `src/manager.ts:144-150` |
| **`agent/created` → `tools.restrict(deny)`** | `src/manager.ts:52,214-223` |
| 真健康检查（tools vs resources） | `src/manager.ts:170-195`（尤其 `:182-183`） |
| 凭据命名规范 | `src/manager.ts:209` |
| 凭据只回「已配置/可写」 | `src/manager.ts:63-71` |
| 示例 MCP server | `src/example-server.mjs`（77 行） |
| HTTP 路由 | `src/connection-api.ts:4` |
| 客户端 slot | `src/client.tsx:19-25` |
| 224 工具实测自述 | `packages/plugins/connectors/README.md:8` |

### 6.6 治理三件套

| 主题 | 位置 |
| --- | --- |
| access：两个 domain + 服务声明 | `packages/plugins/access/src/index.ts:56-78` |
| access：grant/sessionOwner schema | 同上 `:37-54` |
| access：授权摘要 | `:96-106` |
| access：`bindSession` | `:127-140+` |
| access：`SessionAccessBridge`（create/resolveAgent + 拒收养） | `:394-483` |
| access：`ToolAccessBridge`（三钩子） | `:497-516`、授权 `:524-551`、结果审计 `:554-593` |
| access：本地 governance 错误类 | `src/governance.ts:1-15` |
| audit：event schema | `packages/plugins/audit/src/index.ts:9-29` |
| audit：敏感引用键黑名单 / 重复 id / 长度 | `:37,44-51,75` |
| audit：append 串行 + flush | `:70-90` |
| identity-local：domain 与 discriminated union | `packages/providers/identity-local/src/index.ts:33-65` |
| identity-local：`resolve` 只接受可信关联 | `:26-31,84-97` |
| identity-local：启动期一致性断言 | `:181-191` |
| 治理集成测试 | `workdsh-web/tests/integration/tool-access-bridge.test.mjs`(269)、`access-audit.test.mjs`(160)、`governance-contracts.test.mjs`(38)、`local-identity.test.mjs`(34)、`local-identity-storage.test.mjs`(82) |

### 6.7 projects / activity / workbench / bundle / browser-session

| 主题 | 位置 |
| --- | --- |
| projects：单表宽 schema | `packages/plugins/projects/src/storage/domain.ts:1-7` |
| projects：配置修订 + 能力绑定 + 引用校验 | `src/services/project-manager.ts:30,36,43` |
| projects：指令预算 | `src/instruction-budget.ts:1-7` |
| projects：能力合并保留旧修订 | `src/capability-selection.ts:11-28` |
| projects：**上下文注入 + 声明「引用不是指令/授权」+ fail open** | `src/runtime/context-injection.ts:8-31` |
| projects：成果归属 | `src/runtime/deliverable-attribution.ts`（150 行） |
| projects：client slot 四处 | `src/client.tsx:123,139,146,147` |
| activity：Host 空实现 | `packages/plugins/activity/src/index.ts:1-3` |
| activity：事件白名单与阶段机 | `src/projection.ts:6-41` |
| activity：团队事实投影（不猜散文） | `src/team-status.ts:14-43` |
| activity：`activityPresentation` 契约 | `src/client.tsx:5-9`、`src/registry.ts:1-15` |
| workbench：`pending` 纪律 | `src/client/components/BusinessPanel.tsx:12-22`、`src/harness/client.ts:9-28` |
| bundle：市场 service 嵌入 | `src/client/harness/client.ts:35-43`、`src/client/components/CommunityMarket.tsx:49-60` |
| bundle：浏览器页 system prompt 注入 | `src/probe.ts:9-23` |
| bundle：条件装配（`!!js` disabled） | `packages/bundle/cordis.patch.yml:1-25` |
| bundle：诊断只列真实 inventory | `src/client/harness/client.ts:111-125` |
| browser-session：Host service 形状 | `packages/providers/browser-session/src/index.ts:19-41,101-120` |
| browser-session：SessionResources / MCP 装配 | `src/index.ts:8,59,68,83` |
| browser-session：Remote 路径 | `src/remote.ts:9` |
| browser-session：client pane 注册 | `src/client.tsx:37-38` |
| bundle 测试 | `packages/bundle/tests/browser-view*.mjs`（123/65/66 行） |

### 6.8 桌面 / 跨平台

| 主题 | 位置 |
| --- | --- |
| 唯一应用入口 / 主流程 | `dsh-plugin-desktop/src/workdsh-main.ts:1,211-245` |
| profile 物化（symlink + 版本标记 + 不删用户目录） | 同上 `:97-132` |
| 启动 CLI（包内 Node + env 注入） | `:163-179` |
| 就绪正则抓 token URL | `:21,183-193` |
| 单实例 / 外链委托 / 安全默认 | `:216-223`、`:155-158`、`:145-149` |
| 浏览器 worker（offscreen + CDP） | `:57-95` |
| 版本兼容豁免同步 | `src/runtime-compatibility.ts:8-9,11-35,42-69` |
| 打包配置（fuses/nsis/dmg/extraResources） | `dsh-plugin-desktop/package.json:63-183` |
| 打包与校验脚本 | `dsh-plugin-desktop/scripts/{package-mac.ts,package-win.ts,verify-electron-fuses.ts,release-preflight.ts,prepare-workdsh-runtime.mjs,prepare-workdsh-primary-runtime.mjs,generate-tray-icons.mjs}` |
| 14 个打包测试 | `dsh-plugin-desktop/tests/*.spec.ts` |
| Profile 里绑定的第三方插件（skillhub/dshmarket） | `scripts/prepare-workdsh-runtime.mjs:18-22,199-208,217` |
| 托盘/更新/多 Profile 明确不存在 | `docs/architecture.md:16`、`docs/why-desktop.md:7`、`docs/plugin-development.md:9` |
| 桌面归属边界 | `docs/desktop-boundaries.md:1-55` |
| 上游 patch 版（`dsh-app:` 协议/菜单/更新/IPC） | `workdsh-web/scripts/desktop/patches/upstream/apps/desktop/src/main.ts:23,30-40,101-115,218-235,245-272,332-341`；patch 说明 `workdsh-web/scripts/desktop/README.md:1-21` |
| 已删除的旧桌面壳设计（57 篇笔记中的 4 篇） | `.agents/notes/implemented/architecture/2026-08-15-desktop-advanced-shell.zh.md`、`2026-08-19-desktop-update-lifecycle-ownership.zh.md`、`2026-08-19-desktop-plugin-install-lifecycle-ownership.zh.md`、`2026-09-04-desktop-local-window-security-policy.zh.md` |

### 6.9 可读的根文档（本文用到的）

`docs/README.md`、`docs/architecture.md`、`docs/architecture.en.md`、`docs/desktop-boundaries.md`、`docs/why-desktop.md`、`docs/plugin-ecosystem.md`、`docs/plugin-development.md`、`docs/user-guide.md`、`docs/faq.md`、`docs/evidence/*`（Windows 安装包证据 3 篇）。

---

## 附：本次调研的只读操作记录

- 全部操作均在 `/data/data/com.deepcode.shell/files/home/.sshwork/workdsh` 下以 `ls` / `find` / `cat` / `grep -n` / `wc -l` / `head` / `sed -n` 完成；**未写入、未修改、未删除**任何仓库文件。
- 临时脚本仅 1 个：`/data/data/com.deepcode.shell/files/home/.sshwork/probe/map.sh`（原用于批量统计，后改用直接命令；**未使用 `/tmp`**）。
- **未执行**：`git` 写操作、`pnpm`/`yarn` 安装或构建、`dsh` 任何命令、Electron 启动、任何网络请求。
- 唯一新建文件：本文件 `/data/data/com.deepcode.shell/files/dsh-enterprise/docs/research/workdsh-other-features.md`。
