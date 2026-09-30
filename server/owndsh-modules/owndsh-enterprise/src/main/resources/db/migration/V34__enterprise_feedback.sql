-- [INPUT]: 依赖 V4 的内置角色/菜单与权限不可变 trigger、V32/V33 的审计 action check 与 C 型菜单节点范式、应用提供的雪花 ID 与 sys_user 外键。
-- [OUTPUT]: 建立反馈主表（含白名单化的客户端 diagnostics 列）与不可变附件表，新增 ent:feedback 权限码、F 型权限行 + C 型菜单节点并只授 enterprise_admin，扩展审计 action 白名单。
-- [POS]: 问题反馈纵向的数据与 RBAC 边界；diagnostics 以显式列承载，协议层多出的任意键没有落点。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table ent_feedback
(
    id                       bigint primary key,
    tenant_id                varchar(20)  not null,
    submitter_user_id        bigint       not null,
    device_id                varchar(128) not null,
    type                     varchar(16)  not null,
    description              varchar(510) not null,
    occurred_at              timestamptz  not null,
    contact                  varchar(160),
    consent                  boolean      not null,
    status                   varchar(16)  not null default 'NEW',
    status_note              varchar(500),
    status_changed_by        bigint,
    status_changed_at        timestamptz,
    revision                 bigint       not null default 0,
    plugin_version           varchar(64),
    host_version             varchar(64),
    os                       varchar(64),
    reported_installation_id varchar(128),
    last_error_code          varchar(64),
    -- 可选幂等键：桌面端重试不应产生重复反馈；不传则每次提交都是新行。
    idempotency_key          varchar(36),
    created_at               timestamptz  not null default now(),
    updated_at               timestamptz  not null default now(),
    constraint ck_ent_feedback_type check (type in ('ISSUE', 'SUGGESTION')),
    constraint ck_ent_feedback_status check (status in ('NEW', 'TRIAGED', 'RESOLVED', 'IGNORED')),
    constraint ck_ent_feedback_description check (char_length(description) between 1 and 510),
    constraint ck_ent_feedback_contact check (contact is null or char_length(contact) between 3 and 160),
    -- 同意是提交的硬前提：数据库与领域层同时拒绝，历史行永远不可能出现 consent=false。
    constraint ck_ent_feedback_consent check (consent),
    -- NEW 行必须没有处置痕迹；离开 NEW 必须记录处置人和时间，使"谁在何时处置"不依赖审计旁证。
    constraint ck_ent_feedback_status_audit check (
        (status = 'NEW' and status_note is null and status_changed_by is null and status_changed_at is null)
        or (status <> 'NEW' and status_changed_by is not null and status_changed_at is not null)
    ),
    constraint ck_ent_feedback_revision check (revision >= 0),
    constraint ck_ent_feedback_error_code check (
        last_error_code is null or last_error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'
    ),
    constraint fk_ent_feedback_submitter foreign key (submitter_user_id)
        references sys_user (user_id) on delete restrict,
    constraint fk_ent_feedback_handler foreign key (status_changed_by)
        references sys_user (user_id) on delete restrict
);

-- 管理端默认按 id 倒序 keyset 翻页；带状态筛选时走第二条复合索引。
create index ix_ent_feedback_tenant_id on ent_feedback (tenant_id, id desc);

create index ix_ent_feedback_tenant_status_id on ent_feedback (tenant_id, status, id desc);

-- 幂等只在提交者提供 Idempotency-Key 时生效；同一提交者的同一键至多一行。
create unique index ux_ent_feedback_idempotency
    on ent_feedback (tenant_id, submitter_user_id, idempotency_key)
    where idempotency_key is not null;

create table ent_feedback_attachment
(
    id           bigint primary key,
    tenant_id    varchar(20)   not null,
    feedback_id  bigint        not null,
    seq          smallint      not null,
    artifact_ref varchar(1024) not null,
    sha256       varchar(64)   not null,
    content_type varchar(64)   not null,
    size_bytes   bigint        not null,
    width        integer       not null,
    height       integer       not null,
    created_at   timestamptz   not null default now(),
    -- 一期产品上限：最多 3 张位图，单张 2 MiB，单边 8192 像素；与领域层常量同构。
    constraint ck_ent_feedback_attachment_seq check (seq between 1 and 3),
    constraint ck_ent_feedback_attachment_sha256 check (sha256 ~ '^[0-9a-f]{64}$'),
    constraint ck_ent_feedback_attachment_content_type check (
        content_type in ('image/png', 'image/jpeg', 'image/webp')
    ),
    constraint ck_ent_feedback_attachment_size check (size_bytes > 0 and size_bytes <= 2097152),
    constraint ck_ent_feedback_attachment_dimensions check (
        width > 0 and height > 0 and width <= 8192 and height <= 8192
    ),
    constraint uq_ent_feedback_attachment_seq unique (feedback_id, seq),
    constraint fk_ent_feedback_attachment_feedback foreign key (feedback_id)
        references ent_feedback (id) on delete restrict
);

-- 权限码与菜单节点一次到位：V32 只登记 F 型权限码导致侧栏无入口，本迁移照 V33 补齐 C 型节点。
insert into sys_menu (
    menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache,
    menu_type, visible, status, perms, icon, create_time, remark
) values
    (1900400000000001023, '反馈读取', 1900400000000000000, 20, '', '', 'N', 'Y', 'F', '1', '0', 'ent:feedback:read', '#', now(), '固定产品权限'),
    (1900400000000001024, '反馈写入', 1900400000000000000, 21, '', '', 'N', 'Y', 'F', '1', '0', 'ent:feedback:write', '#', now(), '固定产品权限');

-- 反馈页菜单节点：逐列镜像既有「插件分发」C 型行，component 与 console 既有页面路径同构。
insert into sys_menu (
    menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache,
    menu_type, visible, status, perms, icon, create_time, remark
) values
    (1900400000000001025, '问题反馈', 1900400000000000000, 7, 'feedback', 'enterprise/feedback/index',
     'N', 'Y', 'C', '0', '0', 'ent:feedback:read', 'message', now(), '员工问题反馈处置');

-- 固定角色权限只能由版本化 migration 调整；事务结束前恢复运行时不可变保护（同 V17/V32/V33 范式）。
alter table sys_role_menu disable trigger trg_ent_built_in_role_menu_immutable;

insert into sys_role_menu (role_id, menu_id) values
    (1900300000000000001, 1900400000000001023),
    (1900300000000000001, 1900400000000001024),
    (1900300000000000001, 1900400000000001025);

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
    'BRANDING_PUBLISHED', 'BRANDING_ROLLED_BACK',
    'FEEDBACK_SUBMITTED', 'FEEDBACK_STATUS_CHANGED'
));
