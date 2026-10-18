#!/usr/bin/env bash
# 每个人/每台机器 clone 后运行一次: bash scripts/setup.sh <你的名字>
set -euo pipefail
name="${1:-}"; [ -n "$name" ] || { echo "用法: setup.sh <name>  (与 OWNERS 里的名字一致，小写英文)"; exit 1; }
git config core.hooksPath .githooks
git config hack.owner "$name"
git config pull.rebase true
git config rerere.enabled true
echo "OK owner=$name hooks=.githooks  (同一机器上的所有 worktree 共享此配置)"
