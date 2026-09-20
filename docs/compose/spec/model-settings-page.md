---
feature: model-settings-page
status: delivered
updated: 2026-09-18
branch: feat/cloud-workspace
commits:
---

# 模型配置页：企业内置只读 + 官方自定义保留

## Report

**What was built** — 推翻 MVP「禁用个人 provider 与个人模型设置页」的冻结：恢复官方模型配置页与两类 provider，使官方自定义模型能力完整可用；企业受管模型通过官方 `settings.models.footer` 扩展槽以「内置」标签只读列出，不提供任何编辑入口。同时完成「模型列表只留真实模型」的稳态投影：`enterprise/default` 哨兵仅在默认未同步的桥接过渡态出现，bootstrap 到达后由官方 `agentDefaultModel.saveSelection` 把默认写成管理员当前真实模型并收起哨兵；用户自选的自定义默认一律不覆盖。设置入口文案由「DSH Enterprise 设置」改为「企业设置」。

**Verification** — llm-gateway 22/22（profiles 4 例 + default-model 12 例等）；ui 37/37（含 builtinModelRows 纯投影与 builtinModels 解码）；bundle 测试（patch 不再停用三 id、四个 slot 注册）；`node workspace.test.mjs` 4/4。

**Journey log**

1. 官方模型页对无 settings 命名空间的行直接丢弃，企业路由（隔离实例注册）在官方卡片里**不可见**——因此内置区块必须走官方 `settings.models.footer` 槽，而不是给企业行伪装命名空间。
2. pi-ai 的 `modelOf` 对不在 `models[]` 的 id 抛 `UNKNOWN_MODEL`，所以「直接删哨兵」会崩默认模型；正确解法是先 `saveSelection` 落地真实默认再收起桥接。
3. 双 pi-ai 实例共用 `registerModelDiscovery('llm-pi-ai')`：发现只在草稿阶段使用，草稿在任一实例都无 profile，行为一致，不会撞坏。
4. 账号 bootstrap 投影是刻意的最小面（测试锁死不透出 models），内置模型走独立 `builtinModels()` 取数通道而非扩展账号契约。

## [S1] Problem

MVP 冻结了 `ui-settings-models`、`llm-pi-ai`、`llm-deepseek` 三条个人能力（由企业统一管模型），员工无法在客户端查看或自配模型；同时模型选择器一度出现双分组与「xxx（企业默认）」噪音后缀。需要：① 模型配置页可见；② 企业模型带内置标签且只读；③ 官方自定义模型能力完整保留；④ 列表只留真实模型。

## [S2] Design

### S2.1 冻结决策

| 决策 | 选择 |
|---|---|
| 官方页与个人 provider | 恢复 `ui-settings-models`、`llm-pi-ai`、`llm-deepseek`（`cordis.patch` 移除 `disabled: true`） |
| 企业模型展示位置 | 官方 `settings.models.footer` 扩展槽（唯一能显示企业行的官方出口） |
| 企业模型编辑面 | **零编辑入口**：无添加/编辑/删除按钮，纯只读行 +「内置」标签 |
| 默认哨兵 | 稳态不输出 `enterprise/default`；桥接态（默认仍是占位符）临时保留，`saveSelection` 落地真实默认后收起 |
| 用户自选默认 | `shouldAdoptAdminDefault` 仅在「占位符或我方跟写值」时覆盖，用户自选值永不覆盖 |
| 取数通道 | 独立 `builtinModels()`（同 bootstrap 端点、独立投影），不扩展账号 bootstrap 最小面 |
| 设置入口文案 | 「DSH Enterprise 设置」→「企业设置」 |

### S2.2 行为契约

1. `buildEnterpriseProfiles(snapshot, base, auth, { includeUnsyncedDefault })`：稳态（默认 false）只输出真实模型；单协议合并为唯一 `enterprise` 分组；桥接态追加哨兵（展示名「跟随管理员默认」，任何模型名不含「企业」）。
2. `registerEnterpriseGateway`：档案发布前若仍是占位符先 `adoptAdminDefault`，发布后再采纳一次（覆盖管理员变更）；bridge 翻转则重建再发一版。
3. 官方页 footer 渲染 `EnterpriseBuiltinModelsSection`：`bootstrap.models` 投影为行，`内置` 徽标必现，`isDefault` 追加「默认」徽标；**不含任何交互控件**。
4. `ctx.slots.inject('settings.models.footer')` 注册 `enterprise-builtin-models`（order 10）；`dsh.client.inject` 增列 `@deepseek-ai/dsh-client-ui-settings-models`。
5. 设置页 label/标题/aria 统一为「企业设置」。

### S2.3 错误行为

- `listBuiltinModels` 在非 READY 会话抛 `ENT_AUTH_REQUIRED`；解码遇缺失/畸形 models 返回空数组，区块降级为「暂无企业内置模型」而非报错崩页。
- `adoptAdminDefault` 端口缺失/无 isDefault/无归属 provider/保存失败 → 不写入、不抛出，桥接维持原态。

### S2.4 测试边界

| 层 | 断言 |
|---|---|
| profiles.spec | 稳态三协议无哨兵；桥接态四键含哨兵且名称无「企业」；单协议合并仅一键、真实模型、无后缀；桥接态追加哨兵 |
| default-model.spec | 桥接判定、provider 归属、采纳决策（含用户自定义保护）、adopt 写入/对齐/端口缺失 |
| ui local-api.spec | builtinModels 只摘合法协议行；账号 bootstrap 仍不透出 models |
| builtin-models-section.spec | 行投影字段封闭、默认标记、缺 catalog 降级 |
| client.spec | 四个 slot 注册（含 settings.models.footer）与共享 store |
| bundle.spec | patch 不再停用三条 id；保留 agent-default-model 覆盖与 owndsh 行 |

## [S3] Out of Scope

- 控制台侧模型治理 UI（管理台已有能力不在本变更）
- 企业模型在配置页内的任何行内编辑或撤回入口
- 改动官方 `ui-settings-models`/`llm-pi-ai` 源码或其槽位契约
- 把企业路由伪装成 settings 命名空间以挤进官方卡片列表

## Tasks

- [x] T1: 恢复官方页与三条 provider — acceptance: cordis.patch 无 `disabled: true`，bundle.spec 断言翻转 (covers: S2.1)
- [x] T2: 默认哨兵稳态投影 + registration 同步接线 — acceptance: llm-gateway 22/22，稳态无哨兵、桥接态有 (covers: S2.1, S2.2)
- [x] T3: footer 内置只读区块与 builtinModels 取数 — acceptance: ui typecheck + 37/37，行投影封闭、无编辑控件 (covers: S2.2, S2.3)
- [x] T4: 设置入口改名「企业设置」 — acceptance: 源码/断言/文档零残留 (covers: S2.1)
- [x] T5: GEB 地图与规格回环 — acceptance: ui/llm-gateway/bundle CLAUDE 更新，本文件 status=delivered (covers: S2.4)
