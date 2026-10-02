# tools/skillhub-import/

> L2 | 父级: ../CLAUDE.md

成员清单

README.md: 唯一操作说明——依赖与凭据、流水线 8 步的脚本/输入/产出、17 条转换门禁、许可闸门白名单、四桶分类映射表与 `GATE_CATEGORY_MAPPED` 门禁语义、未入库清单与 sha256 一致性表。先读它再读代码。

common_auth.py: 鉴权底座，PKCE Authorization Code + S256 把管理员端（`ent-admin-cli`）与员工端（`dsh-desktop` + 已注册设备 `installation_id`）换成 Bearer token；凭据只从 `/opt/owndsh/CREDENTIALS.txt` 读，`installation_id` 只来自 `INSTALLATION_ID` 环境变量或调用参数（源码不内置设备标识），并对外提供无重定向 HTTP 调用器与游标翻页。被 baseline/deploy/verify/download_proof 复用，避免四份复制的鉴权漂移。

fetch_top_n.py: 流水线入口，按 score 拉 `api.skillhub.cn/api/skills` 列表并下载原始 zip 到 `raw/pkg/`，只落盘不判断；`REFRESH=1` 强制重取列表。

audit_candidates.py: 对候选包做第一遍事实导出（包结构、frontmatter 真 YAML 解析、`subCategories`、许可字段原文），产出 `raw/candidate-audit.json`；**不判定许可**，只提供后续闸门与转换的原文依据。

license_scan.py: 全量许可证据导出与粗判定，产出 `raw/license-scan.json`；判定规则内置，是 `preflight_all.py` 的输入。

license_gate.py: 许可**最终**判定，按 frontmatter → 包内 LICENSE 正文 → README 许可证节 → 元数据 `license` 的顺序取证，只放行 MIT/Apache-2.0/BSD/ISC/0BSD，copyleft 与非商业条款优先整包拒绝，产出 `raw/license-gate.json`。

preflight_all.py: 只对许可 ALLOW 的候选跑一遍与服务端 `SkillArtifactInspector` 逐条对齐的预检（含 SnakeYAML `allowDuplicateKeys=false` 的重复键检查），产出选品依据 `raw/preflight-allowed.json`。

convert.py: 导入链路的转换核心，把 `raw/pkg/*.zip` 按文件内 `PLAN` 转成 `.dshskill`（`manifest.json` + `skills/<dirName>/…`），逐包记 17 条门禁与拒绝原因，宁可拒绝不静默裁剪；分类映射只认平台真实 key，未映射由 `GATE_CATEGORY_MAPPED` 拦下并进 `pendingCategories`，**没有静默兜底**；`--dry-run` 跑全门禁不落盘，供只读复盘。

deploy.py: 全链路中**唯一会改服务端状态**的脚本——上传制品、发布版本、对新技能做全员（ALL）分配；只读/复盘场景一律不得调用。

verify.py: 只读回读验证（管理端列表、员工端可见、单技能详情、原有技能逐字段未变对照），并断言每个技能 `category` 落在四桶白名单内，产出 `evidence/verify-*.json`。

download_proof.py: 运行时面证明——以员工设备身份实拉 `versions/{id}/download` 并核对 SHA-256，证明全员分配在运行时真的放行。

finalize_evidence.py: 机械清单生成（原始包与产出包的 SHA-256、产出包逐条文件树），不含任何判断。

make_evidence.py: 把上面所有 JSON 证据汇编成 `EVIDENCE.md`，所有数字取自实测文件不手抄。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
