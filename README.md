# AI+华为PC营销软文智能体

华为·产业进阶赛道（浙大 AI+X 破界黑客松）参赛作品。输入「产品 + 人群 + 场景 + 平台」，自研 Agent 从 ima 共享知识库检索华为 PC 事实与图片，完成：场景解析 → 平台策略 → 资料/图片检索 → 事实点提取 → 图文编排 → 软文生成 → 事实与图片核验 → 合规检查 → 导出。

## 给谁用 / 怎么用 / 解决什么
门店导购与内容运营：选型号、人群、场景、平台，得到有知识库依据、图片型号一致、通过合规检查的公众号 / 小红书 / 朋友圈 / 海报图文。解决资料分散、型号易混、场景不准、平台不适配、图文错配、合规风险。

## 文档
- 题目与要求：[docs/PROBLEM.md](docs/PROBLEM.md) · 评分与自检：[docs/RUBRIC.md](docs/RUBRIC.md)
- 协作规则（agent 必读）：[AGENTS.md](AGENTS.md) · 机制：[docs/COLLABORATION.md](docs/COLLABORATION.md)
- 车道：[OWNERS](OWNERS) · 任务：`bash scripts/task.sh ls` · 接口契约：[docs/contracts/](docs/contracts/README.md)
- 项目记录：[docs/PROJECT.md](docs/PROJECT.md)

## 环境准备
```bash
bash scripts/setup.sh <你的名字>        # 一次：启用 hooks 与 owner
bash scripts/fetch-ima-skill.sh        # 获取官方 ima skill 到 vendor/（不入库）
cp .env.example .env                   # 填入你自己的 ima Client ID / API Key 与 LLM key；.env 不入库
```
知识库本地副本放 `data/kb/`（从队内共享获取，不入库、不外传）。

## 安装与运行
待技术栈确定后补充。**提交前确认仓库内无任何密钥。**

## 已集成的可运行版本：PC Studio

独立可运行的参赛作品代码已放入 **[apps/pc-studio/](apps/pc-studio/)**，没有覆盖团队按 `OWNERS` 划分的 `src/ima`、`src/agent`、`src/verify`、`src/app` 车道。该实现是当前可运行原型；后续各车道可按 `docs/contracts/` 渐进合并。

**运行（Node.js 20+、无需 npm 第三方依赖）**：

```bash
cd apps/pc-studio
npm start
```

浏览器访问 `http://127.0.0.1:8765`。测试：`npm run check && npm test`。产品型号清单随源码提供，但**不分发主办方知识库文档和图片**；本地模式使用本机 `data/kb/` 或环境变量 `LOCAL_KB_ROOT` 指向已获授权的知识库副本。默认 local 是开发模式，不代表完成真实 ima 检索。上线需通过服务器端环境变量配置 `IMA_OPENAPI_CLIENTID`、`IMA_OPENAPI_APIKEY`，启用 `DEFAULT_DATA_MODE=live` 后以赛事指定知识库做最终验收。服务器绝不向前端返回凭证。

- [应用说明和部署步骤](apps/pc-studio/README.md)
- [作品说明书](apps/pc-studio/docs/作品说明书.md)
- [真实 ima 已执行的历史验收结果](apps/pc-studio/docs/真实IMA验收.md)
- [多任务实例（明确标注本地开发演示）](apps/pc-studio/examples/)

**参赛提交状态**：GitHub 源码与已有真实 ima 验证记录已准备；魔搭空间链接、公开可访问性与视频须单独验证，不应宣称完成。GitHub 仓库若为 Private，须由管理员处理对评委的公开访问。
