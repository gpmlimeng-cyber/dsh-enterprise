#!/bin/sh
# [INPUT]: 依赖 openssl 与仓库根目录可写。
# [OUTPUT]: 向 .env 写入 SA_TOKEN_JWT_SECRET_KEY / ENT_MASTER_KEY 等本地密钥（不覆盖已有非空值）。
# [POS]: 本地与受控环境起栈前的密钥生成入口；生产请用密码管理器分发，勿把 .env 提交进仓。
# [PROTOCOL]: 变更时更新此头部，然后检查 FORK.md §5
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
EXAMPLE="${ROOT}/.env.example"

rand() {
  # 64 hex chars = 32 bytes
  openssl rand -hex 32
}

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE" ]; then
    cp "$EXAMPLE" "$ENV_FILE"
  else
    : >"$ENV_FILE"
  fi
  echo "created ${ENV_FILE} from .env.example"
fi

set_if_empty() {
  key="$1"
  val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    current="$(sed -n "s/^${key}=//p" "$ENV_FILE" | head -n 1)"
    if [ -n "$current" ]; then
      echo "keep existing ${key}"
      return 0
    fi
  fi
  # replace empty assignment or append
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # portable in-place: rewrite file
    tmp="${ENV_FILE}.tmp.$$"
    awk -v k="$key" -v v="$val" 'BEGIN{done=0} $0 ~ "^"k"=" && !done {print k"="v; done=1; next} {print} END{if(!done) print k"="v}' \
      "$ENV_FILE" >"$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$val" >>"$ENV_FILE"
  fi
  echo "set ${key}"
}

JWT="$(rand)"
MASTER="$(rand)"
set_if_empty SA_TOKEN_JWT_SECRET_KEY "$JWT"
set_if_empty ENT_MASTER_KEY "$MASTER"

chmod 600 "$ENV_FILE" 2>/dev/null || true
echo "done. ensure DB/Redis passwords in .env are not the public examples before any non-local use."
