#!/usr/bin/env python3
"""从控制台构建产物里抽取界面中文文案语料（stdin = 拼接后的 JS），供 build-help.mjs 做 UI 文案交叉校验。

用途：手册里写的按钮/菜单名（frontmatter 的 uiLabels）必须仍能在控制台产物中找到；
      界面改文案后手册构建会失败，而不是静默腐烂。
"""
import re
import sys

CJK = re.compile(r'[\u4e00-\u9fff]{2,12}')
text = sys.stdin.buffer.read().decode('utf-8', errors='ignore')
found = sorted({match for match in CJK.findall(text)})
sys.stdout.write('\n'.join(found) + '\n')
print(f'抽取到 {len(found)} 条界面中文文案', file=sys.stderr)
