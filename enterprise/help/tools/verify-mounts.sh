#!/bin/sh
# [INPUT]: 依赖运行中的 console 容器与宿主上的 dist 目录。
# [OUTPUT]: 断言每个 bind mount 源在容器内可见且非空（产品官网 / 帮助中心 / API 文档）——用于发现"源目录被整体删除导致的陈旧挂载"。
# [POS]: 文档门户上线/更新后的自检脚本；这类故障在宿主侧完全看不出来（宿主有文件、容器内是空的）。
# [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md 附录 C
set -e

CONTAINER=${OWNDSH_CONSOLE_CONTAINER:-src-console-1}
status=0

check() {
  target=$1
  probe=$2
  if docker exec -u 101 "$CONTAINER" test -e "$target/$probe" 2>/dev/null; then
    count=$(docker exec -u 101 "$CONTAINER" sh -c "ls -A '$target' | wc -l" 2>/dev/null)
    echo "  ✅ $target 可见（$count 个条目）"
  else
    echo "  ❌ $target 在容器内不可见或为空 —— bind mount 可能陈旧"
    echo "     修复：docker restart $CONTAINER 即可重新挂载；"
    echo "           若仍为空则 docker compose up -d --force-recreate --no-deps console"
    status=1
  fi
}

echo "检查 console 容器内的文档挂载点（$CONTAINER）："
check /usr/share/nginx/html/api-docs enterprise-openapi.json
check /usr/share/nginx/html/help index.html
check /usr/share/nginx/html/home index.html
exit $status
