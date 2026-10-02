#!/usr/bin/env python3
"""按 score 抓取 Top N 真实技能并下载原始包(不做任何判断,只落盘)。"""
import json
import os
import subprocess
import sys

BASE = "https://api.skillhub.cn"
OUT = "/opt/work/skillhub-import/raw"
PKG = os.path.join(OUT, "pkg")
os.makedirs(PKG, exist_ok=True)

n = int(sys.argv[1]) if len(sys.argv) > 1 else 40
listfile = "%s/list-score-top%d.json" % (OUT, n)
if not os.path.exists(listfile) or os.environ.get("REFRESH"):
    url = "%s/api/skills?page=1&pageSize=%d&sortBy=score&order=desc" % (BASE, n)
    subprocess.run(["curl", "-sS", url, "--max-time", "40", "-H", "Accept: application/json",
                    "-H", "Origin: https://skillhub.cn", "-H", "Referer: https://skillhub.cn/",
                    "-o", listfile], check=True)
d = json.load(open(listfile, encoding="utf-8"))
skills = d["data"]["skills"]
print("total=%s fetched=%d" % (d["data"]["total"], len(skills)))

for i, s in enumerate(skills, 1):
    ns = s.get("namespace") or {}
    handle = ns.get("handle") or ""
    slug = s.get("slug")
    ver = s.get("version")
    fn = "%s__%s__%s.zip" % (handle, slug, ver)
    path = os.path.join(PKG, fn)
    if not os.path.exists(path) or os.path.getsize(path) < 100:
        url = "%s/api/v1/download?slug=%s&namespace=%s" % (BASE, slug, handle)
        r = subprocess.run(["curl", "-sSL", url, "--max-time", "120",
                            "-H", "Origin: https://skillhub.cn", "-H", "Referer: https://skillhub.cn/",
                            "-o", path], capture_output=True, text=True)
        if r.returncode != 0:
            print("%2d DOWNLOAD_FAIL %s %s" % (i, slug, r.stderr.strip()))
            continue
    print("%2d %-10s %-34s %-30s %8d bytes  %s" % (
        i, round(s["score"], 1), slug, ns.get("canonicalName"), os.path.getsize(path), fn))
