# domain/

> L2 | 父级: ../CLAUDE.md

成员清单

SkillEntry.java: 单个 SKILL.md 的 frontmatter 脱敏投影与调用策略，不含技能正文。
SkillPackage.java: 技能包身份、builtin（默认对员工可见）/featured（仅标记）/category（可选分类，null 表示没有分类）与 ACTIVE/DISABLED 状态，revision 供 CAS。
SkillVersion.java: VALIDATED→PUBLISHED→RETIRED 版本、内容寻址制品与包内技能条目集合。
SkillAssignment.java: ALL/USER 可见范围事实，无 DEPT 与 required 字段。
RuntimeSkill.java: 员工只读投影，package（含包级可选 category 与包级 builtin 标记）与最新 PUBLISHED 版本联合，不含 artifact 路径。builtin 是包级真值的只读投影（供员工端「已安装」分组），**不**参与可见性裁决——那由 SkillStore 的 assignment ∪ builtin 并集负责。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
