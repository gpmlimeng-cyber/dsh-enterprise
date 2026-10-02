# app/

> L2 | 父级: ../CLAUDE.md

成员清单

console-shell.tsx: 复用上游 SidebarNav、ThemeToggle 和 Harness tab/window 结构，以 DSH Enterprise 名称和鲸鱼图标标识管理入口，按 bootstrap 固定角色过滤导航并组装侧栏分组（四个产品组 + 恒非空的「文档与支持」组，组间由 SidebarNav 出分割线，空组不出线），并在产品组之后追加产品官网 /home/、帮助文档 /help/、接口文档 /api-docs/ 三个同源外链（新标签打开、不进 Tab、不高亮）；工作区菜单末尾提供用户中心与 Server 确认的 Sign out；组件示例保留独立路由，工作区菜单不提供入口。
product-routes.ts: 九个侧栏页面与隐藏用户中心的路径、文案、Lucide 图标和固定角色矩阵唯一静态真源，并给出四个静态分组（模型与授权 / 技能与插件 / 企业与组织 / 审计与运维）的组名、组内路由与顺序；`productRouteGroupsFor` 只做角色过滤并剔除整组不可见的组，`productRoutesFor` 由分组拼接（分组必须覆盖全部 PRODUCT_ROUTES，由 product-routes.test.ts 锁定）；多角色取并集，不含静态外链。
product-routes.test.ts: 锁定分组覆盖全部产品路由且不重复、组与组内顺序、按角色的整组剔除，以及分组并集与扁平 productRoutesFor 一致。
router.tsx: 创建并注册 TanStack Router 类型，消费生成 routeTree 且不读取 Server 菜单。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
