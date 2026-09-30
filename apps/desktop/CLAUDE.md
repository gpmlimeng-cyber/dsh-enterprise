# apps/desktop/

> L2 | 父级: ../CLAUDE.md

DSH Enterprise 桌面客户端层。本目录是**自包含 pnpm workspace**（`pnpm-workspace.yaml` 管 `packages/*`），与 `console/`、`plugin/` 各自带 workspace 的惯例一致。
树内代码是 vendored 第三方源码（原 Jingyun DSH Client，Apache-2.0，登记于根 `NOTICE` 第 5 项，许可正文见本目录 `LICENSE`），**不是** dshent 原创；改造时不得删除署名。

## 两条产线，不要混

- `packaging/`：thin 打包层，用仓外官方 DeepSeek Harness Desktop 打企业品牌安装包；**不**消费本层源码。
- 本目录其余部分：客户端发行版本身，Tauri v2 壳 + Cordis 插件，自带构建与打包（`tauri build`）。

## 架构（数据流）

```
Tauri v2 壳 (src-tauri, Rust)
   └─ 拉起 Node sidecar（DSH Host）→ 加载 Cordis 插件
        ├─ @jingyun-ai/jingyun-dsh  品牌/连接器/技能/路由 (/api/jingyun/*)
        └─ @jingyun-ai/jingyun-enterprise  企业控制面集成（E1–E4）
   └─ WebView 加载 DSH Web → 客户端半 lib/client.js 注入插槽
```

企业集成只与**本机 Host** 通信，再经 Host 的 loopback 代理访问企业中心；浏览器侧永远拿不到企业 access token。

## 成员清单

### 工作区与工具链
package.json: workspace 根，`build`/`dev`/`typecheck`/`lint`/`fmt`/`tauri:*` 入口。
pnpm-workspace.yaml: `packages/*` 成员定义与 allowBuilds/minimumReleaseAge 策略。
pnpm-lock.yaml: 唯一依赖锁。
tsconfig.json: workspace 根 TS 配置。
.oxlintrc.json / .oxfmtrc.json / .npmrc / .npmignore / .gitignore / .gitattributes 类文件: 风格与忽略规则。
run_pack.bat: Windows 打包 GUI 启动脚本。
AGENTS.md: 本树的工程规约（风格、GEB L3、验证门禁）；企业集成改动同样受其约束。

### 插件包
packages/jingyun-dsh/: 品牌与连接器插件（Host + Client 双产物）。路由挂 `/api/jingyun/*`；`src/plugins/service.ts` 是宿主自带的插件安装/市场机制，企业市场必须复用而不是另造。
packages/jingyun-enterprise/: **企业控制面集成包**（E1 登录/令牌/设备、E2 企业托管模型网关、E3 用量配额、E4 企业插件市场）。接口真源见其 `docs/INTERFACES.md`；不依赖 `@dshent/*`。

### 桌面壳与脚本
src-tauri/: Tauri v2 Rust 壳，窗口/托盘/单实例与 sidecar 生命周期。
scripts/: 构建、vendor 准备与打包脚本。
packaging/: 另一条产线的 thin 打包层（见上）。
README.md: 产品介绍（上游文档，保留）。

## 命令

```sh
pnpm install                  # 安装工作区依赖
pnpm typecheck                # tsc -b --noEmit
pnpm -C packages/jingyun-enterprise test      # 企业集成单测（vitest）
pnpm -C packages/jingyun-enterprise build     # 企业集成双产物
pnpm build                    # 全部插件构建
pnpm dev                      # 开发宿主 + 监听构建
pnpm tauri:build              # 产出桌面安装包
```

## 验证门禁

1. `pnpm typecheck` 全绿；
2. 企业集成包 `pnpm -C packages/jingyun-enterprise test` 全绿；
3. `pnpm -C packages/jingyun-enterprise build` 产出 `lib/index.mjs` 与 `lib/client.js`；
4. 手工冒烟：`pnpm dev` 后确认企业设置页可填写地址、登录、看到用量与市场列表。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
