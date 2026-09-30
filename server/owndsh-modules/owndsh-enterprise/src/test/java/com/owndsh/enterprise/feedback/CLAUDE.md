# feedback/

> L2 | 父级: ../../CLAUDE.md

成员清单

domain/FeedbackDomainTest.java: 纯 JVM 验证 wire↔database 映射、冻结转移链、同意/描述/联系方式校验、诊断正则收窄与聚合不变量。
application/FeedbackServiceTest.java: 以内存 FeedbackStore 假实现 + 真实 CAS 附件库验证会话归属、提交默认值、幂等重放、附件闸门、状态 CAS 与审计动作。
web/FeedbackViewsTest.java: 以 JSON 序列化结果证明附件只输出鉴权 URL、不含 artifact 路径与内容哈希，并锁定提交 DTO 的类型缺省与时区校验。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
