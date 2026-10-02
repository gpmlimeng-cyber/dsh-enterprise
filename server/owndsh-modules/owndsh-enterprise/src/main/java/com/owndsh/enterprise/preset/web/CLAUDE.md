# web/

> L2 | 父级: ../CLAUDE.md

成员清单

AdminPresetController.java: `ent:preset:*` 保护的 catalog list、multipart 上传、publish/retire 与 visibility batch。
RuntimePresetController.java: ACTIVE 设备入口的可见列表/详情与带 nosniff 的授权下载。
PresetViews.java: 管理/runtime 响应的安全投影，不暴露 artifact 路径；dependencies 由管理与 runtime（摘要+详情）共用同一 DependencyView，latest 的空 versionId 靠 NON_NULL 缺席而不是 null；runtime 详情只输出契约声明字段（一期遗留的 downloadPath 已删，下载 URL 由客户端用 versionId 拼）。
PresetAssignmentBatchRequest.java: 可见范围全量替换请求 DTO。
PresetUploadMetadata.java: 上传时可选覆盖 manifest 显示名/描述的 multipart JSON part。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
