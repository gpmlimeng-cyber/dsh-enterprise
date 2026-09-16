# application/

> L2 | 父级: ../CLAUDE.md

成员清单

CollabException.java: 开关/项目/成员/消息校验失败的封闭稳定错误码。
CollabAuditMetadata.java: 五类 PROJECT/COLLAB 审计的显式无正文 metadata 白名单。
CollabService.java: 项目与消息短事务编排；postMessage 在项目行锁内分配 server_seq 并处理幂等冲突；消息不写入 Session Event。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
