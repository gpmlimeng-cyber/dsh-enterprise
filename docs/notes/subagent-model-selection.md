<!--
[INPUT]: 依赖用户要求「主会话使用 deepseek，子会话使用 mimo」与官方子智能体模型选择机制。
[OUTPUT]: 记录该机制的代码证据、本会话为何用不了、以及在什么条件下可验证通过。
[POS]: docs/notes 下的机制速查；供后续实施与排障引用，不重复方案内容。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 子智能体模型选择:机制、现状与验证步骤

## 一、用户要求

> 「主会话使用 **deepseek**，子会话使用 **mimo**」（等价于:主线不动，只让子代理跑在 MiMo 上）

## 二、机制（官方 `@deepseek-ai/dsh-tool-subagent`，均为代码证据）

| 事实 | 出处 |
|---|---|
| 子代理模型 = 显式请求 ?? **父会话模型** | `lib/index.js:94` 与 `:119`：`model = requested?.model ?? parentOptions.model` |
| 子代理工具的 `model` 参数是**可选**的 | `:260`：`model: z.string()` |
| 授权来自一条**按会话记录的策略**：`subagent/model-selection-policy { allowedModels }` | `:208-212`；`:228` 注释：allowedModels = “exact routes the **definition** may select explicitly” |
| 该策略由设置页「子智能体 → 模型选择 → 允许 Agent 为子智能体选择模型」写入 | `dsh-client-ui-settings-subagent`；页面文案：**「仅影响新会话」** |

⇒ **主会话 deepseek + 子会话 mimo 是官方支持的组合**：授权列表里勾 MiMo 路由，
子代理定义即可显式选它们；未选则继承父会话。

## 三、本机现状与为何"测试没生效"

- 本机 profile（`profiles/web/cordis.patch.yml:222-232`）已配置：
  `allowedModels = [xiaomi-token-plan-cn/mimo-v2.6-flash, xiaomi-token-plan-cn/mimo-v2.6-pro]`，
  `enabled: true`；用户界面里已勾选 MiMo 两条并保存。
- 但 **本会话（及其内派出的子代理）实际仍记录为 `deepseek-flash` / `deepseek-official`**：
  - 证据一：探针子任务 `42e71773`（改动之后派出）的 projcache 记录 = `deepseek-flash`，`mimo` 命中 0
  - 证据二：父会话同一时刻的 projcache 记录 = `deepseek-flash`（16:51 刚重写，非陈旧）
  - 证据三：本会话拿到的 `subagent` / `subagent_fork` 工具 **schema 里没有 `model` 参数**
- 原因：模型选择策略**按会话记录**，且官方页面明说「仅影响新会话」；运行中会话保持启动时那版
  （与本仓库另一条已查实结论同构：*已存在会话钉住启动时修订*）。

## 四、验证步骤（在新会话里做，10 秒即可见证）

1. 新开一个会话（会话模型保持 **deepseek**，以验证"主线不动"）。
2. 在该会话里派一个极小子任务（只需跑一条命令）。
3. 读取该子任务会话的 projcache：
   `~/.dsh/storages/session_projcache/sessions/<子任务会话 id>.json`
   断言其中 `"model"` 为 `mimo-v2.6-flash`、`"provider"` 为 `xiaomi-token-plan-cn`；
   同时父会话记录仍为 `deepseek-flash`。

## 五、若新会话仍不生效（待反馈平台的能力缺口）

- 现象会是：授权已开，但 Agent 侧工具 schema 仍不暴露 `model` 参数。
- 届时把本条作为**平台能力反馈**：`dsh-tool-subagent` 本体支持 `model`，
  但需要让 Agent 侧工具 schema 把该参数按策略暴露出来。
- **不要用 hack 绕过**（例如伪造父会话模型或直接改会话文件）。
