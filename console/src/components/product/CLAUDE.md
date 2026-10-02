# product/

> L2 | 父级: ../CLAUDE.md

成员清单

DataTable.tsx: Beautiful UI 视觉下的 TanStack Table v9 产品数据表，统一搜索、筛选、排序、列显隐、行选择、本地分页和 Server cursor 续页；失败态经 lib/errors 呈现服务端 message（企业错误信封不是 Error 实例）。
DataTable.test.tsx: 共享表格的搜索、精确筛选、行选择、列显隐与分页行为门禁，并锁企业错误信封取文、加载中页脚占位与每页行数焦点环。
Dialog.tsx: 产品表单共享的可访问模态容器，统一遮罩、标题、关闭动作与移动端高度边界。
RowTitleLink.tsx: 台账行标题的共享入口——有详情时渲染可聚焦 button（hover 换色下划线、focus-visible 焦点环、Enter/Space 键盘激活、可读名带行主体名），无详情时只渲染纯文本，避免"看着能点却点不动"的死按钮；只包标题不包整行，保留文本选择与行内其它动作。
RowTitleLink.test.tsx: 行标题反向锁门禁——无详情没有按钮角色、没有 pointer 指针语义；有详情必须可聚焦、可读名带行主体名、Enter/Space 各只触发一次。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
