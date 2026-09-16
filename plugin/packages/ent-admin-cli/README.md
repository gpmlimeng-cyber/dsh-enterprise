<!--
[INPUT]: 依赖 @dshent/contracts 与 Desktop PKCE 设备流协议（client_id=dsh-desktop）。
[OUTPUT]: 提供 dsh-ent-admin 只读查询 CLI、--json Agent 契约与本地凭据边界说明。
[POS]: plugin workspace 的管理员/Agent 终端入口，不进入 Harness Host，不做写操作。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# @dshent/ent-admin-cli

`dsh-ent-admin`：DSH Enterprise 控制面只读 CLI。管理员与带 shell 的 AI Agent 在终端查询成员、设备、模型、配额、插件与审计。

```bash
dsh-ent-admin login --server https://dsh.example.com
dsh-ent-admin members list --json
dsh-ent-admin models list --json
dsh-ent-admin audit list --request-id req_... --json
```

鉴权走与 Desktop 相同的 PKCE 设备流（`client_id=dsh-desktop`）。Access Token 只在进程内存；Refresh Token 写在 `~/.dsh-ent-admin/credentials.json`（0600）。

第一期只读。MCP、写操作、API Token 见 spec Out of Scope。
