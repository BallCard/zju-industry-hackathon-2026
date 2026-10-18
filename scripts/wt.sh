#!/usr/bin/env bash
# 用法: wt.sh new <task> [agent] | rm <task> [agent] | ls
# 每个 agent 一个 worktree + 一个分支: <owner>/<task>[-<agent>]。同一任务不要两个 agent 共用目录。
set -euo pipefail
. "$(dirname "$0")/_lib.sh"
cmd="${1:-}"; task="${2:-}"; agent="${3:-}"
suffix=""; [ -n "$agent" ] && suffix="-$agent"
name="$me-$task$suffix"; branch="$me/$task$suffix"
case "$cmd" in
  new) need_me; [ -n "$task" ] || { echo "用法: wt.sh new <task> [agent]"; exit 1; }
       base=main
       if git remote get-url origin >/dev/null 2>&1; then git fetch -q origin; base=origin/main; fi
       git -C "$root" worktree add --no-track "$root/.worktrees/$name" -b "$branch" "$base"
       echo "目录: $root/.worktrees/$name  分支: $branch  (cd 进去开工)" ;;
  rm)  need_me; git -C "$root" worktree remove "$root/.worktrees/$name"; echo "已移除，分支 $branch 保留" ;;
  ls)  git -C "$root" worktree list ;;
  *)   echo "用法: wt.sh new|rm|ls ..."; exit 1 ;;
esac
