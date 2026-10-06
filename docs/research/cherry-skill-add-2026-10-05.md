/**
 * [INPUT]: 依赖 Cherry Studio 2.1.4 完整源码（本机解包于 `/tmp/cherry/cherry-studio-main`，非打包产物），逐文件实读 `src/shared/utils/skillMarketplace.ts`、`src/shared/types/skill.ts`、`src/renderer/utils/skillSearch.ts`、`src/main/ai/skills/{SkillService,skillArchive,systemSkillSources,skillPaths}.ts`、`src/main/utils/{zipSafety,markdownParser,file/path}.ts`、`src/main/ai/agents/createBuiltinSkillSession.ts`、`src/main/utils/builtinSkills.ts`、`src/renderer/{components/resourceCatalog/catalog/ResourceGrid.tsx,hooks/useSkillLauncher.tsx,hooks/resourceCatalog/useResourceCatalogController.ts,pages/agents/skillComposerLaunch.ts,pages/agents/AgentPage.tsx,i18n/locales/zh-cn.json}`；以及本仓真源 `plugin/packages/bundle/src/{skill-install,skill-archive,zip-archive,skill-errors}.ts`、`server/.../skill/artifact/SkillArtifactInspector.java`、`plugin/packages/ui/src/preset-launch.ts`。
 * [OUTPUT]: 提供一份带证据的「添加技能」四路功能取证报告与一张**缺口对照表**（Cherry 有 / 我们有 / 缺口 / Cherry 哪条比我们弱），供排工期用；不改任何产品代码。
 * [POS]: research 目录的竞品取证层。**这份报告的价值在 §6 的缺口表，不在 §1-§5 的功能复述**——§1-§5 是「上游怎么做」的依据，§6 是「我们缺什么、哪条必须补」的裁决依据。取证纪律：每个结论带 `文件:行号`；下「不存在」结论前一律先做阳性对照（本报告记录了两次对照，见 §0.2 与 §3.3）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

# Cherry Studio「添加技能」功能取证报告

- **取证对象**：Cherry Studio **2.1.4**（`package.json` 第 4 行 `"version": "2.1.4"`），本机解包完整源码
- **权威坐标（本轮由用户提供仓库地址后实核补齐，供复现）**：`CherryHQ/cherry-studio` tag **`v2.1.4`** = commit **`072aab935a0340b3e5f288b8328f3aaae24c918d`**（`git ls-remote --tags` 实测命中）。取证当时的本机路径 `/tmp/cherry/cherry-studio-main` **已不存在**；后续复核一律按该 tag + commit。
- **取证日期**：2026-10-05
- **目的**：在写任何移植代码之前，查清上游「添加技能」（在线搜索 / 系统搜索 / 本地导入 / 通过 Agent 创建）的真实实现，作为排工期的证据
- **结论摘要**：四项功能 Cherry 全部可用且**无鉴权**；但其中**三道 ZIP 安全门禁我们完全没有**，且我们的等价能力在别处已比它严。详见 §6。

---

## 0. 取证方法与纪律

### 0.1 为什么先取证

本轮项目已吃过三次「照想象写上游不存在的东西」的亏：① 以为 `plugin/packages/contracts/components/skill.yaml` 存在（真源在仓库根 `contracts/`）；② 以为官方插件管理器弹层可接缝（`openInstall` 是它自己的私有方法）；③ 以为 `unevaluatedProperties` 能跨 `$ref` 传播（networknt 实测不传播）。**三次都是「凭推测落地」。** 本报告的全部价值就是把这个失败模式再堵一次。

### 0.2 阳性对照记录（重要）

下「不存在」结论前必须证明检索能命中。本报告做过两组对照：

**第一组（Cherry 侧）**：
```
$ grep -c "buildSystemSkillSources" src/main/ai/skills/systemSkillSources.ts
1                                              ← 阳性命中，证明检索有效
$ grep -rc "thisSymbolDefinitelyDoesNotExist" src/main/ai/skills/
（无输出）                                       ← 阴性对照，检索能区分真伪
```

**第二组（我们侧，且第一次做错了）**：
```
$ grep -rn "realpath" plugin/packages/bundle/src/skill-archive.ts | head -3
（无输出）                          ← 阳性对照失败！该文件本来就不含 realpath
$ grep -rn "fold|Fold|碰撞|toLowerCase|zip-slip" skill-archive.ts skill-install.ts
全部 0 命中                        ← 这些"不存在"结论当时全部无效
```

**重做对照**：
```
$ grep -c "maxEntries" plugin/packages/bundle/src/skill-archive.ts
1                                              ← 阳性命中，检索有效
```

**教训（已写进本报告，因为它正是本项目这轮的病根）**：阳性对照**必须用一个确定存在于目标文件的符号**。拿「另一个文件里有的符号」去对照「这个文件」会得到假阴性，**进而把「我没找到」误报成「它不存在」**。§3 的全部「我们没有」结论都是在重做对照之后才成立的。

---

## 1. 四个在线搜索源的真实协议

### 1.1 源枚举与总入口

- 源枚举：`src/shared/types/skill.ts:13` `SkillSearchSourceSchema = z.enum(['claude-plugins.dev', 'skills.sh', 'clawhub.ai', 'github'])`
- 聚合层：`src/shared/utils/skillMarketplace.ts:380-414` `searchSkillMarketplaces(query, fetchJson, onSourceFailure?)`
- 渲染层薄封装：`src/renderer/utils/skillSearch.ts:41-47` `searchSkills(query)`

**关键结构差异：枚举有 4 个，但 `MARKETPLACE_SOURCES` 只有 3 个**（`skillMarketplace.ts:345-374`）。`github` 源**不参与搜索聚合**——它是「用户粘贴一个 GitHub URL」的直装路径（`buildGithubSkillResult`，`:191-211`），走 `parseGithubSkillUrl` 解析。Cherry 的 UI 把它单独做成「用户输入 URL」那一档（`SkillMarketplaceDialog.tsx` 的 `isGithubSource` 分支）。

### 1.2 三个聚合源逐个取证

| 维度 | `skills.sh` | `claude-plugins.dev` | `clawhub.ai` |
|---|---|---|---|
| **端点（逐字）** | `https://skills.sh/api/search` | `https://claude-plugins.dev/api/skills` | `https://clawhub.ai/api/v1/search` |
| **出处** | `skillMarketplace.ts:349` | `:358` | `:368` |
| **方法** | GET | GET | GET |
| **query 参数** | `q` | `q` + `limit=20` | `q` |
| **出处** | `:350` | `:359-360` | `:369` |
| **分页** | **无**（无 offset/limit 读取） | 响应带 `total`/`limit`/`offset` **可选字段，但代码从不读** | **无** |
| **响应顶层键** | `{query, skills[], count}` | `{skills[], total?, limit?, offset?}` | `{results[]}` |
| **响应 schema 出处** | `types/skill.ts:64-68` | `types/skill.ts:44-49` | `types/skill.ts:85-87` |
| **列表提取** | `parsed.data.skills.map(...)` `:311` | `parsed.data.skills.flatMap(...)` `:73` | `parsed.data.results.flatMap(...)` `:328` |
| **schema 失败** | `throw new Error('Invalid skills.sh search response')` `:309` | 同形 `:71` | 同形 `:326` |

### 1.3 是否需要鉴权 —— **三个源都不需要**

```
$ grep -n "apiKey|Authorization|headers" src/renderer/utils/skillSearch.ts src/shared/utils/skillMarketplace.ts
（无输出）
```
`fetchJson`（`skillSearch.ts:27-31`）就是裸 `fetch` + `resp.ok` 检查，**不带任何 header**。三个端点都是公开匿名可读。

⇒ **对我们的意义**：技术上我们可以照抄（零凭据成本），但**这正是我建议不做它的原因**——公开源 = 无企业审核、无可见范围控制、无制品审计。**"能抄"不等于"该抄"。**

### 1.4 每个源的特色字段（**这是移植时最容易搞错的地方**）

**`skills.sh`**（`normalizeSkillsSh`，`:307-322`）：
- `id` 形如 `"owner/repo/skill-name"`（`types/skill.ts:56` 注释逐字），**这是三段**
- `source` 形如 `"owner/repo"`（`:60`），代码取 `skill.source.split('/')[0]` 作 author
- `description` 恒为 `null`（**该源不返回描述**），`stars` 恒 `0`
- `installSource` = `skills.sh:${id}`

**`claude-plugins.dev`**（`normalizeClaudePlugins`，`:69-95`）：
- **有真描述、真 star、真 install 数**（这是三者中唯一内容丰富的源）
- `metadata.repoOwner` / `metadata.repoName` / `metadata.directoryPath` 决定**能不能装**（`:81`）
- **fail-closed 规则（值得学）**：`:79-81` 注释逐字「Skip entries without a resolvable install source (repo owner/name are required to clone, directoryPath is required to avoid ambiguous repo scans that may install a different skill)」⇒ **装不出来就丢弃，不猜**
- `directoryPath` 缺失时**有回退**：从 `sourceUrl` 反解（`getDirectoryPathFromGithubTreeUrl`，`:38-67`），且该函数对 host/owner/repo/type/branch 五项全校验（`:52-61`，只认 `github.com` + `tree` + `main`/`master`）
- `installSource` = `claude-plugins:${owner}/${repo}/${directoryPath}` —— 注释强调是**真实目录**不是显示名（`:91`）

**`clawhub.ai`**（`normalizeClawhub`，`:324-343`）：
- `results[]` 而非 `skills[]`（**顶层键就不同**）
- 字段名完全不同：`displayName`（不是 `name`）、`summary`（不是 `description`）、`ownerHandle`、`score`
- `ownerHandle` 缺失即**丢弃**（`:329`，扁平化 `flatMap` 返回 `[]`）
- `installSource` = `clawhub:${ownerHandle}/${slug}`
- ⚠️ **额外**：`ClawhubSkillDetailSchema`（`types/skill.ts:89-118`）带 `moderation.isSuspicious` / `isMalwareBlocked` —— **唯一带审核态的源**，但搜索结果里用不到，只在详情页

### 1.5 超时、部分成功与去重

- **超时**：`skillSearch.ts:10` `REQUEST_TIMEOUT_MS = 15_000`，经 `AbortController` 实现（`:17-25`），`finally` 里 `clearTimeout`
- **HTTP 非 2xx**：`skillSearch.ts:29` `if (!resp.ok) throw new Error(\`HTTP ${resp.status}\`)`
- **部分成功保留，全失败才 reject**：`skillMarketplace.ts:388-405` 用 `Promise.allSettled`；`failedSourceCount === MARKETPLACE_SOURCES.length` 时才 `throw new Error(SKILL_SEARCH_FAILED_ERROR)`（`:403-405`）
- **单源失败只记日志**：`onSourceFailure?.(...)`（`:399`），渲染层接的是 `logger.warn`（`skillSearch.ts:43`）
- **跨源去重**：`skillMarketplace.ts:407-413` 按 **`result.name.toLowerCase()`** 去重，先到先得
- **防抖**：300ms（`SkillMarketplaceDialog.tsx:33` `SEARCH_DEBOUNCE_MS = 300`）

### 1.6 `github` 直装路径（第四个源，不参与搜索）

`parseGithubSkillUrl`（`:140-188`）逐字规则：
- 接受两种 host 形态：`github.com/{owner}/{repo}/blob/{ref}/{dir}/SKILL.md` 与 `raw.githubusercontent.com/...`（`:163-168`）
- **文件名必须是 `SKILL.md` 或 `skill.md`**（`:173`）—— 注释理由（`:137-139`）：目录才是技能标识，裸 repo/tree URL 会让安装器猜
- 支持 `refs/heads/` / `refs/tags/` 前缀（`:177-180`）
- **在 `new URL` 之前先查原始 path**（`:146-151`），注释理由（`:149-150`）：WHATWG URL 会先吃掉字面点段，先查原始 path 才不会把目录穿越变成合法 ref
- `invalidPathPart`（`:108-120`）逐条拒：空、`trim` 不等、`.`、`..`、含 `\`、含 `/`、含 `\0`

---

## 2. 15 个系统目录发现规则

### 2.1 目录清单（`systemSkillSources.ts:19-38`，逐字）

| `id` | `name` | 路径 | 备注 |
|---|---|---|---|
| `agents` | Agent Skills | `~/.agents/skills` | |
| `agents-xdg` | **Agent Skills** | `$XDG_CONFIG_HOME/agents/skills` | ⚠️ **与上一行重名** |
| `claude-code` | Claude Code | `$CLAUDE_CONFIG_DIR/skills`（默认 `~/.claude`） | |
| `codex` | Codex | `$CODEX_HOME/skills`（默认 `~/.codex`） | |
| `cursor` | Cursor | `~/.cursor/skills` | |
| `gemini-cli` | Gemini CLI | `~/.gemini/skills` | |
| `github-copilot` | GitHub Copilot | `~/.copilot/skills` | |
| `opencode` | OpenCode | `$XDG_CONFIG_HOME/opencode/skills` | |
| `openclaw` | OpenClaw | `~/.openclaw/skills` | |
| `clawdbot` | Clawdbot | `~/.clawdbot/skills` | |
| `moltbot` | MoltBot | `~/.moltbot/skills` | |
| `qoder` | Qoder | `~/.qoder/skills` | |
| `qoder-cn` | Qoder CN | `~/.qoder-cn/skills` | |
| `qwen-code` | Qwen Code | `~/.qwen/skills` | |
| `minimax-code` | minimax Code | `~/.minimax/skills` | |

⚠️ **重名是真实存在的**（`agents` 与 `agents-xdg` 的 `name` 都是 `"Agent Skills"`）。UI 侧只能靠 `id` 区分，靠 `name` 会显示成两个一模一样的条目。

环境变量回落规则：`resolveHomePath(home, configuredPath, fallback)`（`:12-14`）—— `configuredPath?.trim()` 为真则 `path.resolve(home, value)`，否则 `path.join(home, ...fallback)`。

### 2.2 目录不存在怎么办 —— **静默跳过**

`SkillService.discoverSystem`（`:331-397`）对每个 `source` 调 `findAllSkillDirectories(source.directoryPath, source.directoryPath)`（`:355`）。该函数（`markdownParser.ts:249-296`）内：

```js
} catch (error: any) {
    // Ignore errors when reading subdirectories (e.g., permission denied)
    logger.debug('Failed to read subdirectory during skill search', {...})
}
```

⇒ **目录不存在 = `readdir` 抛 ENOENT = 被 catch 吞掉 = 返回空数组 = 该源没有候选**。**不报错、不中断、不记 warn（只 `logger.debug`）。**

### 2.3 去重与三态判定（本节最值得学的部分）

`discoverSystem` 的去重键是 **canonical 路径**（`realpath` 后的绝对路径），**不是技能名**（`:349` `const candidates = new Map<string, SystemSkillCandidate>()`，`:358` `const canonicalPath = await fs.promises.realpath(entryPath)`，`:368` `candidates.get(canonicalPath)`）。

**三个关键细节**：

1. **同一目录挂在多个源下 → 合并 `placements[]`，不重复列**（`:369-372`）：
   ```js
   const duplicate = candidates.get(canonicalPath)
   if (duplicate) { duplicate.placements.push(placement); continue }
   ```
2. **受管目录本身要排除**（`:358-359` + `:346-347`）：`canonicalPath === managedRoot || startsWith(managedRoot + sep)` 就 `continue` —— 防止 Cherry 自己的库被当成"系统技能"重复发现
3. **候选 id = canonical 路径的 sha256**（`:379` `createHash('sha256').update(canonicalPath).digest('hex')`）

**三态判定（`:373-376`，逐字）**：
```js
const registered    = installedByPath.get(canonicalPath)          // 按路径匹配已装
const folderConflict = installedByFolder.get(normalizeFolderKey(folderName))  // 按折叠名匹配
const status = registered ? 'registered' : folderConflict ? 'conflict' : 'available'
```

| `status` | 判定条件 | UI 含义 |
|---|---|---|
| `registered` | 该 canonical 路径**已被导入过**（`installedByPath` 命中，带 `registeredSkillId`） | 已装 |
| `conflict` | 路径没装过，但**折叠后的目录名**已被别的技能占用 | 冲突，导入会被拒 |
| `available` | 两者都没命中 | 可导入 |

**去重的两个索引**：
- `installedByPath`（`:335-343`）：只收 `source === 'system'` 且 `sourceUrl` 以 `file:` 开头的已装技能，用 `fileURLToPath` 转回路径；转换失败静默跳过
- `installedByFolder`（`:345`）：`normalizeFolderKey(skill.folderName)`，实现是 `folderName.toLowerCase()`（`skillPaths.ts:25-27`，注释逐字「Case-folding key for folder names, so a case-only difference never reads as two skills」）

### 2.4 导入时的 fail-closed（`importSystem`，`:400-425`）

三条硬拒，任何一条命中即抛：
1. 目录不在 `discoverSystem()` 的候选里 → `Directory is not a discovered system skill`
2. `candidate.registeredSkillId` 存在 → `System skill is already imported`
3. `candidate.status === 'conflict'` → `A different skill already uses the folder name`

**注意顺序**：先 `realpath` 归一（`:402`）再查候选（`:404`），所以传入符号链接路径也会被归一到真实路径再比对。

### 2.5 ★行号复核（Lead 在上游 tag `v2.1.4`（`072aab93`）上实测）

**取证当时的 `/tmp/cherry/cherry-studio-main` 已不存在，本节是事后在真源上重做的核对。**
取得方式（本机唯一可行的一条，全量 clone 会 `curl 56 Connection timed out`）：

```bash
git clone --depth 1 --single-branch --branch v2.1.4 \
  --filter=blob:none --no-checkout https://github.com/CherryHQ/cherry-studio cherry-lite
# 之后按需 git show HEAD:<path>（promisor 拉单个 blob），无需 checkout
```

**结论：§2.3/§2.4 的语义逐条命中（含 `installedByPath` 只收 `source==='system'`、三态三目表达式逐字、先 `realpath` 再查候选），但 `discoverSystem`/`importSystem` 体内的行号有 1–4 行偏移。以下为实测值，冲突时以此为准：**

| 本报告原写 | **实测** | 内容 |
|---|---|---|
| `:335-343` | ✅ 准 | `installedByPath`（只收 `source === 'system'` 且 `sourceUrl.startsWith('file:')`） |
| `:345` | ✅ 准 | `installedByFolder` = `normalizeFolderKey(skill.folderName)` |
| `skillPaths.ts:25-27` | ✅ 准（连注释逐字） | `normalizeFolderKey` = `folderName.toLowerCase()` |
| `:349` | **`:350`** | `candidates` Map |
| `:358` | **`:359`** | `const canonicalPath = await fs.promises.realpath(entryPath)` |
| `:368` | **`:367`** | `candidates.get(canonicalPath)` |
| `:369-372` | **`:368-371`** | 重复 → `placements.push` + `continue` |
| `:373-376` | **`:377-379`** | 三态；原文逐字 `const status = registered ? 'registered' : folderConflict ? 'conflict' : 'available'` |
| `:379` | **`:382`** | candidate id = `createHash('sha256').update(canonicalPath).digest('hex')` |
| `:358-359`、`:346-347` | **`:360`**、**`:346-348`** | 受管根排除 `canonicalPath === managedRoot \|\| canonicalPath.startsWith(managedRoot + path.sep)` |
| `:400-425` | **`:405-428`** | `importSystem` 整体；三条硬拒在 **`:409-411` / `:412-414` / `:415-417`**；`realpath` 在 **`:406`** |
| `:402`、`:404` | **`:406`**、**`:408`** | 「先 realpath 再查候选」 |

**★一处本报告未记、但移植时必须知道的上游取舍**：Cherry 在 `:360` **主动排除它自己的受管根**（`canonicalPath === managedRoot || canonicalPath.startsWith(managedRoot + path.sep)`）⇒ 它不会把自家库里的技能当成"系统技能"再发现一遍。
我们**反过来要包含 `<dshHome>/skills`**：它既是我们落盘的地方，**也是用户自己的技能根**，且是本机唯一确定的根（实测 `HOME` 下无任何其它 CLI 技能根）。**这是与上游相反的取舍，必须在实现处写明理由**，否则会被误读成漏抄了这条排除。

**★另一条可直接引用的上游事实**（本报告原文未点名行号）：`SkillService.ts:419` 的
`await this.installSkillDir(canonicalPath, 'system', pathToFileURL(canonicalPath).href, {…})`
⇒ 「系统搜索导入」的来源标签 `'system'` **是上游自己的取值**，不是我们的发明。

---

## 3. ZIP 本地导入的安全门禁（**我们必须比它严**）

### 3.1 上限常量确切值（`skillArchive.ts:23-31`，逐字）

| 常量 | 值 | 注释原文（逐字） |
|---|---|---|
| `MAX_SKILL_SIZE` | `100 * 1024 * 1024` = **100 MB** | 「What one installed skill may weigh — the directory holding SKILL.md is all that reaches the library.」 |
| `MAX_SKILL_FILES` | **20 000** | 同上 |
| `MAX_ARCHIVE_SIZE` | `1024 * 1024 * 1024` = **1 GB** | 「What may be unpacked while looking for that skill. An archive is routinely a repository zipball carrying one skill plus the whole repository around it, none of which is installed, so this bounds the temp directory rather than the skill.」 |
| `MAX_ARCHIVE_ENTRIES` | **50 000** | 同上 |

**为什么 `MAX_ARCHIVE_*` 远大于 `MAX_SKILL_*`（这是设计而非疏漏）**：ZIP 常是**整个仓库的 zipball**，里面只有一个技能 + 一大堆不装的东西。`MAX_ARCHIVE_*` 约束的是**临时解包目录**，`MAX_SKILL_*` 约束的是**真正进库的技能目录**。两者测的是不同对象。

**我们的对应值（更严）**：

| 维度 | Cherry | 我们 | 出处 |
|---|---|---|---|
| 压缩包字节 | 1 GB（解压后总量） | **50 MiB**（`52_428_800`） | `skill-archive.ts:17` |
| 解压后总量 | 1 GB | **200 MiB**（`209_715_200`） | `skill-archive.ts:19` |
| 条目数 | 50 000 | **10 000** | `skill-archive.ts:21` |
| 单 SKILL.md | 无单文件上限 | **256 KiB**（`262_144`） | `skill-archive.ts:25` |
| 技能条目数/包 | 无 | **200** | `skill-archive.ts:23` |

**⇒ 在总量与条目数上我们比它严 5 倍。**

### 3.2 三道检查各自防什么

**① `assertZipEntriesWithin`（`zipSafety.ts:15-25`）—— zip-slip 纵深防御**

```js
const dest = path.resolve(baseDir, name)
if (dest !== root && !dest.startsWith(root + path.sep)) throw new Error(`Unsafe zip entry path (zip-slip): ${name}`)
```

注释逐字（`:9-12`）：「node-stream-zip rejects malicious names at parse time (`validateName`), but nothing at the extract() call boundary enforces containment — this keeps the guarantee **independent of lib internals or config (`skipEntryNameValidation`)**」。

⚠️ **「不信任库的内部实现」这一层，我们没有对应物** —— 我们的 `zip-archive.ts` 是**手写解析器**（`CLAUDE.md` 逐字「手写最小 ZIP 中央目录解析」），所以这个问题对我们**天然不存在**（自己就是实现方）。**但也意味着我们没有第二道网。**

**② `assertNoFoldedPathCollisions`（`zipSafety.ts:35-63`）—— 大小写 / Unicode 折叠碰撞**

注释逐字（`:26-31`）：「Such paths land on one file on Windows and default macOS volumes, so the extracted content would depend on **the platform and on which entry was written last**. Colliding archives are **rejected rather than resolved**: there is no correct entry to keep.」

实现要点：按路径分段建**前缀树**（`Map<string, PathNode>`），每段经 `foldPathSegment` 折叠后作键。注释说明为何不简单 rejoin（`:45-47`）：「an entry name can nest tens of thousands of levels deep, so re-joining every prefix would block the main process for minutes」。

`foldPathSegment`（`file/path.ts:82-84`）：
```js
return segment.normalize('NFC').toLowerCase()
```
注释逐字（`:76-81`）：「Unlike `isPathInside`, it folds on **every host**, so a check built on it gives the same answer on every platform. `toLowerCase` (not `toLocaleLowerCase`) to keep this free of locale surprises such as tr-TR's I→ı.」

⇒ **`Skills/SKILL.md` 与 `skills/skill.md` 在 Windows/macOS 默认卷上会落到同一个文件，但 ZIP 里是两条合法条目。Cherry 拒；我们不拒。**

**③ `isOutsidePath`（`file/path.ts:70-72`）—— 相对路径逃逸**

```js
return relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)
```
注释逐字（`:61-68`）：「matches `..` only as a **whole segment** — so a child directory literally named `..archive` is not mistaken for an escape」。

**这条我们有等价物**（`zip-archive.ts:85-95` 拒绝对路径/盘符/反斜杠/`..`/`.` 段/空段/控制字符/超长段）。

**④ `assertNoSymlinkComponents`（`skillArchive.ts:118-127`）—— 路径逐段 lstat**

注释逐字（`:113-117`）：「A symlinked component silently redirects the requested path elsewhere in the repository, so an explicitly selected directory would install a skill other than the one shown to the user. **The realpath containment check alone cannot see this**: the target stays inside the repository.」

⇒ **只做 `realpath` 检查不够**：`realpath` 只能证明"最终目标在仓库内"，不能证明"路径没穿过符号链接"。我们 `skill-install.ts` 的 `resolveInstalledSkillTarget` 同样是 `lstat`（不跟随）+ `realpath` 逐字比对，**形状等价**。

### 3.3 我们缺什么（**阳性对照已重做，见 §0.2**）

```
$ grep -c "maxEntries" plugin/packages/bundle/src/skill-archive.ts
1                                     ← 对照有效，下面的 0 命中可信

$ grep -rn "fold|Fold|碰撞|toLowerCase|zip-slip" skill-archive.ts skill-install.ts
全部 0 命中
```

| Cherry 门禁 | 我们 | 判定 |
|---|---|---|
| `assertNoFoldedPathCollisions`（大小写/Unicode 折叠碰撞） | **无** | ❌ **缺，必须补** |
| `assertZipEntriesWithin`（对第三方库的不信任层） | 不适用（自写解析器） | ➖ 无需补，但**无第二道网** |
| `assertNoSymlinkComponents`（逐段 lstat） | `resolveInstalledSkillTarget` 同形 | ✅ 等价 |
| `isOutsidePath`（整段 `..` 匹配） | `validateEntryPath` + `requireRelativeSkillPath` | ✅ 等价且更严 |
| `MAX_ARCHIVE_ENTRIES` | 10 000 vs 它 50 000 | ✅ 我们更严 |
| 单文件字节上限 | 256 KiB vs 它无 | ✅ 我们更严 |
| 重复路径检测 | `zip-archive.ts:204` `if (seen.has(path)) throw invalid('archive contains a duplicate path')` | ⚠️ **见下** |

**⚠️ 重复路径的差别（值得单独记）**：我们的 `seen` 集合用的是**原始 path**（`:203-205`，`path = segments.join('/')`，未折叠）。所以我们能拒「完全相同的两条路径」，但**拒不了「`A.md` 与 `a.md`」这种折叠后相同的**。

⇒ **结论：我们需要的是把 `seen` 的键换成 `foldPathSegment` 之后的值，或在收集后补一次折叠碰撞检查。这是本报告发现的最具体、最可执行的一个缺口。**

### 3.4 解包后如何判定"哪个目录才是要装的技能"（`resolveSkillDirectory`，`skillArchive.ts:129-199`）

规则**按优先级**：

1. **显式 `directoryPath`**（`:134-149`）：解析后必须不逃逸（`:138-141`）→ 逐段无符号链接（`:142`）→ 找 `SKILL.md`（`:143`）
   **fail-closed 注释逐字（`:146-148`）**：「an explicit directoryPath with no SKILL.md must **NOT** fall back to guessing a different candidate in the repo — the user confirmed skill A and must not get skill B.」
2. **指定 `skillName`**（`:153-179`）：扫全部候选按 frontmatter `name` 匹配
   - 恰好 1 个 → 用它
   - **>1 个 → 抛错**（`:175-177` `Multiple SKILL.md files declare the specified skill`）
   - 0 个 → 抛错
3. **无任何指定**（`:181-198`）：
   - 候选恰好 1 个 → 用它
   - 候选 >1 个 → **取第一个 + `logger.warn` 记 `candidateCount` 与 `selected`**（`:186-192`）
   - 候选 0 个但根有 `SKILL.md` → 用根
   - 否则抛错

⚠️ **第 3 档的"取第一个"是弱 fail**（有 warn，但行为是猜）。注释理由不充分。我们没有对应面（我们的包是**自描述**的：每条技能必须带 `SKILL.md`，不存在"猜哪个目录"的问题）。

**扫描器规则**（`findAllSkillDirectories`，`markdownParser.ts:249-296`）：
- 默认 `maxDepth = 10`（`:251`），深度超则返回空（`:257-259`）
- **找到 `SKILL.md` 就停，不再下钻**（`:262-271`）—— 技能不嵌套
- 跳过 `node_modules`（`:279`）
- 跳过点开头条目，**除非在根层且名字是 `.agents`/`.claude`/`.gemini`**（`:280`，`ALLOWED_HIDDEN_DIRS`，`:33`）
- 符号链接指向目录**也算目录**（`isDirectoryOrSymlinkToDirectory`，`:59-70`）—— ⚠️ 这条与 §3.2 ④ 的逐段 lstat 是互补的：扫描时跟随、选中时拒绝
- `SKILL.md` 大小写**不敏感**：`SKILL_MD_VARIANTS = ['SKILL.md', 'skill.md']`（`:31`）

**目录名净化**（`sanitizeFolderName`，`skillPaths.ts:12-22`）：`/` 与 `\` → `_`、去 NUL、`[^a-zA-Z0-9_-]` → `_`、超长截断。

⚠️ **我们没有目录名净化这一步** —— 我们的技能目录名**必须**匹配 kebab 正则 `^[a-z0-9]+(?:-[a-z0-9]+)*$`（`skill-archive.ts:28`），不合法直接拒（`:129-131`）。**我们比它严**（它接受任意名字后净化，我们只接受规范形状）。

---

## 4. 「通过 Agent 创建」的完整链路

### 4.1 入口：找到内置的 `skill-creator`

`useResourceCatalogController.ts:144-156` 逐字：
```js
const handleCreateSkillWithAgent = useCallback(() => {
  const creator = allResources.find(
    (resource) => resource.type === 'skill' && resource.raw.source === 'builtin'
                && resource.raw.folderName === 'skill-creator'
  )
  if (!creator || creator.type !== 'skill') {
    toast.error(t('settings.skills.creatorUnavailable'))
    return
  }
  void onLaunchSkill?.(creator.raw)
}, [allResources, onLaunchSkill, t])
```

⚠️ **它不拼提示词**。它**找到内置技能 `skill-creator`，然后走和"试用技能"完全同一条路**启动它。创建逻辑（怎么写 `SKILL.md`、目录规范、评测流程）**全在那个技能文件里**，随技能版本升级。

### 4.2 未全局启用时的确认分支（`useSkillLauncher.tsx`，94 行）

```
skill.isGlobalEnabled 为真
  → createSessionAndOpen(skill)                    :26-34
skill.isGlobalEnabled 为假
  → setPendingSkill(skill)  → 弹 ConfirmDialog      :38-41
  → 用户确认 → enableSkill({isGlobalEnabled: true})  :58
             → createSessionAndOpen(enabledSkill)   :60
```

三段文案（`zh-cn.json` 逐字核对）：
```
settings.skills.enableToTry.title       = '启用此技能？'
settings.skills.enableToTry.description = '必须先全局启用 {{name}}，Cherry Assistant 才能使用它。'
settings.skills.enableToTry.confirm     = '启用并试用'
```

失败文案：`settings.skills.launchFailed` = `'无法试用 {{name}}'`（`:46`、`:63` 两处）。

⚠️ **注意 `true` 口径**：`createSessionAndOpen` 只在成功 `openRoute` 后落到 catch 外；`isLaunching` 状态保证不会重复点（`:27`、`:61`）。

### 4.3 会话创建：单事务、原子

`createBuiltinSkillSession.ts:15-41` 逐字要点：

```js
const ensured = application.get('DbService').withWriteTx((tx) => {
  const skill = agentGlobalSkillService.getByIdTx(tx, skillId)
  if (!skill) throw DataApiErrorFactory.notFound('Skill', skillId)
  if (!skill.isGlobalEnabled) throw DataApiErrorFactory.invalidOperation(...)
  const result = agentService.ensureBuiltinAgentTx(tx, assistantInput)
  agentGlobalSkillService.upsertJoinTx(tx, result.agent.id, skillId, true)   // ← 绑定技能
  agentSessionService.createTx(tx, sessionId, { agentId: result.agent.id, name: '', workspace: {type: SYSTEM} })
  return result
})
```

⇒ **「确保助理存在 + 绑定技能 + 建会话」三件事在一个写事务里**，任何一步失败全回滚。这是它比我们现有 `preset-launch.ts` **更强**的地方：我们是「打开一个空白会话 + 填草稿」，它是「建一个绑定了特定技能的新会话」。

**IPC 契约**（`src/shared/ipc/schemas/ai.ts:352-355`，逐字）：
```js
'ai.agent.skill_session.create': defineRoute({
  input: z.strictObject({ skillId: z.string().min(1) }),
  output: z.strictObject({ sessionId: z.string().min(1) })
})
```
处理器：`src/main/ipc/handlers/ai.ts:215` `'async ({ skillId }) => ({ sessionId: createBuiltinSkillSession(skillId).id })'`

**严格 schema 测试**（`src/shared/ipc/schemas/__tests__/ai.test.ts:199-211`）逐字断言：空串拒、**多带 `agentId` 也拒**（`:206` `safeParse({skillId, agentId})` → false）—— 封闭键集。

### 4.4 草稿文案（**逐字核对，flat key 结构**）

⚠️ **先纠正一个易错点**：`zh-cn.json` 是**扁平键**（顶层直接是 `"settings.skills.launchDraft"`，不是嵌套对象）。我第一次用嵌套路径 `d['settings']['skills']` 取值时抛 `KeyError: 'settings'`；改用 `d.get('settings.skills.launchDraft')` 后取到。**已做阳性对照**：同一个文件里 `library.skill_add.add` 能取到值 ⇒ 文件与键名都对。

```
settings.skills.launchDraft          = '请使用 {{name}} 技能帮我完成这项任务。'
settings.skills.creatorUnavailable    = '内置技能创建器不可用'
settings.skills.intentInvalid        = '此技能已不可用'
```

`{{name}}` 是**技能名**（`skill.name`，即 frontmatter 的 `name`，非目录名）。

### 4.5 草稿注入与会话匹配

`skillComposerLaunch.ts:13-30` 逐字：
```js
export function createSkillComposerLaunch(sessionId, skill, draftText): SkillComposerLaunch {
  const skillToken = agentSkillToComposerToken({ name: skill.name, filename: skill.folderName, description: skill.description ?? undefined })
  return { sessionId, initialDraft: { text: draftText, tokens: [{ ...skillToken, index: 0, textOffset: 0 }] } }
}
```

⇒ **草稿 = 一段文本 + 一个「技能 token」**。token 让 UI 把 `/技能名` 渲染成可点标记（`composerPaste.ts:44` `createSkillMarkerRule`；导出时渲染成 `/find-skills/` 标记而非隐藏文本，见 `markdownImageExport.test.ts:605-640`）。

**会话匹配**（`AgentPage.tsx:814` 逐字）：
```js
const visibleSkillComposerLaunch = skillComposerLaunch?.sessionId === visibleSessionId ? skillComposerLaunch : null
```
⇒ **草稿只在它所属的会话可见**。切到别的会话就不注入。`skillComposerLaunch` 状态在 `:207`，路由意图解析在 `:780`。

**意图守卫 TTL**：`SKILL_INTENT_GUARD_TTL_MS = 5 * 60 * 1000`（`skillComposerLaunch.ts:5`），缓存键 `agent-skill-intent-${tabId}`（`:9-11`）—— 防止刷新后重复触发同一意图。

**失败降级**：`AgentPage.tsx:786-790` 失败时 `setSkillComposerLaunch(null)` + `toast.error(t('settings.skills.intentInvalid'))`。

### 4.6 菜单 UI 真源（`ResourceGrid.tsx:162-210`）

触发钮三件套（`:182-184`）：`<Plus size={12}/>` + `<span>添加技能</span>` + `<ChevronDown size={12}/>`；容器 `variant="default" size="sm" className="shrink-0"`（`:181`）；菜单 `align="end" className="min-w-40"`（`:187`）。

四项（**顺序即数组顺序**）：

| # | 图标 | 文案 | 条件 | 行号 |
|---|---|---|---|---|
| 1 | `Bot`(13) | 通过 Agent 创建 | `onCreateWithAgent ? … : null` | `:188-193` |
| 2 | `Search`(13) | 在线搜索 | 恒出 | `:194-197` |
| 3 | `FolderSearch`(13) | 系统搜索 | `onSearchSystem ? … : null` | `:198-203` |
| 4 | `Import`(13) | 本地导入 | 恒出 | `:204-207` |

每项 `className="gap-2"`（图标与文字间距）。

**测试锁定**（`ResourceGrid.test.tsx:632-670`）：按钮名 `添加技能` 可查（`:632`）、点击触发（`:634`、`:657`）、`onCreateSkillWithAgent` 恰好一次（`:670` `toHaveBeenCalledOnce`）。

---

## 5. 内置技能的安装与版本对齐

### 5.1 `.version` 文件 + 只在 App 升级时覆盖

`builtinSkills.ts:25-28` 注释逐字：「Each installed skill gets a `.version` file recording the app version that installed it. On subsequent launches the bundled version is compared with the installed version — **the skill files are overwritten only when the app ships a newer version.**」

`BUILTIN_VERSION_FILE = '.version'`（`SkillService.ts:45`）。

**版本门**（`SkillService.ts:1422-1436`，逐字）：
```js
let filesUpdated = true
try {
  const installedVersion = (await readFile(path.join(destPath, BUILTIN_VERSION_FILE), 'utf-8')).trim()
  const installedHash = await this.computeBuiltinDirectoryHash(destPath)
  filesUpdated = installedVersion !== appVersion || installedHash !== sourceHash
} catch { filesUpdated = true }
if (filesUpdated) { await this.installer.install(sourcePath, destPath)
                   await writeFile(path.join(destPath, BUILTIN_VERSION_FILE), appVersion, 'utf-8') }
```

⇒ **两个条件任一成立才覆盖**：App 版本变了 **或** 内容 hash 变了。注释（`:1437`）：「Builtin contentHash is the **trusted install baseline** excluding Cherry's version marker.」

### 5.2 `syncBuiltinSkill` 的三道拒（`SkillService.ts:1384-1420`）

全程在 `this.mutationLock.runExclusive` 里（`:1390`），并**按顺序**检查：

1. **来源冲突**：同名文件夹已被**非 builtin** 来源占用 → 拒（`:1391-1396`）`Folder name "X" is already used by a {source} skill; refusing to overwrite it with a builtin.`
2. **命名空间冲突**：同名但 namespace 不同 → 拒（`:1397-1402`）
3. **内容冲突**：库里无记录但存储目录已存在 → 验 hash，不符即拒（`:1408-1420`）`Folder name "X" conflicts with an existing user-authored library directory "Y".`

⚠️ **第 3 条设计得很好**：内置技能**宁可安装失败，也不覆盖用户自己写的同名技能**。

### 5.3 为什么内置技能默认对每个 agent 启用

`builtinSkills.ts:20-23` 注释逐字：「Per-agent enablement needs no work here: `AgentGlobalSkillService.list()` defaults a builtin skill to **enabled for every agent until a user explicitly disables it**, so a synced `agent_global_skill` row is enabled everywhere **without any `agent_skill` rows**.」

实现（`AgentGlobalSkillService.ts:93-100`，逐字）：
```js
if (!query.agentId) return skills
const enabledMap = this.loadEnabledMap(query.agentId)
return skills.map((s) => ({ ...s, isEnabled: enabledMap.get(s.id) ?? s.source === 'builtin' }))
```

⇒ **`??` 兜底是核心**：join 表没有该行时，`isEnabled` 取 `s.source === 'builtin'`。用户显式关掉才有 join 行（值 false），否则内置恒为 true。

**写入侧对称**（`:113-119` `insertTx`）：`{ isEnabled: true, ...values }` —— 默认开。

### 5.4 我们的对应机制

**我们已有等价物且不同构**：
- 我们的 `builtin` 是**服务端包级标记**（`SkillPackage.builtin`，契约 `contracts/components/skill.yaml:199/201`）
- 可见性是 `assignment ∪ builtin` **并集**（`JdbcSkillStore` 的 where 谓词）
- 员工端「已安装」分组据此**只显示非内置**的行
- **⚠️ 我们没有 `.version` 文件机制** —— 内置包随服务端版本走，不随客户端走

⇒ **差异的根因**：Cherry 的 builtin 是**客户端 App 自带**（随 App 版本升级）；我们的 builtin 是**服务端下发**（随服务端版本）。**形态不同但目的一致（让用户开箱即用），不必照抄 `.version`。**

---

## 6. 与我们项目的差异对照（**排工期依据**）

### 6.1 能力对照表

| 能力 | Cherry | 我们 | 缺口 | Cherry 哪条比我们弱 |
|---|---|---|---|---|
| **在线搜索（3 个公开源）** | ✅ 匿名可搜，零凭据 | ❌ 无 | 端点可直连（§1.2），**但企业不该开放** | — |
| **GitHub URL 直装** | ✅ `parseGithubSkillUrl` 严格解析 | ❌ 无 | 同上 | — |
| **系统目录发现（15 个 CLI）** | ✅ 含三态判定 | ❌ 无（我们只有 DSH 一个根） | 无需补 | — |
| **本地 ZIP 导入** | ✅ `installFromZip` | ✅ 已有**更严**链路（`.dshskill` 制品） | 无 | Cherry 无 SHA-256、无企业验包 |
| **ZIP 大小写折叠碰撞检查** | ✅ `assertNoFoldedPathCollisions` | ❌ **零命中** | 🔴 **必须补** | — |
| **ZIP 对第三方库的不信任层** | ✅ `assertZipEntriesWithin` | ➖ 自写解析器，天然无此问题 | 无第二道网 | — |
| **重复路径检测** | ✅ 折叠后判 | ⚠️ **仅原始 path 判**（`zip-archive.ts:204`） | 🟡 **建议补** | — |
| **符号链接逐段拒绝** | ✅ `assertNoSymlinkComponents` | ✅ `resolveInstalledSkillTarget` 同形 | 无 | — |
| **总量/条目数上限** | 1 GB / 50 000 | ✅ **200 MiB / 10 000** | 无 | ✅ **我们严 5 倍** |
| **单文件字节上限** | ❌ 无 | ✅ **256 KiB** | 无 | 🔴 **它缺** |
| **目录名规约** | `sanitizeFolderName` 净化后接受 | ✅ **只接受 kebab 正则**，不合规即拒 | 无 | ✅ **我们严** |
| **"找不到就猜"行为** | ⚠️ `resolveSkillDirectory:186-192` 取第一个 | ✅ 自描述包，无此问题 | 无 | 🔴 **它有弱 fail** |
| **「通过 Agent 创建」入口** | ✅ `handleCreateSkillWithAgent` | 🟡 `preset-launch.ts` 有等价范式 | 见 §6.2 | — |
| **技能绑定的会话创建** | ✅ 单写事务 | ❌ 我们只填草稿，不绑定 | 🟡 见 §6.2 | — |
| **未启用先确认** | ✅ `ConfirmDialog` 三段 | ❌ 无 | 🟡 视是否需要 | — |
| **内置技能预装** | ✅ 客户端 `.version` 门 | ✅ **服务端 `builtin` 标记**（不同构，同目的） | 无 | — |
| **构建器资源文件** | ✅ `references/` `scripts/` `assets/` | ✅ **能装**（见 §6.3） | 无 | — |

### 6.2 「通过 Agent 创建」：我们需要什么

Cherry 走的是「**建一个绑定了特定技能的新会话**」，我们走的是「**打开空白会话 + 填草稿**」（`preset-launch.ts:190-198`）。

**两条路都可行，但差别要说清**：

| | Cherry | 我们（`preset-launch.ts`） |
|---|---|---|
| 技能怎么进上下文 | **DB 层绑定**（`upsertJoinTx`），会话带技能 | **草稿里带技能名**（`请使用 {{name}} 技能帮我完成这项任务。`），靠模型自己调 `skill` 工具 |
| 事务性 | ✅ 单写事务三步原子 | ➖ 打开会话与填草稿是两步（但 `beforeOpen` 回调保证草稿落在即将打开的那个会话） |
| 前提 | 该技能必须**已全局启用**，否则先弹确认 | 技能只要**在库里**即可（官方 watcher 会发现） |
| 我们缺什么 | — | 如果要走 Cherry 那条，需要服务端支持"为某设备/会话绑定技能"；**我们当前契约里没有这个概念** |

**建议**：**走我们已有的 `preset-launch.ts` 范式**（草稿路径），**不引入"会话绑定技能"**。理由：① 我们没有该契约；② 草稿里带技能名时，官方 `skill` 工具会自己加载（`dsh-runtime.md` 记的 `<available_skills>` 目录机制）；③ 少一个事务、少一个确认弹窗。

**缺口**：`preset-launch.ts` 的 `EnterprisePresetLaunchPort` 签名是 `(instruction) => Promise<boolean>`，**够用**（换文案即可）。**但它的落点复用了该工作区里的空白会话**（`preset-launch.ts:187` 注释：`reuseOrCreateBlank`）—— 「通过 Agent 创建」若希望每次都是**全新**会话，需要确认这一档是否可接受。

### 6.3 一个已澄清的"缺口"其实不是缺口

**我们能装 `references/` `scripts/` `assets/`**：
- 客户端：`skill-archive.ts:133` `const relative = segments.slice(2).join('/')` ⇒ 技能目录下**任意深度的文件**都收进 `SkillArchiveFile`
- 落盘：`skill-install.ts:379-384` 逐文件 `mkdir` + `writeFile`
- 已有测试：`tests/skill-archive.spec.ts`（据 `bundle/CLAUDE.md`：「双技能 + `references/` 资源的正常解出」）
- 服务端：`SkillArtifactInspector.java:133-135` 只要求路径是根 `manifest.json` 或 `skills/` 前缀 ⇒ `skills/skill-creator/references/` **合法**

⚠️ **但**：`skill-archive.ts:135` 只对 `relative === 'SKILL.md'` 施加 256 KiB 上限，**其他资源文件没有单文件上限**。Cherry 也没有（它只有总量上限）。**⇒ 双方都有这个缺口，建议我们顺手补。**

### 6.4 排期建议（按依赖排序）

| 优先级 | 事 | 依赖 | 说明 |
|---|---|---|---|
| 🔴 **P0** | 补 ZIP 折叠碰撞检查 | 无 | 唯一"我们没有且它是安全门禁"的项。改动小（`zip-archive.ts` 收集处换键，或补一次后置检查） |
| 🟡 P1 | 资源文件单文件上限 | 无 | §6.3，双方都缺，我们顺手补成本低 |
| 🟡 P1 | 「通过 Agent 创建」接线 | 走 `preset-launch.ts` | 只换文案 + 找 `skill-creator` 包（`source==='builtin' && folderName==='skill-creator'` 的等价判定） |
| ⚪ P2 | 在线搜索 / 系统搜索 | **产品决策** | 我建议**不做**（绕过企业审核与可见范围）。若做，须先解决内容安全（Cherry 自己有 `moderation` 字段，我们无） |
| ⚪ P2 | ZIP 导入 | 无需做 | 我们已有更严链路 |

---

## 7. 未找到证据 / 明确的不确定项

1. **`installFromZip` 的 UI 层**：我读了 `ImportSkillDialog.tsx` 的存在（387 行）但未逐行取证其**文件选择器**与错误呈现。若要移植 UI，需补读。
2. **`SkillMarketplaceDialog` 的安装动作**：`useSkillInstall`（`hooks/useSkills.ts`）我未逐行读，**从搜索结果点「安装」到落盘的完整调用链**只证到 `searchSkillMarketplaces` 这一层。
3. **`computeBuiltinDirectoryHash` 的具体实现**：只证到它被用于比对（`SkillService.ts:1407/1411/1425/1439`），未读它是否排除 `.version`（注释说排除，但未验证代码）。
4. **无 Apple/Windows 平台的实测**：本报告全部是源码取证，**没有在 Windows 或默认 macOS 卷上跑过**。§3.2 ② 的折叠碰撞后果（"落到同一文件"）是**源码注释的断言**，非本机实测。
5. **`node-stream-zip@1.15.0`（`package.json:151`）的内部行为**：§3.2 ① 依赖它「在 parse 时就拒恶意名」这一前提，这是 Cherry 注释的断言，我**未读该库源码**验证。

---

## 8. 阳性/阴性对照索引（供复核者重跑）

| 对照 | 命令 | 期望 |
|---|---|---|
| Cherry 侧阳性 | `grep -c "buildSystemSkillSources" src/main/ai/skills/systemSkillSources.ts` | `1` |
| Cherry 侧阴性 | `grep -rc "thisSymbolDefinitelyDoesNotExist" src/main/ai/skills/` | 无输出 |
| 我们侧阳性（正确做法） | `grep -c "maxEntries" plugin/packages/bundle/src/skill-archive.ts` | `1` |
| 我们侧阴性（**曾经做错**） | `grep -rn "realpath" plugin/packages/bundle/src/skill-archive.ts` | 无输出 —— **但这是假阴性**，该文件本就不含 `realpath` |
| 缺口结论复查 | `grep -rn "fold\|Fold\|碰撞\|toLowerCase" plugin/packages/bundle/src/{skill-archive,skill-install,zip-archive}.ts` | 0 命中（**已重做有效对照，见 §0.2**） |
| 重复路径检测存在性 | `grep -n "duplicate path" plugin/packages/bundle/src/zip-archive.ts` | `:204` 命中 |
