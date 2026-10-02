# domain/

> L2 | 父级: ../CLAUDE.md

成员清单

PresetPackage.java: 配方 package 不可变事实与 ACTIVE/DISABLED 状态。
PresetVersion.java: 配方版本不可变事实、VALIDATED/PUBLISHED/RETIRED 状态机与上传即冻结的 dependencies 引用清单。
PresetDependency.java: 一条引用事实(kind/id/mode/versionId?/required)与线格式字面量常量。
PresetDependencyRules.java: 引用 v1 形状闸（类型/枚举/坐标一致/查重/上限），验包与发布口共用同一份判定。
PresetDependencyResolution.java: 引用解析三态（MISSING / NOT_PUBLISHED / RESOLVED）。
PresetAssignment.java: ALL/USER 可见范围事实。
RuntimePreset.java: 员工可见已发布配方投影，带出随版本冻结的 dependencies 引用清单（列表与详情同源）。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
