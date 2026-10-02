<!--
[INPUT]: 依赖本会话在 Android 设备 + 远程服务器上反复踩到的环境事实与部署口径。
[OUTPUT]: 一份可直接照着做的"环境坑与口径"清单，减少后续重复试错。
[POS]: docs/notes 下的工程速查；与方案/宪章无关，只讲怎么在这台机器上把活干成。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 环境坑与口径（本会话实测）

## 一、路径与权限
| 事实 | 后果 | 正确做法 |
|---|---|---|
| `/data/user/0/...` 是 `/data/data/...` 的**符号链接** | 普通 `grep -r` **不跟随符号链接** → 看不到真实树；`find / -xdev` **不跨挂载** → `/data` 整块被跳过 | 用真实绝对路径；要递归搜索用 `grep -R`（大写）或进目录 |
| 可执行性按**路径**而非 inode 判定 | `ESBUILD_BINARY_PATH=/data/data/...` → `spawn EACCES` | 一律用 `/data/user/0/...` 路径（同一文件，这个路径可执行；实测 `esbuild --version` = 0.28.1） |
| `/tmp` 不可写 | 临时文件写失败 | 放 `/data/user/0/com.deepcode.shell/files/home/.sshwork/` 或服务器 `/opt/work/` |
| 本机 `pnpm`/`npx` shim 坏了（`bad ELF magic`） | 命令直接失败 | 用 `./node_modules/.bin/*`，或用 `npx --yes pnpm@11.7.0` |

## 二、产物与可复现性（★推翻一个常见假设）
- **插件 tgz 不是字节级可复现的**：同一工作树重跑 `pack:bundle` → 字节数相同但 md5 不同
  （tar/gzip 内嵌时间戳）。内容级：27 个文件里 26 个逐字节一致，唯一差异是 `package.json` 里
  5 个依赖的**键顺序**（深度语义比对差异为 0）。
  ⇒ **不要用 tgz 的 sha256 当"提交指纹"**；要出指纹就用"包内文件内容清单 + 各自的 sha256"。
- 同理：`dsh plugin add <tgz>` 后，判断"装的是哪一版"要看**包内文件内容**，不要只看 tgz 哈希。

## 三、构建与部署口径
| 事项 | 口径 |
|---|---|
| 服务端构建 | `docker run … maven:3.9.11-eclipse-temurin-21-alpine` + `mvn -B -ntp -Pprod -DskipTests -pl owndsh-server -am package`；`/opt/work/slice-a-m2` 是可复用的 maven 缓存卷 |
| 测试参数（三个坑） | `pom.xml` 默认 `maven.test.skip=true` ⇒ 要显式打开；`-Pprod` 会**整体跳过** dev 测试；过滤器不匹配要加 `-Dsurefire.failIfNoSpecifiedTests=false` ⇒ **"镜像构建成功" ≠ "测试通过"** |
| 控制台构建 | `Dockerfile.console` 的 `RUN pnpm build` **含 `tsc --noEmit`** ⇒ 类型错的测试文件会**挡住构建**（改名/删除前先备份）；Dockerfile 里的 `RUN chmod -R a+rX /usr/share/nginx/html` 是修 403 破图的必需项，**别删** |
| 控制台端口 | 容器内 **18080**（不是 80）；公网入口 `https://62.234.16.179/` |
| 迁移验证 | 用**一次性** PG17：`docker run -d --network none -e POSTGRES_PASSWORD=<随机> postgres:17-alpine`，跑完 `docker rm -f`；**绝不碰线上 `src-postgres-1`** |
| 迁移号 | V38 已被中心导入方案预定、V39 已用于配方依赖列、V40 归连接器 ⇒ 下一个空号 **V41**（开工第一步必须重跑核对，不要信文档） |

## 四、CJK 在产物里的两种形态（grep 之前先想清楚）
- **插件产物（esbuild `charset:'ascii'`）**：中文被转义成 **`\uXXXX`（小写 u + 大写十六进制）** ⇒ grep 中文原字符必为 0。
- **控制台产物（vite）**：中文是**原始 UTF-8** ⇒ 直接 grep 中文即可。

## 五、服务器文件通道
- `node remote.mjs '<cmd>'`：**不支持 stdin 管道**。
- 传文件：base64 内联 + 远端 `base64 -d`；整目录：先 `tar` 再 base64。
- ⚠️ 做"给远程代理用的载荷"时**用 tar 整目录**，不要手写文件清单——本会话就因为清单里混进了**目录行**，
  导致两个新测试文件没进载荷（远程代理自己补齐才发现）。

## 六、并行写入纪律
- 同一工作树里多个代理同时写 → 测试会间歇红、甚至丢写。
- 规矩：**同一文件同一时刻只允许一个写入者**；派单时明确"保留文件"（本轮就成功保留了
  `SidebarNav.tsx`/`product-routes.ts`/`console-shell.tsx` 给另一路）。
- 提交按**地盘**（包/目录）切分，别把别人的在制品卷进自己的提交。

## 七、设备侧构建前置条件：pnpm 10.12.1 撞上 `packageManager: pnpm@11.7.0`

| 项 | 内容 |
|---|---|
| **症状** | 本机 `pnpm` 是 **10.12.1**，而 `plugin/package.json` 声明 `packageManager: pnpm@11.7.0`。在 `plugin/` 下跑 `npm run pack:bundle` 时，pnpm 触发**「托管版本自升级」**（想自己下载 11.7.0），Android 上直接抛 **`bad ELF magic`**；且 **任何嵌套 pnpm 必挂**（`pack:bundle` → `pnpm --filter … build`，以及 `packages/bundle/scripts/build.mjs` 里的 `pnpm exec tsc` 都是嵌套）⇒ 依赖构建链整体跑不动，`lib/` 生不出来。 |
| **唯一实测有效修法** | 打包前在 `plugin/pnpm-workspace.yaml` **末尾临时追加一行**：`managePackageManagerVersions: false`（先备份该文件）⇒ `pack:bundle` 可跑通（实测退出码 0）。**打完包立刻删掉这一行、还原到与 HEAD 逐字节一致**（`git diff` 必须为空）——不污染 CI 的 `packageManager` 版本强制语义。 |
| **生效范围** | 仅**本机设备侧**打包需要；CI 不采用该行。附带：`ESBUILD_BINARY_PATH` 必须用 `/data/user/0/...` 形态（`/data/data/...` 会 `EACCES`，见第一节），且一律走 `node_modules/.bin/*`、vitest 加 `--pool=threads`。 |
