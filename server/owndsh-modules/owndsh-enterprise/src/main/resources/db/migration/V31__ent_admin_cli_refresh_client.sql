-- [INPUT]: 依赖 V28 的 ent_refresh_session 表与 PlatformClient ent-admin-cli 扩展。
-- [OUTPUT]: 放宽 refresh session client_id 检查，允许 dsh-desktop 与 ent-admin-cli。
-- [POS]: 管理员 CLI PKCE 设备流的落库约束修复；不改变既有 desktop 行。
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
ALTER TABLE ent_refresh_session DROP CONSTRAINT ck_ent_refresh_session_client;
ALTER TABLE ent_refresh_session ADD CONSTRAINT ck_ent_refresh_session_client
    CHECK (client_id IN ('dsh-desktop', 'ent-admin-cli'));
