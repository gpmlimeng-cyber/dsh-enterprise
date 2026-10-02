#!/usr/bin/env python3
"""skillhub.cn 原始技能包 -> DSH 企业 .dshskill 转换器(离线,含服务端同级预检)。

[INPUT]: /opt/work/skillhub-import/raw/pkg/*.zip + PLAN(本文件内)
[OUTPUT]: /opt/work/skillhub-import/converted/<id>.dshskill + conversion-report.json
           --dry-run 只跑全部门禁不落盘,报告路径由 --report PATH 指定
[POS]: 导入链路第 1 步;规则与服务端 SkillArtifactInspector 对齐,宁可拒绝不静默裁剪
[NOTE]: 分类映射只接受平台真实一级 key(13 个,经 /api/v1/categories 实测)。未映射的 key
        一律由 GATE_CATEGORY_MAPPED 拦下并列入报告 pendingCategories;旧版的「静默落通用」已删除。
"""
import hashlib
import io
import json
import os
import re
import sys
import time
import zipfile

RAW = "/opt/work/skillhub-import/raw"
PKG = os.path.join(RAW, "pkg")
OUT = "/opt/work/skillhub-import/converted"
REPORT = "/opt/work/skillhub-import/conversion-report.json"

MAX_MANIFEST = 1_048_576
MAX_SKILL_MD = 262_144
MAX_SKILLS = 200
MAX_ENTRIES = 10_000
MAX_ARCHIVE = 50 * 1024 * 1024
MAX_EXPANDED = 200 * 1024 * 1024
SKILL_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LEGACY = ("modelInvocable", "userInvocable", "disableModelInvocation")

# 分类映射:平台 category(+subCategory 细化) -> 中文分类
# 目标桶固定为 工程/办公/通用/安全 四桶(verify.py 的 category 白名单只有这四个值,
# 扩桶必须同时改 verify.py,故本文件不擅自新增;扩桶建议见仓库 README「待拍板项」)。
# 键名真源:GET https://api.skillhub.cn/api/v1/categories 实测的 13 个一级 key。
CATEGORY_MAP = {
    "dev-programming": "工程",
    "ai-agent": "工程",
    "data-analysis": "办公",
    "office-efficiency": "办公",
    "content-creation": "办公",
    "business-ops": "办公",         # 2026-10 修复:原表缺此 key,静默并入「通用」
    "knowledge-management": "通用",
    "life-service": "通用",
    "design-media": "通用",
    "professional": "通用",
    "education": "通用",            # 2026-10 修复:原表缺此 key,静默并入「通用」
    "it-ops-security": "安全",      # 2026-10 修复:平台真名;原表的 security 是不存在的死键
}
# 历史拼写别名:显式登记,命中即发 WARN_CATEGORY_ALIAS 告警。这是可复核的兼容层,不是模糊兜底。
CATEGORY_ALIASES = {
    "security": ("it-ops-security", "安全"),
}
# 平台真实存在、但本转换器故意不映射的 key:出现即被 GATE_CATEGORY_MAPPED 拦下,列入待人工分类。
CATEGORY_UNMAPPED_BY_DESIGN = {
    "pay-skill": "平台真实 key 但全站 0 条,无样本可判语义归属;首次出现时交人工拍板,不预设映射",
}
SUBCATEGORY_OVERRIDE = {"科研学术": "办公", "学术写作": "办公"}
CATEGORY_BUCKETS = ("工程", "办公", "通用", "安全")


def _validate_category_tables():
    """表自检:任何落到四桶之外的取值都是配置错误(verify.py 只认这四个)。"""
    bad = []
    for name, table in (("CATEGORY_MAP", CATEGORY_MAP),
                        ("CATEGORY_ALIASES", {k: v[1] for k, v in CATEGORY_ALIASES.items()}),
                        ("SUBCATEGORY_OVERRIDE", SUBCATEGORY_OVERRIDE)):
        bad += ["%s[%s]=%r" % (name, k, v) for k, v in table.items() if v not in CATEGORY_BUCKETS]
    if bad:
        raise SystemExit("分类桶越界(仅允许 %s): %s" % ("/".join(CATEGORY_BUCKETS), ", ".join(bad)))


_validate_category_tables()


def resolve_category(item, warnings):
    """显式解析上游分类 -> 四桶之一。

    [OUTPUT]: (bucket, basis);未命中返回 (None, basis) —— 绝不静默回退到「通用」。
               basis 记录判定依据并进报告,供人工复核与旧/新表回归对照。
    """
    sub = item.get("subCategory")
    if sub is not None:
        if sub in SUBCATEGORY_OVERRIDE:
            return SUBCATEGORY_OVERRIDE[sub], "subCategory:%s" % sub
        warnings.append({"code": "WARN_SUBCATEGORY_UNMAPPED", "subCategory": sub,
                         "detail": "subCategory 未登记,回退 upstreamCategory=%r" % item.get("upstreamCategory")})
    key = item.get("upstreamCategory")
    if key in CATEGORY_MAP:
        return CATEGORY_MAP[key], "category:%s" % key
    if key in CATEGORY_ALIASES:
        canonical, bucket = CATEGORY_ALIASES[key]
        warnings.append({"code": "WARN_CATEGORY_ALIAS", "category": key, "canonical": canonical,
                         "detail": "旧 key %r 已更名为 %r,按显式别名映射到 %s" % (key, canonical, bucket)})
        return bucket, "alias:%s->%s" % (key, canonical)
    if key in CATEGORY_UNMAPPED_BY_DESIGN:
        return None, "unmapped-by-design:%s" % key
    return None, "unmapped:%r" % (key,)

PLAN = [
    {"handle": "indiv-ebandao", "slug": "dev-expert", "version": "2.0.3",
     "dirName": "dev-expert", "id": "dev-expert", "displayName": "编程专家.Skill",
     "upstreamCategory": "dev-programming"},
    {"handle": "indiv-ebandao", "slug": "parenting-expert", "version": "1.11.4",
     "dirName": "parenting-expert", "id": "parenting-expert", "displayName": "育儿大师.Skill",
     "upstreamCategory": "life-service"},
    {"handle": "user_9d5a2a39", "slug": "cnfinancialscraper", "version": "1.0.49",
     "dirName": "cn-financial-scraper", "id": "cn-financial-scraper",
     "displayName": "全能金融爬虫（新增MCP接入）", "upstreamCategory": "data-analysis"},
    {"handle": "indiv-ebandao", "slug": "libai", "version": "1.0.5",
     "dirName": "libai-skill", "id": "libai-skill", "displayName": "李白.Skill",
     "upstreamCategory": "content-creation"},
    {"handle": "indiv-ebandao", "slug": "baozheng", "version": "1.0.3",
     "dirName": "baozheng-skills", "id": "baozheng-skills", "displayName": "包拯.SKILL",
     "upstreamCategory": "professional"},
    {"handle": "user_5b28ea14", "slug": "smart-charts", "version": "8.4.0",
     "dirName": "smart-charts", "id": "smart-charts", "displayName": "智能图表",
     "upstreamCategory": "data-analysis"},
    {"handle": "org-liz6o019", "slug": "luhe-paper-free-pro", "version": "1.0.2",
     "dirName": "luhe-paper-free", "id": "luhe-paper-free",
     "displayName": "露禾论文写作助手（免费版pro）", "upstreamCategory": "professional",
     "subCategory": "科研学术"},
    {"handle": "user_bddf3fe6", "slug": "contextweave-interactive-architecture", "version": "1.6.1",
     "dirName": "interactive-architecture-diagram", "id": "interactive-architecture-diagram",
     "displayName": "架构图一键生成", "upstreamCategory": "design-media"},
]

KEEP_EXTRA_EXTS = {".zip", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2",
                   ".ttf", ".otf", ".pdf", ".xlsx", ".docx", ".pptx", ".bin", ".db", ".pyc"}


def frontmatter_block(text):
    n = text.lstrip("\ufeff")
    start = n.find("---")
    if start < 0 or n[:start].strip():
        return None
    line_start = n.find("\n", start)
    if line_start < 0:
        return None
    end = n.find("\n---", line_start)
    if end < 0:
        return None
    return n[line_start + 1:end + 1]


def safe_path(name):
    if not name or "\0" in name or "\\" in name or name.startswith("/"):
        return False
    return all(seg not in ("..", ".") for seg in name.split("/"))


def convert_one(item, dry_run=False):
    fn = "%s__%s__%s.zip" % (item["handle"], item["slug"], item["version"])
    src = os.path.join(PKG, fn)
    gates = []
    warnings = []
    rec = {"id": item["id"], "source": {
        "registry": "https://api.skillhub.cn",
        "page": "https://skillhub.cn/skills?sortBy=score",
        "coordinate": "@%s/%s" % (item["handle"], item["slug"]),
        "version": item["version"],
        "sourceUrl": "https://skillhub.cn/skills/%s/%s" % (item["handle"], item["slug"]),
        "packageFile": fn}, "gates": gates, "warnings": warnings}

    def gate(gid, ok, observed=None, limit=None, detail=None):
        g = {"id": gid, "result": "PASS" if ok else "FAIL"}
        if observed is not None:
            g["observed"] = observed
        if limit is not None:
            g["limit"] = limit
        if detail:
            g["detail"] = detail
        gates.append(g)
        return ok

    if not os.path.exists(src):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_SOURCE_PRESENT", "message": "原始包缺失: " + fn}
        return rec, None
    rec["sourceBytes"] = os.path.getsize(src)
    if not gate("GATE_ARCHIVE_BYTES", rec["sourceBytes"] <= MAX_ARCHIVE,
                rec["sourceBytes"], MAX_ARCHIVE):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_ARCHIVE_BYTES", "errorCode": "ENT_SKILL_TOO_LARGE",
                             "message": "归档大小超过 50MiB"}
        return rec, None

    z = zipfile.ZipFile(src)
    infos = z.infolist()
    names = [i.filename for i in infos]
    expanded = sum(i.file_size for i in infos)
    rec["sourceEntries"] = len(infos)
    rec["sourceExpandedBytes"] = expanded
    gate("GATE_ENTRY_COUNT", len(infos) <= MAX_ENTRIES, len(infos), MAX_ENTRIES)
    gate("GATE_EXPANDED_BYTES", expanded <= MAX_EXPANDED, expanded, MAX_EXPANDED)
    if gates[-2]["result"] == "FAIL" or gates[-1]["result"] == "FAIL":
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": gates[-1]["id"], "errorCode": "ENT_SKILL_TOO_LARGE",
                             "message": "超过服务端解压/entry 上限"}
        return rec, None

    bad = [n for n in names if not safe_path(n)]
    if not gate("GATE_PATH_SAFETY", not bad, detail=str(bad[:5]) if bad else None):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_PATH_SAFETY", "errorCode": "ENT_SKILL_INVALID_PACKAGE",
                             "message": "包内存在非法路径", "evidence": bad[:10]}
        return rec, None
    dupes = sorted({n for n in names if names.count(n) > 1})
    if not gate("GATE_PATH_UNIQUE", not dupes, detail=str(dupes[:5]) if dupes else None):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_PATH_UNIQUE", "errorCode": "ENT_SKILL_INVALID_PACKAGE",
                             "message": "包内存在重复路径", "evidence": dupes[:10]}
        return rec, None

    skills = [n for n in names if n.lower().endswith("skill.md") and n.count("/") == 0]
    if not gate("GATE_ROOT_SKILL_MD", len(skills) == 1, detail=str(skills)):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_ROOT_SKILL_MD", "errorCode": "ENT_SKILL_INVALID_PACKAGE",
                             "message": "源包根级必须且只能有一个 SKILL.md", "evidence": skills}
        return rec, None
    md_name = skills[0]
    md_bytes = z.read(md_name)
    md_text = md_bytes.decode("utf-8", "replace")
    fm = frontmatter_block(md_text)
    if not gate("GATE_FRONTMATTER_PRESENT", fm is not None):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_FRONTMATTER_PRESENT",
                             "errorCode": "ENT_SKILL_INVALID_PACKAGE", "message": "缺少 YAML frontmatter"}
        return rec, None
    import yaml
    try:
        parsed = yaml.safe_load(fm)
    except Exception as e:
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_FRONTMATTER_YAML", "errorCode": "ENT_SKILL_INVALID_PACKAGE",
                             "message": "frontmatter 不是有效 YAML: %s" % e}
        return rec, None
    gate("GATE_FRONTMATTER_YAML", isinstance(parsed, dict))
    if not isinstance(parsed, dict):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_FRONTMATTER_YAML",
                             "errorCode": "ENT_SKILL_INVALID_PACKAGE", "message": "frontmatter 必须是映射"}
        return rec, None

    legacy = [k for k in LEGACY if k in parsed]
    if not gate("GATE_NO_LEGACY_FIELDS", not legacy, detail=str(legacy)):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_NO_LEGACY_FIELDS", "errorCode": "ENT_SKILL_INVALID_PACKAGE",
                             "message": "含官方废弃字段", "evidence": legacy}
        return rec, None
    name = parsed.get("name")
    desc = parsed.get("description")
    if not gate("GATE_SKILL_NAME_KEBAB", isinstance(name, str) and bool(SKILL_NAME.match(name))
                and len(name) <= 64, observed=name, detail="^[a-z0-9]+(?:-[a-z0-9]+)*$ <=64"):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_SKILL_NAME_KEBAB", "errorCode": "ENT_SKILL_INVALID_PACKAGE",
                             "message": "SKILL.md name 必须是 kebab-case: %r" % (name,)}
        return rec, None
    if not gate("GATE_SKILL_DESCRIPTION", isinstance(desc, str) and desc.strip() and len(desc) <= 1024,
                observed=len(desc) if isinstance(desc, str) else None, limit=1024):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_SKILL_DESCRIPTION", "errorCode": "ENT_SKILL_INVALID_PACKAGE",
                             "message": "description 缺失或超过 1024 字符"}
        return rec, None
    rec["sourceSkillName"] = name
    rec["sourceDescription"] = desc
    rec["sourceLicenseRaw"] = parsed.get("license")
    rec["sourceFrontmatterKeys"] = sorted(parsed.keys())

    # 组装目标包;分类先过显式门禁:未映射则不落盘、不写「通用」
    category, basis = resolve_category(item, warnings)
    rec["categoryBasis"] = basis
    if not gate("GATE_CATEGORY_MAPPED", category is not None, observed=basis,
                detail="未映射的平台分类一律拒绝并列入待人工分类,禁止静默落入「通用」"):
        rec["status"] = "REJECTED"
        rec["pendingCategory"] = item.get("upstreamCategory")
        rec["rejectedBy"] = {
            "gate": "GATE_CATEGORY_MAPPED", "errorCode": "ENT_SKILL_CATEGORY_UNMAPPED",
            "message": "平台分类 %r 未在本转换器映射表中,需人工归类后才能转换" % item.get("upstreamCategory"),
            "evidence": {"upstreamCategory": item.get("upstreamCategory"),
                         "subCategory": item.get("subCategory"),
                         "mappedPlatformCategories": sorted(CATEGORY_MAP),
                         "aliases": sorted(CATEGORY_ALIASES),
                         "unmappedByDesign": sorted(CATEGORY_UNMAPPED_BY_DESIGN)}}
        return rec, None

    root = "skills/%s" % item["dirName"]
    out = io.BytesIO()
    manifest_desc = desc if len(desc) <= 200 else desc[:199] + "…"
    manifest = {
        "format": "dsh-skill",
        "version": "1",
        "id": item["id"],
        "name": item["displayName"],
        "sourceDshVersion": "skillhub.cn/%s@%s" % (item["slug"], item["version"]),
        "description": manifest_desc,
        "category": category,
    }
    rec["manifest"] = manifest
    rec["categoryResolution"] = {"bucket": category, "basis": basis,
                                 "upstreamCategory": item.get("upstreamCategory"),
                                 "subCategory": item.get("subCategory")}
    manifest_bytes = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
    gate("GATE_MANIFEST_BYTES", len(manifest_bytes) <= MAX_MANIFEST, len(manifest_bytes), MAX_MANIFEST)
    if len(manifest["sourceDshVersion"]) > 64:
        gate("GATE_SOURCE_DSH_VERSION", False, len(manifest["sourceDshVersion"]), 64)
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_SOURCE_DSH_VERSION", "message": "sourceDshVersion 超过 64 字符"}
        return rec, None
    gate("GATE_SOURCE_DSH_VERSION", True, len(manifest["sourceDshVersion"]), 64)

    moved = []
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zo:
        zo.writestr("manifest.json", manifest_bytes)
        for info in infos:
            n = info.filename
            if n.endswith("/"):
                continue
            target = root + "/SKILL.md" if n == md_name else "%s/%s" % (root, n)
            data = z.read(n)
            zo.writestr(target, data)
            moved.append({"from": n, "to": target, "bytes": len(data)})
    rec["targetEntries"] = len(moved)
    rec["targetPaths"] = [m["to"] for m in moved]
    rec["targetFileTree"] = sorted({"/".join(m["to"].split("/")[:-1]) for m in moved})
    blob = out.getvalue()
    rec["targetBytes"] = len(blob)
    rec["targetSha256"] = hashlib.sha256(blob).hexdigest()
    rec["skillMdBytes"] = len(md_bytes)
    gate("GATE_SKILL_MD_BYTES", len(md_bytes) <= MAX_SKILL_MD, len(md_bytes), MAX_SKILL_MD)
    gate("GATE_SKILLS_COUNT", 1 <= MAX_SKILLS, 1, MAX_SKILLS)
    if len(md_bytes) > MAX_SKILL_MD:
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_SKILL_MD_BYTES", "errorCode": "ENT_SKILL_TOO_LARGE",
                             "message": "SKILL.md 超过 256KiB"}
        return rec, None

    # 自检:回读产出包,复核服务端会看到的路径集合
    back = zipfile.ZipFile(io.BytesIO(blob))
    bn = back.namelist()
    ok_paths = all(n == "manifest.json" or n.startswith("skills/") for n in bn)
    ok_md = len([n for n in bn if n.count("/") == 2 and n.endswith("/SKILL.md")]) == 1
    gate("GATE_ROUNDTRIP_PATHS", ok_paths and ok_md, detail="entries=%d" % len(bn))
    if not (ok_paths and ok_md):
        rec["status"] = "REJECTED"
        rec["rejectedBy"] = {"gate": "GATE_ROUNDTRIP_PATHS", "message": "产出包路径复核失败"}
        return rec, None

    dest = os.path.join(OUT, item["id"] + ".dshskill")
    if dry_run:
        rec["output"] = {"file": dest, "bytes": len(blob), "sha256": rec["targetSha256"],
                         "skillCount": 1, "entryCount": len(bn), "dryRun": True, "written": False}
        rec["status"] = "CONVERTED"
        return rec, None
    os.makedirs(OUT, exist_ok=True)
    with open(dest, "wb") as fh:
        fh.write(blob)
    rec["output"] = {"file": dest, "bytes": len(blob), "sha256": rec["targetSha256"],
                     "skillCount": 1, "entryCount": len(bn), "dryRun": False, "written": True}
    rec["status"] = "CONVERTED"
    return rec, dest


def main():
    argv = list(sys.argv[1:])
    dry_run = "--dry-run" in argv
    if dry_run:
        argv.remove("--dry-run")
    report_path = REPORT
    if "--report" in argv:
        i = argv.index("--report")
        if i + 1 >= len(argv):
            sys.exit("--report 需要一个路径参数")
        report_path = argv[i + 1]
        del argv[i:i + 2]
    if argv:
        sys.exit("未知参数: %s(仅支持 --dry-run 与 --report PATH)" % " ".join(argv))

    if not dry_run:
        os.makedirs(OUT, exist_ok=True)
    results = []
    for item in PLAN:
        rec, _ = convert_one(item, dry_run=dry_run)
        results.append(rec)
        print("=" * 96)
        print("%s  [%s]" % (rec["id"], rec["status"]))
        print("  source=%s" % rec["source"]["sourceUrl"])
        print("  category=%s  basis=%s" % (rec.get("manifest", {}).get("category"),
                                           rec.get("categoryBasis")))
        if rec["status"] == "CONVERTED":
            print("  manifest=%s" % json.dumps(rec["manifest"], ensure_ascii=False))
            print("  target: %d entries, %d bytes, sha256=%s%s"
                  % (rec["output"]["entryCount"], rec["output"]["bytes"], rec["output"]["sha256"][:16],
                     "  (dry-run,未落盘)" if rec["output"].get("dryRun") else ""))
            print("  tree:")
            for m in rec["targetPaths"]:
                print("     %s" % m)
            fails = [g for g in rec["gates"] if g["result"] != "PASS"]
            print("  gates: %d PASS / %d FAIL" % (len(rec["gates"]) - len(fails), len(fails)))
        else:
            print("  REJECTED: %s" % json.dumps(rec.get("rejectedBy"), ensure_ascii=False))
        for w in rec["warnings"]:
            print("  WARN %s %s" % (w["code"], w.get("detail")))

    pending = {}
    for r in results:
        if r.get("pendingCategory"):
            pending.setdefault(r["pendingCategory"], []).append(r["id"])
    payload = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "dryRun": dry_run,
               "categoryBuckets": list(CATEGORY_BUCKETS),
               "mappedPlatformCategories": {k: CATEGORY_MAP[k] for k in sorted(CATEGORY_MAP)},
               "categoryAliases": {k: v[0] for k, v in sorted(CATEGORY_ALIASES.items())},
               "pendingCategories": [{"platformCategory": k, "skills": v}
                                     for k, v in sorted(pending.items())],
               "results": results}
    json.dump(payload, open(report_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if pending:
        print("\n待人工分类(未映射的平台 category):")
        for k, v in sorted(pending.items()):
            print("  %-24s %s" % (k, ", ".join(v)))
    ok = sum(1 for r in results if r["status"] == "CONVERTED")
    print("\n%s %d/%d 成功 -> %s"
          % ("dry-run 转换" if dry_run else "转换", ok, len(results), report_path))
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
