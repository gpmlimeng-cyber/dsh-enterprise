# web/

> L2 | 父级: ../CLAUDE.md

成员清单

ProjectWriteRequest.java: 建项目 name 写 DTO。
ProjectMemberRequest.java: 邀请/转让 userId 写 DTO。
CollabMessageRequest.java: 消息幂等键/kind/body/target 写 DTO。
CollabViews.java: 项目/成员/消息的字符串化 snowflake 安全投影。
RuntimeProjectController.java: ACTIVE 设备的项目治理、成员、消息与 SSE stream 入口。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
