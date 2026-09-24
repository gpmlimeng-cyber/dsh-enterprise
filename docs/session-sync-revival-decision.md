<!--
[INPUT]: 依赖 T16 服务端验收事实、owndsh-governance-mvp-design.md §12/§16.4、v1-product-feature-catalog.md §10 原闸门、锁定 Harness 0.1.1-rc.2 Session/Persistence 能力，以及 2026-09 公开生态调研（个人向 Git 会话同步插件存在，企业 Server 复制仍无）。
[OUTPUT]: 记录 Session 同步重新列入产品范围的四闸决议、默认关闭策略、与 V1 发布门禁的关系，以及客户端点亮实施包边界。
[POS]: Session 同步从「V1 隐藏停用且不得开发」变为「已过评审、允许按包开发、默认关闭、不挡 V1 发布」的制度真源；功能清单 §10 引用本文件。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md / v1-product-feature-catalog.md
-->

# Session 同步重新启用决议

状态：`decision-approved-client-track`  
决议日期：2026-09-16（Asia/Shanghai）  
适用基线：官方 DeepSeek Harness Desktop `0.1.7-rc.1`。2026-09-16 决议当时核对的是社区 Desktop `2.0.3` / Harness `0.1.1-rc.2`。  
服务端事实：T16 已完成（`t16-session-server-acceptance.md`）  
功能清单关联：`v1-product-feature-catalog.md` §10

---

## 1. 背景

V1 产品清单曾规定：Session 同步不是 V1 功能，客户端不得实例化同步服务、不得扫描/上传/恢复远端会话；只有重新完成隐私、保留期、跨设备冲突和产品价值评审后，才允许重新列入产品范围。

本文件即该评审的决议记录。评审对象不是「是否重写 T16 服务端」，而是 **是否允许点亮客户端并作为可选企业能力交付**。

---

## 2. 产品价值（闸门 4）

| 项 | 决议 |
|---|---|
| 用户问题 | 员工换电脑后，希望像 IM 一样从会话列表恢复并继续任务 |
| 竞品/生态 | 社区已有个人向 Git 会话同步；**没有**「企业账号 + 服务端密文 + 权限审计 + 换机恢复」的完整方案 |
| 与 V1 主价值关系 | 不替代身份/模型/配额/插件；是设备治理与「员工环境可迁移」的延伸 |
| 是否必须进 V1 发布门禁 | **否**。V1 发布门禁继续验证「默认关闭、零 Session 请求」 |
| 是否允许单独交付 | **是**。作为旁路能力包，独立开关与验收 |

**结论**：值得做；**不并入 V1 发布门禁**，以免拖死已冻结的 scope-frozen 路径。

---

## 3. 隐私与安全（闸门 1）

沿用 T16 与治理设计 §12.3，不新开密文或日志通道：

| 约束 | 决议 |
|---|---|
| 正文存储 | 仅服务端 AES-GCM（T16）；客户端不另建明文云端 |
| 员工可见范围 | 仅本人 ACTIVE 副本列表与本人恢复 |
| 管理解密 | 须独立权限 `ent:session:content:read`，并写 `SESSION_CONTENT_READ` 审计 |
| 普通日志/审计 metadata | **禁止**进入 Session 正文、标题原文、事件行 |
| 模型 Key / 平台 Token | **永不**随 Session 同步；继续走企业网关与 credentials 边界 |
| 上传源 | 仅官方本地 Session 持久化后缀；不上传附件字节、源码、Git 状态、终端进程（恢复侧同样不下载） |

---

## 4. 保留期（闸门 2）

| 项 | 决议 |
|---|---|
| 服务端默认 | 维持 T16 **90 天**未更新 ACTIVE → `EXPIRED`（清正文、留 tombstone） |
| 员工删除 | `DELETED` tombstone；禁止后台自动重传复活正文 |
| 可配性 | `retentionDays` 已在 `sessionPolicy`；部署可调，**本次不扩新表** |
| 本地恢复副本 | 恢复后按普通本地会话生命周期；与远端 90 天策略解耦 |

---

## 5. 跨设备冲突（闸门 3）

| 项 | 决议 |
|---|---|
| 写模型 | **一源一写**：`(tenant, owner, sessionId)` 绑定首次 ACTIVE source device |
| 他机写入 | `ENT_SESSION_SOURCE_DEVICE_CONFLICT`，进入人工可见终态，不自动重试 |
| 换机续聊 | **不**对同一 remote sessionId 继续 append；导出后 `create` **新本地 ID**（`parentSession` 指源） |
| 是否做多端实时同 ID 写 / fork 租约 | **本决议不做**。与微信「双端同时写同一会话」不对齐；若未来需要，单独立项 |
| 社区 Git 三方合并插件 | **不**作为企业真源；可作体验参考，不进 Server 协议 |

**产品话术**：换设备 = 登录企业账号 → 会话列表 → 恢复到本机工作目录 → 以**新本地会话**继续；服务器原记录只读。

---

## 6. 与 V1 清单的关系

| 文档点 | 决议后语义 |
|---|---|
| §10「不是 V1 产品功能」 | **仍成立**：不挡 V1 发布 |
| §10「评审后才允许列入」 | **本文件完成评审**；允许按 §7 实施包开发 |
| 默认关闭 | **保持**：`sessionPolicy.enabled=false`（bootstrap） |
| §12.1「Session 停用」门禁 | **V1 路径保留**：enabled=false 时零 Session API |
| §13「V1 明确不做」 | 仍不进 **V1 发布范围**；旁路包见本文件，不写回 V1 交付清单的「已实现」列 |

换言之：**决议 = 开发授权 + 默认关闭，不是把 Session 同步塞进当前 V1 发布列车。**

---

## 7. 允许的实施包（边界）

只允许下列顺序开包；禁止在未开包目录混写企业 Session 逻辑：

| 包 | 内容 | 验收要点 |
|---|---|---|
| P1 服务端/开关 | `BootstrapView.SessionPolicy.enabled` 改为部署可配；确认 runtime Session 路由仍注册 | 配置 true/false 时 bootstrap 正确；false 时行为与 V1 一致 |
| P2 客户端同步 | 新建 `@dshent/session-sync`（设计 §16.4）：dirty → debounce → flush/readFrom → 批上传 → 游标 | 网络不进 append 路径；终态集合；单 worker |
| P3 本地 API + UI | platform-client：`/sessions/sync`、`/sessions`、`/sessions/{id}/copies`；ui：恢复 session tab | enabled=false 时不渲染、不发请求 |
| P4 测试 | 开关双向 + 双「设备」恢复续聊 E2E | V1 门禁在 false 分支仍全绿 |
| P5 文档 | 员工换机三步；管理员开关/保留/权限 | 与 config-manager 边界写清 |

**明确不做（本决议范围外）**：附件/源码/终端同步；同 ID 多端写；用 `dsh-config-manager` 的 portable 同步冒充会话续接。

---

## 8. 默认关闭时的不变量（仍为硬约束）

当 `sessionPolicy.enabled=false`（V1 默认）：

1. bundle **不**实例化 Session 同步服务  
2. 客户端 **不**扫描本地 Session、**不**上传/恢复/删除远端 Session  
3. 企业设置 **无**「会话同步」tab；控制台 **无** Session 分段  
4. 登录与模型调用路径 **零** Session API 请求（既有自动化断言保留）

`enabled=true` 时，上述 1–4 按实现包放行，并新增独立门禁（见 P4），**不得**削弱 enabled=false 分支。

---

## 9. 决议摘要

| 闸门 | 结果 |
|---|---|
| 产品价值 | 通过（旁路能力，可选交付） |
| 隐私 | 通过（沿用 T16 + 权限/审计） |
| 保留期 | 通过（90 天 + tombstone，可配） |
| 跨设备冲突 | 通过（一源一写 + 新 ID 恢复；不做同 ID 多写） |

**最终决定**：

1. **允许**按 P1–P5 点亮客户端；  
2. **默认仍关闭**；V1 发布门禁不改；  
3. 真源变更写入 `v1-product-feature-catalog.md` §10（指向本文件）；  
4. 技术细节仍以 `owndsh-governance-mvp-design.md` §12 / §16.4 为准；  
5. 完成独立验收后，再单独更新状态为 `delivered-optional-capability`。

---

## 10. 品味自检

- **核心实现**：用一页决议打开开发闸，而不是改 T16 协议或把功能塞进 V1 发布清单。  
- **品味自检**：默认关闭与「恢复新 ID」把合规风险和双写复杂度都挡在门外；和 config-manager / 社区 Git 插件的边界写死，避免第二真源。  
- **改进建议**：P2 开工前再 lock 一次 rc.2 `dsh-session` / `sessionPersistence` 公开方法名，避免设计符号与 peer 实现漂移。
