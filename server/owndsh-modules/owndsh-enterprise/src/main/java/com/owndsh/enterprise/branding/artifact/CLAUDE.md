# artifact/

> L2 | 父级: ../CLAUDE.md

成员清单

BrandingAssetException.java: ENT_BRANDING_ASSET_INVALID 与 ENT_BRANDING_ASSET_TOO_LARGE 稳定错误边界。
BrandingImageInspector.java: 复用 common/image 的字节级解析并叠加品牌单边像素上限，SVG 与未知格式一律拒绝。
BrandingAssetStore.java: `.part` 有界写入/SHA-256、hash 互斥锁、原子 CAS 终结与受控路径解析。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
