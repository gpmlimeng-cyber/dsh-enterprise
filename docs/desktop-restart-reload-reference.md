# 桌面端「重启应用 / 重新载入页面」参考真源

> 状态：只读调研结论（未运行应用，全部来自源码/注释/文档）｜日期：2026-09-30
> 上游：`anywhere-labs/dsh-desktop` @ `master` = `997bb7ee249f9f93dd46e39fad675d85578a87bb`（2026-09-30，Merge PR #1281）
> 适用：本仓插件要在个人中心提供「重新载入页面 / 重新启动应用」；以及受管插件安装后的"重启确认"

## 1. 调用面（直接可用，勿自造 IPC）

| 能力 | 渲染进程 | 同源 HTTP | Host 侧 |
|---|---|---|---|
| 重载页面 | `dshDesktopActions.invoke('reload')` → IPC `dsh-desktop:renderer-action` | `POST /api/desktop/developer/reload` | Host RPC `native:reloadRenderer` |
| 重启应用 | `dshDesktopActions.invoke('restart')` | `POST /api/desktop/restart` | `desktopActions.requestRestart()` |

- 动作白名单固定且无参：`'reload'` / `'restart'` / `'restart-recovery'`（`src/renderer-actions-contract.ts:15-22`）
- 主进程分派前校验 sender / senderFrame / 同源（`src/electron-shell-generation.ts:352-359`）
- 重载实现：`renderer.reloadIgnoringCache()`，**不重启应用、不重启 Host、不弹窗**（`:747-759`）

## 2. 语义与红线

- **重启必有原生模态确认**：`response===0` 才继续，取消即什么都不做（`src/electron-runtime.ts:651-665`）→ 我方**不得**再加二次确认
- **重载无确认**（托盘、菜单 Reload、崩溃恢复都直接执行）→ 我方同样不加确认，只给"正在重新载入…"状态
- **重载 ≠ 应用 Host 侧变化**（官方红线原文 `README.zh.md:47`）：
  「应用绝不会在存活的 renderer generation 中热切换 root slot、原生窗口材质或 Loader row」
  Host 是独立 `utilityProcess`，reload 不会重开它（`src/host-process.ts:45`）
  ⇒ **新增/停用 Host 插件行、切 profile、改 mode/port/材质 → 必须整应用重启**
- 重启次序（值得照抄）：持久化 → 原生确认 → **先 ack 渲染进程**（"renderer must never wait on a document it is about to lose"）→ 有界 dispose（5s，超时/重入强退）→ **仅 0 退出码才 `app.relaunch`** → `app.exit`；失败**不** relaunch，避免"坏 generation 循环重启"（`src/shutdown.ts:45-52,81-86`）
- 单实例：`requestSingleInstanceLock()` 失败即退出；AppImage 用 detached 脚本等旧 pid 退出再 exec（`src/relaunch-arguments.ts:88-99`）

## 3. 必须补的坑（官方自身缺陷）

- `app.relaunch` 的 **spawn 失败只写 stderr**（`src/relaunch-arguments.ts:154-155`）；客户端 **8s 后静默**退回"重启后生效"（`client/DesktopSettingsSection.tsx:409-413`）→ 用户会误以为已重启
- ⇒ 我方触发后必须有**可见反馈 + 超时**："已请求重启；若 10 秒内无反应，请手动退出并重开客户端"

## 4. 我们的实现口径（定稿）

| 菜单项 | 显示条件 | 降级链 |
|---|---|---|
| 重新载入页面 | 恒显示 | `invoke('reload')` → `POST /api/desktop/developer/reload` → `location.reload()`（纯 Web） |
| 重新启动应用 | 仅检测到桌面通道时（`dshDesktop`/`dshDesktopActions` 存在或同源 POST 可达） | `invoke('restart')` → `POST /api/desktop/restart`；**都不可用则隐藏**，绝不报错 |

位置：个人中心菜单维护分组；不与「我的用量」（在「设置」之前）冲突。

## 5. 对 T14「重启确认」的正解（可借鉴）

官方把重启策略**交给调用方**："The caller owns … restart policy"（`.agents/notes/2026-08-19-desktop-plugin-install-lifecycle-ownership.md:27`）。社区市场的做法是我方应照抄的范式：

1. 安装/卸载**成功后**才签发一次性 `restartToken`（TTL + 单次消费 + 绑定 profile）（`dsh-community-market/src/install/service.ts:676-677,777-790`）
2. 客户端弹「需要重启 DSH Desktop / 立即重启 / 稍后重启」（`client/MarketSettingsTab.tsx:1817-1856`）
3. token 交 Host，Host 消费后自行调 `desktopActions.requestRestart()`（`src/host/routes.ts:1122-1136`）
4. 失败文案"请稍后手动重启"（`client/locales.ts:181`）

⇒ 我们的"重启确认"应做成 **pending changes 登记 + 一次性授权**，而不是每次都让用户自己判断要不要重启。

## 6. 未验证项（如实）

未运行应用，结论全部来自源码/注释/文档；未通读 `tests/*` 与英文 README 全文；`deepseek-harness` 是 `upstream.json` 指向的独立仓库（stable/beta 均 0.2.0-rc.2 @ `639ed015`），"不重启 Host 能否重新投递新增客户端插件行"属该仓库行为，本仓无法证实；macOS/Windows/Linux 真实 relaunch、AppImage 交接、单实例锁时序、Electron 是否保证"旧进程退出后才启动新进程"均需运行时确认。

## 7. 重要更正（2026-09-30 二次取证）：两个 app 能力不同

| 能力 | DeepSeek Harness.app（0.2.0-rc.2，我方当前运行处） | DSH Desktop.app（2.0.15，anywhere-labs fork） |
|---|---|---|
| 重载页面 | **无** renderer-action / api-desktop（asar 内 0 命中）→ 只能 `location.reload()` | `dshDesktopActions.invoke('reload')`；另有 `POST /api/desktop/developer/reload` |
| 重启应用 | **未发现受支持通道**（不得自造） | `dshDesktopActions.invoke('restart')`；`POST /api/desktop/restart` |
| 检查更新 | `globalThis.dshDesktop.updates.{status,open,subscribe}`（需 `protocolVersion===1` 且 `updates` 存在） | `dshDesktopActions.invoke('check-for-updates')`；`POST /api/desktop/updates/check`（无状态） |

- fork 的运行时动作白名单共 7 个：`terminal, developer, diagnostics, check-for-updates, restart, restart-recovery, reload`
- **非桌面/能力判定要带 updates 存在性**：`const c = globalThis.dshDesktop; const on = c?.protocolVersion === 1 && typeof c.updates?.open === 'function'`（非 product 帧只给 `{protocolVersion:1}`）
- 结论：实现必须**逐 app 特性检测**，不得假定一套通道在所有客户端都存在。
