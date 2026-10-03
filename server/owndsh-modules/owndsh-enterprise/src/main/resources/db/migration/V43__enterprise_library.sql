-- [INPUT]: 依赖 V0 的 baseline 与 sys_user（草稿作者外键）、V2/V8 的 ent_* 命名与约束风格（ent_ 前缀、bigint 主键、tenant_id varchar(20)、timestamptz、显式 check 命名）。
-- [OUTPUT]: 建立资料库的**服务端权威存储**五张表（node 树 / asset / **不可变** revision / reference 会话引用 / **可变** draft 草稿）与索引、约束；不改任何既有表、不新增权限码与菜单行。
-- [POS]: 资料库从"本机权威"走向"多端共享权威"（方案 §5.3 P2 的第 1 条：节点/资产/修订/引用/草稿 + 对象存储）的**存储边界**；本迁移只落表，HTTP/投影/契约由下一刀接（本轮写入范围不含 contracts/）。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

-- 四条与 bundle 侧域模型（`dshent_library` 的 5 张表）逐条对齐的口径，实施时不许改：
-- ① **revision 故意没有 `updated_at` 列**：不可覆盖在 schema 级就表达出来——修订只有 insert，没有任何 update 路径
--    （bundle 侧 `manager.ts` 的源码级反向锁与它是同一条纪律的两端）。
-- ② **draft 的正文就在 `content` 列**（草稿是可变工作副本，8 MiB 上限由 check 兜住）；revision 的正文**不在库里**，
--    只留 `original_object_ref` / `content_object_ref` 两个对象引用 ⇒ "大正文不进元数据行"这条纪律两张表各自表达一次。
-- ③ 所有跨实体外键一律 `on delete restrict`：删除必须由应用显式递归（与 bundle 侧 `removeNode` 的级联语义同形），
--    **绝不用 cascade** 让一次 `delete` 静默带走别人看不见的行。
-- ④ `ux_ent_library_revision_number (asset_id, number)` 是"发布后 number = 上一版 + 1"这条乐观语义的**数据库侧第二道闸**：
--    两个并发发布即使都算出了同一个号，也只可能有一个成功（另一个撞唯一索引 ⇒ 应用转成 `library/revision-conflict`）。

create table ent_library_node
(
    id         bigint primary key,
    tenant_id  varchar(20) not null,
    owner_id   varchar(64) not null,
    -- 主体范围：本刀只有个人（bundle 侧 `scope:'personal'`）；组织共享是 P2 的放宽，键形状不变。
    scope      varchar(16) not null default 'PERSONAL',
    parent_id  bigint,
    kind       varchar(16) not null,
    title      varchar(256) not null,
    depth      integer     not null,
    asset_id   bigint,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_ent_library_node_scope check (scope in ('PERSONAL', 'ORGANIZATION')),
    constraint ck_ent_library_node_kind check (kind in ('FOLDER', 'ASSET')),
    constraint ck_ent_library_node_title check (char_length(title) between 1 and 256),
    constraint ck_ent_library_node_depth check (depth >= 0),
    -- 文件夹不许挂资产、文件节点必须有资产：树的形状不靠应用自觉。
    constraint ck_ent_library_node_asset check ((kind = 'ASSET') = (asset_id is not null)),
    constraint fk_ent_library_node_parent foreign key (parent_id)
        references ent_library_node (id) on delete restrict
);

-- 同父下**大小写不敏感**不重名（bundle 侧 `assertUniqueName` 的同一语义）：`coalesce(parent_id, 0)` 把隐式根
-- 也纳入唯一性（id 是正数，0 不会与任何真实节点相撞），`lower(title)` 让 "甲" 与 "甲"（大小写不同的英文名）
-- 同样被判重 —— 这条索引是并发下"两次建同名文件夹"的数据库侧第二道闸。
create unique index ux_ent_library_node_sibling_title
    on ent_library_node (tenant_id, owner_id, coalesce(parent_id, 0), lower(title));

-- 目录树按父展开（界面每一层一次查询）。
create index ix_ent_library_node_parent on ent_library_node (tenant_id, owner_id, parent_id);

-- 反查某份资产的树节点（一对一的另一半）。
create index ix_ent_library_node_asset on ent_library_node (tenant_id, owner_id, asset_id)
    where asset_id is not null;

create table ent_library_asset
(
    id                  bigint primary key,
    tenant_id           varchar(20) not null,
    owner_id            varchar(64) not null,
    scope               varchar(16) not null default 'PERSONAL',
    node_id             bigint       not null,
    name                varchar(256) not null,
    kind                varchar(16)  not null,
    media_type          varchar(128) not null,
    byte_length         bigint       not null default 0,
    -- 可空：允许"已建资产、尚无修订"（先占位再上传）；外键在 revision 表建好之后补（循环引用）。
    current_revision_id bigint,
    status              varchar(16) not null default 'ACTIVE',
    source              varchar(16) not null default 'UPLOAD',
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint ck_ent_library_asset_scope check (scope in ('PERSONAL', 'ORGANIZATION')),
    constraint ck_ent_library_asset_name check (char_length(name) between 1 and 256),
    constraint ck_ent_library_asset_kind check (kind in ('MARKDOWN', 'TEXT', 'PDF', 'DOCX', 'PPTX', 'HTML')),
    constraint ck_ent_library_asset_media_type check (media_type ~ '^[a-z]+/[A-Za-z0-9.+-]+$'),
    constraint ck_ent_library_asset_byte_length check (byte_length >= 0),
    constraint ck_ent_library_asset_status check (status in ('ACTIVE', 'DISABLED')),
    constraint ck_ent_library_asset_source check (source in ('UPLOAD', 'TASK', 'CREATED')),
    constraint fk_ent_library_asset_node foreign key (node_id)
        references ent_library_node (id) on delete restrict
);

-- 资产与树节点一对一：这条唯一索引让"同一节点挂两份资产"在库层就不可能。
create unique index ux_ent_library_asset_node on ent_library_asset (node_id);

-- 列表与配额按主体 + 状态扫（停用的资产不出现在可选集合里）。
create index ix_ent_library_asset_owner on ent_library_asset (tenant_id, owner_id, status);

-- 重名门禁的读侧（大小写不敏感：与 node 的兄弟名同一手法）。
create index ix_ent_library_asset_name on ent_library_asset (tenant_id, owner_id, lower(name));

create table ent_library_revision
(
    id                   bigint primary key,
    tenant_id            varchar(20) not null,
    owner_id             varchar(64) not null,
    scope                varchar(16) not null default 'PERSONAL',
    asset_id             bigint      not null,
    number               integer     not null,
    original_sha256      varchar(64) not null,
    original_byte_length bigint      not null default 0,
    -- 原件与派生正文都只留**对象引用**（正文本体在对象存储里，绝不进这一行）。
    original_object_ref  varchar(512) not null,
    content_sha256       varchar(64)  not null,
    content_byte_length  bigint       not null default 0,
    content_object_ref   varchar(512)  not null,
    conversion_status    varchar(16)  not null default 'PENDING',
    conversion_warnings  jsonb        not null default '[]'::jsonb,
    created_at           timestamptz  not null default now(),
    constraint ck_ent_library_revision_scope check (scope in ('PERSONAL', 'ORGANIZATION')),
    constraint ck_ent_library_revision_number check (number >= 1),
    constraint ck_ent_library_revision_original_sha256 check (original_sha256 ~ '^[0-9a-f]{64}$'),
    constraint ck_ent_library_revision_content_sha256 check (content_sha256 ~ '^[0-9a-f]{64}$'),
    constraint ck_ent_library_revision_byte_length check (original_byte_length >= 0 and content_byte_length >= 0),
    constraint ck_ent_library_revision_conversion_status check (conversion_status in ('READY', 'PENDING', 'FAILED')),
    constraint ck_ent_library_revision_warnings check (jsonb_typeof(conversion_warnings) = 'array'),
    constraint fk_ent_library_revision_asset foreign key (asset_id)
        references ent_library_asset (id) on delete restrict
);

-- 版本号的唯一性（见头部第 ④ 条）：并发发布同号必被拒。
create unique index ux_ent_library_revision_number on ent_library_revision (asset_id, number);

-- 取某资产最新一版（`order by number desc limit 1`）与版本列表。
create index ix_ent_library_revision_asset on ent_library_revision (tenant_id, asset_id, number desc);

-- 循环外键：资产的"当前修订"指向修订表。可空（允许尚无修订），restrict（删修订前必须先挪指针/删资产）。
alter table ent_library_asset
    add constraint fk_ent_library_asset_current_revision foreign key (current_revision_id)
        references ent_library_revision (id) on delete restrict;

create table ent_library_draft
(
    id                  bigint primary key,
    tenant_id           varchar(20) not null,
    owner_id            varchar(64) not null,
    scope               varchar(16) not null default 'PERSONAL',
    asset_id            bigint      not null,
    base_revision_id    bigint      not null,
    -- 乐观锁 token（bundle 侧 `draft.revision`）：每次更新换一枚新的；调用方必须把它原样带回来。
    revision_token      varchar(64) not null,
    -- 草稿是**可变**的工作副本，正文就在这一列（与 revision 的"正文只进对象存储"有意不同，见头部第 ② 条）。
    content             text        not null,
    content_byte_length bigint      not null,
    created_by          bigint      not null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint ck_ent_library_draft_scope check (scope in ('PERSONAL', 'ORGANIZATION')),
    constraint ck_ent_library_draft_token check (char_length(revision_token) between 1 and 64),
    -- 字节数与正文长度必须自洽（写入口算错就是坏行）。
    constraint ck_ent_library_draft_content_length check (content_byte_length = octet_length(content)),
    -- 草稿正文上限 8 MiB（§4.4 C8/F14；与 bundle 侧 `LIBRARY_MAX_TEXT_BYTES` 同值）。
    constraint ck_ent_library_draft_content_size check (octet_length(content) <= 8388608),
    constraint fk_ent_library_draft_asset foreign key (asset_id)
        references ent_library_asset (id) on delete restrict,
    -- 基准修订：发布时若资产的当前修订已经不是它 ⇒ `library/base-revision-conflict`（那条判定在应用层）。
    constraint fk_ent_library_draft_base_revision foreign key (base_revision_id)
        references ent_library_revision (id) on delete restrict,
    constraint fk_ent_library_draft_author foreign key (created_by)
        references sys_user (user_id) on delete restrict
);

-- 同一份资产**允许**多份草稿（workdsh 的 drafts 是按 draftId 的集合）：这里只建普通索引，不建唯一索引。
create index ix_ent_library_draft_asset on ent_library_draft (tenant_id, owner_id, asset_id);

-- "我最近在改哪几份"（bundle 侧 `listDrafts` 的 updated_at 降序）。
create index ix_ent_library_draft_owner on ent_library_draft (tenant_id, owner_id, updated_at desc);

create table ent_library_reference
(
    id         bigint primary key,
    tenant_id  varchar(20) not null,
    owner_id   varchar(64) not null,
    scope      varchar(16) not null default 'PERSONAL',
    session_id varchar(128) not null,
    node_id    bigint       not null,
    sort_order integer      not null,
    created_at timestamptz  not null default now(),
    constraint ck_ent_library_reference_scope check (scope in ('PERSONAL', 'ORGANIZATION')),
    constraint ck_ent_library_reference_session check (char_length(session_id) between 1 and 128),
    constraint ck_ent_library_reference_order check (sort_order >= 0),
    constraint fk_ent_library_reference_node foreign key (node_id)
        references ent_library_node (id) on delete restrict
);

-- 同一会话里同一个节点至多一条（幂等的"加入对话"）；顺序由 `sort_order` 表达。
create unique index ux_ent_library_reference_node
    on ent_library_reference (tenant_id, owner_id, session_id, node_id);

-- 注入每一轮要按会话取"这次选了哪些"（顺序稳定）。
create index ix_ent_library_reference_session
    on ent_library_reference (tenant_id, owner_id, session_id, sort_order);
