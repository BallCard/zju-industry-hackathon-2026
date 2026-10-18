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
按用户确认的新发布要求，原 v7 知识库随项目提供，位于 `apps/pc-studio/data/kb/`，包括已获授权的 P4 目录；克隆后可直接用本地模式，无需额外下载知识库或配置 ima 凭证。根目录 `data/kb/` 仅保留为忽略的临时副本路径。API Key、Client ID 等凭证仍不得入库。

## 安装与运行
待技术栈确定后补充。**提交前确认仓库内无任何密钥。**

## 已集成的可运行版本：PC Studio

独立可运行的参赛作品代码已放入 **[apps/pc-studio/](apps/pc-studio/)**，没有覆盖团队按 `OWNERS` 划分的 `src/ima`、`src/agent`、`src/verify`、`src/app` 车道。该实现是当前可运行原型；后续各车道可按 `docs/contracts/` 渐进合并。

**运行（Node.js 20+、无需 npm 第三方依赖）**：

```bash
cd apps/pc-studio
npm start
```

浏览器访问 `http://127.0.0.1:8765`。测试：`npm run check && npm test`。型号清单、原 v7 知识库文档和图片随源码提供；本地模式默认读取 `apps/pc-studio/data/kb/`，也可通过 `LOCAL_KB_ROOT` 指向其他副本。根目录 Dockerfile 按部署参考仅复制 `models.json`，不把本地知识库和图片打进镜像；云端正式演示需要配置 ima 凭证并使用 `DEFAULT_DATA_MODE=live`。服务器绝不向前端返回凭证。

### 从仓库根目录部署

`Dockerfile`、`.dockerignore` 和 `ms_deploy.json` 已放在本 GitHub 仓库根目录，应用源码仍保留在 `apps/pc-studio/`。Docker / 魔搭的构建上下文请选仓库根目录：

```bash
docker build -t pc-studio .
docker run --rm -p 7860:7860 pc-studio
```

根目录 Dockerfile 按部署参考仅复制 `models.json`、后端、前端和系统提示词，不复制本地知识库、图片、密钥或 Git 历史。因此容器默认 local 模式只能展示型号清单，正式运行请按根目录 `.env.example` 配置 ima 凭证并使用 `DEFAULT_DATA_MODE=live`。运行时可使用 `docker run --rm -p 7860:7860 --env-file .env -e DEFAULT_DATA_MODE=live pc-studio`，或在魔搭平台 Secrets 中配置。

- [应用说明和部署步骤](apps/pc-studio/README.md)
- [作品说明书](apps/pc-studio/docs/作品说明书.md)
- [真实 ima 已执行的历史验收结果](apps/pc-studio/docs/真实IMA验收.md)
- [多任务实例（明确标注本地开发演示）](apps/pc-studio/examples/)

**参赛提交状态**：GitHub 源码与已有真实 ima 验证记录已准备；魔搭空间链接、公开可访问性与视频须单独验证，不应宣称完成。GitHub 仓库若为 Private，须由管理员处理对评委的公开访问。
