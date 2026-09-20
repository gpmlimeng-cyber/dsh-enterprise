# llm-gateway/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: 企业受管模型配置桥说明，冻结官方协议所有权与企业治理边界。
package.json: 私有 workspace package 清单，只直接依赖平台客户端并按官方 caret 规则声明 dsh-llm-pi-ai 兼容 peer。
tsconfig.json: Node/Web Streams ESM 声明边界，仅跳过链接上游 Anthropic SDK 的损坏声明检查。
src/index.ts: package facade，只导出 profile、认证代理与官方插件注册三个边界。
src/profiles.ts: 将 bootstrap 模型事实和短生命期代理 bearer 按三种 wire API/SDK base URL 约定投影为 PiAi profiles/default sentinel，不覆盖官方 provider 重试策略；官方选择器按 provider 1:1 分组，故单协议快照把全部模型并入唯一 `enterprise` provider（组名=协议标签）以只产生一个分组，多协议退回按协议分组并保留独立哨兵组；哨兵展示名固定 `跟随管理员默认`，不得再拼「企业」后缀。
src/proxy.ts: 自有随机端口与 bearer 的 Host 私有 loopback 代理，透明 relay 原生 JSON/SSE 与 Retry-After，并把非重试 429 标记为官方 pi-ai 可识别的终态 quota 错误。
src/registration.ts: 启停 Host 官方 dsh-llm-pi-ai，按 bootstrap profile 指纹动态更新，并在档案发布前后同步官方 agentDefaultModel（占位哨兵收起为稳态真实模型，用户自选默认不覆盖）。
src/default-model.ts: 占位哨兵桥接判定、模型归属 provider 解析与管理员默认采纳决策的纯逻辑端口。
tests/profiles.spec.ts: 验证三协议/单协议合并、稳态无哨兵、桥接态含哨兵且名称无「企业」后缀、容量与官方重试默认值继承。
tests/default-model.spec.ts: 验证占位桥接、provider 归属、采纳决策（含用户自定义保护）与 adoptAdminDefault 写入/对齐语义。
tests/proxy.spec.ts: 验证认证、relay、quota/Retry-After，并通过锁定官方三协议客户端验证首事件错误不会变成成功 EOF。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
