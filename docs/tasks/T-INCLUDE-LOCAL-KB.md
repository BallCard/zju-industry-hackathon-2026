---
id: T-INCLUDE-LOCAL-KB
title: Bundle the authorized original v7 knowledge base
owner: pcstudio
status: done
paths: apps/pc-studio/ .gitignore .gitattributes .githooks/pre-commit AGENTS.md README.md docs/
---

## 目标（给谁用、解决什么）

用户明确确认原 v7 知识库（含 P4 目录）允许上传至当前 GitHub 仓库。将 1,522 个原始文件作为只读资料快照放入 apps/pc-studio/data/kb/，使克隆仓库和 Docker 部署的 local 模式无需额外下载资料或配置 ima 凭证。

## 接口/依赖（引用 docs/contracts）

知识库目录与现有 catalog 自动发现逻辑一致；仍按 docs/contracts/kb-layout.md 使用型号事实和图片索引。local 与 live 标签、API 和业务规则不变，上传本地资料不等于完成 ima 在线验收。

## 进展笔记（agent 在这里留言，勿删他人内容）

- 在独立 worktree 分支 pcstudio/T-INCLUDE-LOCAL-KB 操作，不移动或修改仓库外的原始知识库。
- 原始文件数 1,522，总计 33,792,076 字节。复制后的每个文件与源文件 SHA256 一致；原清单中的 1,521 项大小与 SHA256 全部核验通过，清单自身为第 1,522 个文件。
- 使用 .gitattributes 保留资料原始字节，避免 Git 换行转换破坏原始 SHA256 清单。
- 仅放行 apps/pc-studio/data/kb/，根目录临时知识库、第三方 skill、手册和运行缓存仍不入库；凭证路径及内容检查不因知识库授权而豁免。
- 凭证内容扫描未发现疑似密钥或知识库 ID 赋值；不读取或上传项目外的 ima.txt。
- 已完成 21/21 自动测试；内置知识库默认发现、10 个型号事实/图片索引和 10 个型号离线海报生成均通过。
- 已完成 bundled HTTP smoke：服务发现仓库内知识库，10 个型号可用，事实/图片审计通过；3 个示例均生成通过。
- 提交钩子回归 9/9 通过：授权知识库路径可提交，但 `.env`、密钥、ima.txt、临时资料和第三方副本仍被拦截。
- 已验证 1,522 个源文件逐文件 SHA256 一致；原清单 1,521 项全部校验通过，清单自身为第 1,522 个文件。
- 准备提交并通过 scripts/ship.sh 推送合入 origin/main；不上传项目外 ima.txt 或其他凭证。
