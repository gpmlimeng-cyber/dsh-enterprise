<!--
[INPUT]: 依赖官方 Client slots、平台本地 API 与 EnterpriseAccountStore 的实现边界。
[OUTPUT]: 提供个人中心菜单（账号信息/登录/退出/设置/外观选项组）、照官方语义恒走菜单的入口、登录弹窗、只读账号设置、Server 编辑时机与跨会话响应隔离说明。
[POS]: @dshent/ui 的公开语义入口，明确插件 UI 与官方 Web/Desktop 外壳的所有权边界。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# @dshent/ui

Browser-side employee account and managed-plugin surface for the locked Harness Client runtime.
It registers the `DSH Enterprise 设置` page through the official `settings.section`
slot and the personal-center menu through the official `settings.launcher` seat. The shipped
account launcher is disabled by the enterprise profile patch, so that single seat has exactly
one occupant and the sidebar foot holds no second account entry. DSH Enterprise does not own
or fork the surrounding Web/Desktop UI.

Entering the harness is never blocked: the plugin registers no `shell.overlay` layer and
renders no full-screen gate. A disconnected or never-configured client keeps the whole
official shell usable, and the enterprise login lives in the account area. The Account tab
always shows the current account state plus an explicit `登录` button while the session is
not usable, and the same button opens the login dialog. The dialog reuses the original
full-screen enterprise login page as its body at dialog size: the branded animated mark
(static under `prefers-reduced-motion`), the product title and tagline as the dialog
heading, the connection state with its icon and one-line guidance, the employee-facing
Chinese error message with a shape-checked code, the Server address editor with its clear
and `保存` actions, the `登录企业账号`/`取消登录`/`退出登录` actions, the Server plus plugin
version footer, and the confirmed `卸载 DSH Enterprise`. The editor only expands while the
address is editable and either unconfigured or explicitly requested through
`修改 Server 地址`; every other state shows the matching login action instead, so there is
exactly one primary action. The card is 440px wide, the content region scrolls inside a
viewport-bounded card while the footer stays put, and the Server field takes the full
content width with the action buttons on one wrapping row. The dialog adds only the shell
contract: `取消`, mask click and Escape all funnel through one close handler, focus stays
inside (and is returned on close; a nested logout/uninstall confirmation keeps its own
trap), and a footer `登录` appears only when the body has no login action of its own;
known error codes fall back to a generic Chinese sentence, including the local route's
`ENT_SETTINGS_UNAVAILABLE` (this profile cannot persist enterprise settings). Repeated
submits are disabled while a request is in flight. Cancel, mask click, and Escape all funnel through one close handler, so closing the
dialog during an in-flight login calls the existing cancel path instead of leaving an
unclaimed authorization window; closing never blocks the surrounding UI, and focus stays
inside the dialog until it closes. A successful login closes the dialog automatically
because both surfaces read the same `EnterpriseAccountStore` snapshot. The launcher keeps the
official seat semantics: it is a menu trigger in every account state, including the
never-configured and every signed-out one, so a signed-out employee still reaches `设置` and
`外观` — the gear fallback only renders while the seat is empty. The menu header shows the
signed-in nickname plus login name and department, or `未登录` plus the current state's
one-line guidance; an in-flight authorization already presents the account line. The rows keep
the official order — the account action first when it exists (`登录` while signed out, which is
the only opener of the login dialog, or `查看登录进度` while `AUTHORIZING`/`ENROLLING`/
`BOOTSTRAPPING`), then the inline `外观` segmented group and `设置` in every state in that
order, then the confirmed `退出登录` once a session is usable. While signed out the trigger
keeps the official `t('more')` word `更多` and an ellipsis glyph on `data-signed-out`, because
it now opens a menu rather than a sign-in dialog; `aria-haspopup` is `menu` in every state.
Escape, an outside click and the trigger itself close the menu and return focus to the
trigger, Tab closes it the same way, and the login dialog and the menu are mutually
exclusive because a menu row closes the menu before the dialog or the confirmation opens.

The `外观` group is a second entry point to the same official theme preference, not a private
one: it offers exactly the official `light`/`dark`/`system` set, reads the selected segment
back from the host `theme` service on every render, and writes only through that service, so
the selection survives a reload and stays in step with the official Appearance row. When the
host provides no theme service the group renders disabled instead of pretending a selection;
no theme state is ever kept in local component state or written to the DOM, and the plugin
waits for the service to appear and republishes once, so a cold boot where ui-theme activates
later cannot leave the group stale. The segmented
control follows the reference plugin's compact capsule geometry while taking every color from
host tokens, so it follows both palettes without a dark-mode override.

The DSH Enterprise Settings section contains Account and Plugins tabs aligned with the
native DSH Plugins tab rhythm and keyboard navigation. The launcher occupies the shell's
settings-row seat, so it reuses that row's geometry and tokens: a 42px expanded row with the
native radius and hover fill, a 36px rail button, and an avatar or first-letter circle in the
icon slot. Its menu card is 270px wide with 16px corners, the host menu surface and elevation
tokens, one hairline between groups, and 16px icon slots. Sign-out requires the same in-page
Harness `Modal` and `Button` confirmation as the Account tab before clearing the session.
Uninstall uses the same component and the login dialog
reuses both confirmations; Cancel and Escape leave the account and plugins unchanged. The dialog uses Host
theme and traps focus while open, without relying on a desktop
bridge for `window.confirm()`.
Account settings combine the user and login status in a compact summary above grouped,
left-aligned Server/device/version rows with small label icons. Host theme tokens and native
tabs/buttons keep this layout consistent with Harness. The account area shows the Server
address read-only and keeps the address editable inside the login dialog, where saving the
address and starting the login are mutually exclusive; the field is prefilled with the saved
address, and clearing it falls back to that saved address on submit. Authorization,
enrollment and session restoration hide the editor and show the state line with its spinner
instead. Failed saves preserve the editor and its input. An explicitly labeled
configuration refresh shares a quiet footer with sign-out/uninstall. Account values
stay on one line, truncate with an ellipsis, and expose the full
value on hover; the connection timestamp is omitted because authentication runs on demand.
Grouped surfaces pair Host background and border tokens to avoid transparent superellipse border artifacts.
Losing or regaining the enterprise session no longer closes the Settings page or changes
which tab is active; without a usable session only the Account tab is offered, because the
Plugin, Preset, and Session surfaces all require an enterprise session.
Explicit uninstall removes DSH Enterprise and its managed plugins; Desktop requests an
official restart and the UI asks the user to restart Harness manually.
The Settings Plugins tab directly contains search, package cards, an installed filter,
version details, explicit install/update actions, and confirmed uninstall. There is no
separate sidebar launcher or market overlay. On narrow screens, styles scoped to the
active DSH Enterprise section place the Host settings navigation in a horizontal row so content
remains usable. Detail and confirmation dialogs keep keyboard focus inside and restore
focus when closed; Escape leaves the surrounding Settings page open. Data and execution
belong to DSH Enterprise.
The fixed same-origin `/enterprise/api/v1/local/plugins` projection separates the catalog
from local installation facts. `/plugins/install` binds a package and version ID;
`/plugins/remove` removes a locally managed package. Opening or refreshing never installs
anything. New versions require a click, and uninstall survives refresh and restart.
Incompatible runtimes disable installation. Signature verification is off by default;
when explicitly enabled, missing trust configuration or invalid signatures also block installation.
SHA-256, restart markers, tgz
paths, trust keys, CLI output, and platform credentials are validated or removed
before the snapshot reaches React.

All official slot registrations share one `EnterpriseAccountStore`. Its browser API uses
only fixed same-origin `/enterprise/api/v1/local/*` paths, sends strict JSON for
Server, login, cancel, logout, uninstall, and explicit refresh actions. It reuses official
Host adapter/credential/settings events and connection reset notifications to read local
state; it creates no transport connection. A one-second status query runs only during
login/startup transitions, stops at a terminal state or unmount, and has a 330-second ceiling.
Opening Settings or pressing Refresh explicitly reloads bootstrap from the enterprise server.
Idle clients neither poll the enterprise server nor proactively renew credentials. It reloads account and plugin facts only on the first connected state or
a bootstrap revision change. Server/account changes and connected/disconnected transitions cancel
old account, plugin requests and discard their late results and errors. Runtime decoders project only account/device facts and reject unknown
status fields, including Token-shaped additions. Host Context and platform
credentials never enter React.

Harness exposes no API for a launcher to open one settings section: the
`settings.launcher` owner props carry `openSettings()` only, while the panel's
section-targeting `openSection(id)` is reserved for `settings.onboarding` steps. The menu's
`设置` row therefore calls `openSettings()` — the shell opens its panel on the first
registered navigation row — and the operator reaches `DSH Enterprise 设置` through the
panel's own navigation, which still owns section selection. The launcher never reads the
settings DOM or private React state; matching the shipped account launcher, which does the
same thing.
