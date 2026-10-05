# skill/

> L2 | 父级: ../CLAUDE.md

成员清单

artifact/SkillArtifactInspectorTest.java: 纯 JVM 锁定 .dshskill manifest 必填、可选 category 口径（缺失/null/空串归一，超长与纯空白拒绝）、路径逃逸/旁路目录拒绝、SKILL.md frontmatter 必填与调用策略、旧字段拒收、包内重名拒绝与 entry 上限；不依赖容器。
web/SkillMarksRequestTest.java: 纯 JVM 锁定 builtin/featured 必填与两标记互相独立；不依赖容器。
web/SkillMarksEndpointTest.java: 纯反射锁定标记接口的 POST /{packageId}/marks 映射、ent:skill:write 与 Idempotency-Key/If-Match 必需头。
application/SkillMarksIntegrationTest.java: 真 PostgreSQL 覆盖迁移默认值、标记 CAS 与投影、runtime「assignment∪builtin」可见性并集与 RETIRED 拦截，以及 builtin 在员工端摘要/详情两处的投影（同时造 builtin=true 无 assignment 与 builtin=false 靠 ALL assignment 两个包，证明既不依赖 assignment 才可见、也不是恒 true 占位值）。★ 已知基线红：`builtinPackageWithoutAssignmentIsVisibleToListDetailAndDownload` 的 `verify(requireActive)` 只期望 1 次而实际 3 次（list+detail+download 各一次），该失败在改动前的干净树上同样复现，与 skill 投影无关。
application/SkillCategoryIntegrationTest.java: 真 PostgreSQL 覆盖 category 列形状与空白约束、manifest 经上传落库、包级分类随新版本刷新、管理端与员工端（摘要/详情）两处投影的字符串与 null 形状、以及无分类包的既有上传/发布/分配/可见性回归。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
