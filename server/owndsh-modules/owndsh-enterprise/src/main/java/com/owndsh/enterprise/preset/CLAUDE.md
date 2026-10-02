# preset/

> L2 | 父级: ../../../../../../../CLAUDE.md

成员清单

EnterprisePresetConfiguration.java: 配方服务端 composition root，装配 ZIP inspector、CAS 制品库、JDBC ports 与事务服务。
EnterprisePresetProperties.java: artifact root 与归档/entry 上限的部署配置边界。
artifact/: 不信任 .dshpreset 的单遍 ZIP 校验与内容寻址文件存储；局部地图见 artifact/CLAUDE.md。
domain/: package/version(含 dependencies 引用清单)/assignment/runtime 领域事实、引用形状规则与封闭状态机；局部地图见 domain/CLAUDE.md。
application/: 上传、发布口引用 fail-closed 校验、退休、可见范围原子替换、runtime 浏览与逐请求下载授权事务编排；局部地图见 application/CLAUDE.md。
persistence/: 配方 V30 表 + V39 dependencies 列的 PostgreSQL adapter、USER/ALL 可见解析与技能/插件引用解析查询；局部地图见 persistence/CLAUDE.md。
web/: 管理与 runtime Controller、严格 DTO、Range 下载和安全投影；局部地图见 web/CLAUDE.md。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
