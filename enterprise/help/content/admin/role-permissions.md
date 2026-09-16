---
title: 角色与权限矩阵
audience: admin
order: 14
summary: 四个企业角色分别能做什么，以及"某个人看不到某个菜单/接口 403"时该怎么判断。
verifiedAt: 2026-09-16
sourceRefs:
  - server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V4__enterprise_audit.sql
  - server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V19__product_member_read_permission.sql
  - server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V20__product_member_management.sql
  - server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V23__product_usage_read_permission.sql
uiLabels: [成员, 角色]
status: draft
---

# 角色与权限矩阵

DSH Enterprise 的控制台权限是**固定角色 + `ent:*` 权限码**，没有可自由编排的权限树或菜单树。
一个人能否看到某个菜单、能否调用某个接口，只取决于**他的角色聚合出的权限码集合**。

> 💡 下表的权限码来自**运行中的实例**（内置角色与权限不可随意修改），由文档构建期从数据库读出，
> 因此它反映的是"你此刻这套系统"的真实配置，而不是设计稿。

<!-- generated:role-permissions -->
<!-- 构建期替换为：角色 × ent:* 权限矩阵表 + 数据来源 + 采样时间；禁止手工编辑本区 -->
<!-- /generated -->

## 三个容易混淆的点

### 1. 员工（`employee`）没有 `ent:*` 权限，这是正常的

员工不在管理端工作，走的是**员工端 API**（`/enterprise/api/v1`）与**模型网关**（`/enterprise/gateway/v1`），
用设备绑定的 Token 认证，不经过 `ent:*` 权限判定。所以矩阵里员工的 `ent:*` 数量为 0 并不代表"没有权限"。

### 2. `superadmin` 与 `test1` / `test2` 不参与企业权限

它们是企业模块接管前遗留的宿主角色（超级管理员、本部门及以下、仅本人）。
在企业治理面里，它们的有效 `ent:*` 权限同样是 0——**不要用它们做企业管理员**，请使用「企业管理员」角色。

### 3. 「审计员」被刻意收窄过

审计员的定位是**只读的合规视角**：可以看到审计事件、会话元数据/正文与用量，
但**不能**读取模型、授权与设备管理接口。这不是配置疏漏，而是上游在权限迁移中主动收回的（见 `sourceRefs` 中的 V23 迁移）。

## 排查"他为什么看不到 / 403"

按顺序检查：

1. **角色对不对**：操作路径 成员 → 打开该成员 → 查看固定角色。
2. **权限够不够**：对照上表，确认该角色是否包含目标操作所需的 `ent:*` 码。
   每个 API 操作需要哪个权限码，可直接查 API 参考里该操作标出的 `权限` 字段。
3. **是不是身份/授权问题而不是权限问题**：员工"登录后看不到模型"通常是**模型授权**缺失，
   不是角色权限缺失——配额策略也不能代替访问授权。见《模型访问授权》。
4. **是不是设备/会话问题**：设备被撤销、成员被停用后，历史会话会失效，表现可能是 401 而不是 403。

## 相关

- API 参考：[控制台会话](/api-docs/#tag/控制台会话)（`bootstrap` 会返回当前账号的权限清单）
- 相邻篇目：《用量、审计与 requestId 关联排查》《成员治理：状态、固定角色、身份链接》
