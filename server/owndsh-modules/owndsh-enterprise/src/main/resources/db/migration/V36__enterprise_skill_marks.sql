-- [INPUT]: 依赖 V35 的 ent_skill_package 与 ent_audit_event 的 action check 约束。
-- [OUTPUT]: 为技能包新增 builtin/featured 两个标记列（既有行回填 false）并扩展审计 action 白名单。
-- [POS]: 企业技能目录的标记扩展；builtin 参与 runtime 默认可见性，featured 当前只存储、不产生任何界面行为。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

-- 两列都必须 not null default false：内置可见性只能由管理端显式开启，不能靠 NULL 语义漂移。
-- alter table add column ... default 只回填既有行一次，重复执行安全（列已存在则报错而不产生半成品数据）。
alter table ent_skill_package add column builtin boolean not null default false;

alter table ent_skill_package add column featured boolean not null default false;

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
    'SKILL_ASSIGNMENTS_REPLACED', 'SKILL_DOWNLOAD_AUTHORIZED', 'SKILL_MARKS_CHANGED'
));
