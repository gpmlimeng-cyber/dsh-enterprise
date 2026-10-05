# ops/

> L2 | 父级: ../CLAUDE.md

成员清单

market-category-runbook.md: 造出「插件市场」七类真实分组数据的**可执行操作手册** —— 分类写在哪（`.dshskill` 包内 `manifest.json` 的 `category`，manifest 是唯一真源）、七个合法字面量、三条硬规则（≤32 字符 / 拒绝纯空白 / 必须字符串）、包内结构（`format: dsh-skill` + `version: 1` + `skills/<name>/SKILL.md`）、重新上传为何会被静默跳过（`SkillCatalogService` 的同版本同哈希短路）、**上传后必须再发布**（`JdbcSkillStore` 要求 `status='PUBLISHED'`，上传只到 `VALIDATED`）、两段查库 SQL（含枚举外脏值检查）、员工端验收清单，以及七条「已知会踩的坑」（含 featured 通路未贯通、插件/配方页签恒落「其他」属预期）。每条结论均带 `文件:行号` 出处可复核；与 `../research/market-category-data-2026-10-05.md`（链路取证）配套：那份说「缺什么」，这份说「怎么补」。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
