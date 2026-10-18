# 契约 C2：Agent 输入输出（agent core 车道定义，app/compose/verify 依赖）

## 输入 `TaskInput`
```json
{
  "product": "HUAWEI MateBook 14（鸿蒙版）",
  "audience": "大学新生",
  "scenario": "开学季",
  "platform": "xiaohongshu",
  "goal": "种草/到店咨询",
  "constraints": ["不要提价格", "语气轻松"],
  "extra": "自由补充"
}
```
- `platform` 枚举：`wechat_article | xiaohongshu | moments | poster`
- 缺 `product/audience/scenario/platform` 任一项 → 不生成，返回 `{"status":"need_info","questions":[…追问…]}`（“想买轻薄本”这类应追问预算外的使用场景、系统/软件依赖、便携与续航诉求等）。
- 型号歧义（如只写 “MateBook D”“MateBook 14”，库内有 鸿蒙版 与 酷睿 Ultra 两款）→ `{"status":"need_info","questions":["请确认具体型号…"],"candidates":[…]}`。

## 输出 `TaskResult`（与手册“统一输出格式”四段一一对应）
```json
{
  "status": "ok | need_info | blocked",
  "scene_judgement": {"audience":"","scenario":"","user_problem":"","goal":"","platform":"","strategy_notes":"为何这样切入/排序（可解释）"},
  "evidence": {"models":[""], "facts":[{"id":"F1","text":"","source":{"title":"","media_id":"","path":""}}]},
  "article": {
    "title":"", "lead":"", "body":"", "cta":"", "tags":[""],
    "blocks":[{"type":"text|image","text":"","image_id":"I1","fact_refs":["F1"]}]
  },
  "images": [{"id":"I1","name":"文件名","model":"","source_title":"","source_url":"","caption":"","position":"第2段后"}],
  "verification": {
    "facts": [{"claim":"","fact_id":"F1","verdict":"supported|unsupported|removed"}],
    "images": [{"image_id":"I1","model_match":true}],
    "compliance": [{"rule":"绝对化用语|虚假承诺|价格误导|无依据竞品贬低|虚构补贴库存奖项评价","hit":"","action":"removed|rewritten|flagged"}],
    "pending_confirm": [""]
  },
  "trace": [{"step":"scene|strategy|retrieve|extract|compose|verify|comply|export","ms":0}]
}
```
- **每个事实性表述必须有 `fact_refs`**；没有依据的删掉或进 `pending_confirm`，绝不凭记忆补。
- 知识库没有的价格/补贴/库存：只能说明“以官方渠道为准”，不得编造；资料冲突 → `status:"blocked"` 并提示人工确认。
- 图片只能出自 `images[]`，且 `model` 必须与 `evidence.models` 一致，否则丢弃。
- `trace` 用于 Demo 展示“流程体现业务理解”，也方便评审复核。

## 修改/换稿 `ReviseInput`
`{"previous": TaskResult, "instruction":"删掉第二个卖点，加入续航", "override": {...TaskInput 局部字段}}` → 返回新 `TaskResult`；换平台/换场景时必须重新跑策略，不是改字数。
