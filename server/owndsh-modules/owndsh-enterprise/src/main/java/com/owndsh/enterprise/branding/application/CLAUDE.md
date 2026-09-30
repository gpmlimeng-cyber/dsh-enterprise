# application/

> L2 | 父级: ../CLAUDE.md

成员清单

BrandingService.java: 公开只读投影、幂等资产上传、发布/回滚事务编排与审计同事务，历史 revision 只追加。
BrandingAuditMetadata.java: BRANDING_PUBLISHED/BRANDING_ROLLED_BACK 两类 action 的非敏感 metadata 白名单。
BrandingMutationContext.java: 管理写入所需的 tenant/actor/request 上下文。
BrandingResourceNotFoundException.java: 品牌资源不存在的 404 边界，同时阻止匿名枚举未发布资产。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
