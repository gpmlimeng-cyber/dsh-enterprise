-- [INPUT]: 依赖 V32 已插入的 ent:branding:read/write 权限行、既有 1900400000000000105「插件分发」C 型菜单节点范式，以及 V4/V17 的内置角色权限不可变 trigger。
-- [OUTPUT]: 补齐品牌页的 C 型菜单节点并授予 enterprise_admin，使 /branding 在控制台侧栏可见且后端按菜单授权。
-- [POS]: V32 的紧邻修补：V32 只登记了 F 型权限码，缺承载页面的菜单节点；本迁移幂等插入，可在已手工插入的环境安全重跑。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

-- 品牌页菜单节点：逐列镜像「插件分发」，component 与 console 既有页面路径同构。
insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component,
                      is_frame, is_cache, menu_type, visible, status, perms, icon,
                      create_time, remark)
select 1900400000000001022, '品牌', 1900400000000000000, 6, 'branding', 'enterprise/branding/index',
       'N', 'Y', 'C', 0, 0, 'ent:branding:read', 'code',
       now(), 'V33 品牌页菜单节点'
where not exists (select 1 from sys_menu where menu_id = 1900400000000001022);

-- 固定角色权限只能由版本化 migration 调整；事务结束前恢复运行时不可变保护（同 V17 范式）。
alter table sys_role_menu disable trigger trg_ent_built_in_role_menu_immutable;

insert into sys_role_menu (role_id, menu_id)
select 1900300000000000001, 1900400000000001022
where not exists (select 1 from sys_role_menu
                  where role_id = 1900300000000000001 and menu_id = 1900400000000001022);

alter table sys_role_menu enable trigger trg_ent_built_in_role_menu_immutable;
