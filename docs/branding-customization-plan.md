# 品牌自定义功能 · 实施规划

> 状态：规划（未实现）｜日期：2026-09-30｜提出：企业后台集中配置品牌，dshent-plugin 客户端组件按配置呈现

## 1. 目标与边界

**目标**：管理员在 `https://62.234.16.179/` 后台配置品牌，客户端 `dshent-plugin` 在**登录弹窗、个人中心入口、菜单**等自有界面按配置呈现。

**一期范围（2026-09-30 定）**：**LOGO + 企业名称 + 欢迎语与版本标识**（例如欢迎语「探索未至之境」、版本标识「预览版」）。主视觉、主题色延后；favicon/窗口标题/安装包品牌属官方与打包层，待取证。

**必须满足**
- **未登录即生效**：登录弹窗是最需要品牌的界面，品牌数据不得依赖登录态。
- 后台不可达时**内置默认**兜底，插件仍然"零业务配置可安装"。
- 不轮询、不常驻 SSE；与现有"闲置无企业流量"的约束一致。

**硬约束（仓库宪法）**
- **官方 UI 零分叉**：只使用官方受支持的 slot、主题 token、settings、primitives。**禁止** `document.querySelector` 改官方节点、禁止覆盖/遮蔽官方组件（jingyun 的做法一律不采用）。
- 外部资源视为不可信输入：限尺寸、限类型、不执行远端脚本。
- 不做员工端上传、不做运行时远程代码。

## 2. 品牌元素清单（分层归位）

| # | 元素 | 呈现位置 | 现有承载 | 数据来源 | 期次 |
|---|---|---|---|---|---|
| 1 | LOGO（亮/暗，方版/横版） | 登录弹窗、菜单头部 | `ui/src/brand.ts`（静态/动图两 URI，硬编码） | 后台 | **一期** |
| 2 | 企业名称 / 简称 | 登录弹窗标题与说明、菜单头部 | `ui/src/login-page.tsx` 文案 | 后台 | **一期** |
| 3 | **欢迎语（headline）** | 登录弹窗说明区（如「探索未至之境」） | `login-page.tsx` 硬编码文案 | 后台（缺省回落内置） | **一期** |
| 4 | **版本标识（如「预览版」）** | 登录弹窗徽标、菜单头部可选 | 无 | 后台配置，缺省回落构建元信息 | **一期** |
| 5 | 登录弹窗主视觉（静态/动图 + 减动效回退） | 登录弹窗 | `brand.ts` 已有动图/静态双份 | 后台 | 二期 |
| 6 | 个人中心入口图标 / 默认头像 | 侧栏 `settings.launcher` 座位 | `ui/src/account-menu.tsx`（官方图标/首字头像） | 后台 | 二期 |
| 7 | 主题色 / 强调色 | 自有界面强调元素 | `theme-options.tsx`（官方 `ThemeRuntime`） | 后台 | 二期 |
| 8 | favicon / 页面标题 | 宿主页面 | 官方运行时 | 待取证 | 三期 |
| 9 | 窗口标题 / 托盘 / 应用图标 / 安装包名称 | 桌面应用与安装包 | `apps/desktop/brand.json` + 打包脚本 | **打包期固化**（非后台运行时） | 三期（单列） |
| 10 | 启动画面 / About 面板 | 官方桌面 | 官方 | 待取证 | 三期 |

> 说明：#8–#10 属官方运行时与打包层，能否运行时覆盖**必须先取证**；取证不到就明确"不做"并记录，不用 hack 硬上。

## 3. 架构

```
企业后台 (62.234.16.179)                         dshent-plugin 客户端
┌────────────────────────────────┐              ┌──────────────────────────────────┐
│ console「品牌」页               │  公开只读     │ ① 取数：GET /enterprise/api/v1/   │
│  · 上传 LOGO（亮/暗/方/横）      │ ───────────► │    branding（短超时、ETag、无登录）│
│  · 企业名称 / 简称              │              │ ② 缓存：~/.dsh/enterprise/        │
│  · 主视觉 / 主题色（二期）       │              │    branding.json + 资源副本        │
│  · 预览 / 发布 / 回滚           │              │ ③ 回退：未配置/离线 → 内置默认      │
│ 存储：branding 单行配置表        │              │ ④ 应用：登录弹窗 / 入口 / 菜单头部  │
│  + 公开静态资源路由              │              │    （自有界面，官方面只读 token）   │
└────────────────────────────────┘              └──────────────────────────────────┘
```

**接口契约（草案）**
- `GET /enterprise/api/v1/branding`：**免登录**、同源、只回**白名单字段**，不回任何企业数据。
- 响应示例：`{ revision, name, shortName, logo: { light, dark, square }, welcome: { headline, editionLabel }, heroImage?, accentColor?, updatedAt }`
- **一期字段**：`name` / `shortName` / `logo.{light,dark,square}` / `welcome.headline` / `welcome.editionLabel`。其余字段可先不进契约。
- 资源地址由服务端给出**带 revision 的不可变 URL**（便于缓存与回滚），并附内容哈希。
- 缓存：`ETag` + `Cache-Control` 短 TTL；客户端另有本地副本，离线可用。
- **不在服务端代为拉取任何远端 URL**（避免 SSRF）。

**存储与权限**
- `branding` 单行配置表（Flyway 迁移）+ 资源走既有制品/静态资源范式（复用上传校验与静态路由）。
- 管理端页面在 `console/`，权限 `enterprise_admin`；发布/回滚写审计。

## 4. 关键决策（建议，待确认）

| 决策 | 建议 | 理由 |
|---|---|---|
| 品牌接口鉴权 | **免登录只读** | 否则登录弹窗无法品牌化（自相矛盾） |
| 一期范围 | **LOGO + 企业名称 + 欢迎语 + 版本标识**（已定 2026-09-30） | 覆盖员工第一眼所见（登录弹窗）的核心品牌信息；主视觉/主题色二期 |
| 资源存储 | 单行配置 + 公开静态路由（**不用**受管插件/配方的版本分配语义） | 品牌是单例，不需要 ALL/USER 可见范围与逐请求授权 |
| 缓存策略 | 本地副本 + 登录后重拉一次；**不轮询** | 与既有约束一致 |
| 多客户端 | 兼容 DSH Desktop(0.1.7-rc.2) 与 DeepSeek Harness(0.2.0-rc.2) | 两者共用 `~/.dsh/profiles/desktop`，插件同时装在两处 |

## 5. 分期与验收

| 期 | 内容 | 交付物 | 验收标准 |
|---|---|---|---|
| **B1** | 服务端：表 + 公开只读接口 + 资源路由；管理端品牌页（上传/预览/发布/回滚） | Flyway 迁移、Controller/Service、OpenAPI 更新、console 页面 | ① 无痕 `curl` 拿到白名单 JSON；② 改 LOGO 后接口即时反映（revision 变化）；③ 非 `enterprise_admin` 403；④ 发布/回滚有审计 |
| **B2** | 插件取数、缓存、回退；应用在**登录弹窗**（未登录即生效）：LOGO、名称、欢迎语、版本标识 | `ui/src/branding.ts` + `login-page.tsx` 接入 | ① 后台改 → 重启客户端 → 登录弹窗 **LOGO/名称/欢迎语/版本徽标**变化；② 断网走缓存；③ 未配置走内置默认（含内置欢迎语与版本标识）；④ 接口超时不阻断界面 |
| **B3** | 侧栏入口图标/头像、菜单头部名称与 LOGO | `account-menu.tsx` 接入 | 视觉与官方 token 一致（0.2.0-rc.2 实物对照） |
| **B4** | 主题色 + 元信息（favicon/标题/主视觉） | 视取证结果 | **前置：官方扩展面取证**；无受支持入口则明确不做 |
| **B5** | 打包层品牌（`apps/desktop/brand.json`、安装包名称/图标） | 打包脚本与清单 | 明确"打包期固化 vs 后台运行时"的边界，不承诺运行时改安装包品牌 |

## 6. 风险

| 风险 | 说明 | 处置 |
|---|---|---|
| 外部资源攻击面 | SVG 可携带脚本；超大文件撑爆渲染 | 只允许位图，或对 SVG 做消毒；限尺寸（如 ≤512KB）与 MIME 白名单 |
| 免登录接口泄露面 | 公开接口易被探测 | 仅回品牌白名单；同源；限流；不含任何企业/成员数据 |
| **官方品牌错位** | `~/.dsh/desktop-config.json` 现含 `domain: https://demo.jingyun.online/`、`custom_name: Jingyun.Studio`（由 Jingyun 写入）；若官方界面读它，会出现"官方界面显示第三方品牌" | **先取证谁读该文件**；若官方读，需向用户说明并给清理方案（属环境治理，不属插件） |
| 双版本/双客户端 | 0.1.5/0.1.6 无官方 `Menu` 原语 | 已建议 peer 收紧 `>=0.1.7-rc.2 <0.3.0` |
| 打包品牌与后台品牌不一致 | 安装包名称/图标固化，后台改不了 | 文档明确边界；B5 只做打包期配置 |

## 7. 待拍板

1. **可见范围**：全员统一品牌，还是按 Organization/租户区分？（影响表结构与接口形状，越早定越好）
3. **是否允许员工端自定义**：建议**不允许**（企业品牌统一性）。

## 8. 下一步（可立即执行）

1. **全域调研**（用保活的 `subagent`，避免 `workflow` 被消息中断）：官方 0.2.0-rc.2 品牌面 / jingyun 全清单 / 本仓现有落点 / 服务端与管理端可复用范式 → 落 `docs/branding-survey.md`。
2. 定稿 OpenAPI 草案（`contracts/`）+ 表结构。
3. 进 B1 实现；B2 可并行（接口契约定稿后即可按 mock 起步）。

## 9. 实施进展

### B2 插件侧 —— 已完成并装机（2026-09-30）

- **取数**：Host 侧 `platform-client/src/platform-service.ts:274` 装配 `EnterpriseBrandingCache`（复用平台 fetch 生命周期 + 自身 3s 超时）；构造、登录成功、Server 切换各触发一次 `refresh()`，并发合并，**不轮询、无 SSE**。
- **缓存**：`platform-client/src/branding.ts:306` → `$DSH_HOME/enterprise/branding.json` + `branding/<slot>-<rev>.<ext>`；`revision` 即内容身份，同 rev 且副本齐全则零请求零落盘；跨 rev 清旧副本，原子写。
- **回退**：`refresh()` 永不 reject；`ui/src/branding.ts:79` 逐字段回落内置（`DSH Enterprise` / 「探索未至之境」 / 「预览版」 + `brand.ts` 两图）。**任何情况下登录弹窗与菜单照常渲染**。
- **资源门禁**：位图 MIME 白名单（拒 SVG）、512KB 上限（流式截断，不信 `Content-Length`）、平台同源；UI 侧二次门禁只认同源本地副本路径，非法只丢该槽位，加载失败原地换内置图。
- **本地路由**：`GET /enterprise/api/v1/local/branding` 恒 200 `{data:<文档|null>}`；`GET …/branding/asset/{light|dark|square}?v=<rev>` 回字节或 404；非 GET 405；`no-store`、无 CORS。
- **应用面**：`login-dialog.tsx`（标题=name、说明=headline）、`login-page.tsx`（品牌位图/欢迎语/版本徽标）、`account-menu.tsx`（菜单头部 LOGO+简称）。**官方组件与 DOM 零触碰**。
- **门禁**：`platform-client` 5 文件/43 例全绿；`ui` 10 文件/82 例全绿 + typecheck + build；装机哈希 `index.js b1ca399853bf` / `client.js f58f37d64e17`（tar ↔ profile 一致）。

### B1 服务端与管理端 —— 实现中

已见交付面：`V32__enterprise_branding.sql`、`PublicBrandingController` / `AdminBrandingController` / `BrandingViews`、`JdbcBrandingStore`、`BrandingImageInspector` / `BrandingAssetStore`、`contracts/paths/branding.yaml` + `BrandingPublicResponse.schema.json` 及生成物、`console` 品牌页与路由。

### 尚未联通的最后一环：**部署**

插件已具备取数与回退，但 `https://62.234.16.179/` 上**尚未部署**品牌接口（V32 与新 Controller 都还在本地）。因此当前客户端取数必然 404 → 走内置默认。**端到端生效需要把 B1 部署到该后台**（Flyway V32 + 新接口 + 管理端页面），这正是"看起来没变化"的原因，也是本功能交付的最后一个动作。
