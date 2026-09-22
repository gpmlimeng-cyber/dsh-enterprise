# plugin/artifact/

> L2 | 父级: ../CLAUDE.md

成员清单

PluginArtifactException.java: 把不可信归档失败封闭为 INVALID 与 TOO_LARGE 两个稳定 HTTP 类别。
PluginArtifactInspector.java: 用 Commons Compress 单遍读取 tgz，拒绝路径逃逸、链接、设备文件、原生模块和不安全 package 元数据；企业核心包名单由配置注入（真源 `contracts/plugin-core-packages.json`），构造时空表即 fail-fast，杜绝内嵌第二份名单再次漂移。
PluginArtifactNormalizer.java: 把 zip 与 GitHub 包装目录在上游折叠为规范 npm tgz，使员工端 `dsh plugin add`（npm/pnpm 语义，两者都拒 zip）真正装得上；已是 npm 布局的 gzip tar 由调用方按字节透传以保住历史 SHA-256，重写产物固定 mtime/uid/gid/mode/OS 保证字节可复现；只重排容器与路径，内容安全裁决仍由 inspector 独占。
PluginArtifactStore.java: 有界写入 `.part`、整包 SHA-256、zip/tgz 归一化写入（边写边算 hash 并执行硬上限）、进程内加操作系统 hash 锁、同文件系统原子 CAS 移动与受控读取定位。
PluginManifestSigner.java: 关闭时以空字节数组表达未签名；开启时严格解析 Ed25519 PKCS#8 私钥，对固定声明执行 RFC 8785 JCS 后签名。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
