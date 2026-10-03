# plugin-distribution/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: 受管插件默认免公钥安装、可选验签、HTTP 内网信任边界、CLI 调和与整包卸载说明；兼容判定四子句表（哪些硬拦、哪些只警告）、诚实映射口径与 `harness_commits` 补齐/重签运维记录。
package.json: 私有 workspace package 清单，声明兼容 Harness subprocess/inventory peer 与可打包产品依赖。
tsconfig.json: Node TypeScript 构建边界，从 `src/` 生成 ESM、声明与 sourcemap。
src/cli.ts: Web 走官方 `ctx.subprocess`、Desktop 走公开 command port 的单一 argv 边界，显式透传 DSH_HOME 并限制诊断输出。
src/errors.ts: 本地稳定分发错误码，状态文件和库存只持久化 code 而不保存中心正文。
src/index.ts: package facade、Cordis Context 合并与公开类型出口（含进程内 `CompatibilityWarning`）。
src/service.ts: 企业目录与手动安装/卸载的串行所有者，目录和安装共用安装层验签策略，默认不读取公钥；点击时重查授权且绑定版本，保留兼容性、核心保护和重启确认；兼容性降级警告只写 `ctx.logger.warn`，不新增 status() 线协议字段。
src/state-store.ts: `managed-plugins.json` 严格解析与私有权限原子替换边界。
src/types.ts: 平台与官方运行时窄 port、企业目录/本机状态契约，以及默认关闭的 verifyPluginSignatures、可选公钥与已验证 Harness commit；企业目录条目含 `displayName?`（员工端卡片**标题**取值，与 `description?` 并列）。
src/verification.ts: **与制品类型无关的下载内核** `downloadVerifiedArtifact`——权威 size+sha256 强制校验、`.part` 临时件边写边算 hash、校验通过才按 `<sha256><ext>` 内容寻址原子改名、失败永远清理 `.part`、命中缓存零网络复用，MIME/目录/扩展名/失败码/revalidate 钩子由调用方给定（受管插件与企业 `.dshskill` 技能包共用这一份纪律，技能包因此不必另写落盘逻辑）；其上是插件专用包装 `downloadAndVerifyArtifact`（下载与缓存强制校验大小/hash/兼容性，仅显式开启时执行 Ed25519；缺公钥或验签失败阻断，复用 RFC 8785 固定签名声明；兼容判定前将 android 归一化为 linux（Android 内核同源），仅作用判定侧、不改写签名 manifest 的 compatibility 字节，使本机 process.platform='android' 能匹配标 linux 的制品白名单）。`verifyAssignmentMetadata` 返回非阻断 `CompatibilityWarning[]`：只有 bundleRange/OS 白名单/已确知 commit 不在白名单/验签是硬失败，「本机引擎 commit 无法确证（映射表未收录该引擎版本）」降级为 `ENT_PLUGIN_HARNESS_COMMIT_UNKNOWN` 警告放行——旧实现把它并入同一个四合一 if，导致每次引擎升级打死整个企业商城。
tests/service.spec.ts: 覆盖 HTTP 默认免公钥安装、开启验签后的目录/安装阻断、零自动安装、缓存重授权、核心保护、Web/Desktop Loader 确认，以及「引擎版本无映射 commit 时目录开关仍可用」、「制品拒绝已确知引擎 commit 时仍硬拦」与「制品 `displayName` 原样进本地 catalog、旧服务端不发则不产出该键（渲染层回退包名）」。

**本刀（卡片标题 = 插件名称）**：`src/service.ts` 的 catalog 投影照 `description` **同一手法**只在真有值时产出 `displayName` 键（服务端必有、旧服务端才缺席；绝不补空串/占位）——下游（ui 解码白名单是关闭键集）因此仍把「缺席」当唯一缺失口径，回退包名的决定留在渲染层一处。
tests/verification.spec.ts: 默认免公钥下载与缓存复用、重新开启验签后的缓存拒绝、强制大小/hash/兼容性、中断清理与 JCS 向量测试；并锁定新语义边界——映射命中零警告、未知引擎 commit 只警告不拦（仍照常下载）、已确知 commit 不在白名单与 OS 不匹配仍硬拦。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
