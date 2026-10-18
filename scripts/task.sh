#!/usr/bin/env bash
# 任务 = docs/tasks/<id>.md（一任务一文件，避免表格冲突）。认领通过推送 main 实现原子占位。
# 用法: task.sh new <id> "<标题>" [路径前缀]  | claim <id> | done <id> | ls
set -euo pipefail
. "$(dirname "$0")/_lib.sh"
cmd="${1:-}"; id="${2:-}"; f="docs/tasks/$id.md"
field() { sed -n "s/^$2: *//p" "$root/$1" | head -1; }
setf() { sed -i "s|^$2:.*|$2: $3|" "$root/$1"; }
# 在主检出目录里提交并推送一个只含 docs/tasks 的小提交
publish() {
  need_origin
  [ "$(git -C "$root" rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "主目录 $root 必须停在 main（它是只读座位，别在里面开发）"; exit 1; }
  git -C "$root" add docs/tasks
  git -C "$root" commit -q -m "$1"
  SHIP=1 git -C "$root" push -q origin HEAD:main
}
fresh() { need_origin; git -C "$root" pull -q --rebase origin main; }
case "$cmd" in
  new) need_me; [ -n "${3:-}" ] || { echo '用法: task.sh new <id> "<标题>" [路径前缀]'; exit 1; }
       fresh; [ ! -e "$root/$f" ] || { echo "$id 已存在"; exit 1; }
       printf -- '---\nid: %s\ntitle: %s\nowner:\nstatus: todo\npaths: %s\n---\n\n## 目标（给谁用、解决什么）\n\n## 接口/依赖（引用 docs/contracts）\n\n## 进展笔记（agent 在这里留言，勿删他人内容）\n' "$id" "$3" "${4:-}" > "$root/$f"
       publish "docs(task): new $id" && echo "已创建 $id" ;;
  claim) need_me; fresh; [ -e "$root/$f" ] || { echo "无此任务"; exit 1; }
       o="$(field "$f" owner)"
       [ -z "$o" ] || [ "$o" = "$me" ] || { echo "$id 已被 $o 认领"; exit 1; }
       setf "$f" owner "$me"; setf "$f" status doing
       if publish "docs(task): $me claims $id"; then echo "已认领 $id"
       else git -C "$root" reset -q --hard origin/main; echo "认领冲突（别人先动了），重新运行 claim"; exit 1; fi ;;
  done) need_me; fresh; setf "$f" status done; publish "docs(task): $id done" && echo "已完成 $id" ;;
  ls)  need_origin; git -C "$root" fetch -q origin; git -C "$root" ls-tree --name-only origin/main docs/tasks/ | while read -r p; do
         t="$(git -C "$root" show "origin/main:$p")"
         printf '%-8s %-6s %-8s %s\n' "$(sed -n 's/^id: *//p' <<<"$t")" "$(sed -n 's/^status: *//p' <<<"$t")" "$(sed -n 's/^owner: *//p' <<<"$t")" "$(sed -n 's/^title: *//p' <<<"$t")"
       done ;;
  *) echo "用法: task.sh new|claim|done|ls ..."; exit 1 ;;
esac
