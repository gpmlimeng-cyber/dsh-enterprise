# scripts/

> L2 | 父级: ../CLAUDE.md

成员清单

bootstrap-harness.ps1: Windows/PowerShell 开发环境入口，读取版本锁并准备同级 Harness checkout。
bootstrap-harness.sh: macOS/Linux 开发环境入口，执行与 PowerShell 脚本相同的版本锁校验和 checkout 准备。
check-all.sh: 提交前本地门禁；compose config、扫描器自测、三站 --check，FULL=1 时追加 mvn 测试与 console check。
connector-parity.mjs: 连接器纵深的**跨语言一致性静态门禁**——比对宿主内核（`plugin/packages/bundle/src/connector/{capability,bundle}.ts`）与服务端闸门（`server/.../connector/application/ConnectorDescriptorGate.java` + `domain/ConnectorEntry.java`）这**同一套规则的两次落地**：传输词表、能力声明必填九枚、关闭键集、明文键名正则、自贴层级判据、三枚形状正则（凭据键名/env 名/头名），共 8 项；一致返回 0，不一致逐项打印两侧原文并返回 1。**不需要 JVM/DB**（本机可跑）。来源：第二十二刀靠它抓到一次**真实漂移**（层级自贴：宿主按"键名含 level/permission/tier"判、服务端按"精确相等"判 ⇒ 同一份声明两侧给出不同稳定码），已对齐并做了阳性对照（注入漂移 ⇒ 报 ✗ 且 exit 1）。
install-market-plugin.sh: 本机"看真机"入口，把 dshent-plugin 打包覆盖 baseline 制品并装机到 ~/.dsh/profiles/{desktop,web}；`--pack` 只打包、`--install` 只装机、默认两者都做，幂等且逐步失败即报卡点。固化三个 pnpm 陷阱：按缩进删 lockfile 里 dshent-plugin 的三处块（键带 peer 后缀，逐行正则易漏）、清 store links 里该 file: 依赖条目否则复用旧字节、归一化 pnpm-workspace.yaml 中未决的 allowBuilds（占位值会让 pnpm 11 以 ERR_PNPM_IGNORED_BUILDS 整条失败）；最后以解包 tgz 的 lib/client.js md5 为唯一真值校验两侧。
bootstrap-desktop.mjs: 插件桌面基线入口，按官方 Harness Desktop 锁准备同级 checkout，并校验 apps/desktop 版本；拒绝污染或版本漂移。
bootstrap-harness-desktop.mjs: 员工桌面客户端入口，按同一把官方锁准备同级 dsh-desktop checkout，并校验上游 apps/desktop 版本；企业安装包客制在仓库 apps/desktop，不复制源码。
bootstrap-harness-desktop.test.mjs: 官方 Harness Desktop 锁格式回归测试，覆盖成功锁与缺包名失败。
local-demo.sh: 人工验收唯一启动入口，以随机 HTTP 端口、全新临时 release 后端和源码 CLI shim 驱动单个真实浏览器 Harness，提供可执行受管插件调和且无自动业务操作的本地体验环境。
scan-sensitive-logs.mjs: CI 日志流式扫描器，检测常见凭据形状与外置受控 literal 且不回显命中内容。
scan-sensitive-logs.test.mjs: 日志扫描器自验，覆盖递归干净日志、Bearer 与受控明文失败。
t20-recovery-drill.sh: 隔离 Docker 故障演练，覆盖 PostgreSQL/Redis kill-restart、全新恢复、artifact/key 分离备份与只读磁盘。
upstream-baseline.mjs: 客户端基线工具，验证 Desktop→Harness 派生锁与本地 checkout 的精确版本。
upstream-baseline.test.mjs: 基线工具纯函数回归测试，覆盖 Desktop/Harness 锁对齐、锁格式和来源地址归一化的成功与失败边界。
v1-e2e-fixture.mjs: V1 E2E 共用 OIDC Authorization Code + PKCE 与三协议模型上游，支持 429/5xx/断流/无 usage 状态并仅记录脱敏请求事实。
plugin-signing-ops-e2e.sh: 以真实离线安装、备份和恢复入口验证无密钥/有密钥两种模式，损坏测试数据与签名私钥后验证 PostgreSQL/Redis/artifact/key 全量恢复，仅清理本次隔离资源。
plugin-signing-e2e.mjs: 隔离 HTTP Compose 与锁定 Harness 的 16 场景签名策略 E2E，覆盖默认免密钥完整生命周期、损坏制品/授权拒绝、开关切换和严格验签，输出脱敏证据并清理临时环境。
v1-e2e-harness.mjs: V1 E36-E47 锁定 Harness 真实纵向验收器，公开共用登录 opener/进程工具，按服务端开关装配可选验签，自动完成 LOCAL PKCE 登录并验证三协议重试归属、受管插件完整生命周期、设备撤销、审计关联与 Session 停用。
v1-e2e-models.mjs: V1 E23-E35 模型目录、模型集授权、Token 窗口、Provider/成员 RATE 与结算恢复的真实纵向验收模块。
v1-e2e-release.mjs: 共用 tgz/发布工具与 V1 E43-E47 受管插件安全验包、按部署开关校验签名或空签名发布、Harness CLI 生命周期、设备撤销、审计关联与 Session 停用验收模块。
v1-e2e-compose.yml: 在现有部署 Server 上只读挂载本轮 LDAP truststore 的临时 Compose 叠加层，不复制生产拓扑。
v1-e2e-support.mjs: V1 E2E 的真实验证码生成/消费（隔离 Redis 读取答案）、PKCE、Cookie/Bearer HTTP、断言记录和 Compose PostgreSQL 查询标准库原语。
v1-e2e.mjs: V1 E01-E48 的真实部署、身份、模型、配额、Harness、插件与产品壳发布验收编排器。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
