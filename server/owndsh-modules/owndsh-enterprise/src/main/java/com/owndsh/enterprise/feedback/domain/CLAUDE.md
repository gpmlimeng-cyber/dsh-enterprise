# domain/

> L2 | 父级: ../CLAUDE.md

成员清单

FeedbackType.java: issue/suggestion 的 wire 值与 ISSUE/SUGGESTION 数据库值的双向映射，缺省 issue、未知值拒绝。
FeedbackStatus.java: new/triaged/resolved/ignored 双向映射与冻结转移规则（new→triaged→resolved|ignored），终态不可再流转。
FeedbackDiagnostics.java: 五个白名单键的封闭诊断值，字段级正则使令牌、路径与自由文本无法进入持久层。
FeedbackValidationException.java: ENT_FEEDBACK_INVALID 稳定错误码与只描述字段规则的拒绝消息。
FeedbackSubmission.java: 提交内容真源，冻结 510 字描述、必须同意、邮箱/手机号联系方式与最多 3 个附件常量。
FeedbackAttachment.java: 已校验入库的位图附件事实，不暴露 artifact 路径。
FeedbackRecord.java: 反馈聚合真源，列表投影用 attachmentCount 表达附件数并强制 NEW 行无处置痕迹、已处置行必有处置人/时间。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
