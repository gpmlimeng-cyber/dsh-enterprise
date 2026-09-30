# ent-admin-cli/

> L2 | 父级: ../CLAUDE.md

成员清单

package.json: `@dshent/ent-admin-cli` 清单，bin=`dsh-ent-admin`，依赖 workspace contracts，Node 22 ESM。
tsconfig.json: 继承 plugin base，输出 `lib/`，仅 Node lib/types。
README.md: 使用入口与 Agent `--json` 契约摘要。
src/paths.ts: `~/.dsh-ent-admin`（或 `DSH_ENT_ADMIN_HOME`）路径定位。
src/config.ts: Server origin 读写与 `--server` / env 覆盖。
src/installation.ts: 非秘密 installation UUID 落盘。
src/credentials.ts: Refresh Token 0600 落盘；Access 永不写入。
src/pkce.ts: RFC 7636 S256 与 127.0.0.1 回环 callback，把浏览器可见结论交给 callback-page：语言在回调入口只判定一次，成功/state 失配/缺 code/`error=` 回调各自渲染结果页，端口在响应刷出后才释放；可选 `branding` 端口缺省即回落内置 `DSH Enterprise`，可选 `onCallbackRequest` 诊断端口把截断到 `ACCEPT_LANGUAGE_LOG_LIMIT`（200）的 `Accept-Language` 原文与判定结论交给调用方。
src/callback-page.ts: 回环结果页渲染器，与 platform-client 同名文件保持语义一致（改动必须两侧同步）——`pickCallbackLocale` 按 `Accept-Language` 决定中/英文且**缺省中文**（缺失/空/畸形/通配/`q=0`/非中英语言一律回落 `CALLBACK_DEFAULT_LOCALE`＝`zh`，只有 best q 主标签明确为 `en` 才英文），`escapeHtmlText` 转义不可信品牌文本，`renderCallbackPage` 产出无外链、内联样式、随系统深色适配的单文件 HTML。
src/browser.ts: 系统浏览器 argv 打开。
src/auth.ts: PKCE login、token 交换、设备 enroll、refresh 轮换、logout/status；把回环回调的 `Accept-Language` 与判定语言经既有 `options.log`（stderr）留痕。
src/http.ts: Bearer fetch 与稳定错误 envelope。
src/output.ts: stdout JSON / stderr 人类日志 / exit code 契约。
src/cli.ts: parseArgs 分发与只读 domain 命令。
tests/: config/credentials/pkce/callback-page/cli 契约与边界单测；pkce/callback-page 按与 platform-client 同一份新规格锁定「缺省中文」语言映射、明确英文偏好与诊断端口留痕。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
