/**
 * [INPUT]: 依赖**用户提供的 NUWAX 平台在线接口实测**——`https://agent.sunoasis.com.cn`，租户 `HaloAgent`/`数智工坊`（`GET /api/tenant/config` 免登录可读），本会话用用户给的账号口令 + 一把 `ak-` API Key 直连，逐端点取读数（方法与强度分级见 §0，全部读数出自 2026-10-06 本会话）；依赖用户提供的 NUWAX 接口文档（平台侧接口清单，**不在本仓**）；依赖本仓 `docs/plan/mcp-marketplace-tab.md`（连接器第五页签的市场面与 §11 本地路由形状）、`docs/plan/connector-architecture.md`（连接器能力模型/分期）、`contracts/enterprise-openapi.yaml`（**我们自己的**中心契约真源）、`plugin/packages/bundle/src/skill-route.ts`（技能取数层与其「Access Token 只存在于平台 Service」纪律）、`plugin/packages/bundle/src/preset-source.ts`（配方取数层）、`plugin/packages/bundle/src/skill-online.ts`（上游三源 fan-out 的既有形状）、`server/owndsh-modules/owndsh-enterprise`（自研企业侧目录代码）。
 * [OUTPUT]: 一份带读数的**对账报告**：NUWAX 作为本仓「企业后台」候选替换源的认证矩阵（API Key 族 vs 会话族，实测四态）、四类广场目录的端点与体量、与我们 11 个后台的逐条判决（可直接换 / 形状不同 / 无对应）、`published.id → targetId` 的 id 契约、真正的下发通道 `eco` 及其未文档化协议、MCP 目录的两个硬缺口（transport 只有 sse、凭据只能走 URL query）、平台缺陷清单与三项安全发现，以及用户已裁决路线「🅰 内容源」的两条候选架构、人日粗估与残余决策。**不改任何产品代码**。
 * [POS]: research 目录的**第三方平台取证层**——与 `cherry-mcp-2026-10-05.md` / `cherry-skill-add-2026-10-05.md` 并列，但来源不同：那两篇读的是**源码**（可给 `文件:行号`），本文读的是**活接口读数**（只能给端点 + 返回码 + 形状）。因此本文所有「没有 X」的强度是「**本会话这些请求下没有**」，不是「平台上没有」——§12 逐条列出未验证项与复核方法。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

# NUWAX 平台作为「企业后台」的替换可行性 · 对账报告

- **取证对象**：NUWAX 平台 `https://agent.sunoasis.com.cn`（租户 `HaloAgent`，`tenantId 1`，站点描述「数智工坊」）
- **取证日期**：2026-10-06（本会话）
- **取证方式**：只读 HTTP 探测（`curl`），两条凭据路径各走一遍：① 账号口令 → 会话 `ticket` cookie；② `ak-` API Key（`Authorization` 头）
- **触发口径**：用户「把企业后台换成这个」→「是插件全部后台都换成 nuwax」→ 裁决 **🅰 内容源**（目录取 NUWAX，安装/落盘仍归我们）
- **结论摘要**：NUWAX 确实是一个**完整的插件后台**，能覆盖我们 11 个后台中的 **6 个**；但它有两处与我们**结构性错位**，和一处**认证族错位**——`/api/v1/` 族（API Key 可达）**只有技能与 MCP**，其余目录（智能体/插件/工作流/模板/知识库/生态下发）**一律要会话**；它的「插件」是 HTTP/代码工具插件（**1 条**），不是我们的 bundle。详见 §5 对账表与 §11 落地方案。

---

## 0. 取证方法与诚实边界

### 0.1 两条凭据路径（都实测跑通）

```text
① 会话族（控制台族）   POST /api/user/passwordLogin {"phone":"…","password":"…"}（字段名实测见 §9 第 6 条）
                       → 0000 · Set-Cookie: ticket=<JWT>; Max-Age=604800; HttpOnly; Secure; SameSite=None
                       → GET /api/user/getLoginInfo 0000（uid 1784006361 · tenantId 1 · nickName「李猛」）
② API Key 族           GET /api/user/api-key/list（会话）→ 明文返回该账号 4 把 accessKey
                       → 带任意一把：Authorization: ak-<key>
```

**对照组（排除假阳性）**：错口令 → `0001 用户不存在或密码错误`；假 key → `4000 无效的 API Key`；无凭据打 `/health`、`/ready` → `success`。⇒ 认证确实在生效，下面的「通」不是没网关。

### 0.2 本报告的事实强度分级（逐段自标注）

| 级 | 含义 | 本文出现在 |
|---|---|---|
| **甲** | 本会话实测读数（端点 + 返回码 + 体量/形状） | §2–§11 绝大多数 |
| **乙** | 用户文档转述（平台接口清单里写的） | §7 的 eco 用途说明、§9 的 scope 名 |
| **丙** | 我方推断（未验，已标） | §5 的「我们缺的一整面」、§11 的架构与**人日粗估** |

★ **本报告有一处强度弱于 `cherry-*` 两篇**：那两篇能对每个结论给 `文件:行号`，本文**没有源码**，且**响应原文未随报告归档**（探测用临时目录已删，见 §0.3）。因此每一条要复核，必须**重新登录取一次读数**（§12 给复核脚本形状）。

### 0.3 秘密处理（如实登记）

- 本报告**不含**任何口令/ticket/accessKey/eco JWT 的值；示例一律写成 `ak-<前缀已隐去>…` 形态。
- 探测期间的落盘文件（cookie jar、响应体、下载的 zip）**已删除**。
- ⚠️ **但口令与那 4 把 Key 已进入会话记录**（`.dsh/.live.ndjson`）——这是真正的残留，处理建议见 §10 末。

---

## 1. 一句话结论

```text
能覆盖   ：智能体(47) · 技能(138 / 市场 734 行) · 工作流(5) · 模板 · 知识库 · 账号 · 用量
能覆盖但空：插件(1) ← 且语义不同（HTTP/代码工具插件，不是 bundle）
无对应   ：我们的「企业配方」(DSH preset) 与「反馈/帮助」
结构性错位：/api/v1 族（Key 可达）只有 skills + mcp；其余目录一律要会话 ⇒ 中心侧必须「持会话」
真下发   ：eco（女娲生态平台）有 草稿→发布→下线→版本比对→导入状态 全生命周期，服务对象明写「halowork 等第三方桌面客户端」
```

---

## 2. 认证矩阵（本轮最值钱的一张表，全实测）

| 通道 | 适用路由族 | 实测 |
|---|---|---|
| 无凭证 | `/health`、`/ready` | `success` |
| **会话 `ticket`** | **非** `/api/v1/` 的控制台族 | `getLoginInfo` `0000` · `/api/space/list` `0000` · `/api/mcp/official/list` `0000` · `/api/mcp/list/2` `0000` · `/api/mcp/deployed/list/2` `0000` · `POST /api/mcp/server/config/export/294` `0000` · 全部 `/api/published/*`、`/api/knowledge/*`、`/api/eco/client/token` |
| 同上打 `/api/v1/**` | — | **`4030 缺少 API Key`**（会话再有效也不行） |
| **API Key `ak-`** | **只有** `/api/v1/**` | `chat/conversation/list`（带 `agentId`）`0000` · `mcp/categories` `0000` · `mcp/list` `0000` · `mcp/{id}` `0000` · `skills` `0000` · `skills/categories` `0000` |
| 同上打非 `/api/v1/` | — | `4030 API 不存在或无权限` |
| key + cookie 同时 | — | 与只带 key 一致，不冲突 |

**授权模型**（实测 + 文档乙级）：

```text
每把 API Key 自带一份 scope 清单（GET /api/user/api-key/list 逐条列出，如 api.v1.mcp.list、api.mcp.server.config.export，带 rpm）
  · scope 不含该 API → 4030「API 不存在或无权限」
  · 完全不带 key 打 /api/v1/** → 4030「缺少 API Key」
  · 该账号 4 把 key 中 3 把 expire: null（永不过期）
★ 一次观察到的历史态：上一轮会话里的那把 `ak-<前缀已隐去>` 后一轮读作 4000 无效的 API Key 且不在清单内 ⇒ 期间被删/轮换过。
```

---

## 3. 四类广场目录（端点 + 实测体量）

| 目录 | 端点 | 族 | 实测 |
|---|---|---|---|
| 智能体 Agent | `POST /api/published/agent/list` | 会话 | **47** |
| 技能 Skill | `POST /api/published/skill/list` | 会话 | **138** |
| 技能（市场视图） | `GET /api/v1/skills?pageNum&pageSize` | **Key** | **total 734** 行；本页 100 行只有 **41 个唯一 name**（未去重） |
| 技能分类 | `GET /api/v1/skills/categories` | **Key** | 12 类 `{code,name}` |
| 工作流 Workflow | `POST /api/published/workflow/list` | 会话 | **5** |
| 插件 Plugin | `POST /api/published/plugin/list` | 会话 | **1**（`targetId 3`「预审知识」） |
| 模板 Template | `POST /api/published/template/list` | 会话 | `5000`（必填字段未文档化，两种参数形状都炸） |
| 分类树 | `GET /api/published/category/list` | 会话 | `0000`，嵌套树 ~6 KB |
| 知识库 | `POST /api/knowledge/config/list` | 会话 | `0000`，真数据（如「审计围串标核查」）；单文档下载 URL 带 `?ak=`（§10 第 2 条） |

**技能包契约（含 `dist.tarball`，这是装包唯一可用口）**

```json
{"engines":{"aionui":">=2.0.0"},
 "hubs":["skills"],
 "contributes":{"skills":["dev-engineer-toolkit"]},
 "dist":{"tarball":"https://agent.sunoasis.com.cn/api/f/local/skill_published/20261006/<hash>.zip",
         "integrity":null}}
```

- tarball 无凭证 → `4010 未登录`；**带 ticket → HTTP 200 `application/zip`，32,858 B，21 个条目**
- 包内是标准技能包：`<name>/SKILL.md`（20.8 KB，YAML front matter `name/description/tags/version: 1.7.5`）+ `assets/template.json` + `references/*.md` + `scripts/*.{sh,py}` + `scripts/lib/*`
- ⚠️ **Key 侧的下载口坏了**：`GET /api/v1/skills/{name}/download`（scope 里明确列着 `api.v1.skills.download`）→ `HTTP 200` 但体是 `{"code":"5000"}` 系统异常 ⇒ **列表用 Key、装包只能走会话**

---

## 4. ★ 语义警告：NUWAX 的「插件」不是我们的「插件」

```text
NUWAX 插件 = 智能体上挂的一个 component，实现形态是 HTTP 或代码
  证据（实测端点）：/api/plugin/http/update (HttpPluginConfigDto) · /api/plugin/code/update
                   (CodePluginConfigDto) · /api/plugin/test · /api/plugin/analysis/output（自动解析 HTTP 出参）
  智能体组成：/api/agent/component/* = skill | plugin | knowledge | variable | table
它【没有】DSH bundle / dsh.bundle.patch / package.json 这种形状。
```

⇒ 「企业插件」页签照直换过去 = **一行数据**。我们那套「内容寻址 + 原子落盘 + 签名/清单」的插件分发**在 NUWAX 侧没有对应物**。真正的体量在**技能(138) + 智能体(47) + 工作流(5)**。

---

## 5. 与我们的 11 个后台逐条对账

| 我们的后台（本仓落点） | NUWAX 对应 | 判决 |
|---|---|---|
| 企业技能 `skill-route` / `skill-install` | `/api/v1/skills`（Key）+ `/api/published/skill/*`（会话） | ✅ **可直接换** |
| 企业插件 `plugin-distribution` | `/api/published/plugin/*`（1 条） | ⚠️ **语义不同 → 换过去等于空页** |
| 企业配方 `preset-source`（DSH preset） | `/api/published/{template,workflow}/*` | ❌ **无对应形状**（template 还不通） |
| 包含内容（bundle 组成） | `/api/agent/component/*` | ⚠️ 形状不同（我们的 bundle 组成 vs 它的 component 表） |
| 资料库 `library/**` | `/api/knowledge/*`（RAG）；另有独立 HaloWiki（`sk-` Key → :8080） | ⚠️ 语义不同（RAG vs 我们的资料库/草稿-发布模型） |
| 连接器 `connector/**`（第五页签） | `/api/mcp/*` + `/api/v1/mcp/*` | ⚠️ **目录可换、安装换不了**（§6） |
| （我们侧没有） | `/api/published/agent/*` | ➕ **我们缺的一整面**（47 条） |
| 账号 `account-origin` | `/api/user/*`、`/api/auth/*` | ✅ |
| 用量 `usage-route` | bill 25 / credit 15 / subscription 17 / pricing 15 | ✅ |
| 反馈 `feedback-route` | 无 | ❌ |
| 帮助 `help-route` | 无 | ❌ |

---

## 6. 连接器（MCP）目录：能列，装不上 —— 两个硬缺口

**目录侧通**（Key 可达）：`GET /api/v1/mcp/list` `total 170`；`categories` 12 类；`{id}` 详情 `0000`。
170 条画像：`type` = `streamable_http` 107 · `component` 53 · `sse` 8 · `npx` 2；`source` 全 `nuwax`、`author` 全 `NUWAX Official`；`category` 52 条 `Proxy`、118 条 `null`。

**缺口 ①：transport 只有 sse，我们只支持 stdio / streamable-http**

```text
POST /api/mcp/server/config/export/294 → {"mcpServers":{"报关制单服务":{"type":"sse","url":"…/api/mcp/sse?ak=…"}}}
同族 255(component)、237(sse) 导出【同样是 sse】，且每个服务一把【各自不同】的密钥
而官方 dsh-mcp-client 只有 stdio / streamable-http（本仓 P0-2 依官方 README:57 / index.d.ts:76 写死）
⇒ 今日 170 条【一条都装不上】。catalog 里的 type 不可信。
```

**缺口 ②：凭据只能走 URL query ⇒ 与我们的「凭据只允许引用、值永不过界」直接冲突**

```text
?ak=…            → HTTP 200 text/event-stream   ✅ 通
Authorization 头 → HTTP 500（不是 401：头形式根本不被认）
无凭证           → HTTP 401
本仓铁律：McpCredentialReference 只有 {name,key}；字面值被 ENT_CONNECTOR_SECRET_INLINE 当场拒。
⇒ 照抄 export 会把活密钥写进 bundle 落盘。要装必须新增「URL 查询参数级凭据插值」。
```

**目录侧另有两条会咬人的事实**：

1. `id` 是**字符串**（`"294"`），文档写 Long；
2. **`pageNum` 被无视**：传 `pageNum=3&pageSize=7` 回声恒 `"page":1`，且 1/2/3 页记录**逐条相同** ⇒ 只能取到前 `pageSize` 条（`pageSize=100` 时唯一 id = 100），**170 条里 70 条取不到**；正确参数名很可能是 `page`（回声字段名）——**未验**（§12）。

---

## 7. 真正的「企业下发」通道：eco（女娲生态平台）

```text
POST /api/eco/client/token   → 0000，拿到 eco 专用 JWT（payload: userId 1784006361 / role Admin /
                                clientId 021f83… / clientSiteUrl …）；文档原话「供 halowork 等第三方桌面客户端调用」
GET  /api/eco/client/version → 0000，data = "app.version"（占位，配置未下发）
GET  /api/eco/client/user/space/list → 4030（要 eco JWT，头名未文档化）
GET  /api/eco/client/import/config   → 0001（同）
POST /api/system/eco/market/client/config/{save/draft, save/publish, update/*, offline, unpublish,
                                            disable, enable, list, detail, delete}
POST … /api/eco/client/space/import/status
```

⇒ 平台**早有**「后台配好 → 客户端拉取 → 版本比对 → 导入状态」的下发机制，服务对象明写是第三方桌面客户端（DSH 客户端正是这类）。

⚠️ **协议未文档化**：eco JWT 的**头名**（`Authorization: Bearer` → `4030`、裸 `Authorization` → 网关 `4010`）、`PageQueryVo<ClientConfigQueryRequest>` 的形状（两种都 `5000`）、`importDataKey` 来源——**要用它，必须先抓一次 halowork 的真实报文**（§12）。

---

## 8. id 契约：`published.id` ≠ 详情 id，详情要 `targetId`

```text
/api/published/plugin/194 → 4000 插件不存在或已下架      /api/published/plugin/3   → 0000「预审知识」
/api/published/skill/4194 → 4000 技能不存在或已下架      /api/published/skill/158  → 0000「dev-engineer-toolkit」
```

⇒ 适配器**必须**做 `published.id → targetId` 这层映射，否则每一行都点不开。

---

## 9. 平台缺陷清单（全部实测，非推断）

| # | 现象 | 读数 |
|---|---|---|
| 1 | `GET /api/v1/skills/list` **不存在** | 被 `/api/v1/skills/{name}` 当 `name="list"` 吃掉 → `A000004 技能不存在`；真列表是 `/api/v1/skills`（**文档 v1 技能三端点里漏的正是它**） |
| 2 | `/api/v1/mcp/server/config/export/{id}` 不存在 | `4030`，尽管 Key 的 scope 里**列着** `api.mcp.server.config.export` ⇒ scope 名与路由族不一致 |
| 3 | `GET /api/skill/list` 必带 `spaceId` | 不带 → `4000 Invalid spaceId`；文档只写 `queryDto` |
| 4 | `POST /api/mcp/deployed/list`（`Valid McpPageQueryDto`） | `{}` 与 `{spaceId,pageNum,pageSize}` 均 `5000` ⇒ 必填字段未文档化 |
| 5 | 免登录白名单里的陈旧路由 | `/api/agent/recommend/chatbox-config`、`/api/system/client-config`、`/api/system/features` → `4040 No static resource`（无凭证时 401） |
| 6 | `POST /api/user/passwordLogin` 字段名 | 实际是 `phone`，校验文案却报 `emailOrPhone must be non-null`；该字段**同收邮箱** |
| 7 | `/api/mcp/categories`（无 v1） | `5000`（无此路由）；分类只在 `/api/v1/` 下 |
| 8 | 文档「本机可直连 6443」 | 本机 `ss -ltn` **无任何监听** ⇒ 那句只适用服务器那台 |

---

## 10. 安全发现（实测）

1. **`GET /api/user/api-key/list` 明文返回完整 accessKey**（4 把，未打码），其中 3 把 `expire: null`（永不过期），一把还带全局 `api.skills` 与模型权限。
2. **明文 `?ak=` 出现在三处**：MCP 导出配置的 `url`、知识库文档的 `docUrl`、技能包 `dist.tarball` 同族路径 ⇒ 配置/链接一转发即等于交付凭据，且会落进网关访问日志与 `Referer`。
3. **MCP 里每个服务一把独立密钥**：导出即分发。密钥轮换/吊销的粒度因此是「每个服务」，运营上要有人管。

### 残留与处置建议（§0.3 的收口）

```text
已做：探测期落盘文件（cookie jar / 响应体 / 下载的 zip / 请求头留存）全部删除；未调 /api/user/logout（会把用户浏览器一并踢下线）
残留：口令、ticket、4 把 Key 已进入本机会话记录（.dsh/.live.ndjson）——【这是真正的残留】
建议：① 改口令；② 到 NUWAX「API Key」页删掉/重建那 4 把（尤其永不过期且带 MCP/模型权限的那把）
```

---

## 11. 🅰 路线（用户已裁决：内容源）的落地方案

### 11.1 两条候选架构

| | **甲（推荐）中心侧适配** | 乙 宿主侧直取 |
|---|---|---|
| 做法 | 我们的企业中心（`server/owndsh-modules/owndsh-enterprise`）新增 `NuwaxCatalogClient`，把 NUWAX 四个广场目录映射成**我们既有 DTO**，对外契约不变 | `bundle` 的 `skill-route` / `preset-source` 直接打 NUWAX |
| 客户端/契约/UI | **零改动**（`contracts/enterprise-openapi.yaml` 与 `/enterprise/api/v1/local/*` 全不动） | 要动路由与契约，且每个员工的凭据落到每台客户端 |
| 与本仓纪律 | 一致（`skill-route.ts:4` 逐字：取数层「既不接触凭据也不重算可见性」） | **冲突**：凭据与可见性判定搬进客户端 |
| 代价 | 中心必须持 NUWAX 凭据（见 11.2） | 中心零改动，但把授权面搞坏 |

### 11.2 甲路线的**唯一**硬前置：中心持什么 NUWAX 凭据

```text
甲1 服务账号会话（中心持一个 NUWAX 账号，定时登录/续期）
    可行、今天就能做；代价：把【用户级可见性】拍平成【服务账号可见性】
甲2 请 NUWAX 给这把 Key 扩 scope（把广场目录也做成 /api/v1 族）
    最干净、与现有 Key 机制同构；代价：需要 NUWAX 侧改动（一句话的需求，见 §12）
甲3 员工各自绑定 NUWAX 账号（中心代持每人的 ticket）
    保留真实可见性；代价最大：凭据托管 + 续期 + 吊销 + 与我们的账号体系对对碰
```

### 11.3 「内容源」的最小可用切法（建议顺序）

```text
第 1 刀（不依赖任何决策）适配器纯函数层：NUWAX 列表载荷 → 我方 DTO
       （照 skill-online.ts 的 fan-out 形状：可注入 fetch 端口、部分成功、稳定码）
第 2 刀 取数接线：按 11.2 选定凭据形态，接到中心既有 service 接口后面
第 3 刀 逐页签放开：技能（最大、最完整） → 智能体（我们缺的一整面） → 连接器目录 → 插件/配方（空页签需产品裁决）
```

### 11.4 人日（**丙级：我方粗估**，非既有文档的数）

| 项 | 人日 |
|---|---|
| 适配器纯函数层 + 夹具 + 单测（技能/智能体两类） | 1.5–2.5 |
| 甲1 会话托管（登录 + 续期 + 失效重登 + 审计） | 1–2 |
| 取数接线 + 契约对齐（若 DTO 不改，仅 service 内部换源） | 1.5–3 |
| 连接器目录（含 §6 两个缺口的**规避**：只做「列出 + 详情」，安装继续走「等 NUWAX 开 streamable_http」） | 1–2 |
| 端到端联调 + 反向锁 | 1–2 |
| **合计** | **≈ 6–11 人日** |

（不含 §6 缺口①②的解决——那两条都在 NUWAX 侧或需要新设计。）

---

## 12. 未验证 / 不确定项（逐条给「为什么」+「怎么复核」）

1. **`pageNum` 的正确参数名**（疑似 `page`）。为什么不确定：本会话只观察到「`pageNum` 被无视、回声字段叫 `page`」，没试过 `page`。怎么验：`GET /api/v1/mcp/list?page=2&pageSize=5` 看 id 是否与第 1 页不同。**它决定**：170 条能否取全（今天最多取 100）。
2. **`POST /api/published/template/list` 的必填字段**。怎么验：抓一次控制台真实报文，或反编译该 DTO。
3. **eco 的三个未文档化点**（头名 / `PageQueryVo` 形状 / `importDataKey`）。怎么验：抓一次 halowork 客户端报文。
4. **Key 的 scope 能否扩到广场目录**（甲2 是否可行）。怎么验：问 NUWAX 是否提供 `/api/v1/published/**` 或等效 scope；或看平台「API Key 管理」页的可选 scope 列表。
5. **本机没有 JDK / Docker**（历史事实）：`server/` 侧任何改动**在本机无法编译、无法跑 Testcontainers** ⇒ 甲路线的代码今天只能「写完 + 结构自检」，真门禁要在带 JDK+Docker 的机器上跑。这是排期必须知道的约束。
6. **我方自研目录代码（`ConnectorCatalogService` / `V44`）是撤还是并存**——**用户未裁决**。撤可解掉 `server-check` 的红；并存则两条源同时存在（需要可见性优先级规则，否则会出现「同一条连接器两个 id」）。
7. **「内容源」是否包含我们自己的「企业配方」(DSH preset)**。NUWAX 无同族形状 ⇒ 若包含，等于要新设计一层映射（本文不预设）。

---

## 13. 复核脚本（形状，供下一位取证者照跑）

```bash
B=https://agent.sunoasis.com.cn
T=$(mktemp -d)                       # 用完必须删（§10 末）
# ① 会话
curl -sS -c $T/cj -H 'content-type: application/json' \
  -d '{"phone":"…","password":"…"}' $B/api/user/passwordLogin
# ② Key 族目录（需要一把带对应 scope 的 ak-）
curl -sS -H "authorization: ak-<key>" "$B/api/v1/mcp/list?page=2&pageSize=5"
curl -sS -H "authorization: ak-<key>" "$B/api/v1/skills?pageNum=1&pageSize=5"
# ③ 会话族目录
curl -sS -b $T/cj -H 'content-type: application/json' -d '{}' $B/api/published/skill/list
# ④ 装包（会话族，返回 zip）
curl -sS -b $T/cj -o $T/s.zip -w '%{http_code} %{size_download}\n' "<dist.tarball>"
rm -rf $T
```

---

## 14. 落盘登记（本文涉及/待改的文档）

| 文件 | 改什么 | 本次状态 |
|---|---|---|
| `docs/research/nuwax-plugin-backend-2026-10-06.md` | **本文（新建）** | ✅ 已落 |
| `docs/research/CLAUDE.md` | 成员清单加本文一行（照既有密度与格式） | ✅ 已落 |
| `docs/plan/mcp-marketplace-tab.md` | **只登记**：§11 的「企业目录」实现从自研中心目录**候选**换成 NUWAX 适配器（本文为该判断的证据面）；本地路由形状不变 | ✅ 已落（§11 末尾一段） |
| `docs/plan/connector-architecture.md` | **只登记**：§8.3 第 1 条那个「本会话没真机跑过」的 spike，其**外部依赖**已由本文 §6 的实测取代（transport/凭据两条缺口的实测读数） | ⏳ **未改**（本文只记建议；那份文档的 §8.3 未逐条复核，不盲改） |

**本文不改任何源文件。**
