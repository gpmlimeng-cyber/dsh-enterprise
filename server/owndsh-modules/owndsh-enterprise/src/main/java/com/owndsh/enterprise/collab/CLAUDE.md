# collab/

> L2 | 父级: ../../../../../../../CLAUDE.md

成员清单

EnterpriseCollabProperties.java: bootstrap 客户端宣告开关（enabled，默认 false）的部署边界，与 sessionPolicy 独立。
EnterpriseCollabConfiguration.java: collab 模块 composition root，装配 JDBC store、事务服务与开关。
domain/: ProjectStatus/ProjectMemberRole/CollabMessageKind 与 V31 check 同构的封闭枚举；局部地图见 domain/CLAUDE.md。
application/: 项目建/列/详、邀请/移出/转让、消息幂等发送与审计编排；局部地图见 application/CLAUDE.md。
persistence/: V31 三表的 PostgreSQL adapter；局部地图见 persistence/CLAUDE.md。
web/: runtime 项目/成员/消息与 SSE stream Controller 及严格 DTO；局部地图见 web/CLAUDE.md。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
