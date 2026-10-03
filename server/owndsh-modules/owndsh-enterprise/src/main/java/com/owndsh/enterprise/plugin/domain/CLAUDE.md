# plugin/domain/

> L2 | 父级: ../CLAUDE.md

成员清单

PluginCompatibility.java: 发布方声明的 Harness commit 集合（只校验 40 位小写十六进制形态、非空与去重，不锁定单一版本，兼容裁决归 Harness caret peer 规则）、企业 bundle SemVer range 和受支持 OS 的规范化值对象。
PluginPackage.java: tenant 内 npm package 聚合根与 assignment CAS revision；含**必填 displayName**（制品 package.json，缺省时验包器已回退包名 ⇒ 永不为空，1..120，员工端卡片**标题**）与**可选 description**（同源读取，随首个上传写入、可空、非空需 ≤1000 非空白）。
PluginVersion.java: 制品 hash、签名（空数组为未签名，非空严格为 64 字节）、compatibility 和 UPLOADED→VALIDATED→PUBLISHED→RETIRED 状态事实。
PluginAssignment.java: ALL/DEPT/USER 主体、INSTALLED/ABSENT 期望态与 required 约束。
RuntimePluginAssignment.java: 客户端校验和调和所需的唯一脱敏下载投影（含 package 级**必填 displayName**（1..120，员工端卡片**标题**；验包器缺省回退包名故永不为空）与**可选 description**（卡片第二行）），与版本共享空签名语义。
DevicePluginInventory.java: ACTIVE 设备上报的本地调和状态和 Loader 观测事实。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
