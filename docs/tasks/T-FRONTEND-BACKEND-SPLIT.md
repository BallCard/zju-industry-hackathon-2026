---
id: T-FRONTEND-BACKEND-SPLIT
title: Separate PC Studio frontend and backend directories
owner: pcstudio
status: done
paths: apps/pc-studio/ docs/PROJECT.md
---

## 目标（给谁用、解决什么）

按用户要求，将 PC Studio 的浏览器资源集中到 frontend/，HTTP 服务与业务模块集中到 backend/，便于前后端各自维护。所有开发在独立 worktree 分支 pcstudio/T-FRONTEND-BACKEND-SPLIT 完成，再整合回 main。

## 接口/依赖（引用 docs/contracts）

参考 docs/contracts/ 中的知识库与 Agent 约束。本任务仅重构目录，不修改业务行为或 API 数据结构。保留 /api/* 和 /public/* URL，继续使用单一 Node 服务、根目录 package.json、共享 data/ 和 docs/。

## 进展笔记（agent 在这里留言，勿删他人内容）

- 已移动前端和后端代码，更新数据、凭证发现回退和系统提示词相对路径。
- 已同步 npm 命令、Windows 启动入口、Dockerfile、示例生成脚本、测试引用及源码文档。
- 增加 HTTP 回归测试：页面与静态资源、无私有知识库时的型号清单、API 输入校验、静态目录访问边界和系统提示词读取。
- 验证完成：scripts/check.sh 通过（18/18 测试，无跳过）；独立进程 HTTP 冒烟验证完成本地图文生成与图片代理；示例生成 3/3 通过，未将重生成的时间戳纳入提交。
- 按 Dockerfile 的 COPY 清单复制到临时目录，在没有私有知识库和凭证时验证服务、前端资源、型号清单与系统提示词正常；当前机器没有 Docker，未执行实际容器构建。
- 本任务不进行 ima 在线验收，不提交私有凭证或知识库。通过 scripts/ship.sh 合入 main，再快进同步本地主目录；保留任务分支与 worktree，不擅自删除。
