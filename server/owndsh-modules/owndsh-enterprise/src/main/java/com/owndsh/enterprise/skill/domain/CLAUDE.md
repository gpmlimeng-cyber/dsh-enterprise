# domain/

> L2 | 父级: ../CLAUDE.md

成员清单

SkillEntry.java: 单个 SKILL.md 的 frontmatter 脱敏投影与调用策略，不含技能正文。
SkillPackage.java: 技能包身份与 ACTIVE/DISABLED 状态，revision 供 CAS。
SkillVersion.java: VALIDATED→PUBLISHED→RETIRED 版本、内容寻址制品与包内技能条目集合。
SkillAssignment.java: ALL/USER 可见范围事实，无 DEPT 与 required 字段。
RuntimeSkill.java: 员工只读投影，package 与最新 PUBLISHED 版本联合，不含 artifact 路径。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
