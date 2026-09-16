# @dshent/session-sync

企业 Session 同步客户端（P2a 骨架）。

- **默认关闭**：`enterpriseSessionEnabled=false` 时不扫 sessions、不发 HTTP、不写游标。
- **启用后**：创建 `idle` 服务并写入/读取 `$DSH_HOME/enterprise/session-sync.json`。
- **上传 / pull / restore**：P2b+；本包不注册 `enterpriseSessionSync` 到 bundle（V1 门禁仍禁止 bundle 产物出现该符号）。

```bash
pnpm --filter @dshent/session-sync typecheck
pnpm --filter @dshent/session-sync test
```
