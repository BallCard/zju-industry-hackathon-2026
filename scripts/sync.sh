#!/usr/bin/env bash
# 把当前分支 rebase 到最新 origin/main。开工前、做到一半发现别人合入时都可以跑。
set -euo pipefail
. "$(dirname "$0")/_lib.sh"; need_origin
[ -z "$(git status --porcelain)" ] || { echo "有未提交改动，先 commit"; exit 1; }
git fetch -q origin
git rebase origin/main || { echo "有冲突：解决后 git rebase --continue；解决不了 git rebase --abort 并去 docs/tasks 留言"; exit 1; }
