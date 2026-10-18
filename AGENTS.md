# 多 Agent 协作规则（比赛期间，规则从简）

目标：初赛 4 小时内做出可演示的 60% 完成度，之后复赛完善、决赛路演。速度优先，但不互相踩脚。

## 开工前（每个 agent 必做）
1. 读 `docs/PROBLEM.md`（题目与用户）、`docs/TASKS.md`（任务板）、`docs/DECISIONS.md`（已定决策）。
2. 在 `docs/TASKS.md` 认领一个任务：写上自己的名字和分支，提交到 main 后再动手（认领即占位）。
3. 用 `scripts/wt.sh new <name> <task>` 建自己的 worktree，只在其中工作。不在主目录直接改代码。

## 目录所有权（避免冲突）
- 一个任务尽量只动一个目录；跨目录改动先在 TASKS.md 备注。
- 公共文件（`package.json`、锁文件、路由表、全局样式、`docs/DECISIONS.md`）改动要小、要快合并，并在提交信息里写明。
- 目录划分在 `docs/TASKS.md` 顶部的“模块与所有者”表里维护。

## Git 约定
- 分支：`<agent>/<task>`，如 `a1/login-page`。短命，一个任务一个分支。
- 提交：`type(scope): 摘要`，type 取 feat / fix / docs / chore / refactor / test；小步提交，能跑再提。
- 合入：先 `git rebase main`，解决冲突并自测，再由集成者运行 `scripts/land.sh <branch>`（只做 fast-forward）。
- 禁止：force push、`reset --hard` 他人分支、直接在 main 上写功能、提交密钥或 `.env`。
- main 必须随时可运行、可演示。坏了先 revert，再修。

## 对外与评审口径
每个功能都要能回答：给谁用、怎么用、解决什么实际问题。写 README / Demo 时按 `docs/PROBLEM.md` 的结构对应，不堆技术名词。

## 边界
推送远端、发布、删除分支或目录需用户明确授权。不确定的产品方向写进 `docs/DECISIONS.md` 待定项，而不是各自拍板。
