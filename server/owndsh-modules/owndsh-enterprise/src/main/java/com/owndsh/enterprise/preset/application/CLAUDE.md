# application/

> L2 | 父级: ../CLAUDE.md

成员清单

PresetCatalogService.java: 幂等上传、发布/退休、可见范围全量原子替换与审计同事务编排。
PresetRuntimeService.java: ACTIVE 设备门禁下的可见配方列表/详情与逐请求下载授权。
PresetAuditMetadata.java: 五类配方审计 action 的非敏感 metadata 白名单。
PresetMutationContext.java: 管理写入所需的 tenant/actor/request 上下文。
PresetDisplayOverride.java: 上传时对 manifest 显示字段的可选覆盖。
PresetAccessException.java: ENT_PRESET_VISIBILITY_DENIED 与 ENT_PRESET_NOT_PUBLISHED。
PresetResourceNotFoundException.java: 配方资源不存在的 404 边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
