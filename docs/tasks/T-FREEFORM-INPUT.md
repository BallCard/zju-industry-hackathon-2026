---
id: T-FREEFORM-INPUT
title: Free-form requirements and evidence-backed model recommendations
owner: pcstudio
status: done
paths: apps/pc-studio/ docs/contracts/agent-io.md docs/PROJECT.md
---

## 用户确认的目标

用户不需要事先知道或输入产品型号。只描述人群、用途、便携/屏幕等诉求和发布位置，系统先给出知识库中存在的候选型号、推荐依据与待确认事项。选择候选后再生成有事实与图片来源的营销内容。型号字段为可选项；明确型号和原改稿流程兼容。

配置兼容模型服务时，初步意图理解和候选规划优先调用模型；未配置/模型失败时清晰说明使用本地需求解析与资料推荐。不冒充实际模型调用，不读取私有凭证，不生成资料未支持的产品声明。

## Lane board（独立写入边界）

| lane | 分支/worktree | 只允许写入 | 交付与权限 |
|---|---|---|---|
| parent/integration | pcstudio/T-FREEFORM-INPUT，.worktrees/pcstudio-T-FREEFORM-INPUT | 集成后的修复、端到端测试和文档 | 整合子分支、最终验证、通过 ship.sh 合入 origin/main；不得强推 main |
| backend-recommender | pcstudio/T-FREEFORM-INPUT-BACKEND，.worktrees/pcstudio-T-FREEFORM-INPUT-BACKEND | backend/ 和后端专项测试 | 提交本地 lane 分支，不推远端，不修改前端 |
| frontend-freeform | pcstudio/T-FREEFORM-INPUT-FRONTEND，.worktrees/pcstudio-T-FREEFORM-INPUT-FRONTEND | frontend/index.html、app.js、style.css | 提交本地 lane 分支，不推远端，不修改后端 |

两子 lane 在独立 worktree 并行写入；父 lane 只写集成目录，待子任务提交后合入。

## 接口与验收

- POST /api/generate：新增 request（brief 兼容别名），允许无 product、audience 等结构字段。只要用户提供自然语言需求，页面不能因产品为空而拦截请求。
- 型号未明确：返回 status=need_info、needsInput=true、questions、candidates/recommendations；每个候选必须来自实际 catalog，理由有知识库依据，不从模型记忆补参数、价格或兼容性。
- 候选确认重试：保留 request，同时携带明确 product 和解析出的必要任务信息；不能再次卡在原先“必须先知道型号”的流程。
- 明确型号旧流程、连续改稿、模式隔离、图片与合规核验无回归。
- npm run check、npm test；独立本地 HTTP 验证“只输入需求 → 推荐 → 确认 → 成稿 → 改稿”，以及模型解析的 mock 回归测试。
- 保留内置知识库、根 Docker 与 ModelScope 配置。仅代码和任务说明提交，无运行日志/密钥。

## 核心验证结果

- 两个子智能体分别完成后端推荐与前端自由输入，并在父 worktree 合入；父修复 parsedTask 回填、确认后的需求保留和表单默认值覆盖文本意图的问题。
- 已加入实际 UI 函数对实际后端的集成测试：不输入型号与受众 → 返回知识库候选和推荐理由 → 确认型号 → 成稿 → 连续改稿，全链路通过。
- 全量 71 项自动测试通过；知识库原始 SHA256、根目录部署、旧明确型号流程、local/live 隔离和模型异常回退未回归。
- 版本 1.2.0。当前本机未配置大模型凭证，已用合成响应验证兼容模型解析路径，不宣称真实在线模型调用成功。
- 两子 lane 已终止写入且本地提交完成；随后分别对父集成 worktree 进行只读交叉检查，均未发现阻塞核心流程的问题。
- Tabbit 浏览器自动化无法创建目标页（Target.createTarget 调度错误），未完成真实浏览器验收；实际 UI 函数与实际后端的 VM 集成测试及 HTTP 回归测试已通过。
- 父集成最终提交通过 scripts/ship.sh 合入 origin/main，随后仅快进更新本地 main，不删除工作树或其他分支。
