# session-sync/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: 企业 Session 同步客户端说明；P2b 上传 + P2c 恢复 + P2d host-bridge。
package.json: 私有 workspace 包清单；运行时不依赖 dsh-session 真包（结构端口注入）。
src/types.ts: 游标、Syncable 端口、批次 DTO、寄存器 deps 与 handle 契约。
src/errors.ts: 稳定错误码、终态集合与 SessionUploadError。
src/hash.ts: H[-1]/H[n] rolling hash 与 payload SHA-256 canonical Base64。
src/batch.ts: JSONL 编码与按 maxBatchBytes 切批。
src/wire.ts: idempotencyKey、T16 批次 body 组装与最终 rolling hash。
src/cursor-store.ts: enterprise/session-sync.json 严格解析与原子写。
src/upload-worker.ts: dirty/防抖/单 session worker/游标推进/终态/dispose。
src/restore.ts: 远端列表、export 分页校验、sessions.create 新 ID 与 restore-record。
src/local-port.ts: createHostSessionLocalPort——本地 API 用的脱敏投影端口。
src/host-bridge.ts: tryRegisterHostSessionSync——仅 sessionPolicy.enabled 时挂载。
src/service.ts: disabled|idle|uploading 服务与 registerSessionSync 开关语义。
src/index.ts: 包 facade 导出。
tests/*: 游标、注册、切批、上传、Host 桥与恢复链路验收。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
