# web/

> L2 | 父级: ../CLAUDE.md

成员清单

RuntimeFeedbackController.java: `POST /enterprise/api/v1/feedback` 登录 multipart 入口，提交者与 installation 取自已认证会话，返回 201。
AdminFeedbackController.java: `ent:feedback` 保护的 keyset 列表（cursor 绑定状态筛选）、详情、If-Match 状态流转与鉴权附件流。
FeedbackSubmissionRequest.java: multipart metadata JSON part 的严格 DTO，收敛 type 缺省与带时区 occurredAt 解析错误。
FeedbackStatusChangeRequest.java: 状态流转请求体，只接受目标状态与可选备注。
FeedbackViews.java: 提交回执、列表项、详情与附件四组安全投影，只输出管理端鉴权 URL 与白名单诊断字段。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
