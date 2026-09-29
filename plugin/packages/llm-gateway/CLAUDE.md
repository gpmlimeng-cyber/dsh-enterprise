# llm-gateway/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: 企业受管模型配置桥说明，冻结官方协议所有权与企业治理边界。
package.json: 私有 workspace package 清单，只直接依赖平台客户端并按官方 caret 规则声明 dsh-llm-pi-ai 兼容 peer。
tsconfig.json: Node/Web Streams ESM 声明边界，仅跳过链接上游 Anthropic SDK 的损坏声明检查。
src/index.ts: package facade，只导出 profile、认证代理与官方插件注册三个边界。
src/profiles.ts: 将 bootstrap 模型事实和短生命期代理 bearer 按三种 wire API/SDK base URL 约定投影为 PiAi profiles/default sentinel，不覆盖官方 provider 重试策略。
src/proxy.ts: 自有随机端口与 bearer 的 Host 私有 loopback 代理，透明 relay 原生 JSON/SSE 与 Retry-After，并把非重试 429 标记为官方 pi-ai 可识别的终态 quota 错误。
src/registration.ts: 在活动 profile 里定位**已挂载**的官方 `llm-pi-ai` entry，经 Loader 的 config 写入面把企业 route 合并进它 volatile 的 `providers`（只写内存，不落 profile 文档），按 bootstrap 指纹幂等更新，释放时撤回企业键；官方 base 行缺席即报错而不自建第二份实例。
tests/profiles.spec.ts: 验证三协议 route、SDK base URL、default sentinel、容量、reasoningEfforts 纯投影与官方重试默认值继承。
tests/registration.spec.ts: 用假的官方 Loader owner row 验证企业 routes 并入已挂载的 pi-ai entry、用户 provider 逐字保留、释放时只撤回企业键，以及官方行缺席时报错而不自建实例。
tests/proxy.spec.ts: 验证认证、relay、quota/Retry-After，并通过锁定官方三协议客户端验证首事件错误不会变成成功 EOF。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
