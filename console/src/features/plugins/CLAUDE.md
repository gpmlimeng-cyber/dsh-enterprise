# plugins/

> L2 | 父级: ../CLAUDE.md

成员清单

plugin-management-page.tsx: 通过生成 API、multipart JSON part、Query 与产品表格管理企业版本、ALL/USER 可见范围和设备库存；上传/发布不触发安装，服务端独占验包、签名与范围裁决。
plugin-management-page.test.ts: 验证上传保持 tgz File，并以 application/json Blob 发送 compatibility，锁住 Spring RequestPart 契约。
plugin-editors.tsx: 原生插件包/兼容性与可见范围表单，上传接受 tgz/tar.gz/zip 并由服务端归一化为标准 tgz；上传初值只是运维可改的 commit 种子（服务端已不锁定单一 Harness commit），可见范围对话框交出的已是完整替换载荷——可编辑 ALL/USER 项加上界面未呈现、必须原样重发的 DEPT 事实，固定 required=false，不提供强制安装。
plugin-editors.test.tsx: 以 Testing Library 锁定保存可见范围时不可编辑的 DEPT 事实必须原样重发，防止服务端全量替换语义静默删除控制台未呈现的分配。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
