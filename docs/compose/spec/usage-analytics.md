---
feature: usage-analytics
status: in-progress
updated: 2026-09-16
branch: feat/usage-analytics
commits: # filled at delivery
---

# 用量分析（Usage Analytics）

## Report

## [S1] Problem

控制台「活动记录 → 用量」目前只有 prompt-free ledger 明细表和单一 summary。管理员要回答「最近 30 天哪个模型/哪位成员最耗 Token、缓存命中如何、日趋势如何」时，只能翻页导出或直连数据库，缺少服务端聚合与对照视图。

社区插件 [dsh-all-usage](https://github.com/ParticleLight/dsh-all-usage) 展示了本地用量看板的可借鉴维度（时间范围、模型/成员分解、日趋势、缓存命中），但其数据真源是员工本机会话日志，且含 models.dev 成本估算——两者都与企业控制面不一致。

企业侧已有网关结算的 `ent_usage_ledger`（input/output/cache/total/charged + result），是组织用量的唯一权威；本特性**只增强用量分析**，不引入价格、金额、倍率、余额或供应商账单语义。

## [S2] Design

### S2.1 冻结决策

| 决策 | 选择 |
|---|---|
| 数据真源 | 控制面 `ent_usage_ledger`（网关已结算事实），不读员工本地会话 |
| 计费语义 | **不做**价格/成本/余额；只做 Token 与请求数分析 |
| 权限 | 复用 `ent:usage:read`（enterprise_admin / model_admin / auditor） |
| 产品落点 | 活动记录「用量」分段内增加「分析」视图，与「明细」并列 |
| 时区 | 与配额一致，使用部署时区 `ENT_DEPLOYMENT_TIME_ZONE` 的自然日分桶 |
| 范围上限 | 一次分析最长 180 天；默认近 30 天 |

### S2.2 Token / 结果口径（与 ledger 一致）

- 实测 Token：仅 `SETTLED` 行的 `input_tokens + output_tokens + cache_tokens`。
- 配额扣额：全部终态行的 `charged_tokens`（含 `CHARGED_MAX`）。
- 未知用量：`result ∈ {CHARGED_MAX, UNMEASURED}` 且实测 Token 为 0 的请求数，**不**伪装为实测 0。
- 缓存命中率：`cache / (input + cache)`，当 `input + cache = 0` 时为 null。
- 总处理量：`input + output + cache`（与现有 total 列一致；本产品无独立 reasoning 桶）。

### S2.3 协议

`GET /enterprise/admin/v1/usage/analytics`

| 参数 | 类型 | 说明 |
|---|---|---|
| `from` | date-time | 必填，含 |
| `to` | date-time | 必填，不含；`to - from ≤ 180d` |
| `userId` | 可选 | 过滤成员 |
| `modelId` | 可选 | 过滤受管模型 |

响应 `UsageAnalyticsResponse`：

```text
data:
  timezone: string                 # IANA，部署时区
  from, to: date-time
  summary:
    requests, settled, released, chargedMax, unmeasured: int64
    inputTokens, outputTokens, cacheTokens, totalTokens, chargedTokens: int64
    cacheHitRatio: number | null   # 0..1
  byDay: [{ date: YYYY-MM-DD, requests, inputTokens, outputTokens, cacheTokens, totalTokens, chargedTokens }]
  byModel: [{ modelId, alias, displayName, requests, inputTokens, outputTokens, cacheTokens, totalTokens, chargedTokens, cacheHitRatio }]
  byMember: [{ userId, username, displayName, requests, inputTokens, outputTokens, cacheTokens, totalTokens, chargedTokens }]
requestId
```

- `byDay` 按部署时区自然日连续填充（无数据日为 0），便于趋势图。
- `byModel` / `byMember` 按 `totalTokens` 降序；每维最多 50 行，超出在 summary 外另带 `truncated: true`（本期实现为截断并置位）。
- 不投影 prompt、provider 路径、凭据或 reservation 细节。
- 错误：`400` 时间非法/超窗；`403` 无 `ent:usage:read`。

不新增写操作、不改 ledger 表结构。

### S2.4 服务端

- 在 `quota` 纵向扩展：`UsageAnalyticsStore` + `JdbcUsageAnalyticsStore`（按部署时区 `date_trunc('day', created_at AT TIME ZONE …)` 聚合），复用 `UsageLedgerFilter`。
- `AdminUsageController` 或独立 `AdminUsageAnalyticsController` 暴露只读 GET。
- 无 Flyway；无新权限码。

### S2.5 控制台

活动记录「用量」分段：

| 视图 | 内容 |
|---|---|
| 分析（默认） | 时间范围快捷 7/30/90 天 + 自定义；可选成员/模型筛选；摘要卡（请求/实测总 Token/扣额/未知/缓存命中率）；日趋势条形（纯 CSS/SVG，无新图表依赖）；by 模型表；by 成员表 |
| 明细 | 现有 ledger 表（保留 summary） |

- 分析请求走生成的 `getUsageAnalytics`。
- 明细分页与筛选保持既有行为；分析视图的筛选独立。
- 权限不足时整段隐藏（与现逻辑一致）。

### S2.6 非功能

- 聚合 SQL 使用已有 `(user_id, created_at)` / `(model_id, created_at)` 索引；时间窗强制带上界。
- 不写缓存表；每次查询实时聚合（180 天量级在企业 ledger 规模可接受）。

## [S3] Out of Scope

- 价格表、成本估算、models.dev 同步、倍率、余额、套餐、账单
- 员工本机会话扫描 / dsh-all-usage 插件移植
- 53 周热力图、工作区别名、CSV 服务端导出（客户端可后续基于明细自行导出）
- 项目/部门虚拟结算与分账
- 修改 gateway 结算或 ledger 写路径
- 新权限码或角色

## Tasks

- [x] T1: OpenAPI 增加 `usage/analytics` path + schema，生成 contracts — acceptance: operation 可生成；错误码无新增；fixture 覆盖空窗与有数据窗 (covers: S2.3)
- [x] T2: `UsageAnalyticsStore` JDBC 聚合 + Admin GET + 单元/契约测试 — acceptance: 部署时区分日正确；SETTLED 与 CHARGED_MAX 口径正确；超 180 天 400；无权限 403 (covers: S2.2, S2.3, S2.4)
- [x] T3: 控制台用量分析视图 — acceptance: 默认进入分析；7/30/90/自定义切换生效；摘要/日趋势/模型/成员表渲染；可切回明细 (covers: S2.5)
- [x] T4: 文档 L2/L3 与功能清单回环 — acceptance: activity/quota L2 提及分析；功能地图出现用量分析 (covers: S2.1, S2.5)
