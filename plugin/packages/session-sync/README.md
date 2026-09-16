# @dshent/session-sync

企业 Session 同步客户端。**默认关闭**；`enterprise.session.enabled=false` 时零 Session 扫描、零 HTTP。

## P2b 边界

- 已提供：dirty 标记、2s 防抖、单 session worker、`maxBatchBytes` 切批、T16 `POST .../batches` 线协议、游标原子写、终态不自动重试。
- 未提供：bundle 接线、UI tab、platform-client 本地 API、restore。
- 运行时**不** import `@deepseek-ai/dsh-session*`；通过结构端口注入 `sessions.flush` / `sessionPersistence.readFrom` / uploader。

## 结构端口（Harness 0.1.1-rc.2）

```ts
sessions.flush(session): Promise<boolean>
sessionPersistence.readFrom(id, fromSeq, signal?): Promise<{ meta, events }>
uploader.appendBatch(sessionId, body, signal): Promise<{ acceptedThroughSeq, rollingHash }>
```

## 游标

`$DSH_HOME/enterprise/session-sync.json`（formatVersion=1，兼容 P2a）。
