# Product Console

OwnDsh Console 是独立 Vite SPA，不依赖旧 Umi、Ant Design 或动态菜单运行时。

产品壳直接迁移自 Beautiful UI Harness commit `3ea4c18114de3d4bc9b63b8e3ea6f533b1a562bd`。上游 Next.js 运行时改为 Vite/TanStack，Central Icons 改为 Lucide，并移除 PostHog。上游组件画廊（`/examples` 与 `/examples/harness`）**已从生产构建移除**（它曾把 21 份组件源码原文以 `?raw` 内联进产物）；`src/components/{atoms,primitives}` 作为锁定上游参考保留，但不再有运行时入口。版本锁见 `../upstream/beautiful-ui.lock.json`，许可证见 `BEAUTIFUL_UI_LICENSE`，设计留档见 `design/`。

```sh
pnpm install
pnpm check
pnpm dev
```

产品入口为 `/`，登录入口为 `/login`。本地开发将 `/enterprise` 与 `/healthz` 代理到 `CONSOLE_API_ORIGIN`，缺省为本机 OwnDsh TLS 入口 `https://127.0.0.1:62207`；自定义目标仍通过该环境变量覆盖。`62209` 只承担 UI/HMR，完整 PKCE 通过服务端已注册回调的同源 Console 构建验收。

控制台支持内网 HTTP 域名/IP 与 HTTPS：PKCE S256 使用纯 JavaScript SHA-256，登录随机值与写操作的 UUID 幂等键使用 `crypto.getRandomValues`，不依赖仅安全上下文可用的 `crypto.subtle` 或 `crypto.randomUUID`。服务端 redirect allowlist 仍需精确注册实际入口的 `/enterprise/auth/callback`（含协议、域名/IP 与端口），例如 `http://owndsh.internal/enterprise/auth/callback`；不要为开发端口放宽 allowlist。

OpenAPI 客户端由 `../contracts/enterprise-openapi.yaml` 生成；不要手改 `src/api/generated/`。
