#!/bin/sh
# [INPUT]: 依赖已构建好的 plugin 工作区、baseline 制品 tgz，以及 ~/.dsh/profiles/* 下各 profile 的 package.json 与 pnpm-lock.yaml。
# [OUTPUT]: 把 dshent-plugin 重新打包为 baseline tgz、装机到每个 profile，并按 md5 校验两侧字节一致；或只做其中一段。
# [POS]: 本机"看真机"的标准入口。固化 pnpm 对 file: tarball 依赖的陈旧缓存陷阱，脚本可重复执行且结果一致。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

# ---------------------------------------------------------------------------
# 为什么需要这个脚本
#
# dshent-plugin 以 `file:...tgz` 形式被各 profile 安装。pnpm 会把这条 file: 依赖
# 按路径 + 摘要缓存进全局 store（~/Library/pnpm/store/v11/links）。换了 tgz 内容后，
# 只要 store 里那条链接还在，`pnpm install` 就会复用旧解包结果——安装命令成功退出，
# node_modules 字节数也不变，但装进去的仍是旧代码。
#
# 所以正确顺序是：先让 lockfile 不再认识 dshent-plugin（否则 pnpm 直接拿 lock 里的旧
# resolution 复原），再清掉 store 里的这条 file: 链接，最后 pnpm install --force 重装。
# 三步缺一，校验就会拿 md5 失败——这正是校验步骤存在的意义。
# ---------------------------------------------------------------------------

set -eu

# 仓库根：本脚本位于 <repo>/scripts/ 下
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
plugin_workspace="$project_root/plugin"

# 制品名与落点。pack:bundle 的 --pack-destination 指向 <repo>/artifacts。
bundle_name=dshent-plugin
bundle_version=0.1.0
bundle_file="$bundle_name-$bundle_version.tgz"
built_bundle="$project_root/artifacts/$bundle_file"

# baseline 是各 profile lockfile 里 file: specifier 指向的绝对位置，必须原地覆盖。
baseline_dir=${DSHENT_BASELINE_DIR:-/Users/limeng/DSH/DSH-ENT/baseline/pristine/artifacts}
baseline_bundle="$baseline_dir/$bundle_file"

# profile 根目录。每个子目录是一个独立 pnpm workspace（各有 package.json + pnpm-lock.yaml）。
profiles_root=${DSHENT_PROFILES_ROOT:-$HOME/.dsh/profiles}

# 要装机的 profile 名。默认桌面端与 Web 两个运行面。
profile_names=${DSHENT_PROFILES:-desktop web}

# 校验锚点：各 profile 装完后比对的那个文件。
verify_relative_path=lib/client.js

run_pack=true
run_install=true

usage() {
  cat <<EOF
用法: $0 [--pack] [--install] [--help]

  --pack      只重新打包 bundle 并覆盖 baseline 制品
  --install   只把 baseline 制品装机到各 profile（跳过打包）
  (都不给)    先打包，再装机，最后校验

环境变量:
  DSHENT_PROFILES          profile 名列表，空格分隔（默认: desktop web）
  DSHENT_PROFILES_ROOT     profile 根目录（默认: ~/.dsh/profiles）
  DSHENT_BASELINE_DIR      baseline 制品目录（默认见上方 DEFAULT）

只操作本项目的 artifacts、各 profile 的 dshent-plugin 条目与 pnpm store 对应条目；
不触碰其他依赖、不做 git 操作。
EOF
}

while [ $# -gt 0 ]; do
  case $1 in
    --pack) run_install=false ;;
    --install) run_pack=false ;;
    -h|--help) usage; exit 0 ;;
    *) printf '未知参数: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

# 统一的步骤标记 + 失败即退出。set -e 已保证异常终止，这里只负责说清卡在哪一步。
current_step=startup
fail() {
  printf '\n[FAIL] 卡在步骤: %s\n' "$current_step" >&2
  exit 1
}
trap 'fail' EXIT

step() {
  current_step=$1
  printf '\n=== [%s] %s ===\n' "$1" "$2"
}

# 文件 md5（macOS 用 md5 -q，GNU 用 md5sum -c 风格）
file_md5() {
  if command -v md5 >/dev/null 2>&1; then
    md5 -q "$1"
  else
    md5sum "$1" | cut -d' ' -f1
  fi
}

# ---------------------------------------------------------------------------
# 步骤 1：打包 bundle 并覆盖 baseline
# ---------------------------------------------------------------------------
if [ "$run_pack" = true ]; then
  step pack "构建并打包 $bundle_file"
  if [ ! -d "$plugin_workspace" ]; then
    printf '找不到插件工作区: %s\n' "$plugin_workspace" >&2
    fail
  fi
  # pack:bundle 会先 --filter dshent-plugin build，再 pack 到 ../artifacts。
  #
  # 必须先 cd 进 plugin/ 再跑：仓库根既没有 package.json 也没有 pnpm-workspace.yaml，
  # pnpm 11 跑任何子命令前会在 cwd 做一次依赖状态检查（runDepsStatusCheck），cwd 不是
  # workspace 成员就以 ERR_PNPM_NO_PKG_MANIFEST 确定性失败——与网络无关。
  ( cd "$plugin_workspace" && pnpm run pack:bundle )
  [ -f "$built_bundle" ] || { printf '打包产物缺失: %s\n' "$built_bundle" >&2; fail; }

  # 覆盖前留一份带时间戳的备份，误覆盖时可回退；不删除既有备份。
  if [ -f "$baseline_bundle" ]; then
    backup="$baseline_bundle.bak-$(date +%Y%m%d-%H%M%S)"
    cp -p "$baseline_bundle" "$backup"
    printf '已备份原 baseline 制品: %s\n' "$backup"
  fi
  mkdir -p "$baseline_dir"
  cp "$built_bundle" "$baseline_bundle"
  printf 'baseline 制品已更新: %s (%s 字节)\n' "$baseline_bundle" "$(wc -c < "$baseline_bundle" | tr -d ' ')"
else
  printf '[skip] 打包（--install）\n'
fi

# 装机或校验都需要 baseline 制品存在。
[ -f "$baseline_bundle" ] || { printf '缺少 baseline 制品: %s\n' "$baseline_bundle" >&2; fail; }

# ---------------------------------------------------------------------------
# 步骤 2：解包 baseline，取出校验锚点
#
# 不直接信任 node_modules 里任何东西，而是从 tgz 解出 lib/client.js 作为"应该是
# 什么"的唯一真值，最后让各 profile 与它逐字节比对。
# ---------------------------------------------------------------------------
step verify-source "从 baseline 制品解出校验锚点 $verify_relative_path"
verify_tmp=$(mktemp -d)
cleanup() { rm -rf "$verify_tmp"; }
trap 'cleanup; fail' EXIT
tar -xzf "$baseline_bundle" -C "$verify_tmp"

expected_file=$(find "$verify_tmp/package" -type f -path "*/$verify_relative_path" | head -n 1)
[ -n "$expected_file" ] || { printf '制品内找不到 %s\n' "$verify_relative_path" >&2; fail; }
expected_md5=$(file_md5 "$expected_file")
expected_size=$(wc -c < "$expected_file" | tr -d ' ')
printf '期望锚点: md5=%s 字节=%s\n' "$expected_md5" "$expected_size"

# ---------------------------------------------------------------------------
# 步骤 3：逐 profile 装机
# ---------------------------------------------------------------------------
# 按缩进删除 lockfile 中所有 dshent-plugin 块。
#
# 为什么必须按缩进而不能用正则逐行删：pnpm-lock.yaml 里同一条依赖以三种形态出现，
# 且各自的缩进层级不同——
#   importers.<name>.dependencies 下  6 空格 + 键 + 其下 specifier/version
#   packages 段                     2 空格 + 键 + 其下 resolution/version/peerDependencies
#   snapshots 段                    2 空格 + 键（含 peer 后缀）+ 其下 dependencies
# 键名本身还带 file: 路径与 peer 后缀，例如
#   dshent-plugin@file:../../../...tgz(dcfa966dcb692457f1c085462b4d88a6)
#   dshent-plugin@file:../../../...tgz(@deepseek-ai/schemastery@3.18.4)
# 后缀形态按 profile 而异，逐行正则极易漏删。通用做法是：命中首行后，连同所有
# 缩进更深的续行一起删，直到遇到同级或更浅缩进的行。
#
# 写成 awk 规则：把锚点行的缩进宽度记下来，后续更深的行一并丢弃。
strip_lockfile_blocks() {
  lock_path=$1
  tmp_path="$lock_path.strip.$$"
  awk -v anchor="$bundle_name" '
    # 命中形如 "<缩进><键>: " 的顶层块首行，且键属于目标包
    match($0, /^[ ]*[^ ]/) {
      indent = RLENGTH - 1
      line = $0
      sub(/^[ ]*/, "", line)
      # 块首行键名匹配目标包本体（`dshent-plugin:`）或带 peer 后缀的
      # `dshent-plugin@...` 形式
      if (index(line, anchor "@") == 1 || line == anchor ":") {
        in_block = 1
        drop_indent = indent
        next
      }
    }
    # 处在被删块内、且缩进更深 ⇒ 续行，一并丢弃
    in_block && indent > drop_indent { next }
    # 更浅或同缩进 ⇒ 块结束，恢复输出
    { in_block = 0; print }
  ' "$lock_path" > "$tmp_path"
  mv "$tmp_path" "$lock_path"
}

install_into_profile() {
  profile_dir=$1
  profile_name=$(basename "$profile_dir")

  step "profile:$profile_name" "装机到 $profile_dir"
  [ -d "$profile_dir" ] || { printf 'profile 不存在: %s\n' "$profile_dir" >&2; fail; }
  lock_path="$profile_dir/pnpm-lock.yaml"
  [ -f "$lock_path" ] || { printf '缺少 lockfile: %s\n' "$lock_path" >&2; fail; }

  # (1) 清掉已安装的包本体与 .pnpm 里的实例
  rm -rf "$profile_dir/node_modules/dshent-plugin"
  if [ -d "$profile_dir/node_modules/.pnpm" ]; then
    find "$profile_dir/node_modules/.pnpm" -maxdepth 1 -name 'dshent-plugin*' -exec rm -rf {} +
  fi

  # (2) 让 lockfile 不再认识这个包（否则 pnpm 直接按旧 resolution 复原旧内容）
  cp -p "$lock_path" "$lock_path.bak-$(date +%Y%m%d-%H%M%S)"
  strip_lockfile_blocks "$lock_path"
  if grep -q "$bundle_name" "$lock_path"; then
    printf 'lockfile 中仍残留 %s 条目，块删除未生效\n' "$bundle_name" >&2
    grep -n "$bundle_name" "$lock_path" >&2
    fail
  fi
  printf 'lockfile 已移除 %s 全部块\n' "$bundle_name"

  # (3) 清 pnpm store 里这条 file: 依赖的链接
  #
  # store 链接目录名是 tarball 绝对路径把非字母数字换成 '+' 的形式，例如
  #   file+..+..+..+..+..+Users+limeng+DSH+DSH-ENT+baseline+pristine+artifacts+dshent-plugin-0.1.0.tgz
  # 只删名字里含本项目 tgz 的条目，不动其他包。
  store_links=$(pnpm store path 2>/dev/null || true)
  if [ -n "$store_links" ] && [ -d "$store_links/links" ]; then
    stale=$(find "$store_links/links" -maxdepth 1 -name "*${bundle_name}-${bundle_version}.tgz*" | tr '\n' ' ')
    for entry in $stale; do
      rm -rf "$entry"
      printf '已清理 store 链接: %s\n' "$(basename "$entry")"
    done
  else
    printf '未找到 pnpm store links 目录，跳过（不影响正确性）\n'
  fi

  # (4) 归一化 allowBuilds
  #
  # pnpm 11 在 allowBuilds 出现未决占位（值为 "set this to true or false"）时，
  # 会以 ERR_PNPM_IGNORED_BUILDS 让整条 install 失败退出。web profile 曾经就是这副
  # 样子：@google/genai 与 protobufjs 两项都没决定，desktop profile 则已把
  # protobufjs 明确设为 true。这里把未决项显式改为 false——本插件的依赖树不需要
  # 这两个包的构建产物，拒绝执行它们既让安装可继续，也与 plugin 工作区的
  # allowBuilds 策略一致（esbuild 之外一律拒绝）。已有明确决定的项不动。
  workspace_config="$profile_dir/pnpm-workspace.yaml"
  if [ -f "$workspace_config" ] && grep -q 'set this to true or false' "$workspace_config"; then
    sed 's/: *set this to true or false/: false/' "$workspace_config" > "$workspace_config.tmp.$$"
    mv "$workspace_config.tmp.$$" "$workspace_config"
    printf '已把 %s 中未决的 allowBuilds 项置为 false\n' "$workspace_config"
  fi

  # (5) 强制重装，让 pnpm 按新 tgz 重新解析
  ( cd "$profile_dir" && pnpm install --force )

  # (6) 校验：装出来的文件必须与 baseline 解包结果 md5 一致
  installed_file="$profile_dir/node_modules/$bundle_name/$verify_relative_path"
  [ -f "$installed_file" ] || { printf '装机后缺少 %s\n' "$installed_file" >&2; fail; }
  actual_md5=$(file_md5 "$installed_file")
  actual_size=$(wc -c < "$installed_file" | tr -d ' ')
  if [ "$actual_md5" != "$expected_md5" ]; then
    printf '校验失败 %s: md5 %s != 期望 %s（字节 %s != %s）\n' \
      "$profile_name" "$actual_md5" "$expected_md5" "$actual_size" "$expected_size" >&2
    fail
  fi
  printf '校验通过 %s: md5=%s 字节=%s\n' "$profile_name" "$actual_md5" "$actual_size"
}

if [ "$run_install" = true ]; then
  for profile_name in $profile_names; do
    install_into_profile "$profiles_root/$profile_name"
  done
else
  printf '[skip] 装机（--pack）\n'
fi

step done '全部完成'
trap - EXIT
cleanup
exit 0
