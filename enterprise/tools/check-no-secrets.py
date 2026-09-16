#!/usr/bin/env python3
"""推送前的密钥泄漏扫描：把部署密钥清单与待推送目录逐项比对，只报告"哪个键出现在哪个文件"，不打印任何密钥值。

用法：
  # 1) 在服务器上把密钥清单取到本地（重定向，避免进入终端输出/日志）
  ssh root@<server> 'cat /opt/owndsh/src/.env /opt/owndsh/CREDENTIALS.txt' > /tmp/secrets.lst

  # 2) 扫描待推送目录
  python3 tools/check-no-secrets.py /tmp/secrets.lst /path/to/repo

退出码：0 = 干净；1 = 命中泄漏。
"""
import re
import sys
from pathlib import Path

if len(sys.argv) < 3:
    sys.exit("用法：check-no-secrets.py <密钥清单文件> <待检查目录>")

secrets_file = Path(sys.argv[1])
root = Path(sys.argv[2])

# 只扫描文本类文件，跳过二进制与大文件
TEXT_SUFFIXES = {
    ".md", ".txt", ".yaml", ".yml", ".json", ".html", ".css", ".js", ".mjs", ".cjs",
    ".ts", ".tsx", ".sh", ".py", ".patch", ".conf", ".xml", ".env", ""
}
SKIP_DIRS = {".git", "node_modules", "dist"}

# 1) 解析密钥清单
secrets = []
for line in secrets_file.read_text(encoding="utf-8", errors="ignore").splitlines():
    line = line.rstrip()
    if not line or line.startswith("#"):
        continue
    match = re.match(r"^([A-Za-z0-9_]*(?:SECRET|KEY|PASSWORD|TOKEN|PASSWD)[A-Za-z0-9_]*)\s*=\s*(.+)$", line)
    if match:
        name, value = match.group(1), match.group(2).strip()
    else:
        match = re.match(r"^([^:：]{2,20})[:：]\s*(\S{6,})$", line)
        if not match:
            continue
        name, value = match.group(1).strip(), match.group(2).strip()
    value = value.strip().strip('"').strip("'")
    # 过滤占位值与过短值，避免误报
    if len(value) < 6 or value.lower() in {"true", "false", "changeme", "placeholder", "your-password"}:
        continue
    if value.startswith("${") or value.startswith("<"):
        continue
    secrets.append((name, value))

# 2) 扫描目录
problems = []
scanned = 0
dangerous_names = []
for path in root.rglob("*"):
    if any(part in SKIP_DIRS for part in path.parts):
        continue
    if not path.is_file():
        continue
    if path.name in {".env", "CREDENTIALS.txt"} or path.suffix == ".pem" or path.name.startswith("id_"):
        dangerous_names.append(str(path.relative_to(root)))
    if path.suffix.lower() not in TEXT_SUFFIXES:
        continue
    if path.stat().st_size > 2_000_000:
        continue
    scanned += 1
    text = path.read_text(encoding="utf-8", errors="ignore")
    for name, value in secrets:
        if value in text:
            problems.append(f"{path.relative_to(root)}: 命中密钥 {name}")
    if re.search(r"BEGIN [A-Z ]*PRIVATE KEY", text):
        problems.append(f"{path.relative_to(root)}: 命中私钥块")
    if re.search(r"(?:SA_TOKEN_JWT_SECRET_KEY|ENT_MASTER_KEY)\s*=\s*\S{6,}", text):
        problems.append(f"{path.relative_to(root)}: 命中密钥赋值语句")

print(f"扫描文本文件 {scanned} 个，比对密钥项 {len(secrets)} 个")
if dangerous_names:
    print("高危文件名（必须加入 .gitignore 或删除）：")
    for name in dangerous_names:
        print("  ✗", name)
if problems:
    print(f"发现 {len(problems)} 处泄漏：")
    for problem in problems:
        print("  ✗", problem)
    sys.exit(1)
print("未发现密钥泄漏 ✅" + ("（但存在高危文件名，见上）" if dangerous_names else ""))
sys.exit(1 if dangerous_names else 0)
