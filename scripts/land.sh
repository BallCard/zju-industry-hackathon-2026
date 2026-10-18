#!/usr/bin/env bash
# 用法: land.sh <branch>  在主目录（main）运行；只做 fast-forward，要求分支已 rebase 到 main
set -euo pipefail
branch="${1:?用法: land.sh <branch>}"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "请在主目录的 main 上运行"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "main 有未提交改动，先处理"; exit 1; }
git merge --ff-only "$branch" || { echo "无法 ff：请在该分支执行 git rebase main 后重试"; exit 1; }
echo "已合入 $branch -> main"
