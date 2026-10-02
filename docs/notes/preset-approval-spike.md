# 补充 spike（Q1）：**窄档位下**「装 bundle / 写 profile」的授权弹层真机形态

> **性质**：一次性真机验证（spike），**不是实现**。承接 `docs/notes/preset-bundle-spike.md`（552 行，§9 Q1/Q2）与 `docs/plan/enterprise-presets.md`（§A2/§M/决策记录 D1）留下的两个未解问题。
> **时间**：2026-10-02 16:36–16:41（Host 进程启动 ≈16:22，**全程未重启**，PID 28327 未变）
> **环境**：Android 本机 DSH `0.2.0-rc.2`；**当前会话档位仍是 `danger-full-access`（未改）**
> **验证物落点**（仓库外，一次性）：`/data/user/0/com.deepcode.shell/files/home/.sshwork/ent-approval-spike/`
> **口径来源**：`docs/notes/preset-bundle-spike.md`（§3④、§9 Q1/Q2）、`docs/plan/enterprise-presets.md`（§A2.4、§M、D1）、官方安装目录只读源码

---

## 0. 一句话结论

**弹层是真的会弹，但只在「Agent 工具面」弹；而且它是官方的沙箱闸门，不是"安装插件"的确认。**

1. **窄档位（出厂默认就是窄档位：`工作区内修改`）下，Agent 调 `plugin_manager` 一定会进授权闸门** —— 我们用一条真实 ACP 客户端渠道把它**弹出来**了，并跑完 **允许 / 拒绝 / 取消** 三条分支；无渠道（headless）时命中 **no approval channel**。
2. **但「Host 服务面」（Web 侧栏「+ 添加插件」）与 CLI 面完全不进这道闸门**：它们在**任何档位**下都不弹、也不被档位限制（服务面零 `approveEscalation` 调用，实证 + 静态）。
3. **官方弹层只有两个按钮：「允许一次」「拒绝」，没有"总是允许"、没有"取消"**。授权是 **one-shot（per-call）**—— 实测**两次连续调用 = 两次弹层**（间隔 69 ms）。→ **D1 第 2 条「一次授权、后续免打扰」官方不提供，必须我们自己实现。**
4. **Q2 答案：可达。** 普通 Host 插件用 `inject: ['pluginManager']`（或 `ctx.get('pluginManager')`）就能拿到官方安装服务，直接调 `installBundle/waitForInstall/cancelInstall`。→ **「一键启用」应当由我们自己的插件**（Host 侧直调，或 UI 侧走 `ctx.remote.pluginManager`）发起，**不必也不该**要求用户先把 DSH 调到完全权限。

---

## 1. 实际走通的路线（A / B / C）

| 路线 | 是否走通 | 做法 | 关键结果 |
|---|---|---|---|
| **A. CLI 面** | ✅ 走通 | 复制出临时 profile `q1cli`，在 `DSH_PERMISSION_MODE=workspace-write` 下跑 `dsh plugin --profile q1cli add <最小bundle>` | **RC=0，1 s，无弹层、无拒绝**，直接装成功（stdout 原文见 §3.6）。→ CLI 面**不在授权栈里**，档位对它无效 |
| **B. headless（无界面）** | ✅ 走通 | 临时 profile `q1tmp`（复制自 headless），用 `--patch` 打开 agent 工具 `tool-plugin-manager`，跑 `dsh --profile q1tmp --json "<让它装 bundle 的任务>"` | 6 s，tool_result = **`Error: sandbox escalation to "danger-full-access" requires approval, but no approval channel is available`** → 命中「无渠道」分支 |
| **B′. ACP 客户端渠道**（本次新增，B 的加强版） | ✅ 走通 | 临时 profile `q1acp`（出厂模板 `acp` = `dsh-base` + `dsh-acp-app`），用**自写的真实 ACP stdio 客户端**（`acp-client.py`，换行分帧 JSON-RPC）驱动同一任务，分别回答 `allow-once` / `reject-once` / `cancelled` | **「弹层事件」逐字落盘 + 允许/拒绝/取消三条分支原文全部拿到**（§3.2–§3.5）；两次连续调用 → **两次弹层** |
| **C. 静态取证** | ✅ 走通 | `dsh --dump-config` 组合树、全局 grep `approveEscalation` 调用点、`cordis_inspect_query(host, Service, pluginManager)` | 用来钉死"哪条面进闸门""服务可达性""Web 面无闸门" |
| 真机 **Web GUI 截图** | ❌ 未走通 | 侧栏 AI 浏览器**禁止本地回环地址**（`http://127.0.0.1:3081` 打不开）；且约束不许改本会话档位、不许重启 Host | 用 **ACP 客户端**（官方第二条批准渠道）替代：弹层内容与作答语义完全一致，只是渲染方不是 Web UI |
| 手机无障碍驱动真实 App UI | ❌ 未采用 | 会接管用户前台界面且无法保证不打扰当前会话 | 同上，改用 ACP |

**Route B 的一个本机坑（必须记一笔）**：用 `dsh` shim 直接跑 headless **必崩** ——

```text
dsh: fatal uncaught exception: Error: dsh: host preparation failed: Cannot find module 'internal/modules/esm/loader'
Require stack: …/node-addon-require-builtin-android-arm64/index.js
```

原因：正在运行的 Host 是 `/system/bin/linker64 …/node --expose-internals …/dsh/lib/bin.js web --port 3081`（`/proc/28327/cmdline`），而 `dsh` shim（`lib/bin.js` 的 `#!/usr/bin/env node`）**没带 `--expose-internals`**。正确姿势：

```sh
LD_LIBRARY_PATH=/data/user/0/com.deepcode.shell/files/usr/lib \
/…/usr/bin/node --expose-internals /…/@deepseek-ai/dsh/lib/bin.js --profile <tmp> …
```

---

## 2. 六条结论（逐条标注 实证 / 静态推导）

### 结论 1 · 窄档位下装 bundle 会不会弹授权？谁弹？——**会弹，但只有 Agent 工具面弹**（实证）

| 发起面 | 窄档位下是否弹 | 证据 |
|---|---|---|
| **Agent 工具面**（`plugin_manager`） | **弹**（走 `approval.request` 瀑布） | **实证**：ACP 运行三次，每次都收到 `session/request_permission`；headless 运行两次收到「无渠道」失败。**静态**：`@deepseek-ai/dsh-plugin-manager/lib/types/tools.js:32-36` 每个 action 都先 `approveEscalation({requestedMode:'danger-full-access', effectiveMode: policy.mode, …})` |
| **Host 服务面**（Web 侧栏「+ 添加插件」/ 任何插件直调服务） | **不弹**，也不被档位拦 | **静态（决定性）**：`approveEscalation` 的调用点全树只有 6 处 —— `dsh-tool-fs` / `dsh-tool-bash` / `dsh-tool-pwsh` / `dsh-tools`(/ptc) / `dsh-plugin-manager/lib/types/tools.js`；**`dsh-plugin-manager/lib/index.js`（服务本体）与 `dsh-client-ui-plugin-manager`（界面）零命中** |
| **CLI 面**（`dsh plugin add`） | **不弹**，也不被档位拦 | **实证**：§3.6（窄档位下 1 s 装成功，stdout 无任何授权字样）；**静态**：`runProfilePnpm` 所在的 `dsh-plugin-manager/lib/types/operations.js` 对 `sandbox` 零命中，pnpm 子进程不由会话沙箱包装 |

> **"谁弹"的准确说法**：闸门在 **Host 进程**里（`ctx.approval.request()` → `approval/request` 瀑布），**弹层由连接到该 Host 的客户端渲染**（Web 侧是 `dsh-client-ui-approval`；自动化侧是 ACP 客户端）。没有客户端时，闸门 **fail closed**（见结论 4）。

### 结论 2 · 弹层文案 / 按钮 / 能否取消 / 一次还是每次 ——（文案=**静态**（源码模板 + 实测参数代入），行为=**实证**）

**（a）Host 侧生成的正文**（`@deepseek-ai/dsh-sandbox/lib/index.js:105-115`，逐字）：

```js
reason: `escalate sandbox to ${mode}: ${justification}`,
displayReason: {
  en: `Allow this operation with ${mode} permissions: ${justification}`,
  zh: `允许本次操作使用 ${mode} 权限：${justification}`
}
```

代入我们这次真实的 `install_bundle` 调用（**实际 mode 值 = `danger-full-access`**，justification 来自 `tools.js:34`，`JSON.stringify(args)` = `{"action":"install_bundle","target":"…"}`）→ **员工在中文界面看到的标题逐字就是**：

```text
允许本次操作使用 danger-full-access 权限：plugin_manager {"action":"install_bundle","target":"/data/user/0/com.deepcode.shell/files/home/.sshwork/ent-approval-spike/bundle-min"}. Profile changes persist across sessions; installed Host code runs outside the workspace sandbox.
```

> ⚠️ 两点必须注意：① `${mode}` 是**申请的目标档位**（恒为 `danger-full-access`），**不是**用户当前档位——用户看不到"你现在是工作区内修改"这种提示；② 尾部那句是**英文**，夹在中文句子里（官方没有给它做本地化）。

**（b）弹层骨架逐字**（`@deepseek-ai/dsh-client-ui-approval/lib/client.js:87-129, 242-255`）：

| 位置 | zh | en |
|---|---|---|
| 顶栏状态条 | `等待审批` | `Waiting for approval` |
| 标题（有 displayReason 时用它） | 上面的整句 | 同上（en 版） |
| 标题（无 displayReason 时） | `工具 {toolName} 请求越权执行` | `Tool {toolName} requests privileged execution` |
| 详情区 aria-label | `审批详情` | `Approval details` |
| 按钮 1（描边） | `拒绝` | `Reject` |
| 按钮 2（主色） | `允许一次` | `Allow once` |
| 快捷键 | `Enter`=允许一次、`Esc`=拒绝（`registerFixed`，`:296-318`） | 同 |

**（c）ACP 侧同一请求的选项表**（实证，`acp-client.py` 落盘）：

```json
{"method":"session/request_permission","params":{
  "sessionId":"719bbc75-…","toolCall":{"toolCallId":"call_00_RC7i5Gi8qNrt5BhkhCE02215"},
  "options":[{"optionId":"allow-once","name":"Allow once","kind":"allow_once"},
             {"optionId":"reject-once","name":"Reject","kind":"reject_once"}]}}
```

**（d）能不能取消？** —— **弹层上没有「取消」按钮**。取消来自**中止本轮**（signal abort）：`ApprovalService.decide()` 监听 `req.signal`，中止即结算 `cancelled`（`dsh-user-approval/lib/index.js:172-189`）。ACP 侧等于客户端回 `{"outcome":{"outcome":"cancelled"}}`（实证，§3.5）。

**（e）每次调用都弹，还是授权一次后续免打扰？** —— **每次调用都弹（实证）**。E3 让模型连续调两次 `plugin_manager`：

```text
ask#1 = call_00_RC7i5Gi8qNrt5BhkhCE02215 → allow-once → 工具 completed
ask#2 = call_01_Ldc1nuCiEu5vzfoXvOOc4435 → allow-once → 工具 completed
（两次弹层事件时间差 0.069 s）
```

**静态根因**：批准结果只有 `allowed-once` 一种授权（`dsh-sandbox/lib/index.js:117`: `case "allowed-once": return mode;`），且这个 `mode` **只服务于发起它的那一次调用**（注释原文：*"A strictly wider mode requires approval and applies only to this call."*）。**官方词汇表里没有 `always` / `allow-always` 这类结果**（`dsh-user-approval/lib/index.js:30-35` 的 OUTCOMES 只有 4 个）。

> **对 D1 的直接后果**：D1 第 2 条「一次授权、后续免打扰」**不可能**建立在官方闸门上——官方是"一次调用一次授权"。要么我们自己做（见 §5），要么每次调用都弹（体验不可接受）。

### 结论 3 · 不会弹而直接拒绝时的原文与用户可见面（**实证 + 静态**）

| 情形 | 结果 | 原文（逐字） |
|---|---|---|
| 没有客户端渠道（headless / UI 未连） | 工具 **error** | `sandbox escalation to "danger-full-access" requires approval, but no approval channel is available` |
| 客户端点「拒绝」 | 工具 **error** | `the user rejected escalating this plugin management operation to "danger-full-access"; it stays denied, so stop and explain instead of working around it` |
| 中止本轮 / 渠道回 cancelled | 工具 **error** | `approval for escalating to "danger-full-access" was cancelled` |
| 档位已够（Full access） | **不弹，直接放行** | 无任何文案（`mode === effectiveMode` 短路） |
| 会话策略被置成 `never`（静态，本机出厂组合走不到） | **不弹**，直接视为拒绝 | `@deepseek-ai/dsh-user-approval/lib/index.js:175`：`if (this.effectivePolicy(session) === "never") return "rejected";` → 落到上表第 2 行那句 |

- **用户看到什么**：工具卡片变红、正文就是上面那句英文（工具错误原文，官方没有中文包装）；如果是 headless 脚本，stderr/`--json` 里同样只有这句。
- **有没有"引导用户去提权"的官方路径？** —— **工具面给模型看的只有**：
  - 工具描述（模型可见）：`Every action requires danger-full-access permission or approval for this call. Approval does not change the session permission mode. …`
  - 同轮提示（`escalationHintMarker`）：`[sandbox: escalation available — retry this exact operation once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]`
  - **没有**任何"请让用户去设置里把档位调高"的面向用户的引导。用户侧确实有一个权限选择器（`ui-permission`），档位中文名逐字为 **仅可查看 / 工作区内修改 / 完全权限**，且切到完全权限会先弹一个确认框（zh：`确认启用完全权限？` / `启用完全权限后，智能体将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任当前任务时使用。`）——但那是**给用户的通用设置**，不是给"装 bundle 失败"这个场景的引导。

### 结论 4 · 「无渠道」分支在什么情况下命中（**实证**）

- **命中条件**：Host 组了 `approval` 服务、策略是 `ask`，但 `approval/request` 瀑布上**没有任何 answerer** —— 即**没有客户端连接**。`dsh-user-approval/lib/index.js:176` 的 waterfall 默认返回 `"unavailable"`。
- **本机两个真实现场**：
  1. `dsh --profile q1tmp --json …`（headless 一次性任务，无 UI）：`DSH_PERMISSION_MODE=workspace-write` 显式设定 → 6 s，命中；
  2. **`DSH_PERMISSION_MODE` 完全不设**（= 出厂默认 `workspace-write`）→ 6 s，**同一句原文**命中。
     → 也就是说：**出厂默认档位就是窄档位，闸门默认就是开着的。**
- **后果（fail closed，零副作用）**：工具在进入 `manager.installBundle` **之前**就抛错，什么都没装、什么都没改；没有任何"降级成不弹直接装"的路径。（旁证：E1c 是在 q1tmp **已经装过**这套 bundle 之后跑的，仍然报同一句而非 `already-installed`，说明它压根没走到安装逻辑。）

### 结论 5 · Web 界面面在窄档位下的行为（**静态（决定性）+ 旁证**）

**不弹授权，只有那句信任声明。** 链路逐字：

```js
// dsh-client-ui-plugin-manager/lib/client.js:1260
const result = await this.ctx.remote.pluginManager.installBundle(spec, { … });
```

→ 走的是 `PluginManagerService.installBundle`（`dsh-plugin-manager/lib/index.js:1691`），该方法体内**没有任何 `approveEscalation` / `sandboxPolicy` / `sandboxPermissions`**（精确 grep 结果为空），而它下面的 `runProfilePnpm`（`lib/types/operations.js:246`）对 `sandbox` 也零命中 → pnpm 是 Host 自己 spawn 的子进程，**不受会话沙箱约束**。

信任声明原文（`client.js:118 / 309`）：

| 语言 | 原文 |
|---|---|
| zh | `请确认插件来源可信。插件在本机以你的权限运行，来源不明的插件可能损坏 DeepSeek Harness，或读取和泄露你的数据。` |
| en | `Install only plugins you trust: they run with your permissions and can damage DeepSeek Harness or leak your data.` |

→ **所以"把档位调窄"对 Web「添加插件」这条面没有任何效果**：它既不弹，也不受限制。上一轮 §3④(b) 的判断（Web 面无权限弹层、只有信任声明）**方向正确**，本次补上了"窄档位下也一样"的证明。

### 结论 6 · 对我们「一键启用」的结论 —— 见 §5（推荐 + 理由 + 档位要求）

---

## 3. 四条分支原文（带实际 mode 值）+ 对照组

> 全部取自本次真机落盘（`…/.sshwork/ent-approval-spike/`）。**必须注意：四处 `${mode}` 的实测值都是 `danger-full-access`**（= 申请的目标档位），没有任何一处出现用户当前档位（`workspace-write`）。

### 3.1 短路分支（档位已够 → 零弹层）

- **条件**：`effectiveMode === 'danger-full-access'`（Host 以 `DSH_PERMISSION_MODE=danger-full-access` 启动，或会话被切到「完全权限」）。
- **源码**：`if (mode === effectiveMode) return effectiveMode;`（`dsh-sandbox/lib/index.js:101`，**第一行**）。
- **实证**：E2 对照组（同 profile、同 patch、同任务，只改这一个环境变量）→ tool_result **completed**，11 s：

```json
{"stage":"enable","target":"dsh-ent-preset-q1","enabled":true,"changed":true,
 "application":"restart-required","registries":[null],
 "packageResult":{"exitCode":0,"output":"\ndependencies:\n+ dsh-ent-preset-q1 link:…/bundle-min\n\nAlready up to date\nDone in 592ms using pnpm v10.12.1\n", …},
 "bundle":"dsh-ent-preset-q1","warnings":[]}
```

**零弹层、零授权字样。** → 上一轮 §3④ 的"Full access 下永远测不到弹层"得到同构复现。

### 3.2 无渠道（**实证**，E1b / E1c）

```text
Error: sandbox escalation to "danger-full-access" requires approval, but no approval channel is available
```

### 3.3 允许（**实证**，E3）

ACP 弹层事件（逐字）：

```json
{"jsonrpc":"2.0","id":0,"method":"session/request_permission","params":{"sessionId":"719bbc75-ede0-47cd-abb1-9059a73399da","toolCall":{"toolCallId":"call_00_RC7i5Gi8qNrt5BhkhCE02215"},"options":[{"optionId":"allow-once","name":"Allow once","kind":"allow_once"},{"optionId":"reject-once","name":"Reject","kind":"reject_once"}]}}
```

客户端作答 `{"outcome":{"outcome":"selected","optionId":"allow-once"}}` → 工具 `status: completed`，返回真实 `list_plugins` 结果；**紧接着第二次调用又问了一遍**。全流程 12 s。

### 3.4 拒绝（**实证**，E4）

```text
Error: the user rejected escalating this plugin management operation to "danger-full-access"; it stays denied, so stop and explain instead of working around it
```

（源码 `dsh-sandbox/lib/index.js:118`，`subject` = `plugin management operation`——这是 `plugin_manager` 工具专属的措辞，bash/fs 工具分别是 `command` / `operation`。）

### 3.5 取消（**实证**，E5）

```text
Error: approval for escalating to "danger-full-access" was cancelled
```

（源码同文件 `:119`。ACP 侧对应客户端回 `{"outcome":{"outcome":"cancelled"}}`；Web 侧对应中止本轮/连接断开。）

### 3.6 CLI 面（**实证**，路线 A：窄档位下完全不进闸门）

```text
$ DSH_PERMISSION_MODE=workspace-write dsh plugin --profile q1cli add …/bundle-min
RC=0  耗时 1s
stdout:
dependencies:
+ dsh-ent-preset-q1 link:/data/user/0/com.deepcode.shell/files/home/.sshwork/ent-approval-spike/bundle-min

Already up to date
Done in 497ms using pnpm v10.12.1
stderr:（空）
```

### 3.7 耗时汇总（给"一键启用"的进度/取消设计用）

| 现场 | 档位 | 结果 | 端到端耗时 |
|---|---|---|---|
| E1b headless 装 bundle | workspace-write | 闸门拦截（无渠道） | **6 s**（含 2 个模型步） |
| E1c headless 装 bundle（`DSH_PERMISSION_MODE` 未设 = 出厂默认） | workspace-write | 同上 | **6 s** |
| E2 headless 装 bundle（对照） | danger-full-access | 装成功（pnpm 592 ms，`application: restart-required`） | **11 s** |
| E3 ACP 两次调用 + 两次弹层 | workspace-write | 两次 allow-once 成功 | **12 s** |
| E4 ACP 装 bundle + 拒绝 | workspace-write | 拒绝原文 | **6 s** |
| E5 ACP 装 bundle + 取消 | workspace-write | 取消原文 | **9 s** |
| 路线 A CLI 装 bundle | workspace-write | 装成功 | **1 s** |

> **注意**：本轮所有本地路径安装都**没有**撞上上一轮 face B 的 `ERR_SOCKET_TIMEOUT`（71.5 s）——因为走的都是 `dsh-base` 已经装好的 profile；**外网 registry 那一段的耗时风险仍然存在**，不能拿 1 s 做承诺。

---

## 4. Q2 · 一个**普通 Host 插件**能不能拿到 `ctx.pluginManager`？——**可达**

**结论：可达（两种写法），并且它正是官方自己的用法。**

| 证据类型 | 内容 | 出处 |
|---|---|---|
| **实时（最强）** | `cordis_inspect_query(host, Service, listService, {service:"pluginManager"})` 返回：`"key":"pluginManager"`，`access.hardDependency.inject = ["pluginManager"]`、`expression "ctx.pluginManager"`；`access.optional.expression "ctx.get(\"pluginManager\")"`（`requiresUndefinedCheck: true`）；并列出 `@Remote installBundle(spec, options?) / waitForInstall / cancelInstall / listPlugins / …` | 本次真机 `cordis_inspect_query` |
| **官方就是一个普通 Host 插件这么写的** | `@deepseek-ai/dsh-plugin-manager/tools` 的 `inject` 首行：`export const inject = ['tools', 'pluginManager', 'sandboxPolicy'];`（它既不是 Agent 工具实例、也不是 UI 插件，就是 profile 里的一行 Host 插件） | `dsh-plugin-manager/lib/types/tools.js:7` |
| **服务注册名** | `constructor(ctx, config) { super(ctx, "pluginManager"); … }` | `dsh-plugin-manager/lib/index.js:1380` |
| **挂载位置** | 组合树里 `- id: plugin-manager` 是 **profile 根层**的一行，**没有 `isolate`**（同一层还有 `sandbox-policy` / `approval` / `permission`） | `dsh --profile q1tmp --dump-config`（`.sshwork/ent-approval-spike/q1tmp-tree.yml`） |
| **客户端侧另一种可达** | UI 插件用 `ctx.remote.pluginManager.installBundle(...)`（官方「+ 添加插件」的做法） | `dsh-client-ui-plugin-manager/lib/client.js:1260` |

**需要什么 / 边界**：
- **Host 侧**：在自己那行插件里声明 `inject: ['pluginManager']`（硬依赖）或 `ctx.get('pluginManager')`（可选依赖，必须判空）。只要它与 `plugin-manager` 行**在同一个服务可见域**（根层，或非 isolate 的子 realm）即可。**注意**：`isolate` 会把某个服务名隔离出 realm（例如 preset 里 `isolate: { planMode: true }`），若我们自己的组合显式 isolate 了 `pluginManager`，就要把 provider 与 consumer 放进同一个 realm。
- **客户端侧**：直接 `ctx.remote.pluginManager.*`（官方 Remote 面，无需额外权限）。
- **服务方法就是公开面**：`installBundle(spec, options?)` 支持 `{enabled, requestId, approvedBuilds, registry}`，配套 `waitForInstall(requestId)`（恢复丢失的响应）与 `cancelInstall(requestId)`（返回 `cancelled / too-late / not-running`）——**这正是"一键启用"要的进度 + 取消**。
- **不存在"因为是第三方所以拿不到"的限制**：它就是一条普通 Cordis 服务；我们自己的企业插件只要挂在 profile 里就能拿。

---

## 5. 对「一键启用」的推荐

### 5.1 由谁的进程发起？——**我们自己的插件**（Host 侧直调优先，UI 侧走 Remote 次之）

| 方案 | 弹层 | 档位要求 | 进度/取消 | 判定 |
|---|---|---|---|---|
| **(a) 我们自己的 Host 插件直调 `ctx.pluginManager.installBundle`** | **零弹层**（服务面不进闸门）→ 授权 UI 由**我们**做 | **任意档位**（含出厂默认的「工作区内修改」） | `plugin-manager/install-log` + `install-state` 事件、`waitForInstall`、`cancelInstall` | ✅ **推荐** |
| (b) UI 插件走 `ctx.remote.pluginManager.installBundle`（= 官方「+ 添加插件」） | 零弹层 | 任意档位 | 同上（官方 UI 就是这么做的） | ✅ 可用（与 (a) 同一服务） |
| (c) CLI `dsh plugin --profile <p> add` | 零弹层 | 任意档位 | **只有同步 stdout，无流式、无 cancel** | ⚠️ 仅作兜底/运维 |
| (d) 让 Agent 工具代做 | **每次调用都弹**，只能「允许一次」 | 必须**不是**完全权限（否则不弹但也无确认） | 无（一次调用一次授权） | ❌ 与 D1「一次授权、后续免打扰」直接冲突 |

**推荐 = (a)，理由三条：**
1. **不逼用户提权**：它在任何档位都能跑（实证：服务面零 `approveEscalation`，pnpm 不受会话沙箱约束），不需要用户先去把档位调成「完全权限」——这与产品宪法「开箱即用 · 小白零门槛」相容。
2. **授权语义归我们**：官方闸门是 per-call、只有「允许一次」；D1 要的「首次弹一次、按插件集合指纹免打扰、集合变化必须重新确认」只能由我们实现。走官方闸门反而会把我们的 UX 绑死在"每次调用都弹"上。
3. **现成的进度与取消**：`installBundle({requestId})` + `install-state`/`install-log` 事件 + `waitForInstall` + `cancelInstall` 正好覆盖「进度 + 取消 + 响应丢失恢复」。**注意**：`application: "restart-required"` 会出现（实测 E2 就是它），文案要按"热生效 / 需重启"两种诚实呈现。

### 5.2 要求用户在什么档位？

**不要求。** 出厂默认档位就是 `workspace-write`（「工作区内修改」），实测在该档位下：
- 服务面/Direct 调用照常工作（**不需要**用户改成完全权限）；
- 只有"让 Agent 用工具代做"这条路径才会被闸门拦住（且拦在无渠道时直接失败）。

→ **D1 的措辞可以定型为**：「启用」不要求用户改任何权限设置；授权确认完全由我们的界面完成。

### 5.3 授权弹层怎么写（基于实证的 UI 契约）

- **归属**：我们自己造（官方只在 Agent 工具面有一套 per-call 弹层，**Web 界面面根本没有**）。
- **文案骨架**：可照抄官方那句的信息量与语气（「以你的权限运行 / 可能损坏 / 可能泄露数据」`installGuideSafety`）+ `displayReason` 的句式 `允许本次操作使用 <档位> 权限：<逐项说明>`，但**必须中文化**（官方那句尾部是英文）、并**逐项列出会装哪些插件、各自能做什么**（D1 第 1 条）。
- **按钮**：至少要「启用」与「取消」两个（官方弹层没有取消按钮，我们不必照抄它的短板）；**不要**做「允许一次」这种 per-call 语义，直接做 D1 的「一次授权、按集合指纹免打扰」。
- **必须自己实现的点（官方不提供）**：
  1. **集合指纹** = 配方声明的插件集合（`config.plugins` 的规范化摘要）——指纹变化 → 重新确认（D1 第 2 条）；
  2. **失败不等按钮禁用**（D1 第 4 条）：`installBundle` 返回结构化结果（`stage/application/packageResult/warnings/failedAt`）+ `logPath`，非常适合做人话 + 重试；
  3. **停用/卸载不残留**（D1 第 3 条）：官方 `removeBundle` 会留 `node_modules/<pkg>` 的 `link:` 残壳（上一轮 §3⑤ 已实证），要么用我们自己的去链步骤，要么如实告知。

---

## 6. 清理与基线对比

### 6.1 本次落盘（全部在 `…/home/.sshwork/ent-approval-spike/`，**未用 /tmp**）

```text
baseline/{web-hashes.txt,web-nm-count.txt,web-pmlogs-count.txt,package.json,cordis.patch.yml,pnpm-lock.yaml,compatibility.json}
bundle-min/{package.json,cordis.patch.yml}          ← 最小 bundle（两个文件）
enable-pm-tool.yml                                  ← 只打开 tool-plugin-manager 的临时 patch 覆盖
acp-client.py                                       ← 自写 ACP 客户端（官方 stdio JSON-RPC 渠道）
E1b-narrow.{json,err,timing}  E1c-default.{json,err,timing}  E2-control.{json,err,timing}
E3-acp-allow.jsonl  E4-acp-reject.jsonl  E5-acp-cancel.jsonl  A-cli-install.{out,err,timing}
q1tmp-tree.{yml,err}  q1acp-tree.{yml,err}  headless-tree.{yml,err}
sessions-backup/                                    ← 本次 6 个一次性会话的原始 log（见 6.3）
```

### 6.2 web 正式 profile：**逐字节回到基线**

| 项 | 基线（16:37 开工前） | 收工（16:41） | 判定 |
|---|---|---|---|
| `package.json` | `0579a6e1…02c07` | 同 | ✅ |
| `cordis.patch.yml` | `d33079f3…95440` | 同 | ✅ |
| `cordis.yml` | `bb65c527…83980` | 同 | ✅ |
| `pnpm-lock.yaml` | `dae87abf…6c182` | 同 | ✅ |
| `compatibility.json` | `b368d224…b27ed` | 同 | ✅ |
| `node_modules/` 条目数 | 123 | **123** | ✅ |
| `.plugin-manager/logs/operation-*` | 152 | **152**（本次**没有**在 web profile 里装/卸任何东西） | ✅ |
| web `node_modules/dsh-ent-preset-*` 残留 | 无 | 无 | ✅ |
| Host 进程 | PID **28327**（16:22 启动） | **28327**（etime 18:50，未重启） | ✅ |

### 6.3 临时物清理

| 对象 | 处置 |
|---|---|
| 临时 profile `q1tmp`（headless 副本） | **已删**（里面装过 `dsh-ent-preset-q1`，随目录一起消失） |
| 临时 profile `q1cli`（headless 副本，路线 A） | **已删** |
| 临时 profile `q1acp`（出厂 `acp` 模板） | **已删** |
| `.dsh/profiles/` 现状 | `headless` / `headless-bad` / `node_modules` / `web`（= 开工前） |
| 本次产生的 6 个一次性会话目录 | 先 `cp -a` 到 `sessions-backup/`，再从 `…/sessions/--storage-emulated-0-DSH-DSH-ENT--/` **删除**（避免污染用户的会话列表）；用户与父会话（`1d977711…` / `8d618e21…`）**未触碰** |
| 误落的 `…/home/.dsh/.sshwork/`（我建错的位置） | 内容已合并到 `…/home/.sshwork/`，该目录**已整体删除**（开工前不存在，从 `…/home/.dsh` 的清单可证） |
| `/tmp` | **全程未使用** |

---

## 7. 未改动边界（自证）

| 约束 | 结果 |
|---|---|
| 不改企业插件 `plugin/` | 未打开、未修改；`git -C <repo> status --porcelain` 只应有本文件 |
| 不改远端 / console | 未执行任何远端命令，未碰 `console/`、`server/` |
| 不 git 提交 | 未执行 `git add` / `git commit` |
| **不改当前会话权限档位** | 本会话全程 `danger-full-access`（系统提示明示"Approval prompts are disabled in this session"）；所有窄档位现场都是**另起进程 + 临时 profile** 造出来的（`DSH_PERMISSION_MODE` 环境变量 / 出厂默认） |
| 不重启 DSH | Host PID 28327 全程未变 |
| 不动用户正式 profile | `headless` / `web` 零写入；用到的都是副本与临时模板 |
| 不用 `/tmp` | 全部落在 `…/home/.sshwork/ent-approval-spike/` |
| 不吞 stderr | 每次运行都 `2>` 独立落盘（`E1b-narrow.err` / `E2-control.err` / `E*.jsonl.err` / `A-cli-install.err`），仓库外可复核 |
| 仓库内只写一个文件 | `docs/notes/preset-approval-spike.md`（本文件） |

---

## 8. 对上一轮报告的修正（3 条）

1. **「Agent 工具在各 preset 里默认 `disabled: true`，只有 Creator 模式开」不成立。** 出厂 `standard` / `ptc` / `cordis` 三份 preset 的 `plugins` 列表里都带 `tool-plugin-manager`，且写成 `disabled: !!js "!ctx.get('profileContext')"`（`dsh-web-app/presets/standard.patch.yml:144`、`ptc.patch.yml:150`、`cordis.patch.yml:152`；基座 `dsh-base` 那行才是 `disabled: true`）。旁证：**本轮真机在会话里直接调用了 `plugin_manager list_bundles` 并成功返回**（完全权限档位、零弹层）——即 Agent 工具面在 web profile 里是**常开**的（`minimal` 模式除外）。
2. **"从 CLI 侧发起"不是"权限降级"问题，而是"根本不进授权栈"问题。** 上一轮 §9 Q2(b) 推测「`workspace-write` 下写 profile 目录会被判越界」——本轮实测**不成立**：窄档位下 `dsh plugin add` 1 s 成功、无任何越界/授权字样（该路径既不过 `approveEscalation`，pnpm 子进程也不由会话沙箱包装）。
3. **headless 一次性任务必须用 `node --expose-internals <dsh>/lib/bin.js` 启动**，`dsh` shim 会在 boot 阶段因 `internal/modules/esm/loader` 解析失败而崩（Android 原生 addon 依赖 `--expose-internals`）。这一条对所有"另起进程"的自动化都有用。

---

## 9. 证据索引（可复核）

**本机运行期（仓库外）**：`/data/user/0/com.deepcode.shell/files/home/.sshwork/ent-approval-spike/`（清单见 §6.1）

**只读引用（官方安装目录 `/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/`，`0.2.0-rc.2`）**
- 闸门本体：`node_modules/@deepseek-ai/dsh-sandbox/lib/index.js:99-123`（`approveEscalation`、`WIDER_MODES`、四条 throw 原文、`displayReason` 模板、`allowed-once` 只作用于本调用）
- 调用点：`node_modules/@deepseek-ai/dsh-plugin-manager/lib/types/tools.js:7,14,30-36`（inject / 工具描述 / `requestedMode:'danger-full-access'` + justification 逐字）
- 服务本体：`node_modules/@deepseek-ai/dsh-plugin-manager/lib/index.js:1380`（`super(ctx,"pluginManager")`）、`:1691`（`installBundle`）；`lib/types/operations.js:246`（`runProfilePnpm`，全文无 sandbox）
- 批准服务：`node_modules/@deepseek-ai/dsh-user-approval/lib/index.js:30-35`（OUTCOMES 无 always）、`:128-144`（audit + request）、`:172-189`（`never→rejected`、waterfall 默认 `unavailable`、signal→`cancelled`）
- 沙箱策略：`node_modules/@deepseek-ai/dsh-sandbox-policy/lib/index.js:141-148`（会话 `sandbox/mode` 覆盖 fold）
- 档位预设：`node_modules/@deepseek-ai/dsh-permission-presets/lib/index.js:139-160`（read-only/workspace-write/danger-full-access 绑定 ask/ask/never）、`:208-223`（`permission` 命令）
- 模式来源（**最强的一条**）：`node_modules/@deepseek-ai/dsh-base/cordis.patch.yml:230-248` ——
  `mode: !!js process.env.DSH_PERMISSION_MODE ?? 'workspace-write'`、
  `policy: !!js "(process.env.DSH_PERMISSION_MODE ?? 'workspace-write') === 'danger-full-access' ? 'never' : 'ask'"`
- Web 弹层组件：`node_modules/@deepseek-ai/dsh-client-ui-approval/lib/client.js:29-38,70,87-129,242-255,296-318`
- Web 插件管理面：`node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js:118,309,1260`
- 权限选择器文案：`node_modules/@deepseek-ai/dsh-client-ui-permission-presets/lib/client.js:154-205`
- ACP 渠道：`node_modules/@deepseek-ai/dsh-acp/lib/index.js:1116-1139`（`approval/request` → `session/request_permission`，选项 `allow-once`/`reject-once`）、`dsh-acp/README.md`（协议契约）
- 出厂 profile 模板：`node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:530`（`acp: [dsh-base, dsh-acp-app]`）
- 事件转发白名单：`node_modules/@deepseek-ai/dsh-api-remotes/lib/types/remote-events.js:14`（`{event:'approval/request', mode:'waterfall'}`）
