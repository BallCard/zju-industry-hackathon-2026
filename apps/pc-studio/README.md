# PC Studio｜华为PC循证营销智能体

> 独立参赛项目：拓浙 AI 生态 × 华为中国区「AI+华为PC营销软文智能体」。非华为官方产品。

## 产品定位

不是ima网页问答套壳，而是“场景判断 → 策略规划 → ima证据检索 → 事实锁定 → 图文编排 → 安全复核 → 导出”的自研业务Agent。支持本地开发演示和ima官方接口两种数据模式；本地模式不能冒充赛事指定ima共享库。

## 核心功能

- 输入准确型号、人群、营销场景、购买阶段、内容目标、发布平台；缺资料时追问。
- 场景×阶段×临时需求的规则与意图加权决策。修改需求会重排卖点；可删除某个卖点。
- 指定ima知识库检索、目录回退及get_media_info原文获取；不足或失败即停止。
- 型号级事实引用与图片索引匹配；标注文件名、来源、插入位置。
- 公众号、小红书、门店朋友圈、门店海报的差异化篇章结构、图数和行动引导。
- 参数、图片型号和合规三类审核，禁止编造价格、补贴、实测、销量与不当竞品排名。
- 浏览执行轨迹；复制、导出Markdown及审计JSON；同款换场景/换平台对照运行。
- 可配置 OpenAI 兼容大模型 API 负责语言组织；最终数字及产品事实从证据直接插入，未通过模型安全检测会自动回退。

## 当前开发策略：优先本地，保留ima接口

2026-10-18 已完成四组真实ima端到端验证，但随后平台返回资料获取次数上限（220021）。**现将软件默认数据源改为 local**，即使本机已保存ima密钥，首次打开也不会自动触发在线资料读取。

本地v7仅用于开发，作品和导出文件将明确标明“本地演示（非ima正式验收）”。等平台额度恢复后，只需手动切换至 live 模式即可；不会改写产品事实的来源标签，也不需要重新开发一套Agent。见 docs/本地开发与ima切换.md。

## 目录结构

```text
apps/pc-studio/
├─ frontend/            # 浏览器页面、交互脚本和样式
│  ├─ index.html
│  ├─ app.js
│  └─ style.css
├─ backend/
│  ├─ server.js         # HTTP API 和前端静态资源入口
│  └─ src/              # Agent、知识库、ima、凭证与模型调用
├─ data/                # 型号清单和随项目发布的本地知识库
│  ├─ models.json
│  └─ kb/                # 已获授权的本地知识库副本
├─ docs/                # 系统提示词和作品文档
├─ examples/            # 本地运行案例
├─ scripts/             # 示例生成及验收脚本
├─ tests/               # 单元测试与 HTTP 回归测试
└─ package.json         # 统一启动与测试命令
```

仓库根目录的 `Dockerfile` 和 `ms_deploy.json` 负责部署本应用；Docker 构建上下文必须使用仓库根目录。前后端按目录分离，仍由同一个 Node 服务同源运行，不新增框架或 npm 依赖。`frontend/` 只放可公开给浏览器的文件；凭证、知识库访问和模型调用只放在 `backend/`。现有 `/api/*` 接口及 `/public/app.js`、`/public/style.css` 资源 URL 保持不变，`/public/*` 实际映射到 `frontend/`，不暴露后端目录。

## Docker / 魔搭部署

Dockerfile 和 `ms_deploy.json` 位于 GitHub 仓库根目录。请在仓库根目录构建，不要在 `apps/pc-studio/` 内构建：

```bash
docker build -t pc-studio .
docker run --rm -p 7860:7860 --env-file .env -e DEFAULT_DATA_MODE=live pc-studio
```

运行命令从仓库根目录的 `.env` 注入环境变量；请先按根目录 `.env.example` 准备该文件，勿提交实际凭证。Docker 镜像只包含公开运行所需的 PC Studio 代码、型号清单和系统提示词，不包含本地知识库、密钥或 Git 历史。正式部署时请在平台 Secrets 中配置 ima 凭证；如需启用大模型，再配置 `LLM_MODEL`、`LLM_BASE_URL` 和 `LLM_API_KEY`。容器监听 `0.0.0.0:7860`。

## 本地运行

需 Node.js 20+，不依赖npm第三方包。双击 START_WINDOWS.cmd，或在 PowerShell 输入：

    cd apps/pc-studio
    npm start

访问 http://127.0.0.1:8765

测试：

    npm run check
    npm test
    npm run examples
    npm run smoke:local

本地开发知识库优先读取随项目提供的 `data/kb/`，也会沿代码所在目录向上查找外部「华为PC全板块深度知识库_v7」，兼容主目录与 Git worktree。换电脑时可使用 LOCAL_KB_ROOT 环境变量指定其他目录。`npm run smoke:local` 需要先启动服务；它只验证本地模式，不调用 ima。

## ima官方接口接入

赛题手册第7页指定共享库名称：任德耀新建华为PC知识库。必须使用扫码加入该库的同一账号申请凭证： https://ima.qq.com/agent-interface

在运行服务端的PowerShell设置（仅进程环境，不写入任何源码）：

    $env:IMA_OPENAPI_CLIENTID = "你本人的Client ID"
    $env:IMA_OPENAPI_APIKEY = "你本人的API Key"
    $env:IMA_KB_NAME = "任德耀新建华为PC知识库"
    npm start

网页内切换“ima官方接口·赛事模式”，点击“检测ima连接”，按精确型号运行。实际使用OpenAPI的 search_knowledge_base / search_knowledge / get_knowledge_list / get_media_info，不是把任务丢给ima替你写软文。密钥只在服务端使用。

赛题提供官方Skill压缩包： https://app-dl.ima.qq.com/skills/ima-skills-1.1.10.zip ，用于对照验证接口。

## 可选模型服务

设置 LLM_MODEL、LLM_API_KEY 和 LLM_BASE_URL（OpenAI兼容 chat/completions 端点）即可启用。未配置时仍可运行确定性的自研场景工作流。开发机已成功通过本地私有TXT读取用户的ima凭证，并在2026-10-18完成指定共享库的4组live端到端验收；大模型服务凭证尚未配置。可执行 node scripts/live_acceptance.js 复验，正式云端需在Secrets中独立配置ima凭证。

## 作品文档

- docs/作品说明书.md：详细架构、功能、完成状态。
- docs/评分矩阵.md：赛题100分逐项对齐。
- docs/本地开发与ima切换.md：本地优先/线上切换与资料额度恢复的操作规范。
- docs/真实IMA验收.md：此前四组真实ima调用和图片验证的历史记录。
- docs/SYSTEM_PROMPT.md：八模块Agent规则。
- docs/统一任务验收.md：评委临场测试用例。
- docs/演示与录屏脚本.md：复赛实际录屏操作顺序。
- docs/部署及提交指南.md：GitHub、魔搭和安全说明。
- examples/：由本地实际程序生成的三组演示，不是假冒ima证据。

## 已知限制

- 本机已经完成4组正式ima共享知识库API与图片代理实测；云端部署后的远程连通性、全型号随机评审仍待验证。本地开发演示不能替代正式live记录。
- 缺图时宁可报告不完整，也不生成错误配图；正式高分作品需进一步完成ima图像来源的在线验收。
- 商品价格、促销、库存、交期、兼容性等应按实际SKU与当前官方规则复核。
- 真实大模型输出和魔搭部署仍需账号及密钥；没有凭证不宣称已经完成真实在线调用。
- 本项目没有录制或伪造Demo视频，也没有虚构GitHub/魔搭公开链接。

## 隐私及版权

源码采用MIT许可；知识库、华为产品图片和第三方文献按用户授权随项目提供，不因源码许可自动获得超出授权范围的二次分发权。API Key、Client ID、环境文件和其他凭证仍不得进入 GitHub，须通过 `.gitignore` 和平台 Secrets 管理。
