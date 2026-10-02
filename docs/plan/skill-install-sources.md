<!--
[INPUT]: 依赖 docs/compose/spec/skill-catalog.md（包契约与「官方无 skills 安装 RPC」冻结结论）、
         docs/plan/enterprise-marketplace-phase2.md（浏览自由·安装受控、ent:skill 权限）、
         docs/plan/borrow-from-skillhub.md 与 docs/research/iflytek-skillhub-integration.md（两个站的调研）、
         以及本会话对仓库源码与本机真实接口的实测（含服务器原型 ~/.sshwork/sh-import/ 的镜像）。
[OUTPUT]: 给出「技能安装支持本地上传压缩包 + 粘贴 skillhub.cn / GitHub / npm 三方地址」的**方案**：
          两条通路的端到端流程与责任划分、三个来源的适配规格与扩展接口、客户端 fail-closed 校验闸门、
          信任与授权口径、安全清单、UI 设计、分期人日、开放问题与明确不做清单。
[POS]: docs/plan 下的方案规划文档（**只规划、不实现**）。复用既有安装管线与验包闸门，不另起一套；
       不改任何源文件，不替代任何既有 spec/plan——包契约真源是 compose/spec/skill-catalog.md。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md。
-->

# 技能安装：本地上传压缩包 + 粘贴三方地址安装（方案规划）

> **本文只出方案，不含任何实现、不新增依赖、不改任何源文件。**
> 所有「现状」都是本会话读到的源码或实测输出；读不到的一律写进 §K 不确定项，**不编 endpoint、不编字段名**。
> 引用仓库内事实给 `路径:行号`；引用服务器原型给绝对路径；实测命令与输出见 §L 证据索引。

### 相邻文档分工（**先看这一段，避免三份文档打架**）

| 文档 | 负责 | 与本文的关系 |
|---|---|---|
| **本文** `docs/plan/skill-install-sources.md` | **客户端（员工端）**两条安装通路：本地上传 + 粘贴三方地址 | —— |
| `docs/plan/skill-ingest-center.md` | **企业中心侧**多渠道导入（服务端表/迁移/审计/控制台） | 该文第 `[POS]` 行明确「客户端侧方案由 `docs/plan/skill-install-sources.md` 负责」；本文**不改服务端**，两者互补 |
| `docs/plan/add-skill-flow-reference.md` | 官方「添加插件」流程的**参照规格**，技能版「从地址安装」的 UX 逐元素设计依据 | **UI 逐元素规格以该文为准**；本文 §G 只规定**不可让步的口径**（分区隔离、风险文案、进度/失败反馈、装后状态），不重复其逐元素布局 |

---

## 0. 事实地基（先摸清，再规划）

### 0.1 我们已有的安装管线（**必须复用，不另起一套**）

| 事实 | 出处 |
|---|---|
| 主干就是一条「详情取权威 sha256/size → 代取令牌下载 → 强制 size+SHA-256 → 解包 → 落点预检 → 暂存 → 逐个原子改名 → 原子写状态文件」，失败逐级回滚 | `plugin/packages/bundle/src/skill-install.ts:297-432` |
| 下载内核是**受管插件与企业技能共用**的 `downloadVerifiedArtifact`：先写 `.part`、边写边算 hash、size 与 sha256 逐字相等才 `rename` 为**内容寻址**文件名 `${sha256}.dshskill`，命中缓存零网络 | `plugin/packages/plugin-distribution/src/verification.ts:184-247` |
| 它**要求调用方先给出权威 `sizeBytes` 与 `sha256`**，并校验 `content-length` 与该值相等 | `plugin/packages/plugin-distribution/src/verification.ts:156-159`、`:208-211` |
| 落盘根是官方 `dsh-skill-filesystem` 的 `user-dsh` 根 `<dshHome>/skills`；状态与暂存挂在 `<dshHome>/enterprise/{skill-installs,skill-artifacts,skill-staging}` | `plugin/packages/bundle/src/skill-install.ts:17-24` |
| 状态文件 `installed.json` 是**原子写**（同目录临时件 + rename，0600） | `plugin/packages/bundle/src/skill-install.ts:245-257` |
| 幂等：同 `packageId` 且同 `sha256` 且文件仍在 → 直接回当前已装态，不重下不重写 | `plugin/packages/bundle/src/skill-install.ts:342-347` |
| 名字冲突：同名目录被**别的包**占用、或存在但**不在本包记录里** → 一律拒（`ENT_SKILL_NAME_CONFLICT`），绝不就地半覆盖；同名旧版本才是原子升级 | `plugin/packages/bundle/src/skill-install.ts:349-370`、`:387-400` |
| 全程零 `exec` / `child_process`；包内文件以 `mode: 0o600` 写入，不落可执行位 | `plugin/packages/bundle/src/skill-install.ts:9`、`:384` |
| 本机真实落盘证据：`~/.dsh/skills/{code-review,expense-reimbursement,new-member-onboarding}` 三个企业技能；`~/.dsh/enterprise/skill-installs/installed.json` 里是 `packageId/skillId/displayName/versionId/sha256/names/installedAt` 七字段 | 本机实测（`/data/user/0/com.deepcode.shell/files/home/.dsh/`） |

**结论：新增两条通路只允许「换掉最前面那一步（字节从哪来）」，从 `decodeDshSkillArchive` 开始的下游一字不改。**

### 0.2 我们的包格式与**验包闸门**（服务端那套规则，逐条可查）

`.dshskill` = ZIP：根 `manifest.json` + `skills/<kebab>/…`，manifest `version` 必须是**字符串** `"1"`。

| 规则 | 出处 |
|---|---|
| 只允许根 `manifest.json` 与 `skills/` 子树；路径拒绝对路径/反斜杠/NUL/`..`/`.` 段 | 客户端 `skill-archive.ts:109-131`、`:296-298`；服务端 `SkillArtifactInspector.java:121-136`（两行分别是两条独立实现，见下两行） |
| 同上（客户端实现） | `plugin/packages/bundle/src/skill-archive.ts:109-131`、`:296-298` |
| 同上（服务端实现） | `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/artifact/SkillArtifactInspector.java:121-136` |
| 拒绝：加密条目、多盘、ZIP64、非 store/deflate 压缩方法、Unix 非普通文件（**符号链接/设备/FIFO**）、重复路径、超解压总额 | `skill-archive.ts:192-208`、`:214`、`:221-223`、`:149-163` |
| 上限（与服务端逐字同值）：归档 ≤50 MiB、解压后 ≤200 MiB、条目数 ≤10 000、单包技能 ≤200、单 `SKILL.md` ≤256 KiB | `skill-archive.ts:12-20`；服务端 `SkillArtifactInspector.java:41-43` |
| manifest：`format="dsh-skill"`、`version="1"` 字符串、`id` ≤128 且 `^[A-Za-z0-9][A-Za-z0-9._-]*$`、`name` ≤120、`sourceDshVersion` ≤64、`description` 可选 ≤2000 | `skill-archive.ts:252-271`；`SkillArtifactInspector.java:146-155` |
| SKILL.md frontmatter：`name` 必填 kebab ≤64、`description` 必填 ≤1024、`whenToUse` ≤2048、`disable-model-invocation`/`user-invocable` 布尔 | `SkillArtifactInspector.java:167-202` |
| frontmatter **YAML 重复键拒绝**（`setAllowDuplicateKeys(false)`）、YAML 别名数 ≤16、**legacy 字段**（`modelInvocable`/`userInvocable`/`disableModelInvocation`）拒绝并给改名建议 | `SkillArtifactInspector.java:172-192`、`:49-53` |
| 未知字段处理（服务端口径）：`validateManifest` 只**按名取**5个字段，未知顶层键**既不报错也不保存**；frontmatter 也只按名取5个键 | `SkillArtifactInspector.java:146-155`、`:193-201` |
| 中心详情与服务端同级门禁的 16 条实测 PASS（服务器原型） | `/opt/work/skillhub-import/convert.py`（`gate()` 调用 16 处） |

> **本机安装要不要跑同一套校验？—— 要，而且必须更严。**
> 服务端那套是「中心发布的闸门」；本机安装**没有服务端**，产出的却是同一个 `~/.dsh/skills` 发现面，
> 因此客户端必须自己把同一套规则实现成**一次都不落的 fail-closed 判定**（见 §D）。
> 客户端已有的 `decodeDshSkillArchive` 正是这套规则的**严格子集**（结构/路径/上限/CRC/符号链接/manifest），
> 但它**不解析 frontmatter**（`skill-archive.ts:281` 明确把正文语义交给官方 `skill-filesystem`），
> 而服务端 `SkillArtifactInspector` 是**整包拒绝**级别的 frontmatter 校验 —— 这条缺口必须补（§D.4）。

### 0.3 官方对技能的能力面（**边界写清楚**）

| 事实 | 出处 |
|---|---|
| 官方**只有发现契约**：落在 `<dshHome>/skills/<name>/SKILL.md` 即被 watcher 免重启发现；`user-dsh` 根 rank 400 | `@deepseek-ai/dsh-skill-filesystem/lib/index.js:169-175`（`USER_DSH_RANK = 400` 在 `:24`）、`:550-556`（`SKILL.md` 深度 1 判定） |
| 官方**没有** skills 安装 RPC（0.2.0-rc.2 全量核对） | `docs/compose/spec/skill-catalog.md:120` |
| 官方 `ctx.pluginManager.installBundle(spec)` 是**插件**安装，spec 形态为 git（`github:`/`git@`/宿主仓库 URL）/`.tgz`/绝对路径/npm 包名，走 pnpm，且「加了包却没有 bundle patch 就回滚」 | `@deepseek-ai/dsh-plugin-manager/lib/types/index.d.ts:104-118`、`lib/index.js:21-33`（`install-spec` 的形态正则） |
| 因此**技能安装这条路是我们自己拥有的**：官方只承认落盘形状，不提供安装动作 | 同上两条 + `skill-catalog.md:120` |

**边界结论：技能安装**不得**复用 `installBundle`（那是插件 + pnpm + bundle patch 语义），
也**不得**声称「复用官方能力」；我们复用的是官方**发现契约**的形状，动作面是我们自己的。

### 0.4 已有的三方转换原型（**复用它的成果与教训**）

> 任务给出的是服务器路径 `/opt/work/skillhub-import/`（`common_auth.py`/`fetch_top_n.py`/`license_scan.py`/`converted/`）。
> **本会话从 Android 设备上读不到 `/opt/work/`**（`ls: cannot access '/opt/work/skillhub-import/'`），
> 但设备上有同源镜像 `~/.sshwork/sh-import/`（同一批脚本名：`fetch_list.py`/`probe_detail.py`/`fetch_top_n.py`/
> `license_scan.py`/`license_gate.py`/`preflight_all.py`/`convert.py`/`deploy.py`/`verify.py` + `EVIDENCE.md`）。
> 下文引用**镜像的实测输出与脚本原文**，并把两者的对应关系写进 §K。

| 成果 | 出处（镜像绝对路径） | 教训 |
|---|---|---|
| 真实导入了 **8 个** skillhub.cn 技能（下载→转换→上传→发布→分配→回读全绿） | `~/.sshwork/sh-import/EVIDENCE.md:1-6`、`:46-59`、`:372-383` | 「第三方技能可以变成合规 `.dshskill`」已被真机服务端验证过 |
| 转换器 **16 条门禁**与服务端同级，8/8 全 PASS | `convert.py`（16 处 `gate()`）、`EVIDENCE.md:372-383` | 门禁清单可以直接搬成客户端的 §D 检查表 |
| 许可闸门：**列表条目没有 license 字段**，必须回包内取证；优先级 = frontmatter → 包内 LICENSE/LICENCE/COPYING → README 许可证节 → 元数据 license 键 | `license_gate.py:18-19`、`:93-181`、`EVIDENCE.md:44`、`:63` | 三方来源的许可**只能从包里读**，不能信列表 |
| 许可闸门实测淘汰率极高：Top100 中 ALLOW **19** / proprietary **7** / copyleft **1** / 许可不明 **72** / 不可读 **1** | `EVIDENCE.md:65-73` | 「许可不明一律拒」会把 ~72% 的候选挡掉 —— 默认口径必须让用户知道代价（§D.5） |
| copyleft 真实样本：`@user_cd0fcd93/qilinbashe` 的 `LICENSE.md` 是双轨（`scripts/` Apache-2.0、内容部分 CC-BY-NC-SA 4.0）→ 整包拒 | `EVIDENCE.md:119` | copyleft 判定必须**全包扫**，不能只看 frontmatter 一行 |
| 重复键真实样本：`@zcwl/multi-search-engine` 因 frontmatter 重复键 `homepage` 被我们自己的门禁拒（服务端 `allowDuplicateKeys=false`） | `EVIDENCE.md:59`、`:127`；`preflight_all.py` 的重复键正则预扫 | **Python 的 `yaml.safe_load` 不拒重复键**（默认后者覆盖）→ 原型用正则另扫一遍。JS 侧同理，必须显式实现 |
| 真实技能包里**带可执行内容**：`skills/dev-expert/hooks/*.py`（30 个）、`skills/interactive-architecture-diagram/scripts/*.cjs` | `convert.out` 的目标包路径清单 | 我们「落盘但不执行」这条必须写死，因为包里真的有脚本 |
| 上游缺陷（不修）：`@user_c0d57d10/pptx@1.0.0` 下载返 COS `NoSuchKey`（443 B XML） | `EVIDENCE.md:389` | 下载要按「非 zip 即拒」处理，而不是当网络错误重试 |
| 我们**不做内容安全扫描**（企业侧无此能力） | `EVIDENCE.md:391`、`docs/plan/borrow-from-skillhub.md:60-64` | 企业侧诚实边界，§E 必须写明 |

### 0.5 **两个站必须分清**（skillhub.cn ≠ skill.xfyun.cn）

任务点名要区分，这里一次讲清（避免后续把两套 API 混用）：

| 维度 | **skillhub.cn**（腾讯云系 AI Skills 社区） | **skill.xfyun.cn / iflytek SkillHub**（自托管注册中心） |
|---|---|---|
| 证据 | `~/.sshwork/sh-import/EVIDENCE.md:7-44`（实测） | `docs/research/iflytek-skillhub-integration.md:1-987`（调研） |
| 列表接口 | `GET https://api.skillhub.cn/api/skills?page&pageSize&sortBy=score&order=desc` | `GET /api/v1/skills`（公开匿名可读，`research:211-223`） |
| 详情/文件/下载 | `/api/v1/skills/{slug}?namespace={handle}`、`/api/v1/skills/{slug}/files?namespace=`、`/api/v1/download?slug&namespace` → 302 到 COS | `/api/v1/skills/{ns}/{slug}`、`.../versions/{v}/files`、`.../download`（`research:213-223`） |
| 坐标 | `@handle/slug`（`namespace.canonicalName`） | `@namespace/slug` + semver + tag（`research:155-158`） |
| 包结构 | **扁平 zip，根 `SKILL.md`** + `references/ scripts/ assets/`，另有根 `README.md`/`FAQ.md`/`_meta.json`（实测 85 条） | 同样扁平、根 `SKILL.md`（`research:141-151`，22/22 实测） |
| manifest | 无（转换器合成） | 无（转换器合成） |
| 许可 | 列表条目**无 license 字段**（实测字段全集见 `EVIDENCE.md:35-44`） | 未在调研中固化结论 → **不确定项 §K** |
| 版本坐标 | `latestVersion.version`（如 `2.0.3`） | semver + tag，`latest` 为系统保留（`research:156-158`） |

**本文的 §C.1 只针对 skillhub.cn**；iflytek 站作为**扩展来源**参照其调研（§C.4 的适配器接口足以容纳它），
本轮不进 P0/P1。

### 0.6 本机路由与解码层（新接口挂哪、怎么与既有约定一致）

| 事实 | 出处 |
|---|---|
| Host 侧同源只读/动作路由唯一注册点：`registerEnterpriseLocalApi`，前缀 `/enterprise/api/v1/local` | `plugin/packages/platform-client/src/local-api.ts:45`、`:60-70`（技能四条 exact 子路径）、`:554-660`（状态/正文/动作注册） |
| 技能目录（中心镜像）在 bundle 侧注册成「`/skills` exact 列表 + `/skills` prefix 详情」，prefix handler 再按剩余段分派本机文件子路径 | `plugin/packages/bundle/src/skill-route.ts:12`、`:15`、`:254-291`、`:305-331` |
| 稳定码 → HTTP 状态的**唯一映射表** `enterpriseLocalErrorStatus` | `plugin/packages/platform-client/src/local-api.ts:200-215` |
| 未列进映射表的码**一律落 503** —— 现有 `ENT_SKILL_ARCHIVE_INVALID`/`SIZE_MISMATCH`/`HASH_MISMATCH`/`PACKAGE_MISMATCH`/`STATE_INVALID`/`INSTALL_FAILED`/`DOWNLOAD_FAILED` 全部落 503 | 同上一行（表内没有这些码） |
| 客户端严格解码与错误码投影唯一入口 `enterpriseLocalErrorCode` | `plugin/packages/ui/src/local-api-decode.ts:317` |
| 浏览器侧只发同源固定路径，调用方无法注入 origin/Authorization；错误码只认受控投影 | `plugin/packages/ui/src/local-api.ts:8-68`、`:261-271`、`:284-300` |
| **二进制上传已有先例**：反馈的 multipart 本地路由，有界读取 `readBoundedBody(request, limit)` + `content-length` 预检 | `plugin/packages/bundle/src/feedback-route.ts:19-27`、`:377`、`:437-438`、`:451-453` |
| JSON 本地正文上限仅 **256 KiB**（`MAX_LOCAL_BODY_BYTES`）——**装不下 50 MiB 的包** | `plugin/packages/platform-client/src/local-api.ts:28`、`:227` |

**结论（两条）**
1. 新接口挂在 `registerEnterpriseLocalApi` 家族里，命名与既有四条 `/skills/*` exact 子路径同族；
   必须在引擎 exact/prefix 两张表上抢在 bundle 的 `/skills` prefix 之前（否则被当成包 id，400）。
2. **上传不能走 JSON 路由**（256 KiB 上限），必须走 multipart 有界读取 —— 与 `feedback-route.ts` 同一手法，
   但配额要另开一组（50 MiB 量级），**不能**改 `MAX_LOCAL_BODY_BYTES`（那会同时放宽所有 JSON 路由）。

---

## A. 目标与边界

### A.1 目标

给员工端（`dshent-plugin` 的设置页技能 tab）增加**两条用户自发安装通路**：

| 通路 | 一句话 | 支持的输入 |
|---|---|---|
| **通路一 · 本地上传** | 用户选一个 `.dshskill` 压缩包，本机校验后装进 `~/.dsh/skills` | `.dshskill`（= 我们的包格式） |
| **通路二 · 粘贴地址** | 用户粘贴一个三方地址，本机取包 → 转成我们的包 → 同一条闸门 → 落盘 | **skillhub.cn**、**GitHub**、**npm**；结构上可扩展 |

### A.2 不做什么（先说清，避免范围膨胀）

1. **不做静默安装**：每一次安装都必须由用户在界面上显式确认（含风险确认弹窗，§G）。
2. **不做后台自动拉取 / 不做定时轮询远端版本**：没有「自动更新检查」「订阅」「同步」。
3. **不执行包内任何内容**：不 `exec`、不 `spawn`、不 `import()`、不落可执行位、不改 `PATH`（§D.6）。
4. **不做内容安全扫描**：我们**没有**这个能力（`~/.sshwork/sh-import/EVIDENCE.md:391`、`docs/plan/borrow-from-skillhub.md:60-64`）；
   只做**结构 + 许可 + 来源**三类把关，不做正文语义审毒。
5. **不把三方自发安装的技能混进企业受控目录**（§E）。
6. **不做「服务端替员工代取三方包」**：通路二在本机取包，不经企业中心（否则等于把未审内容经我们服务器中转）。
7. **不服务端持久化技能正文**（沿用 `docs/compose/spec/skill-catalog.md` S2.1 的「不存 SKILL.md 正文」口径）。

---

## B. 两条通路的端到端流程

### B.0 共用的下游（两条通路在此汇合，**一字不改**）

```text
已通过闸门的 .dshskill 字节
  → decodeDshSkillArchive(bytes)                     [bundle，既有]
  → 落点冲突预检（别的包占用 / 来路不明同名目录）      [bundle，既有]
  → 解到 <dshHome>/enterprise/skill-staging/<uuid>   [bundle，既有]
  → 逐个原子 rename 进 <dshHome>/skills/<name>        [bundle，既有]
  → 原子写 <dshHome>/enterprise/skill-installs/*.json [bundle，既有]
  → 官方 watcher 免重启发现（rank 400 user-dsh 根）    [官方，既有]
  → 回读「已装态」给界面                              [bundle/ui，既有]
```

### B.1 通路一：本地上传压缩包

⚠️ **关键设计问题：浏览器的 `File` 字节怎么进到引擎？** 两个候选：

| 方案 | 形态 | 判断 |
|---|---|---|
| **甲（推荐）** | 浏览器读 `<input type=file>` → `FormData`（multipart）→ **同源** `POST /enterprise/api/v1/local/skills/upload` → Host **有界读取**到内存/临时文件 → 闸门 → 落盘 | 与既有反馈附件链路**同一手法**（`feedback-route.ts:377`/`:451-453`），浏览器不接触宿主路径，符合「浏览器只发同源固定路径」（`ui/src/local-api.ts:8-68`） |
| 乙 | 让用户手填**本机绝对路径**，Host 直接读 | ❌ 否决：把「任意文件读取」变成一条由网页参数驱动的原语，与既有「客户端交来的永远是键形状、不是路径」纪律（`skill-install.ts:670-688`）直接冲突；且 Android 上用户拿不到真实路径 |

**通路一流程（方案甲）**

| # | 步骤 | 谁负责 | 失败时的稳定错误码 | 可重试性 |
|---|---|---|---|---|
| 1 | 界面选文件（`accept=".dshskill,application/vnd.dsh.skill+zip,application/zip"`） | UI | —（前端先按扩展名/MIME 轻过滤，**不作为安全判定**） | 可重选 |
| 2 | 前端做**尺寸预检**（≤50 MiB）并显示文件名/大小 | UI | `ENT_SKILL_UPLOAD_TOO_LARGE`（413，前端即拦） | 可重选 |
| 3 | multipart 同源 POST 到 `/local/skills/upload` | UI → Host | — | 可重试（幂等，见步骤 7） |
| 4 | Host `content-length` 预检 + **有界读取**（超限即断） | Host 路由 | `ENT_SKILL_UPLOAD_TOO_LARGE`(413)、`ENT_SKILL_UPLOAD_INVALID`(400) | 可重试 |
| 5 | 算 `sha256`，写入 `<dshHome>/enterprise/skill-uploads/<sha256>.dshskill`（`.part` → 原子 rename） | bundle（新适配层） | `ENT_SKILL_UPLOAD_FAILED`(500/400) | 可重试 |
| 6 | **校验闸门**（§D 全套） | bundle | `ENT_SKILL_ARCHIVE_INVALID`(400)、`ENT_SKILL_MANIFEST_INVALID`(400)、`ENT_SKILL_SKILLMD_INVALID`(400)、`ENT_SKILL_LICENSE_*`(403) | 换包才可恢复；同一包重试必然同错 |
| 7 | 幂等判定：`installed.json`（或自装清单）里已有同 `sha256` 且目录仍在 → 直接回「已装」 | bundle | —（成功路径） | — |
| 8 | 落点冲突预检 → 暂存 → 原子改名 → 原子写记录 | bundle（复用） | `ENT_SKILL_NAME_CONFLICT`(409) | 冲突需用户改包名或先卸载 |
| 9 | 回读已装态 | bundle（复用） | —— | — |
| 10 | 界面：装完显示「已装（本机自装）」+ 打开技能详情（文件树/预览走既有 `/skills/<id>/files`、`/skills/<id>/file`） | UI | — | — |
| 11 | 官方 watcher 发现（无需重启） | 官方 `dsh-skill-filesystem` | 落盘失败即无发现 | — |

### B.2 通路二：粘贴三方地址

```text
地址解析（识别来源）→ 取包 → 解包 → 转换 → 校验闸门 → 落盘 → 发现 → 反馈
```

| # | 步骤 | 谁负责 | 失败时的稳定错误码 | 可重试性 |
|---|---|---|---|---|
| 1 | 用户粘贴地址 | UI | — | — |
| 2 | **来源识别 + 解析**（本地纯函数，不发网络）：命中 skillhub.cn / GitHub / npm 任一适配器 → 归一化坐标 | 适配器（新） | `ENT_SKILL_SOURCE_UNSUPPORTED`(400) | 改地址 |
| 3 | **地址安全闸门**（§F.1：只 https、拒私有/回环/链路本地/元数据、拒 `file://`/`data://`） | Host（新） | `ENT_SKILL_SOURCE_BLOCKED`(400) | 改地址 |
| 4 | **取包**（含重定向逐跳校验、跳数上限、超时、下载上限） | Host fetcher（新） | `ENT_SKILL_FETCH_FAILED`(503)、`ENT_SKILL_FETCH_TOO_LARGE`(413)、`ENT_SKILL_FETCH_TIMEOUT`(504) | 网络类**可重试**；403/404 类不可 |
| 5 | **解包**（外层容器：zip / tar.gz；严格、有界、路径安全） | 适配器 + `skill-archive` 抽出的 ZIP 读取层（新） | `ENT_SKILL_ARCHIVE_INVALID`(400) | 同一包重试必然同错 |
| 6 | **定位技能**（根 `SKILL.md`？`skills/*/SKILL.md`？多技能怎么办） | 适配器（新） | `ENT_SKILL_SOURCE_NO_SKILL`(400)、`ENT_SKILL_SOURCE_AMBIGUOUS`(409) | 需用户选一个 or 改地址 |
| 7 | **转换**（重定位进 `skills/<kebab>/`、合成 `manifest.json`、许可取证） | 适配器（新，**无副作用纯函数**） | `ENT_SKILL_CONVERT_FAILED`(400)、`ENT_SKILL_LICENSE_DENIED`(403) | 不可重试 |
| 8 | **校验闸门**（§D 全套，与通路一**同一份实现**） | bundle | 同 §B.1 步骤 6 | — |
| 9 | 幂等（内容寻址 sha256） | bundle | — | — |
| 10 | 落点冲突 → 暂存 → 原子改名 → 写记录（**含 provenance**，§F.4） | bundle（复用） | `ENT_SKILL_NAME_CONFLICT`(409) | — |
| 11 | 回读已装态 → 界面显示「本机自装 · 来源：GitHub」 | bundle + UI | — | — |
| 12 | 官方 watcher 发现（无需重启） | 官方 | — | — |

**责任边界一句话**：**UI 只发同源固定路径与用户输入的字面量；Host 负责一切网络、路径、校验与落盘；
适配器只是「纯转换函数 + 取包描述」，**不得**自己写文件、不得执行任何东西、不得碰 `installed.json`。

### B.3 两条通路的**唯一差别**

| | 通路一 | 通路二 |
|---|---|---|
| 字节来源 | 浏览器 multipart（用户自己的文件） | Host 出网拉取（三方） |
| 输入是否已是我们格式 | **是**（`.dshskill`） | **否**（需转换） |
| `sha256` 何时知道 | 收到字节后算 | 收到字节后算 |
| 是否需要 SSRF 闸门 | 不需要（无网络出口） | **必须**（§F.1） |
| 是否需要来源识别 | 不需要 | **必须** |
| 校验闸门 | **同一份** | **同一份** |
| 落盘与幂等 | **同一份** | **同一份** |

---

## C. 三个来源的适配规格

### C.0 取包内核怎么复用（**先解决这个，否则三个来源都要各写一套下载**）

`downloadVerifiedArtifact` 的**契约要求**是「调用方先给权威 size + sha256」（`verification.ts:156-159`），
而三方来源**没有**这样一个预先公布的摘要。因此：

| 选项 | 做法 | 评价 |
|---|---|---|
| **甲（推荐）** | 在 `plugin-distribution` 里**新增**一个同族的 `downloadPublicArtifact`（TOFU：边下边算 sha256、`maxBytes` 上限、`.part` → 原子 rename 成 `${sha256}${ext}`），**复用同文件里的 `hashFile`/`existingArtifact` 私有工具**；`downloadVerifiedArtifact` 一字不改 | 与既有「一个下载内核」纪律最接近；企业路径零风险；新增的是**并列**函数而不是分支 |
| 乙 | 给 `downloadVerifiedArtifact` 加 `expectedDigest?: 'given' \| 'computed'` 分支 | 改的是受管插件也在走的函数，回归面变大，不推荐 |
| 丙 | 三处各写一份 fetch | ❌ 否决：正是任务要求「不要另起一套」的反面 |

**另有一条硬约束**：三方取包**不得**走 `EnterprisePlatformService.request` —— 它是**同源 + 强制 Bearer + `redirect: 'error'`**
的平台出口（`platform-service.ts:695-706`：「authenticated requests must stay on the platform origin」）。
三方 fetcher 必须是**独立对象**，只是**结构上**满足 `{ request(input, init): Promise<Response> }`
（`skill-install.ts:36-38` 那个最小端口形状）以便注入同一个下载内核。

**字节到磁盘之后的路径**（三条来源完全一致）：

```text
bytes → [适配器] 转成 .dshskill 布局（内存中的 entries）→ 合成 manifest.json
      → decodeDshSkillArchive 的**同一套路径/上限/CRC 判定**（§D）
      → skill-install 的**同一套**暂存/原子改名/状态文件
```

### C.1 skillhub.cn（P0 推荐来源）

**为什么是 P0**：我们**已经有**一份在该站上跑通的原型（8/8 真实导入 + 16 条门禁 + 许可闸门 + 实测 API 字段），
本会话又从设备侧复验了接口可达性 —— 证据密度最高、未知最少。

#### C.1.1 地址形态（两种都要支持）

| 形态 | 例子 | 处理 |
|---|---|---|
| **技能页 URL** | `https://skillhub.cn/skills/{handle}/{slug}` | 纯本地解析（**不发网络**！该 host 本会话 25s 超时，见 §L.1） |
| **API URL** | `https://api.skillhub.cn/api/v1/skills/{slug}?namespace={handle}` | 直接采信查询串里的 `namespace` |
| （可选）API 下载 URL | `https://api.skillhub.cn/api/v1/download?slug=&namespace=` | 与上同构，取两参数 |

**解析规则**：`handle` 取值形态实测有 `indiv-*`/`user_*`/`org-*`/组织短名（`tencent-adm`、`zcwl`），
`slug` 是 kebab；两者都必须按 `^[A-Za-z0-9][A-Za-z0-9._-]*$` 收窄后再拼上游地址（**绝不把用户字符串直接拼进 URL 路径**）。

#### C.1.2 上游接口（实测，本会话从设备复验）

| 用途 | 实测 | 证据 |
|---|---|---|
| 详情 | `GET https://api.skillhub.cn/api/v1/skills/{slug}?namespace={handle}` → **200 / 0.20s** | §L.2 |
| 下载 | `GET https://api.skillhub.cn/api/v1/download?slug={slug}&namespace={handle}` → **302** `location: https://skillhub-1388575217.cos.accelerate.myqcloud.com/skills/89301/dev-expert/2.0.3.zip` → 200 / 466,622 B / 0.45s | §L.3 |
| 详情顶层字段（实测全集） | `contentZhAvailable, latestVersion{changelog,createdAt,version}, namespace{canonicalName,displayName,handle,publicSlug}, owner, securityReports{keen,sanbu}, skill{...}, slug` | §L.2 |
| **`license` 字段** | **顶层与 `skill` 内都不存在**（本会话逐个键确认） | §L.2 |
| `skill` 内可用字段 | `category, subCategories[{key,name}], summary/summary_zh, displayName, slug, source, sourceUrl, upstream_url, githubAuthorLogin, stats, tags, labels, verified, ext, iconUrl` | §L.2 |
| 列表接口 | `GET https://api.skillhub.cn/api/skills?page&pageSize&sortBy=score&order=desc`（P0 用不到；P2 做「按坐标搜索」才用） | §L.1 |

> ⚠️ **不要**把 `securityReports`（腾讯 Keen / 三木等第三方扫描报告 URL）当成我们的安全凭据：
> 它是上游自述、URL 带签名参数、我们不验证也不背书。**允许展示为一个外部链接，但不得作为放行依据**（§E 诚实口径）。

#### C.1.3 包结构 → 我们的结构

**实测该站的包是扁平结构**（本会话下载 `dev-expert` 复验）：

```text
根: SKILL.md, README.md, FAQ.md, _meta.json          ← 85 条目
子目录: hooks/*.py（30 个）, references/**, scripts/*.cjs
```

**映射（逐条照搬原型 `convert.py:239-249` 的做法）**：

```text
SKILL.md            → skills/<kebab>/SKILL.md      （**必须**改名/换位；根级除 manifest.json 外一律被拒）
README.md/FAQ.md/
LICENSE/NOTICE/...  → skills/<kebab>/…             （**必须迁移**，不是可选；顺带保住署名）
references/ scripts/ assets/ hooks/ … → 同名下移一层
（无）               ← 根 manifest.json（转换器合成）
```

#### C.1.4 manifest 字段取值（**逐字段给口径**）

| 字段 | 取值 | 依据 |
|---|---|---|
| `format` | 常量 `"dsh-skill"` | `skill-archive.ts:263` |
| `version` | 常量**字符串** `"1"` | `skill-archive.ts:263`（历史踩坑：曾与数字 1 比较导致真实制品全被判非法，见该行注释） |
| `id` | **kebab 化后的 slug**（如 `dev-expert`） | 不能用上游 `@handle/slug`：`PACKAGE_REF = ^[A-Za-z0-9][A-Za-z0-9._-]*$` 拒 `@` 与 `/`（`docs/research/iflytek-skillhub-integration.md:554`） |
| `name`（显示名） | 上游 `skill.displayName`，缺省回退 slug；≤120 | `SkillArtifactInspector.java:153` |
| `description` | 上游 `summary_zh`/`summary`，或 SKILL.md frontmatter 的 `description` | 原型 `convert.py:219` |
| `category` | 上游 `category` 经**映射表**转中文（原型 `CATEGORY_MAP`），`subCategories` 可覆盖；**≤32 字符** | 原型 `convert.py:32-44`；`docs/compose/spec/skill-catalog.md:32` |
| `sourceDshVersion` | **原型已落地的写法是 `skillhub.cn/<slug>@<version>`**（如 `skillhub.cn/dev-expert@2.0.3`），≤64 | 原型 `convert.py:225`；实测值见 `convert.out` |
| 技能目录名 | 取 frontmatter `name`（kebab），**建议**与 `id` 一致 | `skill-archive.ts:300-302` 只校验 kebab，不比对两者 |

> **两处必须拍板的口径分歧（本文按下列建议，但要点名）**
> 1. **`description` 截断**：原型把 manifest `description` 截到 200 字符并补 `…`（`convert.py:219`），
>    而服务端上限是 2000（`SkillArtifactInspector.java:155`）、调研文档主张「超长报错不截断」
>    （`iflytek-skillhub-integration.md:560`）。**建议改成不截断**：manifest `description` ≤2000 直传，
>    >2000 才拒（`ENT_SKILL_CONVERT_FAILED`）。理由：截断是静默改内容。
> 2. **`sourceDshVersion` 写上游坐标**（原型实际做法）比写「本机 DSH 版本」更能一眼看出「这是外部导入的」，
>    与调研 §5.1 的推荐 (b) 同向。**建议保持 `skillhub.cn/<slug>@<version>` 形态**，并在 provenance 里另存
>    本机 DSH 版本与抓取时间（§F.4）。

#### C.1.5 许可取证（**必须回包内**）

优先级与判定照搬原型（`license_gate.py:141-181`）：

1. SKILL.md frontmatter `license`/`licence`（标量）
2. 包内 `LICENSE|LICENCE|COPYING(.md|.txt|.markdown)` **全文**分类
3. `README(.md|.en.md)` 的「许可证 / License / 授权」节
4. 元数据文件（`_meta.json`/`meta.json`/`manifest.json`/`package.json`/`attribution.json`）的 `license` 键

判定分档（原型实测用到过全部四档）：`ALLOW`（MIT/MIT-0/Apache-2.0/BSD/ISC/0BSD）、
`REJECT-COPYLEFT`（CC-BY-SA/CC-BY-NC-SA/GPL/AGPL/LGPL/MPL/EUPL…）、`REJECT-PROPRIETARY`、
`REJECT-UNKNOWN`（三者皆无）。**copyleft 必须先判**（GPL 文本里也含"Redistribution…"之类的宽松句式，先判 copyleft 才不会被误判为 BSD）。

> 实测代价：Top100 里 72/100 属于 `REJECT-UNKNOWN`（`EVIDENCE.md:72`）。
> 若默认「许可不明一律拒」，用户粘贴的多数地址会被拒 —— 这正是 §D.5 要给的**可配置**开关。

### C.2 GitHub（P1）

#### C.2.1 支持的地址形态（**给建议，不全上**）

| 形态 | 例子 | 建议 |
|---|---|---|
| 仓库根 | `https://github.com/{owner}/{repo}` | ✅ 支持（默认分支） |
| 指定 ref 的树 | `https://github.com/{owner}/{repo}/tree/{ref}/{path…}` | ✅ 支持（ref 可以是分支/tag/sha；`path` 定位子目录） |
| Release 资源 | `https://github.com/{owner}/{repo}/releases/download/{tag}/{asset}` | ⚠️ **仅当 `asset` 是 `.zip`/`.dshskill`**（P1）；`.tgz` 留到 P2 与 npm 一起做（需 tar 读取器） |
| raw 单文件 | `https://raw.githubusercontent.com/.../SKILL.md` | ❌ **不做**：单文件不等于包（缺 references/scripts、缺许可文件、无法确定技能目录名）。真需要时作为「单文件技能」另立规格，不在本轮 |
| 简写 `github:owner/repo` | —— | ❌ 不做（那是官方**插件** install spec 的形态，`install-spec.js:22`；技能不该借用插件语法） |

#### C.2.2 用什么下载（**实测对比**）

| 手段 | 本会话实测 | 结论 |
|---|---|---|
| `codeload.github.com/{o}/{r}/tar.gz/refs/heads/main` | 200 / 1.29s / 4,017,095 B（`anthropics/skills`） | 可用 |
| `codeload…/tar.gz/refs/tags/v5.2.1`、`/tar.gz/<sha>` | 均 200 | 可用 |
| `codeload…/zip/refs/heads/main` | **200 / 2.14s / 4,223,859 B / 526 条 / 根前缀 `skills-main/`** | ✅ **首选**（见下） |
| `git clone --depth 1` | 本会话**两次成功**，第二次 **2s** / 17 MB | ⚠️ 与任务背景「clone 在该网络下不稳定」**不一致**，见 §K 不确定项 |
| `raw.githubusercontent.com/…/README.md` | 200 / 0.30s | 可用（但本方案不用它） |
| `api.github.com/repos/…` | 200 / 0.59s | 用于**取 ref→commit sha**（provenance 固定） |

> **推荐：codeload 的 `zip` 端点，而不是 `tar.gz`。** 三条理由：
> 1. 我们能**直接复用**已经手写好的严格 ZIP 读取层（`skill-archive.ts:134-249` 的中央目录解析），
>    不必为 `.tar.gz` 新增一个 tar 解析器；
> 2. `bundle`（`dshent-plugin`）**运行时零第三方依赖**（`plugin/packages/bundle/package.json` 只有 peer/devDependencies），
>    工作区里**没有** `tar` 包 —— 引入会是治理级变更，手写 ustar 又是纯新增维护面；
> 3. zip 与 tar.gz 的内容视图等价（都是源码快照 + 单层根前缀）。
>
> **需要一次小重构**：`skill-archive.ts` 目前把「严格 ZIP 读取」与「`.dshskill` 布局契约」写在同一个函数里
> （`decodeDshSkillArchive`，`:283-322`）。建议**抽出**（不改变现有导出的行为）：
> - `readSafeZipEntries(bytes): SafeZipEntry[]` —— 中央目录/路径/上限/CRC/符号链接/重复路径（`:109-249` 原样搬）；
> - `decodeDshSkillArchive(bytes)` —— 在它之上跑 `manifest.json` + `skills/` 布局契约（对外 API 不变）。
>
> 这样 GitHub 的「普通 zip」与 `.dshskill` 走**同一份**路径安全判定，只是上层契约不同。

#### C.2.3 如何定位技能（多技能仓库策略）

实测样本 `anthropics/skills`（codeload zip，526 条）：根有 `README.md`、`spec/`、`template/`、`.claude-plugin/marketplace.json`，
技能在 `skills/<name>/SKILL.md`（**20 个**），每个技能目录里带自己的 `LICENSE.txt`。

| 情形 | 策略 | 错误码 |
|---|---|---|
| 包内**恰好 1 个** `SKILL.md`（根级，或 `skills/*` 下一层） | 直接装那一个 | — |
| 包内有 **N>1** 个 `skills/*/SKILL.md` | **要求用户把地址指到子目录**（`/tree/{ref}/skills/{name}`）；若地址只到仓库根 → 拒，并**回报候选清单**让用户重选/改地址 | `ENT_SKILL_SOURCE_AMBIGUOUS`(409) |
| 有 `SKILL.md` 但既不在根也不在 `skills/*`（如 `template/SKILL.md`） | 拒（避免把模板/示例当技能） | `ENT_SKILL_SOURCE_NO_SKILL`(400) |
| 一个都没有 | 拒 | `ENT_SKILL_SOURCE_NO_SKILL`(400) |
| 仓库根就是单个技能（根 `SKILL.md`） | 直接装 | — |

**候选上限**：候选数 > 200 按 `ENT_SKILL_SOURCE_AMBIGUOUS` 拒并只回前若干条（对齐 `SKILL_ARCHIVE_MAX_SKILLS=200`）。
**P1 不做「多技能一次全装成一个包」**（那需要打包语义；我们一个 `.dshskill` 虽支持多技能，但把整仓 20 个技能打成一包会让卸载/更新粒度失控）。

#### C.2.4 许可取证

优先级同 §C.1.5，但 GitHub 的常见落点不同：

1. `skills/<name>/LICENSE*`（**实测样本每个技能目录自带**，`anthropics/skills` 的 `skills/academy-guide/LICENSE.txt` 等）；
2. 仓库根 `LICENSE*`/`COPYING*`/`NOTICE`；
3. SKILL.md frontmatter `license`；
4. 仓库根 `README` 的许可证节。

**建议**：命中 (1) 时**只认该技能自己的许可**（多许可仓库里根许可未必适用于子目录）；
命中 (1) 同时根也有许可且两者**判定档位冲突**（如子目录 MIT、根 GPL）→ 按**更严**的处置（拒），并在错误里回报两者原文。

#### C.2.5 大小与超时上限（建议值）

| 项 | 建议值 | 说明 |
|---|---|---|
| 外层容器字节 | ≤ **50 MiB**（与 `SKILL_ARCHIVE_MAX_BYTES` 同值） | 实测 zip 4.2 MB，留足 |
| 解压后总字节 | ≤ **200 MiB**（与 `SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES` 同值） | 复用既有常量 |
| 条目数 | ≤ **10 000** | 复用 `SKILL_ARCHIVE_MAX_ENTRIES` |
| 重定向跳数 | ≤ **5**（逐跳校验，§F.1） | 新常量 |
| 连接超时 | 10 s | 新常量 |
| 整体超时 | 60 s（大仓 4 MB 实测 2 s，余量充足） | 新常量，超时码 `ENT_SKILL_FETCH_TIMEOUT` |
| 单个技能 `SKILL.md` | ≤ **256 KiB** | 复用 |

### C.3 npm（P2）

#### C.3.1 输入的三种形态

| 形态 | 例子 | 处理 |
|---|---|---|
| 包名 | `antd-claude-skill` | 取 `latest` |
| `@scope/pkg` | `@neat.is/claude-skill` | 同（scope 走 URL 转义 `@scope%2Fpkg`） |
| 带版本 | `antd-claude-skill@0.1.8`（也建议支持 `@^0.1` 让 registry 解析） | 精确版本 |
| registry tarball URL | `https://registry.npmjs.org/antd-claude-skill/-/antd-claude-skill-0.1.8.tgz` | ✅ 支持（直接取包，跳过元数据） |

**取包路径**（实测）：`GET https://registry.npmjs.org/{pkg}/{version}` → `dist.tarball`（HTTP 200，`express` 实测 0.82 s）。

#### C.3.2 如何判断「这是一个技能包」（判定规则）

**实测两类样本**：

| 包 | tarball 内容 | 判定 |
|---|---|---|
| `antd-claude-skill@0.1.8` | `package/skills/pro-components-page/SKILL.md`（1 个）+ `references/ templates/ examples/`、`package/dist/**`、`package/bin/cli.js`、`package/package.json` | ✅ 技能包 |
| `skilldex-cli@1.5.6` | `package/dist/**`、`package/cli/**` —— **0 个 SKILL.md** | ❌ 普通 npm 包（是一个技能包管理器） |

**判定规则（建议，按顺序）**：

```text
① npm tarball 的根前缀永远是 `package/`（实测两例）→ 先剥掉这一层
② 剥层后命中 SKILL.md 的路径集合：
   · 恰好 [`SKILL.md`]                        → 单技能包
   · 全部形如 `skills/<kebab>/SKILL.md` 且 ≥1  → 多技能包
   · 其它（含 0 个）                           → 不是技能包 → ENT_SKILL_SOURCE_NO_SKILL(400)
③ 若剥离后有 `package.json` 且其中声明了 `dsh.bundle.patch` / `dsh.bundle` 之类插件字段
   → 判为**插件包**，直接拒：ENT_SKILL_SOURCE_NOT_SKILL(400)
④ 多技能包同样走 §C.2.3 的策略（地址必须定位到子目录，或回候选）
```

#### C.3.3 与官方插件安装的边界（**不要把插件包当技能装**）

| 维度 | 官方插件安装 | 本方案的技能安装 |
|---|---|---|
| 入口 | `ctx.pluginManager.installBundle(spec)`（`install-spec.js:21-33` 的 git/tgz/绝对路径/npm 形态） | 我们的 skill 安装路由 |
| 机制 | pnpm + profile `package.json`/lockfile + **bundle patch** 激活 | 解包 + 原子改名进 `~/.dsh/skills` |
| 失败语义 | 失败/取消/无 patch → **回滚 package.json、pnpm-lock.yaml**（`index.d.ts:104-118`） | 失败 → 撤新目录、挪回旧目录（`skill-install.ts:420-428`） |
| 适用 | 插件/组件/bundle | **只有**技能 |

**硬规则**：技能安装路径**永不**调用 `installBundle`，**永不**读 `package.json` 的 `main`/`exports`，
**永不**对 npm 包执行 `pnpm`/`node`。npm 来源只被当成「一个装着 SKILL.md 的 tarball 容器」。

#### C.3.4 npm 的额外事实与代价

- npm 的 `dist.integrity`（sha512-base64）与 `dist.shasum`（sha1）是**上游自述**，与我们算的 sha256 不同族；
  **可以记进 provenance 作对照，但校验必须用我们自己算的 sha256**（`verification.ts:129-134` 的 `existingArtifact` 只认 sha256）。
- **`.tgz` = tar.gz**：需要 `zlib.gunzipSync` + **ustar 读取器**。实测 `gunzipSync` 支持 `maxOutputLength`
  （本会话验证：超出抛 `ERR_BUFFER_TOO_LARGE`），因此解压炸弹可控；
  但 tar 解析器要**手写**（约 100–150 行：512 字节头 + 名字/前缀/尺寸/类型标志 + 校验和 + 长名 `././@LongLink` 处理），
  因为工作区**没有** `tar` 依赖。**这是把 npm 放到 P2 的唯一技术原因。**

### C.4 扩展性：新增一个来源要改哪几处

#### C.4.1 「来源适配器」接口形状（**只给形状，不给实现**）

```text
SkillSourceAdapter {
  id: string                       // 'skillhub' | 'github' | 'npm' | ...（也是 provenance 的 sourceType）
  label: string                    // 界面显示名（'SkillHub' / 'GitHub' / 'npm'）
  // ① 纯本地识别 + 解析：不发网络、不读磁盘
  parse(input: string): ParsedSource | null
      // ParsedSource = { id, canonicalUrl, ref, displayHint? }
  // ② 取包描述：返回「要取哪几个地址」，由 Host 的统一 fetcher 执行（适配器自己不出网）
  plan(ref): Promise<FetchPlan>
      // FetchPlan = { requests: [{url, accept?, maxBytes}], kind: 'zip' | 'targz' }
  // ③ 纯转换：容器字节 → 我们的包布局（内存 entries）+ 许可证据 + provenance
  convert(container: SafeArchive): ConvertedPackage
      // ConvertedPackage = { entries, manifest, license: LicenseEvidence, provenance, candidates? }
  // ④ 可选：安装前预览（文件树 / 技能清单 / 许可），供 UI 展示后再确认
  preview?(container: SafeArchive): PreviewFacts
}
```

**约束（写进接口注释，不是建议）**
- 适配器**不得**持有网络客户端、不得写文件、不得碰 `installed.json`、不得执行任何东西；
- 一切网络由 Host fetcher 执行（统一 SSRF/重定向/超时/上限）；
- 一切落盘由既有 `skill-install` 下游执行；
- 输出必须**先过 §D 闸门**才允许进入下游（适配器不是可信边界）。

#### C.4.2 新增一个来源要改的地方（清单）

| # | 位置 | 改什么 | 冲突风险 |
|---|---|---|---|
| 1 | 新文件 `…/skill-sources/<id>.ts` | 适配器实现 | 低（新文件） |
| 2 | 适配器注册表（一处 `skillSourceAdapters` 数组） | 加一行 | 低 |
| 3 | `platform-client` 的 `enterpriseLocalErrorStatus`（`local-api.ts:200-215`） | 若新来源需要新错误码，加映射 | **中**（共享映射表） |
| 4 | `ui/src/local-api-decode.ts:317` 的唯一错误码投影 | 同上 | **中** |
| 5 | 界面：来源名 + 风险文案 + 确认弹窗的「来源」行 | 加文案常量 | **高（`ui/**` 正被其他代理改动，见 §H.3）** |
| 6 | provenance 记录字段（`sourceType` 枚举） | 加枚举值 | 低 |
| 7 | 测试与夹具（真包样本 + 拒收样本） | 加一组 | 低 |
| 8 | 本文与 `docs/compose/spec/skill-catalog.md` | 更新 | 低 |

**只有 3/4/5 是共享面。** 3 与 4 各只加一行；5 是 UI 面，必须串行排期（§H.3）。

---

## D. 校验闸门（客户端侧 fail-closed 设计）★重点

**总口径**：本机没有服务端验包，因此**什么都自己判**；任一条不过就**整包拒绝、不留半个目录**；
错误码一律 `ENT_*`，响应体只回稳定码（不带上游正文、不带上游地址）。

### D.1 ZIP 结构与路径安全

| # | 规则 | 现状 | 处置/错误码 |
|---|---|---|---|
| D1-1 | 只允许根 `manifest.json` + `skills/` 子树（`skills/` 目录条目本身容忍） | ✅ 已实现 `skill-archive.ts:296-298`、`:294` | 复用；失败 `ENT_SKILL_ARCHIVE_INVALID`(400) |
| D1-2 | 拒绝绝对路径（前导 `/`）、Windows 盘符、反斜杠、NUL、控制字符、`..`/`.` 段、空段、超长（>1024 总长 / >255 单段） | ✅ 已实现 `skill-archive.ts:110-129` | 复用 |
| D1-3 | 拒绝**符号链接/设备/FIFO**（Unix 生产者写进扩展属性高位的 `st_mode`） | ✅ 已实现 `skill-archive.ts:200-208` | 复用（**zip-slip 的关键一道**） |
| D1-4 | 拒绝**重复路径** | ✅ 已实现 `skill-archive.ts:214` | 复用 |
| D1-5 | 拒绝加密条目、多盘、ZIP64、非 store/deflate 方法 | ✅ 已实现 `skill-archive.ts:149-163`、`:192-199` | 复用 |
| D1-6 | **大小写冲突路径**（`skills/A/x` 与 `skills/a/X`） | ❌ **未实现**（`seen` 只做精确串去重） | **建议补**：在 `seen` 之外维护一个 case-fold 集合，碰撞即拒。Android/ext4 区分大小写所以今天不致命，但换 mac/Windows 就是覆盖写；成本极低 |
| D1-7 | 条目路径必须是**无损 UTF-8 往返**（不能静默改名） | ✅ 已实现 `skill-archive.ts:116` | 复用 |

### D.2 压缩炸弹

| # | 规则 | 现状 | 建议 |
|---|---|---|---|
| D2-1 | 归档字节 ≤ **50 MiB** | ✅ `skill-archive.ts:12`、`:135` | 复用 |
| D2-2 | 条目数 ≤ **10 000** | ✅ `skill-archive.ts:16`、`:164` | 复用 |
| D2-3 | 解压后总字节 ≤ **200 MiB** | ✅ `skill-archive.ts:14`、`:221-223` | 复用（**但它累加的是中央目录「声明的」大小**） |
| D2-4 | 单条目解压上限（**实际**而非声明） | ❌ **未实现** | **必须补**：`inflateRawSync(compressed)`（`skill-archive.ts:239`）**没传 `maxOutputLength`**，而 zlib 支持它（本会话验证：超出抛 `ERR_BUFFER_TOO_LARGE`）。恶意中央目录可以「声明小、实际膨胀大」，正好绕过 D2-3 的声明累加，在 `:244` 的实际长度比对之前就吃掉内存。**建议**：`maxOutputLength = min(单文件上限(256 KiB 级), 剩余总额)` |
| D2-5 | 压缩比上限 | ❌ 未实现（也不必） | **建议不引入独立比率**：D2-1+D2-3+D2-4 三点已经封住「输入 50 MiB → 输出 200 MiB / 单文件封顶」；比率阈值只会误伤高压缩比的正常文本（技能包就是 markdown 为主）。若合规要求必须显式，取 **100:1** 并只作**告警留痕**不作拒绝 |
| D2-6 | 外层容器（GitHub zip / npm tgz）同样受 D2-1…D2-4 | 新增 | GitHub zip 复用同一读取层；npm 的 gunzip 必须传 `maxOutputLength` |

### D.3 manifest 校验

| # | 规则 | 现状 | 处置 |
|---|---|---|---|
| D3-1 | `manifest.json` 必须存在且在根、是 object、是合法 JSON | ✅ `skill-archive.ts:285-287`、`:259` | 复用 |
| D3-2 | `format === "dsh-skill"`、`version === "1"`（**字符串**） | ✅ `skill-archive.ts:263` | 复用 |
| D3-3 | `id` ≤128 且 `^[A-Za-z0-9][A-Za-z0-9._-]*$` | ✅ `skill-archive.ts:266-269` | 复用 |
| D3-4 | `id` 与技能目录名的**一致性** | ❌ 服务端与客户端都不校验（`iflytek-skillhub-integration.md:610`） | **建议客户端加一致性校验**（`id` 与 `skills/<name>` 名一致，多技能包则 `id` 只作包标识）；不一致时报 `ENT_SKILL_MANIFEST_INVALID`(400)。理由：自发安装没有中心详情来交叉验证，`id` 是唯一可自证的标识 |
| D3-5 | 字段类型（`name` ≤120、`description` ≤2000、`sourceDshVersion` ≤64、`category` ≤32） | 服务端有（`SkillArtifactInspector.java:146-155`）；**客户端 `skill-archive.ts` 只读 `format/version/id` 三个** | **必须补**：客户端补齐 `name`/`sourceDshVersion` 的类型与长度校验；`description`/`category` 若存在则校验长度 |
| D3-6 | **未知顶层字段** | 服务端「按名取 5 个，未知键不报错也不保存」（`SkillArtifactInspector.java:146-155`）；调研印证（`iflytek-skillhub-integration.md:635`） | **建议：忽略但留痕**（与既有口径一致）。**不要**改成拒绝：会让未来加字段（如 `license`/`source`）变成破坏性变更。但**要在 provenance/日志里记下见过的未知键**，便于发现上游悄悄加字段 |
| D3-7 | 包内技能数与技能名集合（≤200、kebab、不重复） | ✅ `skill-archive.ts:300-302`、`:315`；`:139-142`（服务端同级） | 复用 |
| D3-8 | 每个技能必须有 `SKILL.md` | ✅ `skill-archive.ts:318` | 复用 |

### D.4 SKILL.md frontmatter（**客户端的最大缺口**）

`decodeDshSkillArchive` **明确不解析正文**（`skill-archive.ts:4`、`:281` 的 POS 注释：正文语义交给官方 `skill-filesystem`）。
但**服务端 `SkillArtifactInspector` 是整包拒绝级**的 frontmatter 校验，而本机安装没有服务端 ——
这条缺口必须由客户端补上（**建议新增一个 `validateSkillFrontmatter(bytes, name)`，在 `decodeDshSkillArchive` 之后、落盘之前调用**）：

| # | 规则 | 服务端依据 | 客户端处置 |
|---|---|---|---|
| D4-1 | 必须有 `---` 起止的 frontmatter；缺失/未闭合 → 拒（官方运行时是「忽略该文件」，我们**升级为整包拒绝**，照服务端） | `SkillArtifactInspector.java:204-214` | 新实现，`ENT_SKILL_SKILLMD_INVALID`(400) |
| D4-2 | frontmatter 必须是映射，键必须全是字符串 | `:180-185` | 同上 |
| D4-3 | **YAML 重复键拒绝** | `:174`（`setAllowDuplicateKeys(false)`） | **必须显式实现**：JS 的 YAML 解析器默认也是「后者覆盖」，不报错。原型用正则预扫（`preflight_all.py`，实测拦下 `multi-search-engine` 的重复 `homepage`，`EVIDENCE.md:127`）。**建议**：先做一次与解析器无关的键扫描 + 再解析 |
| D4-4 | YAML 别名数 ≤16（DOS 防护） | `:175` | 按解析器能力尽量对齐；做不到就记录为**未对齐项** |
| D4-5 | `name` 必填、kebab ≤64 | `:193-194` | 新实现 |
| D4-6 | `description` 必填、≤1024、非空 | `:195` | 新实现 |
| D4-7 | `whenToUse` 可选 ≤2048；`disable-model-invocation`/`user-invocable` 布尔（接受 `true/false/yes/no/on/off/1/0`） | `:196-201`、`:231-244` | 新实现（宽松解析按同一张字面量表） |
| D4-8 | **legacy 字段拒绝并给改名建议**：`modelInvocable`→`disable-model-invocation`、`userInvocable`→`user-invocable`、`disableModelInvocation`→`disable-model-invocation` | `:49-53`、`:186-192` | 新实现（错误文案必须含改名建议） |
| D4-9 | 单个 `SKILL.md` ≤256 KiB | ✅ `skill-archive.ts:20`、`:306-308` | 复用 |
| D4-10 | 未知 frontmatter 键 | 服务端「容忍但不透传」（`:193-201` 只按名取 5 键） | **忽略但留痕**，同 D3-6 |

> **一致性风险（必须写进测试）**：客户端补的这 10 条与 Java 侧那套是**两份实现**。
> 一旦漂移，就会出现「能装上但服务端不认」或反之。**建议**：
> ① 把服务端的拒收样本（`SkillArtifactInspectorTest` 的 8 个用例）抄成客户端夹具，做成**跨语言同一组反例**；
> ② 在文档里点明「哪一侧是权威」：**服务端仍是发布闸门的权威**，客户端这套是「本机安装的最低门槛」，
> 二者允许客户端**更严**（例如 D3-4 的一致性校验就是客户端独有的），但**不允许客户端更松**。

### D.5 许可证

| 问题 | 建议口径 | 理由与代价 |
|---|---|---|
| 安装前要不要强制读取并展示许可？ | **要，强制**。取不到许可就按「许可不明」处置，并**在确认弹窗里显示许可原文与证据位置**（frontmatter / 包内文件 / README 节 / 元数据） | 让用户为「自己装的东西」负责；证据位置可复核。代价：多一次解析（纯本地，无网络） |
| copyleft（CC-BY-SA / CC-BY-NC-SA / GPL 系）要不要拒？ | **默认拒**（`ENT_SKILL_LICENSE_DENIED`(403)），错误里回报命中的条款原文与文件路径 | 依据：`docs/plan/borrow-from-skillhub.md:66-67` 的法务提示；原型实测有真实双轨许可样本（`EVIDENCE.md:119`）。同组织内分发 copyleft 内容会带来传染义务 |
| 「许可不明」（无 license 字段、无 LICENSE、README 无许可节）？ | **默认拒**，但提供一个**管理员可开的开关** `allowUnknownLicense`（默认 false）；开启后降级为「警告 + 确认弹窗必须勾选」 | 实测 72/100 属此档（`EVIDENCE.md:72`）。若默认放行，等于我们自发把未知许可内容推给全员；若默认拒绝且不给开关，功能可用性会很低。**默认拒绝 + 显式开关**是唯一能同时守住底线与可用性的口径 |
| proprietary / All rights reserved？ | **拒**（`ENT_SKILL_LICENSE_DENIED`(403)），与 copyleft 同码不同文案 | 原型同口径（`license_gate.py:32`、`:76-77`） |
| 许可 allowlist 可配置吗？ | **可**（管理员设置）；默认 allowlist = `MIT, MIT-0, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD` | 与原型硬闸门一致（`license_gate.py:20-26`、`:60-73`） |
| **企业侧无内容扫描这件事** | **必须在文档、接口注释与界面文案里如实写明**：我们只保证「结构 + 许可 + 来源」，**不保证内容安全，也不保证技能在设备上跑得通** | `EVIDENCE.md:391`、`docs/plan/borrow-from-skillhub.md:60-64`；调研亦指出实测样本大量依赖 python/API KEY/MCP（`borrow-from-skillhub.md:96-97`） |

### D.6 「不执行任何内容」（写死）

```text
本方案的任何一步都不会执行包内的任何字节：
  · 不开子进程（不 exec/spawn/fork），与 skill-install.ts:9 的导入面一致（无 child_process）
  · 不做动态 import()/require()，不解 eval 类接口
  · 落盘一律 mode 0o600（skill-install.ts:384），目录 0o700（:378），不落可执行位
  · 不改 PATH，不注册任何 hook/别名/服务
  · 包内 scripts/**、hooks/**、*.cjs、*.py 只作为**普通文件**落盘；官方 dsh-skill-filesystem 只发现
    skills/<name>/SKILL.md 这一棵树（dsh-skill-filesystem/lib/index.js:550-556），不执行其中的脚本
  · JSON/SKILL.md 只作数据解析；解析器不得求值（YAML 用 Safe 构造器语义，禁自定义 tag/对象反序列化）
```

**同时点明事实：我们不做内容安全扫描。** 实测三方技能包里**真的带可执行脚本**
（`skills/dev-expert/hooks/*.py` 30 个、`scripts/*.cjs` 16 个，见 `convert.out` 目标路径清单），
所以「不执行」是我们**唯一**的防线，不能靠「包里没有脚本」来侥幸。

---

## E. 信任与授权模型（与企业中心分发的关系）★重点

### E.1 核心矛盾（先摆清楚）

```text
企业中心的技能 = 受控分发：管理员上传/发布 → 分配（assignments）→ 员工只能装被分配的
本地上传 / 粘贴地址 = 用户自发安装：不受分配约束、不经审批、中心看不见
                              ↑ 两者落到同一个 ~/.dsh/skills 发现面
```

**同一个落盘目录 = 同一个信任域**。这是本方案最大的治理风险：
一旦自发安装默认对全员开放，`~/.dsh/skills` 就**不再是**「企业受控内容目录」，
`docs/compose/spec/skill-catalog.md` 的整套治理（`ent:skill:read/write`、`SKILL_*` 审计、assignments）在**员工侧**就被旁路了。

现有的治理事实（供对照）：

| 事实 | 出处 |
|---|---|
| 技能贡献模型：仅 `plugin_admin`/`enterprise_admin` 上传与发布；员工一期只「复制装配指令」，落盘调和器列为二期 | `docs/compose/spec/skill-catalog.md` S2.1（贡献模型/员工消费两行） |
| 服务端权限码 `ent:skill:read` / `ent:skill:write`（F 型固定权限行） | `server/…/skill/web/AdminSkillController.java:58,83,106,117,128`；`db/migration/V35__enterprise_skill_catalog.sql:90-91` |
| 审计 action 五条：`SKILL_VERSION_UPLOADED`/`_PUBLISHED`/`_RETIRED`/`SKILL_ASSIGNMENTS_REPLACED`/`SKILL_DOWNLOAD_AUTHORIZED` | `db/migration/V35__enterprise_skill_catalog.sql:120-121`；`audit/AuditAction.java:40-44` |
| 可见/可装两层判定与「浏览自由·安装受控」 | `docs/plan/enterprise-marketplace-phase2.md:271-294` |
| 员工侧已装真值只有 `installed.json` 一处（`/skills/installed`） | `plugin/packages/bundle/src/skill-install.ts:265-281`；`plugin/packages/platform-client/src/local-api.ts:554-573` |

### E.2 推荐口径（三条 + 理由 + 风险）

#### ① 谁能用这个能力：**默认关闭，由管理员开关；开启后可再限定范围**

| 选项 | 评价 |
|---|---|
| 全员默认开放 | ❌ 否决：等于把未审内容直接推给全员，且员工侧绕过 assignments |
| **默认关闭 + 管理员开关（推荐）** | ✅ 开关粒度建议两级：`enabled`（本机自装总开关，默认 **false**）+ `allowUnknownLicense`（许可不明，默认 **false**）。开关放在既有企业设置作用域（`@deepseek-ai/dsh-settings`，bundle 已有 peer 依赖） |
| 只有管理员/root 能用员工端本机自装 | ⚠️ 过度：Android 员工端没有服务端可信身份来区分「管理员在这个设备上」；靠中心下发开关更诚实 |
| **不用**「按 assignments 逐技能授权自发安装」 | ❌ 语义混乱：自发安装的定义就是「没有中心记录」，再挂中心授权就自相矛盾 |

**理由**：企业侧已有「发布要审批」的心智（`skill-catalog.md` S2.1 贡献模型）；
本机自装是**在受控面旁边开的一扇侧门**，侧门必须默认锁着，由管理员决定开不开。
**风险**：开关一开就是**全员开**（没有按人的服务端许可），所以必须配合 ② 的显著区分与 ③ 的审计。

#### ② 界面上如何**显著区分**「企业分发」与「本机自装」

| 维度 | 企业分发 | 本机自装（建议） |
|---|---|---|
| 分区 | 现有「企业技能」页签 | **独立分区/独立页签**「本机技能」，**不混进受控目录**（见 ③） |
| 标记 | —— | 每行固定一个来源标签：`本机自装 · <来源>`（来源 ∈ `本地上传` / `SkillHub` / `GitHub` / `npm`） |
| 视觉 | 官方两行卡片（既有） | 同卡片 + **醒目来源徽标**（沿用官方 `Tag` 原语，不新造颜色） |
| 详情 | 中心详情（描述/版本/分类） | 中心信息之外**必须**显示：来源地址（原始 URL）、拉取时间、许可（含证据位置）、sha256 前若干位 |
| 卸载 | 既有 `/skills/uninstall` | 独立卸载动作（见 E.3 的归属规则） |
| 文案 | 「企业发布」 | 「**你从本机装的，未经企业审核**」—— 这句必须在**安装确认弹窗**与**行内详情**各出现一次（不重复同一句时可以拆成风险短句 + 详情长句，遵守既有「摘要与详情不重复同一句」的纪律，见 `marketplace-entry.tsx` 第 4 行 `[OUTPUT]`） |

**理由**：混排会让用户以为「企业审过了」；这是**信任误导**，比功能缺失严重得多。

#### ③ 装了之后是否出现在企业列表里：**不进，单独存、单独列**

| 项 | 建议 |
|---|---|
| 状态文件 | **独立一份**（如 `<dshHome>/enterprise/skill-installs/self-installed.json`），**不写进** 既有 `installed.json` |
| 理由 | 既有 `installed.json` 的记录形状是**严格八键**、且 `packageId`/`versionId` 必须匹配雪花 id 正则（读盘时强制：`skill-install.ts:221-228`，实测磁盘内容见 §0.1）。自发安装**没有**中心 snowflake id —— 硬塞进去要么伪造 id（污染中心口径），要么放宽形状（破坏既有记录兼容，`Object.keys(row).sort().join(',')` 是**逐字**比对） |
| 已装态接口 | 新增 `GET /local/skills/self-installed`（与 `/skills/installed` 同族并列），**返回结构相似的记录但字段不同**（`sourceType`/`sourceUrl`/`fetchedAt`/`license`/`sha256`/`names`/`installedAt`），**不复用** `decodeEnterpriseInstalledSkills`（那会强迫曲线救国式填假 id） |
| 企业列表 | 自发安装的技能**不出现**在 `/enterprise/api/v1/skills` 的镜像里（那条列表来自中心，天然不受影响）；界面在**独立分区**列出 |
| **落盘目录归属** | 两者共用 `<dshHome>/skills`（官方只认这一个 user-dsh 根，无法分区）。因此**必须**有跨归属的保护（见 E.3） |

#### ④ 是否进审计：**本机侧留痕 + 中心侧可选上报（P2）**

| 层 | 建议 |
|---|---|
| 本机 | 每次自装/卸载写一条**本机 provenance 记录**（§F.4）：来源、原始地址、解析出的坐标、sha256、许可及证据位置、时间、结果码。**这会是本机唯一可查的审计面** |
| 中心 | P0/P1 **不上报**（不新增服务端接口、不新增审计 action）。理由：上报意味着「中心要接受一份未经审批的安装事实」，与 `V35` 的 5 条受控 action 白名单语义冲突；若要做，应作为 P2 的**独立设计**（新 action + 隐私边界：是否上报技能名/来源 URL 本身就是敏感信息） |

### E.3 跨归属保护（**必须，否则自发安装能删掉企业技能**）

既有 `uninstallSkillPackage` 的删除判据是「本包记录里的目录、且不被**别的记录**引用」
（`skill-install.ts:442-465`）。自发安装的第二份记录**不在** `records` 里，所以：

| 规则 | 说明 |
|---|---|
| 企业卸载**必须**同时看自装记录 | 否则企业包卸载会删掉「同名但属于自装」的目录 |
| 自装卸载**必须**同时看企业记录 | 否则自装卸载会删掉企业技能 |
| 落点冲突判定**必须**合并两份记录 | 既有 `ownedElsewhere`（`skill-install.ts:349-351`）只算企业记录；自装必须把「企业记录 ∪ 自装记录 − 自己」一起当 `ownedElsewhere`，否则会出现「自装覆盖企业技能目录」 |
| 建议实现 | 把「谁拥有这个名字」收敛成**唯一一个查询**（读两份记录求并集），两处卸载与两处安装共用；**不要**在四处各写一遍 |

### E.4 诚实的风险陈述（必须写进方案与界面的）

1. **企业侧无内容安全扫描**：本方案不扫描技能正文，不自建扫描器；因此自发安装 = 用户自担内容风险。
2. **不保证可运行**：实测样本大量依赖 python 三方库/外部数据源/MCP/API KEY（`borrow-from-skillhub.md:96-97`），
   我们只保证结构与许可。
3. **许可取证是启发式的**：靠关键词与文件位置判定，会漏（如许可写在正文末尾、写在图片里）。
   默认拒绝「许可不明」降低了风险，但**不能**声称「许可判定一定正确」。
4. **上游接口未冻结**：skillhub.cn 是社区站（`EVIDENCE.md:7-19` 实测其 SPA 与 API 分域），字段/端点随时可变；
   因此适配器必须「解析失败即拒」，不做兜底猜测。
5. **旁路治理**：开关一开，员工侧就有了不经 assignments 的安装能力 —— 这是**有意的产品决定**，不是缺陷，但必须让决策者看到。

---

## F. 安全清单（逐条给防护与错误码）

### F.1 SSRF（**通路二专属，最重要的一条**）

| # | 规则 | 错误码 |
|---|---|---|
| F1-1 | **只允许 `https:`**。拒绝 `http:`/`file:`/`data:`/`blob:`/`ftp:`/`ws:` 等一切其它 scheme | `ENT_SKILL_SOURCE_BLOCKED`(400) |
| F1-2 | 只允许**公网可路由**地址；**DNS 解析后**再判一次：拒 loopback（127/8、::1）、私有（10/8、172.16/12、192.168/16、fc00::/7）、链路本地（169.254/16、fe80::/10）、**云元数据**（169.254.169.254、metadata.google.internal 等）、组播/保留段、`0.0.0.0`、IPv6 映射的 IPv4 | `ENT_SKILL_SOURCE_BLOCKED`(400) |
| F1-3 | **重定向逐跳校验**：每一跳的目标 URL 都要重跑 F1-1/F1-2（**不能只验第一跳**），且 **跳数 ≤ 5** | 超跳数 → `ENT_SKILL_SOURCE_BLOCKED`(400) |
| F1-4 | 解析后**连接同一 IP**（防 DNS rebinding）：建议用固定解析结果的请求方式；做不到时至少做到 F1-2 的**每跳复检**并在文档里标为**残余风险** | `ENT_SKILL_SOURCE_BLOCKED`(400) |
| F1-5 | 禁止携带任何凭据：不发 Cookie、不发 `Authorization`、不发 `Referer` 以外的自定义头；**不得**走 `EnterprisePlatformService.request`（它强制同源 + Bearer，`platform-service.ts:695-706`） | —— |
| F1-6 | 只允许**已知端口**（443） | `ENT_SKILL_SOURCE_BLOCKED`(400) |
| F1-7 | 超时（连接 10 s / 整体 60 s）+ 下载上限（≤50 MiB）+ **边下边计数**（超限立即断流并删 `.part`） | `ENT_SKILL_FETCH_TIMEOUT`(504) / `ENT_SKILL_FETCH_TOO_LARGE`(413) |
| F1-8 | 上游非 2xx → 归 `ENT_SKILL_FETCH_FAILED`(503)，**不把上游正文带回界面** | `ENT_SKILL_FETCH_FAILED`(503) |
| F1-9 | 实测：skillhub.cn 的下载会 **302 跨到 `*.cos.accelerate.myqcloud.com`**（§L.3）→ 所以**不能**用「只允许单一主机」的窄白名单；F1-3 的逐跳「只校验公网可达 + https」才是正确口径 | —— |

### F.2 路径安全（**复用既有手法，指明复用哪一份**）

| # | 规则 | 复用的实现 |
|---|---|---|
| F2-1 | 解压前的路径门禁（绝对路径/盘符/反斜杠/控制字符/`..`/空段/超长）+ 符号链接拒绝 + 重复路径 | `plugin/packages/bundle/src/skill-archive.ts:109-131`、`:200-208`、`:214` |
| F2-2 | 落点解析：**记录归属 → `lstat`（不跟随符号链接）→ `realpath` 逐字等式**三重校验；文件名/路径含 `%`（二次编码绕过）一律拒 | `plugin/packages/bundle/src/skill-install.ts:543-566`（`requireRelativeSkillPath`）、`:690-731`（`resolveInstalledSkillTarget`） |
| F2-3 | 目录树遍历时任何符号链接/非常规条目 → fail-closed；深度 ≤8、条目 ≤1000 | `skill-install.ts:779-829`（`collectSkillEntries`）、`:481-483` |
| F2-4 | 客户端交来的永远只是**键形状**（包 id 雪花、相对路径），**不是**路径片段；落点由 Host 自己拼 | `skill-install.ts:670-688`（该行的设计纪律原文） |
| F2-5 | 本机自装**不接受**用户提供的目标路径/技能目录名（目录名只能来自**包内**的 kebab 条目，且再过一遍 kebab 正则） | `skill-archive.ts:300-302` |
| F2-6 | 上传走的 multipart 有界读取 | `plugin/packages/bundle/src/feedback-route.ts:377`、`:437-453`（`readBoundedBody` + `content-length` 预检） |

### F.3 重放 / 幂等

| # | 规则 | 复用的实现 |
|---|---|---|
| F3-1 | **内容寻址**：制品文件名就是 `${sha256}.dshskill`，同内容重复请求**零网络复用** | `plugin/packages/plugin-distribution/src/verification.ts:186-192`、`:129-139` |
| F3-2 | 同 `sha256` 且文件仍在 → 幂等成功（不报冲突、不重写） | `skill-install.ts:342-347` |
| F3-3 | **名字冲突策略与既有 409 口径一致**：同名目录属于别的包/来路不明 → `ENT_SKILL_NAME_CONFLICT`(409) | `skill-install.ts:349-370`；映射表 `platform-client/src/local-api.ts:204-205` |
| F3-4 | 同一包重复点击 → 幂等；不同包同技能名 → 409（**不覆盖**） | 同上 |
| F3-5 | 上传通路也走内容寻址（先算 sha256 再落制品），因此「同一个文件重复上传」= 幂等 | 同 F3-1/F3-2 |

### F.4 供应链：provenance（**记录进自装记录**）

自发安装的记录字段建议（**必须可追溯**）：

```text
names[]           落盘的技能目录名（kebab）
sha256            我们对**最终 .dshskill 字节**算的摘要（唯一权威摘要）
sourceType        'upload' | 'skillhub' | 'github' | 'npm'
sourceInput       用户原样粘贴的地址或上传文件名（脱敏：去掉查询串里的签名参数）
resolvedUrl       归一化后的真实取包地址
coordinate        解析出的来源坐标（如 skillhub.cn 的 @handle/slug@version；github 的 owner/repo@ref）
containerSha256   外层容器（GitHub zip / npm tgz）的 sha256 —— 与 sourceInput 的**上游自述摘要**对照
upstreamDigest    上游自述摘要（npm 的 dist.integrity/shasum；无则 null）—— **仅对照，不作校验**
license           { id, verdict, evidenceKind, evidenceRef }（evidenceRef 如 'skills/x/LICENSE.txt'）
fetchedAt         取包时间（ISO）
installedAt       落盘完成时间（ISO）
toolVersion       本机 dshent-plugin 版本
dshVersion        本机 Harness 版本
resultCode        成功或失败码（成功后仍留一条，便于事后解释「它是什么时候进来的」）
```

**不记录**：SKILL.md 正文（沿用「不存正文」口径）、任何凭据、上游响应的原始正文。
**记录方式**：与自装清单同文件原子写（同 `skill-install.ts:245-257` 的纪律）。

### F.5 提权

| # | 规则 |
|---|---|
| F5-1 | 全程**零** `exec`/`spawn`/`fork`/`child_process`（与 `skill-install.ts:9` 的导入面一致），不调用 pnpm/npm/git 可执行文件 |
| F5-2 | 不落可执行位：文件 `mode 0o600`、目录 `mode 0o700`（`skill-install.ts:378`、`:384`、`:251`） |
| F5-3 | 不改 `PATH`、不写 shell 配置、不注册别名/hook/服务/开机项 |
| F5-4 | 不动态 `import()`/`require()` 包内文件；不把包内路径加入任何模块解析路径 |
| F5-5 | 越权面防御：新路由必须**不新增**任何「按用户输入拼文件系统路径」的入口；上传路由只写固定目录（`enterprise/skill-uploads/<sha256>.dshskill`） |

---

## G. UI 设计

### G.1 入口位置（建议）

> **逐元素布局、弹层结构与 spec 输入语法以 `docs/plan/add-skill-flow-reference.md` 为准**（那是官方「添加插件」流程的参照规格）。
> 本节只规定**不可让步**的四条口径：① 不与受控目录混排；② 必须有安装前确认；③ 必须有稳定错误码与来源徽标；④ 不做远端版本检查。

| 通路 | 入口 | 理由 |
|---|---|---|
| 本地上传 | 「企业技能」页签工具栏右侧一枚次要按钮「**从文件安装**」 | 与既有工具栏（搜索、刷新）同级，不抢主操作 |
| 粘贴地址 | 同一位置第二枚按钮「**从地址安装**」，点开弹窗输入 | 同一心智（装一个不在目录里的东西），两个入口并列 |
| 二者共同 | **独立分区/页签「本机技能」** 列出已自装技能 | 与受控目录分开（§E.2②） |

> ⚠️ 具体落点（是否放进 `marketplace-entry.tsx` 的三页签、还是 `skill-market.tsx` 的工具栏）**取决于并行改动结果**，
> 见 §H.3。本文只规定「必须与目录行分开呈现」这一条不可让步的口径。

### G.2 交互步骤

**通路一（从文件安装）**

```text
点「从文件安装」→ 文件选择器（accept=.dshskill,application/vnd.dsh.skill+zip,application/zip）
→ [前端] 尺寸预检 + 显示文件名/大小
→ [Host] 上传 + 校验闸门（进度：上传中 → 校验中）
→ [弹窗] 「安装前确认」：包名/技能清单/来源=本地上传/大小/sha256 前 12 位/许可（含证据位置）
          + 风险短句 + 确认按钮
→ [Host] 落盘（原子）
→ [界面] 行进「本机技能」分区，标 `本机自装 · 本地上传`，可打开详情（文件树 + SKILL.md 预览，走既有只读路由）
```

**通路二（从地址安装）**

```text
点「从地址安装」→ 弹窗输入地址（单行）
→ [前端] 只做「非空 + 长度」收窄，**不做**来源识别（识别在 Host，避免前端与后端两套判定）
→ [Host] 解析来源 → 「安装前预览」：
         来源（SkillHub / GitHub / npm）+ 归一化地址 + 包名/技能清单（多技能时给候选选择）
         + 许可（含证据位置）+ 大小 + sha256 前 12 位 + 风险短句
→ 用户选技能（多技能时）/ 勾选风险确认
→ [Host] 取包 + 转换 + 校验 + 落盘（进度：取包中 → 校验中 → 安装中）
→ [界面] 同通路一，标 `本机自装 · <来源>`
```

### G.3 风险确认弹窗文案（建议，需法务/产品复核）

| 场景 | 文案要点（短句，界面直接可用） |
|---|---|
| 通用风险句 | 「**你将安装一个未经企业审核的技能。** 内容由第三方提供，企业可能不会扫描其内容。」 |
| 二次确认（许可不明 AND 开关已开） | 「**该技能没有声明许可证。** 继续安装可能带来合规风险，请确认你已获得授权。」 |
| 不执行保证（**正向告知，建立信任**） | 「安装只是把文件放进技能目录，**不会运行包里的任何脚本**。」 |
| 多技能仓库 | 「这个地址里有 **N 个**技能，请选择要安装的一个。」 |
| 覆盖冲突 | 「本机已有同名技能目录（属于<企业技能/另一个已装技能>），**不会覆盖**。请先卸载它，或换一个包。」 |

**文案纪律（沿用仓库既有）**：不出现价格/交易/购买/购物车/客服等商业化字样；只显示稳定错误码 + 固定文案，不自造长句解释（`docs/plan/enterprise-marketplace-phase2.md:294`）。

### G.4 进度与失败的可见反馈

| 项 | 建议 |
|---|---|
| 进度 | 三态文案：`上传中/取包中` → `校验中` → `安装中`；按钮禁用 + 旋转图标（`LoaderCircle`，`skill-market.tsx:20` 已有导入） |
| 取消 | 上传/取包**可取消**（abort）；校验与落盘的原子阶段**不可取消**（避免半状态） |
| 失败 | 行内 `role="alert"` + 「安装失败：<稳定错误码>」——沿用既有 `EnterpriseMarketActionError` 形状（`marketplace-entry.tsx` 第 4 行 `[OUTPUT]` 的失败反馈约定） |
| 重试 | 网络类失败给「重试」按钮；校验/许可类失败**不给**重试（同一包必然同错），只给「换一个包/改地址」 |
| 成功 | 行进入「本机技能」分区，来源徽标 + 可打开详情；**不弹成功对话框**（与既有安装动作一致） |

### G.5 装完后的状态呈现（与企业分发如何区分）

| 项 | 企业分发行 | 本机自装行 |
|---|---|---|
| 分区 | 「企业技能」 | 「本机技能」（独立） |
| 徽标 | —— | `本机自装 · 本地上传/SkillHub/GitHub/npm` |
| 详情字段 | 描述/版本/分类/技能条目 | 上述 + **来源地址**、拉取时间、**许可（含证据位置）**、sha256 前 12 位 |
| 开关语义 | 官方 `Switch`（装/卸） | 同形态 `Switch`，但卸载前若目录被企业包引用则**禁用**并说明（§E.3） |
| 「有更新」 | 有（中心版本对比） | **没有**（不做远端版本检查，§A.2/J） |

---

## H. 分期与人日

> 人日口径沿用仓库既有：1 人日 = 1 名熟悉本仓库的工程师有效工作 6 小时，**含实现 + 测试 + 文档**
> （`docs/research/iflytek-skillhub-integration.md:368`，`docs/plan/enterprise-marketplace-phase2.md:334`）。

### H.1 P0 — 最小可用：本地上传 + **skillhub.cn** 一条来源（**15–24 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P0-1 | 客户端 frontmatter 闸门（§D.4 的 D4-1…D4-10）+ manifest 补字段（D3-5/D3-4）+ 大小写冲突（D1-6）+ `maxOutputLength`（D2-4） | 2.5–4 | 无（纯 bundle，可立即并行） |
| P0-2 | 校验与落盘下游接入：自装清单（独立状态文件）+ 跨归属保护（§E.3）+ 幂等 | 2–3 | P0-1 |
| P0-3 | 上传通路：multipart 有界读取路由 + 制品落盘 + 错误码 | 1.5–2.5 | P0-2 |
| P0-4 | 取包内核：`downloadPublicArtifact`（TOFU + 上限 + `.part` 原子改名）+ SSRF/重定向/超时（§F.1） | 2–3 | 无（plugin-distribution，可并行） |
| P0-5 | skillhub.cn 适配器：URL 解析 + 详情/下载 + 扁平包转换 + manifest 合成 + 许可取证 | 2–3 | P0-4（复用其接口） |
| P0-6 | `skill-archive` 抽层（`readSafeZipEntries`）以复用给外层容器 | 0.5–1 | 无 |
| P0-7 | Host 路由：`/local/skills/upload`、`/local/skills/from-url`、`/local/skills/self-installed`（+ 错误码进唯一映射表） | 1–1.5 | P0-2/P0-3/P0-5 |
| P0-8 | UI：两个入口 + 预览/确认弹窗 + 「本机技能」分区 + 进度/失败/重试 | 2–3 | P0-7；**依赖并行改动落地（§H.3）** |
| P0-9 | 联调与验收（真包样本 + 拒收样本 + SSRF 反例 + 跨归属卸载） | 1.5–3 | P0-1…P0-8 |

**P0 合计：15–24 人日**（逐项区间相加：min 2.5+2+1.5+2+2+0.5+1+2+1.5 = 15.0；max 4+3+2.5+3+3+1+1.5+3+3 = 24.0）。
**报数口径**：对外报 **15–24 人日**；其中 **P0-1…P0-7（纯 Host/bundle/plugin-distribution）≈ 13–21 人日可独立开工**，
P0-8（UI）另计并排在 ui 改动收口之后（§H.4）。

> **P0 的「一条来源」为什么选 skillhub.cn**：已有跑通的原型（8/8 导入 + 16 条门禁 + 许可闸门 + 实测字段），
> 且本会话从设备复验了接口可达（§L.1–L.3）。GitHub 次之（需要抽 ZIP 层 + 多技能选择），npm 最难（需要 tar 读取器）。

### H.2 P1 — GitHub + 安装前预览（**7–12 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P1-1 | GitHub 适配器：仓库/tree/Release(zip) 三种地址解析 + codeload zip 取包 + 根前缀剥离 | 2–3 | P0-4/P0-6 |
| P1-2 | 技能定位与多技能策略（`skills/*/SKILL.md` 候选清单 + 子目录强制） | 1–2 | P1-1 |
| P1-3 | 许可取证扩展：技能自带 LICENSE 优先 + 与根许可冲突时按更严处置 | 1–2 | P1-1 |
| P1-4 | 安装前预览（文件树/技能清单/许可）接入弹窗（`preview()` 可选方法） | 1–2 | P1-1；UI 面 |
| P1-5 | GitHub 专项测试（真实仓库夹具 + 多技能反例 + 404/私有仓库/超时） | 2–3 | P1-1…P1-4 |

### H.3 P2 — npm + 扩展接口 + 治理补强（**6–11 人日**）

> 逐项区间相加：min 1.5+2+1+1.5 = 6.0；max 2.5+3+2+3 = 10.5 → 对外取整报 **6–11 人日**。

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P2-1 | npm 适配器：包名/scope/版本 + registry 元数据 + tarball + `package/` 剥离 + 「是不是技能包」判定 | 1.5–2.5 | P0-4 |
| P2-2 | **有界 ustar 读取器**（`gunzipSync({maxOutputLength})` + 头解析 + LongLink；**无新依赖**） | 2–3 | 无 |
| P2-3 | 来源适配器接口冻结与文档化（§C.4）+ 注册表 + 第三个来源接入演示 | 1–2 | P0-5/P1-1/P2-1 |
| P2-4 | 治理补强：开关（`enabled`/`allowUnknownLicense`）落到设置面 + 本机 provenance 查看入口 | 1.5–3 | P0-8 |

### H.4 **并行冲突标注（必读）**

> 本会话开始时，**另有两个代理正在改 `plugin/packages/ui/**` 与 `console/**`**。因此：

| 区域 | 状态 | 对本方案的影响 |
|---|---|---|
| `plugin/packages/ui/**` | ⚠️ **正在被改** | P0-8（UI 入口/弹窗/分区）与 P1-4 的落点**必须等这波改动落地后再定**；任何涉及 `marketplace-entry.tsx` / `skill-market.tsx` / `local-api-decode.ts` 的改动都要串行 |
| `console/**` | ⚠️ **正在被改** | 本方案**完全不需要**改 console（管理员上传 `.dshskill` 的能力服务端已有：`console/src/features/skills/skill-editors.tsx:239` 的 accept 就是 `.dshskill`，上传走 multipart `skill-management-page.tsx:62-65`）。**因此本方案与 console 改动零冲突** |
| `plugin/packages/bundle/src/**` | 可改（本方案的主要落点） | 注意 `skill-install.ts` / `skill-archive.ts` / `skill-route.ts` 是**共享热点**，改动需先确认没有其他代理同时动 |
| `plugin/packages/platform-client/src/local-api.ts` | 可改（加 2 处：错误码映射 + 新路由） | `enterpriseLocalErrorStatus`（`:200`）是全包共享映射表，**加行不改语义** |
| `plugin/packages/plugin-distribution/src/verification.ts` | 可改（**新增**并列函数，不动 `downloadVerifiedArtifact`） | 该文件被受管插件与技能共用，**改既有函数是高风险动作** |
| `server/**` | **不动**（P0/P1 无服务端改动） | 与任何服务端改动零冲突 |

**排期建议**：P0-1…P0-7（纯 Host/bundle/plugin-distribution）**可以立刻开工且与 ui 改动并行**；
P0-8（UI）排在这波 ui 改动**收口之后**。这样 P0 的 Host 部分不被前端串行拖住。

---

## I. 开放问题（≤6 条，每条一句话）

1. **默认是否对全员开放？**（本文建议：默认关闭，管理员开关；需产品/安全拍板）
2. **copyleft 是否一律拒？**（本文建议：默认拒；是否需要「管理员可对特定 copyleft 白名单放行」）
3. **多技能仓库怎么选？**（本文建议：地址必须定位到子目录，否则回候选清单让用户选；是否接受「一次装多个」？）
4. **是否要「安装前预览文件树」？**（本文建议 P1 做；但预览要把整包解到内存/临时区，是否接受这个代价？）
5. **是否需要「离线导入导出」？**（例如把已自装技能导出成一个 `.dshskill` 再在另一台设备导入；本文默认不做）
6. **许可不明的开关由谁开？**（管理员集中下发 vs 用户本机自行决定；涉及「企业是否要为用户的合规风险背书」）

---

## J. 明确不做的事（≥4 条 + 理由）

| # | 不做 | 理由 |
|---|---|---|
| J1 | **不做自动更新检查远端** | 用户粘过的地址不是「订阅关系」；一旦做了自动检查，就必须回答「远端变了要不要自动装」——那等于把我们变成推送通道。本方案只做「用户当次请求」。 |
| J2 | **不做后台定时拉取 / 不做订阅** | 同上；且 `docs/plan/borrow-from-skillhub.md:60-64` 已明确「不要做订阅 + 自动发布」（我们无内容扫描，等于把供应链风险直接推给全员设备）。 |
| J3 | **不执行包内任何脚本**（不 exec、不 import、不落可执行位、不改 PATH） | 实测真实三方技能包里带 30 个 `.py` hooks 与 16 个 `.cjs` scripts（`convert.out`）；「不执行」是我们唯一的防线（§D.6）。 |
| J4 | **不把三方技能混进企业受控目录** | 混排会让人以为「企业审过了」，是信任误导；且受控目录有 assignments/审计语义，自发安装没有（§E）。 |
| J5 | **不走 `ctx.pluginManager.installBundle`，不把 npm 包当插件装** | 那是插件/pnpm/bundle patch 语义（`install-spec.js:21-33`、`index.d.ts:104-118`），与技能落盘完全两条链；混用会让「技能」偷偷获得插件的能力面。 |
| J6 | **不做服务端中转取包** | 服务端代取未审三方内容，会把企业服务器变成上游镜像与信任中介；也会让「谁下载了什么」留在服务端日志里（隐私面放大）。 |
| J7 | **不做 content 安全扫描 / 不自称已扫描** | 我们没这个能力（`EVIDENCE.md:391`）。做了半套比不做更危险（给用户虚假安全感）。 |
| J8 | **不把技能正文写进任何状态文件或日志** | 沿用 `skill-catalog.md` S2.1「不存 SKILL.md 正文」口径；provenance 只存元数据（§F.4）。 |

---

## K. 不确定项（**读不到/不确定的一律如实列出，不编**）

| # | 不确定项 | 现状与影响 |
|---|---|---|
| K1 | **服务器原型 `/opt/work/skillhub-import/` 本会话不可达** | 设备上 `ls /opt/work/skillhub-import/` 返回 `No such file or directory`（`/opt` 本身不存在）。我用的是设备上的**同源镜像** `~/.sshwork/sh-import/`（脚本名高度重合：`fetch_top_n.py`/`license_scan.py`/`convert.py` + `EVIDENCE.md`）。**两者内容是否逐字相同未验证**；`common_auth.py`/`converted/` 这两个任务点名的文件在镜像里未直接出现（镜像里有 `deploy.py`/`verify.py` 等）。若需引用服务器原件，请在服务器侧复核。 |
| K2 | **`git clone` 的稳定性与任务背景陈述不一致** | 任务背景称「clone 在该网络下不稳定」；本会话两次 `git clone --depth 1 https://github.com/anthropics/skills.git` **均成功**（其中一次计时 2 s、17 MB）。可能是时间段/网络差异，也可能是仓库体积差异。**结论仍是「优先用 codeload」，但不要把「clone 一定失败」当作论据写进对外文档。** |
| K3 | **skill.xfyun.cn（iflytek SkillHub）的许可取证口径未知** | 调研文档（`docs/research/iflytek-skillhub-integration.md`）未固化它的许可字段/文件位置结论；本轮不接入，若将来接入需先做一次与 §C.1.5 同规格的取证。 |
| K4 | **skillhub.cn 的接口未冻结** | 社区站、SPA 与 API 分域、字段无官方文档；本会话实测的字段全集（§L.2）随时可能变。适配器必须「解析失败即拒」。 |
| K5 | **「16 条门禁」与「15 条」的口径不一致** | 任务描述与 `EVIDENCE.md:372` 的小标题写「每包 15 条」，但同节表格与 `convert.py` 源码都是 **16** 个 `gate()` 记录点（另有 1 个提前 return 的 `GATE_SOURCE_PRESENT` 不记入 `gates[]`）。本文按 **16** 陈述，并保留这条不一致。 |
| K6 | **npm 的 `dsh.bundle.patch` 判定字段名未验证** | §C.3.2 规则③ 建议用「剥离后若有 `package.json` 且声明插件 bundle 字段即判插件包」，但**我未实测**这类字段在 npm 生态里的实际写法（官方 bundle 的 `package.json` 用 `dsh.bundle.patch`，见 `plugin/packages/bundle/package.json`；第三方是否沿用未验证）。落地前需用真实样本核。 |
| K7 | **DNS rebinding 的彻底防御未验证** | §F.1 的 F1-4 我只给出「建议 + 残余风险」的表述，未在本 Harness/Node 版本上验证「解析后固定 IP 连接」的可行做法。 |
| K8 | **`<dshHome>` 在 Android 员工端的最终取值** | 本机 `DSH_HOME=/data/user/0/com.deepcode.shell/files/home/.dsh`（`resolveEnterpriseDshHome` 的 `$DSH_HOME` 分支，`installation.ts:31-36`）。不同设备/打包形态下是否仍是这个值，未逐一验证。 |
| K9 | **UI 落点依赖并行改动结果** | `plugin/packages/ui/**` 正被其他代理修改（§H.4），因此「按钮放哪、页签几个、`local-api-decode.ts` 如何扩展」在本文只给不可让步的口径，不给具体文件行号。 |

---

## L. 证据索引（本会话实测命令与输出）

### L.1 skillhub.cn 可达性（从 Android 设备实测）

```text
GET https://api.skillhub.cn/api/skills?page=1&pageSize=2&sortBy=score&order=desc
  → http=200  time=0.192s  size=6600   （首行: {"code":0,"data":{"skills":[{"category":"dev-programming",...}})
GET https://skillhub.cn/skills?sortBy=score
  → curl: (28) Connection timed out after 25001 ms   ← 页面 host 不可达（SPA；数据全在 API 域）
```

**结论：通路二的 skillhub.cn 来源必须「本地解析页面 URL 的 path」，**不得**去 fetch 页面 HTML。**

### L.2 skillhub.cn 详情字段（实测，用于 §C.1）

```text
GET https://api.skillhub.cn/api/v1/skills/dev-expert?namespace=indiv-ebandao
  → http=200  time=0.205s  size=3094
  → 顶层键: contentZhAvailable, latestVersion, namespace, owner, securityReports, skill, slug
  → latestVersion 键: changelog, createdAt, version          （version = "2.0.3"）
  → namespace: {canonicalName:"@indiv-ebandao/dev-expert", displayName, handle:"indiv-ebandao", publicSlug}
  → skill 键: authorVerifiedHandle, category, claim_state, claimable, claimed_user_handle, createdAt,
             displayName, ext, githubAuthorLogin, iconUrl, isAuthorVerified, isServiceized, labels,
             last_synced_at, overviewMd, slug, source, sourceUrl, stats, subCategories, summary,
             summary_zh, tags, updatedAt, upstream_owner_login, upstream_url, verified
  → license 相关键: **无**（顶层与 skill 内逐个键确认）
  → securityReports: {keen:{reportUrl,status,statusText}, sanbu:{reportUrl,...}}   ← 第三方扫描，仅可展示
```

### L.3 skillhub.cn 下载流程与包结构（实测，用于 §C.1.3）

```text
GET https://api.skillhub.cn/api/v1/download?slug=dev-expert&namespace=indiv-ebandao
  → HTTP/2 302
    location: https://skillhub-1388575217.cos.accelerate.myqcloud.com/skills/89301/dev-expert/2.0.3.zip
  → 跟随: http=200  bytes=466622  time=0.446s
  → zip: 85 条目；根级 = [SKILL.md, README.md, FAQ.md, _meta.json]；子目录 = hooks/, references/, scripts/
  → 根 SKILL.md 存在（扁平结构确认）
```

### L.4 GitHub（实测，用于 §C.2）

```text
codeload.github.com/anthropics/skills/tar.gz/refs/heads/main   → 200  1.29s  4,017,095 B
codeload.github.com/expressjs/express/tar.gz/refs/tags/v5.2.1  → 200  132,011 B
codeload.github.com/anthropics/skills/tar.gz/8a1541c4…（commit）→ 200  4,021,968 B
codeload.github.com/anthropics/skills/zip/refs/heads/main      → 200  2.14s  4,223,859 B
   zip: 526 条目；根前缀 skills-main/；20 个 SKILL.md；无符号链接条目
raw.githubusercontent.com/anthropics/skills/main/README.md     → 200  0.30s  5,552 B
api.github.com/repos/anthropics/skills                         → 200  0.59s  7,098 B
git clone --depth 1 https://github.com/anthropics/skills.git   → 成功 ×2（其一 2s / 17 MB）
仓库结构（tar/zip 清单）: skills/<name>/SKILL.md + skills/<name>/LICENSE.txt；另有 spec/, template/,
                        .claude-plugin/marketplace.json（→ 多技能仓库，20 个技能）
```

### L.5 npm（实测，用于 §C.3）

```text
GET https://registry.npmjs.org/express/latest       → 200  0.82s
   dist = { shasum(sha1), tarball: "https://registry.npmjs.org/express/-/express-5.2.1.tgz",
            integrity: "sha512-…", fileCount, signatures }
GET https://registry.npmjs.org/-/v1/search?text=claude%20skill → 命中真实技能包（如 antd-claude-skill）
antd-claude-skill@0.1.8 tarball 内容: package/skills/pro-components-page/SKILL.md（1 个）+ references/ templates/
                                     examples/ + package/dist/** + package/bin/cli.js
skilldex-cli@1.5.6    tarball 内容: package/dist/** + package/cli/**  ← **0 个 SKILL.md**（普通包）
```

### L.6 引擎/运行时能力（实测，用于 §D.2 / §C.2）

```text
node -e "zlib.inflateRawSync(zlib.deflateRawSync(Buffer.alloc(1e6)), {maxOutputLength:1000})"
  → 抛 ERR_BUFFER_TOO_LARGE          ← maxOutputLength 生效（skill-archive.ts:239 当前未传）
node -e "zlib.gunzipSync(zlib.gzipSync(Buffer.alloc(2e6)), {maxOutputLength:1000})"
  → 抛 ERR_BUFFER_TOO_LARGE          ← npm 的 .tgz 解压上限可强制
工作区无 `tar` 依赖（plugin/node_modules、各 package.json grep 均无命中）；
dshent-plugin(bundle) 运行时 dependencies 为空（仅 peerDependencies + devDependencies）。
```

### L.7 仓库内引用（逐条对应 §0）

| 主题 | 位置 |
|---|---|
| 安装主干 | `plugin/packages/bundle/src/skill-install.ts:297-432` |
| 下载内核（size+SHA-256+`.part`+原子改名+内容寻址） | `plugin/packages/plugin-distribution/src/verification.ts:151-247` |
| ZIP 严格解析与路径/上限门禁 | `plugin/packages/bundle/src/skill-archive.ts:109-322` |
| 客户端稳定错误码族 | `plugin/packages/bundle/src/skill-errors.ts:18-31` |
| 稳定码→HTTP 唯一映射表 | `plugin/packages/platform-client/src/local-api.ts:200-215` |
| 技能四条 exact 路由 + 本机文件 prefix 分派 | `platform-client/src/local-api.ts:60-70,554-660`；`bundle/src/skill-route.ts:12-31,254-331` |
| multipart 有界读取先例 | `plugin/packages/bundle/src/feedback-route.ts:19-27,377,437-453` |
| 本地 JSON 正文上限 256 KiB | `platform-client/src/local-api.ts:28,227` |
| 服务端验包闸门 | `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/artifact/SkillArtifactInspector.java:41-280` |
| 包契约与「官方无 skills 安装 RPC」 | `docs/compose/spec/skill-catalog.md:32,120-124` |
| 治理：可见性/授权 | `docs/plan/enterprise-marketplace-phase2.md:250-294` |
| 许可法务口径 | `docs/plan/borrow-from-skillhub.md:60-67` |
| 官方发现契约 | `@deepseek-ai/dsh-skill-filesystem/lib/index.js:24,169-175,550-556` |
| 官方插件 install spec（**不适用**于技能） | `@deepseek-ai/dsh-plugin-manager/lib/index.js:21-33`、`lib/types/index.d.ts:104-118` |
| 平台出口的同源+Bearer 约束 | `plugin/packages/platform-client/src/platform-service.ts:695-706` |
| 本机真实落盘 | `/data/user/0/com.deepcode.shell/files/home/.dsh/skills/**`、`.../enterprise/skill-installs/installed.json` |
| 原型脚本与留证（设备镜像） | `/data/user/0/com.deepcode.shell/files/home/.sshwork/sh-import/{convert.py,license_gate.py,preflight_all.py,convert.out,EVIDENCE.md}` |
| 原型脚本与留证（服务器，**本会话不可达**） | `/opt/work/skillhub-import/{common_auth.py,fetch_top_n.py,license_scan.py,converted/,EVIDENCE.md}`（见 §K1） |

---

## M. 一句话结论

**两条通路都只换「字节从哪来」这一步，从 `decodeDshSkillArchive` 起全部复用既有管线；
客户端必须把服务端那套验包规则补成一份不落一条的 fail-closed 闸门（含 frontmatter 与许可），
自发安装与受控分发在**状态文件、界面分区、卸载归属**三处硬隔离，默认关闭、显式开启、不做扫描也绝不执行包内内容。**
