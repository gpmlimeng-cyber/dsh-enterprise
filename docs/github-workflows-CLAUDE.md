# workflows/

> L2 | 父级: ../CLAUDE.md

成员清单

release.yml: PR/push 并行执行 server-check（Maven 企业+server 测试 + surefire 日志密钥扫描）、console-check（pnpm check）、镜像构建与插件打包；main 发布 GHCR `next`，版本标签通过 npm Trusted Publishing 发布 tgz。server-check/console-check 不阻塞 images 拓扑，避免首日卡死制品构建。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
