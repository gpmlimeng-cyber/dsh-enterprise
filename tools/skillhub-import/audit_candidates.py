#!/usr/bin/env python3
"""候选技能审计:包结构、SKILL.md frontmatter(真 YAML 解析)、许可字段原文、_meta.json。

[INPUT]: /opt/work/skillhub-import/raw/pkg/*.zip 与 raw/list-score-top40.json
[OUTPUT]: /opt/work/skillhub-import/raw/candidate-audit.json + stdout
[POS]: 许可闸门与转换前的唯一事实来源,不做许可判定,只导出原文
"""
import json
import os
import re
import sys
import zipfile

RAW = "/opt/work/skillhub-import/raw"
PKG = os.path.join(RAW, "pkg")

try:
    import yaml
    HAVE_YAML = True
except Exception:
    HAVE_YAML = False

CANDIDATES = [
    ("indiv-ebandao", "dev-expert", "dev-expert"),
    ("indiv-ebandao", "parenting-expert", "parenting-expert"),
    ("zcwl", "multi-search-engine", "multi-search-engine"),
    ("indiv-ebandao", "libai", "libai"),
    ("indiv-ebandao", "baozheng", "baozheng-skills"),
    ("user_5b28ea14", "smart-charts", "smart-charts"),
    ("org-liz6o019", "luhe-paper-free-pro", "luhe-paper-free"),
    ("user_bddf3fe6", "contextweave-interactive-architecture", "interactive-architecture-diagram"),
]


def frontmatter_text(text):
    m = re.match(r"^\uFEFF?---\n(.*?)\n---\s*?(?:\n|$)", text, re.S)
    return m.group(1) if m else None


def main():
    lst = json.load(open(os.path.join(RAW, "list-score-top40.json"), encoding="utf-8"))["data"]["skills"]
    by = {}
    for s in lst:
        ns = s.get("namespace") or {}
        by[(ns.get("handle"), s.get("slug"))] = s
    out = []
    print("pyyaml available:", HAVE_YAML)
    for handle, slug, fmname in CANDIDATES:
        meta = by.get((handle, slug))
        rec = {"handle": handle, "slug": slug, "frontmatterName": fmname}
        if meta:
            rec.update({"score": meta.get("score"), "name": meta.get("name"),
                        "category": meta.get("category"),
                        "subCategories": [x.get("name") for x in (meta.get("subCategories") or [])],
                        "version": meta.get("version"), "downloads": meta.get("downloads"),
                        "stars": meta.get("stars"), "source": meta.get("source"),
                        "labels": meta.get("labels"),
                        "sourceUrl": "https://skillhub.cn/skills/%s/%s" % (handle, slug),
                        "canonicalName": (meta.get("namespace") or {}).get("canonicalName"),
                        "description": meta.get("description_zh") or meta.get("description")})
        fn = "%s__%s__%s.zip" % (handle, slug, meta["version"] if meta else "*")
        path = os.path.join(PKG, fn)
        rec["packageFile"] = fn
        if not os.path.exists(path):
            print("!! missing", fn)
            out.append(rec)
            continue
        rec["packageBytes"] = os.path.getsize(path)
        z = zipfile.ZipFile(path)
        names = z.namelist()
        rec["entries"] = len(names)
        rec["expandedBytes"] = sum(i.file_size for i in z.infolist())
        rec["paths"] = names
        rec["topLevel"] = sorted({n.split("/")[0] for n in names})
        md = [n for n in names if n.lower().endswith("skill.md")]
        rec["skillMdFile"] = md[0] if md else None
        if md:
            raw = z.read(md[0]).decode("utf-8", "replace")
            fmraw = frontmatter_text(raw)
            rec["skillMdBytes"] = len(raw.encode("utf-8"))
            rec["frontmatterRaw"] = fmraw
            rec["fullTextStart"] = raw[:400]
            parsed = None
            if fmraw and HAVE_YAML:
                try:
                    parsed = yaml.safe_load(fmraw)
                except Exception as e:
                    rec["yamlError"] = str(e)
            if isinstance(parsed, dict):
                rec["frontmatterParsed"] = {k: (v if isinstance(v, (str, int, float, bool, type(None))) else str(v)) for k, v in parsed.items()}
                rec["licenseRaw"] = parsed.get("license")
                rec["descLen"] = len(str(parsed.get("description") or ""))
                rec["nameParsed"] = parsed.get("name")
            # 任何 LICENSE 文件
            lic = [n for n in names if re.search(r"(^|/)(LICENSE|LICENCE|COPYING)(\.(md|txt))?$", n, re.I)]
            rec["licenseFiles"] = lic
            rec["licenseFileText"] = {n: z.read(n).decode("utf-8", "replace")[:2000] for n in lic}
        for extra in ("_meta.json", "meta.json", "manifest.json", "package.json", "attribution.json"):
            if extra in names:
                try:
                    rec["extra_" + extra] = z.read(extra).decode("utf-8", "replace")[:3000]
                except Exception as e:
                    rec["extra_" + extra] = "ERR " + str(e)
        out.append(rec)
        print("\n===== %s/%s  (score=%s, %s)" % (handle, slug, rec.get("score"), rec.get("name")))
        print("  version=%s category=%s subs=%s" % (rec.get("version"), rec.get("category"), rec.get("subCategories")))
        print("  package=%s bytes=%s entries=%s expanded=%s" % (fn, rec["packageBytes"], rec["entries"], rec["expandedBytes"]))
        print("  top=%s" % rec["topLevel"])
        print("  skillMd=%s bytes=%s name=%r descLen=%s" % (md, rec.get("skillMdBytes"), rec.get("nameParsed"), rec.get("descLen")))
        print("  license(parsed)=%r  licenseFiles=%s" % (rec.get("licenseRaw"), rec.get("licenseFiles")))
        print("  frontmatterRaw = %s" % (rec.get("frontmatterRaw") or "")[:600].replace("\n", " | "))
    json.dump(out, open(os.path.join(RAW, "candidate-audit.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("\nwrote candidate-audit.json")


if __name__ == "__main__":
    main()
