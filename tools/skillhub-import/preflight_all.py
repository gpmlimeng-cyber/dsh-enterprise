#!/usr/bin/env python3
"""对许可 ALLOW 的全部候选包跑一遍"服务端同级"预检,给出可导入/不可导入与拒因。

[INPUT]: raw/license-scan.json + raw/pkg/*.zip
[OUTPUT]: raw/preflight-allowed.json + stdout 表
[POS]: 选品依据;与 SkillArtifactInspector 的门禁逐条对齐
"""
import json
import os
import re
import sys
import zipfile

RAW = "/opt/work/skillhub-import/raw"
PKG = os.path.join(RAW, "pkg")
MAX_SKILL_MD = 262_144
SKILL_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LEGACY = ("modelInvocable", "userInvocable", "disableModelInvocation")


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


def check(path):
    """返回 (verdict, reasons[], detail{})"""
    reasons = []
    detail = {}
    try:
        z = zipfile.ZipFile(path)
    except Exception as e:
        return "REJECT", ["不是有效 zip: %s" % e], detail
    names = z.namelist()
    detail["entries"] = len(names)
    if any(not n or "\\" in n or n.startswith("/") for n in names):
        reasons.append("GATE_PATH_SAFETY: 非法路径")
    md = [n for n in names if n.lower().endswith("skill.md") and n.count("/") == 0]
    if len(md) != 1:
        reasons.append("GATE_ROOT_SKILL_MD: 根级 SKILL.md 数量=%d" % len(md))
        return "REJECT", reasons, detail
    data = z.read(md[0])
    detail["skillMdBytes"] = len(data)
    if len(data) > MAX_SKILL_MD:
        reasons.append("GATE_SKILL_MD_BYTES: >256KiB")
    text = data.decode("utf-8", "replace")
    fm = fm_block(text)
    if fm is None:
        reasons.append("GATE_FRONTMATTER_PRESENT: 无 YAML frontmatter")
        return "REJECT", reasons, detail
    # 重复键(对齐 SnakeYAML allowDuplicateKeys=false)
    keys = []
    for line in fm.split("\n"):
        m = re.match(r"^([A-Za-z0-9_.\-]+)\s*:", line)
        if m:
            keys.append(m.group(1))
    dup = sorted({k for k in keys if keys.count(k) > 1})
    detail["duplicateKeys"] = dup
    if dup:
        reasons.append("GATE_FRONTMATTER_YAML: 重复键 %s (服务端 allowDuplicateKeys=false)" % dup)
    try:
        import yaml
        parsed = yaml.safe_load(fm)
    except Exception as e:
        parsed = None
        if not dup:
            reasons.append("GATE_FRONTMATTER_YAML: %s" % str(e).split("\n")[0])
    if not isinstance(parsed, dict):
        if parsed is not None or not dup:
            reasons.append("GATE_FRONTMATTER_YAML: 解析结果不是映射")
        detail["frontmatterValid"] = False
    else:
        detail["frontmatterValid"] = not dup
        legacy = [k for k in LEGACY if k in parsed]
        if legacy:
            reasons.append("GATE_NO_LEGACY_FIELDS: %s" % legacy)
        name = parsed.get("name")
        desc = parsed.get("description")
        detail["name"] = name
        detail["descLen"] = len(desc) if isinstance(desc, str) else None
        detail["license"] = parsed.get("license")
        if not (isinstance(name, str) and SKILL_NAME.match(name) and len(name) <= 64):
            reasons.append("GATE_SKILL_NAME_KEBAB: name=%r" % (name,))
        if not (isinstance(desc, str) and desc.strip()):
            reasons.append("GATE_SKILL_DESCRIPTION: 缺失/非字符串")
        elif len(desc) > 1024:
            reasons.append("GATE_SKILL_DESCRIPTION: %d 字符 >1024" % len(desc))
    return ("PASS" if not reasons else "REJECT"), reasons, detail


def main():
    rows = json.load(open(os.path.join(RAW, "license-scan.json"), encoding="utf-8"))
    lst = json.load(open(os.path.join(RAW, "list-score-top100.json"), encoding="utf-8"))["data"]["skills"]
    rank = {}
    for i, s in enumerate(lst, 1):
        ns = s.get("namespace") or {}
        rank["%s__%s__%s.zip" % (ns.get("handle"), s.get("slug"), s.get("version"))] = (i, s)

    out = []
    for r in rows:
        if r["verdict"] != "ALLOW":
            continue
        path = os.path.join(PKG, r["file"])
        v, reasons, detail = check(path)
        i, s = rank.get(r["file"], (None, {}))
        rec = {"file": r["file"], "license": r["licenseDetermined"], "score": s.get("score"),
               "platformRank": i, "skillName": s.get("name"),
               "namespace": (s.get("namespace") or {}).get("canonicalName"),
               "preflight": v, "reasons": reasons, "detail": detail}
        out.append(rec)
    out.sort(key=lambda x: -(x["score"] or 0))
    print("%-4s %-12s %-10s %-34s %-8s %s" % ("rank", "score", "license", "name", "preflight", "reasons"))
    for r in out:
        print("%-4s %-12.1f %-10s %-34s %-8s %s" % (
            r["platformRank"], r["score"] or 0, r["license"], str(r["skillName"])[:34],
            r["preflight"], "; ".join(r["reasons"])[:110]))
        print("      pkg=%s frontmatter=%s" % (r["file"], json.dumps(r["detail"], ensure_ascii=False)[:220]))
    json.dump(out, open(os.path.join(RAW, "preflight-allowed.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("\nALLOW 候选 %d 个: 预检 PASS=%d REJECT=%d"
          % (len(out), sum(1 for r in out if r["preflight"] == "PASS"),
             sum(1 for r in out if r["preflight"] == "REJECT")))


if __name__ == "__main__":
    main()
