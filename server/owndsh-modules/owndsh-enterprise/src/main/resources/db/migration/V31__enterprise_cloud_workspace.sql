-- [INPUT]: 依赖 V1 企业 tenant/sys_user 基线与应用雪花 ID。
-- [OUTPUT]: 建立云端项目与成员两表，slug 在 tenant 内唯一，角色 OWNER/MEMBER。
-- [POS]: 云端工作空间数据边界；Git bare 路径由应用 repo-root + projectId 派生，不入库任意路径。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table ent_cloud_project
(
    id            bigint primary key,
    tenant_id     varchar(20)  not null,
    slug          varchar(64)  not null,
    name          varchar(120) not null,
    description   text,
    default_branch varchar(64) not null default 'main',
    created_by    bigint       not null,
    status        varchar(16)  not null,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz  not null default now(),
    constraint fk_ent_cloud_project_creator foreign key (created_by)
        references sys_user (user_id) on delete restrict,
    constraint ck_ent_cloud_project_status check (status in ('ACTIVE', 'DISABLED')),
    constraint ck_ent_cloud_project_slug check (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
    constraint ck_ent_cloud_project_name check (char_length(name) between 1 and 120),
    constraint ck_ent_cloud_project_branch check (default_branch ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,62}$'),
    constraint uq_ent_cloud_project_slug unique (tenant_id, slug)
);

create table ent_cloud_project_member
(
    project_id bigint       not null,
    user_id    bigint       not null,
    role       varchar(16)  not null,
    created_at timestamptz  not null default now(),
    constraint pk_ent_cloud_project_member primary key (project_id, user_id),
    constraint fk_ent_cloud_member_project foreign key (project_id)
        references ent_cloud_project (id) on delete cascade,
    constraint fk_ent_cloud_member_user foreign key (user_id)
        references sys_user (user_id) on delete restrict,
    constraint ck_ent_cloud_member_role check (role in ('OWNER', 'MEMBER'))
);

create index ix_ent_cloud_project_tenant_created
    on ent_cloud_project (tenant_id, created_at desc, id desc);

create index ix_ent_cloud_member_user
    on ent_cloud_project_member (user_id, project_id);

-- 云端项目治理审计：与 AuditAction 枚举保持同构。
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
    'CLOUD_PROJECT_CREATED', 'CLOUD_PROJECT_MEMBER_ADDED', 'CLOUD_PROJECT_MEMBER_REMOVED',
    'ROLE_ASSIGNED', 'USER_STATUS_CHANGED', 'CONFIG_CHANGED',
    'PRESET_VERSION_UPLOADED', 'PRESET_VERSION_PUBLISHED', 'PRESET_VERSION_RETIRED',
    'PRESET_ASSIGNMENTS_REPLACED', 'PRESET_DOWNLOAD_AUTHORIZED'
));
