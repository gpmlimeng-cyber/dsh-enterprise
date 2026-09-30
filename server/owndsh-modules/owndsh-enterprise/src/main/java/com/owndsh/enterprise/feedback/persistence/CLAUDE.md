# persistence/

> L2 | 父级: ../CLAUDE.md

成员清单

FeedbackStore.java: 反馈/附件只增读写、幂等键查询、倒序 keyset 列表与状态 CAS 的 DIP 端口。
JdbcFeedbackStore.java: 参数化 SQL、子查询附件计数、详情装载附件行与 revision CAS 的 PostgreSQL adapter。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
