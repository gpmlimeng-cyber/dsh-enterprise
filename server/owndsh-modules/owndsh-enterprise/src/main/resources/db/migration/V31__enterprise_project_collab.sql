-- [INPUT]: 依赖 V1 sys_user、V4 审计 action check 约束与应用雪花 ID。
-- [OUTPUT]: 建立项目/成员/协作消息三表，并把五类 PROJECT/COLLAB 审计 action 并入白名单。
-- [POS]: Project 协作信道的数据边界；消息是社会层，不进入 ent_session_event。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table ent_project
(
    id            bigint primary key,
    tenant_id     varchar(20)  not null,
    name          varchar(128) not null,
    owner_user_id bigint       not null,
    status        varchar(16)  not null,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz  not null default now(),
    deleted_at    timestamptz,
    constraint fk_ent_project_owner foreign key (owner_user_id)
        references sys_user (user_id) on delete restrict,
    constraint ck_ent_project_name check (char_length(btrim(name)) between 1 and 128),
    constraint ck_ent_project_status check (status in ('ACTIVE', 'ARCHIVED')),
    constraint ck_ent_project_deleted check (
        (status = 'ACTIVE' and deleted_at is null)
        or (status = 'ARCHIVED' and deleted_at is not null)
    )
);

create unique index ux_ent_project_active_name
    on ent_project (tenant_id, name)
    where status = 'ACTIVE';

create index ix_ent_project_owner on ent_project (tenant_id, owner_user_id, id);

create table ent_project_member
(
    project_id bigint      not null,
    user_id    bigint      not null,
    tenant_id  varchar(20) not null,
    role       varchar(16) not null,
    joined_at  timestamptz not null default now(),
    constraint pk_ent_project_member primary key (project_id, user_id),
    constraint fk_ent_project_member_project foreign key (project_id)
        references ent_project (id) on delete cascade,
    constraint fk_ent_project_member_user foreign key (user_id)
        references sys_user (user_id) on delete restrict,
    constraint ck_ent_project_member_role check (role in ('OWNER', 'MEMBER'))
);

create index ix_ent_project_member_user on ent_project_member (tenant_id, user_id, project_id);

create table ent_collab_message
(
    id                 bigint primary key,
    tenant_id          varchar(20)  not null,
    project_id         bigint       not null,
    server_seq         bigint       not null,
    author_user_id     bigint       not null,
    kind               varchar(32)  not null,
    body               varchar(4000) not null,
    target_session_id  varchar(128),
    target_seq         bigint,
    idempotency_key    varchar(255) not null,
    created_at         timestamptz  not null default now(),
    constraint fk_ent_collab_message_project foreign key (project_id)
        references ent_project (id) on delete cascade,
    constraint fk_ent_collab_message_author foreign key (author_user_id)
        references sys_user (user_id) on delete restrict,
    constraint ck_ent_collab_message_seq check (server_seq >= 0),
    constraint ck_ent_collab_message_kind check (
        kind in ('CHAT', 'MENTION', 'SYSTEM', 'INJECT_REQUEST')
    ),
    constraint ck_ent_collab_message_body check (char_length(btrim(body)) between 1 and 4000),
    constraint ck_ent_collab_message_target check (
        (kind in ('MENTION', 'INJECT_REQUEST') and target_session_id is not null)
        or (kind in ('CHAT', 'SYSTEM') and target_session_id is null)
    ),
    constraint ck_ent_collab_message_target_seq check (target_seq is null or target_seq >= 0),
    constraint uq_ent_collab_message_seq unique (project_id, server_seq),
    constraint uq_ent_collab_message_idem unique (project_id, idempotency_key)
);

create index ix_ent_collab_message_list on ent_collab_message (project_id, server_seq);

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
    'PROJECT_CREATED', 'PROJECT_MEMBER_ADDED', 'PROJECT_MEMBER_REMOVED',
    'PROJECT_OWNER_TRANSFERRED', 'COLLAB_MESSAGE_POSTED'
));
