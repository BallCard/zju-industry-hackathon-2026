#!/usr/bin/env bash
# 唯一的合入通道：在你的任务分支上运行。rebase 到最新 main -> 自检 -> 快进推送到 origin/main。
# 推送被拒(别人先合入) 就自动再 rebase 重试；冲突则停下，不替你硬解。
set -euo pipefail
. "$(dirname "$0")/_lib.sh"; need_origin
br="$(git rev-parse --abbrev-ref HEAD)"
[ "$br" != "main" ] && [ "$br" != "HEAD" ] || { echo "请在任务分支上运行"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "有未提交改动，先 commit"; exit 1; }
for i in 1 2 3 4 5; do
  git fetch -q origin
  git rebase origin/main || { echo "rebase 冲突：解决后 git rebase --continue 再重跑 ship.sh"; exit 1; }
  bash "$(dirname "$0")/check.sh"
  if SHIP=1 git push -q origin HEAD:main; then
    git push -q -f origin "HEAD:refs/heads/$br" 2>/dev/null || true   # 备份自己的分支，便于队友查看
    echo "已合入 origin/main ($(git rev-parse --short HEAD))"; exit 0
  fi
  echo "main 已前进，重试 $i/5 ..."; sleep 1
done
echo "多次重试仍失败，稍后再试或联系队友"; exit 1
