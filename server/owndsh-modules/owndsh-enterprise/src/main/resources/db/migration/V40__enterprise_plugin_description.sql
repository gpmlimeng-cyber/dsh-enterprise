-- [INPUT]: 依赖 V2 的 ent_plugin_package 与 V30/V35 配方/技能侧 description 的先例（可空 text、无默认值）。
-- [OUTPUT]: 为 ent_plugin_package 新增可空 description 列与长度约束（1..300，缺失即 NULL）。
-- [POS]: 插件 package 级描述（制品 package.json 的 description，员工端卡片第二行）的存储边界；随首个上传写入、不随版本变化。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

-- 可空、无默认值：与 V30 ent_preset_package.description / V35 ent_skill_package.description 同形。
-- 既有行一律为 NULL = 「没有描述」，员工端据此如实降级成「暂无描述」（绝不回填空串占位）。
alter table ent_plugin_package add column description text;

-- 第二道存储闸：非 NULL 时必须是 1..300 的文本，与契约 PluginDescription（maxLength 300）同值。
-- 验包器（PluginArtifactInspector）是唯一写入口，已把空白/超长归一成 NULL；这条约束防的是未来绕过它的写入。
alter table ent_plugin_package add constraint ck_ent_plugin_package_description
    check (description is null or (length(description) between 1 and 300));
