-- [INPUT]: 依赖 V4 固定角色与权限不可变 trigger，以及应用提供的雪花 ID。
-- [OUTPUT]: 建立配方 package/version/assignment 三表、ent:preset 权限码，并扩展审计 action 白名单。
-- [POS]: 配方广场的数据与 RBAC 边界，与插件分发表隔离。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table ent_preset_package
(
    id          bigint primary key,
    tenant_id   varchar(20)  not null,
    preset_id   varchar(128) not null,
    display_name varchar(120) not null,
    description text,
    status      varchar(16)  not null,
    revision    bigint       not null default 0,
    constraint ck_ent_preset_package_status check (status in ('ACTIVE', 'DISABLED')),
    constraint ck_ent_preset_package_revision check (revision >= 0),
    constraint ck_ent_preset_package_preset_id check (preset_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'),
    constraint uq_ent_preset_package_preset unique (tenant_id, preset_id)
);

create table ent_preset_version
(
    id                 bigint primary key,
    tenant_id          varchar(20)   not null,
    package_id         bigint        not null,
    source_dsh_version varchar(64)   not null,
    artifact_ref       varchar(1024) not null,
    size_bytes         bigint        not null,
    sha256             varchar(64)   not null,
    status             varchar(16)   not null,
    created_by         bigint        not null,
    created_at         timestamptz   not null default now(),
    revision           bigint        not null default 0,
    constraint fk_ent_preset_version_package foreign key (package_id)
        references ent_preset_package (id) on delete restrict,
    constraint fk_ent_preset_version_creator foreign key (created_by)
        references sys_user (user_id) on delete restrict,
    constraint ck_ent_preset_version_size check (size_bytes > 0 and size_bytes <= 52428800),
    constraint ck_ent_preset_version_sha256 check (sha256 ~ '^[0-9a-f]{64}$'),
    constraint ck_ent_preset_version_status check (status in ('VALIDATED', 'PUBLISHED', 'RETIRED')),
    constraint ck_ent_preset_version_revision check (revision >= 0),
    constraint uq_ent_preset_version_source unique (package_id, source_dsh_version),
    constraint uq_ent_preset_version_hash unique (tenant_id, sha256),
    constraint uq_ent_preset_version_id_package unique (id, package_id)
);

create table ent_preset_assignment
(
    id           bigint primary key,
    tenant_id    varchar(20) not null,
    package_id   bigint      not null,
    subject_type varchar(16) not null,
    subject_id   bigint,
    status       varchar(16) not null,
    revision     bigint      not null default 0,
    constraint fk_ent_preset_assignment_package foreign key (package_id)
        references ent_preset_package (id) on delete restrict,
    constraint ck_ent_preset_assignment_subject_type check (subject_type in ('ALL', 'USER')),
    constraint ck_ent_preset_assignment_subject check (
        (subject_type = 'ALL' and subject_id is null)
        or (subject_type = 'USER' and subject_id is not null)
    ),
    constraint ck_ent_preset_assignment_status check (status in ('ACTIVE', 'DISABLED')),
    constraint ck_ent_preset_assignment_revision check (revision >= 0)
);

create unique index ux_ent_preset_assignment_user
    on ent_preset_assignment (package_id, subject_type, subject_id)
    where subject_type = 'USER';

create unique index ux_ent_preset_assignment_all
    on ent_preset_assignment (package_id)
    where subject_type = 'ALL' and subject_id is null;

create index ix_ent_preset_version_created on ent_preset_version (tenant_id, created_at desc, id desc);

insert into sys_menu (
    menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache,
    menu_type, visible, status, perms, icon, create_time, remark
) values
    (1900400000000001018, '配方读取', 1900400000000000105, 3, '', '', 'N', 'Y', 'F', '1', '0', 'ent:preset:read', '#', now(), '固定产品权限'),
    (1900400000000001019, '配方写入', 1900400000000000105, 4, '', '', 'N', 'Y', 'F', '1', '0', 'ent:preset:write', '#', now(), '固定产品权限');

alter table sys_role_menu disable trigger trg_ent_built_in_role_menu_immutable;

insert into sys_role_menu (role_id, menu_id) values
    (1900300000000000001, 1900400000000001018),
    (1900300000000000001, 1900400000000001019),
    (1900300000000000003, 1900400000000001018),
    (1900300000000000003, 1900400000000001019);

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
    'PRESET_ASSIGNMENTS_REPLACED', 'PRESET_DOWNLOAD_AUTHORIZED'
));
