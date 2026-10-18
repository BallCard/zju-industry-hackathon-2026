---
id: T-ROOT-DOCKER
title: Move PC Studio deployment files to repository root
owner: pcstudio
status: done
paths: Dockerfile .dockerignore ms_deploy.json README.md apps/pc-studio/ docs/PROJECT.md
---

## 目标（给谁用、解决什么）

## 接口/依赖（引用 docs/contracts）

## 进展笔记（agent 在这里留言，勿删他人内容）

- 已将 `apps/pc-studio/Dockerfile` 和 `apps/pc-studio/ms_deploy.json` 移至 GitHub 仓库根目录；根目录 Dockerfile 改为从 `apps/pc-studio/` 复制运行时文件。
- 已新增根目录 `.dockerignore`，排除私有知识库、凭证、测试输出和 Git/worktree，仅保留容器运行所需文件。
- 已同步根 README、应用 README 和部署指南，明确 Docker 构建上下文为仓库根目录，并设置云端 `DEFAULT_DATA_MODE=live`。
- 新增部署回归测试：检查根目录部署入口和 COPY 源路径，按 Dockerfile 的 COPY 清单复制到独立临时目录，启动隔离的 HTTP 服务，验证页面、JS/CSS、型号清单、系统提示词及后端文件不可公开访问。
- 已通过 `cd apps/pc-studio && npm run check && npm test`：12 项通过、8 项因缺少授权本地知识库跳过、0 项失败；本机无 Docker，未执行真实镜像构建。本任务不调用 ima 或 LLM，不消耗外部额度。
