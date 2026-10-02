<!--
[INPUT]: 依赖 docs/compose/spec/skill-catalog.md（包契约与三态状态机真源）、docs/plan/skill-ingest-center.md（V38 预定与 sourceDshVersion 口径）、
         docs/plan/skill-install-sources.md（客户端验包缺口 §D3-5、安装管线）、docs/notes/product-charter.md（产品宪法与术语降维表）、
         docs/notes/preset-ux-requirements.md（零门槛条文与官方 UI 硬约束）、
         本机官方 DSH 安装树的技能实现（dsh-skill / dsh-skill-filesystem / dsh-agent-preset 内官方技能），
         行业标杆外部资料（Agent Skills 开放规范、anthropics/skills 的 skill-creator、Claude Code 技能文档），
         以及本仓库 apps/desktop 内已有的同源 skill-creator 资产。
[OUTPUT]: 给出「创建技能」的方案：与导入/安装的边界、官方能力面结论与关键缺口、行业标杆可取之处、
          三种创建入口（模板脚手架 / 模型辅助 / 从既有派生）与共用校验器落点、零门槛与术语降维约束、
          与现有技能线的关系与版本坐标、服务端与前端改动清单、分期人日、开放问题与明确不做。
[POS]: docs/plan 下的**只规划不实现**方案文档；技能线的第三条纵向（前两条是 skill-ingest-center.md 的导入、skill-install-sources.md 的安装）。
       包格式与验包规则的真源仍是 docs/compose/spec/skill-catalog.md，本文不另立第二套格式。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md。
-->

# 创建技能：方案规划（「写出一个新技能」的入口）

> **本文只出方案，不含实现、不改任何源文件、不新增依赖。**
> 仓库事实给 `路径:行号`；官方能力给 `包名 + 文件 + 行号`；外部资料给 URL，取不到的写明原因。
> 本机取证方式：`web_fetch` 对所有外部域名统一返回 `URL hostname ... resolves to a non-public IP address`
> （实测 `claude.com` / `code.claude.com` / `huggingface.co` / `developers.googleblog.com` /
> `raw.githubusercontent.com` / `mintlify.wiki` 六例全拒；本机亦无 `/etc/resolv.conf` 与 `getent`），
> 故外部正文一律改用 `curl` 直取；**取不到的一律标「未取到（原因）」，不编字段名、不编版本号、不编端点。**

---

## 0. 一句话结论：创建技能的定位

**创建技能 = 在企业侧产出一份「合规的 `SKILL.md` 树」，产出物仍然是 `.dshskill` 包；它不新造格式、不新造校验、不新造分发管线。**

三条纵向的边界（三者都汇入同一条中心管线，见 §5）：

| 纵向 | 文档 | 解决的问题 | 输入 | 输出 |
|---|---|---|---|---|
| **导入** | `docs/plan/skill-ingest-center.md` | 第三方技能怎么**进来** | 外部地址/上游包 | 企业中心的**草稿**版本（`VALIDATED`） |
| **创建**（本文） | `docs/plan/skill-authoring.md` | 企业自己的技能怎么**写出来** | 人的意图 / 一次真实任务 / 一个既有技能 | 企业中心的**草稿**版本（`VALIDATED`） |
| **安装** | `docs/plan/skill-install-sources.md` | 已发布的技能怎么**落到员工设备** | 已发布版本 | 员工设备 `<dshHome>/skills/<name>/` |

三条硬边界（本文全程遵守）：

1. **创建只产草稿，绝不自动发布、绝不自动分配**（与导入同一条纪律，理由见 `docs/plan/skill-ingest-center.md:336`）。
2. **创建不执行任何包内内容**；`scripts/` 是否运行由用户自己的 Agent 会话决定（与安装同一口径，`docs/compose/spec/skill-catalog.md:118`）。
3. **员工侧不出现 `frontmatter` / `SKILL.md` / `YAML` 等技术词**（产品宪法 `docs/notes/product-charter.md:42`）。

---

## 1. 官方能力面与既有地基

### 1.1 官方有没有「创建技能」的能力面

**结论：没有。** 三个层次都核对过。

| 核对项 | 命令 / 出处 | 结果 |
|---|---|---|
| 官方安装树全树搜创建能力面 | `grep -rIl -iE "skill-creator\|createSkill\|scaffoldSkill\|skill_scaffold" /data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/` | **零命中**（无输出） |
| 官方技能相关包清单 | `ls .../node_modules/@deepseek-ai/ \| grep -i skill` | 只有 `dsh-skill`、`dsh-skill-filesystem`、`dsh-tool-skill`、`dsh-client-ui-skill`、`dsh-skill-badge`、`dsh-skill-office` |
| 官方有没有 `skills/install` 或 `skills/create` RPC | `docs/compose/spec/skill-catalog.md:120`（已按 0.2.0-rc.2 核对） | 「官方没有技能安装 RPC」；创建同样不存在 |

官方给的是**「发现契约」**，不是「创建能力」。`dsh-skill-filesystem` 只扫固定根目录
（`dsh-skill-filesystem/lib/index.js:150-189`，按 rank 从近到远）：

| 根 | source | 说明 |
|---|---|---|
| `<projectRoot>/.dsh/skills` | `project-dsh` | 项目级 |
| `<projectRoot>/.agents/skills` | `project-agents` | 项目级（开放规范的默认位置） |
| `customSkillDirs`（配置） | `custom` | 自定义目录 |
| `<dshHome>/skills` | `user-dsh` | **员工侧安装的落点** |
| `<agentsHome>/skills` | `user-agents` | 用户级 |
| `bundledSkillDir` | `bundled` | 官方预设内置技能（`trustedHost: true`） |

**这条路是我们自己拥有的**——而且本仓库已有一份可借鉴资产（见 §2.2，`apps/desktop` 内的同源 `skill-creator`），
但它属于桌面分叉的资产，**不是官方 DSH 的能力面**，也不在我们的企业技能线上。

### 1.2 官方 frontmatter 权威规则（「技能该怎么写」的真源）

| 规则 | 出处（官方实现） |
|---|---|
| 技能名正则 `^[a-z0-9]+(?:-[a-z0-9]+)*$` | `dsh-skill/lib/index.js:17`（`SKILL_NAME`）、`:29-31`（`isSkillName`） |
| frontmatter 必须是文件**第一行**恰好 `---`；闭合行也必须恰好 `---` | `dsh-skill-filesystem/lib/index.js:780-796`、`:794-806`（`findClosingFrontmatter`） |
| `name` 与 `description` 必填、非空字符串 | `dsh-skill-filesystem/lib/index.js:678-690` |
| 旧字段名一律**硬报错**：`disableModelInvocation` / `modelInvocable` / `userInvocable` | `dsh-skill-filesystem/lib/index.js:850-861` |
| 调用策略：`disable-model-invocation` → `modelInvocable`（取反）；`user-invocable` → `userInvocable`（默认 `true`） | `dsh-skill-filesystem/lib/index.js:848-859` |
| 布尔字面量：`true/false`、`1/0`、`yes/no`、`on/off`（大小写不敏感） | `dsh-skill-filesystem/lib/index.js:863-878` |
| 可选 `whenToUse`（字符串）、可选 `metadata`（对象） | `dsh-skill-filesystem/lib/index.js:699`、`:880-884` |
| **解析失败时是「跳过并 warn」，不是拒绝** | `dsh-skill-filesystem/lib/index.js:672-693` |
| 官方注册表**不设长度上限**，只要求非空 | `dsh-skill/lib/index.js:454-467` |

> 最后两条是设计上的关键分歧：官方对「写坏的技能」是**宽容降级**（少一个技能，不炸目录），
> 而**创建入口必须 fail-closed**（写坏了当场拦住并告诉人怎么改）。两者不是同一件事，不能混用同一套错误策略（见 §3.★）。

### 1.3 我们的校验器现状：`SkillArtifactInspector`

真源：`server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/artifact/SkillArtifactInspector.java`（280 行）。
它已是**逐条对齐官方**的一遍验包闸门（不落盘、不留正文）：

| 规则 | 行号 |
|---|---|
| 只允许根 `manifest.json` 与 `skills/` 子树；拒 `..` / `.` / 反斜杠 / NUL / 绝对路径 | `:121-136` |
| 上限：entry 数、解压总量、`manifest.json` ≤1 MiB、单个 `SKILL.md` ≤256 KiB、包内技能 ≤200 | `:41-43`、`:77-101` |
| manifest：`format=dsh-skill`、`version` 必须是**字符串** `"1"`、`id` ≤128 且 `^[A-Za-z0-9][A-Za-z0-9._-]*$`、`name` ≤120、`sourceDshVersion` ≤64、`description` ≤2000 | `:146-155`、`:246-258` |
| YAML **拒绝重复键**（`setAllowDuplicateKeys(false)`）、`maxAliasesForCollections(16)` | `:172-179` |
| 旧字段名硬拒绝并给出替代名 | `:49-53`、`:186-192` |
| `name` 必填 kebab-case（≤64）、`description` 必填（≤1024）、`whenToUse` 可选（≤2048）、调用策略布尔 | `:193-201`、`:216-244` |
| frontmatter 缺失 → **整包拒绝**（官方是跳过该文件） | `:208` |
| 包内技能名重复 → 拒绝 | `:161` |
| 测试 | `SkillArtifactInspectorTest` 8/8（`:39-190`，8 个 `@Test`） |

**两处服务端已比官方严**（不是缺陷，是设计选择，但必须显式记录）：
① 长度上限（name 64 / description 1024 / whenToUse 2048）；② 解析失败 fail-closed。
> 这两个数字**不是我们发明的**：`name ≤64` 与 `description ≤1024` 与 Agent Skills 开放规范逐字一致（§2.1）。

**两处服务端与官方解析行为不一致**（补客户端前必须先冻结口径）：

| 差异点 | 服务端 `SkillArtifactInspector` | 官方 `dsh-skill-filesystem` |
|---|---|---|
| 起始 `---` | 允许前导 BOM 与**前导空行**（`substring(0,start).isBlank()`，`:205-208`） | 必须是**第一行**恰好 `---`（`:780-783`） |
| 闭合 `---` | 匹配任意 `\n---` 前缀（`:211`） | 必须是**整行**恰好 `---`（`:794-806`） |

### 1.4 ★ 关键缺口：客户端不解析 frontmatter（必须补）

`plugin/packages/bundle/src/skill-archive.ts:4` 在自己头部写明：
「**不解析 SKILL.md 正文（正文语义由官方 `skill-filesystem` 在发现时自行校验）**」，
`:277-278` 重复该结论，代码里只检查两件事：`SKILL.md` **存在**（`:318`）与**大小**（`:306-308`）。

`docs/plan/skill-install-sources.md:572`（§D3-5）已把它列为「**必须补**」。缺什么：

| 服务端有、客户端没有 | 服务端行号 | 缺了会怎样 |
|---|---|---|
| `name` 必填 + kebab-case + ≤64 | `:193-194` | 坏技能落盘到 `<dshHome>/skills/<name>/` 后**被官方发现器静默跳过**，用户看不到技能，也拿不到原因 |
| `description` 必填 + ≤1024 | `:195` | 同上；官方注册表对空 description 直接判无效（`dsh-skill/lib/index.js:456`） |
| `whenToUse` ≤2048、必须是字符串 | `:196`、`:222-228` | 投影字段与中心不一致 |
| 旧字段名拒绝（`modelInvocable`/`userInvocable`/`disableModelInvocation`） | `:186-192` | **静默丢语义**：调用策略被人以为设了、实际没生效 |
| YAML 重复键拒绝 | `:172-179` | 真机已踩过：上游 `multi-search-engine` 因重复键 `homepage` 被服务端拒（`~/.sshwork/sh-import/EVIDENCE.md:59`、`:388`） |
| frontmatter 缺失拒绝 | `:208` | 同上 |
| 布尔字面量白名单 | `:230-244` | 写了 `disable-model-invocation: maybe` 会被静默当 false |

**落地要求（一句话）：把服务端 `parseSkillFile`（`:167-202`）的判定抽成一份可被两侧调用的规则，
客户端 `skill-archive.ts` 在 `decodeDshSkillArchive`（`:283-323`）里调用它，
三处（创建时预检、安装前校验、服务端上传验包）用**同一套规则、同一套错误码、同一套可操作文案**。**
并且先解决 §1.3 的两处解析差异，否则「同一套规则」在边界上仍会分叉。

---

## 2. 行业标杆做法

### 2.1 Agent Skills 开放规范（`SKILL.md` 的字段与形态约定）

来源：**Agent Skills 规范** <https://agentskills.io/specification>（本机 `curl` 实测 HTTP 200 并已取正文，未走 `web_fetch`）。

| 字段 | 必填 | 约束（原文口径） |
|---|---|---|
| `name` | **是** | ≤64 字符；只允许小写字母、数字与连字符；不得以连字符开头/结尾；**不得有连续连字符**；**必须与父目录名一致** |
| `description` | **是** | ≤1024 字符；非空；必须同时写「做什么」与「何时用」，含可被检索的关键词 |
| `license` | 否 | 许可证名或包内许可证文件名 |
| `compatibility` | 否 | ≤500 字符；环境要求（目标产品、系统依赖、是否需要联网） |
| `metadata` | 否 | 任意 string→string 映射（客户端自用，宿主不解释） |
| `allowed-tools` | 否 | 空格分隔的预授权工具串，**标注为 experimental** |

形态与逐级披露（同页）：

```text
skill-name/
├── SKILL.md        # 必需：frontmatter + 指令
├── scripts/        # 可选：可执行代码
├── references/     # 可选：按需读取的文档
├── assets/         # 可选：模板/图片/数据
└── ...             # 其他任意文件
```
- **三级 progressive disclosure**：`metadata`（name+description，常驻上下文，约 100 tokens）
  → `SKILL.md` 正文（技能激活时载入，**建议 <5000 tokens、<500 行**）
  → `scripts/`/`references/`/`assets/`（按需载入，脚本可执行而不必读入上下文）。
- **文件引用只允许一层深**，且用相对技能根的路径；避免深链。
- **校验工具**：`skills-ref validate ./my-skill`。

### 2.2 各生态的「创建」体验

| 生态 | 创建体验 | 来源 |
|---|---|---|
| Agent Skills（通用） | **手工最小路径**：建目录 + 写一份 20 行以内的 `SKILL.md` → 在宿主里 `/skills` 确认被发现 → 用一句自然语言验证激活 | <https://agentskills.io/skill-creation/quickstart> |
| Anthropic `skill-creator` | **模型辅助 + 脚手架 + 打包 + 评测**闭环：`SKILL.md` 定义 6 步流程（捕获意图 → 访谈/调研 → 写 `SKILL.md` → 造测试提示 → 看结果并按反馈重写 → 扩大测试集）；配 `scripts/init_skill.py`（脚手架）、`scripts/package_skill.py`（打包 `.skill`）、`scripts/quick_validate.py`（校验）、`scripts/run_eval.py` / `improve_description.py`（评测与描述优化）；`agents/` 下另设 grader/comparator/analyzer 子智能体 | <https://github.com/anthropics/skills/tree/main/skills/skill-creator>（本机 `curl` 取到 `SKILL.md`、`package_skill.py`、`quick_validate.py` 正文）；仓库文件索引经 `api.github.com` 取到 |
| Claude Code | **从既有派生**（最值得抄的一招）：`/run-skill-generator` 先把应用在干净环境跑起来、把「真正生效的安装命令/环境变量/启动脚本」**录制**成项目技能 `.claude/skills/run-<name>/`；`/verify` 也会把自己试出来的配方写回 SKILL.md | <https://code.claude.com/docs/en/skills>（本机 `curl` 取到 `.md` 全文，103 KB） |
| Claude Code（宿主侧校验口径） | 描述在技能清单里被**截断于 1536 字符**（`description`+`when_to_use` 合计）；打包/上传时**多余字段硬报错**而不是忽略：`Unexpected key(s) in SKILL.md frontmatter: argument-hint. Allowed properties are: allowed-tools, compatibility, description, license, metadata, name` | 同上 |
| 本仓库已有资产（**重要**） | `apps/desktop/packages/jingyun-dsh/resources/builtin-skills/skill-creator/`：`SKILL.md` 356 行 + `scripts/init_skill.py`（模板脚手架，含 Workflow-Based / Task-Based 等结构选项）+ `scripts/package_skill.py` + `scripts/quick_validate.py` + `references/workflows.md`、`references/output-patterns.md`；Apache-2.0，git 已跟踪。同目录 `agent-manager/SKILL.md:75-78` 写明规范：「AI 助手在创建技能时**必须严格调用并执行 `skill-creator` 内置技能下的工具规范与创建流程**」，并点名 `scripts/init_skill.py` | 仓库内（`git ls-files apps/desktop/.../builtin-skills/` 已确认被跟踪）；桌面分叉 README 亦登记 `skill-creator`＝「引导创建自定义技能包」（`apps/desktop/README.md:226`） |
| 公共技能市场（skillhub.cn） | 有「从创意到上架」的公开流程文，但本机只能取到检索指针，正文未取到 | 未取到（`web_fetch` 被 DNS 守卫拒绝；检索到的指针：<https://www.skillhub.cn/tutorials>、<https://cloud.tencent.cn/developer/article/2715316>） |

> **派生关系（谨慎表述）**：仓库内那份 `quick_validate.py:42` 的 `ALLOWED_PROPERTIES = {'name','description','license','allowed-tools','metadata'}`
> 与上游当前版本相比**少了 `compatibility`**，且 `SKILL.md` 的 description 文案与上游也不同
> → 两份文件名相同、错误串逐字相同（`Unexpected key(s) in SKILL.md frontmatter: ... Allowed properties are: ...`），
> **推断为同源早期修订**。此推断不作为事实使用，已列入 §8.3 不确定项。

> **关于「8 个真实导入技能」的取证**：本次真机镜像里**没有** `converted/` 目录
> （上游留证脚本与 `.dshskill` 产物在服务器 `/opt/work/skillhub-import/` 下，本机只镜像了脚本与证据文件），
> 故那 8 个技能（`dev-expert` / `parenting-expert` / `cn-financial-scraper` / `libai-skill` / `baozheng-skills` /
> `smart-charts` / `luhe-paper-free` / `interactive-architecture-diagram`）的**内容形态与元数据全部取自已读到的证据文件**
> `~/.sshwork/sh-import/EVIDENCE.md`（§3 转换包清单 `:138-190`、§6.3 投影 `:317-341`、§2 许可闸门 `:61-135`），
> 未直接读取包内 `SKILL.md` 原文。这 8 个技能给出的两条行业事实已用在本文：
> ① 真实技能普遍**多层目录**（`references/` / `scripts/` / `assets/` / `hooks/` 最多 5 层，如 `dev-expert` 85 个文件）；
> ② 上游 frontmatter 质量参差（重复键、无 `license`、`license: proprietary`），**所以创建入口必须自带校验与许可闸门**。

### 2.3 一个技能最少要有什么才算合格

**最小合格线（四件，缺一不可）**：

1. 目录名 = frontmatter `name`，且满足 kebab-case 与 ≤64（`agentskills.io/specification`；`dsh-skill/lib/index.js:17`）；
2. `description` **非空且同时回答「做什么」和「何时用」**——它是唯一的自动触发依据
   （`agentskills.io/specification`；`dsh-tool-skill` 会话目录即由它渲染）；
3. 正文是**可执行的分步指令 + 一个可用示例**，而不是背景科普
   （「Add what the agent lacks, omit what it knows」，<https://agentskills.io/skill-creation/best-practices>）；
4. 引用包内文件时用**相对技能根的一层深路径**（`agentskills.io/specification`）。

**何时该拆成多个技能**：

| 判据 | 出处 |
|---|---|
| 一个技能封装一个**coherent unit of work**：太窄会逼一次任务加载多个技能，太宽则无法被精确激活 | `best-practices`（同页「Design coherent units」） |
| `SKILL.md` 接近 **500 行 / 5000 tokens** 时，把细节下移到 `references/`，正文只留工作流与「该读哪个文件」的指针 | `agentskills.io/specification`（Progressive disclosure） |
| 一个技能覆盖多域/多框架时，**按变体组织**：`SKILL.md` 只放选择逻辑，`references/aws.md`、`references/gcp.md`… 各管一域 | `anthropics/skills` 的 `skill-creator/SKILL.md`「Domain organization」 |
| 技能**不**包住纯客观领域知识（模型已知的东西）；只补「模型不知道、且不写就会做错」的部分 | `best-practices` |

### 2.4 最值得抄的三条（本文选型依据）

1. **三级 progressive disclosure 的预算纪律**（metadata ≈100 tokens / 正文 <5000 tokens & <500 行 / 资源按需）
   —— 直接决定我们「创建向导」必须产出**简短正文 + 可选 references/**，而不是一篇长文。来源：<https://agentskills.io/specification>。
2. **「先写测试提示、再看真实结果、按反馈重写」的评测闭环** —— 把「创建」从一次性表单变成可迭代过程；
   我们的 P1 可以只取其中最便宜的一半（同样的提示跑两次：有技能 / 无技能）。来源：`anthropics/skills` 的 `skill-creator/SKILL.md`。
3. **从一次真实任务/一次真实运行「录制」成技能** —— 这是唯一能保证内容「有真实经验」而不是模型泛泛而谈的入口，
   也是 Claude Code `/run-skill-generator` 与 `/verify` 的做法。来源：<https://code.claude.com/docs/en/skills>。

---

## 3. 三种创建入口

三种入口**不是三套实现**：它们只在「内容从哪来」这一步不同，**从校验开始到产出 `.dshskill` 完全共用一条流水线**。

### ★ 共用校验器落点（先说清，再逐个讲）

```text
入口①模板脚手架 ┐
入口②模型辅助   ├─► 同一份「技能草稿」领域模型（name/description/whenToUse/正文/可选 resources）
入口③从既有派生 ┘
                        │
                        ▼
      validateSkillDraft()   ← 唯一落点：服务端 SkillArtifactInspector.parseSkillFile 的规则镜像
      （规则真源：SkillArtifactInspector.java:167-244；官方对照：dsh-skill-filesystem/lib/index.js:664-878）
                        │  失败 → 结构化错误（文件 + 行号 + 现值 + 期望 + 怎么改），不落任何字节
                        ▼
      packSkillArchive()     ← 产出 .dshskill（manifest.json + skills/<name>/…）
                        │
                        ▼
      复用既有中心管线：POST /enterprise/admin/v1/skills/versions（skill-catalog.md:74）
      → SkillArtifactInspector.inspect（服务端二次验包，权威）
      → 状态 VALIDATED（草稿）→ 人工 publish → assignments
```

**错误信息必须可操作**（三条硬要求）：

1. **指出位置**：「第 3 行 `name`」而不是「frontmatter 非法」；
2. **给出改法**：「`name` 只能用小写字母/数字/连字符，且不能有连续连字符 —— 试试 `expense-review`」；
3. **不出现技术词给员工侧**（§4）：员工看到的必须是「技能名称」「一句话说明」「什么时候用」，
   技术细节（行号、字段名、YAML）折叠进「技术信息」（沿用 `plugin/packages/ui/src/error-notice.tsx` 的既有形态）。

### 3.1 入口①：模板脚手架（**排第一**）

| 维度 | 内容 |
|---|---|
| **适用场景** | 用户知道「要做一个什么技能」，但不知道技能长什么样；也是另外两个入口的**兜底底稿**（任何入口都能先落模板再改） |
| **交互步骤** | 选模板（≥4 套：流程型 / 清单型 / 工具调用型 / 参考资料型）→ 填「技能名称」（给占位示例）→ 填「一句话说明（做什么 + 什么时候用）」（给正例与反例）→ 可选「我会用到哪些文件/脚本」→ 生成 |
| **产出物** | 一个可直接发布的技能目录：`SKILL.md`（name/description 已填、正文为带 TODO 的结构骨架）+ 可选空的 `references/`；再打包成 `.dshskill` |
| **校验点** | 生成**后**立刻跑 `validateSkillDraft()`；生成**时**用模板保证 name 由「技能名称」机械推导为 kebab-case，`description` 未填**不允许**提交（不给空白页，见 `docs/notes/preset-ux-requirements.md:19`、`:38-40`） |
| **失败如何自愈** | 名称冲突（kebab 后撞已有技能）→ 直接给可用的候选名（`…-2`），并说明「同名会变成同一个技能的新版本」；名称不合规 → 就地改写并提示「已按规则调整为 X，可改回但需满足规则」 |
| **现成可借鉴** | `apps/desktop/packages/jingyun-dsh/resources/builtin-skills/skill-creator/scripts/init_skill.py`（模板骨架含 4 类结构选项）、`references/output-patterns.md`；上游同源脚本见 `anthropics/skills`（§2.2） |

**为什么排第一**：零门槛条文要求「先给成品，不先给编辑器」，且「没选模板时也要有推荐与示例」
（`docs/notes/preset-ux-requirements.md:14-19`）。模板脚手架是唯一能保证「第一次创建就成功」的入口。

### 3.2 入口②：模型辅助（我们自己的 `skill-creator` 技能）

| 维度 | 内容 |
|---|---|
| **适用场景** | 用户只说得清「我想让 Agent 会做 X」；或需要访谈式澄清边界、生成反例、成批产出评测提示 |
| **交互步骤** | 用户在一个**普通会话**里说「帮我做一个报销审核的技能」→ 模型按 `skill-creator` 的流程提问（做什么 / 何时触发 / 期望输出 / 要不要测试用例）→ 起草 `SKILL.md` → 跑 `validateSkillDraft()` → 给用户看草稿与校验结论 → 用户确认后落成草稿版本 |
| **产出物** | 同入口①的 `.dshskill`，另外**可产出**：一组测试提示（P1）、优化后的 description（P1） |
| **校验点** | 模型**不得**自行宣告「合规」：写盘前必须调用同一个 `validateSkillDraft()`，并把**原始校验输出**回显给用户；服务端上传时再验一次（权威） |
| **失败如何自愈** | 校验失败 → 模型必须按错误里给的行号与改法自行修一版**再**给用户看（而不是把错误码抛给用户）；修不动（歧义太大）→ 退回入口①的模板让用户手填 |
| **必守边界** | 模型产出的技能是**草稿**；「必须严格调用 `skill-creator` 规范」这条仓库既有纪律可直接沿用（`apps/desktop/.../agent-manager/SKILL.md:75-78`） |
| **尚不存在的能力** | 我们**还没有**自己的 `skill-creator` 技能（官方没有、本仓库那份在 `apps/desktop` 内、属桌面分叉资产且是 Python 脚本形态）——P1 要新写一份**面向企业技能线**的 `skill-creator`：不依赖 Python、复用 §3★ 的校验器、错误文案走术语降维 |

### 3.3 入口③：从既有技能派生

| 维度 | 内容 |
|---|---|
| **适用场景** | 已有 90% 像的技能（企业内已有，或已导入的第三方技能）；要做一个「同一流程的变体」；或把一次真实任务固化成技能 |
| **交互步骤** | 选一个来源：**a)** 系统里已有技能（列表选择）→ 复制为新草稿；**b)** 一次会话（把刚刚做成的流程抽出来，需用户确认）；**c)** 本机 `<dshHome>/skills/<name>/` 已装技能 → 「另存为」新技能 |
| **产出物** | 一份**依赖来源**的新技能：`name` 必须换新（派生不改原件）、`description` 必须重写（新技能得有自己的触发条件）、正文可继承 |
| **校验点** | 与①②同；**额外两条**：① 新 `name` 不得与任何既有技能同名（同名＝同一技能的新版本，不是新技能）；② 若来源是第三方技能，**必须填 `license`**——这一条在真机上已被证明是硬闸门：Top 100 里 81 个因许可不明/专有/copyleft 被拒（判定规则 `~/.sshwork/sh-import/EVIDENCE.md:63`、统计表 `:65-74`、汇总 `:388`） |
| **失败如何自愈** | 来源技能本身就不合规（历史遗留）→ 派生器**先报出源的问题清单**，并给「只继承合规部分」的选项；来源缺失（已装技能被手工删了）→ 退回入口① |
| **与导入的边界** | 派生出的技能是**我们自己的**版本，`sourceDshVersion` 不得盗用上游坐标（§5.3） |

---

## 4. 零门槛与官方体系

### 4.1 产品宪法条文（逐条落到创建入口）

| 宪法条文 | 出处 | 在创建入口的落法 |
|---|---|---|
| 人人可用：不需要理解 YAML / 插件 / 技能 / 预设 | `docs/notes/product-charter.md:18` | 员工侧入口只有「技能名称 / 一句话说明 / 什么时候用」三个输入（外加可选的模板选择） |
| 极易上手：**3 分钟内**做出第一件有价值的事 | `:19`、`:50` | 默认选中一个模板 + 预填 `description` 示例，用户改两个字即可提交 |
| 默认即最佳：不填也能用，且默认是「能跑起来且安全」的那档 | `:28` | `description` 有推荐句式；调用策略默认「模型可调用 + 用户可调用」（= 官方默认，`dsh-skill-filesystem/lib/index.js:855-857`） |
| 一步即达：主操作不藏在折叠/二级页/「高级设置」里 | `:29` | 「创建」是技能页的主按钮之一，不在弹窗第二层；模板画廊直接铺开 |
| 失败自愈：报错先给「我们帮你修好了」或一键修复；必须给稳定错误码时也要配人话与下一步 | `:31-32` | §3★ 的三条错误要求；技术信息折叠（复用 `plugin/packages/ui/src/error-notice.tsx` 的「人话 + 下一步 + 技术信息」形态） |
| 治理对管理员可见、对员工隐形 | `:22-24` | 员工侧不出现「分配 / 审计 / 退休 / 权限码」；发布与可见范围只出现在 `/skills` 管理端 |
| 反目标：不为一次性方便绕过既有治理（来源、许可、可撤回必须成立） | `:60` | 创建产物一律**草稿**；派生第三方技能必须填 `license`；每次创建留审计 |

### 4.2 术语降维：创建入口的强制文案映射

| 内部/技术说法 | 界面必须说（`docs/notes/product-charter.md:34-46`） | 创建入口的具体文案 |
|---|---|---|
| `frontmatter` / `SKILL.md` / `YAML` / `manifest.json` | **不出现**；需要时「配置文件（自动生成）」 | 一律不出现；文件与字段细节只在管理端「技术信息」折叠区可见 |
| `name` | 「技能名称」 | 输入框标签：**技能名称**；副文案：「只能用小写字母、数字和短横线；会作为技能的唯一标识」 |
| `description` | 「一句话说明」 | 输入框标签：**这个技能做什么**；副文案：「同时写上『什么时候该用它』，Agent 靠它决定要不要用」 |
| `whenToUse` | 「什么时候用」 | 可选的第二个输入框：**什么时候用（可选）** |
| `skill` / `SKILL.md` | 「技能」（必要时「专项技能」） | 全文用「技能」 |
| `disable-model-invocation` / `user-invocable` | ——（不暴露英文） | 两块开关：「让人也能手动选用」「让 Agent 自己判断要不要用」 |
| 分配 / assignment / subject_type | 「可见范围」 | 只在管理端出现，且用「可见范围」 |
| 退休 / RETIRED | 「下架」 | 「下架」 |

### 4.3 官方体系硬约束与**诚实边界**

| 面 | 约束 | 证据 |
|---|---|---|
| Harness 内的员工侧界面（设置 → 技能） | 只用官方原语（`Switch`/`Tag`/`StateDot`/`Modal`/`DisclosureRow`）与官方 `--dsw-*` token；不自创视觉、不硬编码色值 | `docs/notes/preset-ux-requirements.md:53-60`；现存实现 `plugin/packages/ui/src/skill-market.tsx:14` 已 `import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'`，`plugin/packages/ui/src/` 下共 **219 处** `--dsw-*` token 引用 |
| **控制台 `/skills`（管理端）** | ⚠️ **不是一个面**：它是独立 React 应用（TanStack + Beautiful UI），用**自有** token（`--ink` / `--accent` / `--line` 等，`console/src/` 下 246 处 `var(--…)`，`--dsw-*` **0 处**），并有自己的 `console/src/styles/{global,beautiful-ui}.css` | 实测 `grep -rn -- '--dsw-' console/src/` → 0；`grep -rn 'var(--' console/src/` → 246 |
| 结论 | 「官方 `--dsw-*` token」这条约束**只对 Harness 内的插件界面成立**；控制台创建向导应沿用控制台自己的既有 token 与 `ProductDataTable`/`Button` 等既有 atom，**不**去引 `--dsw-*`（引了反而与全站不一致） | 同上 |

### 4.4 创建向导的零门槛检查清单（可直接当验收项）

1. 首次进入页面**不是**空白表单，而是模板画廊（≥4 套，`preset-ux-requirements.md:17-19`）。
2. 只有三个必填输入；其余全部有默认值（`:24-26`、`:38-40`）。
3. 每一步顶部一句话说明「这一步在做什么」（`:27`）。
4. 右侧/顶部常驻**实时摘要卡**：这个技能「能做什么 / 什么时候会被用上 / 会让 Agent 做哪些动作」（`:31-34`）。
5. 提交前能看到校验结论的人话版本；技术细节默认收起（`:44-45`）。
6. 全程 tab 可达、焦点环可见、aria 正确、明暗主题与窄屏成立（`:59`）。

---

## 5. 与现有技能线的关系

### 5.1 创建出来的技能怎么进入中心目录

**复用既有三段管线，不新增第四段**（真源 `docs/compose/spec/skill-catalog.md:74-77`）：

```text
创建（本文）
  → POST /enterprise/admin/v1/skills/versions        multipart(artifact + metadata)，幂等键
      → 服务端 SkillArtifactInspector.inspect 二次验包（权威）
      → 建 SkillVersion，状态 = VALIDATED（这就是现状的「草稿」）
  → POST /enterprise/admin/v1/skills/versions/{id}/actions/publish   （If-Match: revision）
      → PUBLISHED
  → POST /enterprise/admin/v1/skills/{packageId}/assignments/batch   （全量原子替换可见范围）
  → 员工端：GET /enterprise/api/v1/skills → 安装（落盘 <dshHome>/skills/<name>/）
```

**状态机的现状是「三态、没有 DRAFT」**，这一点必须写清：

| 事实 | 出处 |
|---|---|
| 状态只有 `VALIDATED → PUBLISHED → RETIRED`，**没有 DRAFT / PENDING_REVIEW / SCANNING** | DDL 约束 `V35__enterprise_skill_catalog.sql:42`；契约枚举 `contracts/components/skill.yaml:15-17`；`docs/plan/skill-ingest-center.md:49` |
| 所以「草稿」= `VALIDATED`（已验包、未发布），是**既有语义**，不需要新状态 | 同上；`docs/plan/skill-ingest-center.md:295-306` |
| `PENDING_REVIEW` 目前**不存在**，引入它要同时改状态机、DDL 约束、契约枚举、`publish` 的 `from` 参数与控制台筛选 —— 归 P1，且必须与「第二人复核」一起做才有意义 | `docs/plan/skill-ingest-center.md:302-306`、`:708`、`:728` |

### 5.2 版本坐标怎么生成（**我们已踩过的坑**）

| 事实 | 出处 |
|---|---|
| 版本自然键是 **`(package_id, source_dsh_version)`** —— 注意是 `package_id`，不是任务书里曾写的 `(tenantId, skillId, sourceDshVersion)` | `V35__enterprise_skill_catalog.sql:45`；纠正记录见 `docs/plan/skill-ingest-center.md:90` |
| 另有 **`uq_ent_skill_version_hash (tenant_id, sha256)`**：同一租户内**同一份字节只能有一个版本** | `V35__enterprise_skill_catalog.sql:46` |
| 真正的去重是**内容寻址** `(tenantId, skillId, sourceDshVersion, sha256)`，命中即返回既有版本（HTTP 200，`created=false`） | `SkillCatalogService.java:110-113`；`JdbcSkillStore.java:122-133` |
| 版本表**只增不改**（无 update 语义，`SkillVersion` 是 record） | `docs/plan/skill-ingest-center.md:328` |
| 同来源、同 `sourceDshVersion`、**内容却不同** → 撞 `uq_ent_skill_version_source`；上游在同版本号上改内容，**绝不能静默覆盖**，已建议新错误码 `ENT_SKILL_VERSION_CONFLICT`(409) | `docs/plan/skill-ingest-center.md:317`、`:329`、`:547` |
| `sourceDshVersion` **取值必须显式、禁止静默默认**（它是版本自然键的组成部分，直接决定「同一技能能不能并存多个来源版本」） | `docs/plan/skill-ingest-center.md:182`（R5） |

**创建线的坐标建议**：

- 创建产物的 `sourceDshVersion` 用**创建坐标**，与上游/导入坐标分开，例如
  `authoring/<skillId>@<n>`（n 为该技能的第 n 次创建/派生）或 `enterprise-authoring/<dsh版本>+<n>`；
  **格式由实现时冻结并写进契约**（本文只给形态，不发明字段约束）。
- 三条必须成立的性质：① 可读（一眼看出是自建而非外部导入）；② 单调（同一技能再次创建不会撞键）；
  ③ **显式**（由创建流程写入，不由服务端猜）。
- **「改了两个字重新创建」会撞 hash 唯一键**（`V35…sql:46`）→ 内容未变的重复提交应当走幂等返回既有版本（`created=false`），
  内容变了才用新坐标；这条必须在创建向导里如实告诉用户（「内容没变，已复用既有版本」）。

### 5.3 与导入 / 安装两条线如何不打架

| 冲突点 | 规则 | 依据 |
|---|---|---|
| 同一份内容既是「导入的」又是「创建的」 | `uq_ent_skill_version_hash` 让同一 sha256 只能落一个版本 → 谁先到算谁的，第二方得到幂等返回 | `V35…sql:46`；`SkillCatalogService.java:110-113` |
| 创建出来的技能 vs 上游导入的同名技能 | 同名 = 同一 `skill_package` 的**两个版本**（`uq_ent_skill_package_skill (tenant_id, skill_id)`）→ 不是两个技能；界面必须提前说明 | `V35…sql:18`（`uq_ent_skill_package_skill`）；`~/.sshwork/sh-import/EVIDENCE.md:126-133` 真机已遇到「同前台名让位」 |
| 权限 | 创建走既有 `ent:skill:write`；**导入**那条线主张新增更窄的 `ent:skill:import`（只准建草稿，不准 publish/assignments，是对 `plugin_admin` 的收窄） | `docs/plan/skill-ingest-center.md:355-362`。**创建**是完整的写入面（草稿→发布→分配），因此**不需要**新权限码；若 P1 把创建也对非管理员开放，才需要新码 |
| 员工侧「装」与「创建」 | 安装只落盘、不执行；创建只产草稿、不落盘到员工设备 | `docs/compose/spec/skill-catalog.md:118`；§0 |
| 分类字段 | `ent_skill_package.category` 已由 `V37` 建列（varchar(32)，NULL=没有分类），但**契约 / 服务端 / 控制台对它的引用为零**（实测 `grep -rn "category" contracts/... server/.../skill/... console/src/features/skills/ plugin/packages/bundle/src/` → 仅命中 `V37` 迁移本身与无关同名符号） | `V37__enterprise_skill_category.sql:9-13`。**创建向导若要暴露「分类」，必须先补契约 + 服务端投影 + 控制台**（列入 §6、§7 的前置依赖） |
| 配方引用技能（**并行刚落地的第四条线**） | 配方版本新增 `dependencies jsonb`，存的是「引用了哪些技能/插件」的**软引用**：其自己的 `[POS]` 写明「只存软引用，不建跨包外键、不在服务端解析 Cordis 语义」→ 创建/改名/下架技能**不会级联**改配方，界面必须提示「有 N 个智能体正在引用这个技能」而不能靠外键兜底 | `V39__enterprise_preset_dependencies.sql:1-17`（本会话规划期间由并行分支落地）；`docs/plan/enterprise-presets.md:654-655` |

---

## 6. 服务端与前端改动清单

### 6.1 迁移号核对结果（**以仓库实际存在的文件为准**）

**核对方法**：`ls -1 .../db/migration/ | sort -V`（真源目录
`server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/`）。

**两次核对、两个结果 —— 这本身就是结论：**

| 核对时刻 | 目录实际内容 | 说明 |
|---|---|---|
| 本会话开始（第一次） | 共 39 个条目（含 `CLAUDE.md`），`V0__host_baseline.sql` 起、**最高 `V37__enterprise_skill_category.sql`**，**无任何 `V38` 及以上文件** | 与 `docs/plan/skill-ingest-center.md:484-489` 的核对一致 |
| 本会话结束前（第二次，**复查**） | 共 40 个条目，多出 **`V39__enterprise_preset_dependencies.sql`**（mtime 当日 16:50，`git status` 显示为未跟踪新文件） | **并行分支在本方案规划期间就把 `V39` 落地了**，与 `docs/plan/enterprise-presets.md:655` 的预定号完全一致 |

→ **结论：本方案取 `V41`。** 依据：实际最高号已是 `V39`（实体文件），`V38`（中心导入）与 `V40`（连接器）
仍是文档预定号，故下一个可用空号是 **`V41`**。

| 号 | 归属 | 依据 | 仓库实体文件 |
|---|---|---|---|
| **V38** | 中心导入 | `docs/plan/skill-ingest-center.md:489`「建议：本方案的导入迁移取 `V38__enterprise_skill_import.sql`（下一个空号）」；同文 `:695`、`:747`、`:865` 三处重复确认 | **尚无** |
| **V39** | 配方二期 | `docs/plan/enterprise-presets.md:654-655`「建议本方案取 `V39__enterprise_preset_dependencies.sql`」；`:730`、`:809` 确认 | **已存在**（本会话期间落地） |
| **V40** | 连接器 | `docs/plan/connector-architecture.md:584-585`「`V38` 已被预定、`V39` 被配方二期预定 …… **故连接器从 `V40` 起，且开工前必须重新对齐一次迁移号**」；`:594`、`:601` 确认 | **尚无** |
| **V41** | **本方案（创建技能）** | 上述三条顺延所得（最高实体号 `V39` + `V40` 已被预定） | 待创建 |

> ⚠️ **纪律（本会话已被真机证实其必要性）**：迁移号是**抢号制**，文档预定不等于文件存在。
> 本方案规划期间 `V39` 就被并行分支落地了 —— 因此 `V41` **不是承诺**，
> 开工第一步必须**重跑上表的核对命令**，若 `V40`/`V41` 已被占用则继续顺延。
> 另：**不得改动已上线的 `V36`/`V37`**（理由见 `docs/plan/skill-ingest-center.md:490-494`：它们已在线应用）。

### 6.2 服务端

| # | 改动 | 落点（现有文件） | 要点 | 验收 |
|---|---|---|---|---|
| S1 | 抽出**可复用的技能草稿校验规则** | `skill/artifact/SkillArtifactInspector.java:167-244`（`parseSkillFile` / `extractFrontmatter` / 布尔与文本助手） | 抽成独立类（如 `SkillDraftRules`），服务端验包与客户端创建预检**同一份规则**；顺带冻结 §1.3 的两处解析差异口径 | 新增单测：同一批 fixture 走「创建预检」与「上传验包」得到**逐字相同**的错误文案 |
| S2 | 创建草稿的**服务端预检端点**（或复用上传前的 dry-run） | `skill/web/AdminSkillController.java` | 只验包、不落库；返回结构化错误（文件 + 行号 + 现值 + 期望 + 建议） | 契约测试：非法草稿返回 400 + `ENT_SKILL_INVALID_PACKAGE` 的可操作 message |
| S3 | **可选** `ent_skill_draft`（草稿表） | 新迁移 **`V41__enterprise_skill_draft.sql`** | 若需要「未打包的服务端草稿」（断点续编、多人协作）才建；若草稿始终以 `.dshskill` 为界，则**不建表**、只靠中心既有三表 | 迁移静态核验：号不冲突、约束齐备 |
| S4 | 审计 action 扩白名单 + **同步补 Java 枚举** | `V41…sql` 里 `ent_audit_event` 约束；`audit/AuditAction.java` | 新增 `SKILL_DRAFT_CREATED` / `SKILL_DRAFT_VALIDATION_FAILED` 一类 | ⚠️ 这里有**已知前例**：`V36` 加了 `SKILL_MARKS_CHANGED` 到 DDL 白名单，但 `AuditAction` 枚举里没有 → DDL 放行、Java 层写不出去（`docs/plan/skill-ingest-center.md:497`、`:867`）。**必须成对改** |
| S5 | `category` 接线（**仅当**创建向导暴露分类） | `V37…sql`（列已存在）+ `skill/domain/SkillPackage.java` + `skill/persistence/JdbcSkillStore.java` + `contracts/components/skill.yaml` | 列已是 `varchar(32)`、`NULL` = 没有分类；补投影与契约即可，**不需要新迁移** | 列表/详情投影带出 category；契约加字段与长度 |

### 6.3 契约

| # | 改动 | 落点 | 验收 |
|---|---|---|---|
| C1 | 新增草稿校验请求/响应与错误形状 | `contracts/paths/skill.yaml`、`contracts/components/skill.yaml` | 生成的多语言 SDK 可编译；fixture 过严格 Zod；错误码进既有封闭目录 `x-enterprise-error-statuses`（`docs/compose/spec/skill-catalog.md:87`） |
| C2 | 可选：把 `category` 补进 `SkillPackage`/`SkillUploadMetadata` | `contracts/components/skill.yaml:64-74`、`:105+` | `additionalProperties: false` 下不漏字段 |

### 6.4 前端

| # | 改动 | 落点 | 要点 | 验收 |
|---|---|---|---|---|
| F1 | **客户端补 frontmatter 解析**（§1.4 的关键缺口） | `plugin/packages/bundle/src/skill-archive.ts:283-323`（`decodeDshSkillArchive`） | 与 S1 同一套规则；**同一套错误码**（`ENT_SKILL_ARCHIVE_INVALID` 家族，见 `skill-errors.ts`）；`SKILL.md` 存在性检查（`:318`）之后追加 frontmatter 校验 | `plugin/packages/bundle/tests/skill-archive.spec.ts` 扩测：非法 name / 缺 description / 超长 / 旧字段名 / 重复键 / 缺 frontmatter 六类，**逐条**断言错误文案 |
| F2 | 管理端创建向导 | `console/src/features/skills/skill-management-page.tsx`、`skill-editors.tsx`、`console/src/routes/_console.skills.tsx` | 三步（身份 → 内容 → 确认）或模板画廊直入；产出 `.dshskill` 后复用既有上传 serializer；只用控制台既有 atom 与 token（§4.3） | `tsc --noEmit` 零诊断 + `console/src/features/skills/*.test.ts(x)` 扩测；模板→草稿的纯函数投影可单测 |
| F3 | 员工侧入口（可选，P2） | `plugin/packages/ui/src/skill-market.tsx` | 若允许员工「另存为我的技能」，必须走 §3.3 的派生规则与许可闸门；界面只用官方原语与 `--dsw-*`（§4.3） | 真机截图验收（`preset-ux-requirements.md:63-66`）；`EnterpriseErrorNotice` 复用 |
| F4 | 我们自己的 `skill-creator` 技能（P1） | 新技能包（**不经 `apps/desktop`**，不动桌面分叉资产） | 不依赖 Python；正文按 §2.3 的形态；显式要求「写盘前调用同一校验器并把原始输出回显」 | 技能自身通过 §1.4 的客户端校验与服务端验包（吃自己的狗粮） |

---

## 7. 分期与人日

前置依赖统一说明：**P0 一切都要先有 §6.2 S1（共用校验规则）与 §6.4 F1（客户端补 frontmatter）**，
否则三个入口共用校验器无从谈起。人日为**量级估计**（单人日 = 1 人 1 天），不含真机验收与评审往返。

### P0 · 地基与最小可用创建（模板脚手架）

| # | 要点 | 人日 | 前置依赖 |
|---|---|---|---|
| P0-1 | S1：抽出 `SkillDraftRules` 并冻结两处解析差异口径（§1.3） | 1.5–2.5 | — |
| P0-2 | F1：客户端 `skill-archive.ts` 补 frontmatter 解析 + 六类负例测试 | 2–3 | P0-1（规则真源） |
| P0-3 | S2 + C1：服务端草稿预检端点 + 契约（结构化可操作错误） | 2–3 | P0-1 |
| P0-4 | F2：管理端**模板脚手架**创建向导（≥4 套模板，三步内完成） | 3–5 | P0-3 |
| P0-5 | 审计：`SKILL_DRAFT_CREATED` 等扩白名单 + **同步**补 `AuditAction` 枚举 | 0.5–1 | 迁移号核对（§6.1） |

**P0 合计：9–14.5 人日。** 产出：管理员能用一个模板在 3 分钟内产出一个合规草稿，并被两侧同一套规则校验。

### P1 · 模型辅助与审核链

| # | 要点 | 人日 | 前置依赖 |
|---|---|---|---|
| P1-1 | F4：我们自己的 `skill-creator` 技能（访谈 → 起草 → 调同一校验器 → 回显原始输出） | 3–5 | P0-1、P0-3 |
| P1-2 | 入口③「从既有技能派生」（系统内技能 / 已装技能 → 另存为新技能，强制换 `name` 与重写 `description`） | 3–4 | P0-1、P0-4 |
| P1-3 | `PENDING_REVIEW` 状态机（**尚不存在的能力**：现只有三态 → 需改 `SkillVersion.Status`、`V35…sql:42` 约束、契约枚举 `contracts/components/skill.yaml:15-17`、`publish` 的 `from` 参数、控制台筛选第四档） | 2–3 | 必须与「第二人复核」一起做（`docs/plan/skill-ingest-center.md:708`、`:728`） |
| P1-4 | 许可字段与闸门（派生第三方技能必须填 `license`，沿用已实测的许可判断口径） | 1–2 | P1-2 |
| P1-5 | `category` 接线（仅当向导暴露分类；列已在 `V37`，补契约 + 投影） | 1–1.5 | P0-3 |
| P1-6 | 描述优化与最小评测：同提示跑「有技能 / 无技能」两次并给人看得懂的对比 | 3–5 | P1-1 |

**P1 合计：13–21.5 人日。**

### P2 · 员工侧与规模化

| # | 要点 | 人日 | 前置依赖 |
|---|---|---|---|
| P2-1 | 员工侧「另存为我的技能」（派生 + 本地预览，仍只产草稿；界面走官方原语与 `--dsw-*`） | 3–5 | P1-2、P1-4 |
| P2-2 | 服务端草稿表 `ent_skill_draft`（**仅当**确认需要「未打包的服务端草稿」/断点续编/多人协作） | 3–4 | P0-3、迁移号再核对 |
| P2-3 | 从**一次真实会话**录制技能（对齐 `/run-skill-generator` 思路，需用户显式确认哪些步骤可入库） | 5–8 | P1-1、P2-2 |
| P2-4 | 创建质量看板（草稿→发布转化率、校验失败 Top 原因、人均创建数） | 2–3 | P0-3 |
| P2-5 | 分类与检索（若 P1-5 已接线，这里做筛选与推荐位） | 2–3 | P1-5 |

**P2 合计：15–23 人日。**

> **明确标出的「尚不存在的能力」**（不得当成已有基础来排期）：
> ① 官方 / 本仓库企业技能线**都没有**创建能力面（§1.1）；
> ② **客户端不解析 frontmatter**（§1.4，必须补）；
> ③ `PENDING_REVIEW` 状态**不存在**（§5.1）；
> ④ `category` 只有列、**没有契约/服务端/控制台接线**（§5.3）；
> ⑤ 我们**没有**自己的 `skill-creator` 技能（§3.2；`apps/desktop` 内那份属桌面分叉，且是 Python 脚本形态）。

---

## 8. 开放问题 · 明确不做 · 不确定项

### 8.1 开放问题（≤5）

1. **创建入口对谁开放？** 现状写入面是 `ent:skill:write`（管理员）；若员工也能创建，就产生「谁的草稿、谁能发布、
   是否需要一个更窄的 `ent:skill:author`（只建草稿、不准 publish/assign）」——与导入线的 `ent:skill:import` 收窄同构
   （`docs/plan/skill-ingest-center.md:355-362`）。**需要产品裁决**。
2. **草稿的载体边界**：草稿始终就是 `.dshskill`（架构简单、复用现成验包），还是要在服务端存「未打包草稿」
   （断点续编、多人协作更好，但要新表 + 新状态语义）？这决定 P2-2 与 V41 到底要不要表。
3. **派生第三方技能时的许可判断是自动还是人工？** 真机数据显示自动判断能筛掉 81/100，但
   `@user_cd0fcd93/qilinbashe` 那种「脚本 Apache-2.0 + 内容 CC BY-NC-SA」的**混合授权**需要人判断
   （`~/.sshwork/sh-import/EVIDENCE.md:119`）。
4. **创建坐标 `sourceDshVersion` 的最终格式**由谁冻结（本文只给形态）？它一旦写进真实版本就无法更改
   （版本表只增不改，`docs/plan/skill-ingest-center.md:328`）。
5. **评测做到哪一档**？上游 `skill-creator` 有 grader/comparator/analyzer 与 benchmark 聚合；
   我们 P1 只打算做「同提示跑两次」的最小版 —— 是否够用需要与「创建质量看板」一起定。

### 8.2 明确不做（≥4 + 理由）

| 不做 | 理由 |
|---|---|
| **不发明第二套技能格式或第二个 `SKILL.md` 方言** | 包契约真源唯一：`docs/compose/spec/skill-catalog.md` S2.2；官方发现器只认 `skills/<name>/SKILL.md`（`dsh-skill-filesystem/lib/index.js:150-189`）。多一套格式＝多一个永久维护面 |
| **不在 `apps/desktop`（桌面分叉）里做创建功能** | 那是另一条产品线的资产（`jingyun-dsh`，Tauri 桌面壳 + 自有 builtin-skills），与企业技能线的审批/许可/审计治理不同构；只**借鉴**其模板与脚本思路（§2.2、§3.1） |
| **不把 `references/` 的第三方技能正文做「AI 改写后入库」** | 改写会改变上游语义与许可义务，且真机已确认「按用户要求原样保留、未改写」（`~/.sshwork/sh-import/EVIDENCE.md:390`）；派生只能产**新技能**，不覆盖原件 |
| **不做技能正文的安全/内容扫描** | 企业侧当前**没有**内容安全扫描能力（`~/.sshwork/sh-import/EVIDENCE.md:391`「未做：技能正文安全扫描」）；假装做了比不做更危险 —— 真要做需单独立项 |
| **不让创建出来的技能绕过发布直接对员工可见** | 产品宪法反目标「不为了一次性方便而绕过既有治理」（`docs/notes/product-charter.md:60`）；导入线也已确立「绝不『导入即全员可见』」（`docs/plan/skill-ingest-center.md:336`） |
| **不在 P0/P1 引入 Ed25519 签名与信任根** | 已在技能目录的 Out of Scope 里（`docs/compose/spec/skill-catalog.md:126`）；创建线不单独提前它 |

### 8.3 不确定项（逐条写为什么不确定）

| # | 事项 | 为什么不确定 |
|---|---|---|
| U1 | 仓库 `apps/desktop/.../skill-creator/` 与上游 `anthropics/skills` 的**确切派生关系与版本** | 仅能证明「同名脚本 + 逐字相同错误串」（`quick_validate.py:45-49` 对上游同文件），且本仓库那份**少 `compatibility`**；无版号、无 commit 记录 → 只能写「同源早期修订（推断）」，不当事实用 |
| U2 | 上游 `skill-creator` 的**最新行为集合**（`run_eval.py`、`improve_description.py`、`agents/*.md` 的实际语义） | 只取到了文件名索引（`api.github.com`）与 `SKILL.md`/`package_skill.py`/`quick_validate.py` 正文；未逐个取用其余脚本正文 |
| U3 | skillhub.cn「从创意到上架」的**真实流程细则** | 未取到（检索到指针 <https://www.skillhub.cn/tutorials>、<https://cloud.tencent.cn/developer/article/2715316>，正文因 `web_fetch` DNS 守卫未取） |
| U4 | Harness 内**可用的官方 slot 清单与 `--dsw-*` token 清单** | `cordis_inspect_query`（`Slots.listSubTree`、`Theme.listTokens`）两次均 `timed out after 10000ms`（本会话无已连接的 Harness 页面）→ 只能引用仓库内既有用法（`plugin/packages/ui/src/skill-market.tsx:14` 与 219 处 token）作为**存在性**证据，不能声称「当前可用集合」 |
| U5 | 创建向导产出的 `.dshskill` 是否会被官方 `skill-filesystem` **watcher 立即发现** | 安装线已确认落点 `<dshHome>/skills` 是 rank 400 的 `user-dsh` 根、watcher 深度 1、无需重启（`docs/compose/spec/skill-catalog.md:118`）；但**创建**路径（管理端草稿）不落这个目录，员工侧是否要在本机做「试跑一次再提交」需要真机验证 —— 未验证 |
| U6 | `V41` 是否仍是最新空号 | **本会话已亲历一次跳号**：第一次核对时最高为 `V37`，结束前复查已出现实体 `V39__enterprise_preset_dependencies.sql`（并行分支落地）→ 号随时可能被占。`V38`/`V40` 目前仍只有文档预定，**开工前必须重跑 §6.1 的核对命令**（连接器线已在 `docs/plan/connector-architecture.md:585` 立下同样纪律） |
| U7 | 创建产物 `sourceDshVersion` 的具体格式是否会被下游消费方（员工端投影、审计报表）接受 | 该字段当前是**自由文本、无格式校验**（`docs/plan/skill-ingest-center.md:182`），且已确认是版本自然键的组成部分（`V35…sql:45`）→ 格式一旦落库不可改，需真机验证投影与筛选行为 |
