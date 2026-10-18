# 协作机制说明（为什么这样设计）

| 风险 | 机制 |
| --- | --- |
| 两个 agent 抢同一任务 | `task.sh claim` 把认领写进 main 并推送；Git 拒绝非快进推送，天然原子 |
| 任务表合并冲突 | 一任务一文件，不用共享表格 |
| 改到别人的目录 | `OWNERS` + pre-commit 拦截（需 `scripts/setup.sh`；`LANE_OVERRIDE=1` 可临时越界） |
| 同机多 agent 互相覆盖 | 每个 agent 独立 worktree + 分支 |
| 接口对不上 | `docs/contracts/` 先约定、带样例，实现方可 mock |
| main 被推坏/被改写 | pre-push 只放行 `ship.sh`；ship 前强制 rebase + 自检；远端建议开分支保护（禁止 force push） |
| 多人同时合入 | ship.sh 推送被拒就自动 rebase 重试；冲突则停下报告 |

## 现场（初赛 13:00 前）建议做完
1. 创建 GitHub 私有仓库并邀请队友（需用户授权），推送 `main`。
2. 每人 clone 后运行 `bash scripts/setup.sh <名字>`。
3. 发题后：填 `docs/PROBLEM.md` → 定技术栈记入 DECISIONS → 改 `OWNERS` 分车道 → 在 `docs/contracts/` 约定接口 → `task.sh new` 拆任务 → 并行开工。
4. 技术栈确定后写 `scripts/check.local.sh`（lint/build/test，保持几十秒内）。

## 推荐车道划分思路
按“能独立运行的一块”切：例如 `src/backend/`、`src/frontend/`、`src/data/`（Demo 数据/模型）、`docs/pitch/`（路演材料）。每人一至两个车道；agent 数量多时按任务而非按目录扩展，车道不重叠即可。
