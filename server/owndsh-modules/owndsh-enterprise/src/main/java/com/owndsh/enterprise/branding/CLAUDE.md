# branding/

> L2 | 父级: ../../../../../../../CLAUDE.md

成员清单

EnterpriseBrandingConfiguration.java: 品牌服务端 composition root，装配位图 inspector、CAS 资产库、JDBC 端口与事务服务。
EnterpriseBrandingProperties.java: artifact root、单文件字节上限与单边像素上限的部署配置边界。
artifact/: 只接受位图的魔数/尺寸校验与内容寻址文件存储；局部地图见 artifact/CLAUDE.md。
domain/: 品牌配置指针、不可变发布文档与资产事实；局部地图见 domain/CLAUDE.md。
application/: 公开只读投影、幂等资产上传、发布与回滚事务编排；局部地图见 application/CLAUDE.md。
persistence/: 品牌 V32 三表的 PostgreSQL adapter 与已发布引用解析；局部地图见 persistence/CLAUDE.md。
web/: 免登录公开只读 Controller 与管理 Controller、严格 DTO 和安全投影；局部地图见 web/CLAUDE.md。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
