#!/usr/bin/env python3
"""把「角色 → ent:* 权限」TSV（stdin）转成帮助手册的 facts JSON。

输入：psql -tAc 输出的三列 TSV —— role_key \t role_name \t "空格分隔的权限码"
输出：facts/role-permissions.json（供 build-help.mjs 渲染角色与权限矩阵）
"""
import json
import sys
from datetime import datetime, timezone

rows = []
permissions = []
for line in sys.stdin.read().splitlines():
    line = line.rstrip('\n')
    if not line.strip():
        continue
    parts = line.split('\t')
    if len(parts) < 3:
        continue
    key, name, perms = parts[0].strip(), parts[1].strip(), parts[2].strip()
    codes = sorted({code for code in perms.split() if code.startswith('ent:')})
    for code in codes:
        if code not in permissions:
            permissions.append(code)
    rows.append({'key': key, 'name': name, 'permissions': codes})

if not rows:
    sys.exit('未从 stdin 读到任何角色行，检查 psql 查询')

permissions.sort()
target = sys.argv[1] if len(sys.argv) > 1 else 'facts/role-permissions.json'
payload = {
    'source': '运行实例 PostgreSQL：sys_role / sys_role_menu / sys_menu.perms',
    'collectedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
    'note': '内置企业角色的 ent:* 权限由 Flyway 迁移与宿主权限表共同决定，不可自由编排。',
    'permissions': permissions,
    'roles': rows,
}
with open(target, 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
    handle.write('\n')
print(f'已写入 {target}：{len(rows)} 个角色 / {len(permissions)} 个权限码')
