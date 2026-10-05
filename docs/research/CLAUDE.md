# research/

> L2 | 父级: ../CLAUDE.md

成员清单

market-category-data-2026-10-05.md: 技能/插件「分类」端到端链路取证报告。逐环给出写包→验包→落库→管理端读/改→本机 API 透传→插件侧投影→前端解码→分组的现状与证据（文件:行号），并判定三件事：①**插件侧 category 服务端零落库零投影**，插件真实分组必须后端另开一刀；②**`featured` 五处全缺**、从未流到员工端，「精选 = featured」分支是死代码；③ console 无 category/featured 任何入口。另含「造出真实七类数据」可执行操作手册（manifest 键位、七值、`optionalCategory` 逐条规则、7 个最小示例包与一键生成脚本、勾精选两条路径、四步核对 SQL、13 条常见报错对照），以及风险项（枚举外旧值入库不被拒 + 已入库活测试 `SkillArtifactInspectorTest:199` 与新契约矛盾；契约收紧**不**炸 CI 门禁，因 `generate.mjs:108` 的 `dereference()` 已内联 `$ref`）、可判定验收清单（A1–A14）与「未找到证据」清单。本文件同时**证伪**了上一轮「`data-plugin-item-detail` 在官方 asar 中不存在」的结论。
jingyun-dsh-appstore.md: 第三方 jingyun-dsh 应用商店的 UI 取值参考真源，事实层与采纳层分离。
iflytek-skillhub-integration.md: 讯飞 SkillHub 生态与本项目技能目录的逐项对照及集成方案排序。
agent-preset-best-practices.md: 外部主流 Agent 插件/技能/配方清单最佳实践的调研真源。
workdsh-knowledge-base.md: WorkDSH 知识库能力调研。
workdsh-other-features.md: WorkDSH 其余功能面调研。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
