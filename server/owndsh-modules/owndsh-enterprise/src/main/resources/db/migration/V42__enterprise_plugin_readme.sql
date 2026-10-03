-- [INPUT]: 依赖 V2 的 ent_plugin_version（artifact_ref 指向 sha256 CAS 制品）与 V40/V41 那两刀 description 的先例（可空 text + 长度闸）。
-- [OUTPUT]: 为 ent_plugin_version 新增可空 readme 列与长度约束（1..65536，缺失即 NULL）。
-- [POS]: 插件 README（制品 tar 里那份文本，员工端插件详情「描述」段的首选取值）的存储边界；它随**版本**走。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

-- **为什么落在版本行而不是 package 行**（与 V40 的 description 有意不同）：
-- ① README 就躺在**这一版的 tar** 里（验包器从归档解出来）。description/displayName 那种
--    「随首个上传写入、不随版本变化」的口径放到 README 上会说假话：同一个包发 v2 时 README 很可能改了，
--    员工端应当看到**这一版**的 README，而不是第一版的。
-- ② package 行是**管理端列表**投影（上限 200 条/页）：把 64KB 的正文挂在那一行会让管理端目录
--    在极端情况下放大到 MB 级；版本行不进任何列表投影（只在员工端 assignment 那一处按需带出）。
-- 可空、无默认值：既有行一律 NULL =「这一版没有解出 README」⇒ 员工端如实回落到制品 package.json 的
-- 短 description（绝不回填空串占位）。存量行由 `PluginReadmeBackfill` 在启动时按**已存制品**回填一次
-- （同一个 (packageName, version, sha256) 重传不会重新验包，故没有别的回填路径）；回填不到的保持 NULL。
alter table ent_plugin_version add column readme text;

-- 第二道存储闸：非 NULL 时必须是 1..65536 的文本，与契约 PluginReadme.maxLength 同值
-- （验包器按 **UTF-8 字节** 65536 截断，字符数不可能超过字节数，故这里 65536 是必然成立的字符数上界）。
-- 验包器是唯一写入口（它把空白/非 UTF-8/超长一律归一成 NULL），这条约束防的是未来绕过它的写入。
alter table ent_plugin_version add constraint ck_ent_plugin_version_readme
    check (readme is null or (length(readme) between 1 and 65536));
