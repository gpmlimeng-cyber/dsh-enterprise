-- [INPUT]: 依赖 V4 固定角色与权限不可变 trigger、应用提供的雪花 ID 与 sys_user 外键。
-- [OUTPUT]: 建立品牌单行配置、不可变发布文档与内容寻址位图资产三表，预留 organization_id，新增 ent:branding 权限码并扩展审计 action 白名单。
-- [POS]: 品牌自定义 B1 的数据与 RBAC 边界；全局单例只约束 organization_id is null 的那一行。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table ent_branding_config
(
    id              bigint primary key,
    tenant_id       varchar(20) not null,
    organization_id bigint,
    revision        bigint      not null default 0,
    updated_by      bigint,
    updated_at      timestamptz not null default now(),
    constraint ck_ent_branding_config_revision check (revision >= 0),
    constraint ck_ent_branding_config_organization check (organization_id is null or organization_id > 0),
    constraint fk_ent_branding_config_updater foreign key (updated_by)
        references sys_user (user_id) on delete restrict
);

-- 一期可见范围是全局单例：每个 tenant 至多一行 organization_id is null；
-- 该局部唯一索引使"按组织区分"日后只是新增 organization_id 非空的行，不需要重构。
create unique index ux_ent_branding_config_singleton
    on ent_branding_config (tenant_id) where organization_id is null;

create unique index ux_ent_branding_config_organization
    on ent_branding_config (tenant_id, organization_id) where organization_id is not null;

create table ent_branding_asset
(
    id           bigint primary key,
    tenant_id    varchar(20)   not null,
    artifact_ref varchar(1024) not null,
    sha256       varchar(64)   not null,
    content_type varchar(64)   not null,
    size_bytes   bigint        not null,
    width        integer       not null,
    height       integer       not null,
    created_by   bigint        not null,
    created_at   timestamptz   not null default now(),
    constraint ck_ent_branding_asset_sha256 check (sha256 ~ '^[0-9a-f]{64}$'),
    constraint ck_ent_branding_asset_size check (size_bytes > 0 and size_bytes <= 524288),
    constraint ck_ent_branding_asset_dimensions check (
        width > 0 and height > 0 and width <= 8192 and height <= 8192
    ),
    constraint ck_ent_branding_asset_content_type check (
        content_type in ('image/png', 'image/jpeg', 'image/webp')
    ),
    constraint uq_ent_branding_asset_hash unique (tenant_id, sha256),
    constraint fk_ent_branding_asset_creator foreign key (created_by)
        references sys_user (user_id) on delete restrict
);

create table ent_branding_document
(
    id                    bigint primary key,
    tenant_id             varchar(20)     not null,
    config_id             bigint          not null,
    revision              bigint          not null,
    name                  varchar(120),
    short_name            varchar(60),
    logo_light_asset_id   bigint,
    logo_dark_asset_id    bigint,
    logo_square_asset_id  bigint,
    welcome_headline      varchar(200),
    welcome_edition_label varchar(60),
    published_by          bigint          not null,
    published_at          timestamptz     not null default now(),
    constraint fk_ent_branding_document_config foreign key (config_id)
        references ent_branding_config (id) on delete restrict,
    constraint fk_ent_branding_document_publisher foreign key (published_by)
        references sys_user (user_id) on delete restrict,
    constraint fk_ent_branding_document_light foreign key (logo_light_asset_id)
        references ent_branding_asset (id) on delete restrict,
    constraint fk_ent_branding_document_dark foreign key (logo_dark_asset_id)
        references ent_branding_asset (id) on delete restrict,
    constraint fk_ent_branding_document_square foreign key (logo_square_asset_id)
        references ent_branding_asset (id) on delete restrict,
    constraint ck_ent_branding_document_revision check (revision > 0),
    constraint uq_ent_branding_document_revision unique (config_id, revision)
);

create index ix_ent_branding_document_revision
    on ent_branding_document (config_id, revision desc);

insert into sys_menu (
    menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache,
    menu_type, visible, status, perms, icon, create_time, remark
) values
    (1900400000000001020, '品牌读取', 1900400000000000000, 18, '', '', 'N', 'Y', 'F', '1', '0', 'ent:branding:read', '#', now(), '固定产品权限'),
    (1900400000000001021, '品牌写入', 1900400000000000000, 19, '', '', 'N', 'Y', 'F', '1', '0', 'ent:branding:write', '#', now(), '固定产品权限');

alter table sys_role_menu disable trigger trg_ent_built_in_role_menu_immutable;

insert into sys_role_menu (role_id, menu_id) values
    (1900300000000000001, 1900400000000001020),
    (1900300000000000001, 1900400000000001021);

alter table sys_role_menu enable trigger trg_ent_built_in_role_menu_immutable;

alter table ent_audit_event drop constraint ck_ent_audit_event_action;

alter table ent_audit_event add constraint ck_ent_audit_event_action check (action in (
    'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT', 'IDENTITY_SOURCE_CHANGED', 'USER_LINKED', 'USER_UNLINKED',
    'DEVICE_ENROLLED', 'DEVICE_HEARTBEAT', 'DEVICE_REVOKED',
    'PROVIDER_CHANGED', 'MODEL_CHANGED', 'MODEL_GRANT_CHANGED',
    'MODEL_REQUEST_ACCEPTED', 'MODEL_REQUEST_FINISHED',
    'QUOTA_CHANGED', 'QUOTA_REJECTED', 'RESERVATION_RECOVERED',
    'PLUGIN_UPLOADED', 'PLUGIN_PUBLISHED', 'PLUGIN_ASSIGNED', 'PLUGIN_DOWNLOADED',
    'PLUGIN_INVENTORY_REPORTED', 'SESSION_BATCH_APPENDED', 'SESSION_EXPORTED',
    'SESSION_RESTORED', 'SESSION_CONTENT_READ', 'SESSION_DELETED', 'SESSION_EXPIRED',
    'ROLE_ASSIGNED', 'USER_STATUS_CHANGED', 'CONFIG_CHANGED',
    'PRESET_VERSION_UPLOADED', 'PRESET_VERSION_PUBLISHED', 'PRESET_VERSION_RETIRED',
    'PRESET_ASSIGNMENTS_REPLACED', 'PRESET_DOWNLOAD_AUTHORIZED',
    'BRANDING_PUBLISHED', 'BRANDING_ROLLED_BACK'
));
