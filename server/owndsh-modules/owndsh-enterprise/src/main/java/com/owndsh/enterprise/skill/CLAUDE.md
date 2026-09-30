# skill/

> L2 | 父级: ../../../../../../../CLAUDE.md

成员清单

EnterpriseSkillConfiguration.java: 技能服务端 composition root，装配 ZIP inspector、CAS 制品库、JDBC ports 与事务服务。
EnterpriseSkillProperties.java: artifact root 与归档/entry 上限的部署配置边界。
artifact/: 不信任 .dshskill 的单遍 ZIP 校验（含 SKILL.md frontmatter 解析）与内容寻址文件存储；局部地图见 artifact/CLAUDE.md。
domain/: package/version/assignment/runtime 与包内技能条目事实；局部地图见 domain/CLAUDE.md。
application/: 上传、发布、退休、可见范围原子替换、runtime 浏览与逐请求下载授权事务编排；局部地图见 application/CLAUDE.md。
persistence/: 技能 V35 表的 PostgreSQL adapter、skills jsonb 映射与 USER/ALL 可见解析查询；局部地图见 persistence/CLAUDE.md。
web/: 管理与 runtime Controller、严格 DTO、Range 下载和安全投影；局部地图见 web/CLAUDE.md。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
