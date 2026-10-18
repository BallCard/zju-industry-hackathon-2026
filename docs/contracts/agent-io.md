# 契约 C2：PC Studio 输入输出与改稿

本文以 apps/pc-studio 实际运行接口为准，兼容现有浏览器和调用方。一个 Node 服务提供页面、API、图片；不新增数据库。

## 输入与默认值

`POST /api/generate` 接收 `product, audience, platform, scene, stage, objective, instructions, mode, drafting`，也接受 `request` 或 `brief` 自然语言需求（合计最多 2000 字符）。

- `product` 可为空。无型号或自然语言需求中尚无已确认精确型号时，返回 `status=need_info, needsInput=true, questions, candidates`，先确认再生成；不调用 ima、不生成正文或审计通过结论。
- 推荐分支的 `candidates` 为对象数组，每项含 `name, reason, highlights, sources`。型号须同时属于实际 catalog 与 `data/models.json`；highlights 只逐字引用本地同型号事实并在 sources 保留来源、限定条件和 `sourceType=local`。无本地知识库时仅显示目录分类和待核实提示，不补参数、价格或性能结论。live 模式的候选参考仍明确来自本地资料，不代表已完成 ima 核验，也不切换请求的数据源。
- 配置模型时先提取受众、场景、平台、诉求和候选；候选名称必须与 catalog 完整字符串一致。未知或不精确候选丢弃，模型文案不作为产品事实。失败时返回 `recommendationNotice` 并退回确定性排序。显式结构化字段优先，解析后的 `task.product` 保持为空，调用方确认时将候选完整 name 填入 product。
- 用户明确填写完整型号时保留现有生成与改稿流程；不重新解析 request/brief。未带自然语言需求的旧版型号歧义响应保持字符串数组 `candidates`，兼容现有调用方。
- 成稿仍要求明确的 `audience`、`platform`；自然语言解析能补全时可用于下一次确认提交。仅有空请求不能因默认值进入生成。所有自由文本只表达需求，不作为产品事实来源。
- 缺省 `scene=职场办公`、`stage=了解阶段`、`objective=引导到店体验`、`mode=local`，用户界面显示并允许修改。
- 平台规范值为 `公众号 | 小红书 | 门店朋友圈 | 门店海报`；兼容 `wechat_article | xiaohongshu | moments | poster` 及显示名“朋友圈”。`scenario/goal` 为 `scene/objective` 的兼容别名。
- `instructions` 接收补充及改稿要求。`drafting=rules` 强制规则写作；其它情况有模型配置才调用模型。
- 同一规范化入口用于 generate 与 compare；明确不合法的模式或枚举不静默替换。输入及返回均不得包含凭证。

## 四态结果

每次返回 `status`、`ok`、`needsInput`、`trace`。业务结果使用 HTTP 200；无效 JSON/请求类型使用 400，过大请求使用 413。

| status | ok | 含义 |
|---|---|---|
| ok | true | 正文事实、图片、平台完整性和规则核验通过 |
| need_info | false | 需要补充或确认；返回 questions，可带 candidates |
| incomplete | false | 事实可用但图片未达到平台最低数量；返回草稿及缺失项 |
| blocked | false | 证据获取、事实或合规失败，不返回合格成稿 |

`needsInput` 仅在 `need_info` 时为 true。保留 `error`、`warning`、`sourceMode`、`quotaLimited` 等已有兼容信息；失败不自动切换数据源。

可用成稿（ok/incomplete）保留 `task, scene, strategy, facts, images, copy, audit, mode, kbName, generationEngine, meta`。`generationNotice={message, reason}` 表示模型不可用或校验失败后的规则写作回退。

## 内容块是唯一成稿来源

`copy.blocks` 为有序数组，每块有稳定 `id`：

- 标题：`{id,type:"heading",level:1|2|3,text,factRefs:[]}`。
- 文本：`{id,type:"text",text,factRefs:["F01"],role?}`；具体产品事实使用 `role:"fact"`，必须关联可验证证据。
- 图片：`{id,type:"image",imageId:"I01",factRefs:[]}`。

`copy.title/intro/body/cta/tags/fullText` 保留，均从同一内容结构派生；fullText 不含图片。页面按块插图，Markdown 在相同位置输出代理图片链接并附来源；复制为纯正文，不混入技术审计信息。不完整成稿复制及导出带草稿标识。

`facts` 只包含正文实际引用的事实，保留精确型号、来源、原文及适用条件，不任意截断。`F01/I01` 在型号内唯一，必须与精确型号一起判定；客户端传来的引用不能证明来源。

`images` 保留 `id,model,filename,origin,mediaId,description,sourceTitle,sourceUrl,position` 等现有字段，不返回 localPath。图片必须匹配型号和索引并可读取；位置对应实际内容块。

## 核验与完整性

`audit` 保留 `productFacts,images,compliance,unknowns,status`，补充 `issues:[{code,message,blockId?}]`；图片审核提供最低数、目标数及缺失数。

平台最低数为公众号2、小红书3、朋友圈1、海报1；优先目标为3/4/2/1。低于最低数为 incomplete；达到最低数但未达到优先目标仅提示。零事实、引用不存在、型号不符、无依据声明、资料冲突必须阻止生成。核验以最终正文为对象，数字关联事实及单位而非字符串子串放行。图片读取失败不算通过。

## 改稿与对比

改稿仍使用 `POST /api/generate`，传当前需求、`instructions` 及可选紧凑 `previousResult:{task,copy:{blocks}}`。只接收必要字段，不接受递归历史、旧审计结论或客户端证据正文作为事实；返回 task 不含 previousResult。

“删除第二个卖点”按上一稿事实块顺序定位，再用新检索证据重建正文、引用和配图。`task.omittedTopics` 只保留已知事实主题，同型号连续改稿携带这些排除项，避免后续缩短或换标题时重新加入已删除卖点。切换产品后放弃旧型号上下文；没有可用上一稿则追问。其它快捷改稿包括短一点、换个标题、更口语化、突出便携。

`POST /api/compare` 保留 `{task,first,second}` 输入与 `{ok,first,second,changed}` 输出；两项结果均采用上述四态结构。普通用户界面不提供测试型对比入口。

`task.writingPreferences={length:"short"|"normal",tone:"conversational"|"neutral",focusTopics:[已知事实主题]}` 由服务端规范化，只从同型号上一稿继承，再按明确的新指令更新。换标题不清除先前的篇幅与语气；“恢复标准”清除写作偏好但保留明确删除的主题。客户端返回这些字段只代表需求，不是产品事实或审核凭据。

页面仅在当前会话内保留最近五个可用版本；恢复时同时恢复需求、成稿、数据来源和核验结果。切换产品开始新的版本组；切换设置仅影响后续请求，不改写已有版本的来源标签。
