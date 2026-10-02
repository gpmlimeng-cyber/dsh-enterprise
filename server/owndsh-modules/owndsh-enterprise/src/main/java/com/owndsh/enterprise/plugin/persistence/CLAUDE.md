# plugin/persistence/

> L2 | 父级: ../CLAUDE.md

成员清单

PluginStore.java: catalog、version CAS、assignment 优先级、主体存在性和 inventory replace 的持久化端口。
JdbcPluginStore.java: V2/V8/V40/V41 PostgreSQL adapter（V40 给 `ent_plugin_package` 加可空 description，V41 把该列的长度闸由 1..300 放宽到 1..1000），先裁决 USER→DEPT→ALL，再仅返回已发布版本或显式撤回；描述随 package 行一起读写（员工端目录因此拿得到卡片第二行的取值）；退休不再允许下载，也不意外回退到更宽范围。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
