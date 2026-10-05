# persistence/

> L2 | 父级: ../CLAUDE.md

成员清单

SkillStore.java: 技能 catalog/version/assignment/标记/包级 category CAS 与 runtime 可见查询端口。
JdbcSkillStore.java: V35/V36/V37 表的 PostgreSQL adapter，category 读写、skills jsonb 读写与 assignment∪builtin 可见并集。两条 runtime 查询（列表与按 id）的 select 列表同时带出 p.category 与 p.builtin，故 builtin 既进 where 谓词（并集可见性）又进投影（员工端分组）；`findPublishedVersionForUser` 只用谓词、不投影（下载面无此概念）。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
