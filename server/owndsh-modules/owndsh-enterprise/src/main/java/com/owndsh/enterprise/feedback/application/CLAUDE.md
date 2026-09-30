# application/

> L2 | 父级: ../CLAUDE.md

成员清单

FeedbackService.java: 提交（幂等键重放、附件 CAS、主行+附件行同事务、FEEDBACK_SUBMITTED 审计）、keyset 列表、详情、状态 CAS 流转与授权附件解析。
FeedbackAuditMetadata.java: FEEDBACK_SUBMITTED 与 FEEDBACK_STATUS_CHANGED 的白名单 metadata，只投影 ID/类型/附件数/前后状态，正文与诊断永不入审计。
FeedbackMutationContext.java: 管理写事务的 tenant/actor/requestId/sourceIp/userAgentHash 可信上下文。
FeedbackNotFoundException.java: ENT_RESOURCE_NOT_FOUND 的 404 边界，跨 tenant 枚举与真实不存在共用同一响应。
FeedbackStateConflictException.java: ENT_FEEDBACK_STATE_CONFLICT 的 409 状态机冲突边界，区别于 revision 并发冲突。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
