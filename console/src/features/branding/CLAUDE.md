# branding/

> L2 | 父级: ../CLAUDE.md

成员清单

branding-management-page.tsx: 通过生成 API、Query 与 multipart 管理品牌名称/简称/欢迎语/版本标识与三个 LOGO 槽位，预览后发布，并按历史 revision 回滚；服务端独占位图校验与 CAS。
branding-editors.tsx: LOGO 槽位上传/清除控件、登录弹窗预览卡片与回滚确认对话框；只收集产品语义，不持有 mutation。
branding-management-page.test.ts: 发布请求白名单/空白归一/全空草稿预判的纯单测门禁，不启动浏览器与网络。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
