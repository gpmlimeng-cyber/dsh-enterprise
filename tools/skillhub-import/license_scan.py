#!/usr/bin/env python3
"""全量许可扫描:对 raw/pkg 下每个原始包导出许可证据并给出判定(allowlist 硬闸门)。

[INPUT]: /opt/work/skillhub-import/raw/pkg/*.zip
[OUTPUT]: /opt/work/skillhub-import/raw/license-scan.json + 表
[POS]: 许可闸门的可复核记录;判定规则内置且只认宽松许可
"""
import json
import os
import re
import sys
import zipfile

RAW = "/opt/work/skillhub-import/raw"
PKG = os.path.join(RAW, "pkg")

ALLOW = {"MIT": "MIT", "APACHE-2.0": "Apache-2.0", "BSD-2-CLAUSE": "BSD-2-Clause",
         "BSD-3-CLAUSE": "BSD-3-Clause", "ISC": "ISC"}
DENY_MARK = re.compile(
    r"(CC-BY-SA|CC BY-SA|Creative Commons Attribution-ShareAlike|GPL|GNU General Public|"
    r"AGPL|LGPL|Mozilla Public|MPL-2|EUPL|CC-BY-NC|CC BY-NC|Proprietary|All rights reserved|"
    r"CC-BY-4|CC BY 4)", re.I)
FM_END = re.compile(r"^---\s*$")


def frontmatter_lines(text):
    text = text.lstrip("\ufeff")
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return None
    out = []
    for line in lines[1:]:
        if line.strip() == "---":
            return out
        out.append(line.rstrip("\r"))
    return None


def fm_scalar(lines, key):
    """只取单行标量值(不解析块标量),返回原文。"""
    pat = re.compile(r"^%s\s*:\s*(.*)$" % re.escape(key))
    for ln in lines:
        m = pat.match(ln)
        if m:
            v = m.group(1).strip()
            return v
    return None


def norm(v):
    if v is None:
        return None
    s = v.strip().strip('"').strip("'").strip()
    return s or None


def main():
    rows = []
    for fn in sorted(os.listdir(PKG)):
        if not fn.endswith(".zip"):
            continue
        path = os.path.join(PKG, fn)
        rec = {"file": fn, "bytes": os.path.getsize(path)}
        try:
            z = zipfile.ZipFile(path)
        except Exception as e:
            rec.update({"error": str(e), "verdict": "REJECT", "reason": "不是有效 zip"})
            rows.append(rec)
            continue
        names = z.namelist()
        md = [n for n in names if n.lower().endswith("skill.md") and n.count("/") == 0]
        rec["licenseRawFrontmatter"] = None
        rec["licenseSources"] = []
        if md:
            text = z.read(md[0]).decode("utf-8", "replace")
            lines = frontmatter_lines(text) or []
            raw_lic = fm_scalar(lines, "license")
            rec["licenseRawFrontmatter"] = raw_lic
            if raw_lic:
                rec["licenseSources"].append({"kind": "SKILL.md frontmatter license", "raw": raw_lic})
            rec["skillNameRaw"] = fm_scalar(lines, "name")
            rec["_mdText"] = text
        licfiles = [n for n in names
                    if re.search(r"(^|/)(LICENSE|LICENCE|COPYING)(\.(md|txt|markdown))?$", n, re.I)]
        rec["licenseFiles"] = licfiles
        for n in licfiles:
            try:
                t = z.read(n).decode("utf-8", "replace")
            except Exception:
                continue
            rec["licenseSources"].append({"kind": "file:" + n, "raw": t[:600]})
        # _meta.json / manifest.json 里的 license 键
        for extra in ("_meta.json", "meta.json", "manifest.json", "package.json", "attribution.json"):
            if extra in names:
                try:
                    j = json.loads(z.read(extra).decode("utf-8", "replace"))
                except Exception:
                    continue
                if isinstance(j, dict) and j.get("license"):
                    rec["licenseSources"].append({"kind": extra + " .license", "raw": str(j.get("license"))})
        # README 里的许可声明(仅取相邻 200 字符)
        for n in names:
            if re.match(r"^README(\.md|\.en\.md)?$", n, re.I):
                t = z.read(n).decode("utf-8", "replace")
                m = re.search(r"(MIT License|Apache License[^\n]{0,40}|BSD [23]-Clause[^\n]{0,20}|CC-BY-SA[^\n]{0,20}|GNU General Public[^\n]{0,20})", t, re.I)
                if m:
                    rec["licenseSources"].append({"kind": "README 提及", "raw": m.group(0)[:120]})
        # 判定
        verdict, reason, lic = "REJECT", None, None
        cand = norm(rec["licenseRawFrontmatter"])
        if cand and cand.upper().replace(" ", "") in {"MIT"}:
            lic, verdict, reason = "MIT", "ALLOW", "frontmatter license: %s" % rec["licenseRawFrontmatter"]
        elif cand and cand.upper().replace(" ", "") in {"APACHE-2.0", "APACHE2.0", "APACHE"}:
            lic, verdict, reason = "Apache-2.0", "ALLOW", "frontmatter license: %s" % rec["licenseRawFrontmatter"]
        elif cand and cand.upper().replace(" ", "").startswith("BSD"):
            lic, verdict, reason = cand, "ALLOW", "frontmatter license: %s" % rec["licenseRawFrontmatter"]
        elif cand:
            lic, verdict, reason = cand, "REJECT", "frontmatter license 非宽松许可: %s" % rec["licenseRawFrontmatter"]
        else:
            # 无 license 字段:看 LICENSE 文件 / README 声明
            joined = " ".join(s["raw"] for s in rec["licenseSources"])
            if re.search(r"MIT License|Permission is hereby granted, free of charge", joined, re.I) and not DENY_MARK.search(joined):
                lic, verdict, reason = "MIT", "ALLOW", "包内 LICENSE 文本为 MIT"
            elif re.search(r"Apache License", joined, re.I) and not DENY_MARK.search(joined):
                lic, verdict, reason = "Apache-2.0", "ALLOW", "包内 LICENSE 文本为 Apache-2.0"
            elif DENY_MARK.search(joined):
                lic, verdict, reason = "copyleft/受限", "REJECT", "包内许可文本为传染/受限许可"
            else:
                lic, verdict, reason = None, "REJECT", "许可不明:无 license 字段、无 LICENSE 文件"
        rec["licenseDetermined"] = lic
        rec["verdict"] = verdict
        rec["reason"] = reason
        rec.pop("_mdText", None)
        rows.append(rec)

    json.dump(rows, open(os.path.join(RAW, "license-scan.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    allowed = [r for r in rows if r["verdict"] == "ALLOW"]
    denied = [r for r in rows if r["verdict"] == "REJECT"]
    print("扫描 %d 个包: ALLOW=%d REJECT=%d\n" % (len(rows), len(allowed), len(denied)))
    print("%-52s %-12s %-6s %s" % ("file", "license", "verdict", "reason"))
    for r in rows:
        print("%-52s %-12s %-6s %s" % (r["file"][:52], str(r["licenseDetermined"]), r["verdict"], r["reason"][:90]))
        if r["licenseSources"]:
            for s in r["licenseSources"]:
                print("        <- %s: %s" % (s["kind"], s["raw"].replace("\n", " ")[:140]))


if __name__ == "__main__":
    main()
