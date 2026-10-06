<!--
[INPUT]: 依赖官方规范真源 `@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/`（SKILL.md、
         references/mcp-bundle.md、templates/mcp/*）与 `@deepseek-ai/dsh-mcp-client`（README.md、
         lib/types/index.d.ts）的逐字原文；依赖 docs/notes/connector-vision.md:69-78 的七条合规清单与
         docs/plan/connector-architecture.md §2.4 / §3 / §8.3 的既有口径；以及本会话对本仓库 4 份
         cordis.patch.yml 与 3 个真机 profile 的实测。
[OUTPUT]: 把 DSH 官方 MCP 接入规范固化为**企业侧生成器必须逐条满足的合规清单**：真实坐标基准、两条硬边界
           （bundle 自己的 patch ✅ / profile 的 patch ❌）、交付形态（配置型 bundle）、字段级契约、凭据
           唯一写法、明确不支持面、装完验收动作、本仓合规现状实测，以及写作过程中更正的四处错误与既有
           文档待修正三处。
[POS]: docs/plan 下的**合规基线**文档（只固化规范与结论，**不实现、不新增依赖、不改任何源文件**）。
       它是连接器方案的**实现约束层**；能力元数据（capabilityId / effects / reversibility / blastRadius
       等草案字段）与分期人日仍以 docs/plan/connector-architecture.md §3 / §7 为准，本文不重复。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md。
-->

# MCP 接入的官方合规基线

> **本文只固化「官方规范原文 + 我们的逐条结论」，不含实现、不新增依赖、不改任何源文件。**
> 凡引官方规范给 `文件:行号`；凡引本仓给 `路径:行号`；凡实测给命令与读数。**没验的一律进 §9，不编。**

---

## 0. 一句话结论

DSH 的 MCP 规范只有**一个入口**：**「配置型 bundle」+ 官方 `install_bundle`**。

```text
企业侧负责   生成一个「只有两个文件」的 bundle 目录 —— package.json + cordis.patch.yml
官方安装面负责 把它写进 profile 的 package.json / cordis.patch.yml，并让 mcp-client 加载
★ 我们【绝不】自己写 profile 的那两个文件（这是官方明令，也是本文的核心边界）
```

⇒ 企业的「MCP 服务器来源」（后台下发 / 用户自定义 / 协议一键装）**共享同一套落盘动作**：
**生成配置型 bundle → 直调 `install_bundle`**。区别只在**谁来填那份 config**。

---

## 1. 规范原文在哪（真实坐标基准）

本页所有官方引用都以这个基目录为基准：

```text
SKILL_DIR = <dsh>/node_modules/@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/
MCP_DIR   = <dsh>/node_modules/@deepseek-ai/dsh-mcp-client/
```

| 文件 | 作用 | 关键行 |
|---|---|---|
| `SKILL_DIR/SKILL.md` | 插件/ bundle 的总纪律 | `:8` 正规安装路径 · **`:10` 明令禁止清单** · `:18` 启用 shipped 插件 · `:46-47` 模板清单 |
| `SKILL_DIR/references/mcp-bundle.md` | **MCP 专题规范全文（仅 5 行，984 字节）** | `:3` 交付形态与字段 · `:5` 验收动作 + stdio 字段 + 凭据 + 修同一个 |
| `SKILL_DIR/templates/mcp/package.json` | 配置型 bundle 的 manifest 模板 | 全文 7 行 |
| `SKILL_DIR/templates/mcp/cordis.patch.yml` | 配置型 bundle 的 patch 模板 | 全文 8 行 |
| `SKILL_DIR/references/verification.md` | **验收纪律（视觉类请求的边界）** | `:3` 不得起独立浏览器/改 HOME/找 token/自制渲染器 |
| `MCP_DIR/README.md` | 字段表 + 行为契约 | `:55-67` 字段与默认值 · `:71` 失败语义 · `:75-81` 命名与代际 · `:93` 原地重载 · `:107-110` 五条设计不变量 · `:138` 环境清洗 · `:209-214` 不支持面 |
| `MCP_DIR/lib/types/index.d.ts` | **穷尽 schema 的唯一可用来源** | `:4-5` 一实例一服务器 · `:9-11` HMR · `:26-51` StdioConfig · `:52-74` StreamableHttpConfig · `:76-80` 联合与输入可选性 · `:89` apply |

### ★ 三个坐标坑（本次实际踩过，写下来省下一次）

```text
① skill 不在 <dsh>/skills/ 下，而在 <dsh>/node_modules/@deepseek-ai/dsh-agent-preset/skills/ 下
② mcp-bundle.md 在 references/ 子目录，不在 skill 根
③ README:69 与 README:153 都指向 ../../../docs/config-catalog.md 并称它是「every accepted field 的穷尽来源」
   —— 该文件【未随包发布】（本会话 find 全树零命中）
   ⇒ 本机可用的穷尽来源只有 MCP_DIR/lib/types/index.d.ts 的 Config schema（:76-80）
```

---

## 2. ★ 两条硬边界（本文最重要的一节）

`SKILL_DIR/SKILL.md:10` 逐字：

> Do not write the profile's `package.json` or `cordis.patch.yml`, create packages under `$DSH_HOME`, or run pnpm in the profile directory: `install_bundle` performs those steps, and each hand-made write outside the workspace needs its own approval.

| 写什么 | 合规 | 依据 |
|---|---|---|
| **bundle 自己的** `cordis.patch.yml` | ✅ **必须** | `templates/mcp/cordis.patch.yml` 就是它；`SKILL.md:47` 把它列为「MCP bundle starting point」 |
| **bundle 自己的** `package.json`（带 `dsh.bundle.patch`） | ✅ **必须** | `templates/mcp/package.json:6` |
| **profile 的** `cordis.patch.yml` | ❌ **禁止** | `SKILL.md:10` |
| **profile 的** `package.json` | ❌ **禁止** | `SKILL.md:10` |
| 在 `$DSH_HOME` 下造包 | ❌ **禁止** | `SKILL.md:10` |
| 在 profile 目录里跑 pnpm | ❌ **禁止** | `SKILL.md:10` |

**判据（一句话，可机械检查）**：路径是否落在 **`<DSH_HOME>/profiles/<name>/`** 之下。
**在 bundle 目录里写 patch = 合规；在 profile 目录里写 patch = 违规。**

> ★ 本仓已有自觉先例：`plugin/packages/llm-gateway/src/registration.ts:85` 记「进程内 bearer，走 `settings.update`
> 会把它们持久化进**用户 profile 的 `cordis.patch.yml`**，因此这里用……」—— 项目早已识别这个坑并绕开。

---

## 3. 交付形态：配置型 bundle

`SKILL_DIR/references/mcp-bundle.md:3` 逐字：

> A configuration-only bundle's manifest needs a unique name, version, and `dsh.bundle.patch`, but **no Host/Client entry files**.

**官方模板逐字（可直接抄）**：

```jsonc
// templates/mcp/package.json （全文 7 行）
{
  "name": "@local/demo-mcp",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

```yaml
# templates/mcp/cordis.patch.yml （全文 8 行）
- insert:
    - id: demo-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: demo
        transport: streamable-http
        url: http://127.0.0.1:3000/mcp
        failOnStartupError: true
```

**安装动作**（`SKILL.md:8` 逐字）：

> use ordinary workspace files to author a bundle, then `plugin_manager` with `action: install_bundle` and **the absolute package directory as `target`** … Changes affect every session in that profile and **survive restart**.

⇒ 企业侧的「直调服务面」＝ 在我们的插件里直接调 `plugin_manager` 的 `install_bundle`，
**target 给绝对包目录**；不要用 shell 命令复刻安装步骤（`references/host-plugin.md:58`，经
`connector-architecture.md:204-205` 转引）。

**三条配套纪律**：

| 纪律 | 原文 |
|---|---|
| 失败要「**修同一个** bundle」 | `mcp-bundle.md:5`：Repair the same bundle on failure **instead of creating duplicates** |
| 官方安装结果要如实上报 | 区分 `failed` / `overridden` / `restart-required`（`references/host-plugin.md:60`，经 `connector-architecture.md:206` 转引）⇒ 不得把「未生效」说成「已连上」 |
| 一条条目 = 一个服务器 | `index.d.ts:4-5`：Each plugin instance connects to one MCP server; **load multiple instances** in `cordis.yml` for multiple servers |

> ★ **同形状先例已在本仓**：`plugin/packages/bundle/src/preset/bundle.ts:3-4` 的
> `renderPresetBundle` / `synthesizePresetBundle` 就是「把一份配方变成官方唯一安装面认识的最小 bundle
> （恰好两个文件：`package.json` 带 `dsh.bundle.patch` + `cordis.patch.yml`）」，落点
> `<dshHome>/enterprise/preset-bundles/<配方 id>/<内容摘要>/`（`:668` / `:712-713`），
> 自述「**本段只合成、不安装、不联网**」（`:4`）。MCP 生成器应复用这台机器的**纪律与形状**。

---

## 4. 字段级契约（生成器必须逐条满足）

### 4.1 必填与传输二选一

| 字段 | 约束 | 出处 |
|---|---|---|
| `transport` | **required**，只有 `stdio` 或 `streamable-http`（无 sse） | `README:57`；`index.d.ts:76` |
| `serverName` | **required**，`[A-Za-z0-9_-]{1,32}`，**同一 registration scope 内唯一** | `README:58`；`index.d.ts:31-34` / `:57-61` |
| `command` / `args` / `env` / `cwd` | stdio | `README:59` |
| `url` / `headers` | streamable-http | `README:60` |
| `toolCallTimeoutMs` | 默认 `60000` | `README:61` |
| `maxInstructionBytes` | 默认 `32768`；**超限直接拒绝连接** | `README:62` |
| `failOnStartupError` | 默认 `false` | `README:63` |
| `reconnect.{enabled,initialDelayMs,maxDelayMs,maxAttempts}` | `true` / `500` / `30000` / `10` | `README:64-67` |

★ **输入层的可选性**（`index.d.ts:77-79`，容易被类型定义误导）：
`args` / `env` / `cwd` / `headers` / `toolCallTimeoutMs` / `failOnStartupError` 在 **`Config` 输出类型里是必填**，
但在 **`ConfigInput` 里被 `Omit` 后 `Partial` 回去** ⇒ patch 里可省。最小写法：

```text
stdio              → serverName + transport + command
streamable-http    → serverName + transport + url
```

### 4.2 `failOnStartupError` 的企业取义

```text
false（默认）  连不上 ⇒ harness 照常启动，但该服务器【零工具】，只落一条错误日志（README:71）
true           直接【拒绝该行激活】
★ 且 README:71 明确：app-boot 的启动策略【仍然允许】一条可选 MCP 条目失败而不中断 harness
  ⇒ 取 true 不会让整机起不来，只会让这一行显式失败
```

**建议企业下发取 `true`**（官方模板也是 `true`）：宁可该行显式失败，也不要「看起来配好了但一个工具都没出现」。

### 4.3 工具命名是**不可逆契约**（企业侧必须负责稳定命名）

```text
模型看到的名字 = mcp__<serverName>__<rawName>                    README:75
它是一个纯函数 (serverName, rawName)，有损归一化会追加 12-hex SHA-256  README:108
★ serverName 是【本地命名空间】，绝不是远端 serverInfo.name      README:107
  （远端名不可信、跨部署不唯一、升级会变，都不得静默改名）
线的名字只有 raw name：tools/call 只收 raw name，
公开名【从不】发给服务器、也从不反解回 raw name                  README:109
```

⇒ **企业侧后果（写进规格）**：`serverName` 由**我们**定并冻结。
**改 serverName = 改工具名 = 作废会话历史与权限规则**（`README:75` / `:108`；`README:224` 称公开名算法是
「a v1 contract pinned by tests」）。

### 4.4 一代要么全上、要么全不上

```text
一个服务器重复列同一工具名  ⇒ 工具表整体被判非法，【保留上一代】    README:79
注册与已注册名冲突          ⇒ 【整代回滚】，绝不出现部分工具集      README:81 / :110
一次 fetch 失败             ⇒ 保留上一代                          README:110
```

⇒ **不要把「部分可用」当成可接受的中间态写进验收**。

### 4.5 `serverName` 冲突与作用域

```text
两条条目用同一 serverName ⇒ 【后加载者失败】并给明确错误            README:78
同一 scope 内唯一；独立 Agent scope 可复用同名（工具与传输互相隔离）index.d.ts:32 / README:128
```

### 4.6 stdio 的环境清洗（会静默吃掉你的 key）

`README:138` 逐字：子进程环境从 `scrubbedParentEnv()` 起算 ——
**环境变量名匹配 `/KEY|PASSWORD|SECRET|TOKEN/i` 的、以及所有 `DSH_*`，一律被丢弃**；
配置里的 `env` 再**覆盖其上**，所以显式覆盖能活下来。

⇒ **企业不要把 key 放进程环境里指望它自动传进去**；必须显式写进该条目的 `env`（且用 §4.7 的引用写法）。

### 4.7 凭据：唯一允许的形态是 Loader `!!js` 引用

```yaml
# stdio（README:43）
env:
  GITHUB_TOKEN: !!js process.env.GITHUB_TOKEN

# streamable-http（README:52）
headers:
  Authorization: !!js '`Bearer ${process.env.MCP_TOKEN}`'
```

`mcp-bundle.md:5` 逐字：**Ambient credentials are scrubbed; reference existing credentials with Loader `!!js`
rather than copying secrets into conversation text.**

⇒ 企业下发的凭据模型与 `connector-architecture.md` 的「引用式保管」一致：
**配置里只出现键名，值只住在凭据面**；观测面只说「设没设 / 从哪来 / 能不能改」，**永不说值**。

### 4.8 明确不支持（不要设计进去）

| 能力 | 结论 | 出处 |
|---|---|---|
| MCP **prompt templates** | 不支持 | `README:209` |
| **resource subscriptions** | 不支持 | `README:209` |
| **task-based execution extension** | 调用时直接抛 | `README:214` |
| 独立的连接 / 发现超时 | **没有**，继承 MCP SDK 的 60s 默认 | `README:210` |
| `sse` 传输 | **无此枚举** | `README:57`；`index.d.ts:76` |
| audio / embedded resource 富结果 | 只留诊断文本 | `README:212` |

★ 但**资源读取本身是可用的**：shipped profiles 提供共享资源服务（`dsh-mcp-resources`），`README:209`；
包组见 `cordis-composition-reference/references/packages.md:298-303`（`dsh-mcp-client` 有 Config、
`dsh-mcp-resources` 无 Config）；另有三条**实验性 MCP 使用方**同为有 Config 的包
（`dsh-experimental-browser-use-chrome-devtools-mcp` / `-playwright-mcp` / `dsh-experimental-computer-use-cua-driver-mcp`，
同文件 `:184-189`）。

---

## 5. 装完怎么验（官方给的验收动作）

```text
① 调一个刚出现的工具：mcp__<serverName>__<tool>          mcp-bundle.md:5（示例 mcp__demo__ping）
② 用 Config.listConfigs 取该行【完整 client schema】自检  mcp-bundle.md:5
③ 三种安装后果（failed / overridden / restart-required）如实上报  host-plugin.md:60
```

★ **验收纪律（官方对视觉类请求的明令，`references/verification.md:3`）**：
不要另起独立浏览器、不要改 `HOME`、不要翻个人浏览器档、不要去找认证 token、不要为「拿不到浏览器控制」
而去找 rasterizer / 解 SVG / 模拟 React-DOM / 自制渲染器；**mock 页面的截图不算验证**。

⇒ **落进验收清单的口径**：MCP 连接的验收必须是「**真的调通一次工具**」，
不是「界面看起来有了」。这一条同时也是对「我看不到你那块屏」的正确处置方式。

---

## 6. 本仓合规现状（实测）

| 制品 | 形态判定 | 合规 | 证据 |
|---|---|---|---|
| `apps/desktop/packages/jingyun-dsh/` | `package.json:64-67` 有 `dsh.bundle.patch` ⇒ **它是 bundle**；其 `cordis.patch.yml:4`（`mobile-mcp`）与 `:16`（`desktop-control-mcp`）两条 `@deepseek-ai/dsh-mcp-client`，均 stdio | ✅ **合规**（写的是 **bundle 自己的** patch，正是 `templates/mcp` 的形状） | 见 §7 第 2 条（我曾误判为违规） |
| 同上 · `failOnStartupError` | 两条都**未写** ⇒ 取默认 `false` | ⚠️ **建议补 `true`** | `templates/mcp/cordis.patch.yml:8` |
| 同上 · `desktop-control-mcp` 的 args | `command: node` + `args: ['-e', <内联脚本>]`，脚本 `:22-59` 按 `process.platform` 分派：`win32` → `uvx.exe`、`darwin` → `npx @steipete/peekaboo mcp`、**其余平台 ⇒ `console.error` + `process.exit(1)`**（`:50-53`） | ⚠️ 两件事同时成立：① 它是本文 §2「stdio = 让本机跑什么进程」风险的**实体**，且已在仓内；② **它在本平台（Linux/Android）必然失败**，而该行未写 `failOnStartupError` ⇒ 正是 §4.2 那个「harness 照常启动、该服务器**零工具**、只落一条日志」的**活样本** | —— |
| `plugin/packages/bundle/src/preset/bundle.ts` | 合成 **bundle 自己的**两文件 | ✅ 合规，且是 §3 的同形状先例 | `:3-4` / `:712-713` |
| 全仓 `cordis.patch.yml` | `find` 命中 **4 份**，全在**包目录**内（`jingyun-dsh` / `jingyun-enterprise` / `bundle` / `client-plugin`） | ✅ **无一份是手写的 profile patch** | 实测 |
| 真机 profile（`DSH_HOME/profiles/{web,headless,headless-bad}`） | `grep -c 'dsh-mcp-client'` = **0 / 0 / 0**（patch 分别 257 / 169 / 9 行） | — | 实测 ⇒ **运行态零 MCP 服务器** |

---

## 7. ★ 本文写作过程中更正的四处（都是我犯过的，留作陷阱清单）

四处里有**三处**源于同一个混淆：**「bundle 自己的 patch」与「profile 的 patch」是两件东西**。

1. **我说 `connector-architecture.md` 有「写 profile patch」的口径冲突、要改指 `install_bundle`** ⇒ **假**。
   该文 `:35`（唯一合规交付形态）、`:204-205`（`install_bundle` + 官方原话）、`:242-243`（安装面唯一）、
   §2.4 第 1 行与第 4 行（「MCP 出站生成官方连接配置：**配置型 bundle** 插 `@deepseek-ai/dsh-mcp-client`，
   字段 `serverName`/`transport`/`url`/`failOnStartupError`」，出处 `references/mcp-bundle.md:3`）
   **早已写对**。`docs/notes/connector-vision.md:69-78` 第 4 条同样写对。
   ⇒ **本仓没有任何口径需要改；错的是我的提案，不是这两份文档。**
2. **我判定 `jingyun-dsh` 的 patch「流程层不合规（手写 `cordis.patch.yml`）」** ⇒ **假**。
   它有 `dsh.bundle.patch`（`package.json:64-67`），那条 patch 是 **bundle 自己的**。
   `SKILL.md:10` 禁的是 **profile 的**那一份。它**合规**，唯一可挑的是缺 `failOnStartupError`。
3. **我把官方 skill 的路径写成 `<dsh>/skills/cordis-plugin-development/`** ⇒ **假**。
   真实在 `<dsh>/node_modules/@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/`，
   且 `mcp-bundle.md` 在 **`references/`** 子目录（见 §1 三个坑）。
4. **我把 `renderPresetBundle` / `synthesizePresetBundle` 说成「合成 profile patch 条目」** ⇒ **假**。
   它合成的是 **bundle 自己的** `package.json` + `cordis.patch.yml`，落点在
   `<dshHome>/enterprise/preset-bundles/…`，自述「只合成、不安装、不联网」（`bundle.ts:3-4`）。

---

## 8. 既有文档待修正三处（本文只登记，**不改它们**）

1. **`docs/plan/connector-architecture.md` 自相矛盾**：`:600` 与 `:695` 说「客户端侧发起装 bundle
   是否与会话内 `plugin_manager` 同一条面 —— **未验证**」，`:648` 说「**已验证**」。
   **正确取值：已验证**（证据 `docs/notes/preset-bundle-spike.md` §3/§4 与
   `docs/notes/preset-approval-spike.md` §2/§4/§5，经 `:648` 转引）。⇒ 应删 `:600` 与 `:695` 的该说法。
2. **同一处剩一个真问题没被回答**：`:696` 自己列的「**装完 Host 是否需重启才能生效**」——
   `:648` 的验证**没有**覆盖它。⇒ 应把「唯一未验证项」**收窄成这一条**（见 §9 第 1 条）。
3. **P0 人日不一致**：`:587` 与 §0 写 **11–18 人日**，`:599` 明细合 **12–20**
   （`:599` 自带逐项相加证据）⇒ 以明细为准，改 `:587` 与 §0。

---

## 9. 不确定项（本文没验的，**不编**）

1. **装上一条 mcp-client 配置后，工具是否无需重启即进 `ctx.tools`** —— **仍未真机验，但官方已给判据**。

   ★ **官方原文（`references/host-plugin.md:60`）把两种情况分开判**：
   ```text
   Installing a new bundle can activate through HMR; replacing an installed package
   requires restart to load a fresh JavaScript module generation.
   Do not infer updated browser code from an unchanged slot id.
   ```
   ```text
   · 新装 bundle          ⇒ 可经 HMR 激活（【不需要】重启）—— 企业下发的 MCP 配置型 bundle 正属此类
   · 替换已装包（换 JS 模块代） ⇒ 【需要】重启
   ```

   四条例证（前三条是 mcp-client 自己的原地重载语义，第四条是官方对安装面的判据）：
   ```text
   README:93         Editing the configuration entry reloads the server connection in place
   index.d.ts:9-11   HMR hot-swaps by disposing the old instance and creating a new one
   SKILL.md:8        Changes affect every session in that profile and survive restart
   host-plugin.md:60 Installing a new bundle can activate through HMR
   ```

   **仍需真机确证的只剩一点**：经 `install_bundle` 写盘后，mcp-client 是否**当场**完成首次连接与工具发现
   （即「HMR 已生效」与「工具已可用」是否同一时刻）。

   ★ 且必须区分两层：**服务端 mcp-client 走 HMR**；**客户端 bundle（浏览器 UI）不同** ——
   `host-plugin.md:60` 末句正是「Do not infer updated browser code from an unchanged slot id」，
   与本项目「引擎启动时把客户端包读进内存」的既有实证一致。

   ### ★ 追加取证（2026-10-06，第五条例证：**官方安装面自己的判据**，比上面四条更硬）

   上面四条是"mcp-client 语义"与"官方对 bundle 的判据"，**都还没回答"我们这次安装会被判成哪一种"**。
   第五条把这个缺口补上了 —— 官方 `dsh-plugin-manager` 的代码里，`application` 的取值**就是**由 HMR 是否存在决定的：

   ```text
   dsh-plugin-manager/lib/index.js:2042
     application: this.ownerContext.get("hmr") !== void 0 ? "applied" : "restart-required"
   dsh-plugin-manager/lib/index.js:1801   （enable 分支）
     if (Object.hasOwn(before, name)) return "restart-required";
     if (options?.enabled !== false) result.warnings = await this.reload();
   dsh-plugin-manager/lib/index.js  reload()
     if (this.ownerContext.get("hmr") === void 0) return [];
     return reconcileProfilePatches(this.ownerContext.root, readProfilePatches("dsh", this.profile), "dsh", requiredIds);
   dsh-plugin-manager/README.md:67
     A live profile recomposes, so the granted plugin mounts in the running session
     and the result reports `applied`
   ```

   ⇒ 三条结论（都可复核）：

   ```text
   ① `applied` 的**定义**就是"现场有 HMR"，不是别的什么；
   ② **新装**（包名不在 manifest 里）才走 `reload()` ⇒ `reconcileProfilePatches` 对**运行中的** Loader 树现场和解
      ⇒ 行当场挂上、**不需要重启**；本企业下发的 MCP 配置型 bundle 属于"新装"这一类；
   ③ **改配置**（同一包名已在 manifest 里）走 `:1801` 的 `return "restart-required"`
      ⇒ **换端点要重启** —— 与 ① 相反的那一半，同样由官方裁定。
   ```

   **本机档位实测**（`dsh --profile web --dump-config`）：第 10 行即 `- id: hmr / name: '@deepseek-ai/dsh-hmr'`
   ⇒ 本机 web profile 有 HMR ⇒ 安装面会回 `applied` ⇒ 走上面 ② 那一支。

   ### ★★ 第六条例证（2026-10-06，同日追加）：**时间窗也不存在 —— `applied` 返回时工具已经注册**

   上一条把「行已挂上」判定了，剩下的"差一次握手"这一说法**也被官方代码推翻**：

   ```text
   dsh-app-boot/lib/index.js:3468  reconcileProfilePatches（:1801 的新装分支调的 reload 就是它）
     await entry.update({ config: { ...includeConfig, patches: prepared } });
     await ctx.loader.await();                       // 等整棵 Loader 树就绪
     const failures = await inactiveEntries(ctx);
     const introduced = failures.filter(…);          // inactiveEntries 把 FIBER_PENDING 也算失败
     if (introduced.length > 0) throw new Error(activationDiagnostic(binName, introduced));
   dsh-mcp-client/lib/types/index.d.ts:89
     apply(ctx, config): Promise<void>   —— "Connect one MCP server and publish its initial
                                            tool generation before activation"
   dsh-mcp-client/lib/index.js:153
     disposers.set(publicName, ctx.tools.register(definition));   ← 注册就发生在这段 activation 里
   ```

   ⇒ 因为「新引入的行只要 pending/failed 就抛」，而 mcp-client 的 activation **定义上**包含"发布初始工具代"，
   **`applied` 只会在工具已注册之后才被返回**。反过来，连不上服务器时 `reconcileProfilePatches` 抛错 →
   manager 的 `change()` 捕获 → 回 `application: 'failed'`（这正是本仓把 `failOnStartupError` 恒设 `true` 的价值：
   宁可该行显式失败，也不要"看起来配好了但零工具"）。

   ★ 两条实作后果（必须写进实现）：① **安装调用会阻塞到握手结束**（stdio 起进程 / http 建连 + 首次 `tools/list`），
   服务器卡住则安装调用也卡住，由连接超时兜底；② 上面这条**依赖 `failOnStartupError: true`**，改它要复核这条结论。

   **仍未做的**是独立复核与耗时测量（临时 profile + 独立进程，装一条后立即查 `ctx.tools` 再重启复看）——
   它是复核、不是结论的前提。`plugin/packages/bundle/src/connector/install.ts` 的 `ConnectorToolAvailability`
   因此登记为 `proven-by-contract`（读数到手后改 `measured`）。
2. **企业后台「MCP 服务器清单」的形状** —— 未定；它取决于**要内置哪些三方**。
3. **腾讯文档有没有开放 API / 官方 MCP 端点** —— **从未取证**
   （`connector-architecture.md` §5 表的 12 行里没有这一行）。
4. **飞书 / 钉钉 / 企业微信 有没有官方 MCP 端点** —— §5 只按「开放 API 是否存在」判定，
   **未断言 MCP 端点**（飞书为 `?` 双向待核实）。这一条直接决定工程量是「生成官方配置（零自研）」
   还是「自研 HTTP/OpenAPI 适配器」。
5. **本文未运行任何测试或联调**。§6 的结论仅来自 `find` / `grep` / `cat` 实测与规范原文阅读；
   **没有起过 MCP 服务器、没有装过任何 bundle**。
