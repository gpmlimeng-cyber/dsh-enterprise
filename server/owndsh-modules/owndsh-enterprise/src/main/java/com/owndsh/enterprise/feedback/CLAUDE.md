# feedback/

> L2 | 父级: ../../../../../../../CLAUDE.md

成员清单

EnterpriseFeedbackConfiguration.java: 反馈纵向 composition root，装配位图 inspector、CAS 附件库、JDBC 端口与 FeedbackService。
EnterpriseFeedbackProperties.java: feedback artifact root、单张附件字节上限（默认 2 MiB）与单边像素上限（默认 8192）部署配置边界。
domain/: 类型/状态 wire↔database 双向映射、白名单诊断收窄、提交校验与聚合不变量；局部地图见 domain/CLAUDE.md。
application/: 员工提交编排、管理端列表/详情、冻结链路状态流转与审计 metadata；局部地图见 application/CLAUDE.md。
artifact/: 只接受位图的魔数/尺寸闸门与内容寻址附件存储；局部地图见 artifact/CLAUDE.md。
persistence/: V34 两表的 PostgreSQL adapter、tenant 隔离 keyset 查询与状态 CAS；局部地图见 persistence/CLAUDE.md。
web/: 员工 multipart 提交与管理端列表/详情/状态/附件内容 Controller 与严格投影；局部地图见 web/CLAUDE.md。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
