# artifact/

> L2 | 父级: ../CLAUDE.md

成员清单

SkillArtifactException.java: ENT_SKILL_INVALID_PACKAGE 与 ENT_SKILL_TOO_LARGE 稳定错误边界。
SkillArtifactInspector.java: 单遍 ZIP 验包闸门，校验路径安全、manifest 必填字段、包内每个 SKILL.md 的 frontmatter（name/description/whenToUse/调用策略）与旧字段拒收，不解压到文件系统。
SkillArtifactStore.java: `.part` 有界写入/SHA-256、hash 锁、原子 CAS 终结与受控读取定位。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
