# 契约 C1：ima 访问层（retrieval 车道实现，其他车道依赖）

## 事实
- 官方 skill：`vendor/ima-skill/ima_api.cjs`（`bash scripts/fetch-ima-skill.sh` 获取；Node ≥ 18）。凭证来自环境变量 `IMA_OPENAPI_CLIENTID` / `IMA_OPENAPI_APIKEY`，只发往 `ima.qq.com`。
- 请求统一 `POST https://ima.qq.com/openapi/wiki/v1/<method>`，头 `ima-openapi-clientid / ima-openapi-apikey / ima-openapi-ctx: skill_version=1.1.10`，JSON body。**自研客户端可直接调这个 HTTP 接口（Python/TS 均可），不必拉起 node 子进程。**
- 手册实测：共享库浏览出 314 项；搜索无结果 ≠ 无权限，应进 `P1-产品参数库` 再读具体型号 `article.md`。

## 用到的接口
| 方法 | body | 返回要点 |
| --- | --- | --- |
| `search_knowledge_base` | `{query, cursor:"", limit}` | `data.info_list[].kb_id / kb_name`（另有 `content_count,member_count,role_type,base_type`）。**实测字段是 `kb_id`/`kb_name`，不是 `id`/`name`** |
| `get_knowledge_list` | `{knowledge_base_id, cursor, limit(1-50), folder_id?}` | 条目 `media_id,title`、文件夹 `folder_id,name` |
| `search_knowledge` | `{query, knowledge_base_id, cursor}` | `info_list[].media_id,title,parent_folder_id,highlight_content` |
| `get_media_info` | `{media_id}` | `media_type`、`url_info.url/headers`（文件）；`media_type=11` 为笔记 |

## 我们的封装接口（Python 参考签名，按最终语言调整）
```
ima.whoami() -> {kb_name, kb_id_masked, connected: bool}        # 供 UI 展示；不得返回完整密钥/完整 kb_id
ima.search(query, limit=10) -> [Hit{media_id, title, path, snippet}]
ima.read(media_id) -> {title, text, images: [ImageRef]}          # 取原文；图片需带 来源/型号/说明
ima.image(media_id|name) -> {bytes|url, source_title, model, caption}
```
错误必须区分：`AUTH_FAILED / KB_NOT_VISIBLE / NO_RESULT / PARSE_FAILED`，UI 不得把一切归为“库里没有”。
所有返回的资料项必须带 `source`（标题 + media_id/路径），供核验与“知识库依据”段使用。

## 本地开发（无需凭证即可跑通）
`data/kb/`（gitignore）是举办方知识库的本地副本，结构见 C3。`ima.*` 提供 `LocalKB` 后端读取该目录，与 `ImaKB` 后端同接口；用 `KB_BACKEND=local|ima` 切换。**最终演示与评测必须走 `ima`**（评分要求调用 ima OpenAPI）。

## 实测记录（2026-10-18，skill 1.1.10）
- `search_knowledge_base` 返回项键：`kb_id, kb_name, cover_url, member_count, content_count, description, creator, role_type, base_type`；`code=0` 但库不可见时 `info_list` 为空或只含个人库，**不会报错**——必须校验 `kb_name` 命中目标库，否则报 `KB_NOT_VISIBLE`。
- Windows 终端中文输出可能乱码，解析用 node/`PYTHONUTF8=1`，别以终端显示判断内容。

## 共享库实测（2026-10-18，账号已加入，角色=普通成员）
- 库名「任德耀新建华为PC知识库」，`content_count=1519`，与本地 `data/kb/`（1522 文件）为同一份素材；本地仅用于开发，**演示/评测必须走 ima**。
- `search_knowledge` 返回项键：`media_id, title, parent_folder_id, highlight_content, media_type`。`media_type`：`7`=md 文档，`5`=csv，`9`=图片，`99`=文件夹。
- `get_media_info` → `url_info.url + headers`，带 headers 直接 GET 即得原文（实测 md 返回 HTTP 200）。
- **同名文件很多**：10 个型号各有一份 `产品事实.md`/`卖点与限制.md`/`图片索引.csv`，搜索只给标题。必须用 `parent_folder_id` 调 `get_knowledge_list`，从 `data.current_path` 取路径来判定所属型号，**型号不能靠标题判断**。
- 目录多套一层：`库名 / 库名 / P1-产品参数库 / 01-鸿蒙电脑 / <型号>`；根下只有一个文件夹，需下钻。`get_knowledge_list` 的 `folder_id` 可直接用文件夹条目的 `media_id` 或 `parent_folder_id`。
- 图片在 ima 里只有文件名（如 `hwpc_matebook-gt-14_智慧AI空间_07.jpg`），型号归属靠同目录 `图片索引.csv` 的「产品型号」列，核验图片型号时必须读它。
- 建议：启动时用本地副本（或首次从 ima 拉取后缓存到 `data/cache/`，已 gitignore）建「型号 → folder_id → 文件/图片」索引，避免每次任务反复遍历目录。
