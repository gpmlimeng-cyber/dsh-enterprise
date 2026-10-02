-- [INPUT]: 依赖 V40 已建的 ck_ent_plugin_package_description（可空 text，1..300）与既有 6 条 ent_plugin_package 行。
-- [OUTPUT]: 把该列的长度闸从 1..300 放宽到 1..1000（drop 旧约束 + add 同名新约束），列本身与 NULL 语义一字不动。
-- [POS]: 插件 package 级描述（制品 package.json 的 description，员工端卡片第二行）的存储边界。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

-- 为什么必须放宽：真实上架制品里已有 347 字符的描述（@mengli114/dsh-settings-nav-collapse 的 package.json）。
-- 旧的 300 让它在**上传那一刻**就被验包器（PluginArtifactInspector.MAX_DESCRIPTION_LENGTH）归一成 null，
-- 数据在源头就丢了；放宽到 1000 才谈得上回填，也才不会再丢同类长描述。与契约
-- PluginDescription.maxLength = 1000 逐字同值。
--
-- 不改 V40：那个迁移已在真实库执行过（flyway_schema_history 里 40 已 success），
-- 任何对已应用迁移的编辑都会让 checksum 校验失败，故用一个新版本号承载这次变更。
alter table ent_plugin_package drop constraint ck_ent_plugin_package_description;

-- 与 V40 同名、同形，只把上界从 300 换成 1000：非 NULL 时必须是 1..1000 的文本。
-- 验包器仍是唯一写入口（它把空白/超长归一成 NULL）；这条约束防的是未来绕过它的写入。
alter table ent_plugin_package add constraint ck_ent_plugin_package_description
    check (description is null or (length(description) between 1 and 1000));
