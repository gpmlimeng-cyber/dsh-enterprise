# components/

> L2 | 父级: ../CLAUDE.md

成员清单

auth.yaml: 固定 public client、PKCE、登录事务、公开身份源、LOCAL 改密、Desktop code/refresh grants、管理端 Cookie exchange、logout 与无菜单 bootstrap schema 分片。
device.yaml: T05 enroll/heartbeat、设备详情、管理员 cursor list 与 revoke schema 分片。
identity.yaml: 身份治理 schema 分片，定义 OIDC/LDAP、目录发现/单人导入、JIT/LINK_ONLY、扁平产品用户组、外部组映射和删除确认，并复用根协议公共组件。
member.yaml: LOCAL 成员创建、产品成员 cursor/detail、固定角色、脱敏登录方式、设备/Session 摘要、状态/角色写入及一次性身份绑定 schema，不投影部门、岗位或原始 claims。
model.yaml: T08/P2-08A Harness providerKey/type/apiProtocol、reasoningEfforts 三态/compat、model/model set/grant 管理、writeOnly credential、脱敏模型发现与完整 bootstrap schema 分片。
quota.yaml: TOKEN/RATE 策略、四窗口与 prompt-free ledger；实测 Token、chargedTokens 配额扣额、unmeasuredRequests 未知请求，以及无价格字段的用量分析聚合 schema。**四个 `UsageAnalytics*` 行是摊平后的单一对象**（摊平理由见 skill.yaml 的同名条目）：曾是 `allOf: [UsageAnalyticsTokens, {...}]`，在严格 JSON Schema 语义下与各分支 `additionalProperties: false` 互斥而**永不可满足**，networknt 3.0.6 的 `unevaluatedProperties` 也**不跨 allOf 分支传播**（实测 43 → 43，仅措辞变化）。
gateway.yaml: 三协议共用的最小流式治理字段 schema，消息、工具、推理与回放保持原生透传。
plugin.yaml: compatibility、版本状态、catalog 完整 assignment 集合、runtime 下载事实（空 signatureBase64 表示未签名）和设备库存 schema 分片；保留旧字段并明确可见范围与显式撤回语义。
preset.yaml: dsh-preset v1 包/版本/ALL|USER 可见范围与 runtime 摘要/详情 schema，不投影 artifact 路径或包内 YAML。**`RuntimePresetDetail` 是摊平后的单一对象**（摘要 8 键 + `versionId`/`sha256`）。
skill.yaml: dsh-skill v1 技能包（管理端投影带 builtin/featured 标记与可选 category 分类）/版本/SKILL.md 条目/ALL|USER 可见范围/标记写入体与 runtime 摘要/详情 schema；**员工端 `RuntimeSkillSummary` 带 builtin 且为 required**（员工端「已安装」分组据此只显示非内置的已装行；featured 仍未贯通），category 为 string|null，条目仅投影 frontmatter 元数据与调用策略，不投影 artifact 路径或正文。

  ★ **`RuntimeSkillDetail` 已摊平为单一对象（勿改回 allOf）**：`allOf` + 各分支 `additionalProperties: false` 在严格 JSON Schema 语义下**两分支互斥**——`additionalProperties` 只看本分支，看不见兄弟分支声明的键，于是**任何** detail 都不可能通过 `EnterpriseContractSchemaTest`。曾试 `unevaluatedProperties: false` 替代，networknt 3.0.6 **实测不跨 allOf 分支传播**（错误 12 → 12，措辞由「未定义属性」变「未评估属性」），属自欺。摊平后封闭性**恢复且变严**（单一对象一次判完，多发一个未声明键必红）。摊平废掉的是「详情继承摘要」这个结构保证，代价是摘要键要人工同步两份——**该代价已由服务端 `RuntimeProjectionContractDriftTest.flattenedDetailKeepsSummaryKeySetPlusFixedExtension` 门禁接管**（断言详情键集 ⊇ 摘要键集，且差集恰为约定扩展键；摘要新增键而详情没跟上即红并逐字点名缺哪个键）。改摘要字段时**必须同步改详情**，否则这条门禁会拦。
session.yaml: 官方 rc.7 format v0 header、精确 JSONL/hash、本人/admin metadata、正文页、tombstone 与恢复审计 schema 分片。
branding.yaml: 公开品牌白名单与管理端品牌/revision/资产/发布/回滚 schema，公开面不含资产 ID、organization 或 artifact 路径。
feedback.yaml: 反馈类型/状态、封闭 diagnostics 白名单、multipart 提交 metadata/form、提交回执与管理端列表项/详情/附件/状态流转 schema，不投影 artifact 路径与内容哈希。
audit.yaml: 46-action 枚举（口径：以服务端 `audit/AuditAction.java` 的 `AuditAction.values()` 实测 46 项为准，契约 enum 逐字对齐并保持同序）、封闭 metadata 与 cursor；模型传输失败可携带已实测结算，明确拒绝可 RELEASED，恢复可由 usage 快照 SETTLED，反馈提交/状态流转各有专属 metadata。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
