# AI+华为PC营销软文智能体

华为·产业进阶赛道（浙大 AI+X 破界黑客松）参赛作品。输入「产品 + 人群 + 场景 + 平台」，自研 Agent 从 ima 共享知识库检索华为 PC 事实与图片，完成：场景解析 → 平台策略 → 资料/图片检索 → 事实点提取 → 图文编排 → 软文生成 → 事实与图片核验 → 合规检查 → 导出。

## 给谁用 / 怎么用 / 解决什么
门店导购与内容运营：选型号、人群、场景、平台，得到有知识库依据、图片型号一致、通过合规检查的公众号 / 小红书 / 朋友圈 / 海报图文。解决资料分散、型号易混、场景不准、平台不适配、图文错配、合规风险。

## 文档
- 题目与要求：[docs/PROBLEM.md](docs/PROBLEM.md) · 评分与自检：[docs/RUBRIC.md](docs/RUBRIC.md)
- 协作规则（agent 必读）：[AGENTS.md](AGENTS.md) · 机制：[docs/COLLABORATION.md](docs/COLLABORATION.md)
- 车道：[OWNERS](OWNERS) · 任务：`bash scripts/task.sh ls` · 接口契约：[docs/contracts/](docs/contracts/README.md)
- 决策：[docs/DECISIONS.md](docs/DECISIONS.md) · 时间线：[docs/TIMELINE.md](docs/TIMELINE.md)

## 环境准备
```bash
bash scripts/setup.sh <你的名字>        # 一次：启用 hooks 与 owner
bash scripts/fetch-ima-skill.sh        # 获取官方 ima skill 到 vendor/（不入库）
cp .env.example .env                   # 填入你自己的 ima Client ID / API Key 与 LLM key；.env 不入库
```
知识库本地副本放 `data/kb/`（从队内共享获取，不入库、不外传）。

## 安装与运行
待技术栈确定后补充。**提交前确认仓库内无任何密钥。**
