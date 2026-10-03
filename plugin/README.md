<!--
[INPUT]: 依赖已验证 Harness/Desktop 基线、兼容公开扩展点、插件 workspace 脚本与 V1 员工侧发行边界。
[OUTPUT]: 提供 dshent-plugin 的架构、构建、树外验收与官方宿主零分叉说明。
[POS]: plugin workspace 的使用入口，连接发布包、自动门禁和真实 Harness 验收路径。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# DSH Enterprise Harness Plugin Workspace

This directory is the independent pnpm workspace for enterprise Harness
plugins. It does not import source files from the sibling DeepSeek Harness
checkout. T01 establishes formal packages for PKCE, local Host APIs,
OpenAI-compatible SSE, Session seed restoration, Client slots, and a
self-contained bundle. DSH Enterprise does not fork or maintain the official Harness
Web/Desktop UI: `dshent-plugin` (official Harness hosts) and
`dshent-client-plugin` (any DSH client, including third-party distributions,
without vendoring their source) are the employee-side deliverables, and the
locked upstream checkouts remain read-only verification fixtures. Published peers follow the same caret ranges as Harness packages, while the Host reports its actual Harness version through the official LLM runtime identity. T06 promotes the PKCE probe into `ctx.enterprisePlatform`
with in-memory Access Token ownership, official Host `GrantRecord` persistence for the rotating Refresh Token,
installation persistence, enroll/bootstrap, restart recovery, and request-time Token renewal and same-origin local JSON (no resident enterprise SSE). The workspace uses the locked Harness
release's public plugin surface and does not generate or mount a custom Typert
Remote. T07 adds the employee account experience through two official seats:
the `settings.section` page and the `settings.launcher` personal-center menu.
Entering the harness is never blocked — the `shell.overlay` gate and the
`sidebar.footer.action` entry have retired, a signed-out employee still gets
the menu (whose first row is `登录`), and login opens a non-blocking dialog.
Both surfaces share one browser store over the T06 local control plane. The
Server address is persisted by the official Harness settings service in this
plugin's owner entry (id `dshent`) as volatile Config fields written through
`settings.update`, so a normal installation requires no profile edit.
T11 directly mounts the official rc.2 `@deepseek-ai/dsh-llm-pi-ai` adapter with
enterprise-managed profiles and an ephemeral Host-only loopback authentication proxy. The enterprise
plugin stores no upstream API key and implements no model wire protocol.
T14 adds `ctx.enterprisePluginDistribution` through the official rc.2
`ctx.subprocess`/`ctx.pluginInventory` services and Desktop's public plugin command service. It downloads and verifies
center-managed tgz artifacts, invokes the environment-native official command with fixed argv, keeps
atomic local state, and waits for a new process to confirm the Loader row.

Run the workspace gate with:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm run pack:platform-client
pnpm run smoke:platform-client
pnpm run pack:plugin-distribution
pnpm run smoke:plugin-distribution
pnpm run pack:bundle
pnpm run accept:t11-model
pnpm run accept:t14-dsh-plugin
```

## Android / DSH runtime environment adaptation

On an Android host (`process.platform === 'android'`, arm64, Termux-fork under
`com.deepcode.shell`), the default toolchain assumptions do not hold: the
filesystem layer rejects hard links and, on `/storage` (FUSE), symlinks; the
Bionic `linker64` refuses to exec any `#!` script it is handed; and neither
vitest's `forks` pool nor Node's `--test` runner start their workers. The
workspace gate still runs green there once these five adjustments are applied
(all are environment-side; no product test or expectation is modified):

```sh
# 1. Keep the repo on internal storage (/data), never /storage (FUSE lacks symlink/link support).
# 2. Point esbuild at its Android native binary so install never execs the JS shim.
export ESBUILD_BINARY_PATH=<repo>/plugin/node_modules/@esbuild/android-arm64/bin/esbuild
# 3. Install without lifecycle scripts; esbuild's postinstall self-check cannot run under linker64
#    and contributes nothing to build/typecheck once the native binary is present.
npx pnpm@11.7.0 install --frozen-lockfile --ignore-scripts
# 4. Run every vitest suite with the threads pool (forks workers die with EPIPE on Android).
npx vitest run tests --pool=threads
# 5. The root invariant gates must be driven through `node --test` on CI; locally on Android that
#    runner fails to start, so import workspace.test.mjs / core-packages.test.mjs directly —
#    their assertions pass unchanged (6/6).
```

The client-plugin and platform-client suites additionally report red on
Android for non-environment reasons that are intentionally not papered over:
`client-plugin` is missing its host entry `src/index.ts` (never tracked in git),
and `platform-client` uses `fs.link()` for its atomic installation write, which
the Android filesystem rejects — both need their own design decision, not a
test-expectation change.

The packed bundle is accepted by `scripts/t01-harness-smoke.mjs` as both a
standalone package consumer and an installed plugin in a temporary Harness
`web` profile. It proves the zero-configuration `UNCONFIGURED` state, saves the
Server origin through the plugin's local API, and verifies the official
`settings.yaml`; it never writes to the sibling Harness checkout.
`pnpm run accept:t07-browser` starts a controlled loopback platform and a
temporary real Harness profile for the non-blocking setup/login/expiry/revocation
acceptance; stop it with SIGINT so it can verify upstream cleanliness and remove
its temporary `DSH_HOME`.
`pnpm run accept:t11-model` is fully automatic: it installs the tgz into a
temporary rc.2 `web` profile, logs in through PKCE, drives the real `ctx.llm`
runtime, verifies dynamic models and stable failures, scans local files for the
platform Token/provider keys, and confirms the sibling checkout remains clean.
`pnpm run smoke:plugin-distribution` installs the three release tarballs into a
fresh package consumer without ambient declarations. `pnpm run
accept:t14-dsh-plugin` uses a temporary `DSH_HOME` and paths containing spaces
to prove exact add, downgrade rollback, profile reconciliation, and remove
against the locked unmodified CLI.
