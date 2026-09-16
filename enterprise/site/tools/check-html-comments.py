#!/usr/bin/env python3
"""检查各站点页面是否把文件头部注释泄漏成了可见正文（先按 HTML 规则剥离注释再找标记）。

用途：HTML 注释体内一旦出现 `-->` 或嵌套注释，浏览器会提前结束注释，后续文字会变成可见正文
（2026-09-16 官网 7 个页面泄漏 `[PROTOCOL]` 行就是这个原因）。构建期已有同规则门禁，
本脚本用于**线上复核**（直接抓取实际响应，覆盖所有站点）。

用法（在服务器上执行）：
  python3 /opt/owndsh/site/tools/check-html-comments.py
可用环境变量覆盖：OWNDSH_CHECK_BASE、OWNDSH_CHECK_PAGES（逗号分隔）
"""
import os
import re
import subprocess

BASE = os.environ.get("OWNDSH_CHECK_BASE", "http://127.0.0.1")
PAGES = (os.environ.get("OWNDSH_CHECK_PAGES") or ",".join([
    "/home/", "/home/enterprise/", "/home/deploy/", "/home/download/",
    "/home/security/", "/home/about/", "/home/404.html",
    "/help/", "/help/admin/quickstart.html", "/help/user/faq.html", "/api-docs/",
])).split(",")

total = 0
for path in PAGES:
    html = subprocess.run(["curl", "-s", BASE + path], capture_output=True, text=True).stdout
    if not html.strip():
        print("  %-34s 页面为空（跳过）" % path)
        continue
    visible = re.sub(r"<!--[\s\S]*?-->", "", html)
    leaked = re.findall(r"\[(?:INPUT|OUTPUT|POS|PROTOCOL)\][^\n]{0,40}", visible)
    broken = [body for body in re.findall(r"<!--([\s\S]*?)-->", html) if "--" in body]
    total += len(leaked) + len(broken)
    flag = "OK" if not leaked and not broken else "泄漏/嵌套注释"
    print("  %-34s 泄漏标记 %d 处 · 注释内含-- %d 处  %s" % (path, len(leaked), len(broken), flag))
    for line in leaked[:2]:
        print("        →", line)

print("\n结论：" + ("全部干净 ✅" if total == 0 else "%d 处问题 ❌" % total))
raise SystemExit(0 if total == 0 else 1)
