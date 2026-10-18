#!/usr/bin/env bash
# 用法: wt.sh new <agent> <task> | rm <agent> <task> | ls
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cmd="${1:-}"; agent="${2:-}"; task="${3:-}"
case "$cmd" in
  new)
    [ -n "$agent" ] && [ -n "$task" ] || { echo "用法: wt.sh new <agent> <task>"; exit 1; }
    git -C "$root" worktree add "$root/.worktrees/$agent-$task" -b "$agent/$task" main
    echo "已创建: $root/.worktrees/$agent-$task (分支 $agent/$task)" ;;
  rm)
    [ -n "$agent" ] && [ -n "$task" ] || { echo "用法: wt.sh rm <agent> <task>"; exit 1; }
    git -C "$root" worktree remove "$root/.worktrees/$agent-$task"
    echo "已移除 worktree，分支 $agent/$task 保留" ;;
  ls) git -C "$root" worktree list ;;
  *) echo "用法: wt.sh new|rm|ls ..."; exit 1 ;;
esac
