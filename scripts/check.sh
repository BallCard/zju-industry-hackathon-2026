#!/usr/bin/env bash
# 合入前自检。技术栈确定后，在 scripts/check.local.sh 里写 lint/build/test 命令（共享，保持很快）。
set -euo pipefail
d="$(dirname "$0")"
if [ -f "$d/check.local.sh" ]; then bash "$d/check.local.sh"; else echo "(尚未配置检查：scripts/check.local.sh)"; fi
