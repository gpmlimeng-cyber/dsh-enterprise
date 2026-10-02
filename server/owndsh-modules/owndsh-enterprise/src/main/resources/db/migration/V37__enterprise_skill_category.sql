-- [INPUT]: 依赖 V35 建立的 ent_skill_package 与 manifest.json 的可选 category 声明。
-- [OUTPUT]: 为技能包新增可空 category 列（varchar(32)），既有行保持 NULL 表示"没有分类"，并用检查约束拒绝空串与纯空白。
-- [POS]: 企业技能目录的分类扩展；NULL 是"没有分类"的唯一持久化表示，管理端与员工端投影原样带出，不做任何回填。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

-- 可空且不给默认值：既有技能包一律没有分类，加 default 会把既有行固化成假事实。
-- varchar(32) 由数据库兜底 manifest ≤32 的长度契约。alter table add column 只执行一次，
-- 列已存在时整条语句报错而不留半成品数据（与 V36 先例一致）。
alter table ent_skill_package add column category varchar(32);

-- 长度由类型约束，这里只收紧"非空即必须含可见字符"：空串与纯空白都不是分类，
-- 只有 NULL 才能表达"没有分类"；验包层已拒绝纯空白，本约束是存储边界的第二道闸。
alter table ent_skill_package add constraint ck_ent_skill_package_category
    check (category is null or btrim(category) <> '');
