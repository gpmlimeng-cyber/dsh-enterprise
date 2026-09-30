# 问题反馈功能 · 规格真源

> 状态：实施中（后台已派单；插件侧排队）｜日期：2026-09-30
> 来源：产品提供的小米反馈弹窗两张截图（问题态 / 建议态）

## 1. 表单字段（逐项固化）

| 字段 | 类型 | 必填 | 约束 | 备注 |
|---|---|---|---|---|
| `type` | 单选 | 是 | `issue`（问题，默认）/ `suggestion`（建议） | 切换类型会影响下一行显隐 |
| `occurredAt` | 日期+时间 | 否 | ISO-8601 带时区；默认提交时刻 | **条件字段：仅 `type==='issue'` 时显示**（图1 有、图2 无）；切到建议时隐藏且不提交 |
| `description` | 多行文本 | **是** | **≤510 字**，右下实时 `已输入/510` 计数 | 占位「请描述遇到的问题与复现步骤」 |
| `contact` | 单行文本 | 否 | 邮箱或手机号 | 占位「邮箱或手机号，便于回访」 |
| `attachments` | 图片列表 | 否 | **≤3 张**；PNG/JPEG/WebP；**显式拒 SVG**；单张 ≤2 MiB | 「添加图片」按钮 + **支持直接粘贴截图**；显示「已选 N 张」 |
| `consent` | 勾选框 | **是** | 必须为真 | 文案：内容与设备、版本、日志信息一并提交，用于定位问题 |
| `diagnostics` | 自动附带 | — | 白名单裁剪 | 插件版本 / 宿主版本 / OS / installationId / 最近错误码；**绝不含令牌、会话内容、文件路径** |

底部动作：`取消` / `提交`（提交中禁用并显示进度；成功给明确成功态；失败给可见原因，不静默）。

## 2. 与截图的差异（我们主动改的两处）

1. 截图写「提交到**小米官方**反馈通道，需登录**小米账号**」→ 我方改为「提交给**企业管理员**」；**需登录**（反馈归属员工）。
2. 其余交互（单选、计数、粘贴截图、同意勾选、两按钮）**照截图**。

## 3. 架构

```
ui 弹窗（浏览器，无令牌）
  → POST /enterprise/api/v1/local/feedback     （Host 代取 Access Token，照 usage-route.ts 范式）
  → POST /enterprise/api/v1/feedback           （中心，登录态，附件校验+存储）
  → PostgreSQL（反馈主表 + 附件表）+ 审计
管理端：console「反馈」页（列表 / 筛选 / 详情 / 状态流转 + 备注）
```

- 状态机：`new → triaged → resolved / ignored`；**状态变更写审计**
- 权限：`ent:feedback:read` / `ent:feedback:write` 类（只授 `enterprise_admin`）；**内置角色授权照 V17/V33 的 disable/enable trigger 范式**
- **新增管理端页面必须同时交付 F 型权限码 + C 型菜单节点**（V32 漏菜单节点导致侧栏无入口的教训）

## 4. 分期

- **一期**：提交 → 后台可处理（本规格 §1–§3）
- **二期（可选）**：「我的反馈」列表（员工查看自己提交记录与处理状态）

## 5. 未决

- 附件传输形态（base64 vs multipart）由后台实现按既有上传范式择一并在回报中说明理由
- 是否需要「我的反馈」二期入口：待产品确认

## 6. 员工端接口真源（2026-09-30 后台侧定型，插件侧照此实现，**不得自创字段**）

> 唯一真源：`contracts/paths/feedback.yaml#/RuntimeFeedbackSubmit`

- `POST /enterprise/api/v1/feedback`，**`multipart/form-data`**，**需登录**（沿用 `DeviceRequestContextResolver`：Harness Access Token → Sa-Token PlatformSession；未登录 **401 `ENT_AUTH_REQUIRED`**）。**提交者与 `installationId` 一律取服务端会话**——请求体里放提交者会被忽略。
- part `metadata`（`application/json`，`FeedbackSubmissionMetadata`）：

| 字段 | 必填 | 约束 |
|---|---|---|
| `description` | ✅ | 1..510 字 |
| `consent` | ✅ | 必须 `true`；false/缺失 → 400 `ENT_FEEDBACK_INVALID` |
| `type` | 否 | `issue` \| `suggestion`（缺省 `issue`） |
| `occurredAt` | 否 | ISO-8601，**必须带时区** |
| `contact` | 否 | 邮箱或手机号 |
| `diagnostics` | 否 | **键集封闭**：`pluginVersion`/`hostVersion`/`os`/`installationId`/`lastErrorCode`；服务端按白名单字段+正则裁剪，多余键无落点，令牌/路径入库前被拒 |

- part `attachments`：**同名可重复，最多 3 个**；PNG/JPEG/WebP 位图，**SVG 显式拒绝**；单张 **≤2 MiB**、单边 **≤8192px**（**魔数+尺寸**校验，不信任 `Content-Type`/扩展名）。
- header `Idempotency-Key`：**选填 UUID v4**；同一提交者重放同一键 → 返回既有反馈（不新建行、不重复审计）；非法值 → 400。
- 成功：`201 {"data":{"id","type","status":"new","occurredAt","attachmentCount","createdAt"},"requestId"}`
- 新增稳定错误码：`ENT_FEEDBACK_INVALID`(400)、`ENT_FEEDBACK_ATTACHMENT_INVALID`(400)、`ENT_FEEDBACK_ATTACHMENT_TOO_LARGE`(413)、`ENT_FEEDBACK_STATE_CONFLICT`(409，仅管理端状态流转)。
- 管理端（已交付，console 新增 `/feedback` 页）：`GET /enterprise/admin/v1/feedback`（keyset+status）、`GET .../{feedbackId}`、`POST .../{feedbackId}/status`（`If-Match` revision）、`GET .../{feedbackId}/attachments/{attachmentId}/content`。

### 插件侧随之确定的两点

1. **本地路由必须是 multipart 透传**：浏览器 → `POST /enterprise/api/v1/local/feedback`（Host 代取 Access Token）→ 中心。Host 应**流式/有界**转发，并在**本地就做同样的限流**（≤3 附件、≤2 MiB、位图魔数）以便尽早给出与中心一致的错误码，而不是把大文件推到中心才失败。
2. **`diagnostics` 由 Host 采集**（浏览器拿不到 Host 版本/installationId 的权威值）：键集严格限于上表五个；错误码从最近一次失败读取（如 `lastErrorCode`）；**绝不含令牌/路径**。

## 7. 交付记录与债务（2026-09-30）

**后台侧（server/console/contracts）已交付**：`V34__enterprise_feedback.sql`（两表 + F 型权限 + **C 型「问题反馈」菜单节点** + 审计四重登记 + `disable/enable trigger` 范式）· 员工/管理端 5 条路径 · 4 个新错误码（52 码/99 path/119 op）· 11 个 fixture（含 6 个负例：511 字、consent=false、diagnostics 夹带 token 与本地路径、4 附件、SVG、详情夹带 artifactRef）· console `/feedback` 页（角色矩阵 8 页）。门禁：服务端 compile SUCCESS、相关单测 31/31、契约 9/9 无漂移、console 68/68。

**债务（如实）**

| # | 债务 | 归属 |
|---|---|---|
| 1 | **V34 从未真实执行**（需 PostgreSQL/Testcontainers）→ 由下一次生产部署顺带验证（同 V32 的经验） | 部署时 |
| 2 | 既有跨语言 schema 分歧：`components/quota.yaml`(492/517/527/550) 与 `components/preset.yaml`(187) 的 `allOf` 各分支自带 `additionalProperties:false` → networknt 拒、Zod 过（`EnterpriseContractSchemaTest` 红） | **待指派**（涉用量/配方语义，Lead 未授权顺手改） |
| 3 | `plugin/packages/contracts/CLAUDE.md` 计数过期（45 fixture / 38 错误码） | 文档债 |
| 4 | 附件 CAS 在事务失败时可能留孤儿文件（与 branding 同行为）；附件只增不删、无 retention（一期口径） | 一期接受 |
| 7 | **管理端不能按「问题/建议」筛选**：`type` 已入库（`ck_ent_feedback_type`）、已在管理端视图返回与控制台显示（`feedback-editors.tsx:24-25` 问题/建议），但 `AdminFeedbackController:69` 只接受 `status`（`type` 未进查询参数，cursor scope 也只绑 status）。期望：列表支持 `type` 过滤，且 **cursor scope 必须同时绑定 type**（否则翻页会漏/串） | 待排（小改动：契约 query 参数 + Controller + Service + 控制台分段） |
| 6 | **畸形 multipart 落到 500「未知异常」**：`MultipartException` 未被 `GlobalExceptionHandler` 映射为稳定错误码（实测空/坏 body → `{"code":500}`）。期望：解析失败→400 `ENT_FEEDBACK_INVALID`；`SizeLimitExceededException`→413 `ENT_FEEDBACK_ATTACHMENT_TOO_LARGE` | 待修（小改动，下个后台版本） |
| 5 | console 反馈页仅纯 helper + 角色矩阵测试，**无 DOM 级集成测试** | 测试债 |
