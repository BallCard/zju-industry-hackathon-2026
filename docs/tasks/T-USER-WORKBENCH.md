---
id: T-USER-WORKBENCH
title: User-facing marketing workbench and reliable generated output
owner: pcstudio
status: done
paths: apps/pc-studio/ docs/contracts/agent-io.md docs/PROJECT.md
---

## 目标（给谁用、解决什么）

为门店导购和内容运营提供“填写需求、预览图文、修改、复制”的成稿工作台，减少技术术语和输入负担；修复空事实、缺图和无依据声明被误判为通过的问题。

## 接口/依赖

见 docs/contracts/agent-io.md。保留单 Node 服务、现有路由与显式 local/live 选择。知识库位于仓库外 /home/dennis/hackzon/data/kb，不提交。此检出来自用户 ZIP，本地初始化基线；没有 origin，任务仅在本地分支登记，不冒充远端认领或合入。

## 进展笔记

- 原始 ZIP 已提交为 main 基线；实现分支 pcstudio/T-USER-WORKBENCH。
- 前后端分别在独立 worktree 子分支开发，验证后汇入本任务分支；主检出保持基线。
- 交付包含内容块、四态结果、精确型号追问、改稿及五个内存版本、图文预览、来源详情和导出。
- 用户未授权推送远端，本任务不执行 task.sh claim 或 ship.sh 的远端写入。
- 已交付双栏成稿工作台、手机单栏、快捷／自然语言改稿、五个内存版本、来源折叠与设置、纯文案复制和带图 Markdown。失败保留上一稿，缺图显示草稿。
- 后端修复空事实通过、用户声明混入、核验与实际正文不一致、图片可读取性和完整性、型号歧义；同一型号连续改稿保留已删除主题及篇幅／语气／重点。
- 模型仅选择受控写作方案，事实由服务端填入；无法核验时显示基础写作回退。当前没有 ima 或模型凭证，未声称真实在线验收。
- 验证：npm run check 通过；npm test 46/46 通过，无跳过。真实授权知识库 10 型号×4 平台得到38份完整结果、2份正确标记的缺图草稿。
- Chrome 真实浏览器验证生成／图片读取／连续改稿／版本恢复／复制／Markdown图片链接／网络与500失败恢复通过；1440、1024、390px 无横向溢出，无未捕获脚本异常；截图位于已忽略的 apps/pc-studio/test-output/。
- 本地启动入口 /home/dennis/hackzon/start-pc-studio.sh 指向本分支工作目录；配置及知识库在源码之外，不提交。
- 后续排障：用户遇到“生成没有完成”时实测8765无监听，原临时进程已经退出。启动入口已改为用户级 systemd 后台服务 pc-studio.service（Restart=on-failure），不再依赖执行终端存活；重复启动会复用服务，支持 status/restart/stop。
- 已从Windows确认 http://127.0.0.1:8765 健康接口成功；本机 localhost 访问会超时，统一推荐明确的IPv4地址。实际生成返回5条事实、4张图片。
- 页面断连单独提示“无法连接写稿服务”，保留输入／上一稿；重试后恢复在线状态。真实浏览器网络失败、服务500及恢复检查通过。
- 按用户要求移除右侧“写好，就能用／你的成稿”标题，缩短顶部留白；首份成稿即显示“第1版”，保留历史版本选择。
