-- [INPUT]: 依赖 V0 的 baseline 与 sys_user（创建/更新人外键）、V4 固定角色与 sys_menu/sys_role_menu 的既有 idiom（V30 那条「固定产品权限」三件套：insert sys_menu + 关/开 trg_ent_built_in_role_menu_immutable + insert sys_role_menu）、V36 的审计 action 白名单，以及应用提供的雪花 ID。
-- [OUTPUT]: 建立连接器**企业侧最小账本**两张表（`ent_connector` 条目 / `ent_connector_assignment` 可见范围）与索引、约束，新增 `ent:connector:read` / `ent:connector:write` 两枚固定产品权限并挂到两个内置角色，并把审计 action 白名单扩**六枚**连接器动作。
-- [POS]: 连接器纵深 P0-4 的数据与 RBAC 边界（`docs/plan/connector-architecture.md` §6.1/§6.3/§6.5 与 §7 的 P0-4 行）。**只落表、权限与审计白名单**：HTTP/投影/契约、宿主侧下发与呈现（P0-5）由后面的刀接；本迁移不碰任何既有表结构（除了重述审计白名单这一条既有 idiom）。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

-- 五条与 bundle 侧域模型（`dshent` 的 `connector/*`）逐条对齐的口径，实施时不许改：
-- ① **`descriptor` 里只允许凭据引用、绝不落值**：bundle 侧 `renderConnectorBundle` 对任何"把值写进配置"的形状抛
--    `ENT_CONNECTOR_SECRET_INLINE`（`src/connector/bundle.ts`），服务端在 application 层做同一件事（`ConnectorDescriptorGate`），
--    本表因此**只有引用**。列名叫 `descriptor` 而不是 `endpoint`，是因为它同时承载 stdio/http 两种端点形状。
-- ② **`server_name` 在租户内唯一**（`uq_ent_connector_server_name`）：它是官方 MCP 命名空间，决定模型看到的
--    工具名 `mcp__<serverName>__<tool>`（`dsh-mcp-client/README.md:75`、`:108`）——同名两条连接会让员工侧的工具名
--    不可预期，故这是**数据库侧的第二道闸**（应用侧还有一道）。
-- ③ **`connector_id` 的形状与 bundle 侧同一把尺**（`^[a-z0-9]+(-[a-z0-9]+)*$`，≤64）：它是企业目录里的稳定标识，
--    也是 bundle 落点目录名（`<dshHome>/enterprise/connector-bundles/<id>/<digest>`）。
-- ④ **`revision` 是 CAS 闸**：全量替换可见范围、更新条目都带 `expected_revision`，撞版本即冲突（与配方/技能同形）。
-- ⑤ **审计只扩白名单、不改既有动作**：六枚新动作按 §6.5 的"必须记录的六类事件"命名，与 `AuditAction.java`
--    的枚举**必须逐字一致**（枚举是 Java 侧真源，两侧不同步就是 running 时的 check 违约）。

create table ent_connector
(
    id           bigint primary key,
    tenant_id    varchar(20)  not null,
    connector_id varchar(64)  not null,
    display_name varchar(120) not null,
    summary      text,
    status       varchar(16)  not null,
    transport    varchar(16)  not null,
    server_name  varchar(32)  not null,
    -- 端点与**凭据引用**（stdio: command/args/env 引用；http: url/headers 引用）。形状由应用层闸门收窄。
    descriptor   jsonb        not null,
    -- §3.1 的能力声明集合（十四条字段/条）；层级**不在这里**（只能由求值器算，见 §3.2 纪律 2）。
    capabilities jsonb        not null,
    -- 管理员设的**上限**与额度（等级上限 / 额度窗口）；员工只能再收紧。
    policy       jsonb        not null,
    created_by   bigint       not null,
    updated_by   bigint       not null,
    created_at   timestamptz  not null default now(),
    updated_at   timestamptz  not null default now(),
    revision     bigint       not null default 0,
    constraint fk_ent_connector_creator foreign key (created_by)
        references sys_user (user_id) on delete restrict,
    constraint fk_ent_connector_updater foreign key (updated_by)
        references sys_user (user_id) on delete restrict,
    constraint ck_ent_connector_status check (status in ('DRAFT', 'ACTIVE', 'DISABLED')),
    constraint ck_ent_connector_revision check (revision >= 0),
    constraint ck_ent_connector_display_name check (char_length(display_name) between 1 and 120),
    constraint ck_ent_connector_connector_id check (connector_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint ck_ent_connector_server_name check (server_name ~ '^[A-Za-z0-9_-]{1,32}$'),
    -- 传输词表与 bundle 侧 `CONNECTOR_TRANSPORTS` 的**九个成员一一对应**（库内大写是本仓既有 idiom，
    -- 下发到宿主时由应用层映射回小写词表 `mcp`/`http`/…）；加一枚要三处一起加：这里、`ConnectorEntry.Transport`、bundle 侧常量。
    constraint ck_ent_connector_transport check (transport in (
        'MCP', 'HTTP', 'OPENAPI', 'A2A', 'ACP', 'IM_WEBHOOK', 'SMTP', 'IMAP', 'MQTT'
    )),
    constraint uq_ent_connector_connector_id unique (tenant_id, connector_id),
    constraint uq_ent_connector_server_name unique (tenant_id, server_name)
);

-- 控制台按创建时间倒序翻页（与配方/技能同一把尺）。
create index ix_ent_connector_created on ent_connector (tenant_id, created_at desc, id desc);

create table ent_connector_assignment
(
    id           bigint primary key,
    tenant_id    varchar(20) not null,
    connector_id bigint      not null,
    subject_type varchar(16) not null,
    subject_id   bigint,
    status       varchar(16) not null,
    revision     bigint      not null default 0,
    constraint fk_ent_connector_assignment_connector foreign key (connector_id)
        references ent_connector (id) on delete restrict,
    constraint ck_ent_connector_assignment_subject_type check (subject_type in ('ALL', 'USER')),
    constraint ck_ent_connector_assignment_subject check (
        (subject_type = 'ALL' and subject_id is null)
        or (subject_type = 'USER' and subject_id is not null)
    ),
    constraint ck_ent_connector_assignment_status check (status in ('ACTIVE', 'DISABLED')),
    constraint ck_ent_connector_assignment_revision check (revision >= 0)
);

-- 同一条连接对同一个主体只能有一条 assignment（全量替换因此是"删光再插"而不是"改一行"）。
create unique index ux_ent_connector_assignment_user
    on ent_connector_assignment (connector_id, subject_type, subject_id)
    where subject_type = 'USER';

create unique index ux_ent_connector_assignment_all
    on ent_connector_assignment (connector_id)
    where subject_type = 'ALL' and subject_id is null;

-- 员工侧"我可见的连接"是一条 (tenant_id, subject_type, subject_id, status) 查询。
create index ix_ent_connector_assignment_visible
    on ent_connector_assignment (tenant_id, subject_type, subject_id, status);

-- 固定产品权限：连接器读取 / 写入。id 取 1900400000000001028/1029（已核全仓零命中；V30 用 1018/1019）。
insert into sys_menu (
    menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache,
    menu_type, visible, status, perms, icon, create_time, remark
) values
    (1900400000000001028, '连接读取', 1900400000000000105, 5, '', '', 'N', 'Y', 'F', '1', '0', 'ent:connector:read', '#', now(), '固定产品权限'),
    (1900400000000001029, '连接写入', 1900400000000000105, 6, '', '', 'N', 'Y', 'F', '1', '0', 'ent:connector:write', '#', now(), '固定产品权限');

alter table sys_role_menu disable trigger trg_ent_built_in_role_menu_immutable;

insert into sys_role_menu (role_id, menu_id) values
    (1900300000000000001, 1900400000000001028),
    (1900300000000000001, 1900400000000001029),
    (1900300000000000003, 1900400000000001028),
    (1900300000000000003, 1900400000000001029);

alter table sys_role_menu enable trigger trg_ent_built_in_role_menu_immutable;

-- 审计 action 白名单：重述上一版（V36）全部动作 + 六枚连接器动作。
-- 六枚按 §6.5「必须记录的六类事件」逐条对应：
--   CONNECTOR_GRANTED          连接授权授予
--   CONNECTOR_REVOKED          连接授权撤销
--   CONNECTOR_INBOUND_RECEIVED 入站事件接收（含验签结果；`metadata` 里放 signed/verified，不放正文）
--   CONNECTOR_OUTBOUND_SENT    出站动作发起
--   CONNECTOR_DENIED           动作被策略拒绝
--   CONNECTOR_UNSUPPORTED      平台不支持被命中（"这台设备暂不支持"也要留痕，否则无法回答"为什么没人用"）
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
    'FEEDBACK_SUBMITTED', 'FEEDBACK_STATUS_CHANGED',
    'SKILL_VERSION_UPLOADED', 'SKILL_VERSION_PUBLISHED', 'SKILL_VERSION_RETIRED',
    'SKILL_ASSIGNMENTS_REPLACED', 'SKILL_DOWNLOAD_AUTHORIZED', 'SKILL_MARKS_CHANGED',
    'CONNECTOR_GRANTED', 'CONNECTOR_REVOKED', 'CONNECTOR_INBOUND_RECEIVED',
    'CONNECTOR_OUTBOUND_SENT', 'CONNECTOR_DENIED', 'CONNECTOR_UNSUPPORTED'
));
