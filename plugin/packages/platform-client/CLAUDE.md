# platform-client/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: 平台客户端使用与安全边界，记录可选安装默认值、官方 settings 地址持久化、本地 API 和 Token 不出 Host 约束。
package.json: 私有 workspace package 清单，声明 caret-compatible Cordis/credentials/settings/Schemastery peers、T02 contracts 与 strict Zod 运行依赖。
tsconfig.json: Host TypeScript 构建边界，从 `src/` 生成 ESM、声明与 sourcemap 到 `lib/`。
src/browser.ts: 通过无 shell argv 调用系统 URL opener，向 PKCE 事务提供可取消桌面浏览器交接。
src/index.ts: package 公开入口，集中导出 Service、PKCE、installation、bootstrap、本地 API 契约与地址写入诊断串。
src/installation.ts: 统一解析 DSH_HOME 并原子维护 `enterprise/device.json`，严格限定 UUID v4、显示名和创建时间。
src/local-api.ts: exact/prefix 同源路由暴露企业目录、严格 package/version 安装与 package 卸载动作，以及 Server/账号/Session JSON 与显式刷新；执行端口由 bundle 反向注入以避免依赖环，`onError` 只上报操作名/原始 error/最终状态码而不改响应语义。
src/pkce.ts: PKCE S256 生成、仅绑定 `127.0.0.1` 的 callback、state/取消/超时生命周期。
src/platform-credentials.ts: 独占官方 GrantRecord 与内存 Access Token，在 credentials 原子修改边界内轮换 Refresh Token，并阻止过期 origin 或已销毁 Service 重新装载认证态。
src/platform-service.ts: 注册 `ctx.enterprisePlatform`，把 Server 地址收敛到官方 rc.2 settings 中 owner profile entry 的 volatile Config 引用（命名空间即 entry id，写入经 `settings.update`，官方 Settings 不生成页面），保存期间禁止登录；写回判定只看**本次写入的新值**，空串按「未设置」跳过（首次配置不得被当成非法旧值抹掉），连接态或非法的外部改址写回最近一次被接受的有效地址，不可持久化时报 `ENT_SETTINGS_UNAVAILABLE`，且五个不可持久化判定点（entry id 缺失 / volatile 引用缺失 / `configure` 抛错 / 写入端口未装配 / `settings.update` 抛错）都在抛错前经 Host logger 留下 operation、地址、entryId、entry 可见性与原始 error；编排登出、启动恢复、按需续期/401 单次重放、会话代次隔离与显式 bootstrap 刷新。
src/settings-diagnostics.ts: 地址写入诊断层，按结构只读官方 `configEditor.entries()`（含全局 id/name/runtime/ACTIVE/configKeys/schema 与 volatile 字段名）与 settings 的能力位，并给出异常 name/message/code/stack 摘要；刻意不调用会广播 `settings/document-updated` 的官方 `describe()`，保证探测零副作用。
src/types.ts: 复用生成契约严格校验含空签名制品的 Bootstrap、模型、配额与受管插件，定义公共 Service 配置（含官方 volatile Server 地址引用与 `settingsReference` 识别）、稳定错误及无秘密状态 DTO。
tests/installation.spec.ts: 并发首次启动、0600 权限、字段白名单与损坏文件 fail-closed 验收。
tests/local-api.spec.ts: 真实 Node HTTP 下的 Server 更新、整包卸载、平台/插件/Session 路由、严格 DTO、无 SSE、显式刷新、探针退役与 disposer 验收。
tests/pkce.spec.ts: S256、精确 callback、state、取消和超时的 Vitest 验收。
tests/platform-service.spec.ts: 真实 socket 下验证无签名 bootstrap、退出后才可修改 Server、首次配置在 volatile 引用尚未追上文档时不被写回抹掉、非 origin 的外部改址被写回最近一次有效地址、连接态的外部 settings 改址被写回旧地址、地址不可持久化时返回 `ENT_SETTINGS_UNAVAILABLE`、保存/认证互斥与旧账号不复活，以及 GrantRecord 恢复、按需轮换、超时、闲置零请求和退出竞态。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
