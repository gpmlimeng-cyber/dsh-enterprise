# 真机 spike：「企业配方 → 最小 DSH bundle → 客户端启用」是否走得通

> **性质**：一次性真机验证（spike），不是实现。**这是配方功能 P0 的开工门槛**（`docs/plan/enterprise-presets.md` §M 第 1 条 + 决策记录 D1 的「前置条件」）。
> **时间**：2026-10-02 16:22–16:31（Host 进程启动 ≈16:22，**全程未重启**）
> **环境**：Android 本机 DSH `0.2.0-rc.2`（`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/package.json:4`），profile `web`
> **验证物落点**（仓库外，一次性）：`/data/user/0/com.deepcode.shell/files/home/.sshwork/ent-preset-spike/`
> **口径来源**：`docs/plan/enterprise-presets.md`（§A2/§M/D1）、`docs/research/agent-preset-best-practices.md`（§4.1）、官方技能 `cordis-plugin-development` / `editing-cordis-compositions` / `cordis-composition-reference` 的 SKILL.md

---

## 0. 一句话结论

**走得通。** 真机上，一份**恰好两个文件**的 bundle（`package.json` + `cordis.patch.yml`）装进 profile 后：

1. **不需要重启 Host** —— 运行中的 Loader 几百毫秒内就把新 preset 挂上并激活（`fiberPhase: active`），picker 的 roster 随之 +1；
2. **显示名与分组完全由官方客户端现有逻辑决定**：`config.name` 就是卡片标题，分组只可能是「内置」或「自定义」，**我们装的 preset 一定落「自定义」**；
3. **卸载后 roster 立刻 -1**（同样是热的），profile 三个受管文件**逐字节回到基线**；
4. 唯一残留是 pnpm 的 `link:` 符号链接与 `.plugin-manager/logs/` 审计日志目录。

**但有三个必须先处理的前置**（§9）：授权语义要在**比 Full access 更窄**的档位下才算真实、安装面必须由我们决定「走谁的进程」、以及**已存在会话不会看到它**。

---

## 1. 最小 bundle 的完整内容（贴全）

### 1.1 `package.json`（297 B）

```json
{
  "name": "dsh-ent-preset-spike",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "ent-spike: 一次性真机验证用的最小 DSH bundle（两个文件，仅声明一条 agent preset）",
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

### 1.2 `cordis.patch.yml`（967 B）

```yaml
# ent-spike: one `@deepseek-ai/dsh-agent-preset` declaration.
# 写法逐字对照官方 @deepseek-ai/dsh-web-app/presets/minimal.patch.yml（同样是
# `- insert:` 一条 preset 行 + Loader row id 约定 `preset-<id>`）。
# 与出厂文件的两点差别（刻意为验证而设，非发明）：① 出厂四份都没写
# `name`/`description`（验证 #2 要看显示名从哪来）；② order 取 50，排在官方
# standard(1)/ptc(2)/minimal(3)/cordis(4) 之后。
- insert:
    - id: preset-ent-spike
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: ent-spike
        name: Ent Spike
        description: 企业配方 spike 验证用最小预设（persona 一处）。
        order: 50
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: You are a helpful software engineer assistant.
              complete: true
              includeRuntimeContext: false
```

**这两个文件之外一个字节都没有**（`ls -la` 实测：目录只有这两项）。`dsh.bundle.patch` 用**字符串**形式合法——源码校验 `bundlePatchFiles()`：`typeof bundle.patch === "string" ? [bundle.patch] : bundle.patch`，非字符串也非字符串数组才抛 `dsh.bundle.patch must be a file path or a list of file paths`（`@deepseek-ai/dsh-app-boot/lib/index.js`）。

### 1.3 第二份（验证 #6 用）：真实配方 `dsh-ent-preset-recipe`

同一目录下的 `bundle-recipe/`（`package.json` 同上换名 + `cordis.patch.yml`）——**把"企业配方想表达的东西"逐项落成官方 row**：

```yaml
- insert:
    - id: preset-ent-recipe
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: ent-recipe
        name: 企业配方验证模式
        description: 验证「企业配方 → 官方 preset」字段映射的一份真实组合。
        order: 60
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: You are the enterprise onboarding assistant.
              suffix: Your working directory is {{cwd}}.
          - id: agent-instructions
            name: '@deepseek-ai/dsh-agent-instructions'
            config:
              maxBytes: 65536
          - id: tool-fs
            name: '@deepseek-ai/dsh-tool-fs'
          - id: tool-fs-search
            name: '@deepseek-ai/dsh-tool-fs-search'
            config:
              sampleOverCapGlobResults: false
          - id: tool-bash
            name: '@deepseek-ai/dsh-tool-bash'
            disabled: !!js process.platform === 'win32'
          - id: tool-web
            name: '@deepseek-ai/dsh-tool-web'
            config:
              fetch: true
              searchTimeoutMs: 60000
          - id: tool-todo
            name: '@deepseek-ai/dsh-tool-todo'
            config:
              allowParallelInProgress: true
          - id: tool-ask-user
            name: '@deepseek-ai/dsh-tool-ask-user'
          - id: skill-filesystem
            name: '@deepseek-ai/dsh-skill-filesystem'
          - id: tool-skill
            name: '@deepseek-ai/dsh-tool-skill'
          - id: present
            name: '@deepseek-ai/dsh-tool-present'
          - id: planning
            name: cordis:group
            group: true
            isolate:
              planMode: true
            config:
              - id: plan-mode
                name: '@deepseek-ai/dsh-plan-mode'
```

**实测结果**：`include:preset-ent-recipe` → `enabled: true`, `fiberPhase: "active"`（`plugin_manager list_plugins` offset 209）。`!!js` 条件、`cordis:group` + `isolate`、嵌套 `config` **全部通过**。

---

## 2. 官方出厂 preset 对照片段（出处 + 原文）

**出处**：`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml`（**出厂四份之一**，另三份 `ptc` / `minimal` / `cordis` 同形）

原文（`:1-19`，逐字）：

```yaml
# Agent preset standard: one `@deepseek-ai/dsh-agent-preset` declaration inserted
# after the web patch. Edits saved from the Web editor override this row's
# `config.plugins` by id from the profile patch.
- insert:
    - id: preset-standard
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: standard
        order: 1
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              suffix: Your working directory is {{cwd}}.
              prefix: You are a coding agent powered by the {{model}} model.
          - id: agent-instructions
            name: '@deepseek-ai/dsh-agent-instructions'
            config:
              maxBytes: 65536
```

原文（`:42-49`，**group + isolate 的方言写法**）：

```yaml
          - id: planning
            name: cordis:group
            group: true
            isolate:
              planMode: true
            config:
              - id: plan-mode
                name: '@deepseek-ai/dsh-plan-mode'
```

原文（`:22`，**`!!js` 条件**）：`disabled: !!js process.platform === 'win32'`

**★三处必须记住的出厂事实**（对产品决策直接相关）：

| 事实 | 出处 |
|---|---|
| **出厂四份 preset 全都没写 `name`/`description`** —— 只有 `id`/`order`/`plugins` | `standard.patch.yml:7-9`（`ptc`/`minimal`/`cordis` 同） |
| Loader row id 一律 `preset-<id>` | 四份文件 `:5` / `:8` … 与本机 composed 树一致 |
| `dsh.bundle.patch` 可以是**数组**（出厂 web-app 是数组，串起 4 份 preset + 主 patch）：`"patch": ["./cordis.patch.yml", "./presets/standard.patch.yml", …]` | `@deepseek-ai/dsh-web-app/package.json` 的 `dsh.bundle` |

---

## 3. 七条验证结果（逐条：结论 + 证据）

### ① 装完 Host 是否需要重启才认识这个 preset？——**不需要**

| 证据 | 内容 |
|---|---|
| 进程未重启 | Host PID **`28327`**，cmdline `…/dsh/lib/bin.js web --port 3081 --no-open`；spike 结束时**仍是同一个 PID**（`/proc/28327/fd` 仍指向 `/data/data/com.deepcode.shell/files/engine.log`）。启动时点由 `engine.log` 最后一次写入 **16:22:19** 锚定（该文件此后**再无新增**——热重载不打印任何日志）；安装发生在 **16:26**。PID 未变即未重启 |
| 实时 Loader 目录 | `cordis_inspect_query(host, Config, listConfigs, {name:'@deepseek-ai/dsh-agent-preset'})` → 安装前 4 条；安装后 **5 条**，含 `{"id":"include:preset-ent-spike","patchId":"preset-ent-spike","status":"schema"}` |
| 实时行状态 | `plugin_manager list_plugins(offset=204,limit=7)` → 末行 `{"entryId":"include:preset-ent-spike","moduleName":"@deepseek-ai/dsh-agent-preset","enabled":true,"fiberPhase":"active","patchId":"preset-ent-spike"}`（`total: 211`） |
| 卸载的**反向**对照 | 卸载后同一查询 → 回到 **4 条**，roster 里 `preset-ent-spike` 消失（同样没重启） |

**机制（已读源码，非猜测）**：本 profile 挂着 `@deepseek-ai/dsh-hmr`，其 `ProfileHmr[Service.init]` 在 `profile.patchPath` + `<home>/cordis.patch.yml` + `profile.dir/package.json` 三处装 watcher，回调 `refresh()` → `readProfilePatches()` → `reconcileProfilePatches()`（`@deepseek-ai/dsh-hmr/lib/index.js:371-377`；`@deepseek-ai/dsh-app-boot/lib/index.js` 的 `reconcileProfilePatches` 走 `entry.update({config:{...includeConfig, patches: prepared}})` 后 `ctx.loader.await()`）。
→ 所以**只要 bundle 进了 `dsh.profile.bundles`，它的 patch 立刻被重算并挂上**。

> ⚠️ **与已有口径冲突，必须记一笔**：profile `package.json` 写着 `"patchReload": "startup"`，`cordis.patch.yml` 里的中文注释也写「patch 改动依旧要重启（见 perf-patch-reload-N1）」；而**实测 bundle/preset 行是热的**。`ProfileHmr` 是一条独立于 `patchReload` 的热路径。P0 实现时**不要**依赖"必须重启"的设计假设，也不要依赖"一定不重启"——按"**热生效 + 新会话才可见**"两条同时写文案。

### ② 官方 preset picker 会不会列出它？以什么显示名与分组？——**会列出，显示名取 `config.name`，分组固定落「自定义」**

roster 入册（证据同 ①：`fiberPhase: active` ⇒ 声明的 `register()` 成功 ⇒ `agentPresets/list` 会返回它）。
**渲染规则是纯客户端硬编码**，出处 `@deepseek-ai/dsh-client-ui-agent-preset/lib/client.js`：

```js
const BUILT_IN_PRESET_KEYS = { standard:{…}, ptc:{…}, minimal:{…}, cordis:{…} };
function isBuiltInPreset(preset) {
  return preset.name === void 0 && BUILT_IN_PRESET_KEYS[preset.id] !== void 0;
}
function presetDisplayText(preset, t) {
  const keys = isBuiltInPreset(preset) ? BUILT_IN_PRESET_KEYS[preset.id] : void 0;
  if (keys !== void 0) return { name: t(keys.name), description: t(keys.description) };
  return { name: preset.name ?? preset.id,
           ...(preset.description === void 0 ? {} : { description: preset.description }) };
}
```

并且分组渲染只有两个 `section`：`[true,false].map(builtIn => … t(builtIn ? "builtInGroup" : "customGroup") …)`，locale 表 zh：`builtInGroup:"内置"`、`customGroup:"自定义"`（en：`Built-in` / `Custom`）。

**由此可以确定性推出**：

| 问题 | 答案 | 依据 |
|---|---|---|
| 会出现在 picker 吗 | **会**（新会话/设置页的「Agent 预设」区块；设置页分组里「自定义」组永远保留 Creator 入口，故这一组一定可见） | roster 入册 + `dsh-client-ui-agent-preset/README.md:28` |
| 显示名 | **`config.name`**（我们写「Ent Spike」/「企业配方验证模式」就显示这两个字）。**若照出厂那样不写 `name`，则显示原始 id `ent-spike`** —— 员工会看到一串英文 id | `presetDisplayText` 的 `preset.name ?? preset.id` |
| 描述 | `config.description`；不写则显示 `noDescription`（「暂无描述。」） | 同上 |
| 分组 | **「自定义」**，且**无法**进「内置」：`isBuiltInPreset` 要求 `name === undefined` **且** id 命中那 4 个硬编码键。我们的 id 永远不命中 ⇒ 恒为自定义 | `isBuiltInPreset` |
| 能不能本地化显示名 | **不能按语言分别取名**。`config.name` 是一个字面量字符串，没有 locale 表。zh 用户会看到「企业配方验证模式」，en 用户看到同一个中文串 | 同上（客户端只有 4 个内置 id 有 zh/en 对照） |
| 内置四份的名字（对照） | 标准模式 / PTC 模式 / 极简模式 / 创造模式（en：Standard mode / PTC mode / Minimal mode / Creator mode） | zh locale 表 |

> **产品含义**：员工**只看到 `config.name` 这一个字符串**，看不到我们的商城、来源、签名。这是 §G 卡片设计与 §M-6 的直接答案，也说明「配方名」必须在控制台发布时就被当成**面向员工的门面**来管（长度、可读性、去重、禁用技术词）。

### ③ 是不是只有空会话能切？已存在会话是否确实钉住旧修订？——**是，两处硬门**

**Host 侧（唯一切换入口）** `@deepseek-ai/dsh-agent-preset-registry/lib/index.js` 的 `select()`：

```js
async select(agent, agentPreset) {
  const boundary = this.owner.sessionProjections.stateOf(agent.session, "turnBoundary");
  if (boundary !== void 0 && (boundary.openTurnStartSeq !== null || boundary.lastTurn > 0))
    throw new RemoteError("agent-preset/locked", "This session has already started",
      { sessionId: agent.id, agentPreset });
  const preset = await this.recompose(agent.ctx, agentPreset);
  agent.session.append("agent-preset/selected", { agentPreset: preset.id });
  return preset.id;
}
```

- 错误码 `agent-preset/locked`、原文 **`This session has already started`**；
- 客户端把它显示成 toast：zh **`无法切换到「{name}」：{reason}`**（`switchRefused`）。

**客户端侧（先手过滤）** `dsh-client-ui-agent-preset/lib/client.js` 的 `apply()`：

```js
if (!session.blank || presetOf(session) === staged) { this.clearStage(); return; }
```

即：**当前会话不是空白会话时，客户端根本不发 `select`**，这次选择只会变成「下次新任务的默认」（`stage()` 语），并在会话头显示 `headerHint`（zh：**「本任务的 Agent 预设，在任务开始时确定」**）。

**钉住旧修订**：官方 README 原文 「A live Agent's composition stays stable; new Agents can use an updated definition」（`@deepseek-ai/dsh-agent-preset/README.md:78`）、「existing Agents retain the composition they already use」（`@deepseek-ai/dsh-agent-preset-registry/README.md:4`）；`editing-cordis-compositions/SKILL.md`「Verify」段亦同。
**本会话的旁证**：本次 spike 在**一个已存在会话内**装/卸了两个 preset，本会话可用工具集与组合**没有任何变化**（`plugin_manager` 等仍按本会话启动时的 preset 提供），而 roster 已经变了。

### ④ 「需要完全访问权限或批准」在实际界面/CLI 输出里长什么样？——**两套原文，一套在 Agent 工具面，一套在 Web 界面**

#### (a) Agent 工具面 `plugin_manager`（逐句原文，出处：`@deepseek-ai/dsh-plugin-manager/lib/types/tools.js`）

```js
const policy = ctx.sandboxPolicy.resolve(...);
await approveEscalation({
  requestedMode: 'danger-full-access',
  effectiveMode: policy.mode,
  subject: 'plugin management operation',
  justification: `plugin_manager ${JSON.stringify(args)}. Profile changes persist across sessions; installed Host code runs outside the workspace sandbox.`,
}, { approver: ctx.get('approval'), agent: exec.agent, callId: exec.callId, toolName: 'plugin_manager', signal: exec.signal });
```

工具描述里的原句（模型看到的）：

> `Every action requires danger-full-access permission or approval for this call. Approval does not change the session permission mode. Changes affect every session in this profile. … Live profiles apply changes immediately; startup profiles require restart. … Package installation can execute allowed build scripts.`

弹出/拒绝的实际文案（`@deepseek-ai/dsh-sandbox/lib/index.js` 的 `approveEscalation()`，**逐字**）：

```js
// 授权弹层正文（双语，Host 直接给 UI 两个串）
displayReason: {
  en: `Allow this operation with ${mode} permissions: ${justification}`,
  zh: `允许本次操作使用 ${mode} 权限：${justification}`
}
// 四种结果
case "rejected":  throw new Error(`the user rejected escalating this ${subject} to "${mode}"; it stays denied, so stop and explain instead of working around it`);
case "cancelled": throw new Error(`approval for escalating to "${mode}" was cancelled`);
case "unavailable": throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval channel is available`);
// 无 approval 服务时：
throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval service is composed`);
```

**★最关键的一条（决定我们弹层要不要做）**：

```js
async function approveEscalation(request, approval) {
  if (mode === effectiveMode) return effectiveMode;   // 档位已够 → 直接放行，不弹任何东西
  …
}
```

→ **在完全访问（`danger-full-access`）档位下，`plugin_manager` 的每次调用都不弹授权**。本次 spike 全程如此：我的会话档位是 `danger-full-access`，`list_bundles` / `install_bundle` / `remove_bundle` 都零弹层直接返回。
→ 只有**比 Full access 更窄**的档位（`workspace-write` / `read-only`）才进入 `approval.approver.request(...)`。**我们的「一键启用授权弹层」若只在 Full access 下测，永远测不到它。**

#### (b) Web 界面面（`dsh-client-ui-plugin-manager`，`lib/client.js` locale 表）

`添加插件` 弹层里的信任声明（**中英原文**）：

| 语言 | 原文 |
|---|---|
| en | `Install only plugins you trust: they run with your permissions and can damage DeepSeek Harness or leak your data.` |
| zh | `请确认插件来源可信。插件在本机以你的权限运行，来源不明的插件可能损坏 DeepSeek Harness，或读取和泄露你的数据。` |

同弹层的其它原文：

| key | en | zh |
|---|---|---|
| `addPlugin` / `installTitle` | `Add plugin` | `添加插件` |
| `installDescription` | `Enter the plugin's package name, GitHub repository address, or local directory path.` | `输入插件的包名、GitHub 仓库地址或本地目录路径。` |
| `installUpgradeNotice` | `Installed plugins do not update automatically yet. To upgrade a plugin, uninstall it and install the new version. Later releases will keep improving the upgrade experience.` | `插件安装后，暂不支持自动更新。若需升级，请先卸载再安装新版，后续版本会持续改善升级体验。` |
| `restartNotice` | `The change takes effect at the next start` | **`更改将在下次启动生效`** |
| `uninstall` | `Uninstall` | `卸载` |
| `installEnableNow`（装完按钮） | `Enable now` | `立即启用` |
| `switchRefused`（agent-preset 面） | `Could not switch to {name}: {reason}` | `无法切换到「{name}」：{reason}` |

官方技能里的英文说法（`editing-cordis-compositions/SKILL.md`「Create a preset」/「Verify」）：

> `Installing a bundle executes plugin code in the Host process, so it requires Full access or approval.`

> **产品含义**：**Web 界面面没有"权限弹层"，只有一句信任声明 + 一个可选的 registry 选择**；真正的"完全访问权限"弹层只存在于 **Agent 工具面**（而我们的一键启用是 UI 按钮，不是 Agent 工具）。所以 D1 说的「首次启用弹一次授权」**必须由我们自己造**，官方不会替我们弹——但我们**可以照着上面这两句原文的语气与信息量来写**（「以你的权限运行 / 可能损坏 / 可能泄露数据」+ 逐项列出装什么）。

### ⑤ 能否干净卸载？卸载后 preset 是否消失、profile 是否回基线、有无残留？——**能，但有两处残留（各面相同）**

| 项 | face A（CLI `dsh plugin --profile web remove`） | face B（`plugin_manager remove_bundle`） |
|---|---|---|
| roster | 实时回到 4 条，`preset-ent-spike` 消失（无重启） | 实时回到 4 条，`preset-ent-recipe` 消失（无重启） |
| `package.json` | **与基线逐字节相同**（sha256 `0579a6e1…02c07`） | **逐字节相同**（同 sha256） |
| `pnpm-lock.yaml` | **逐字节相同**（`dae87abf…6c182`） | 同上 |
| `cordis.patch.yml` | **逐字节相同**（`d33079f3…95440`，未被写过，mtime 仍是 07:55） | 同上 |
| `compatibility.json`（版本豁免） | 未变（无新增豁免） | 未变 |
| **残留 1：`node_modules` 符号链接** | `node_modules/dsh-ent-preset-spike` → 指向测试目录的 `link:` 符号链接**留在盘上**（`pnpm remove` 只改了 package.json/lock + 不再选中） | **完全相同**：`node_modules/dsh-ent-preset-recipe` 同样留下 |
| **残留 2：审计日志目录** | `.plugin-manager/logs/operation-*` **每次操作新增一个目录**（150 → 151） | 同样（150/151 → 152），内含 `pnpm.log` |
| 其它 | 无注册表、无缓存、无 `.npmrc` 改动；`pnpm-workspace.yaml` 未变 | 同 |

**残留 1 的具体性质**：不是坏链接（目标目录仍在时链接有效），也**不参与组合**（`dsh.profile.bundles` 已移除，`reconcile` 只按 `package.json` 的 directDependencies 判定），但它是**盘上真实存在的一行**：`node_modules` 条目数 123 → 124（基线 123）。
我在核查后**手工删除**了这两个链接（删除前用 `readlink -f` 逐条确认目标落在 `…/home/.sshwork/ent-preset-spike/bundle-{min,recipe}` 内，命中才删），随后 `node_modules` 回到 **123 = 基线**。
→ **P0 要点**：「停用/卸载」若承诺"不残留"，我们不能只调官方 remove；要自己补一步「清 `node_modules/<pkg>` 的 link 残壳」。另外**不要**替用户删 `.plugin-manager/logs/`（那是官方的操作审计）。

### ⑥ 用一个真实配方内容再试一次，确认字段映射怎么写——**通过（见 §5 映射表）**

`dsh-ent-preset-recipe`（**走 face B** 安装）：
- 结果 JSON：`{"stage":"enable","target":"dsh-ent-preset-recipe","enabled":true,"changed":true,"application":"applied","registries":[null],"bundle":"dsh-ent-preset-recipe","warnings":[],"packageResult":{"exitCode":0,"logPath":"…/profiles/web/.plugin-manager/logs/operation-qdeQwu/pnpm.log"}}`
- 实时 roster：`include:preset-ent-recipe` `status:"schema"`；
- 实时行：`{"entryId":"include:preset-ent-recipe","enabled":true,"fiberPhase":"active","patchId":"preset-ent-recipe"}`（`total: 211`）
- 覆盖到的方言：`config` 嵌套、`!!js` 条件禁用、`cordis:group` + `group:true` + `isolate`、非 ASCII（中文 `name`/`description`）——**全部生效且未报错**。
- **模型/温度/沙箱/权限不在此 preset 内**（写不下也不该写），与 §A2.2 结论一致。

### ⑦ （汇总）字段映射表 → 见 §5；回滚 → 见 §6

---

## 4. A / B 两条安装面：是不是同一条面？——**"引擎同源，入口与权限语义不同"**

**B 面到底存不存在**：存在，而且就在本 profile 的默认装配里。composed 树含 `- id: ui-plugin-manager, name: '@deepseek-ai/dsh-client-ui-plugin-manager'`（`dsh --profile web --dump-config` 第 588 行）与 Host 服务 `- id: plugin-manager, name: '@deepseek-ai/dsh-plugin-manager'`（第 5-6 行）。
`@deepseek-ai/dsh-client-ui-plugin-manager/README.md` 原文：侧栏 **Plugins** 页「install a bundle after the Host has read what the spec names, watch pnpm's output, stop a run, and enable what it added」；**Add plugin** 接受「a package name with an optional version, a Git address, a tarball, or **an absolute local path**」。
→ **所以 B 面确实能从 Web 客户端发起本地路径安装**（这就是我们「一键启用」要复用的那一面）。

| 维度 | **A. CLI 面** `dsh plugin --profile web add <path>` | **B. Host 服务面**（Web 侧栏「Plugins → 添加插件」/ Agent 工具 `plugin_manager`） |
|---|---|---|
| 实现入口 | `lib/bin.js` → `runPlugin(profile,args,…)` → `runPluginCommand()` → `runProfilePnpm(…, {execution:'cli'})` | `PluginManagerService.installBundle()` → `runPnpm()` → `runProfilePnpm(…, {execution:'service', activateNewBundles:false})` |
| **安装引擎** | **同一个** `runProfilePnpm`（同一把 `package.json` 文件锁、同一个 profile cwd、同一份 pnpm） | **同一个** |
| 选中 bundle 的方式 | **由 `reconcile()` 顺手追加**到 `dsh.profile.bundles`（`operations.js` 里 `bundles.push(name)`） | **由服务显式走 enable 阶段**（结果里的 `stage:"enable"`）；`activateNewBundles:false` |
| 权限门 | **没有 bundle 专属授权**；能不能装取决于「跑这条命令的 shell 处在什么档位」 | **Web 面：无权限弹层**，只有信任声明 + registry 选择；**Agent 工具面：每次调用过 `approveEscalation('danger-full-access')`**（Full access 档位下静默通过） |
| 进度/可取消 | 只有同步 stdout（无流式事件、无 cancel） | `plugin-manager/install-log` + `plugin-manager/install-state` 流式；`cancelInstall(requestId)`；`waitForInstall()` 可恢复丢失的响应 |
| 返回结构 | pnpm 原始输出 + 退出码；失败时打印 `dsh: plugin command failed; diagnostics: <logPath>` | 结构化 JSON：`stage/application/packageResult/registries/bundle/warnings` + `logPath`；registry 回退计划、GitHub 预检、pendingBuilds 批准 |
| 事务性 | 失败回滚 package.json+lock（`installBundle` 侧还有 node_modules 重装） | 同 + `pendingBuilds` 批准后重试、registry 逐个回退、恢复后 `application:cancelled` |
| 观测 | `dsh` CLI 的 stderr | `.plugin-manager/logs/operation-*/pnpm.log` |

**结论**：**不是"两个不同的面"，而是"同一个安装引擎的两个入口"**（同 `runProfilePnpm`、同 profile 文件、同 `dsh.profile.bundles` 语义），差别集中在**权限语义、进度/取消、与"谁来决定选中"**。
对我们的 P0：**复用引擎没有悬念；要自己决定的只有"从谁的进程发起 + 谁来要授权 + 失败怎么呈现"**。

> **实测到的性能/网络差异**（同为本地路径 spec，供排期参考）：face A 1.5 s（完全走本地 lockfile 复用，离线）；face B **71.5 s**，因为 Host 侧 pnpm 在这一轮对 `@napi-rs/canvas` 发起了 `registry.npmjs.org` 请求并撞上 `ERR_SOCKET_TIMEOUT` 重试（`WARN GET https://registry.npmjs.org/@napi-rs%2Fcanvas error (ERR_SOCKET_TIMEOUT). Will retry in 10 seconds`），`registries:[null]`（本地路径不需要 registry）。**一键启用的"零等待"文案不能拿 A 面的 1.5 s 做承诺。**

---

## 5. 字段映射表：我们的配方 → 官方 preset（可用最小映射）

### 5.1 最小映射（三步，够用）

```text
① Loader 行：id = "preset-" + 我们的配方 id（规范化成 lowercase/digits/hyphens）
             name = '@deepseek-ai/dsh-agent-preset'
② config.id   = 我们的配方 id（lowercase/digits/hyphens，必需）
   config.name = 要给员工看的显示名（可选字段，但**不写就等于让员工看 id**，见 §3②）
   config.description = 一句话（可选）
   config.order = 排序位（可选；出厂 1/2/3/4，我们建议从 50 起）
   config.plugins = 我们 `agent.cordis.yml` 的 entry list **逐字搬过来**（必需）
③ 把上面包成恰好两个文件：package.json(dsh.bundle.patch) + cordis.patch.yml
```

### 5.2 逐项映射（企业配方想表达的东西 → 官方落点）

| # | 我们配方里的东西 | 官方 preset 里的落点 | 写法（最小示例） | 出处 / 实测 |
|---|---|---|---|---|
| 1 | 配方 id | `config.id` | `id: ent-recipe` | `editing-cordis-compositions/SKILL.md:14`；实测通过 |
| 2 | **员工看到的配方名** | `config.name` | `name: 企业配方验证模式` | 客户端 `presetDisplayText`：`preset.name ?? preset.id`（§3②）。**出厂四份都没写这个字段** |
| 3 | 配方说明 | `config.description` | `description: …` | 同上；不写 → 「暂无描述。」 |
| 4 | picker 排序 | `config.order` | `order: 60` | 出厂 1/2/3/4（`standard/ptc/minimal/cordis`） |
| 5 | 整份组合（我们包里的 `agent.cordis.yml`） | `config.plugins` | 逐字搬 entry list | `editing-cordis-compositions/SKILL.md:16-52`；本项目实测 11 row + 1 group 全通过 |
| 6 | 起始提示词 / 人设 | `plugins[].id: persona` 的 `config.prefix`/`suffix`/`complete` | `prefix: You are …` / `suffix: Your working directory is {{cwd}}.` | `standard.patch.yml:11-15`（`{{model}}`/`{{cwd}}` 由 agent 自己的 route 与 workspace 解析） |
| 7 | 规则文件（CLAUDE.md/AGENTS.md） | `agent-instructions`（`config.maxBytes`） | `maxBytes: 65536` | `standard.patch.yml:16-19` |
| 8 | 技能集合 | `skill-filesystem`（`customSkillDirs`）+ `tool-skill` | 需要自带技能目录时用 `!!js` 解析包内路径 | `standard.patch.yml:34-37`；`presets/cordis.patch.yml:143-149` |
| 9 | 工具白名单 | **少挂 = 白名单**；逐条开关用 `disabled` | 只挂要用的 row | `minimal.patch.yml` 语义；`cordis-composition-reference/SKILL.md` |
| 10 | 平台条件（Android/桌面差异） | `disabled: !!js …` | `disabled: !!js process.platform === 'win32'` | `standard.patch.yml:22`；实测通过 |
| 11 | 需要隔离服务的工具组 | `name: cordis:group` + `group: true` + `isolate` | `isolate: { planMode: true }` + 嵌套 `config:` 列表 | `standard.patch.yml:42-49`；实测通过 |
| 12 | 相对路径资产 | row 的 `name` 相对路径 **anchored beside their patch file** | 我们包里若有本地插件目录，就相对 `cordis.patch.yml` 解析 | `cordis-composition-reference/SKILL.md`「A row has…」 |
| 13 | **模型 / 温度 / 思考档位** | **写不下、不该写** | 由 Host 组合 + 企业「模型/访问策略」域决定；配方只声明 persona/instructions | `§A2.2`；`phone-control/agent.cordis.yml:7-9` 原文「The host composition … keeps … the model route」 |
| 14 | **权限预设 / 沙箱档位** | **不进 preset** | 沙箱与批准栈留在 Host 组合 | 同上；本 spike 实测沙箱档位不因装 preset 改变 |
| 15 | 欢迎语 / 展示文案 | 不进组合：用 `config.name`/`description`（官方面）或放我们 manifest 的展示字段 | — | §B.6 |
| 16 | 配方版本 / 资产版本坐标 | **官方面没有这个位置** | 只能放我们自己的 manifest（配方包外层） | 本 spike 未在官方面找到任何版本字段（`config` schema 只有 `id/name/description/order/plugins`，见下） |

**`config` 的权威字段集（实测的 JSON Schema，来自 `Config.listConfigs({entry:'include:preset-ent-spike'})`）**：
`required: ["id","plugins"]`；可选 `name`(string|null) / `description`(string|null) / `order`(number|null)；**任何字段都接受 `!!js` 表达式**（`anyOf` 里带 `loaderExpression`）。**没有 `model`、没有 `version`、没有权限字段。** —— 这条实证直接支撑 §B.1/B.2/B.3 的"版本坐标只能放我们 manifest"的设计。

---

## 6. 回滚与清洁（我做了什么 + 基线对比）

### 6.1 动手前
1. **手工快照**：`undo_snapshot(reason: "preset-bundle-spike 开工前基线:…")` → `20261002-162554-a82d`（6 个文件，manual store）。
   → 顺带实证：`dsh-undo-savepoint` 还会**自动**在每次 profile 配置变化时取快照：`20261002-162620-0dc2`（`reason: "plugin-change"`）、`20261002-162731-696b` / `20261002-162734-8afa`（`reason: "config-change"`）。
2. **落盘基线**：`…/.sshwork/ent-preset-spike/baseline/{package.json,cordis.patch.yml,cordis.yml,pnpm-lock.yaml,hashes.txt,nm-before.txt}`。

### 6.2 回滚步骤（可照抄）
```bash
# ① 官方卸载（两面对等，任选其一）
dsh plugin --profile web remove dsh-ent-preset-spike
#   或  plugin_manager { action: remove_bundle, target: dsh-ent-preset-spike }
# ② 清 link: 残壳（官方 remove 不会清）——删前必须 readlink -f 校验目标
readlink -f "$DSH_PROFILE_DIR/node_modules/dsh-ent-preset-spike"
# ③ 核对三份受管文件与基线逐字节一致
sha256sum "$DSH_PROFILE_DIR"/{package.json,cordis.patch.yml,pnpm-lock.yaml}
# ④ 核对 roster 回到 4 条（不需要重启）
#     cordis_inspect_query(host, Config, listConfigs, {name:'@deepseek-ai/dsh-agent-preset'})  → total 4
# ⑤ 若中途起不来 / 判断可疑：用快照回退
#     undo_list → undo_restore(mode:"id", snapshot_id:"20261002-162554-a82d")
#     （安全模式：undo_safe_mode(action:"on") → 重启 → 排查 → action:"off"）
```

### 6.3 最终基线对比（spike 结束态）

| 文件/对象 | 基线 | 结束态 | 判定 |
|---|---|---|---|
| `profiles/web/package.json` | sha256 `0579a6e1c79a01eb7c839b03aa003e831dc140438fa409d218eda311b4e02c07` | **同** | ✅ 逐字节 |
| `profiles/web/cordis.patch.yml` | `d33079f3b0183a4ce604f826a6f9da8a1afb823e11e7c664a731243fa1595440` | **同**（mtime 仍是 07:55，全程未被写过） | ✅ 逐字节 |
| `profiles/web/pnpm-lock.yaml` | `dae87abf9cf8b7cb68a63ccf1114499c03ca6c43a9c82b6fdc9645ea5a26c182` | **同** | ✅ 逐字节 |
| `profiles/web/node_modules/` 条目数 | **123** | **123**（删掉两个 `link:` 残壳后） | ✅ |
| `profiles/web/compatibility.json` | 10 条既有豁免 | **同**（未新增） | ✅ |
| roster | 4 条 preset（standard/ptc/minimal/cordis） | **同 4 条** | ✅ |
| **`profiles/web/cordis.yml`** | 223 B，内容 `[]`（+注释） | **47 721 B，209 条顶层 entry，`ent-spike`/`ent-recipe` 命中数 0** | ⚠️ **非字节相同，但语义为基线** |
| `.plugin-manager/logs/` | 150 个 `operation-*` | 152 个 | ⚠️ 审计日志（官方行为，不删） |

**`cordis.yml` 那一条必须解释清楚（不是我手改的）**：它是 profile 的**根 include 文件**，装载后由 Host 物化。
源码链路：`dsh-hmr` 的 `ProfileHmr` 收到变化 → `reconcileProfilePatches()` → `entry.update({config: {...includeConfig, patches: prepared}})`（`dsh-app-boot/lib/index.js`），include 插件把合并后的 entry list 写回自己的文件（即 `cordis.yml`）。
时间线实证：16:22 Host 启动时 223 B → 16:25 我的基线副本仍是 223 B → **16:27:32** 变成 47 721 B（`undo` 快照 `20261002-162734-8afa` 记录了这次 47 721 B，而 16:27:31 的 `…-696b` 仍是 223 B）。
**内容实证**：`grep -c 'ent-spike\|ent-recipe'` = **0** ⇒ 里面**没有**任何测试 preset，就是基线组合的物化形式。
**处置**：**故意不手改回去**——它是被 Host 持有并会在每次 reload 重写的活文件，手工写入 `[]` 只会与运行中的树脱钩，且下次 reload 会再写一遍。记为「已知的、非我们引入的 profile 运行期产物」。

---

## 7. 未改动的边界（自证）

| 约束 | 结果 |
|---|---|
| 不改企业插件 `plugin/` | `git -C <repo> status --porcelain -- plugin console server` → **空** |
| 不改远端服务 / console | 同上（未执行任何远端命令，未碰 `console/`） |
| 不 git 提交 | 未执行 `git add` / `commit` |
| 不用 `/tmp` | 所有临时物在 `$HOME/.sshwork/ent-preset-spike/`（`dump-web.yml` 也在 `.sshwork/` 下） |
| 不重启 DSH 进程 | Host PID 28327 全程未变（16:22:14 启动 → 结束仍在） |
| 不吞 stderr | 每条 `dsh plugin` 都 `2>` 单独落盘（`A-install.err` / `A-remove.err` 均为空；stdout 全文见 `A-install.out` / `A-remove.out`） |
| 仓库内只写一个文件 | `docs/notes/preset-bundle-spike.md`（本文件）；spike 开始时 `git status --porcelain` 为**空**，本文件是唯一新增 |

---

## 8. 结论

**能作为 P0 的基础（走得通），但必须带上 §9 的三个前置。**

| P0 假设（§M-1 / D1 前置） | spike 结论 |
|---|---|
| ① 「从 Web 客户端侧发起装 bundle」是否与会话内 `plugin_manager` **同一条面**？ | **同源不同入口**：同一个 `runProfilePnpm` 引擎、同一份 profile 文件、同一个 `dsh.profile.bundles` 语义；差别在**权限语义 / 进度与取消 / 谁决定选中**（§4 表）。→ **P0-4 可以只依赖"Host 服务面"一个引擎**，但要自己决定发起进程与授权 |
| ② 装完 Host 是否需重启？ | **不需要**（`fiberPhase: active` + roster 实时 ±1；卸载亦然）。但 **`patchReload:"startup"` 与实测相反**，写文案时别押"必须重启" |
| ③ 官方 picker 是否列出、以什么名字与分组？ | **列出**；**名字 = `config.name ?? id`**；**分组恒为「自定义」**（内置组只认 4 个硬编码 id，且要求 `name` 缺省） |
| ④ 新会话能否选中？ | **能**，且**只有空白会话**能切（Host 侧 `agent-preset/locked` / `This session has already started`；客户端 `session.blank` 先手过滤）；已存在会话钉住启动时修订 |
| ⑤ 能否干净卸载？ | **能**：三个受管文件逐字节回基线、roster 实时消失。**但官方 remove 不清 `node_modules` 的 `link:` 残壳**，且每次操作留一个审计日志目录 |
| D1「一键启用必然触发一次权限语义」 | **需要修正**：真正的权限弹层只在 **Agent 工具面**（且 Full access 档位下静默通过）；**Web 界面面根本不弹授权**，只有一句信任声明。「弹层」得我们自己造 |

---

## 9. 最关键的三个未解问题

### Q1 · 授权弹层在**比 Full access 更窄**的档位下到底长什么样？（**P0 最高优先**）
本次全程 `danger-full-access` ⇒ `approveEscalation` 第一行 `if (mode === effectiveMode) return mode;` 直接放行，**我一次弹层都没看到**。我们**无法**用本节证据回答「员工点一键启用时屏幕上会显示什么、能不能拒绝、拒绝后链路怎么走」。
→ 必须补一次 spike：把会话档位降到 `workspace-write`（或 `ask`），再跑 `plugin_manager install_bundle`，**把弹层截屏 + 采集"允许/拒绝/取消/无渠道"四条分支的原文**。这直接决定 `docs/plan/enterprise-presets.md` D1 第 1 条（「首次启用弹一次授权」）的可行性与 UI 契约。

### Q2 · 我们的「一键启用」由**谁的进程**发起？（决定权限模型与失败面）
三个选择，代价完全不同：
- (a) **复刻 Web 侧栏的 Host 服务面**（`pluginManager.installBundle` 等价调用）→ 无授权弹层、有流式进度与取消，但**要求我们能在 Host 服务里拿到调用权**（我们现在只有 Remote/工具两条入口，第三方插件能不能直接调 `ctx.pluginManager` 取决于它是否暴露为可注入服务 —— **未验证**）；
- (b) **让员工端（我们的 `dshent-plugin`）拉起 CLI `dsh plugin --profile web add`** → 权限变成"shell 的沙箱档位"，在 `workspace-write` 下**写 profile 目录会被判越界**（本次能成只因为档位是 Full access）→ 会退化成"要用户先把 DSH 调到完全访问"，与产品宪法冲突；
- (c) **Agent 工具面**（让 Agent 代做）→ 每次调用都过 `approveEscalation`，且工具本身在各 preset 里**默认 `disabled: true`**（只有 Creator 模式开）。
→ 必须在 P0-4 开工前把 (a) 的**可达性**验掉（`ctx.get('pluginManager')` 在**预设外的普通 Host 插件**里能否拿到、`installBundle` 是否算 public API）。

### Q3 · **运营面**：`config.name` 是唯一门面，我们怎么在控制台管住它？
官方 picker 只认那一个字符串（无 locale、无回退、无 logo、无来源标记），且分组恒为「自定义」。也就是说：
- 员工看到的「配方」= 我们在控制台给它起的 `config.name`；
- **4 个内置模式（标准/PTC/极简/创造）永远排在「内置」组**，我们的配方只能在「自定义」组，并且 Settings 页那个组里还永远有个「让 Agent 帮我创建预设模式」的 Creator 入口在抢注意力；
- 而我们的**商城入口**（`preset-market.tsx`）与 picker **是两套视觉、两套命名**（§G 卡片那套三枚签/开关在 picker 里**完全不存在**）。
→ 未定：**要不要（以及怎么）把"我们商城的名字/说明"与"picker 里那个 `config.name`"强制同源**？若不同源，员工会看到两个名字；若同源，`config.name` 就等于一个**要跨语言、要长度受控、要唯一**的运营字段，而官方 schema 对它**没有任何约束**。这一条需要产品拍板（涉及 §G.1 卡片与 §M-6）。

---

## 10. 证据落盘索引（可复核）

**验证物 / 原始输出（仓库外）**：`/data/user/0/com.deepcode.shell/files/home/.sshwork/ent-preset-spike/`
- `bundle-min/{package.json,cordis.patch.yml}`、`bundle-recipe/{package.json,cordis.patch.yml}`
- `baseline/{package.json,cordis.patch.yml,cordis.yml,pnpm-lock.yaml,hashes.txt,nm-before.txt}`
- `A-install.out` / `A-install.err` / `A-remove.out` / `A-remove.err`（**stderr 全为空**）
- `nm-after-A.txt` / `nm-after-remove.txt`；`/data/user/0/com.deepcode.shell/files/home/.sshwork/dump-web.yml`（装前的 composed 树，1399 行）

**只读引用（官方，`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/`）**
- `node_modules/@deepseek-ai/dsh-web-app/presets/{standard,ptc,minimal,cordis}.patch.yml`、`package.json`（`dsh.bundle.patch` 数组形态）
- `node_modules/@deepseek-ai/dsh-agent-preset/skills/{editing-cordis-compositions,cordis-composition-reference,cordis-plugin-development}/SKILL.md`
- `node_modules/@deepseek-ai/dsh-agent-preset/README.md`、`…/dsh-agent-preset-registry/README.md`
- `node_modules/@deepseek-ai/dsh-client-ui-agent-preset/{README.md,lib/client.js}`（`isBuiltInPreset` / `presetDisplayText` / zh locale 表）
- `node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/{README.md,lib/client.js}`（`installGuideSafety` / `restartNotice` 等原文）
- `node_modules/@deepseek-ai/dsh-plugin-manager/{README.md,lib/types/tools.js,lib/index.js(installBundle/runPnpm),lib/types/operations.js(runPluginCommand/reconcile)}`
- `node_modules/@deepseek-ai/dsh-sandbox/lib/index.js`（`approveEscalation` 的四条原文与 `mode===effectiveMode` 短路）
- `node_modules/@deepseek-ai/dsh-hmr/lib/index.js:371-377`、`node_modules/@deepseek-ai/dsh-app-boot/lib/index.js`（`reconcileProfilePatches` / `readProfilePatches` / `bundlePatchFiles`）、`lib/bin.js:131-138`、`lib/plugin-BGnVfe_D.js`
- `node_modules/@deepseek-ai/dsh-agent-preset-registry/lib/index.js`（`select()` 的 `agent-preset/locked`）

**本机运行期证据**
- `/data/data/com.deepcode.shell/files/engine.log`（Host 的 stdout/stderr；全程只有 2 行启动输出，热重载**不打印**任何日志——这也是"别靠 engine.log 判断是否生效"的原因）
- `/proc/28327/{cmdline,cwd,fd}`（PID 与启动时间 16:22:14）
- `<profile>/.plugin-manager/logs/operation-*/pnpm.log`
- `/data/user/0/com.deepcode.shell/files/home/.dsh/undo-snapshots/{manual,auto}/`
