-- [INPUT]: 依赖 V30 的 ent_preset_version 与 VALIDATED→PUBLISHED→RETIRED 状态机；形状照 V35 技能侧 skills jsonb + GIN 先例。
-- [OUTPUT]: 为配方版本新增 dependencies jsonb（默认空数组）、数组类型/条数检查约束与 jsonb_path_ops GIN 索引。
-- [POS]: 配方"引用了哪些技能/插件"的存储边界；只存软引用，不建跨包外键、不在服务端解析 Cordis 语义。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

-- not null default '[]'::jsonb：与 V35 ent_skill_version.skills 同形，既有配方版本一律回填"没有引用"。
-- 单条元素形状 {kind, id, mode, versionId?, required} 由验包与发布口校验，数据库不解释元素语义。
alter table ent_preset_version add column dependencies jsonb not null default '[]'::jsonb;

-- 第二道存储闸：只允许数组，且条数上限与可见范围同量级（200）。
-- jsonb_typeof 先例见 V2 ck_ent_plugin_version_compatibility；元素级规则不在这里重复（数据库不做引用解析）。
alter table ent_preset_version add constraint ck_ent_preset_version_dependencies
    check (jsonb_typeof(dependencies) = 'array' and jsonb_array_length(dependencies) <= 200);

-- "谁引用了某个技能/插件"的 containment 查询（方案 §D.4 两类查询之一）走 containment，与技能侧同用 jsonb_path_ops。
create index ix_ent_preset_version_dependencies
    on ent_preset_version using gin (dependencies jsonb_path_ops);
