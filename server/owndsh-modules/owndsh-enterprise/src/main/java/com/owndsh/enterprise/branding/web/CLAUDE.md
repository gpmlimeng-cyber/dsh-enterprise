# web/

> L2 | 父级: ../CLAUDE.md

成员清单

PublicBrandingController.java: 免登录品牌 JSON（ETag + 60 秒公开缓存 + 304）与按发布 revision 限定的不可变位图路由。
AdminBrandingController.java: `ent:branding:*` 保护的当前发布、revision 历史、multipart 上传、未发布资产预览与发布/回滚动作。
BrandingViews.java: 公开白名单视图与管理端视图两组安全投影，管理端才输出资产 ID 与预览 URL。
BrandingPublishRequest.java: 发布请求 DTO，字符串雪花资产 ID 转领域 draft。
BrandingRollbackRequest.java: 回滚请求 DTO，只接受正整数目标 revision。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
