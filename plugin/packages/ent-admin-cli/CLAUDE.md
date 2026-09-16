# ent-admin-cli/

> L2 | 父级: ../CLAUDE.md

成员清单

package.json: `@dshent/ent-admin-cli` 清单，bin=`dsh-ent-admin`，依赖 workspace contracts，Node 22 ESM。
tsconfig.json: 继承 plugin base，输出 `lib/`，仅 Node lib/types。
README.md: 使用入口与 Agent `--json` 契约摘要。
src/paths.ts: `~/.dsh-ent-admin`（或 `DSH_ENT_ADMIN_HOME`）路径定位。
src/config.ts: Server origin 读写与 `--server` / env 覆盖。
src/installation.ts: 非秘密 installation UUID 落盘。
src/credentials.ts: Refresh Token 0600 落盘；Access 永不写入。
src/pkce.ts: RFC 7636 S256 与 127.0.0.1 回环 callback。
src/browser.ts: 系统浏览器 argv 打开。
src/auth.ts: PKCE login、token 交换、设备 enroll、refresh 轮换、logout/status。
src/http.ts: Bearer fetch 与稳定错误 envelope。
src/output.ts: stdout JSON / stderr 人类日志 / exit code 契约。
src/cli.ts: parseArgs 分发与只读 domain 命令。
tests/: config/credentials/pkce/cli 契约与边界单测。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
