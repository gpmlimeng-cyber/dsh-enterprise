<!--
[INPUT]: 依赖受管插件调和、制品验证、官方命令边界和显式整包卸载实现。
[OUTPUT]: 提供默认免公钥安装、可选验签、安装/回滚/移除与新旧 Harness 库存兼容说明。
[POS]: @dshent/plugin-distribution 的公开语义入口，界定中心期望与本地 Loader 事实。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# @dshent/plugin-distribution

Harness Host 的受管插件调和 Service。它只消费 `ctx.enterprisePlatform` 的完整 bootstrap、
普通 Web 使用兼容 Harness 的 `ctx.subprocess`/`ctx.pluginInventory`，Desktop 使用公开
`desktopProfiles.current`/`desktopPnpm.runPlugin()`；本服务不会扫描或上传个人插件、配置、
源码和本地路径。
库存读取统一等待 `pluginInventory.list()`，同时支持 `0.1.1-rc.2` 的同步快照与
`0.1.2-rc.1`、`0.1.5-rc.2` 的异步快照；重启确认、移除、库存上报和整包卸载均使用同一读取边界。

管理员发布并配置可见范围后，插件进入员工目录。bootstrap/revision 轮询只刷新目录、确认重启和上报库存，不自动安装、升级或回滚；历史 `required=true` 也不触发安装。用户选择保留在当前设备/profile，其他设备独立选择。删除可见范围或退休版本会停止新安装，已有安装保留；显式 `ABSENT` 撤回会移除本机已受管插件。

用户调用 `install(packageName, pluginVersionId)` 后串行执行以下闭环：

1. 重新请求中心 `/plugins/assignments` 校验可见范围和所选版本；缓存同样重新授权，再把制品流式写入 `$DSH_HOME/enterprise/artifacts/<sha256>.tgz.part`。
2. 始终校验准确字节数、SHA-256 和 Harness/bundle/OS compatibility；仅在 `verifyPluginSignatures=true` 时额外使用固定 Ed25519 公钥验签。
3. 原子改名为 `<sha256>.tgz`，再以 argv 调用
   普通 Web 执行 `dsh plugin --profile <active-profile> add --ignore-scripts --save-exact <absolute-tgz>`，Desktop 委托当前 profile 的 `runPlugin()`。
4. 原子写入 `$DSH_HOME/enterprise/managed-plugins.json`，保持 `RESTART_REQUIRED`，不 HMR、
   不退出当前进程。
5. 下一进程联合状态文件的旧进程标记与 `pluginInventory.list()` 的 active Loader row，
   才把安装上报为 `ACTIVE`。ABSENT 同样要求下一进程确认 Loader row 消失后删除本地记录。

用户调用 `remove(packageName)` 使用同一环境原生命令边界，卸载后不会被轮询或重启重新安装。普通 Web 固定 argv 为 `dsh plugin --profile <active-profile> remove <package-name>`；Desktop 委托 `runPlugin(['remove', packageName])`。子进程边界会清理
ambient credential 与 `DSH_*`，因此本包显式只传回非秘密 `DSH_HOME`。stdout/stderr 仅作有界
进程诊断，不进入状态文件或库存。

`verifyPluginSignatures` 默认 `false`，员工只需填写 Server 地址并登录，无需配置公钥；关闭时也不解析配置中遗留的公钥。
大小、SHA-256、兼容性、逐请求授权和核心包保护始终生效。HTTP 内网模式信任部署网络与所连接的 Server；SHA-256 用于校验字节完整性，不能阻止同时篡改包与元数据的中间人。

需要验签时，在 Harness profile 的 `owndsh` 配置中显式开启，并填写对应部署的公钥：

```yaml
- id: owndsh
  config:
    verifyPluginSignatures: true
    trustedPluginPublicKey: '<部署专属 Ed25519 SPKI PEM 或 DER Base64>'
```

信任公钥只来自安装层 Config；bootstrap 没有修改验签开关或替换信任根的入口。开启后，缺失公钥或签名不匹配会在目录和安装路径上以 `ENT_PLUGIN_SIGNATURE_INVALID` 阻断；缓存制品同样执行所选策略。
服务端 `ENT_PLUGIN_SIGNING_ENABLED` 默认 `false`，无需配置私钥，返回 `signatureBase64: ""`；客户端关闭验签时接受空签名，开启时拒绝。需要签名的部署同时设置服务端 `ENT_PLUGIN_SIGNING_ENABLED=true` 和 `ENT_PLUGIN_SIGNING_PRIVATE_KEY`。开启只影响新上传版本，不补签历史无签名版本（同版本幂等上传也不补签），需上传新的插件版本后再要求客户端验签。
通用分发拒绝
bundle、platform client、distribution 自身以及 contracts、LLM、Session、UI 等企业核心传递包。
版本回滚与升级使用同一个校验策略和 exact tgz 安装路径，任一步失败都保持 `FAILED`，绝不标记 active。
DSH Enterprise 本体按 Harness caret peer 范围运行；第三方制品仍坚持独立的精确 commit 白名单。制品白名单基线是官方 Desktop `0.1.7-rc.2`（`477b4f420553e8a52c2fbccc464d7561b239c443`）；客户端版本->commit 映射表另含 `0.1.1-rc.2`、`0.1.2-rc.1`（`a66e4702047846cdaa10c66c9d3df3951f5ea70d`）、`0.1.5-rc.2`（`fb2c4b9e698e30edb738bca4cf0618587db7d203`）与新补的 `0.2.0-rc.2`（`639ed015397290b3745d163aafe02ffee4aa3f84`，官方发行 tag `dsh-v0.2.0-rc.2` 指向的 commit）。市场在安装前显示信任根/兼容性阻断原因。

### 兼容判定的四个子句（哪些拦、哪些只警告）

`verifyAssignmentMetadata` 把"制品给出的正向否定"与"我们无法确证"分开处理：

| # | 子句 | 语义 | 结果 |
|---|------|------|------|
| 1 | `enterpriseBundleRange` 不满足本机 bundle 版本 | 制品明确声明了它支持的版本范围 | **硬失败** `ENT_PLUGIN_INCOMPATIBLE` |
| 2 | `operatingSystems` 不含本机归一化平台 | 制品明确声明了它支持的系统集合 | **硬失败** `ENT_PLUGIN_INCOMPATIBLE` |
| 3 | 引擎 commit **已确知**但不在制品 `harnessCommits` 白名单 | 制品明确声明了它验证过的 commit 集合，已确知引擎落在集合外 | **硬失败** `ENT_PLUGIN_INCOMPATIBLE` |
| 4 | `harnessCommit === undefined`（本机引擎版本不在客户端映射表里） | **我们无法确证** commit，即"不认识这个引擎版本" | **警告** `ENT_PLUGIN_HARNESS_COMMIT_UNKNOWN`，**不拦**安装 |

验签（`verifyPluginSignatures=true`）永远是硬失败，与上表四条互不影响。

**为什么子句 4 必须只警告（设计裁决）**：旧实现把四个子句并成一个 if，于是"映射表里没有本机引擎版本"被当成"不兼容"，**每一次引擎升级都会一次性打死整个企业商城**。不认识 ≠ 不兼容，因此降级为可解释警告；下载与安装照常进行，由真实运行结果裁决。警告只写 Host 日志（`ctx.logger.warn`），**不新增 status() 线协议字段**，避免服务端/客户端/UI 三处连锁改动。

**诚实口径（不许悄悄映射）**：`bundle/src/index.ts` 的 `VERIFIED_HARNESS_COMMITS` 只写**查证到的事实**（官方发行 tag `dsh-v<version>` 指向的 commit，并以该 commit 的 `apps/cli/package.json.version` 交叉核对）。表里没有的版本一律**省略** `harnessCommit` 走子句 4，严禁把它硬编码成某个"看起来像基线"的旧 commit 来假装命中白名单。

### 服务端 `harness_commits` 补齐与签名覆盖

服务端签名声明 `PluginManifestSigner.SignatureManifest`（`server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/plugin/artifact/PluginManifestSigner.java:91-107`）的字段是 `artifactId / packageName / version / sizeBytes / sha256 / compatibility`，其中 `compatibility` 即 `PluginCompatibility`（`.../plugin/domain/PluginCompatibility.java:14-18`，含 `harnessCommits / enterpriseBundleRange / operatingSystems`）。**结论：`harness_commits` 确实被 Ed25519 签名覆盖**，直接改库会让开启验签的部署在随后复查时得到 `ENT_PLUGIN_SIGNATURE_INVALID`。

正当路径按部署状态分两种：

- 部署为 `ENT_PLUGIN_SIGNING_ENABLED=false`（本仓库默认，返回 `signatureBase64: ""`，`signature` 列为零长 bytea）：该行本来就没有签名可破坏，补齐数据不触发验签失败；
- 部署已开启签名：必须用**同私钥重新签名**（走服务端上传/重签流程或等价的签名工具），再要求客户端验签。开启只影响新上传版本、不补签历史版本这条既有口径不变。

补齐后的断言必须显式落盘，不得悄悄映射。本次运维记录（2026-10-02，生产库 `src-postgres-1` / `owndsh`）：

**改前（逐行原文，6 行，`octet_length(signature)` 全为 `0`）**

```text
@furayoshi/dsh-ui-models-invert-selection 1.0.1 PUBLISHED sha=c2863070616d sig=0
  {"harnessCommits": ["477b4f420553e8a52c2fbccc464d7561b239c443"], "operatingSystems": ["darwin","linux","win32"], "enterpriseBundleRange": ">=0.1.0 <0.2.0"}
@mengli114/dsh-settings-nav-collapse  1.0.1 PUBLISHED sha=af0827683683 sig=0   （同上 harnessCommits）
dsh-i-have-adhd                       1.0.2 PUBLISHED sha=289acc87dc15 sig=0   （同上 harnessCommits）
dsh-turnsnap                          1.0.0 PUBLISHED sha=f3edb6035f88 sig=0   （同上 harnessCommits）
dsh-yorha-ui                          0.1.1 PUBLISHED sha=582322a67621 sig=0   （同上 harnessCommits）
owndsh-test-hello                     0.1.0 PUBLISHED sha=860c02563000 sig=0
  {"harnessCommits": ["a66e4702047846cdaa10c66c9d3df3951f5ea70d","b150a551b8d465e31e418e1b2eaf5e79bbb7d28e"], "operatingSystems": ["darwin","linux","win32"], "enterpriseBundleRange": ">=0.1.0 <0.2.0"}
```

**改后（同上 6 行；`sha256` / `status` / `operatingSystems` / `enterpriseBundleRange` 逐字未变）**

```text
5 行 -> "harnessCommits": ["477b4f420553e8a52c2fbccc464d7561b239c443","639ed015397290b3745d163aafe02ffee4aa3f84"]
1 行 -> "harnessCommits": ["639ed015397290b3745d163aafe02ffee4aa3f84","a66e4702047846cdaa10c66c9d3df3951f5ea70d","b150a551b8d465e31e418e1b2eaf5e79bbb7d28e"]
```

执行语句（事务内带前后置断言：改前必须是 5+1 行、改后必须 6 行含 `639ed015…` 且 `operatingSystems`/`enterpriseBundleRange` 零改动，否则 `RAISE EXCEPTION` 整事务回滚）：

```sql
-- 显式兼容性断言：官方 Desktop 0.2.0-rc.2（commit 639ed015…）与这些制品所声明的
-- harness_commits 基线（477b4f… / a66e4702…+b150a551…）视为兼容，故并入白名单。
-- 依据：这些制品是纯 UI/行为插件，只依赖 Harness caret peer 范围；引擎 0.2.0-rc.2 的
-- 破坏性变更不在本表插件触及的面内——此为**运维方断言**，不是厂商原始声明。
UPDATE ent_plugin_version SET compatibility_json = jsonb_set(
  compatibility_json, '{harnessCommits}',
  '["477b4f420553e8a52c2fbccc464d7561b239c443","639ed015397290b3745d163aafe02ffee4aa3f84"]'::jsonb)
WHERE compatibility_json->'harnessCommits' = '["477b4f420553e8a52c2fbccc464d7561b239c443"]'::jsonb;

UPDATE ent_plugin_version SET compatibility_json = jsonb_set(
  compatibility_json, '{harnessCommits}',
  '["639ed015397290b3745d163aafe02ffee4aa3f84","a66e4702047846cdaa10c66c9d3df3951f5ea70d","b150a551b8d465e31e418e1b2eaf5e79bbb7d28e"]'::jsonb)
WHERE compatibility_json->'harnessCommits' = '["a66e4702047846cdaa10c66c9d3df3951f5ea70d","b150a551b8d465e31e418e1b2eaf5e79bbb7d28e"]'::jsonb;
```

回滚：`pg_dump --data-only --column-inserts -t ent_plugin_version` 的整表备份已落盘（`<HOME>/.sshwork/lane-db-backup-ent_plugin_version.sql`，6 行），必要时 `TRUNCATE` 后 `\i` 该文件即可复原；改前快照另存同目录 `lane-db-before.txt`，改后 `lane-db-after.txt`。

升级部署时必须同时更新员工 `dshent-plugin`：旧客户端把 `INSTALLED` 当成自动安装指令，仅升级后台或把 `required` 改为 false 无法改变旧客户端行为。本地状态文件保持兼容；空签名响应要求新版客户端，后台新保存的可见范围统一写入 `required=false`。
本地状态文件无法校验时，调和器进入稳定的 `ENT_PLUGIN_STATE_INVALID` 终态并丢弃后续 pending revision，避免 Host 忙循环；修复状态后需重启 Harness 重新载入。

员工可从企业界面显式卸载：Service 先通过同一官方命令边界移除当前已安装的受管包，清空受管状态，
最后移除 `dshent-plugin`。调用层只在成功响应写回后请求 Desktop 官方重启；普通 Web 不管理宿主进程。
