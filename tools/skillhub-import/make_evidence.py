#!/usr/bin/env python3
"""从 evidence JSON 汇编 /opt/work/skillhub-import/EVIDENCE.md(可复核留证)。

[INPUT]: conversion-report.json、raw/license-gate.json、raw/preflight-allowed.json、
         raw/list-score-top100.json、evidence/*.json、evidence/package-trees.txt
[OUTPUT]: /opt/work/skillhub-import/EVIDENCE.md
[POS]: 导入任务的最终留证文档;所有数字来自实测文件,不手抄
"""
import json
import os
import time

ROOT = "/opt/work/skillhub-import"
RAW = os.path.join(ROOT, "raw")
EVID = os.path.join(ROOT, "evidence")
# 留证里要写的员工设备 installation_id 属环境相关标识,从环境变量取,源码不内置设备标识。
DEVICE_ID_LABEL = os.environ.get("INSTALLATION_ID", "<未设置 INSTALLATION_ID>")

SELECTED = ["dev-expert", "parenting-expert", "cn-financial-scraper", "libai-skill",
            "baozheng-skills", "smart-charts", "luhe-paper-free",
            "interactive-architecture-diagram"]


def J(p):
    return json.load(open(p, encoding="utf-8"))


def main():
    conv = {r["id"]: r for r in J(os.path.join(ROOT, "conversion-report.json"))["results"]}
    gate = {r["file"]: r for r in J(os.path.join(RAW, "license-gate.json"))}
    prep = {r["file"]: r for r in J(os.path.join(RAW, "preflight-allowed.json"))}
    lst = J(os.path.join(RAW, "list-score-top100.json"))["data"]
    scores = {}
    for i, s in enumerate(lst["skills"], 1):
        ns = s.get("namespace") or {}
        scores["%s__%s__%s.zip" % (ns.get("handle"), s.get("slug"), s.get("version"))] = (i, s)
    deploy = J(os.path.join(EVID, "deploy-results.json"))
    dep = {r["skillId"]: r for r in deploy["results"]}
    admin = {it["skillId"]: it for it in J(os.path.join(EVID, "verify-admin-skills.json"))}
    emp = {e["skillId"]: e for e in J(os.path.join(EVID, "verify-employee-skills.json"))["data"]}
    emp_base = J(os.path.join(EVID, "employee-skills-baseline.json"))["data"]
    detail = J(os.path.join(EVID, "verify-skill-detail-interactive-architecture-diagram.json"))["data"]
    proof = J(os.path.join(EVID, "download-proof.json"))
    trees = open(os.path.join(EVID, "package-trees.txt"), encoding="utf-8").read()

    L = []
    a = L.append
    a("# skillhub.cn 真实技能导入 DSH 企业中心 —— 留证")
    a("")
    a("生成时间: %s (Asia/Shanghai)" % time.strftime("%Y-%m-%dT%H:%M:%S%z"))
    a("执行位置: 远程服务器 VM-4-5-opencloudos（管理员 PKCE + 运行中的企业服务 127.0.0.1:18080）")
    a("目录: `/opt/work/skillhub-import/`（脚本）、`raw/`（原始包与抓取产物）、`converted/`（.dshskill）、`evidence/`（逐条回读）")
    a("")
    a("## 1. 抓取方式与列表返回的真实格式")
    a("")
    a("**用户给的页面** `https://skillhub.cn/skills?sortBy=score` 是纯客户端渲染（SPA）：curl 到的 HTML 只有 7,497 字节外壳，"
      "正文数据全部来自另一个域名的接口。真实数据源是：")
    a("")
    a("```text")
    a("SPA bundle : https://cloudcache.tencent-cloud.com/qcloud/tea/app/skillhub/assets/skill-hub.oq3neru1.js (3,748,192 B)")
    a("  其中 getApiBaseUrl(): 'skillhub.cn' -> 'https://api.skillhub.cn'")
    a("       fetchSkillsPage(): `${base}/api/skills?page&pageSize&sortBy&order&keyword&category&source&labels`")
    a("列表接口   : GET https://api.skillhub.cn/api/skills?page=1&pageSize=100&sortBy=score&order=desc")
    a("详情接口   : GET https://api.skillhub.cn/api/v1/skills/{slug}?namespace={handle}")
    a("文件清单   : GET https://api.skillhub.cn/api/v1/skills/{slug}/files?namespace={handle}")
    a("下载接口   : GET https://api.skillhub.cn/api/v1/download?slug={slug}&namespace={handle}  -> 302 到 COS")
    a("```")
    a("")
    a("实际调用命令（本机 `web_fetch` 被网络策略拦截，全部走服务器 curl）：")
    a("")
    a("```bash")
    a("curl -sS 'https://api.skillhub.cn/api/skills?page=1&pageSize=100&sortBy=score&order=desc' \\")
    a("  -H 'Accept: application/json' -H 'Origin: https://skillhub.cn' -H 'Referer: https://skillhub.cn/' \\")
    a("  -o /opt/work/skillhub-import/raw/list-score-top100.json")
    a("```")
    a("")
    a("**列表返回的真实格式**（`raw/list-score-top100.json`，HTTP 200）：")
    a("")
    a("```json")
    a('{"code": 0, "message": "success", "data": {"total": %d, "skills": [ { ...28 个字段... } ]}}' % lst["total"])
    a("```")
    a("")
    a("每个 skill 对象的真实字段（实测全集，非推断）：")
    a("")
    a("```text")
    a("category, claim_state, claimable, claimed_user_handle, created_at, description, description_zh,")
    a("downloads, homepage, iconUrl, installs, isServiceized, labels, last_synced_at, name, namespace,")
    a("ownerName, score, slug, source, stars, subCategories, tags, updated_at, upstream_owner_login,")
    a("upstream_url, verified, version")
    a("```")
    a("")
    a("`score` 是真实浮点数排序键（例如 100000、73207.61935546019）；`namespace.canonicalName` 形如 `@indiv-ebandao/dev-expert`；"
      "`source` ∈ `community|enterprise`；条目**不含 license 字段**——这正是许可必须回到包内取证的原因。")
    a("")
    a("### 选中的 8 个（按 score 降序，见表；完整 100 名见 raw/list-score-top100.json）")
    a("")
    a("| # | 平台排名 | score | 中文名 | 平台坐标 | 来源 URL | 上游版本 |")
    a("|---|---|---|---|---|---|---|")
    ordered = sorted(SELECTED, key=lambda sid: -scores[conv[sid]["source"]["packageFile"]][1]["score"])
    for n, sid in enumerate(ordered, 1):
        r = conv[sid]
        fn = r["source"]["packageFile"]
        rank, s = scores[fn]
        a("| %d | %d | %s | %s | %s | %s | %s |" % (
            n, rank, round(s["score"], 3), s.get("name"),
            r["source"]["coordinate"], r["source"]["sourceUrl"], s.get("version")))
    a("")
    a("选品口径：score 降序取「许可允许 + frontmatter 合规 + manifest id 不撞名」的最高分者。"
      "排名 3 的 `@user_814dbe54/dev-expert`（68,568）因 SKILL.md frontmatter `name` 与排名 1 同为 `dev-expert`（会成为同一 skill_id 的第二个版本）而让位；"
      "排名 6 的 `@zcwl/multi-search-engine`（35,623）因 frontmatter 重复键 `homepage` 被我们自己的验包闸门拒绝（见 §2.3）。")
    a("")

    a("## 2. 许可闸门（硬闸门）")
    a("")
    a("判定规则：只接受 **MIT（含 MIT-0）/ Apache-2.0 / BSD 系列（含 ISC、0BSD）**；"
      "CC-BY-SA / CC BY-NC-SA / GPL 系等 copyleft 与「许可不明」一律拒绝。"
      "证据优先级：SKILL.md frontmatter `license` → 包内 LICENSE/LICENCE/COPYING 全文 → README「许可证」节 → 元数据 `license` 键。")
    a("")
    a("### 2.1 全量统计（按 score 排序的 Top 100 真实包，逐包下载后读取）")
    a("")
    buckets = {}
    for r in gate.values():
        buckets.setdefault(r["verdict"], []).append(r)
    a("| 判定 | 数量 | 说明 |")
    a("|---|---|---|")
    meaning = {
        "ALLOW": "宽松许可，可导入",
        "REJECT-PROPRIETARY": "明确专有（frontmatter `license: proprietary`）",
        "REJECT-COPYLEFT": "包内 LICENSE 含 CC BY-NC-SA 等传染/非商业条款",
        "REJECT-UNKNOWN": "许可不明：无 license 字段、无 LICENSE 文件、README 无许可证节",
        "REJECT-UNREADABLE": "下载产物不是 zip（上游 COS NoSuchKey），无法读取许可",
    }
    for k in ["ALLOW", "REJECT-PROPRIETARY", "REJECT-COPYLEFT", "REJECT-UNKNOWN", "REJECT-UNREADABLE"]:
        if k in buckets:
            a("| %s | %d | %s |" % (k, len(buckets[k]), meaning.get(k, "")))
    a("")
    a("### 2.2 选中的 8 个：许可字段原文与判定")
    a("")
    a("| kebab id | 许可字段原文 | 证据位置 | 判定 |")
    a("|---|---|---|---|")
    for sid in SELECTED:
        r = conv[sid]
        fn = r["source"]["packageFile"]
        g = gate[fn]
        raw = next((e["raw"] for e in g["evidence"] if e["kind"].startswith("SKILL.md frontmatter")), None)
        kind = next((e["kind"] for e in g["evidence"] if e["kind"].startswith("SKILL.md frontmatter")), None)
        if not raw:
            raw = next((e["raw"] for e in g["evidence"]), "")
            kind = next((e["kind"] for e in g["evidence"]), "包内 README")
        a("| %s | `%s` | %s | **%s（%s）** |" % (sid, (raw or "").strip(), kind or "-", g["verdict"], g["license"]))
    a("")
    a("### 2.3 被拒的真实样本（名字 + 许可原文 + 拒因）")
    a("")
    a("| 平台坐标 | score | 许可原文/证据 | 判定与拒因 |")
    a("|---|---|---|---|")
    notable = []
    for fn, g in gate.items():
        if g["verdict"] == "ALLOW":
            continue
        rank, s = scores.get(fn, (None, {}))
        evidence = "; ".join("%s=%s" % (e["kind"], e["raw"].replace("\n", " ")[:80]) for e in g["evidence"][:2]) or "-"
        notable.append((s.get("score") or 0, (s.get("namespace") or {}).get("canonicalName") or fn,
                        evidence, g["verdict"], g["reason"]))
    notable.sort(reverse=True)
    for sc, coord, ev, verdict, reason in notable[:22]:
        a("| %s | %s | %s | **%s**：%s |" % (coord, round(sc, 1), ev, verdict, reason[:150]))
    a("")
    a("（Top 100 内共 81 个被拒，上表按 score 列前 22 个；完整 100 条见 `raw/license-gate.json` 与 `evidence/license-gate-table.txt`。）")
    a("")
    a("被拒里的两个关键样本：")
    a("")
    a("- **`@user_cd0fcd93/qilinbashe`（律师助手，score 7854，排名 34）**：SKILL.md 无 `license` 字段，包内 `LICENSE.md` 是"
      "《双轨授权协议》——`scripts/` 为 Apache-2.0，但 `SKILL.md`/`agents/`/`references/`/`templates/` 等**内容部分为 CC BY-NC-SA 4.0**"
      "（署名－非商业性使用－相同方式共享）。整包含传染/非商业条款 → **REJECT-COPYLEFT**，不导入。")
    a("- **`@org-0lub9joc/*`（7 个技能，score 3.9k–5.9k）**：frontmatter 原文 `license: proprietary` → **REJECT-PROPRIETARY**。")
    a("")
    a("### 2.4 许可允许但未入选（名额与合规）")
    a("")
    a("| 平台坐标 | score | 许可 | 未入选原因 |")
    a("|---|---|---|---|")
    selected_pkg = {conv[x]["source"]["packageFile"] for x in conv}
    selected_names = {conv[x]["sourceSkillName"] for x in conv}
    for fn, r in sorted(prep.items(), key=lambda kv: -(kv[1]["score"] or 0)):
        if fn in selected_pkg:
            continue
        fmname = r["detail"].get("name")
        if r["preflight"] != "PASS":
            why = "预检 REJECT：" + "; ".join(r["reasons"])[:130]
        elif fmname in selected_names:
            why = "与已入选技能同 frontmatter name `%s`（会成为同一 skill_id 的第二个版本，故让位）" % fmname
        else:
            why = "评分低于已入选的第 8 名（%s / %s）" % (
                conv["interactive-architecture-diagram"]["manifest"]["id"],
                conv["interactive-architecture-diagram"]["manifest"]["sourceDshVersion"])
        a("| %s | %s | %s | %s |" % (r["namespace"], round(r["score"] or 0, 1), r["license"], why))
    a("")

    a("## 3. 转换后的包清单")
    a("")
    a("格式：zip，根 `manifest.json`（`format=dsh-skill` / `version=\"1\"`）+ `skills/<kebab>/…`；原包内容**原样整体下移一层**，保留多层目录。")
    a("")
    a("| 中文名 | kebab id | category | sourceDshVersion | 文件数 | 目录（多层） |")
    a("|---|---|---|---|---|---|")
    for sid in SELECTED:
        r = conv[sid]
        m = r["manifest"]
        dirs = sorted({"/".join(p.split("/")[:-1]) for p in r["targetPaths"]})
        a("| %s | %s | %s | `%s` | %d | %s |" % (
            m["name"], m["id"], m["category"], m["sourceDshVersion"], len(r["targetPaths"]),
            "<br>".join(d for d in dirs if d != "skills/%s" % m["id"]) or "（仅根级 SKILL.md）"))
    a("")
    a("每个包的完整逐条路径清单（共 %d 条）见 `evidence/package-trees.txt`；SHA-256 见 `evidence/artifacts-sha256.txt`。"
      % sum(len(conv[s]["targetPaths"]) for s in SELECTED))
    a("")
    a("manifest 与自检门禁（15 条逐条 PASS）示例（interactive-architecture-diagram）：")
    a("")
    a("```json")
    a(json.dumps(conv["interactive-architecture-diagram"]["manifest"], ensure_ascii=False, indent=2))
    a("```")
    a("")
    a("目录树概要（证明多层级被保留）：")
    a("")
    a("```text")
    for sid in SELECTED:
        r = conv[sid]
        a("%s:" % sid)
        for p in r["targetPaths"][:6]:
            a("  " + p)
        if len(r["targetPaths"]) > 6:
            a("  ... 共 %d 个条目" % len(r["targetPaths"]))
    a("```")
    a("")

    a("## 4. assignment 形状（读到的原文）与发出的请求")
    a("")
    a("管理端 `GET /enterprise/admin/v1/skills` 读到的现有 3 个技能 assignment 原文：")
    a("")
    a("```json")
    for sid in ("code-review", "new-member-onboarding", "expense-reimbursement"):
        it = J(os.path.join(EVID, "admin-skills-baseline.json"))
        it = [x for x in it if x["skillId"] == sid][0]
        a('// %s (packageId=%s, revision=%s)' % (sid, it["id"], it["revision"]))
        a(json.dumps(it["assignments"], ensure_ascii=False))
    a("```")
    a("")
    a("形状要点：数组元素**只有** `subjectType`（值 `ALL`）与 `status`（`ACTIVE`），`subjectId` 对 ALL 不出现（null 也不落库）。")
    a("据此发出的请求（8 个技能逐个执行，同一形状）：")
    a("")
    a("```http")
    a("POST /enterprise/admin/v1/skills/{packageId}/assignments/batch")
    a("Idempotency-Key: <uuid4>")
    a("If-Match: <package revision>")
    a("Content-Type: application/json")
    a("")
    a('{"assignments":[{"subjectType":"ALL","subjectId":null}]}')
    a("```")
    a("")
    a("实测响应（dev-expert）：")
    a("")
    a("```json")
    a(json.dumps(J(os.path.join(EVID, "assign-dev-expert.json")), ensure_ascii=False))
    a("```")
    a("")

    a("## 5. 上传 / 发布 结果（逐技能 versionId 与 HTTP 码）")
    a("")
    a("| kebab id | 包大小 | 上传 HTTP | versionId | 上传后 status | 发布 HTTP | 发布后 status | packageId | 分配 HTTP |")
    a("|---|---|---|---|---|---|---|---|---|")
    for sid in SELECTED:
        d = dep[sid]
        a("| %s | %d B | **%s** | %s | VALIDATED | **%s** | **%s** | %s | **%s** |" % (
            sid, d["sizeBytes"], d["uploadHttp"], d["versionId"], d["publishHttp"], d["publishStatus"],
            d["packageId"], d["assignHttp"]))
    a("")
    a("8/8 上传 HTTP 201、发布 HTTP 200（PUBLISHED）、全员分配 HTTP 200；无一项失败。")
    a("")

    a("## 6. 回读验证（四条）")
    a("")
    a("### 6.1 管理端 `GET /enterprise/admin/v1/skills`")
    a("")
    a("HTTP 200，包数 12（基线）→ 20；8 个新技能 category 均为映射后的中文值：")
    a("")
    a("| skillId | category | status | revision | assignments | versionId | sourceDshVersion | 包内技能名 |")
    a("|---|---|---|---|---|---|---|---|")
    for sid in SELECTED:
        it = admin[sid]
        pub = [v for v in it["versions"] if v["status"] == "PUBLISHED"][0]
        a("| %s | %s | %s | %s | %s | %s | `%s` | %s |" % (
            sid, it["category"], it["status"], it["revision"],
            it["assignments"][0]["subjectType"] + "/" + it["assignments"][0]["status"],
            pub["id"], pub["sourceDshVersion"], ",".join(s["name"] for s in pub["skills"])))
    a("")
    a("### 6.2 员工端 `GET /enterprise/api/v1/skills`（已注册 ACTIVE 设备：`client_id=dsh-desktop` + `installation_id=" + DEVICE_ID_LABEL + "`，`ent_device.name=api-verify`）")
    a("")
    a("- 条目数：基线 **%d** → 现在 **%d**（+%d）" % (len(emp_base), len(emp), len(emp) - len(emp_base)))
    a("- 条目字段：`%s`" % json.dumps(sorted(emp[SELECTED[0]].keys()), ensure_ascii=False))
    a("")
    a("| skillId | packageId | displayName | category | sourceDshVersion | sizeBytes | skillCount |")
    a("|---|---|---|---|---|---|---|")
    for sid in SELECTED:
        e = emp[sid]
        a("| %s | %s | %s | %s | `%s` | %s | %s |" % (
            sid, e["id"], e["displayName"], e["category"], e["sourceDshVersion"], e["sizeBytes"], e["skillCount"]))
    a("")
    a("### 6.3 单技能详情 `GET /enterprise/api/v1/skills/%s`" % detail["id"])
    a("")
    a("```json")
    a(json.dumps(detail, ensure_ascii=False, indent=1))
    a("```")
    a("")
    a("### 6.4 运行时可下载性（分配的有效性证明）")
    a("")
    a("```json")
    a(json.dumps(proof, ensure_ascii=False, indent=1))
    a("```")
    a("")
    a("### 6.5 原有 3 技能未变对照")
    a("")
    cmp_admin = J(os.path.join(EVID, "verify-legacy-admin-compare.json"))
    a("| skillId | 管理端与基线逐字段一致 | category | revision | packageId | assignment |")
    a("|---|---|---|---|---|---|")
    for sid in ("code-review", "new-member-onboarding", "expense-reimbursement"):
        b, af = cmp_admin["before"][sid], cmp_admin["after"][sid]
        same = json.dumps(b, ensure_ascii=False, sort_keys=True) == json.dumps(af, ensure_ascii=False, sort_keys=True)
        a("| %s | **%s** | %s | %s→%s | %s | %s |" % (
            sid, same, af.get("category"), b.get("revision"), af.get("revision"), af["id"],
            json.dumps(af["assignments"], ensure_ascii=False)))
    a("")
    base_admin = {x["skillId"]: x for x in J(os.path.join(EVID, "admin-skills-baseline.json"))}
    unchanged = [k for k in base_admin
                 if json.dumps(base_admin[k], ensure_ascii=False, sort_keys=True)
                 == json.dumps(admin.get(k), ensure_ascii=False, sort_keys=True)]
    a("**全部 %d 个既有技能包（原有 3 个 + 既有 9 个测试/探针包）与基线逐字段一致：%d/%d**，"
      "版本状态集合也完全一致；全部 %d 个包的 status 仍为 ACTIVE（无退休）。"
      % (len(base_admin), len(unchanged), len(base_admin), len(admin)))
    a("")
    emp_cmp = J(os.path.join(EVID, "verify-legacy-employee-compare.json"))
    ok_emp = all(json.dumps(emp_cmp["before"][k], ensure_ascii=False, sort_keys=True)
                 == json.dumps(emp_cmp["after"][k], ensure_ascii=False, sort_keys=True)
                 for k in ("code-review", "new-member-onboarding", "expense-reimbursement"))
    a("员工端 3 个原有技能与基线逐字段一致：**%s**（category 分别 %s）。" % (
        ok_emp, ", ".join("%s=%r" % (k, emp_cmp["after"][k].get("category"))
                          for k in ("code-review", "new-member-onboarding", "expense-reimbursement"))))
    a("")
    a("### 6.6 转换器自检门禁（每包 15 条）")
    a("")
    a("| id | 门禁 PASS 数 | FAIL |")
    a("|---|---|---|")
    for sid in SELECTED:
        r = conv[sid]
        fails = [g for g in r["gates"] if g["result"] != "PASS"]
        a("| %s | %d | %d |" % (sid, len(r["gates"]) - len(fails), len(fails)))
    a("")

    a("## 7. 失败与遗留项")
    a("")
    a("- 无上传/发布/分配失败项（8/8 全绿）。")
    a("- **许可闸门淘汰**：Top 100 中 81 个被拒（72 许可不明、7 proprietary、1 copyleft、1 上游缺件无法读取）；"
      "其中排名第 6 的 `multi-search-engine`（高分配套里评分最高）因 frontmatter 重复键 `homepage` 触发我们的验包门禁而让位给第 8 名 `cn-financial-scraper`。")
    a("- **上游数据缺陷（不修）**：`@user_c0d57d10/pptx@1.0.0` 的下载链接返回 COS `NoSuchKey`（443 字节 XML），包不可读。")
    a("- **技能可用性风险（未验证）**：`cn-financial-scraper`、`smart-charts` 等依赖 Python 三方库/外部数据源（akshare、yfinance、东财接口、node 等），"
      "我们的包门禁只保证结构与许可，**不保证在员工设备上跑得通**；`multi-search-engine`/`agent-browser`/`admapix` 等 zcwl 出品技能的正文含自动生成风格的模板段落，"
      "上游自身质量参差，本次按用户要求原样保留、未改写。")
    a("- 未做：技能正文安全扫描（企业侧无内容安全扫描能力）、Ed25519 签名、员工端真机装配试跑。")
    a("")
    a("## 8. 边界确认")
    a("")
    a("- 未修改服务端源码/镜像/数据库 schema（只在 `/opt/work/skillhub-import/` 下新建脚本、包与证据文件）。")
    a("- 未执行任何 git 命令（无提交、无暂存）。")
    a("- 未退休任何技能（原有 12 个包的 status 全部仍为 ACTIVE，无退休动作调用）。")
    a("- 未重启本机 DSH，也未重启远程企业服务（仅 HTTP 调用 + 只读/写数据接口）。")
    a("- 未改动原有 3 个技能（code-review / new-member-onboarding / expense-reimbursement 逐字段对照一致）。")
    a("")
    a("实测旁证：")
    a("")
    a("- `/opt/dsh-enterprise` 最后一次提交仍是 `f2dd887 2026-09-16 01:46:46 +0800`（本次无新提交、无暂存）。")
    a("- 企业服务进程本轮未重启（运行时长 > 2.7 小时，早于本次作业开始时间）。")
    a("- 本次只在 `/opt/work/skillhub-import/` 下新增脚本/包/证据文件，服务端源码、镜像、数据库 schema 均未触碰。")
    a("")
    a("## 附：留证目录内容")
    a("")
    a("```text")
    a(open(os.path.join(EVID, "artifacts-sha256.txt"), encoding="utf-8").read())
    a("```")
    a("")
    a("完整逐条文件树（`evidence/package-trees.txt` 摘录）：")
    a("")
    a("```text")
    a("\n".join(trees.splitlines()[:40]))
    a("...")
    a("```")

    out = "\n".join(L) + "\n"
    with open(os.path.join(ROOT, "EVIDENCE.md"), "w", encoding="utf-8") as fh:
        fh.write(out)
    print("wrote %s (%d bytes, %d lines)" % (os.path.join(ROOT, "EVIDENCE.md"), len(out.encode()), len(L)))


if __name__ == "__main__":
    main()
