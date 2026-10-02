# feedback/

> L2 | 父级: ../CLAUDE.md

成员清单

feedback-management-page.tsx: 通过生成 API、TanStack InfiniteQuery 与 ProductDataTable 按状态分段筛选并 keyset 续页展示员工反馈；反馈内容标题与行末「查看反馈」按钮是等价详情入口，详情弹窗内完成分诊/解决/忽略，服务端独占状态机、revision CAS 与审计。
feedback-editors.tsx: 状态/类型文案与色板、与冻结链路同构的 nextStatuses、只读详情（诊断白名单 + 附件预览）与处置表单；只收集目标状态与备注，不持有 mutation。
feedback-management-page.test.tsx: 状态链路下一步集合、分段筛选与控制台提交体（去空白备注转 null）的纯单测门禁，外加行标题入口契约（可聚焦、可读名带行主体名、点击与回车各只开一次详情），不启动路由与网络。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
