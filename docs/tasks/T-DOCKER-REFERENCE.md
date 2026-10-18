---
id: T-DOCKER-REFERENCE
title: Align root Dockerfile with user supplied reference
owner: pcstudio
status: doing
paths: Dockerfile .dockerignore README.md apps/pc-studio/tests/deployment.test.js apps/pc-studio/docs/ apps/pc-studio/README.md docs/PROJECT.md
---

## 目标（给谁用、解决什么）

## 接口/依赖（引用 docs/contracts）

## 进展笔记（agent 在这里留言，勿删他人内容）

- 已按用户提供的参考文件逐行对齐根目录 `Dockerfile`：`node:22-alpine`、COPY 顺序、仅复制 `data/models.json`、端口与启动命令均一致。
- 已同步 `.dockerignore`、部署说明和根目录测试；容器不包含 `data/kb/`，正式云端使用 ima live 模式，本地授权知识库仍保留供本地运行。
- 已通过根目录 Dockerfile 内容精确比较及 `bash scripts/check.sh`：51 项测试通过、0 项失败；本机无 Docker，未执行真实镜像构建。
