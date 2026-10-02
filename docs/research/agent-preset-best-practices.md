<!--
[INPUT]: 依赖三条只读证据链——① 外网官方文档（经服务器通道 curl 抓取，落盘 ~/.sshwork/research/md/：
          code.claude.com 的 sub-agents/skills/plugins-manifest/plugin-marketplaces/marketplace-reference/
          plugins-security、cursor.com/docs/rules、docs.cline.bot 的 llms.txt+rules+skills+plugins、
          roocodeinc.github.io 的 custom-modes+marketplace、docs.dify.ai 的 cli/apps+version-control+
          plugin-manifest+raw.githubusercontent.com/langgenius/dify 1.16.0 源码、docs.n8n.io 的
          export-and-import+n8n-packages/package-format、docs.github.com 的 custom-agents-configuration、
          dsh.market 的 / 与 /plugins.json 与 /packs.json）；
          ② 本机官方 DSH 检出（@deepseek-ai/dsh@0.2.0-rc.2）的 preset 相关书面语义与实体文件
          （dsh-agent-preset / dsh-agent-preset-registry / dsh-agent-presets / dsh-client-ui-agent-preset 的
          README 与 skills/*/SKILL.md、dsh-web-app/presets/*.patch.yml、<dshHome>/.agent-presets/phone-control/）；
          ③ 本仓/服务器只读资料（docs/plan/*.md、/opt/work/dsh-market-import/raw/plugins.json、
          /opt/work/jingyun 源码树）。
[OUTPUT]: 给出「把一份 Agent 配置打包并分发」的社区最佳实践调研：各生态打包格式对照表（含关键字段与来源 URL）、
          五个设计维度（组合模型 / 版本与升级 / 分发与激活 / 信任与治理 / UX）的横向对比、
          DSH 本社区做法（官方 preset 语义 + dsh.market + jingyun）的一手抽取、
          采纳清单 / 不采纳清单 / 必须先定死的取舍，以及与既有规划文档的并入点与口径对齐项、不确定项清单。
[POS]: docs/research 层的外部+本社区证据文档；只服务于 docs/plan/enterprise-presets.md 的方案决策，
      不构成实现承诺、不改任何源文件、不重复技能侧既有调研结论。凡本文件与官方文档原文冲突处，以 URL 原文为准。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 「把一份 Agent 配置打包并分发」社区最佳实践调研

调研日期：2026-10-02（Asia/Shanghai）
调研对象：Claude Code / Cursor / Cline / Roo Code / Dify / n8n / GitHub Copilot / dsh.market / jingyun-dsh + 本机官方 DSH `0.2.0-rc.2`
文档状态：调研结论，未进入实施
对照基线：本机 `@deepseek-ai/dsh@0.2.0-rc.2`（`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/package.json:4`）与本仓 `docs/plan/enterprise-presets.md`

> **本文只调研、不写业务代码、不改任何源文件、不新增依赖、不 git 提交、不部署、不重启、不使用 `/tmp`。**
> 任务书要求「每条都要给来源，不许凭记忆编」。本文严格执行：
> 外部结论一律给 **URL**；本机/服务器结论一律给 **绝对路径:行号**；**取不到就写「未取到（原因）」**。

---

## 0. 一句话结论（社区最值得抄的三条）

| # | 抄什么 | 一句话 | 来源（主证据） |
|:-:|---|---|---|
| 1 | **把 Agent 配置当「目录 + 一份清单」，而不是单个文件** | 一份可分发资产 = 一个 manifest（元数据/版本/依赖/权限）+ 若干**约定默认目录**里的组件；清单是可校验、可预览、可索引的唯一入口 | Claude Code 插件标准布局（`.claude-plugin/plugin.json` + `skills/ agents/ hooks/hooks.json .mcp.json bin/` 等逐项默认落点）：<https://code.claude.com/docs/en/plugins/manifest-reference>；n8n `.n8np` 包「每个实体一个独立 JSON + 根 `manifest.json`，且 manifest 必须是归档里第一个文件」：<https://docs.n8n.io/build/manage-workflows/n8n-packages/package-format> |
| 2 | **「看得见的清单 + 装前告知 + 装后可撤回」就是无扫描时代的信任模型** | 社区头部实现没有一家声称「扫描通过」；它们把信任拆成：装前**逐项列出会装进什么**（含会执行的钩子与进程）、一句**不可验证的免责警告**、装后**可卸载/可禁用/权限可回收**、组织级**可 allowlist/force-install** | Claude Code「Plugin security and trust」整页（评审四步、详情面板 `Will install`、信任警告原文、`--keep-data`/14 天缓存清理、managed settings 控制矩阵）：<https://code.claude.com/docs/en/plugins/security>；Roo Code 市场「一键装/一键移除、项目级或全局级、移除即时无二次确认」：<https://roocodeinc.github.io/Roo-Code/features/marketplace/> |
| 3 | **「组合 = 引用」并给引用配一个可钉的坐标（钉版本 / 钉摘要）** | 可分发资产本体是**组合快照**，它引用的能力默认跟最新、关键项可钉死到「精确版本 + 内容摘要」；钉与不钉是**作者显式选择**，不是系统猜 | Dify 应用 DSL 的 `version` + `dependencies`（`marketplace` / `package` / `github` 三类，值是 `unique_identifier@sha256`）：<https://docs.dify.ai/en/cli/reference/apps> 与第三方逐字段整理（其每条均标注 Dify 官方源码 URL）<https://github.com/yzmw123/dify-workflow-dsl-skill/blob/main/references/dsl-structure.md>；Claude Code 市场条目可把 `source` 钉到 **commit SHA**，`archive` 源钉到 **sha256**，摘要不匹配**直接拒绝安装**：<https://code.claude.com/docs/en/plugins/security> |

**一句话总结**：社区的主流答案不是「打包成一坨越自包含越好」，而是「**薄主体（组合）+ 显式清单 + 可钉引用 + 装前可见 + 装后可撤**」。这与本仓 `docs/plan/enterprise-presets.md` §B/§D 已经选定的口径（组合是快照、技能/插件默认引用、关键项钉版本）**同向**。

---

## 1. 调研方法与局限（哪些取到了、哪些被拦）

### 1.1 取数通路（两条，都是只读）

| 通路 | 可用性 | 说明 |
|---|---|---|
| 本机 `web_search` | ✅ 可用 | 用于定位**确切的官方文档 URL**（不用于取正文结论） |
| 本机 `web_fetch` | ❌ **被网络策略拦** | 对 `code.claude.com`、`raw.githubusercontent.com` 等一律返回 `URL hostname "..." resolves to a non-public IP address`，**一个字节都拿不到** |
| **服务器通道**（正文主通路） | ✅ 可用 | `cd /data/user/0/com.deepcode.shell/files/home/.sshwork && node remote.mjs 'curl -sSL <url>'`；落点为 `62.234.16.179`，`HOSTKEY SHA256:oBbuNLc11iTXyOHXAU530jfyOlNNeKkf8oslXxWNRiw`；抓取物落盘在 `/data/user/0/com.deepcode.shell/files/home/.sshwork/research/md/`（**未用 `/tmp`**，本机 `/tmp` 不可写） |
| 官方文档 Markdown 直取 | ✅ 关键技巧 | `code.claude.com`、`docs.cline.bot`、`docs.dify.ai`、`docs.n8n.io` 都支持**在页面 URL 末尾加 `.md`** 直接拿纯 Markdown（比抓 HTML 干净得多）；Cline/Dify 还提供 `llms.txt` 索引页，先读索引再定位子页 |

服务器侧批量抓取脚本：`/data/user/0/com.deepcode.shell/files/home/.sshwork/fetch-batch.sh`（读一个 `name<TAB>url` 清单，远端 curl → tar+base64 回传 → 本机落盘）。所有 URL 清单留在 `/data/user/0/com.deepcode.shell/files/home/.sshwork/list1.tsv` … `list12.tsv`。

### 1.2 【已取到】清单

| 生态 | 取到的页面/文件 |
|---|---|
| Claude Code | `sub-agents`、`skills`、`plugins/manifest-reference`、`plugins/overview`、`plugin-marketplaces`、`plugins/marketplace-reference`、`plugins/security`（全部为官方 Markdown 原文） |
| Cursor | `https://cursor.com/docs/rules.md`（官方 Markdown 原文，400 行） |
| Cline | `https://docs.cline.bot/llms.txt`（官方文档索引，19 KB）+ `customization/cline-rules`、`customization/skills`、`customization/plugins`；官方博客 `cline.bot/blog/clinerules-…` |
| Roo Code | `https://roocodeinc.github.io/Roo-Code/features/custom-modes/`（153 KB HTML，已清成文本）+ `features/marketplace/` |
| Dify | `docs.dify.ai/en/cli/reference/apps`（DSL 导出/导入的 CLI 全文）、`/en/cloud/use-dify/build/version-control`、`/en/develop-plugin/…/plugin-info-by-manifest`；官方源码 `raw.githubusercontent.com/langgenius/dify/1.16.0/api/constants/dsl_version.py` |
| n8n | `docs.n8n.io/build/manage-workflows/export-and-import.md`、`…/n8n-packages/package-format.md`、`…/n8n-packages/import-a-package.md`、`…/how-import-works.md` |
| GitHub Copilot | `docs.github.com/en/copilot/reference/custom-agents-configuration`（657 KB HTML，已清成文本） |
| DSH 生态 | `https://dsh.market/`（首页）、`https://dsh.market/packs.json`（实时）；服务器上另一代理落盘的 `/opt/work/dsh-market-import/raw/plugins.json`（31,791,535 字节，**只读引用，未重复抓取**） |
| 本机官方 DSH | `@deepseek-ai/dsh@0.2.0-rc.2` 安装目录下 `dsh-agent-preset`、`dsh-agent-preset-registry`、`dsh-agent-presets`、`dsh-client-ui-agent-preset`、`dsh-web-app/presets/` 的 README 与实体文件（见 §4.1） |
| jingyun | 服务器 `/opt/work/jingyun` 源码树（只读） + 本仓既有调研 `docs/research/jingyun-dsh-appstore.md` |

### 1.3 【未取到】清单（如实登记，**不含任何记忆补写**）

| # | 目标 | 结果 | 原因 |
|:-:|---|---|---|
| 1 | **Cline 的 custom modes** | **未取到** | Cline 官方文档索引 `https://docs.cline.bot/llms.txt` 里**没有** custom-modes 页；`https://docs.cline.bot/features/custom-modes.md` 返回官方 404（"Page Not Found" + 相关主题列表）。官方站点上能读到的持久化机制是 **Rules / Skills / Plugins / Hooks**。**结论：任务书里「Cline 的 custom modes」这一前提，在我们能取到的官方文档里不成立**（见 §2 与 §7） |
| 2 | Roo 的 `docs.roocode.com` | **未取到** | `https://docs.roocode.com/features/custom-modes.md` 返回 Docusaurus 404 页（HTML 头里 `og:url = https://roocodeinc.github.io/Roo-Code/404.html`）。改用官方新站 `roocodeinc.github.io` 取到 |
| 3 | **Coze 的可导出文件格式** | **未取到官方证据** | `https://www.coze.com/open/docs/guides` 返回的是 SPA 外壳（`<div id="root">` + CDN script），无正文；换 `.md` 亦无官方格式定义。检索只得到第三方教程与第三方转换器（`coze2dify`、`iflytek/agentbridge`），但它们**不是官方格式定义** |
| 4 | 上述两个第三方 README | **未取到** | `raw.githubusercontent.com/iflytek/agentbridge/main/README.md` 与 `raw.githubusercontent.com/coze-dev/coze-studio/main/README.md` 两次 `curl` 均非零退出（抓取脚本回写 `FETCHFAIL`） |
| 5 | GitHub Copilot custom agents 的**文件落点与优先级** | **未取到** | 取到的 reference 页只给 frontmatter 字段表与「文件名（去掉 `.md`/`.agent.md`）用于跨层去重，最低层优先」一句；落点细节在它链接的 "Creating custom agents" 页，本轮未取 |
| 6 | n8n 包的**导出/导入选项清单** | **部分未取到** | 已取到 `package-format` 的完整 manifest 字段表与 `requirements` 六节、以及版本兼容规则；但 `export-a-package` 页未取，`import-a-package`/`how-import-works` 两页虽已抓取落盘，**未逐条提取其选项**（本轮不据此下任何结论） |
| 7 | Cursor Team Rules 的存储/同步机制 | **未取到** | 官方只说「由 dashboard 管理、Team 与 Enterprise 计划可用」，未给字段或版本机制 |
| 8 | `docs.dify.ai` 的 Workflow/DSL 专题页 | **未取到** | 猜的路径 `/en/guides/workflow/README.md` 返回 404；改用 `llms.txt` 索引 + `difyctl` 官方 CLI 文档 + 官方源码，结论仍有一手支撑（见 §2） |

### 1.4 二手来源的标注纪律

本文件中**唯一**的二手技术来源是第三方整理的 Dify DSL 结构文档（`yzmw123/dify-workflow-dsl-skill`）。它之所以可用，是因为它**逐条标注了 Dify 官方源码 URL**，而我们对其中最关键的一条做了**一手复核**：

```
curl -sSL https://raw.githubusercontent.com/langgenius/dify/1.16.0/api/constants/dsl_version.py
→ CURRENT_APP_DSL_VERSION = "0.7.0"
```

（已落盘：`/data/user/0/com.deepcode.shell/files/home/.sshwork/research/md/dify-dsl-version-py.txt`，全文 1 行。）
凡该文档里我们**没有**一手复核的字段（例如 `dependencies` 的子结构），在 §2 里都标注「（二手：<URL>）」。

---

## 2. 各生态的打包格式对照表

### 2.1 主对照表

| 生态 | 分发介质 | 打包格式（文件/落点） | 关键字段（逐字） | 来源 |
|---|---|---|---|---|
| **Claude Code · subagent** | git 仓库 / 插件 / 克隆目录 | 单文件 Markdown：`<项目>/.claude/agents/<name>.md`、`~/.claude/agents/`、managed settings 目录、插件内 `agents/`；**递归扫描子目录** | `name`(必) `description`(必) `tools` `disallowedTools` `model` `permissionMode` `maxTurns` `skills` `mcpServers` `hooks` `memory` `background` `omitClaudeMd` `effort` `isolation` `color` `initialPrompt` `experimental`。**多词字段用 camelCase，未识别字段静默忽略**；`name` 不许含 `:`（保留给插件作用域标识） | <https://code.claude.com/docs/en/sub-agents> |
| **Claude Code · skill** | git 仓库 / 插件 / claude.ai 同步 | 目录：`<层级>/.claude/skills/<name>/SKILL.md`（+ 支持文件）；**企业/个人/项目/嵌套/附加目录**五种落点，另有 `.claude/commands/*.md` 旧格式 | `name` `description`(推荐) `when_to_use` `argument-hint` `arguments` `disable-model-invocation` `user-invocable` `allowed-tools` `disallowed-tools` `model` `effort` `context` `agent` `background` `hooks` `paths` `shell` `metadata` `license` `compatibility`；**字段名小写连字符（唯 `when_to_use`）**；`description`+`when_to_use` 在列表里**截断到 1536 字符**；官方明确「插件作用域名 = `my-plugin:reviewer`」 | <https://code.claude.com/docs/en/skills> |
| **Claude Code · plugin** | marketplace 目录/仓库、`--plugin-dir`、本地目录 | 目录 + manifest：`.claude-plugin/plugin.json`（可选）；**其余组件全部放插件根**：`skills/` `commands/` `agents/` `hooks/hooks.json` `.mcp.json` `.lsp.json` `output-styles/` `workflows/` `themes/` `monitors/monitors.json` `bin/` `settings.json` | `name`(必) `displayName` `version` `description` `author{name,email,url}` `homepage` `repository` `license` `keywords` `defaultEnabled` `dependencies` `metadata` `skills[]` `commands{}` `agents[]` `hooks` `mcpServers{}` `lspServers` `outputStyles` `experimental{themes,monitors}` `userConfig{}`；**顶层未知键被剥离并给 warning，`userConfig` 等严格对象里未知键是 error**；官方校验器 `claude plugin validate [--strict]` | <https://code.claude.com/docs/en/plugins/manifest-reference> |
| **Claude Code · marketplace** | 一个目录或一个仓库（也可 `git`/远端源） | `.claude-plugin/marketplace.json`；插件本体放 marketplace 内 `plugins/`、或 `source` 指向外部 | 顶层：`name`(必) `description` `owner{name}` `plugins[]`；条目：`name` `source`（相对路径 / 对象） `description`；**安装 id = `<entry-name>@<marketplace-name>`**；**相对路径不许含 `..`**；**条目名必须与插件 `plugin.json` 的 `name` 一致** | <https://code.claude.com/docs/en/plugin-marketplaces>、<https://code.claude.com/docs/en/plugins/marketplace-reference> |
| **Cursor · rules** | 随仓库版本控制 / dashboard | `.cursor/rules/*.mdc`（**明文 `.md` 被忽略，因为没有 frontmatter**）；可放子目录；另有 `AGENTS.md`（项目根与任意子目录） | 只有三个字段交互决定生效：`alwaysApply` / `description` / `globs`（真值表见来源）。四种规则类型：Always Apply / Apply Intelligently / Apply to Specific Files / Apply Manually。**非官方建议：单条 <500 行** | <https://cursor.com/docs/rules> |
| **Cursor · AGENTS.md** | 随仓库 | 项目**根与任意子目录**的 `AGENTS.md`，纯 Markdown 无元数据 | 无字段；**嵌套合并，更具体的优先** | 同上（AGENTS.md 小节） |
| **Roo Code · custom mode** | marketplace / 手工 YAML / 导出 YAML | 项目级 `.roomodes`（YAML **或** JSON，放项目根）；全局级 `settings/custom_modes.yaml`（或 `.json`）；规则放 `.roo/rules-{slug}/`（项目）或 `~/.roo/rules-{slug}/`（全局） | `slug`(唯一内部 id) `name` `description` `roleDefinition` `whenToUse`(可选) `customInstructions`(可选) `groups`（工具组 + `[edit, {fileRegex, description}]` 元组式文件类型限制）。**导出格式**：`customModes:` 数组，每项带 `rulesFiles: [{relativePath, content}]` | <https://roocodeinc.github.io/Roo-Code/features/custom-modes/> |
| **Cline** | 随仓库 / 插件 | 官方站点上**没有 custom modes**；可取的持久化机制是 `.clinerules`（**版本受控、可分享、可被 AI 编辑**）、`customization/skills`、`customization/plugins`、`customization/hooks` | 本轮未取到 custom-modes 的字段定义（见 §1.3-1）。官方索引里存在的相关页：`Rules`、`Skills`、`Plugins`、`Hooks`、`.clineignore(deprecate soon)`、`Creating Custom Tools` | <https://docs.cline.bot/llms.txt>、<https://docs.cline.bot/customization/cline-rules>、<https://cline.bot/blog/clinerules-version-controlled-shareable-and-ai-editable-instructions> |
| **Dify · app DSL** | 单文件 YAML（导出/导入） | `difyctl export studio-app` 产出一份 **DSL YAML**；有 `--output`、`--include-secret`（默认 false）、`--workflow-id`（导出某个已发布版本）；导入 `difyctl import studio-app (--from-file / --from-url)`，`--app-id` 覆盖既有应用 | `kind: app`、`version`（字符串；官方源码 `CURRENT_APP_DSL_VERSION = "0.7.0"`），`app{name,description,icon,icon_type,icon_background,mode,use_icon_as_answer_icon}`，`dependencies[]`，`workflow{conversation_variables,environment_variables,features,graph{nodes,edges,viewport}}`；`mode` 取值 `workflow` / `advanced-chat` / `chat` / `completion` / `agent-chat` / `agent`（0.7.0 新增顶层 Agent App）。**导出默认不带密钥（`--include-secret` 才带）** | <https://docs.dify.ai/en/cli/reference/apps>、<https://raw.githubusercontent.com/langgenius/dify/1.16.0/api/constants/dsl_version.py>（一手）；字段结构（二手）<https://github.com/yzmw123/dify-workflow-dsl-skill/blob/main/references/dsl-structure.md> |
| **Dify · dependencies** | 随 DSL 内嵌 | `dependencies:` 数组 | 三种 `type`：`marketplace` / `package` / `github`；`marketplace` 用 `marketplace_plugin_unique_identifier`，`package` 用 `plugin_unique_identifier`，值形如 `<org>/<plugin>:<semver>@<sha256>`（**版本 + 内容摘要同时钉住**）；**远程插件不可被官方导出逻辑导出** | 同上（二手，含 Dify 官方 `plugin/dependencies_analysis.py` 链接） |
| **Dify · plugin manifest** | marketplace | 插件包根 `manifest.yaml` | `version` `type`(仅 `plugin`) `author`(marketplace 里的组织名) `name` `label{en_US}` `created_at`(RFC3339，marketplace 要求不晚于当前时间) `icon` **`resource{memory, permission{tool, model{llm}, endpoint, app, storage{size}}}`** `plugins{}` `meta{version,arch[],runner{language,version,entrypoint}}` `privacy`（隐私政策文件路径） | <https://docs.dify.ai/en/develop-plugin/features-and-specs/plugin-types/plugin-info-by-manifest> |
| **n8n · workflow JSON** | JSON 文件 / URL / 剪贴板 / API | 单工作流 JSON（下载 / Import from File / Import from URL） | 官方**明确警告**：导出的 JSON **包含 credential 的名称与 ID**（ID 不敏感但名称可能敏感），HTTP Request 节点可能带认证头，**分享前必须删除或匿名化** | <https://docs.n8n.io/build/manage-workflows/export-and-import> |
| **n8n · package** | `.n8np`（gzip tar；扩展名只是约定，不校验） | 根 `manifest.json`（**必须是归档第一个文件**）+ 每个实体一个 JSON 目录：`workflows/<name>/workflow.json`、`credentials/<name>/credential.json`、`variables/`、`data-tables/`、`tags/`、`folders/`；三种包形状：**workflow / folder / project** | `packageFormatVersion`（当前 `"1"`）`exportedAt` `sourceN8nVersion` `sourceId` + 每类实体一个 entry list（`workflows`/`folders`/`projects`/`credentials`/`dataTables`/`variables`/`tags`，每项 `{id, name, target}`）+ **`requirements`**（`credentials`/`dataTables`/`workflows`/`variables`/`tags`/`nodeTypes`，每项带 `usedByWorkflows`）。**`requirements` ≠ 包内容**：它列"目标实例必须提供什么"（凭据**永远不导出数据**、nodeTypes 必须目标已装），官方专门警告不要把 `requirements` 当库存读 | <https://docs.n8n.io/build/manage-workflows/n8n-packages/package-format> |
| **n8n · 版本与可复现** | 同上（`.n8np`） | 见左栏包形状 | `packageFormatVersion` **必须精确匹配**才允许导入：「There's no compatibility window and no migration path: a package declaring any other version is rejected with a `400` before anything is written」；`sourceN8nVersion` **仅供参考**、不参与比较。归档**确定性**（时间戳固定为 Unix epoch、权限固定、gzip 便携模式）→ 同内容两次导出字节一致，**唯一例外是 `manifest.json` 里每次刷新的 `exportedAt`**（官方提示：做校验和对比时要排除它） | <https://docs.n8n.io/build/manage-workflows/n8n-packages/package-format> |
| **GitHub Copilot · custom agent** | 随仓库 | Agent profile Markdown（文件名去 `.md`/`.agent.md` 后用于**跨层去重**） | `name`(可选) `description`(必) `target`(`vscode`/`github-copilot`) `tools`(字符串或字符串数组) `model` `disable-model-invocation` `user-invocable` `infer`(**已废弃**) `mcp-servers` `metadata`；正文 = 指令，**上限 30,000 字符**；`argument-hint`/`handoffs` 在 cloud agent 上被忽略 | <https://docs.github.com/en/copilot/reference/custom-agents-configuration> |
| **DSH（本社区，官方）** | 只有一个入口：**装一个 bundle**（profile patch） | 一条 `@deepseek-ai/dsh-agent-preset` 声明，carried by bundle patches；出厂形态是 `@deepseek-ai/dsh-web-app` 的 `presets/<id>.patch.yml` | `id`(必，小写字母/数字/连字符) `plugins`(必，Cordis entry list) `name` `description` `order`；Loader row id 约定 `preset-<id>` | 见 §4.1（本机官方文件，逐条给路径:行号） |
| **dsh.market（第三方市场）** | 站点 + 两个静态数据文件 | `plugins.json` / `packs.json`；条目**不含文件**，只有坐标与安装命令 | 插件条目：`id type name owner repo fullName stars forks openIssues language description descriptionZh tags curated homepage license topics pushedAt createdAt updatedAt readmeSummary install{method,needsConfig,usageNeedsConfig,risky,dshEngines,commands[],commandSource} score{total,breakdown{maintain,practical,popularity,ease,signal},confidence,explanation} sources[] lastCheckedAt` | 见 §4.2 |

### 2.2 四个值得单独拎出来的「格式设计」细节

1. **「清单必须能被机器先读」是共识，但严格程度不同。**
   n8n 把这一点做得最硬：`manifest.json` **必须是归档里第一个文件**，好让 n8n「在读完其余内容之前就能校验整个包」（<https://docs.n8n.io/build/manage-workflows/n8n-packages/package-format>）。
   Claude Code 则允许「没有 manifest」——此时它按标准布局**扫目录**得出组件，manifest 只在需要元数据/`userConfig`/非默认路径时才写（<https://code.claude.com/docs/en/plugins/manifest-reference>）。
   **对我们的含义**：`.dshpreset` 已经强制一份 manifest（一期就冻结了），这比 Claude Code 更严、比 n8n 略松（没有「必须第一个 entry」的硬约束）。

2. **「未识别字段」的处理是两种哲学，不是同一个默认值。**
   Claude Code 的 subagent/skill：**静默忽略**未识别字段（会让人以为写对了）；
   Claude Code 的 plugin.json：顶层未知键**剥离 + warning**，而 `userConfig`/`channels`/`lspServers`/`monitors` 等严格对象里未知键**直接 error、插件不加载**；
   Dify 的 plugin manifest：**格式错误即解析与打包失败**（fail-closed）。
   **对我们的含义**：对「会执行代码」的对象要 fail-closed，对纯展示元数据可以宽容——这条建议直接可写进我们的验包闸门（`docs/plan/skill-install-sources.md` §D.3 已有 manifest 校验的一席）。

3. **「导出会把凭据带出去」这件事，被官方当成一级风险提示。**
   n8n 在导出文档顶部用 hint 警告 credential 名称/ID 会进 JSON（<https://docs.n8n.io/build/manage-workflows/export-and-import>）；
   Dify 反其道：导出 DSL **默认不含密钥**，要显式 `--include-secret`（<https://docs.dify.ai/en/cli/reference/apps>）。
   **对我们的含义**：配方包**永不携带凭据**（与本仓 `docs/plan/enterprise-presets.md` §F.3 的口径一致，且可直接引用这两个先例作为产品文案依据）。

4. **「包里有什么」与「目标必须提供什么」是两份不同的清单——n8n 把这件事做成了独立字段。**
   `.n8np` 的 `manifest.json` 里，entry lists（`workflows`/`credentials`/`variables`/`dataTables`/`tags`）是**库存**，而 `requirements`（`credentials`/`dataTables`/`workflows`/`variables`/`tags`/`nodeTypes`，每项带 `usedByWorkflows`）是**依赖**；官方专门用 hint 警告：「`requirements` lists what the workflows need, which **isn't the same as what the package contains** … **Don't read `requirements` as an inventory of the archive; read the entry lists for that.**」并且**凭据数据永不导出**，所以 `requirements.credentials` 里的项一律意味着"目标实例必须自己提供"（<https://docs.n8n.io/build/manage-workflows/n8n-packages/package-format>）。
   **对我们的含义**：这正是我们 `dependencies[]` 应有的语义分层——**包内容清单**（我们有什么）与**依赖/前置清单**（员工本机必须有）必须分开渲染，否则员工会以为"引用缺失"是"包坏了"。同时它给出一条现成做法：**依赖项里如果有"用户/实例必须自备"的东西（凭据、模型授权），要在装前就说清**——直接对应我们 §B.1 的 `modelPolicy` fail-closed。

---

## 3. 五个设计维度的横向对比

### ① 组合模型：引用 vs 内嵌/快照？有没有继承/覆盖？父级改动怎么传导？

| 生态 | 组合方式 | 判定 |
|---|---|---|
| Claude Code · plugin | 插件**同时**带 `skills/`、`agents/`、`hooks/`、`.mcp.json` 等实体文件 → **内嵌**；但 plugin.json 也支持 `skills: ["./extra-skills/"]`、`agents: [...]` 这类**路径引用**（指向插件内或插件外） | 混合（默认内嵌，可引用） |
| Claude Code · subagent | `skills:` 字段把技能**预载进上下文**（"The full skill content is injected, not only the description"），但同一字段说明「子代理仍可调用未列出的项目/用户/插件技能」→ **预载是快照，可调用面是引用** | 混合，且**明确写清了边界** |
| Claude Code · 优先级 | **同名覆盖有显式优先级**：managed settings(1) > `--agents` CLI(2) > 项目 `.claude/agents/`(3) > 用户 `~/.claude/agents/`(4) > 插件 `agents/`(5)；项目侧**向上逐级扫描，离工作目录最近的赢** | ✅ 有继承/覆盖 |
| Cursor | `.cursor/rules` 各条独立；`AGENTS.md` **嵌套合并、更具体优先**（父级是"基线"，子级是"覆盖"） | ✅ 有覆盖（仅 AGENTS.md） |
| Roo Code | 导出 YAML **把 `rulesFiles` 的正文 content 内嵌进配置** → **快照**；装到项目还是全局决定作用域 | 内嵌（快照） |
| Dify | `dependencies` **引用** marketplace/package/plugin，值是 `unique_identifier@sha256` | 引用（+钉摘要） |
| n8n | `.n8np` 把 workflows + credentials + variables + data-tables + tags **一起打包**（credentials 只带 name/id，不带密钥） | 快照 |
| GitHub Copilot | 单个 agent profile 自包含（正文即指令）；`mcp-servers` 可内联或引仓库设置 | 内嵌为主 |
| **DSH 官方** | preset **只是一份 entry list**：它不"包含"模型/技能/规则，它声明**挂载哪些插件**；技能通过 `@deepseek-ai/dsh-skill-filesystem` 的 `customSkillDirs` **指向目录**（官方 `cordis` preset 指向包内 `skills/`） | **引用**（且组合本体天然是快照） |

**社区主流做法（1–2 句）**：**组合本体当快照、能力当引用**是主流；同时几乎每个生态都给"同名/同 id 谁赢"写了一条**显式优先级**（Claude Code 五级、Cursor 嵌套、Roo 项目 vs 全局、Copilot 最低层优先、DSH "profile patch 按 row id 覆盖且 config 整体替换"）。父级改动传导上，**没有一个生态做"自动向下传播"**——都是靠"重新安装/重新解析"或"就近覆盖"。

### ② 版本与升级：怎么版本化？钉还是跟？升级怎么处理行为变化？有没有锁文件？

| 生态 | 版本化 | 钉 / 跟 | 锁文件或等价物 |
|---|---|---|---|
| Claude Code · plugin | `plugin.json.version`（`validate --strict` 会因缺 `version` 报 warning） | marketplace 条目可把 `source` 钉到 **commit SHA**、`archive` 源钉到 **sha256**；**auto-update 默认开着**（"the files you reviewed can change on disk"） | **无 lock 文件**；等价物 = marketplace 里的 SHA 钉 + 安装缓存路径 `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` |
| Claude Code · 行为变化 | —— | 官方明说 auto-update 会让**你审过的文件在磁盘上变**；组织可用 managed settings 关掉/强制 | —— |
| Cursor | **无版本概念** | 跟仓库 HEAD | 无（靠 git 本身） |
| Roo Code | **无版本概念**；**导入同 slug 直接覆盖既有模式**（FAQ 原话：「The existing mode will be overwritten」） | 跟最新 | 无 |
| Dify | DSL `version`（`0.7.0`）+ `dependencies` 里的 `@sha256`；**Publish 才让草稿变 Latest Version**，Previous Versions 可回看 | 引用带摘要 → 等于钉 | **DSL 文件本身即锁**；另说清「导入写 draft，`run app` 用的是 published，所以导入后要 Publish 才生效」 |
| n8n | `packageFormatVersion`（**必须精确匹配，否则 400 且写入前就拒**，无兼容窗口、无迁移路径）；`sourceN8nVersion` 仅记录不比较 | 格式版本钉死；内容靠**确定性归档**（同内容两次导出字节一致）来支持校验和 | **无 lock 文件**；等价物 = `packageFormatVersion` + 确定性归档（唯一漂移源 `exportedAt`，官方提示校验和要排除它） |
| **DSH 官方** | preset 声明**没有 version 字段**；bundle 的 `package.json.version` 是最外层版本载体 | 跟装的那一版 | **等价物 = "已存在会话与其子会话保留启动时那一版插件修订"**（官方明说改声明只影响**新** Agent） |
| dsh.market | 条目**没有语义版本**，坐标是 `owner/repo`；有 `pushedAt/updatedAt/lastCheckedAt`、`dshEngines`（引擎要求） | 跟最新（`version: latest` 出现在 pack entries 里） | 无 |

**社区主流做法**：**版本化的最小充分条件是"钉到一个内容摘要"**——Dify 用 `@sha256`，Claude Code 用 commit SHA / archive sha256，两者都把"升级"变成**一次显式的作者动作**；而 Cursor/Roo 这种"跟仓库/跟最新"的则明确接受"今天能跑的东西明天可能变"。**没有一家用独立 lock 文件**；最近的等价物是"版本 + 摘要写在 manifest/marketplace 条目里"。

### ③ 分发与激活：怎么装？在哪一级激活？能不能一次装按需选？介质是什么？

| 生态 | 介质 | 安装动作 | 激活级别 | 一次装、按需选？ |
|---|---|---|---|---|
| Claude Code · plugin | registry（marketplace 目录/仓库/git/archive） | `claude plugin marketplace add <dir>` → `claude plugin install <name>@<marketplace>`；会话内 `/plugin` | **scope**：user / project / local；插件也支持 `--plugin-dir`、`--plugin-url` | ✅ 装了再按会话/项目启用；`defaultEnabled: false` 可"装上但先不启用" |
| Claude Code · skill/agent | 随仓库 / 用户目录 / 插件 | 放对目录即被自动发现（watcher 数秒内生效；**新建的 `agents` 目录仍需重启**） | enterprise / personal / project / nested / plugin | ✅ 同名按优先级解析 |
| Cursor | 随仓库 / dashboard | 放进 `.cursor/rules`；Team Rules 在 dashboard | 项目 / 用户全局 / 团队 | ✅ |
| Roo Code | marketplace（站内）/ YAML / 导出文件 | 市场一键 Install，选 **Project 或 Global**；也支持粘贴 YAML | 项目 `.roomodes` / 全局 `custom_modes.yaml` | ✅ 市场可"Show installed only"过滤 |
| Dify | 单文件 YAML | `difyctl import studio-app --from-file/--from-url` | 工作区（`--workspace`）/ 应用级 | 部分（每个应用各导一份） |
| n8n | 单工作流 JSON / `.n8np` / API | 手工导入 / CLI / API | 实例级 | 部分 |
| Copilot | 随仓库 | 落到 `.github/agents/`（细节未取到） | 仓库 / 组织 / 个人（"最低层优先"） | ✅ |
| **DSH 官方** | **只有 bundle**（本地目录，或 npm 包 = 一种 bundle） | `plugin_manager install_bundle`（装 bundle **会在 Host 进程执行插件代码，需要 Full access 或批准**） | **profile**（每进程装一次，多会话共享该修订） | ✅ 一次装，**每会话选一份**（registry roster）；只有空会话可切 |
| dsh.market | 站点条目 + 复制安装命令 | 条目自带 `install.commands`（如 `dsh plugin --profile web add <name>`） | profile | ✅ |

**社区主流做法**："一次装、按需选"是共识——**安装粒度是 profile/用户级，激活粒度是会话/项目级**。分发介质上，**registry 与 git 是主流，zip 是补充**；DSH 这边因为官方没有 registry 概念，"bundle 目录"就是介质本体。

### ④ 信任与治理：第三方配置带可执行内容怎么办？有没有审查/签名/权限声明？

| 生态 | 可执行内容在哪 | 审查 / 声明 / 签名 | 可撤回 |
|---|---|---|---|
| **Claude Code** | hooks 以你的权限跑 shell；mod 在你的权限下跑 JS；MCP/LSP 起进程；`bin/` 进 Bash 的 `PATH`；skills/commands/agents 进上下文当指令 | ① **整页安全文档**，逐类说明"它能做什么"；② 装前 **`Will install` 清单**（commands/agents/skills/hooks/MCP/LSP）；③ 关键一句原文：**"Make sure you trust a plugin before installing… Anthropic does not control what MCP servers, files, or other software are included in plugins and cannot verify…"**；④ 组织可设 `pluginTrustMessage` 追加到该警告；⑤ marketplace **名字分层**（official/community/third-party），官方名只接受 `github.com/anthropics/` 来源，否则**拒绝加载**；⑥ archive 摘要不匹配**拒绝安装**；⑦ **无签名信任根**（靠来源约束 + 摘要） | ✅ `uninstall [--keep-data]`、`disable`；缓存 14 天后清扫；组织可 allowlist/blocklist/force-install/限制 hooks 来源 |
| Cursor | 规则进上下文（指令） | 无权限声明；Team Rules 由 dashboard 治理 | ✅ 删规则 |
| Roo Code | mode 决定工具组与文件访问；MCP 会起进程 | `groups` 就是**工具白名单声明**；MCP 安装时提示前置条件与 API key | ✅ 市场 Remove（**"There is no additional confirmation prompt"**） |
| Cline | .clinerules 可被 AI 编辑；plugins/hooks 可执行 | 本仓官方索引未见统一的权限声明页（§1.3-1） | —— |
| Dify | 插件在容器/runner 里执行 | ✅ **manifest 显式声明 `resource.permission`**（tool/model/endpoint/app/storage{size}）+ `memory` 上限 + `privacy` 隐私政策文件；marketplace 用组织名发布 | ✅ 卸载插件 |
| n8n | workflow 节点可调外部服务 | 导出即警告凭据泄漏；package import **先检查再写** | ✅ |
| Copilot | `tools` 即白名单声明 | `tools` 字段声明可用工具（含 MCP） | —— |
| **DSH 官方** | 装 preset **就是装 bundle = 在 Host 进程执行插件代码** | 官方**没有**"预置信任"入口；`disabled` 只控挂载，不控权限；sandbox/approval 在 Host 组合而非 preset | ✅ 卸载 bundle（退役该声明修订） |
| dsh.market | 条目指向 npm/GitHub 代码 | ✅ **`install.risky` 风险旗标** + `needsConfig` + `dshEngines`；有 `score.explanation` 但**无安全审查声明** | ✅ 卸载 |

**社区主流做法**：**权限声明 + 装前可见清单 + 免责警告 + 组织级开关** 是事实标准；**签名不是**——只有"钉摘要 + 来源约束"这种弱等价物。**没有任何一家声称"扫描通过"**（这一点对我们是决定性的，见 §5）。

### ⑤ UX：市场怎么呈现？卡片放什么？怎么让人一眼看出"它要动我什么"？

| 生态 | 呈现 | 卡片/条目放什么 | 启用/停用反馈 |
|---|---|---|---|
| **Claude Code** | `/plugin` 面板：Discover / Marketplaces / Installed 页签 | 详情面板 **`Will install`**：commands、agents、skills、hooks、MCP、LSP 逐项列出；官方市场还给 **Context cost 估算**；`claude plugin details` 打印 **`Component inventory`**（含每个 hook 的事件与 MCP/LSP 服务器）；Installed 页有 **"Not used recently"** 分组提示可以关掉 | 装上即启用（除非 `defaultEnabled:false`）；失败/拒绝有专属错误码文案（如 archive integrity failed） |
| **Roo Code** | 扩展内市场页 | 条目：名称、描述、类型（MCP/Mode）、标签；**搜索 + 按类型 + 按标签 + "只看已安装"** 四种过滤 | 装：一键 + 选 Project/Global；**装完自动打开配置文件让你复核**；移除：即时、无二次确认（作者自认这是特性） |
| Cursor | Customize → Rules 侧栏 | 规则名 + 状态 + 类型（四种 Apply 类型下拉） | 改 frontmatter 即改行为 |
| Dify | 应用内 Version Control | Draft / Latest Version / Previous Versions 三段式，带缩略图 | Publish Update 即生效 |
| **dsh.market** | 站点列表 + 搜索（"按功能搜索"） | ✅ **五维评分 + 一句话解释**（`maintain/practical/popularity/ease/signal` → `total` + `explanation`）、`install.risky`、`install.method`、`commands[]`、tags、license、stars | 只给"安装命令"文本，站点本身不执行 |
| **jingyun** | 官方「设置 → 插件」页签条上追加「智能体列表 / 技能列表 / 开源社区」三个 tab | 智能体卡片：icon、name、description、**skills[]、tools[]、prompt、source、author、path、mtime**（全部从本机目录扫出来） | 激活 = `POST /api/jingyun/agent/activate {agentId, sessionId}`，`sessionId='default'` 即设全局默认（见 §4.3） |

**社区主流做法**：**卡片必须回答"装上会多出什么、会动我什么"**；最能落地的一条就是 Claude Code 的 `Will install` 组件清单 + jingyun 的 `skills[]/tools[]` 标签这两个形状的组合（对本仓 §G.1 的"两行 + 三枚签"建议是直接加固，不是推翻）。

---

## 4. DSH 本社区的做法

### 4.1 官方 preset 语义（最权威，逐条给路径:行号）

> 取证对象：本机官方检出 `@deepseek-ai/dsh@0.2.0-rc.2`（`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/package.json:4`）。
> 先说明：`dsh-agent-preset` 与 `dsh-agent-presets` 是**两个不同的包**，本 profile 挂的是前者（registry 形态），后者（目录扫描形态）**未挂载**（见下 §4.1.4）。

#### 4.1.1 格式与落点

| 问题 | 官方答案 | 出处（绝对路径:行号） |
|---|---|---|
| preset 是什么 | 「Agent presets are ordinary `@deepseek-ai/dsh-agent-preset` declarations **carried by bundle patches**. **Nothing edits a declaration in place**: a preset is created or changed by installing a bundle whose patch declares or overrides it.」 | `/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent-preset/skills/editing-cordis-compositions/SKILL.md:8` |
| 落点 | 「The shipped Web presets are `presets/<id>.patch.yml` files of the `@deepseek-ai/dsh-web-app` bundle, ids `standard`, `ptc`, `minimal` and `cordis`.」 | 同上 `:12` |
| 实体文件（已核） | `…/@deepseek-ai/dsh-web-app/presets/{cordis,minimal,ptc,standard}.patch.yml`（4 个文件均存在；字节数依次 8089 / 3184 / 7697 / 7511） | `/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-app/presets/` |
| 声明字段 | `id`(必，lowercase letters/digits/hyphens) `plugins`(必，Cordis entry list) `name` `description` `order`(roster position)；「The Loader row `id` is `preset-<id>` by convention.」 | `editing-cordis-compositions/SKILL.md:14` |
| 最小可分发形态 | 一个目录**恰好两个文件**：`package.json`（带 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`）+ `cordis.patch.yml`（`- insert:` 一条 preset 行） | 同上 `:16-52` |
| 覆盖既有声明 | 「Override the declaration by its Loader row id instead of inserting. **The override replaces the complete `config`**, so restate `id`, `plugins` and every other field」 | 同上 `:54-66` |
| patch 方言 | `insert: [rows]` 追加；带 `id` 且无 `insert` 覆盖该 row，**config 整体替换、绝不深合并**；`group: true` + `name: cordis:group` 让 config 成嵌套 entry list；`cordis:include` 从 `config.path` 载入；`disabled` 接布尔/null/`!!js`；`isolate` 把服务名映射到 `true` 或 realm 标签 | `…/dsh-agent-preset/skills/cordis-composition-reference/SKILL.md:12-25` |

#### 4.1.2 一份 preset 由什么组成

官方 README 的字段表只有 5 行：`id`(required) `plugins`(required) `name` `description` `order`（`…/dsh-agent-preset/README.md:40-48`）。
也就是说：**preset 自己不携带"模型 / 技能 / 规则 / 工具白名单"，它只声明挂哪些 row**；每一项能力都是被挂插件的能力。本机实体文件的对应关系：

| 配方想表达 | 官方靠哪一行 | 实体证据（路径:行号） |
|---|---|---|
| 人设 / 起始提示词 | `@deepseek-ai/dsh-persona` 的 `config.prefix/suffix/complete` | `…/dsh-web-app/presets/standard.patch.yml:11-15`（`prefix: You are a coding agent powered by the {{model}} model.` + `suffix: Your working directory is {{cwd}}.`） |
| 规则文件 | `@deepseek-ai/dsh-agent-instructions`（`maxBytes`） | `standard.patch.yml:16-19`（`maxBytes: 65536`） |
| 技能集合 | `@deepseek-ai/dsh-skill-filesystem` 的 `customSkillDirs` + `@deepseek-ai/dsh-tool-skill` | `…/.agent-presets/phone-control/agent.cordis.yml`「skills」段（`!!js … new URL('skills/', baseUrl)`） |
| 工具白名单 | **少挂 = 白名单**；`disabled` 可按表达式在每次 mount 决策时开关 | `…/dsh-web-app/presets/minimal.patch.yml:1-15`（文件头注释 + 只有 `persona` 一个 row，`complete: true`, `includeRuntimeContext: false`） |
| 模型 | **不在 preset 里**：`{{model}}`/`{{cwd}}` 从 agent 自己的 route 与 workspace 解析；模型路由属 Host 组合 | `standard.patch.yml:11-15`；`/data/user/0/com.deepcode.shell/files/home/.dsh/.agent-presets/phone-control/agent.cordis.yml` 文件头注释原文：「The host composition (`base.cordis.yml` + `web.cordis.yml`) keeps everything a preset must not own: the registries themselves, **the sandbox and approval stack**, persistence, and the model route.」 |
| 沙箱 / 批准 | **不是 preset 的职责** | 同上 |

#### 4.1.3 生效方式（这一节直接决定我们"启用"的 UX 契约）

| 问题 | 官方答案 | 出处 |
|---|---|---|
| 谁来选 | **每个会话选一份**；一个进程可同时跑不同 preset 且状态不串 | `…/dsh-agent-presets/README.md:12`（「One process can run sessions with different presets while keeping their state separate.」） |
| 谁能切 | 「**only an empty session may switch presets**」 | 同上 `:12` |
| 子代理 | 「A child agent (subagent) **joins its parent's composition**」 | 同上 `:34` |
| 默认值 | 部署默认来自 registry 的 `config.default`（出厂 `standard`）；用户默认存该 entry 的 `selectedDefault` 易失字段，新会话在部署默认之上解析它 | `…/dsh-agent-preset-registry/README.md:46`（「The `selectedDefault` volatile field … retains the user default, which new sessions resolve over the deployment `default`.」） |
| 改一份已装 preset 的影响面 | 「已存在会话与其子会话保留它们启动时的那一版插件修订」；要验证新行为必须开新会话 | `…/dsh-agent-preset/README.md:78`（「A live Agent's composition stays stable; new Agents can use an updated definition.」） |
| 失败会怎样 | 激活失败的声明**留在 roster 上带诊断**；`plugin_manager list_plugins` 报每行 `enabled`/`fiberPhase` | `editing-cordis-compositions/SKILL.md:74` |
| Web 上怎么看 | 设置里按「内置 / 自定义」卡片组，每张卡「View configuration」把声明的**只读 YAML（含 `!!js` 条件）**打开展示；页面**什么都不编辑**，"Creator" 入口开一个 Creator-mode 任务以 bundle 形式 author/override | `…/dsh-client-ui-agent-preset/README.md:28` |
| 远程面 | 只有 `agentPresets/list` 与 `agentPresets/read`；「**nothing accepts YAML back**」 | `…/dsh-client-ui-agent-preset/README.md:40`、`…/dsh-agent-preset-registry/README.md:48` |

#### 4.1.4 ★有没有「从外部文件导入一个 preset」的能力面——没有（官方原话三条）

1. 「The Web definitions come from the `dsh-web-app` bundle. Definitions are ordinary plugin rows; **the registry neither scans directories nor accepts preset paths**.」
   —— `/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent-preset-registry/README.md:46`
2. 「The registry writes no declarations. … **nothing accepts YAML back.** A new preset or an override of a shipped one is a bundle patch … installed into the profile with `plugin_manager`」
   —— 同文件 `:48`
3. 「Declarations provide **no directory, file-copy or file-delete operations**.」
   —— `…/dsh-agent-preset/README.md:84`

再加一条执行面事实：「Install with `plugin_manager`, `action: install_bundle`… **Installing a bundle executes plugin code in the Host process, so it requires Full access or approval.**」
—— `editing-cordis-compositions/SKILL.md:52` 与 `:74`

**必须分清的另一套（这不是我们的地基，但要写清以免误导）：**
`@deepseek-ai/dsh-agent-presets`（**复数**）这个包**确实扫描目录**：它的 README 说「The preset list combines shipped definitions with **configured and user roots**」「your own presets under **`<dshHome>/.agent-presets`**」「The plugin needs a `default` preset id and **scans `roots`**」，`roots` 每项是 `{path, trust}`，`includeUserRoot` 默认把 `<dshHome>/.agent-presets` 追加为 `user` root（`…/dsh-agent-presets/README.md:12, :36, :40, :54, :56`）。
**但本 profile 没挂它**：`/data/user/0/com.deepcode.shell/files/home/.dsh/profiles/web/cordis.yml` 是空 entry list（全部由 patch 组合），而 profile `node_modules/@deepseek-ai` 下**不存在** `dsh-agent-presets` 目录；profile 的 `cordis.patch.yml` 里也没有 agent-presets 相关行。本机那个老目录
`/data/user/0/com.deepcode.shell/files/home/.dsh/.agent-presets/phone-control/{preset.yml, agent.cordis.yml, skills/phone-control/SKILL.md}`
是**旧格式素材**（`preset.yml` 只有 `name/description/order` 三个字段，`agent.cordis.yml` 是一份完整 entry list），官方 skill 已把它判为「**已经没有任何东西读它**」，并给了迁移步骤（`editing-cordis-compositions/SKILL.md:68-70`）。

**因此对我们的结论**：官方**没有**「导入一份 preset 文件」的能力面；唯一路径是**把 preset 包装成 bundle 再装**（与本仓 `docs/plan/enterprise-presets.md` §A2.4 的判定一致——我这次是**独立复核**，结论相同）。

### 4.2 dsh.market（第三方市场，只读反查）

**站点**：<https://dsh.market/>（页面自述「DeepSeek Harness 插件市场：持续收录、实用五维评分、按功能搜索」）。
**数据接口（静态文件）**：`https://dsh.market/plugins.json` 与 `https://dsh.market/packs.json`——两者都是**相对站点根的可直接 GET 的 JSON**，客户端 bundle 里对数据的引用只有 `"./plugins.json"`、`"./packs.json"` 两处（外加一个 `"#api"` 锚点，未见服务端 API 路径）。

#### 4.2.1 条目模型（逐字，来自服务器已落盘证据）

> 证据：`/opt/work/dsh-market-import/raw/plugins.json`（另一代理的落盘，31,791,535 字节，`schemaVersion: 2`，`generatedAt: 2026-10-01T23:47:37.978Z`，`plugins` 长度 **9684**，`packs: []`）。**我只做只读引用，未重复抓取。**

`plugins[]` 每条的字段（按 real sample 逐字）：

```
id / type / name / owner / repo / fullName / stars / forks / openIssues / language
description / descriptionZh / tags[] / curated / homepage / license / topics[]
pushedAt / createdAt / updatedAt / readmeSummary
install { method, needsConfig, usageNeedsConfig, risky, dshEngines?, dshEnginesSource?, commands[]?, commandSource? }
score { total, breakdown { maintain, practical, popularity, ease, signal }, confidence, explanation }
sources[] / lastCheckedAt
```

#### 4.2.2 **它有没有 agent / preset / 工作流类资产？——分层回答**

| 层 | 事实 | 证据 |
|---|---|---|
| `type` 枚举 | **只有两种**：`cordis-plugin` **9512** 条、`skill` **172** 条。**没有 `agent` / `preset` / `workflow` 类型** | `/opt/work/dsh-market-import/raw/plugins.json`（统计：`collections.Counter(p["type"])`） |
| `install.method` | **只有两种**：`pnpm-profile` 9512、`skills-add` 172 | 同上 |
| **`packs`**（唯一像"组合"的概念） | 顶层有 `packs` 数组，实时 `https://dsh.market/packs.json` 里是 `schemaVersion: 1`、**2 条**、`kind: "loose-pack"`，每条含 `entries[]`，entry 形状 `{id, type, version: "latest", resolved: {ok, inMarket, reason?}}` + `entryStats{total, ok, failed, inMarket}`；两条的名字都带「示例 · 」（`mengyaoi/dsh-mcp-pack`、`Dariandai/dsh-starter-pack`） | 实时 `https://dsh.market/packs.json`（已落盘 `/data/user/0/com.deepcode.shell/files/home/.sshwork/research/md/dshmarket-packs.json`） |
| **但社区确实在用插件形态分发 preset** | tags 里出现 `agent-preset` 的有 **55 条**（另 `preset` 4 条）；这些条目全部 `type: cordis-plugin`、`install.method: pnpm-profile`。典型自述：`xiehuan123/coding-coach` 的 README 原文「**一个仓库，两个分发物，别搞混**：Agent 预设「编程教练」（`dsh/coding-coach/`）→ 一个**完整的 agent**…GUI 里能选到它。／**profile bundle 插件**（根目录 `package.json`…）」，其安装命令 `dsh plugin --profile web add coding-coach`。其他如 `hu568/dsh-plugin-cluster-preset`、`KannaKuron/dsh-ptc-cordis-preset`、`R-LEI2536/dsh-more-agent-presets`、`duyanta123/dsh-preset-scaffold`、`hoyyang/dsh-glm-mode`、`Aone2233/dsh-router-sci` | 同上（按 tags 过滤 + 逐条读 `readmeSummary`/`install.commands`） |

**结论（一句话）**：**dsh.market 没有一等的 agent/preset 资产类型**（type 只有插件与技能），它的"组合"层是刚起步的 `packs`（2 条、标注"示例"、`kind: loose-pack`）；**社区的现成分发方式是把 preset 打包成 cordis 插件/bundle 走 `pnpm-profile` 安装**——这恰好与官方"preset 只能由 bundle patch 安装"的语义对齐，也印证了我们方案主线的正确性。

**它对我们最有借鉴价值的三个字段**（都不是文件格式，而是**呈现模型**）：
`install.risky`（风险旗标）、`install.needsConfig`/`usageNeedsConfig`（是否需要配置）、`score.breakdown + explanation`（五维评分 + 一句话解释）——这三样正好是"让人一眼看出它要动我什么"的现成卡片形状。

### 4.3 jingyun-dsh（服务器 `/opt/work/jingyun`，只读）

> jingyun 的 UI 取值已在 `docs/research/jingyun-dsh-appstore.md` 深读；**本节只补它「智能体资产怎么打包与激活」的做法**，不重复 UI 结论。

**它的"智能体"资产模型（这是最接近我们"配方"的第三方实现）：**

| 项 | 事实 | 证据（服务器绝对路径:行号） |
|---|---|---|
| 落点 | 每个智能体是一个目录 `<baseHome>/agents/<name>/`（`baseHome` 由 `agent/manager.ts` 定，会话配置 `session_agents.json` / `active_agent.json` 也落这里） | `/opt/work/jingyun/packages/jingyun-dsh/src/assets/service.ts:14`（`const agentsDir = path.join(baseHome, 'agents')`）、`/opt/work/jingyun/packages/jingyun-dsh/src/agent/manager.ts:17-18`（读）与 `:57-58`（写） |
| 清单 | 目录内 `manifest.json`，读取字段：`displayName`/`name`、`summary`/`description`、`icon`、`source`、`author`、`isCustom`/`agent_created`/`author === 'user'`、**`skillSlugs`/`skills[]`**（`:191-194`）、**`tools[]`**（`:196`）、`agentName`、`expertType`+`teamInfo.leadAgent` | `/opt/work/jingyun/packages/jingyun-dsh/src/assets/service.ts:173-197` |
| 人设 | 目录内 `agents/<AgentName>.md`（按 manifest 的 `agentName` / team 的 `leadAgent` / kebab 化目录名三种优先级定位；只有一个 `.md` 时就用它） | 同上 `:202-252` |
| 兜底 | 没人设时读目录 `README.md` 的 `# 标题` 当名称、首个非标题行当描述；再兜底写「全栈业务智能体能力套件」（条目最终 `agentsDetail.push` 在 `:277`） | 同上 `:256-276` |
| 资产枚举接口 | `GET /api/jingyun/installed-assets`（另有 `jy-api/installed-assets` 别名）返回 skills/agents/plugins 三类；还有 `assets/install`、`assets/uninstall`、`assets/import-zip`、`assets/delete`、`assets/open-folder` | `/opt/work/jingyun/packages/jingyun-dsh/src/routes/assets.ts:29-115` |
| **激活语义** | `POST /api/jingyun/agent/activate`，body `{agentId, sessionId}`；写 `config.sessions[sessionId] = agentId`，**`sessionId === 'default'` 时同时写 `globalDefault`**，落 `session_agents.json` | `/opt/work/jingyun/packages/jingyun-dsh/src/routes/agent.ts:12-48` |
| 技能下载来源 | `https://cn.clawhub-mirror.com/api/v1/download?slug=<slug>` 直接 `fetch` 后落盘 `~/.dsh/skills`——**无 sha256 校验、无签名、无来源授权** | `/opt/work/jingyun/packages/jingyun-dsh/src/routes/skills.ts:79, :168-192` |
| preset | 它**没有**自己的 preset 分发；`'agent-presets'` 只作为官方设置命名空间出现在一张白名单里 | `/opt/work/jingyun/packages/jingyun-dsh/src/client/components/CustomLoginSettingBtn.tsx:1815` |

**要点抽取（三条）**：
1. **打包形状可直接借鉴**：`manifest.json + 人设 md +（skills 引用 + tools 白名单）` —— 这几乎就是本仓 `docs/plan/enterprise-presets.md` §C 的 `.dshpreset` 形状的先例（**引用式技能 + 白名单工具 + 人设正文**）。
2. **激活语义可直接借鉴**：`{agentId, sessionId}` + `sessionId='default'` 表示全局默认 —— 与官方 `selectedDefault`/`deploy default` 两层完全同构，可作员工端"启用/设为默认"的交互先例。
3. **它的信任模型不可抄**：第三方镜像直连下载、零校验。这正是我们**已经比它强**的地方（我们强制 sha256 + 设备 ACTIVE + 分配判定），也是我们**不能退回去**的地方。

---

## 5. 采纳清单 / 不采纳清单 / 必须先定死的取舍

### 5.1 【采纳清单】按性价比排序

| # | 借鉴什么（来源） | 我们要落到哪 | 人日量级 | 风险 |
|:-:|---|---|:-:|---|
| 1 | **装前"Will install"式组件清单**：把这份配方会挂哪些能力、哪些会执行代码，**逐项列在员工确认之前**（来源：Claude Code `Will install` + `Component inventory`，<https://code.claude.com/docs/en/plugins/security>） | 员工端配方详情页（`docs/plan/enterprise-presets.md` §G.2）+ 启用确认弹层的正文；控制台详情同步显示 | **1–2** | 清单靠解析 `agent.cordis.yml`；解析器必须保守（只做**行级/字符串**统计，不解析方言），否则误报会变成"狼来了" |
| 2 | **引用声明 + 混合钉版本**（组合快照、能力引用；`required` 钉 `versionId`，其余跟最新）（来源：Dify `dependencies` + `@sha256`，<https://docs.dify.ai/en/cli/reference/apps>；Claude Code commit/sha256 钉，<https://code.claude.com/docs/en/plugins/security>） | `manifest.json` 增 `dependencies[]`，落 `ent_preset_version.dependencies jsonb`（§D.4 已定形状：`kind/id/mode/versionId/required/resolvedVersionId`） | **2–3** | 发布口校验漏一个 `required` 就会在员工端才炸；必须 fail-closed 落在**发布口**（§E.2 已定） |
| 3 | **版本坐标拆三件事**：逻辑 id / 目标基线 / 来源坐标（来源：Dify 的 `kind + version + dependencies` 三件套、n8n 的"manifest 索引全包"，<https://docs.n8n.io/build/manage-workflows/n8n-packages/package-format>） | `presetId` + `sourceDshVersion`（目标基线）+ `provenance.source`（来源坐标），见 §E.1 | **1** | 自然键 `(package_id, source_dsh_version)` 被复用 → 幂等 `findExistingVersion` 直接返回旧行（§E.1 已点名的坑） |
| 4 | **完整性兜底**：下载逐字校验 sha256，不匹配**拒绝**（来源：Claude Code archive integrity，<https://code.claude.com/docs/en/plugins/security>） | 已有的 `sha256/size_bytes` 校验（§F.2） | **0.5** | 无 |
| 5 | **卡片字段**：风险旗标 + 是否需要配置 + 五维/多因子评分与一句话解释（来源：dsh.market 的 `install.risky`/`needsConfig`/`score.breakdown+explanation`，见 §4.2） | 员工端列表/详情卡片（§G.1 的"两行 + 三枚签"之上加一枚**风险签**） | **2–3** | 我们**没有真实评分数据**（stars/downloads 都是外部量），第一版只能用"引用数 / 工具面 / 是否含 `!!js`"这类**本地可算**的因子，写清不是"安全评分" |
| 6 | **按会话激活 + 全局默认**两层语义（来源：jingyun `{agentId, sessionId='default'}` §4.3；官方 `selectedDefault` + deploy `default` §4.1.3） | 员工端"启用 / 设为我的默认"，并诚实标注"**新会话生效**" | **1–2** | 已存在会话钉住旧修订 → 文案必须说清，否则会被当成 bug（§A2.4 风险 3） |
| 7 | **「库存」与「依赖」分成两份清单**：包里有什么 vs 目标实例必须提供什么（含"必须自备"的项），并能**fail-fast**（来源：n8n `manifest.json` 的 entry lists vs `requirements` + 六节依赖 + "凭据数据永不导出"，<https://docs.n8n.io/build/manage-workflows/n8n-packages/package-format>） | `manifest.json` 的 `dependencies[]` 在员工端**分两栏渲染**：`required` 缺失 → fail-closed 禁用启用；可选缺失 → 允许启用但显式列出（§D.5 已定）；`modelPolicy` 无授权同样 fail-closed（§B.1） | **1–2** | 需要一个"依赖缺失"的统一错误码与可行动文案（去申请 / 联系管理员），否则会退化成"点了没反应" |

### 5.2 【不采纳清单】（≥4 条 + 理由）

| # | 不抄什么 | 理由 |
|:-:|---|---|
| 1 | **Roo Code 的"导出 YAML 把 `rulesFiles.content` 内嵌"** | 它把规则**正文快照**进模式配置，直接造成"同一份规则在 pkg 与 exports 各存一份"的漂移；它自己要在 FAQ 里用"改 slug 后自动改 `relativePath`"来兜底（<https://roocodeinc.github.io/Roo-Code/features/custom-modes/>）。我们技能侧已经定了"落盘目录 = 信任域、不混排"（`docs/plan/skill-install-sources.md:642,:682`），内嵌正文会造出第二份真相 |
| 2 | **Cursor / Cline / Copilot 的"随仓库目录分发"** | 它们的前提是"开发者有仓库、规则随 git 走"；我们员工端是设备侧、无仓库上下文，且企业分发必须走中心授权与可见范围。照搬会绕过 `/enterprise/...` 的 `ACTIVE` 设备校验与 assignments（与 `docs/plan/borrow-from-skillhub.md` §4 第三条同一条纪律） |
| 3 | **n8n 的"导出 JSON 带 credential 名称/ID"** | 官方自己都在顶部警告要脱敏（<https://docs.n8n.io/build/manage-workflows/export-and-import>）。我们的配方包**不携带任何凭据**，这条只借用为**产品文案**（"我们不带密钥"），不作为格式 |
| 4 | **Coze 的"只有平台商店、无可导出文件格式"** | 我们**没取到** Coze 官方格式（§1.3-3），但即便存在，它也是平台内闭环。我们的资产必须可导出、可离线验包、可进中心（我们已有 `.dshpreset`）；把资产做成"只能在某平台里存在"等于自断治理 |
| 5 | **Dify 的"导入即 draft、还要再 Publish 才生效"作为员工端语义** | Dify 的 Publish 是**应用作者**的动作，我们的员工**不是作者**；我们的发布关口在管理员（`VALIDATED → PUBLISHED`）。照搬会把"作者工作流"错配到"消费者工作流"，多出一层无意义的点击 |
| 6 | **jingyun 的第三方镜像直连下载（`cn.clawhub-mirror.com`）** | 无 sha256、无签名、无来源授权（§4.3）。这会同时破坏我们的完整性校验与授权模型 |
| 7 | **Claude Code 的 hooks / mod 能力面** | 它的 hooks 以用户权限跑 shell、mod 在权限下跑 JS（<https://code.claude.com/docs/en/plugins/security>）。我们**本期不下发可执行 hook**：配方只挂官方插件 row，不引入"配方自带脚本"这一面——否则"是否扫描"这个问题会立刻变成必须回答的问题 |

### 5.3 【必须先定死的取舍】

| 取舍 | 定死为什么 | 依据 |
|---|---|---|
| **引用 vs 快照** | **组合本体 = 快照**（挂哪些 row、每个 row 的 config，就是 `agent.cordis.yml` 正文，天然钉住）；**技能/插件 = 默认引用**，「`required: true` 的钉死到 `versionId`，其余跟最新 PUBLISHED」，且钉与不钉是**作者上传时的显式选择** | 社区同向先例见 §0-③ / §3①；本仓已定见 `docs/plan/enterprise-presets.md` §B 与 §D.2，本文不改其口径，只提供外部验证 |
| **权限声明怎么写** | **不发明新 DSL**。三层：① 结构闸门（已有：路径/体积/entry 上限）② **保守文本检查**（对 `agent.cordis.yml` 数 `tool-*` row 数、是否含 `disabled: !!js`、是否有 `isolate` 服务行），把结果渲染成卡片上的"工具面"签 ③ 人工审（管理员独占发布）。manifest 只加**四个**可选字段：`dependencies` / `provenance` / `modelPolicy` / `license` | ①与③见本仓 §F.4；②的"保守文本检查"对应的社区先例是 Dify 的 `resource.permission` 声明（<https://docs.dify.ai/en/develop-plugin/features-and-specs/plugin-types/plugin-info-by-manifest>）与 dsh.market 的 `risky` 旗标 |
| **有没有"锁文件"** | **有等价物，但不新增 lock 文件**：锁定信息落在 manifest 的 `dependencies[]`（`mode: "pinned"` + `versionId` + 可选 `resolvedVersionId`），**随版本上传即冻结、之后不可改**。理由：官方 preset 没有 lock 概念（§4.1.2 只有 5 个字段、无 version），而我们"上传即不可改"的状态机天然承担了 lock 语义 | `docs/plan/enterprise-presets.md` §D.4；社区"无独立 lock、用 manifest 内坐标钉住"的旁证见 §3② |
| **不加"评分"当安全结论** | 我们**没有任何内容安全扫描**；可以展示"引用数 / 工具面 / 是否含 `!!js`"这类本地可算因子，但**不许**把它们包装成安全分 | §5.4 |

### 5.4 【对我们的特别约束】我们没有内容安全扫描 → 社区谁这么做过？效果如何？

**先把缺口写死（诚实口径）**：本仓既有结论已经确认「我们**没有内容安全扫描**」（`docs/plan/borrow-from-skillhub.md:30`、`:61`；`docs/plan/skill-ingest-center.md:418-421`），且**配方比技能更高危**——技能是文本，配方是**可执行配置**（`docs/plan/enterprise-presets.md` §F.4 已引 `docs/compose/spec/preset-square.md:24`）。本文不改变这个事实。

**社区里"不靠扫描"的四种做法与它们的实际效果：**

| 做法 | 谁做过 | 怎么做的 | 效果（官方自述/实测含义） |
|---|---|---|---|
| **装前可见清单 + 免责警告** | Claude Code | 详情面板 `Will install` 逐项列出 commands/agents/skills/**hooks/MCP/LSP**；固定一句：「Make sure you trust a plugin before installing… **Anthropic does not control what MCP servers, files, or other software are included in plugins and cannot verify that they will work as intended or that they won't change.**」；组织可 `pluginTrustMessage` 追加 | ✅ 这是本节最完整的先例：它**把"我们无法验证"直接写在警告里**，把判断交还给装的人 + 组织策略。**它没有说"安全"** |
| **显式权限声明** | Dify | manifest 里写清 `resource.permission{tool, model, endpoint, app, storage}` + `memory` 上限 + `privacy` 文件；marketplace 以**组织名**发布 | ✅ 声明式，可静态呈现；但**声明是自我描述**，Dify 不承诺核实 |
| **来源约束 + 内容摘要** | Claude Code | marketplace 名字分层，官方名只接受 `github.com/anthropics/` 来源（否则拒绝加载）；archive 源钉 `sha256`，不匹配拒绝安装 | ✅ 防的是"冒名"与"传输/存储被换过"，**不防"作者本来就想干坏事"** |
| **组织级开关 + 可撤回** | Claude Code / Roo Code | 组织可 allowlist/blocklist marketplace、force-install、限制 hooks 来源；用户可 uninstall（`--keep-data`）、disable、缓存 14 天后清理；Roo 市场 Remove 即时 | ✅ "撤回"是一等公民；Roo 甚至自认"没有二次确认"是特性（<https://roocodeinc.github.io/Roo-Code/features/marketplace/>） |

**结论（可直接写进产品文案的三句）：**
1. 我们的信任模型只能是 **看得见的清单 + 权限/工具面声明 + 人工评审（管理员独占发布）+ 可撤回**——**这四件套在社区里有成熟先例，且是头部实现的全部**；没有第五件套能替代扫描。
2. **不许出现"安全扫描通过""已验证来源"这类措辞**（我们既不扫描也不签名，`docs/plan/enterprise-presets.md` §F.2 已明确"我们**不签名**"）。默认承诺只能到：**「企业管理员审过的配方 + 每次下载校验 sha256 + 安装时官方会要求你确认」**（与 §F.4 ⑤ 一致）。
3. "可撤回"要真做到三条腿：**卸载 bundle**（官方退役该修订）／**清本机副本**／**中心退休 + 取消分配**（不远程撤回本机已装）——与 §E.5 已定的三档完全合拍。

---

## 6. 与既有规划的关系（只读）

> 声明：本节涉及的所有 `docs/plan/*` 与 `docs/research/*` 文件**我一字未改**（`enterprise-presets.md` 在我调研期间正被另一代理写入，我只读）。`docs/plan/enterprise-presets.md` 在我本次核实时的**存在性**：**已存在**（861 行，mtime 16:04，晚于本调研开始时刻）。

### 6.1 本调研该并入哪一节

| 本文章节 | 应并入的既有文档与节 | 并入方式 |
|---|---|---|
| §0 三条结论 / §2 对照表 | `docs/plan/enterprise-presets.md` §A2（官方 preset 语义）之后，作为**外部横向对照** | 建议在该节末尾加一句引用：「社区同类生态的打包形状与本仓口径的对照见 `docs/research/agent-preset-best-practices.md` §2/§3」 |
| §3①②（引用 vs 快照、版本与升级） | `docs/plan/enterprise-presets.md` §B（配方的构成）与 §D（版本耦合） | 作为**同向旁证**（Dify `@sha256`、Claude Code commit/sha256 钉）；**不新增取舍** |
| §3④⑤（信任、UX 卡片） | `docs/plan/enterprise-presets.md` §F.4（内容安全缺口默认档位）与 §G（员工端体验契约） | §F.4 可增一句"社区先例见本文 §5.4"；§G.1 的"两行 + 三枚签"可加一枚**风险签**（dsh.market `risky`） |
| §4.2（dsh.market 条目模型） | 若二期规划要写"商店卡片字段"，落 `docs/plan/enterprise-marketplace-phase2.md` 的商店/策展节 | 只作字段来源，不改它的三场景定位与"浏览自由 · 安装受控"口径 |
| §4.3（jingyun 资产模型） | 已在 `docs/research/jingyun-dsh-appstore.md` 有 UI 层调研；本文只补**资产/激活**层 | 建议作为该文档的**引用补充**，不新开文档 |

### 6.2 口径必须对齐的点（逐条）

| 口径 | 既有文档的定论 | 本调研的验证/对齐结果 |
|---|---|---|
| **版本坐标** | `docs/plan/enterprise-presets.md` §E.1：`sourceDshVersion` 保持"**目标 DSH 基线**"语义、**来源坐标另开 `provenance.source`**；自然键仍用 `(package_id, source_dsh_version)` 但发布前要校验不可复用 | ✅ 对齐。**补充一条外部差异**：dsh.market 的坐标是 `owner/repo`（无语义版本），与我们的"id + 基线"是两回事，**不要混用** |
| **分配** | §E.2/§E.3：本期**不扩 `DEPT`**（已决定不做、待用户改主意），`subject_type ∈ {ALL, USER}` | ✅ 对齐。dsh.market **没有分配概念**（只有 stars/curated），无法提供先例，也不构成反对理由 |
| **发布审批** | §E.4：本期**不接 `PENDING_REVIEW`**，沿用 `VALIDATED` 当草稿、发布是唯一人审关口；P2 与技能侧"第二人复核"一起做 | ✅ 对齐。社区里 Dify/讯飞有 `PENDING_REVIEW` 一档（`docs/plan/borrow-from-skillhub.md` §2-1 已登记），但**不是我们的本期依赖** |
| **provenance** | §F.2：`provenance.source` + `created_by/created_at` + `sha256/size_bytes` + 审计五事件；**明确"我们不签名"** | ✅ 对齐。与技能侧 `docs/plan/skill-install-sources.md:773` 的坐标字段设计同构；建议技能/配方两条链**用同名同义字段**，避免第二套语义 |
| **内容安全缺口的默认档位** | §F.4 ①–⑤（结构闸门 / 语义闸门 / 人工审 / 不做扫描与签名 / 措辞只能是"管理员审过 + sha256 + 官方确认"）；技能侧 `docs/plan/skill-ingest-center.md:418-433`（导入只落草稿、禁止导入即全员可见、发布必须人点、默认关闭直拉、不承诺"预检=安全"） | ✅ **完全对齐，并补齐社区先例**（本文 §5.4）。新增一条可执行建议：把 Claude Code 的**免责警告句式**作为我们文案的模板来源（它把"无法验证"写在前面，而不是藏在条款里） |
| **多技能套件（引用式）** | `docs/plan/borrow-from-skillhub.md` §2-4：Skill Suite 是引用式的，"与我们的「配方 / 套餐」概念合流" | ✅ 同一条路。本文不重复计价（该文档已给 P2 归属） |
| **与技能侧整体** | `docs/plan/skill-install-sources.md`、`skill-ingest-center.md`、`add-skill-flow-reference.md` | ✅ 本文**不改技能侧任何口径**；只提醒：配方复用技能侧已验证的"落盘目录 = 信任域、不混排"与"内容寻址幂等"，**不要再造第二套下载器**（与 `skill-install-sources.md:36-44` 的复用要求一致） |

---

## 7. 不确定项

| # | 不确定的东西 | 现状与边界 |
|:-:|---|---|
| 1 | **Cline 是否"曾经"有 custom modes** | 能取到的官方 `llms.txt` 索引里没有该项，官方 404 页也不返回历史内容；官方博客只谈到 `.clinerules` 的演进。**我无法确认历史上是否有过**，也无法排除"有页面但未进索引"。本文因此**不给 Cline 的 custom-modes 字段表**（避免记忆补写） |
| 2 | **Coze 的可导出文件格式** | 官方文档站是 SPA（未取到正文）；第三方转换器（`coze2dify`、`iflytek/agentbridge`）的存在**说明它至少有某种可搬迁表示**，但**我未取到官方格式定义**，也未能拉到那两个 README |
| 3 | **dsh.market 是否有第一方 API** | 我只读了站点首页、客户端 bundle 的数据引用（`./plugins.json`、`./packs.json`）与 `#api` 锚点；**不能排除**存在未在数据文件里体现的服务端接口。本文**只对"数据文件里有什么"下结论** |
| 4 | **dsh.market `packs` 的完整语义** | 只有 2 条、都带"示例 · "前缀、`kind: loose-pack`、schemaVersion 1（2026-08-16 生成，比 plugins.json 的 2026-10-01 旧）。它是"真的产品功能"还是"占位示例"，**从数据本身无法判定** |
| 5 | **GitHub Copilot custom agents 的落点/优先级细节** | 只取到 frontmatter 字段表 + "文件名去 `.md`/`.agent.md` 后跨层去重、最低层优先"一句；`.github/agents/` 这类落点来自它链接的未取页面，**本文不作为结论** |
| 6 | **n8n 包的导出/导入选项清单** | 已取到 manifest 字段表与版本兼容规则（§2.1）；`import-a-package`/`how-import-works` 两页已落盘但**未逐条提取选项**，`export-a-package` 页未取 |
| 7 | **Cursor Team Rules 的同步与版本机制** | 官方只说"dashboard 管理、Team/Enterprise 计划可用"，未给字段 |
| 8 | **Dify `dependencies` 之外的字段细节（二手）** | 采用的是第三方整理文档，虽然它逐条标注官方源码 URL、且我们一手复核了 `CURRENT_APP_DSL_VERSION`，但**其余字段仍属二手**，已在 §2 与 §1.4 明确标注 |
| 9 | **本机 DSH 版本的唯一性** | 本文所有官方语义取证基于本机 `0.2.0-rc.2`（`package.json:4`）。**若企业基线换版本，§4.1 必须重取证**（尤其"没有导入面"这一条，属版本敏感结论） |
| 10 | **"移除无二次确认" vs 我们的动作纪律** | Roo 自认移除即时无确认是特性；我们既有纪律是"失败不禁用开关、再拨一次即重试"（`docs/plan/enterprise-presets.md` §E.5）。两者**是否冲突需要产品口径统一**——本文只登记，不裁定 |

---

## 附录 A · 本调研的证据落盘清单（可复核）

| 类别 | 位置 |
|---|---|
| 外网正文（Markdown/HTML 原文） | `/data/user/0/com.deepcode.shell/files/home/.sshwork/research/md/`（`claude-*.txt`、`cursor-rules.txt`、`cline-*.txt`、`roo-custom-modes*.txt`、`roo-marketplace*.txt`、`dify-*.txt`、`n8n-*.txt`、`gh-copilot-custom-agents*.txt`、`dshmarket-packs.json` 等） |
| 批量抓取脚本与 URL 清单 | `…/.sshwork/fetch-batch.sh`、`list1.tsv` … `list12.tsv` |
| dsh.market 已落盘证据（**只读引用**） | `/opt/work/dsh-market-import/raw/{plugins.json, packs.json, home.html, bundle.js}` |
| jingyun 源码树（只读） | `/opt/work/jingyun/packages/jingyun-dsh/src/{assets/service.ts, routes/agent.ts, routes/assets.ts, routes/skills.ts, agent/manager.ts}` |
| 本机官方 DSH 检出（只读） | `/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/{dsh-agent-preset,dsh-agent-preset-registry,dsh-agent-presets,dsh-client-ui-agent-preset,dsh-web-app}/` |
| 本仓既有文档（只读引用） | `docs/plan/{enterprise-presets.md, enterprise-marketplace-phase2.md, skill-install-sources.md, skill-ingest-center.md, borrow-from-skillhub.md, add-skill-flow-reference.md}`、`docs/research/{jingyun-dsh-appstore.md, iflytek-skillhub-integration.md}` |

## 附录 B · 一句话交付

**社区最值得抄的是"薄主体 + 显式清单 + 可钉引用 + 装前可见 + 装后可撤"，最不值得抄的是"把规则正文内嵌"与"靠仓库目录分发"；而 DSH 本社区的现状是——官方 preset 只有 `id/plugins/name/description/order` 五个字段、只能由 bundle patch 安装（无导入面），dsh.market 没有一等的 preset 资产类型但社区已用插件形态在分发 preset，jingyun 的 `manifest.json + 人设 md + skills 引用 + 按会话激活` 是我们最接近形状的先例、但它的零校验下载绝不能抄。**
