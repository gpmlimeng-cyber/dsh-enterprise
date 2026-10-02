#!/usr/bin/env python3
"""汇总留证清单:原始包 SHA-256、转换后包 SHA-256 与逐条文件树。

[INPUT]: raw/pkg/*.zip、converted/*.dshskill
[OUTPUT]: evidence/artifacts-sha256.txt、evidence/package-trees.txt
[POS]: 复核用的机械清单,不含判断
"""
import hashlib
import json
import os
import zipfile

ROOT = "/opt/work/skillhub-import"
PKG = os.path.join(ROOT, "raw", "pkg")
CONV = os.path.join(ROOT, "converted")
EVID = os.path.join(ROOT, "evidence")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    os.makedirs(EVID, exist_ok=True)
    lines = ["# 原始包(下载产物)SHA-256 与字节数", ""]
    for fn in sorted(os.listdir(PKG)):
        p = os.path.join(PKG, fn)
        lines.append("%-60s %10d  %s" % (fn, os.path.getsize(p), sha256(p)))
    lines += ["", "# 转换后 .dshskill SHA-256 与字节数", ""]
    report = json.load(open(os.path.join(ROOT, "conversion-report.json"), encoding="utf-8"))
    for r in report["results"]:
        sid = r["id"]
        p = os.path.join(CONV, sid + ".dshskill")
        lines.append("%-34s %10d  %s" % (sid + ".dshskill", os.path.getsize(p), sha256(p)))
    open(os.path.join(EVID, "artifacts-sha256.txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

    t = ["# 转换后包内文件树(逐条路径,证明保留多层目录)", ""]
    for r in report["results"]:
        sid = r["id"]
        p = os.path.join(CONV, sid + ".dshskill")
        z = zipfile.ZipFile(p)
        names = z.namelist()
        t.append("## %s  (%d entries, %d bytes)" % (sid, len(names), os.path.getsize(p)))
        t.append("manifest.json -> %s" % json.dumps(r["manifest"], ensure_ascii=False))
        for n in names:
            if n == "manifest.json":
                continue
            t.append("  %s  (%d bytes)" % (n, z.getinfo(n).file_size))
        t.append("")
    open(os.path.join(EVID, "package-trees.txt"), "w", encoding="utf-8").write("\n".join(t) + "\n")
    print("wrote artifacts-sha256.txt and package-trees.txt")


if __name__ == "__main__":
    main()
