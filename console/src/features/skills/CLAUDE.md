# skills/

> L2 | 父级: ../CLAUDE.md

成员清单

skill-management-page.tsx: 通过生成 API、multipart、TanStack Query 与产品表格把 .dshskill 技能包折叠为一行（技能包/skillId、最新基线、技能数、状态、可见范围、更新时间）；技能包显示名标题与行末「详情」按钮都是详情入口，承载上传、发布、下架与全量范围替换；包级可见性以 assignments 而非设备库存表达，服务端独占验包、CAS 与下载授权。
skill-management-page.test.ts: 锁定 .dshskill 上传保持 File 本体并以 application/json Blob 发送 metadata 的 Spring RequestPart 契约，以及行投影取最新版本、技能数与可见范围摘要（ALL/N 人/未配置）。
skill-editors.tsx: 技能版本状态色板、版本时间线、可见范围 draft→spec 变换、安全提示与 SKILL.md 条目预览，以及上传确认、可见范围编辑（独立对话框与详情内联共用同一份字段与校验）、详情和下架对话框；只收集产品语义，不解析 ZIP、不持有 mutation。
skill-editors.test.tsx: 以 Testing Library 与纯函数锁定 .dshskill 扩展名门禁、上传后切换为服务端解析确认态、可见范围折叠成 ALL/USER 全量替换载荷，以及详情的安全提示、逐版本发布与只读角色裁剪。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
