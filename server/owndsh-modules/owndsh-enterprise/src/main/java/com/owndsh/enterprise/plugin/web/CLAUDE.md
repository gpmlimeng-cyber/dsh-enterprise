# plugin/web/

> L2 | 父级: ../CLAUDE.md

成员清单

PluginAssignmentBatchRequest.java: 最多 200 条原子 assignment replacement 请求与领域约束转换。
PluginInventoryRequest.java: 最多 500 条 runtime inventory replacement 请求与观测时间转换。
PluginViews.java: 未签名制品统一投影为空 signatureBase64；含完整 assignments 的 package catalog、runtime 与 inventory 统一脱敏 HTTP 投影；**runtime 分配投影带必填 `displayName`（1..120，员工端卡片标题；契约必填、服务端永不为空，故**不**加 NON_NULL）**；**可选 description 用 `@JsonInclude(NON_NULL)` 只注解 description 那一个分量——没有描述时整个键缺席（契约与两端 strict Zod 都拒 null），而同记录里 required+nullable 的 `downloadUrl` 照旧原样发**。
AdminPluginController.java: ent:plugin 权限保护的 catalog、上传、发布、退休、分配和设备库存入口。
RuntimePluginController.java: ACTIVE Harness 设备的分配、重新授权且禁止 MIME sniff 的单 Range 下载和 inventory 上报入口。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
