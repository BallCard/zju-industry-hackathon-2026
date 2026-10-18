---
id: T-FREEFORM-INPUT-BACKEND
title: Recommend catalog models from free-form briefs
owner: pcstudio
status: done
paths: apps/pc-studio/backend/ apps/pc-studio/tests/ docs/contracts/agent-io.md
---

## 目标与范围

按用户直接分配，在独立 worktree / 分支 `pcstudio/T-FREEFORM-INPUT-BACKEND`（基线 a0bd452）实现后端“无型号也能推荐型号”。不改前端、知识库、型号清单、部署与凭证；仅本分支提交，不推送、不合入 main。

## 进展笔记

- `/api/generate` 接受 `request` 或 `brief`。缺少确认型号先返回 need_info / needsInput / questions 与最多三个 name/reason/highlights/sources 候选，不进入 ima 检索、图片读取或成稿生成。
- 无模型时从实际 catalog 与 models.json 的交集按需求及同型号本地事实确定性排序；高亮保留原文、配置限定条件和 local 来源。容器无本地知识库时只给目录分类与需核实提示，不虚构配置。
- 配置 LLM 时先走现有安全 JSON 请求通道提取受众、场景、平台、内容目标和候选；候选必须逐字匹配实际目录，未知及不精确名称丢弃。模型只参与需求与候选排序，不能提供产品事实。失败显式回退规则推荐。
- 显式结构化需求优先；已有完整型号仍走原生成、改稿、审计路径。旧版无 brief 的歧义型号候选仍为字符串，新增推荐分支为对象，契约已同步。确认后将候选 name 与返回 task 的人群/场景/平台一并提交。
- live 推荐仍只显示明确的本地候选依据，不冒充 ima 已完成检索，也不自动切换数据源。

## 验证

- 在 apps/pc-studio 执行 `npm run check && npm test`（Windows 由 cmd /c 调用）：语法检查通过，60/60 测试通过，无跳过。
- 新增 8 个 freeform 单测与 1 个 HTTP 测试，覆盖 request/brief、候选精确合法性、原始事实来源、模型解析与失败回退、无 KB 目录推荐、live 确认前不检索、完整型号生成回归；原改稿/审计/local-live 测试保持通过。
- 未调用真实 LLM 或 ima 服务；LLM 请求由 mock 拦截，未查看、修改或提交任何真实凭证。
