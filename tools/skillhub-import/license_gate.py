#!/usr/bin/env python3
"""许可闸门(最终判定):从 SKILL.md frontmatter / 包内 LICENSE / README 许可证节 / 元数据取原文,判定允许或拒绝。

[INPUT]: /opt/work/skillhub-import/raw/pkg/*.zip
[OUTPUT]: /opt/work/skillhub-import/raw/license-gate.json + 表
[POS]: 硬闸门的最终记录;只接受 MIT(含 MIT-0/0BSD/ISC)/Apache-2.0/BSD 系列
"""
import json
import os
import re
import sys
import zipfile

RAW = "/opt/work/skillhub-import/raw"
PKG = os.path.join(RAW, "pkg")
OUTPATH = os.path.join(RAW, "license-gate.json")

FM_KEYS = ("license", "licence")
TEXT_LIC = re.compile(r"(^|/)(LICENSE|LICENCE|COPYING)(\.(md|txt|markdown))?$", re.I)
PERMISSIVE_TXT = [
    (re.compile(r"\bMIT-0\b", re.I), "MIT-0"),
    (re.compile(r"MIT License|Permission is hereby granted, free of charge", re.I), "MIT"),
    (re.compile(r"Apache License,?\s*Version 2\.0|Apache License 2\.0", re.I), "Apache-2.0"),
    (re.compile(r"BSD 2-Clause|BSD 3-Clause|Redistribution and use in source and binary forms", re.I), "BSD-3-Clause"),
    (re.compile(r"\bISC License\b", re.I), "ISC"),
]
COPYLEFT_TXT = re.compile(
    r"(CC BY-NC-SA|CC-BY-NC-SA|CC BY-SA|CC-BY-SA|Creative Commons Attribution[- ]ShareAlike|"
    r"Attribution-NonCommercial-ShareAlike|GNU (Lesser |Affero )?General Public License|"
    r"\bAGPL\b|\bLGPL\b|\bGPLv[23]\b|\bGPL-3|\bGPL-2|Mozilla Public License|MPL-2\.0|EUPL|"
    r"知识共享署名－非商业性使用－相同方式共享|相同方式共享)", re.I)
PROPRIETARY_TXT = re.compile(r"proprietary|保留一切权利|All rights reserved|专有许可", re.I)


def fm_block(text):
    n = text.lstrip("\ufeff")
    s = n.find("---")
    if s < 0 or n[:s].strip():
        return None
    ls = n.find("\n", s)
    e = n.find("\n---", ls) if ls >= 0 else -1
    if ls < 0 or e < 0:
        return None
    return n[ls + 1:e + 1]


def fm_scalar(fm, key):
    for line in fm.split("\n"):
        m = re.match(r"^%s\s*:\s*(.*)$" % re.escape(key), line.rstrip("\r"))
        if m:
            return m.group(1).strip()
    return None


def classify_single(raw):
    v = (raw or "").strip().strip('"').strip("'").strip()
    if not v:
        return None, None
    u = v.upper().replace(" ", "")
    if u in {"MIT", "MIT-0", "MIT0"}:
        return ("MIT-0" if u.startswith("MIT-0") or u == "MIT0" else "MIT"), "ALLOW"
    if u in {"APACHE-2.0", "APACHE2.0", "APACHE", "APACHE-2"}:
        return "Apache-2.0", "ALLOW"
    if u.startswith("BSD-2") or u == "BSD2CLAUSE":
        return "BSD-2-Clause", "ALLOW"
    if u.startswith("BSD-3") or u == "BSD3CLAUSE":
        return "BSD-3-Clause", "ALLOW"
    if u in {"BSD", "BSD-2", "BSD-3"}:
        return v, "ALLOW"
    if u == "ISC":
        return "ISC", "ALLOW"
    if u == "0BSD":
        return "0BSD", "ALLOW"
    if COPYLEFT_TXT.search(v):
        return v, "REJECT-COPYLEFT"
    if PROPRIETARY_TXT.search(v):
        return v, "REJECT-PROPRIETARY"
    return v, "REJECT-NONPERMISSIVE"


def classify_text(txt):
    # copyleft 优先:包内只要出现传染/非商业条款即整包拒绝(如"代码 Apache + 内容 CC BY-NC-SA"的双轨协议)
    if COPYLEFT_TXT.search(txt):
        return "copyleft(含 CC BY-NC-SA/GPL 等条款)", "REJECT-COPYLEFT"
    for rx, name in PERMISSIVE_TXT:
        if rx.search(txt):
            return name, "ALLOW"
    if PROPRIETARY_TXT.search(txt):
        return "proprietary", "REJECT-PROPRIETARY"
    return None, None


def main():
    rows = []
    for fn in sorted(os.listdir(PKG)):
        if not fn.endswith(".zip"):
            continue
        path = os.path.join(PKG, fn)
        try:
            z = zipfile.ZipFile(path)
            names = z.namelist()
        except Exception as e:
            rows.append({"file": fn, "evidence": [], "license": None,
                         "verdict": "REJECT-UNREADABLE", "reason": "不是有效 zip: %s" % e})
            continue
        rec = {"file": fn, "evidence": [], "license": None, "verdict": None, "reason": None}
        md = [n for n in names if n.lower().endswith("skill.md") and n.count("/") == 0]
        fm = None
        if md:
            fm = fm_block(z.read(md[0]).decode("utf-8", "replace"))
            rec["skillMd"] = md[0]
        if fm:
            for k in FM_KEYS:
                raw = fm_scalar(fm, k)
                if raw:
                    rec["evidence"].append({"kind": "SKILL.md frontmatter %s" % k, "raw": raw})
        for n in names:
            if TEXT_LIC.search(n):
                try:
                    t = z.read(n).decode("utf-8", "replace")
                except Exception:
                    continue
                m = re.search(r"[^\n]{0,80}(License|授权|协议)[^\n]{0,80}", t)
                rec["evidence"].append({"kind": "file %s" % n, "raw": (m.group(0) if m else t[:200])})
                rec["evidence"][-1]["head"] = t[:6000]
        for n in names:
            if re.match(r"^README(\.en\.md|\.md)?$", n, re.I):
                t = z.read(n).decode("utf-8", "replace")
                m = re.search(r"(#{1,3}\s*[^\n]{0,20}(许可证|License|授权)[^\n]{0,40}\n{1,4}[^\n]{0,200})", t, re.I)
                if m:
                    rec["evidence"].append({"kind": "README 许可证节", "raw": m.group(1)[:240]})
        for extra in ("_meta.json", "meta.json", "manifest.json", "package.json", "attribution.json"):
            if extra in names:
                try:
                    j = json.loads(z.read(extra).decode("utf-8", "replace"))
                except Exception:
                    continue
                if isinstance(j, dict) and j.get("license"):
                    rec["evidence"].append({"kind": "%s .license" % extra, "raw": str(j["license"])})

        lic, verdict, reason = None, None, None
        # 1) frontmatter 标量优先
        for ev in rec["evidence"]:
            if ev["kind"].startswith("SKILL.md frontmatter"):
                lic, verdict = classify_single(ev["raw"])
                if verdict:
                    reason = "SKILL.md frontmatter 原文: %s" % ev["raw"]
                    break
        # 2) 包内 LICENSE 文本(以实际读到的为准)
        if not verdict:
            for ev in rec["evidence"]:
                if ev["kind"].startswith("file "):
                    lic2, v2 = classify_text(ev.get("head", "") + " " + ev["raw"])
                    if v2:
                        lic, verdict = lic2, v2
                        reason = "包内 %s 文本判定" % ev["kind"][5:]
                        if v2 == "REJECT-COPYLEFT":
                            reason += "(内容部分为 CC BY-NC-SA 等传染/非商业许可)"
                        break
        # 3) README 许可证节
        if not verdict:
            for ev in rec["evidence"]:
                if ev["kind"] == "README 许可证节":
                    lic2, v2 = classify_text(ev["raw"])
                    if v2:
                        lic, verdict = lic2, v2
                        reason = "包内 README「许可证」节: %s" % ev["raw"].replace("\n", " ")[:120]
                        break
        # 4) 元数据 license 键
        if not verdict:
            for ev in rec["evidence"]:
                if ev["kind"].endswith(".license"):
                    lic, verdict = classify_single(ev["raw"])
                    if verdict:
                        reason = "%s 原文: %s" % (ev["kind"], ev["raw"])
                        break
        if not verdict:
            lic, verdict, reason = None, "REJECT-UNKNOWN", "许可不明:SKILL.md 无 license 字段、包内无 LICENSE 文件、README 无许可证节"
        rec["license"] = lic
        rec["verdict"] = verdict
        rec["reason"] = reason
        rows.append(rec)

    json.dump(rows, open(OUTPATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    buckets = {}
    for r in rows:
        buckets.setdefault(r["verdict"], []).append(r)
    print("共扫描 %d 个包" % len(rows))
    for k in sorted(buckets):
        print("  %-22s %d" % (k, len(buckets[k])))
    print()
    for k in sorted(buckets):
        print("### %s (%d)" % (k, len(buckets[k])))
        for r in buckets[k]:
            print("  %-56s license=%-16s %s" % (r["file"][:56], str(r["license"]), r["reason"][:110]))
        print()


if __name__ == "__main__":
    main()
