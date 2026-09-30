# artifact/

> L2 | 父级: ../CLAUDE.md

成员清单

FeedbackAttachmentException.java: ENT_FEEDBACK_ATTACHMENT_INVALID 与 ENT_FEEDBACK_ATTACHMENT_TOO_LARGE 稳定错误边界。
FeedbackImageInspector.java: 复用 common/image 的字节级解析并叠加反馈单边像素上限，SVG 与未知格式一律拒绝。
FeedbackAttachmentStore.java: `.part` 有界写入/SHA-256、hash 互斥锁、原子 CAS 终结与受控路径解析；附件只增不删。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
