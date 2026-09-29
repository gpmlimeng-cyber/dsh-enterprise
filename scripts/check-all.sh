#!/bin/sh
# [INPUT]: 依赖 docker compose、node、可选 java/mvnw 与 enterprise 站点构建脚本。
# [OUTPUT]: 依次执行 compose 拓扑校验、日志扫描器自测、三站 --check（可跳过），FULL=1 时追加后端测试与 console check。
# [POS]: 提交前本地门禁入口；与 CI 的 server-check/console-check 语义对齐，但默认不跑重型集成测试。
# [PROTOCOL]: 变更时更新此头部，然后检查 FORK.md / docs/compose/spec/p0-ci-and-legacy-gates.md
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FULL="${FULL:-0}"
SKIP_SITES="${SKIP_SITES:-0}"
FAILED=0

step() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  FAILED=1
}

# ── 1. compose 拓扑 ──────────────────────────────────────────────
step "docker compose config"
if [ ! -f .env ]; then
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT
  cat >"$tmpdir/.env" <<EOF
SA_TOKEN_JWT_SECRET_KEY=dummy-jwt-for-compose-config-only-0000000000000000
ENT_MASTER_KEY=dummy-master-key-for-compose-config-only-00000000
ENT_BOOTSTRAP_ADMIN_PASSWORD=dummy
ENT_POSTGRES_PASSWORD=dummy
ENT_REDIS_PASSWORD=dummy
EOF
  # compose 读取项目根 .env；用 env 前缀注入而不写仓库 .env
  set +e
  env $(grep -E '^[A-Z]' "$tmpdir/.env" | xargs) docker compose config >/dev/null
  rc=$?
  set -e
  rm -rf "$tmpdir"
  trap - EXIT
else
  set +e
  docker compose config >/dev/null
  rc=$?
  set -e
fi
if [ "$rc" -ne 0 ]; then
  fail "docker compose config"
else
  echo "ok"
fi

# ── 2. 密钥扫描器自测 ────────────────────────────────────────────
step "scan-sensitive-logs self-test"
if node scripts/scan-sensitive-logs.test.mjs; then
  echo "ok"
else
  fail "scan-sensitive-logs.test.mjs"
fi

# ── 3. 三站门禁（缺资产可跳过） ─────────────────────────────────
if [ "$SKIP_SITES" != "1" ]; then
  step "site --check"
  set +e
  (
    cd enterprise/site
    OWNDSH_DOCS_ASSETS=../docs-assets \
      OWNDSH_UPSTREAM_ASSETS="$ROOT/website/assets" \
      OWNDSH_SITE_BASE=/home/ \
      node build.mjs --check
  )
  rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    fail "site --check"
  else
    echo "ok"
  fi

  step "help --check"
  set +e
  (
    cd enterprise/help
    OWNDSH_DOCS_ASSETS=../docs-assets \
      OWNDSH_SRC_ROOT="$ROOT" \
      OWNDSH_DEPLOY_ROOT="$ROOT/enterprise" \
      node build-help.mjs --check
  )
  rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    fail "help --check"
  else
    echo "ok"
  fi

  step "api-docs --check"
  set +e
  (
    cd enterprise/api-docs
    OWNDSH_SRC_ROOT="$ROOT" node build-docs.mjs --check
  )
  rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    fail "api-docs --check"
  else
    echo "ok"
  fi
else
  echo ""
  echo "==> SKIP_SITES=1，跳过三站 --check"
fi

# ── 4. FULL：与 CI 对齐的重型检查 ────────────────────────────────
if [ "$FULL" = "1" ]; then
  step "FULL: server tests"
  set +e
  (
    cd server
    ./mvnw -B -ntp -pl owndsh-modules/owndsh-enterprise,owndsh-server -am test \
      -Dmaven.test.skip=false -DskipTests=false
  )
  rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    fail "server tests"
  else
    echo "ok"
  fi

  step "FULL: console check"
  set +e
  pnpm --dir console run check
  rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    fail "console check"
  else
    echo "ok"
  fi
else
  echo ""
  echo "==> 默认模式不含 mvn/console；需要时 FULL=1 sh scripts/check-all.sh"
fi

printf '\n'
if [ "$FAILED" -ne 0 ]; then
  echo "check-all: FAILED"
  exit 1
fi
echo "check-all: OK"
