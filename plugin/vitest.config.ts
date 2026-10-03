import { defineConfig } from "vitest/config";

/**
 * 本机（Android/Termux）vitest 修复：锁 `pool: "threads"`；默认的 `forks` 在这台机器上必崩。
 *
 * 根因（对照实验钉死，非配置问题）：
 *   本机从 `pnpm exec` / `pnpm run` 起的**整个子进程树**里，`process.execPath` 都是
 *   `/apex/com.android.runtime/bin/linker64`（Android 动态链接器），不是真正的 node ELF
 *   （`pnpm exec node -e '...'` 实测打印 `execPath=/apex/com.android.runtime/bin/linker64`）。
 *
 *   vitest 的 `forks` 池用 `child_process.fork(entry, [], { execArgv })` 起 worker，fork 用
 *   `process.execPath` 当 argv[0] → 拿到 linker64 → 它把首个非 flag 参数（worker 脚本路径、
 *   `--experimental-import-meta-resolve`、`--test-concurrency` 等）当成「要映射的 .so 绝对路径」：
 *     - 相对/非常规参数 → `error: expected absolute path: "<arg>"`
 *     - 有的形态直接 EPIPE：`write EPIPE`（worker 一启动即死）
 *   两种形态都导致 `Test Files: no tests` / `Worker exited unexpectedly`。
 *   实测两种版本同一根因、报错文案不同：
 *     - vitest 4.1.8（plugin 锁的版本）：`write EPIPE` + `no tests`
 *     - vitest 4.1.11（console 用的版本）：`error: expected absolute path` + `Worker exited unexpectedly`
 *
 *   `threads` 池用 `node:worker_threads` 的 `new Worker()`，不开子进程、不碰 execPath，
 *   完全绕开 linker64 ⇒ 稳定通过（实测 bundle 33 文件/397 测试、ui、console 22 文件/120 测试 全绿）。
 *
 * 为什么放在 `plugin/vitest.config.ts` 而不是各包内：`plugin/` 根的 `package.json` 声明了
 * `vitest` 依赖，从该根目录起跑的 `vitest`（`pnpm --recursive run test` 逐包执行、CLI 根目录为
 * `plugin/<pkg>` 时向上查找配置）会命中这份共享配置；这台机器上**所有**包都需要 threads，
 * 放根上一份即可覆盖（与 `tsconfig.base.json` 同一策略）。`console/` 是独立 workspace（vitest
 * 4.1.11），不受本文件影响——它自带 README 环境章节里 `--pool=threads` 的跑法。
 *
 * 这是环境层 bug，与被测代码无关；正常 Linux/macOS 上 forks 与 threads 都可用，锁 threads
 * 是为了让本机 `pnpm test` / `pnpm --recursive run test` 能真正跑起来。
 */
export default defineConfig({
  test: {
    pool: "threads",
  },
});
