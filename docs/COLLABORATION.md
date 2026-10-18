# 协作流程速查

```
主目录（main，只由集成者合入）
.worktrees/<agent>-<task>/   每个 agent 一个独立工作目录和分支
```

## 一个任务的完整流程
```bash
bash scripts/wt.sh new a1 login-page     # 建 .worktrees/a1-login-page，分支 a1/login-page
cd .worktrees/a1-login-page              # 在这里开发、小步提交
git rebase main                          # 合入前同步 main，解决冲突并自测
cd ../..                                 # 回主目录
bash scripts/land.sh a1/login-page       # ff-only 合入 main
bash scripts/wt.sh rm a1 login-page      # 清理 worktree（分支保留，删除需授权）
```

## 冲突处理
- 冲突在自己的分支上解决（rebase），不要在 main 上解。
- 公共文件冲突：保留双方意图，不确定就问对方 agent 或记入 DECISIONS 待定项。

## 为什么用 worktree
多个 agent 共用一个目录会互相覆盖未提交改动、抢占分支。每人独立目录 + 独立分支，合并时才相遇。

## 远端（如需）
用户授权后：`gh repo create <name> --private --source . --remote origin`，再 `git push -u origin main`。其余分支按需推送，不 force push。
