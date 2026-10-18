# 契约 C1：ima 访问层（retrieval 车道实现，其他车道依赖）

## 事实
- 官方 skill：`vendor/ima-skill/ima_api.cjs`（`bash scripts/fetch-ima-skill.sh` 获取；Node ≥ 18）。凭证来自环境变量 `IMA_OPENAPI_CLIENTID` / `IMA_OPENAPI_APIKEY`，只发往 `ima.qq.com`。
- 请求统一 `POST https://ima.qq.com/openapi/wiki/v1/<method>`，头 `ima-openapi-clientid / ima-openapi-apikey / ima-openapi-ctx: skill_version=1.1.10`，JSON body。**自研客户端可直接调这个 HTTP 接口（Python/TS 均可），不必拉起 node 子进程。**
- 手册实测：共享库浏览出 314 项；搜索无结果 ≠ 无权限，应进 `P1-产品参数库` 再读具体型号 `article.md`。

## 用到的接口
| 方法 | body | 返回要点 |
| --- | --- | --- |
| `search_knowledge_base` | `{query, cursor:"", limit}` | `data.info_list[].id / name`（kb_id） |
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
