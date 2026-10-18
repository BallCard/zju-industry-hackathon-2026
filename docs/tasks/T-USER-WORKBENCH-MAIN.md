---
id: T-USER-WORKBENCH-MAIN
title: Integrate snapshot workbench core into main
owner: pcstudio
status: done
paths: apps/pc-studio/ docs/contracts/agent-io.md
---

## 目标

按用户要求，优先将 origin/snapshot/pc-studio-current-20261018（cdc6713）的主要应用功能融入 main，不整条覆盖快照。

## 范围

- 合入前端写稿工作台、图文预览、复制和 Markdown 导出、连续改稿和最近五个会话内版本。
- 合入后端四态结果、歧义型号追问、事实完整提取、图片可读取性审核、受控模型方案选择和改稿偏好继承。
- 同步必要的 API 契约、语法检查和核心回归测试。
- 保留最新主线的内置知识库、根目录 Docker/ModelScope 部署、凭证防泄露规则；不引入快照的钩子权限变化和旧机器任务记录。
- 之前的大模型输入解析未提交改动仍留在独立 T-LLM-INPUT-PARSER worktree，不混入本次快照合入。

## 验证

- scripts/check.sh：51/51 测试通过，无跳过，覆盖知识库原始 SHA256、根目录部署、生成、追问、缺图草稿、改稿和 HTTP 请求校验。
- 相对 626071c，Dockerfile、.dockerignore、apps/pc-studio/data/ 没有改动。
- 开发在独立 worktree pcstudio/T-USER-WORKBENCH-MAIN，完成后通过 scripts/ship.sh 合入 origin/main 并快进同步本地 main。
