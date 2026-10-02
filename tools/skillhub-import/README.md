# skillhub.cn 技能导入器

把 [skillhub.cn](https://skillhub.cn) 上的第三方技能包导入 DSH 企业技能中心（`.dshskill`）的**可复现工具链**：
抓取 → 候选审计 → 许可硬闸门 → 服务端同级预检 → 转换 → 上传/发布/分配 → 回读验证 → 留证。

这份脚本原先只存在于远程服务器的 `/opt/work/skillhub-import/`，仓库里没有，别人无法从仓库复现这条能力。
本目录是它在仓库中的落点，脚本与服务器侧真源**逐字节一致**（sha256 见文末）。

---

## 1. 运行环境与依赖

| 项 | 要求 |
|---|---|
| Python | 3.11（脚本按 3.11 语法写，未做 3.8 兼容） |
| 第三方库 | `PyYAML`（`import yaml`，`convert.py` / `audit_candidates.py` / `preflight_all.py` 用到）；其余全部是标准库 |
| 外部命令 | `curl`（仅 `fetch_top_n.py` 下载原始包用） |
| 网络 | 出网可访问 `https://api.skillhub.cn`（抓列表 + 下载包） |
| 企业服务 | `baseline.py` / `deploy.py` / `verify.py` / `download_proof.py` 需要**运行中的企业服务**（默认 `BASE=http://127.0.0.1:18080`，可用环境变量覆盖） |

脚本里的路径是**服务器上的绝对路径**（`/opt/work/skillhub-import/…`），因此设计上就在服务器上运行；
在别处跑需要先改这几个常量或做目录软链。

## 2. 需要的凭据

**源码里没有任何 token / 密码 / 密钥。** 认证走 PKCE，凭据从服务器上的凭据文件读：

- `/opt/owndsh/CREDENTIALS.txt` —— 管理员用户名 / 密码（`common_auth.py::creds()` 只读这两行）。
  该文件已被 `.gitignore`（`CREDENTIALS.txt`）排除，**不要入库**。
- `INSTALLATION_ID`（环境变量）—— 员工端鉴权需要的**已注册 ACTIVE 设备** `installation_id`。
  属环境相关标识，**源码不内置任何默认值**；未提供时 `device_token()` 直接 `sys.exit` 报错。
  取值方式：在管理端设备列表里取一台已注册设备，或由调用方 `device_token(<id>)` 显式传入。
  `make_evidence.py` 也读它，但只用于在留证文档里标注「回读用的是哪台设备」，缺失时写 `<未设置 INSTALLATION_ID>`，不报错。
- `BASE`（环境变量，可选，默认 `http://127.0.0.1:18080`）。

## 3. 目录布局（服务器侧）

```text
/opt/work/skillhub-import/
  *.py                     本工具链（本目录）
  raw/                     抓取产物：list-score-*.json、pkg/*.zip、license-scan.json、license-gate.json、…
  converted/<id>.dshskill  convert.py 的产出
  conversion-report.json   convert.py 的逐包门禁报告
  evidence/*.json          baseline/verify/download_proof 的逐条回读证据
  EVIDENCE.md              该轮导入的完整留证（大文件，**未入库**，见 §8）
```

## 4. 流水线

按顺序，每步的入口/输入/产出：

| # | 脚本 | 输入 | 产出 | 是否改服务端状态 |
|---|---|---|---|---|
| 0 | `fetch_top_n.py <N>` | `api.skillhub.cn/api/skills` | `raw/list-score-top<N>.json` + `raw/pkg/*.zip` | 否（只下载） |
| 1 | `audit_candidates.py` | `raw/pkg/*.zip`、`raw/list-score-top40.json` | `raw/candidate-audit.json` | 否 |
| 1b | `baseline.py` | `CREDENTIALS.txt` + 运行中的服务 | `evidence/*-baseline.json` | **否（只读）** |
| 2 | `license_scan.py` | `raw/pkg/*.zip` | `raw/license-scan.json` | 否 |
| 2 | `license_gate.py` | `raw/pkg/*.zip` | `raw/license-gate.json` | 否 |
| 3 | `preflight_all.py` | `raw/license-scan.json`、`raw/pkg/*.zip` | `raw/preflight-allowed.json` | 否 |
| 4 | `convert.py` | `raw/pkg/*.zip` + 文件内 `PLAN` | `converted/*.dshskill`、`conversion-report.json` | 否（写本地文件） |
| 5 | `deploy.py` | `converted/*.dshskill` + 管理端凭据 | `evidence/*.json` | **是：上传 + 发布 + 全员分配** |
| 6 | `verify.py` | 基线 + 运行中的服务 | `evidence/verify-*.json` | **否（只读回读）** |
| 6 | `download_proof.py` | `evidence/verify-admin-skills.json` + 员工端凭据 | `evidence/download-proof.json` | 否（只读） |
| 7 | `finalize_evidence.py` | `raw/pkg/*.zip`、`converted/*.dshskill` | `evidence/artifacts-sha256.txt`、`evidence/package-trees.txt` | 否 |
| 7 | `make_evidence.py` | 上面所有 JSON | `EVIDENCE.md` | 否 |

> **`deploy.py` 是唯一会改服务端状态的脚本**：它上传制品、发布版本、并给新技能做**全员（ALL）分配**。
> 任何只读/复盘场景（例如核分类映射）**只跑 `convert.py --dry-run`，不要跑 `deploy.py`**。

### 只读复盘：`convert.py --dry-run`

```bash
# 跑完整 17 条门禁 + 分类映射,不落盘、不覆盖 conversion-report.json
python3 convert.py --dry-run --report /opt/work/dryrun-report.json
```

- `--dry-run`：全部门禁照跑，但不写 `converted/*.dshskill`，也不建 `converted/`。
- `--report PATH`：报告落点（默认 `conversion-report.json`；dry-run 时应指向 `/opt/work/` 下的临时文件）。
- 退出码：全部 `CONVERTED` 才 0；有任一包被拒（含分类未映射）返回 1。

## 5. 转换器门禁（每包 17 条）

`convert.py` 对每个包逐条记录门禁结果到 `conversion-report.json`，**宁可拒绝不静默裁剪**：

`GATE_ARCHIVE_BYTES`（≤50MiB）、`GATE_ENTRY_COUNT`（≤10000）、`GATE_EXPANDED_BYTES`（≤200MiB）、
`GATE_PATH_SAFETY`、`GATE_PATH_UNIQUE`、`GATE_ROOT_SKILL_MD`（根级唯一 SKILL.md）、
`GATE_FRONTMATTER_PRESENT`、`GATE_FRONTMATTER_YAML`、`GATE_NO_LEGACY_FIELDS`（拒 `modelInvocable` /
`userInvocable` / `disableModelInvocation`）、`GATE_SKILL_NAME_KEBAB`（`^[a-z0-9]+(-[a-z0-9]+)*$` ≤64）、
`GATE_SKILL_DESCRIPTION`（非空 ≤1024）、**`GATE_CATEGORY_MAPPED`**、`GATE_MANIFEST_BYTES`（≤1MiB）、
`GATE_SOURCE_DSH_VERSION`（≤64）、`GATE_SKILL_MD_BYTES`（≤256KiB）、`GATE_SKILLS_COUNT`、
`GATE_ROUNDTRIP_PATHS`（回读产出包复核路径形状）。

另有一条不进 `gates[]` 的前置短路：源包缺失 → `GATE_SOURCE_PRESENT` 直接 `REJECTED`。

（历史轮次的 `EVIDENCE.md` 记的是「每包 15/16 条」，那是加 `GATE_CATEGORY_MAPPED` 之前的数字，属历史记录，未回改。）

## 6. 分类映射（2026-10 修复）

平台**真实**一级分类 key 共 **13 个**，真源是 `GET https://api.skillhub.cn/api/v1/categories`：

```text
pay-skill(全站 0 条) office-efficiency content-creation dev-programming data-analysis
design-media ai-agent knowledge-management business-ops education professional
it-ops-security life-service
```

我们把它们压到客户端已有的**四桶**（`工程 / 办公 / 通用 / 安全`，与 `verify.py` 的 category 白名单一致）：

| 平台 key | 桶 | 说明 |
|---|---|---|
| `dev-programming` | 工程 | |
| `ai-agent` | 工程 | |
| `office-efficiency` | 办公 | |
| `content-creation` | 办公 | |
| `data-analysis` | 办公 | |
| `business-ops` | 办公 | **本次修复**：原表缺此 key，静默并入「通用」 |
| `professional` | 通用 | |
| `knowledge-management` | 通用 | |
| `design-media` | 通用 | |
| `life-service` | 通用 | |
| `education` | 通用 | **本次修复**：原表缺此 key，静默并入「通用」 |
| `it-ops-security` | 安全 | **本次修复**：平台真名；原表写的 `security` 是**不存在的死键** |
| `pay-skill` | — | 平台真实 key 但全站 0 条，**故意不映射**，出现即由门禁拦下 |

`subCategory` 细化覆盖：`科研学术` / `学术写作` → 办公（`SUBCATEGORY_OVERRIDE`）。

### 6.1 显式门禁取代静默兜底

旧代码的表达式是：

```python
"category": SUBCATEGORY_OVERRIDE.get(item.get("subCategory")) or CATEGORY_MAP.get(item["upstreamCategory"], "通用")
```

未命中的 key **静默变成「通用」**，改变了语义又不留痕。现在改为 `resolve_category()` + 硬门禁：

- 未映射（含 `pay-skill` 这类「故意不映射」）→ `GATE_CATEGORY_MAPPED` **FAIL**，该包 `status=REJECTED`、
  `errorCode=ENT_SKILL_CATEGORY_UNMAPPED`，**不落盘**；报告顶层 `pendingCategories[]` 列出待人工分类的 key 与受影响技能，
  stdout 同样打印「待人工分类」段，退出码 1。
- 结果里新增 `categoryBasis` / `categoryResolution` 字段，记录每个包的分类判定依据（`category:<key>` /
  `subCategory:<x>` / `alias:<old>-><new>`），便于人工复核与回归对照。
- 表自检 `_validate_category_tables()`：`CATEGORY_MAP` / `CATEGORY_ALIASES` / `SUBCATEGORY_OVERRIDE` 的取值一旦落到
  四桶之外，脚本启动即 `SystemExit`（防止有人加了桶却忘了同步 `verify.py`）。
- `subCategory` 出现但未登记 → 非致命 `WARN_SUBCATEGORY_UNMAPPED`（退回 `upstreamCategory`），仍不静默。

### 6.2 `security` 死键：为什么保留为别名而不是删掉

`security` 这个 key 在平台上**不存在**。处理方式是**新增** `it-ops-security`（真名）映射，
同时把 `security` 显式登记进 `CATEGORY_ALIASES = {"security": ("it-ops-security", "安全")}`：

- 它不是模糊兜底：命中会发 `WARN_CATEGORY_ALIAS` 告警并把 `alias:security->it-ops-security` 写进报告，可复核。
- 作用是兼容**归档清单 / 手写的 `PLAN` 条目**里遗留的旧拼写，让它们确定性落到「安全」，而不是因为改名整批失败。
- 保留的风险（平台若另立同名不同义的 `security`）由告警暴露，不会静默。

### 6.3 待用户拍板：扩桶

现在的四桶会把 `business-ops`(商业运营) 和 `education`(教育学习) 压缩掉语义。若希望保真，建议新增两个桶：

- `business-ops` → **商业运营**（在线上 500 条样本里占 15.8%，是第二大 key，塞进「办公」确实勉强）
- `education` → **教育学习**（样本里 2.8%）

**本次不擅自扩桶**，原因是扩桶不是改一个文件：`verify.py:54` 有硬编码白名单
`if it.get("category") not in ("工程", "办公", "通用", "安全")` 会直接判失败，服务端技能目录 / 控制台 / 员工端插件
的展示分组也会跟着变。要扩桶必须是一轮**跨端变更**（`convert.py` + `verify.py` + 服务端 + 控制台 + 插件），故列为待拍板项。

## 7. 许可闸门

`license_scan.py`（全量扫描）与 `license_gate.py`（最终判定）**只允许宽松许可**，判定顺序：
`SKILL.md` frontmatter `license` 标量 → 包内 `LICENSE`/`LICENCE`/`COPYING` 正文 → `README` 的「许可证」节 → `_meta.json` 等元数据的 `license`。

- **ALLOW**：MIT（含 MIT-0 / 0BSD / ISC）、Apache-2.0、BSD 2/3-Clause
- **REJECT-COPYLEFT**：GPL/AGPL/LGPL/MPL/EUPL、CC BY-SA / CC BY-NC-SA 等传染或非商业条款
  （copyleft 优先：「代码 Apache + 内容 CC BY-NC-SA」的双轨协议按整包拒绝）
- **REJECT-PROPRIETARY**：proprietary / All rights reserved / 专有许可
- **REJECT-UNKNOWN**：四项证据都取不到许可

`preflight_all.py` 只对 ALLOW 的候选跑一遍与服务端 `SkillArtifactInspector` 对齐的预检（含 SnakeYAML
`allowDuplicateKeys=false` 的重复键检查），产出选品依据。

## 8. 什么没有入库

- `EVIDENCE.md`（47KB 的该轮导入完整留证）与 `raw/`、`converted/`、`evidence/` 下的产物 —— 体积大且是某一轮的结果快照，
  需要时在服务器上读：`/opt/work/skillhub-import/EVIDENCE.md`。
- 设备镜像 `/…/.sshwork/sh-import/` 里另有 5 个**一次性探针**脚本（`fetch_list.py`、`fetch_top.py`、`probe_detail.py`、
  `show_list.py`、`analyze_pkgs.py`），服务器侧真源里没有它们，属临时排查产物，**未入库**（其中 `fetch_top.py` 与
  `fetch_top_n.py` 逐字节相同，只是换了个名字）。
- 任何凭据。

## 9. 与服务器真源的一致性

入库脚本逐字节等于服务器 `/opt/work/skillhub-import/` 的对应文件（`convert.py` / `common_auth.py` 为本轮修复后的版本）：

```text
e8fdc36a2df433eb573ac75b76a1df7788c193fc004b455799385dbcf5ecbbd7  audit_candidates.py
ef22c7ba562587168ba9016a5048def5e7c291a7e91314d1dbe9ac1d5bb10f42  baseline.py
7c7bc4418279cff4a5182fea5a41042c1890a0aa8c825a969e239a392daa3752  common_auth.py
759d07a8dd1387fb9a9cf40ac93f2f29e0be2f9a586c1b5b245e5b274c573300  convert.py
1a048435a2b9e8808237592298bc3886e5ad205debb8895657ca5e7695f79632  deploy.py
73efee9dc808c470452d8ded2e9301a33941e8915f2a49efb96bb8e894ee5705  download_proof.py
46620629e1a399a2c0732d52ae4fec23daf5e3116e0f2cc75dd276b0361323d1  fetch_top_n.py
579a5a71d68701b60b20bf4d83ac0613b457f35e694f9879603aa5684d2cff19  finalize_evidence.py
4861dbdc2ad5aeb10b08e638cfccb49349e5b2b81bf94583a5a7c03b579a531e  license_gate.py
8e71f9c6c5aa7eb076112537c61063a3f1a4f4be54a4b0666a7e77fd66e0a698  license_scan.py
eca09e696b32224eb74131f459bf706c28238891c95f6e292eafed0ae4cb3a9a  make_evidence.py
7044fd4cd2b3808041c99f3b8461691c51e7567c991fb044a95048cdbf0a0423  preflight_all.py
5953d38dc367a407e6a3515f2e763ad46cb08c5def8e90b115970f80f21eacf3  verify.py
```

脚本保留了原有的 `[INPUT]/[OUTPUT]/[POS]` 契约式文档头，**刻意不加仓库 L3 的 `[PROTOCOL]` 行**，
以保住「仓库副本 == 服务器真源」这一可验证性质（改一行就会破坏逐字节一致）。
若要求严格 L3 合规，应在服务器、设备镜像、仓库三处**同时**补该行。改动脚本后请同步刷新上面的 sha256。

### 本轮入库时做过的凭据清理

`common_auth.py` 与 `make_evidence.py` 原先各硬编码了一处**同一台员工设备**的 `installation_id`
（`67e5edee-…-e916500547b9`）。它不是密码，但属环境相关标识，且正是员工端 PKCE 登录用的设备凭据，
故两处都改成从 `INSTALLATION_ID` 环境变量取（`common_auth.py` 缺省即报错，`make_evidence.py` 缺省只影响标注文案）。
仓库副本已无该字面量；删掉它意味着 `make_evidence.py` 的 sha256 与历史轮次的服务器副本不再相同（上表是修复后的值）。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
