# session-sync/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: 企业 Session 同步客户端骨架说明；P2a 不上传、不恢复，仅游标与开关。
package.json: 私有 workspace 包清单；不依赖 dsh-session 真 API（P2b 接入）。
src/types.ts: 游标文件、服务状态与寄存器 deps 契约。
src/errors.ts: 稳定错误码 ENT_SESSION_CURSOR_INVALID / ENT_SESSION_SYNC_DISABLED。
src/cursor-store.ts: enterprise/session-sync.json 严格解析与原子写。
src/service.ts: EnterpriseSessionSyncService：disabled/idle，无网络。
src/index.ts: registerSessionSync + 包导出。
tests/cursor-store.spec.ts: 游标 roundtrip 与非法文件。
tests/register.spec.ts: enabled=false 零副作用；enabled=true 为 idle。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
