# web/

> L2 | 父级: ../CLAUDE.md

成员清单

AdminSkillController.java: ent:skill:read/write 保护的管理入口，cursor 列表、multipart 上传、publish/retire、可见范围 batch 与 builtin/featured 标记写入。
RuntimeSkillController.java: ACTIVE 设备入口，可见技能列表/详情与单 Range 授权下载（nosniff + ETag）。
SkillViews.java: 统一安全投影，字符串化 snowflake、builtin/featured、可选 category（管理端 PackageView 与员工端 runtime 摘要/详情两处都带出，null 即没有分类）与包内条目；artifact 路径与 SKILL.md 正文永不进入响应。**builtin 现在三处投影都带出**（管理端 + 员工端摘要/详情，同一包级列的真值），员工端「已安装」分组据此只显示非内置的已装行；契约把它声明为 required，故员工端两处**恒发真值**（primitive boolean 不可能缺席），漏 select 只会静默发 false 而不会编译失败。
SkillUploadMetadata.java: multipart 可选元数据 DTO，不承载路径或正文。
SkillAssignmentBatchRequest.java: 最多 200 条 ALL/USER 可见范围原子 replacement 请求体。
SkillMarksRequest.java: builtin/featured 必填的标记写入请求体，字段缺席立刻失败而不是静默落 false。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
