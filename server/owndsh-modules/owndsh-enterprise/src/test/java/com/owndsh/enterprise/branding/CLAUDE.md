# branding/

> L2 | 父级: ../../../../../CLAUDE.md

成员清单

artifact/BrandingImageInspectorTest.java: 手工构造 PNG/JPEG/WebP 头部，锁定宽高提取与 SVG/GIF/截断/超大单边的 fail-closed 拒绝（现经 common/image 解析器）。
application/BrandingServiceTest.java: 以内存 BrandingStore 假实现验证首发布、CAS 冲突、回滚追加新 revision、草稿校验、已发布资产定位与两类审计 metadata。
web/BrandingViewsTest.java: 用 JSON 序列化结果证明公开视图不含资产 ID/组织/artifact 路径，管理端视图才输出 ID 与预览 URL。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
