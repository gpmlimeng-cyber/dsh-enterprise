# workspace/

> L2 | 父级: ../CLAUDE.md

成员清单

EnterpriseWorkspaceProperties.java: enterprise.cloud-workspace.enabled 默认 true 与 repo-root 部署边界。
EnterpriseWorkspaceConfiguration.java: 装配 Git basic filter、bare 仓库服务、Smart HTTP 与 CloudWorkspaceService。
domain/: CloudProject 与 CloudProjectMember 不可变事实。
application/: slug 规范化、创建（先建仓后事务写入 + 失败清理）、列表/成员治理、Git 授权、审计与 CloudWorkspaceException。
git/: bare 初始化、JGit Upload/ReceivePack Smart HTTP 与非 fast-forward 拒绝。
persistence/: V31 项目的 PostgreSQL adapter。
web/: Runtime 云端项目 API、Git Smart HTTP 控制器与 Basic→Bearer 滤镜。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
