# activity/

> L2 | 父级: ../CLAUDE.md

成员清单

activity-page.tsx: 按 ent:* 权限裁剪活动分段；用量分段内切换分析/明细，分别呈现实测 Token、配额扣额与未知用量。
usage-analytics-panel.tsx: 近 7/30/90/自定义范围与成员/模型筛选下的摘要卡、日趋势、模型/成员分解表。
activity-page.test.ts: 验证角色分段权限，以及未知用量与实测零值的显示差异。
session-content.ts: 在 React 状态前严格验证 Base64、UTF-8、JSONL、事件 envelope 与连续序号，只输出页面所需事件投影。
session-content.test.ts: 覆盖规范正文及非规范 Base64、范围和事件拒绝路径。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
