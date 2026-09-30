# persistence/

> L2 | 父级: ../CLAUDE.md

成员清单

BrandingStore.java: 品牌配置 CAS、发布文档历史、资产注册与已发布引用查询端口。
JdbcBrandingStore.java: V32 三表的 PostgreSQL adapter；公开资源查询在单条语句内联结当前发布 revision。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
