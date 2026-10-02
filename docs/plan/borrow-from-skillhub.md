<!--
[INPUT]: 依赖 docs/research/iflytek-skillhub-integration.md 的实测结论（37 项对照表、四方案、
         不建议做的事、不确定性清单）与 docs/plan/enterprise-marketplace-phase2.md 的三场景/可见性口径。
[OUTPUT]: 给出「讯飞 SkillHub 可借鉴清单」四分类（直接可用 / 设计上值得抄 / 我们更强的 / 明令不要抄）
         与 P0–P2 优先级，并把每条映射到二期排期或明确不进。
[POS]: docs/plan 下的借鉴决策文档；只做取舍与映射，不重复调研证据（证据见 research 文档）。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 从讯飞 SkillHub 能借鉴什么

> 证据来源：`docs/research/iflytek-skillhub-integration.md`（987 行，全部为实际抓取，含 37 项逐条对照表）。
> 本文只做**取舍与映射**，不重复证据。

## 0. 一句话前提

它是**自托管「技能注册中心」，不是运行时**（官方原话「SkillHub 不执行技能」）。
技能最终仍要在客户端 Agent 侧落地 —— 而这条链我们**已经有**：
一键安装（实测 167ms）→ SHA-256 校验 → 原子升级 → 官方 watcher 免重启发现。
**所以对它是「吸收内容与治理概念」，不是「把能力面退到它那一档」。**

## 1. 可直接拿来用的（有明确落地路径）

| 借鉴点 | 它的做法 | 我们怎么用 | 人日 |
|---|---|---|---|
| 格式互操作 | 单技能扁平包（根级 `SKILL.md` + `references/ scripts/ assets/`） | 离线**双向转换器**：它的包 ↔ 我们的 `.dshskill` | 5–7 |
| 字段对齐（转换器第 0 步） | frontmatter `name`/`description` 与我们**天然兼容** | 把我们的 manifest 字段向它靠拢，换未来兼容 | 1–2 |
| 它的技能内容 | 内置 22 个官方技能 + 数万条公开记录 | 转换后**经我们自己的发布 + 分配闸门**进入，不直连订阅 | 含在上面 |

**为什么不直连它做服务端源**：耦合未冻结的第三方 API，且我们**没有内容安全扫描** —— 见 §4。

## 2. 设计上值得抄的（建议进二期）

1. **审核状态机**：它是 `DRAFT → PENDING_REVIEW → PUBLISHED → YANKED`；我们只有
   `VALIDATED → PUBLISHED → RETIRED`，**缺「待审」这一档** —— 这正好补上二期「申请 / 审批」缺的环节，
   比自造一个审批流更省。
2. **命名空间**：它用 `@namespace/slug` 坐标 + RBAC；我们是扁平 id，多团队会撞名。
   若二期做「按组织可见」，namespace 是现成模型（与 `subject_type` 扩 `DEPT`/`GROUP` 互补）。
3. **目录可匿名浏览**：它 `/api/v1/**` 公开可读（搜索 / 详情 / 下载）——
   这正是我们二期「**浏览自由 · 安装受控**」的现成先例：**目录查询与授权查询解耦**，
   不是我们发明的偏门设计。
4. **多技能套件**：Skill Suite 是**引用式**的（不复制文件）—— 与我们的「配方 / 套餐」概念合流：
   一个套件引用若干技能，各自独立升级。
5. **版本标签体系**：semver + `latest`/`beta`/`stable` 标签。我们的版本坐标
   `(skillId, sourceDshVersion)` 语义偏「目标 DSH 版本」，可以**并存一层面向用户的版本标签**
   （即我们正在做的版本签的下一步）。

## 3. 我们比它更强的（别被带偏）

| 维度 | 它 | 我们 |
|---|---|---|
| 完整性校验 | **无签名校验**（CLI 只限大小；`sha256`/`signature` 实测零命中） | SHA-256 强制校验 + 可选 Ed25519 |
| 并发控制 | **无乐观并发** | 包 / 版本两级 `revision` + `If-Match` |
| 幂等 | 有 `Idempotency-Key`（与我们撞名、语义一致） | 真正去重是内容寻址 `(tenantId, skillId, sourceDshVersion, sha256)`，更严 |
| 授权 | API Token **自认不满足最小权限** | 设备 `ACTIVE` 校验 + assignments 分配判定 |

## 4. 明令不要抄的

- 🔴 **不要把它 API 直接写进我们服务端**：v0.2.x、API 未冻结；且它文档自相矛盾
  （包大小上限在协议 / CLI 源码 / FAQ / Scanner 四处不一致）。
- 🔴 **不要做「订阅 + 自动发布」**：我们自己**没有内容安全扫描**，等于把供应链风险
  直接推给全员设备，且无人工闸门。
- 🔴 **不要在 Android 员工端引入它的 CLI / Node**：会绕过
  `/enterprise/api/v1/skills` 的 `ACTIVE` 设备校验与 assignments 分配，在授权模型上开洞。
- 🔴 **不要照抄它的粗粒度 token 与「无签名」**。
- ⚠️ **法务**：它内置技能中 3/22 是 CC-BY-SA-4.0（copyleft 传染）。
  转换器应**默认一票否决 + `--license-allowlist`**。

## 5. 优先级与落点

```text
P0（顺手就做，且直接服务二期）
  · 版本状态机加 PENDING_REVIEW 一档 → 服务二期「申请/审批」
  · 转换器落地时：字段映射作为第 0 步 + 许可 allowlist

P1（二期随行）
  · namespace（若要做按组织可见）
  · 版本标签（semver/tag）与目录检索解耦（浏览自由）

P2（可选）
  · 离线双向转换器本体（5–7 人日，方案见 research 文档 §5）
  · 多技能套件（引用式）与配方概念合流
```

## 6. 与另两份文档的关系

| 文档 | 关系 |
|---|---|
| `docs/research/iflytek-skillhub-integration.md` | **证据层**：本文所有结论的实测依据都在那里（§2 对照表、§3 四方案、§5 方案 A 规格、§7 不建议做的事） |
| `docs/plan/enterprise-marketplace-phase2.md` | **执行层**：本文的 P0/P1 项应并入二期排期；「审核状态机」与「申请/审批」是同一件事的两个说法 |

## 7. 不确定项

- 它的公开云**确切技能总数**未查到（接口不返回 total）。
- 「格式转换成功」≠「技能能在 Android DSH 上跑起来」：它自己声明技能依赖的
  Agent 专用工具 / MCP / 环境变量仍需单独验证；**实测样本大量依赖 python/API KEY/飞书 MCP**。
- 转换器落地前需过**法务**（CC-BY-SA）。
