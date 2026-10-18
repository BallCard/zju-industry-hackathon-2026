# 多人多 Agent 协作规则

场景：几个人各在自己的机器上，各带自己的 agent，通过同一个 GitHub 远端协作。目标是 agent 之间互不干扰：**各走各的车道，用契约对接，只通过 ship.sh 合入 main。**

## 五条铁律
1. **一任务一文件**：任务在 `docs/tasks/<id>.md`，认领用 `scripts/task.sh claim`（推送成功才算占到，被拒说明别人先占了）。不改别人已认领的任务。
2. **一 agent 一 worktree 一分支**：用 `scripts/wt.sh new <task> [agent]`。主检出目录只读，不在里面开发；同一目录不要同时跑两个 agent。
3. **车道隔离**：`OWNERS` 规定目录归谁。pre-commit hook 会拦截越界提交。需要别人的目录改动，在对方任务文件“进展笔记”留言，不要自己改。
4. **契约先行**：跨车道接口写进 `docs/contracts/` 并先合入；依赖未完成的部分用契约里的样例数据 mock。
5. **唯一合入通道**：`scripts/ship.sh`（rebase 到最新 main → 自检 → 快进推送）。不直接推 main，不 force push main，不 `reset --hard` 他人分支。

## 开工流程（每个 agent）
```bash
bash scripts/setup.sh <owner名>           # 本机一次；owner 与 OWNERS 一致
git pull --rebase origin main             # 在主目录同步，读 PROBLEM / OWNERS / contracts
bash scripts/task.sh ls                   # 看谁在做什么
bash scripts/task.sh claim T3             # 认领；失败就换一个
bash scripts/wt.sh new T3 [agent]         # 建 worktree，cd 进去
# 开发：小步提交，type(scope): 摘要
bash scripts/sync.sh                      # 间歇性 rebase 到最新 main
bash scripts/ship.sh                      # 合入 main
bash scripts/task.sh done T3
```

## 提交与分支
- 分支 `<owner>/<task>[-<agent>]`，短命，合入后可保留或删除（删除需用户同意）。
- 提交信息 `feat|fix|docs|chore|refactor|test(scope): 摘要`。小而频繁，每次 ship 前 main 必须仍可运行。
- 公共文件（依赖清单、锁文件、路由表、全局样式）改动要小、要快 ship；锁文件冲突时重新生成，不手改。
- 冲突在自己分支上解决（rebase）。解决不了就 `git rebase --abort`，在任务文件留言求助，不要硬改对方代码。

## agent 行为准则
- 只做认领任务范围内的事；发现范围外问题，写进任务笔记或新建任务，不顺手改。
- 开始前读 `docs/PROBLEM.md`、`OWNERS`、`docs/contracts/`、`docs/DECISIONS.md`；做完把对队友有用的信息（接口变化、坑、运行方式）写入任务笔记或契约。
- 不提交密钥和 `.env`；变量名写进 `.env.example`。
- 产品方向、技术栈等需要共识的事记到 `docs/DECISIONS.md`，不自行拍板。
- 每个功能能回答：给谁用、怎么用、解决什么实际问题（评审口径）。

## 边界
建远端、推送到远端、删除分支或目录、对 main 做破坏性操作，需用户明确授权。

## 本赛题的硬规则（所有 agent 必读）
- 题目与最低要求：`docs/PROBLEM.md`；评分与自检：`docs/RUBRIC.md`；接口：`docs/contracts/`（C1 ima 访问、C2 Agent 输入输出、C3 知识库结构）。
- **凭证零泄露**：不得把 API Key / Client ID / 知识库 ID 写进代码、日志、README、测试夹具、截图、提交信息。只读环境变量。pre-commit 会拦，但别依赖它。
- **事实只来自知识库**：不凭记忆补参数、价格、补贴、库存、销量、奖项、评价；没有依据就删除或写入“待确认”。
- **图片只来自知识库**且型号必须与文案型号一致，用 `图片索引.csv` 登记的文件。
- 不照抄 `P6/11-完整软文成稿库` 等案例成稿；可学结构与规则，不可复制。
- `data/kb/`、`data/ref/`、`vendor/ima-skill/` 不入库。运行测试用 `KB_BACKEND=local`；最终演示/评测用 `KB_BACKEND=ima`。
- Demo/截图/视频前先确认画面里没有密钥与完整 kb_id。
