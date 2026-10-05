# research/

> L2 | 父级: ../CLAUDE.md

成员清单

cherry-skill-add-2026-10-05.md: Cherry Studio 2.1.4「添加技能」四路功能（在线搜索 / 系统搜索 / 本地导入 / 通过 Agent 创建）的**源码级取证报告**，事实层与采纳层分离。逐项给 `文件:行号`：①**三个聚合搜索源的真实端点逐字**（`skills.sh/api/search`·`claude-plugins.dev/api/skills?limit=20`·`clawhub.ai/api/v1/search`，**均无鉴权**）+ 第四个 `github` 源是「粘贴 URL 直装」**不参与搜索**、各源响应键名互不相同（`skills`/`results`、`name`/`displayName`、`description`/`summary`）、15s 超时与 `allSettled` 部分成功、`name.toLowerCase()` 跨源去重；②**15 个系统目录含重名**（`agents` 与 `agents-xdg` 都叫 "Agent Skills"）、目录不存在**静默跳过**、去重键是 **realpath 后路径**而非技能名、三态判定（`registered` 按路径 / `conflict` 按 `normalizeFolderKey` 折叠名 / `available`）；③**ZIP 安全门禁逐条**（`MAX_SKILL_*` 100 MB/2 万 vs `MAX_ARCHIVE_*` 1 GB/5 万**测的是不同对象**、`assertZipEntriesWithin` 对第三方库的不信任层、**`assertNoFoldedPathCollisions` 大小写+Unicode 折叠碰撞**（`NFC().toLowerCase()`，Windows/macOS 落到同一文件）、`assertNoSymlinkComponents` 为何不能被 realpath 替代）；④「通过 Agent 创建」**不拼提示词**——找内置 `skill-creator` 后走**与「试用技能」同一条路**，`createBuiltinSkillSession` 单写事务三步（确保助理+绑技能+建会话）、草稿逐字「请使用 {{name}} 技能帮我完成这项任务。」、会话不匹配则不注入草稿；⑤内置技能 **`.version` 文件 + 只在 App 升级或内容 hash 变时覆盖**、`syncBuiltinSkill` 三道拒（来源/命名空间/内容冲突，**宁可失败也不覆盖用户同名技能**）、`AgentGlobalSkillService.list()` 的 `isEnabled ?? (source==='builtin')` 兜底即「默认对每个 agent 启用」。**§6 是排工期依据**：能力对照表（Cherry 有 / 我们有 / 缺口 / Cherry 哪条比我们弱）判定**在线搜索与系统搜索建议不做**（绕过企业审核与可见范围）、本地 ZIP 导入我们已有**更严**链路（总量/条目数严 5 倍、256 KiB 单文件上限它没有、目录名只接受 kebab 我们更严）、并**推翻「我们装不下 `references/`」**（客户端 `skill-archive.ts:133` 收任意深度、服务端 `SkillArtifactInspector.java:133-135` 只认 `skills/` 前缀，两者都合法）；**唯一实缺口 = ZIP 折叠碰撞检查我们零命中**（`zip-archive.ts:204` 的 `seen` 用**原始 path**，故拒得了完全重复、拒不了 `A.md` 与 `a.md`），另有「资源文件无单文件上限」这一**双方共有**的缺口。§0.2 记录一次**做错的阳性对照**并给出正确做法：对照符号必须**存在于目标文件内**（拿 `realpath` 去查不含它的 `skill-archive.ts` 得假阴性，会把「我没找到」误报成「它不存在」），故 §3.3 与 §8 的全部「我们没有」结论均在重做对照（`grep -c "maxEntries" … ` = 1）之后成立。
market-category-data-2026-10-05.md: 技能/插件「分类」端到端链路取证报告。逐环给出写包→验包→落库→管理端读/改→本机 API 透传→插件侧投影→前端解码→分组的现状与证据（文件:行号），并判定三件事：①**插件侧 category 服务端零落库零投影**，插件真实分组必须后端另开一刀；②**`featured` 五处全缺**、从未流到员工端，「精选 = featured」分支是死代码；③ console 无 category/featured 任何入口。另含「造出真实七类数据」可执行操作手册（manifest 键位、七值、`optionalCategory` 逐条规则、7 个最小示例包与一键生成脚本、勾精选两条路径、四步核对 SQL、13 条常见报错对照），以及风险项（枚举外旧值入库不被拒 + 已入库活测试 `SkillArtifactInspectorTest:199` 与新契约矛盾；契约收紧**不**炸 CI 门禁，因 `generate.mjs:108` 的 `dereference()` 已内联 `$ref`）、可判定验收清单（A1–A14）与「未找到证据」清单。本文件同时**证伪**了上一轮「`data-plugin-item-detail` 在官方 asar 中不存在」的结论。
jingyun-dsh-appstore.md: 第三方 jingyun-dsh 应用商店的 UI 取值参考真源，事实层与采纳层分离。
iflytek-skillhub-integration.md: 讯飞 SkillHub 生态与本项目技能目录的逐项对照及集成方案排序。
agent-preset-best-practices.md: 外部主流 Agent 插件/技能/配方清单最佳实践的调研真源。
workdsh-knowledge-base.md: WorkDSH 知识库能力调研。
workdsh-other-features.md: WorkDSH 其余功能面调研。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
