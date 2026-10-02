# application/

> L2 | 父级: ../CLAUDE.md

成员清单

SkillCatalogService.java: 幂等上传（含包内多 SKILL.md 条目与包级 category 落库，且加新版本时按最新 manifest 刷新包级分类）、发布/退休、builtin/featured 标记 CAS 写入、可见范围全量原子替换与审计同事务编排。
SkillRuntimeService.java: ACTIVE 设备门禁下的可见技能列表/详情与逐请求下载授权。
SkillAuditMetadata.java: 六类技能审计 action 的非敏感 metadata 白名单。
SkillMutationContext.java: 管理写入所需的 tenant/actor/request 上下文。
SkillDisplayOverride.java: 上传时对 manifest 显示字段的可选覆盖。
SkillAccessException.java: ENT_SKILL_VISIBILITY_DENIED 与 ENT_SKILL_NOT_PUBLISHED。
SkillResourceNotFoundException.java: 技能资源不存在的 404 边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
