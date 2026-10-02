# persistence/

> L2 | 父级: ../CLAUDE.md

成员清单

PresetStore.java: 配方 catalog/version/assignment 与 runtime 可见查询端口，外加 required 引用解析端口。
JdbcPresetStore.java: V30/V39 表的 PostgreSQL adapter（dependencies jsonb 序列化）、USER 优先于 ALL、技能/插件引用解析查询。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
