# bundle/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: npm 员工用户入口，说明 `next` 安装、Server 登录、默认免公钥安装、可选验签、更新卸载与兼容基线。
package.json: npm 发布清单与 `dsh.bundle`/`dsh.client` 双入口，声明 Harness 0.1.1-rc.2、0.1.2-rc.1 与 0.1.5-rc.2 三条预发行兼容范围；Client 只声明三个所用 slot 的所有者，避免依赖新版已退役的 client-runtime row；云端项目对官方 `ctx.workspaces`（client-runtime 提供）改走运行时可选读取，缺失即降级，因此不新增 inject 项。
screenshots.json: 社区市场从插件源码目录读取的四张原始截图清单，通过 GitHub 固定提交 URL 复用 docs/assets 媒体并控制展示顺序，不改变 npm 运行包。
tsconfig.json: bundle Host 公开声明的 emit-only TypeScript 边界，通过 workspace 声明消费产品模块，并局部跳过链接上游损坏声明检查。
cordis.patch.yml: 官方 profile layer，覆盖企业 default、停用个人 provider/模型设置并插入企业 Host/Client row。
scripts/build.mjs: 内联产品模块但 externalize 官方 Cordis/credentials/LLM/settings/Schemastery 与 Client ui-primitives 单例的双端构建器。
src/index.ts: Web/Desktop 共用 Host 组合入口，绑定 credentials/pi-ai/分发，在 bootstrap sessionPolicy.enabled 时经 tryRegisterHostSessionSync 条件挂载会话同步，并装配云端工作空间（本地映射 + Access Token askpass git 注入）。
tests/bundle.spec.ts: 验签开关默认值与显式开启、credentials/模型/分发组合、Session 同步双向门禁（无 dsh-session peer）、兼容 peers、Client graph 与构建产物验收。
tests/apply-optional-services.spec.ts: 固化 Cordis「未注入属性直读即抛错」模型，断言 apply 绝不出现 without inject，并以源码扫描禁止 sessions/sessionPersistence/desktop* 直读；对应用户端真实启动崩溃回归。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
