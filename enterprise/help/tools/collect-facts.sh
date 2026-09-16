#!/bin/sh
# [INPUT]: 依赖宿主上的 docker（运行中的 PostgreSQL 容器）与 python3，以及控制台镜像产物。
# [OUTPUT]: 刷新 facts/role-permissions.json（角色权限矩阵真源）与 facts/console-strings.txt（界面文案语料）。
# [POS]: 帮助手册自动生成页的宿主侧采集脚本；构建容器内不联网、不读数据库，只消费这两个快照。
# [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md §6.4
#
# 用法：sh tools/collect-facts.sh
set -e

HERE=$(cd "$(dirname "$0")/.." && pwd)
PG=${OWNDSH_PG_CONTAINER:-src-postgres-1}
DB=${OWNDSH_DB:-owndsh}
DBUSER=${OWNDSH_DB_USER:-owndsh}
IMG=${OWNDSH_CONSOLE_IMAGE:-ghcr.io/boe1900/owndsh-console:0.1.0-docs}
PY=$(command -v python3 || echo /usr/bin/python3)

mkdir -p "$HERE/facts"

echo '[1/2] 采集角色 → ent:* 权限矩阵'
docker exec "$PG" psql -U "$DBUSER" -d "$DB" -tAc "
select r.role_key || E'\t' || r.role_name || E'\t' ||
       coalesce(string_agg(distinct m.perms, ' ') filter (where m.perms like 'ent:%'), '')
from sys_role r
left join sys_role_menu rm on rm.role_id = r.role_id
left join sys_menu m on m.menu_id = rm.menu_id
group by r.role_key, r.role_name
order by r.role_key
" | "$PY" "$HERE/tools/collect-role-permissions.py" "$HERE/facts/role-permissions.json"

echo '[2/2] 采集控制台界面文案语料'
docker run --rm -u 0 --entrypoint sh "$IMG" -c 'cat /usr/share/nginx/html/assets/*.js' \
  | "$PY" "$HERE/tools/collect-console-strings.py" > "$HERE/facts/console-strings.txt"
wc -l < "$HERE/facts/console-strings.txt" | sed 's/^/  语料行数：/'

echo '完成。现在可执行：'
echo "  docker run --rm -v $HERE:/work -v /opt/owndsh/src:/opt/owndsh/src:ro \\"
       -v /opt/owndsh:/opt/owndsh:ro -v /opt/owndsh/docs-assets:/opt/owndsh/docs-assets:ro \\"
       -e OWNDSH_DEPLOY_ROOT=/opt/owndsh -w /work node:24-alpine node build-help.mjs"
