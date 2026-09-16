# session-sync/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: 企业 Session 同步客户端说明；P2b 上传链路可用，未接 bundle/restore。
package.json: 私有 workspace 包清单；运行时不依赖 dsh-session 真包（结构端口注入）。
src/types.ts: 游标、Syncable 端口、批次 DTO、寄存器 deps 与 handle 契约。
src/errors.ts: 稳定错误码、终态集合与 SessionUploadError。
src/hash.ts: H[-1]/H[n] rolling hash 与 payload SHA-256 canonical Base64。
src/batch.ts: JSONL 编码与按 maxBatchBytes 切批。
src/wire.ts: idempotencyKey、T16 批次 body 组装与最终 rolling hash。
src/cursor-store.ts: enterprise/session-sync.json 严格解析与原子写（含 rollingHashes/terminalErrors/pushedAt）。
src/upload-worker.ts: dirty/防抖/单 session worker/游标推进/终态/dispose。
src/host-bridge.ts: tryRegisterHostSessionSync——仅 sessionPolicy.enabled 时注入 ports 并注册；未启用零 HTTP。
src/service.ts: disabled|idle|uploading 服务与 registerSessionSync 开关语义。
src/index.ts: 包 facade 导出。
tests/cursor-store.spec.ts: 游标 roundtrip、P2a 兼容与非法文件。
tests/register.spec.ts: enabled=false 零副作用；无 ports 时为 idle。
tests/batch-wire.spec.ts: 切批、JSONL、rolling hash 与批次 body。
tests/upload.spec.ts: mock 上传、多批、终态、断点续传。
tests/host-bridge.spec.ts: Host 桥 enabled 判定、挂载上传与登出卸载。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
