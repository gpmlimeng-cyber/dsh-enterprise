# domain/

> L2 | 父级: ../CLAUDE.md

成员清单

BrandingConfig.java: 品牌单行配置指针（tenant + organization_id 预留列 + 乐观 revision）。
BrandingDocument.java: 不可变发布快照，持有三个 LOGO 槽位外键与欢迎语文案及长度上限常量。
BrandingAsset.java: 已校验位图资产事实（含内容类型到扩展名的唯一映射）。
BrandingLogoSlot.java: LIGHT/DARK/SQUARE 封闭槽位词表，与三个外键列一一对应。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
