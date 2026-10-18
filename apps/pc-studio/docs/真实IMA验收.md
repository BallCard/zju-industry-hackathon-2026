# 真实 ima 共享知识库调用｜验收记录

**测试日期：2026-10-18**

程序成功从本机不入库的用户凭证文件（D盘 ima_skill/ima.txt）加载 Client ID 与 API Key，只在服务端进程使用，不在日志、源码、网络响应中展示密钥。

**指定共享库**：任德耀新建华为PC知识库。
**连接**：ima OpenAPI search_knowledge_base 真实成功。再经 get_knowledge_list 精确定位产品目录、get_media_info 读取事实与图片索引、ima图片媒体流代理核查。

## 四组端到端真实请求

| 用例 | 产品 | 场景×渠道 | ima事实数 | ima图片数 | 首张图片HTTP | 规则审计 |
|---|---|---|---:|---:|---|---|
| student_xhs | HUAWEI MateBook 14（鸿蒙版） | 开学季×小红书 | 5 | 4 | 200 image/png | passed |
| office_mp | HUAWEI MateBook 14（鸿蒙版） | 职场办公×公众号 | 5 | 3 | 200 image/png | passed |
| creator_wechat | HUAWEI MateBook 14 酷睿 Ultra | 内容创作×门店朋友圈 | 3 | 2 | 200 image/jpeg | passed |
| poster | HUAWEI MateBook 14（鸿蒙版） | 门店到访×门店海报 | 3 | 1 | 200 image/png | passed |

实测执行：node scripts/live_acceptance.js。
本机私有摘要：test-output/ima-live-verification.json（.gitignore 排除）。

所有案例 mode=live，事实来自 ima 原文媒体，图片位于该型号在 ima 的产品目录并与其图片索引对应，代理可取回真实图片字节。上述通过只表示程序规则闸门通过，不表示人工法务及商业宣传审核完成。

## 边界与剩余事项

- 当前四组实际通过，不表示所有型号、所有图片、所有干扰类型都经过线上测试。
- 独立LLM API尚未配置，本次文案是自研规则引擎实际输出，不能冒充大模型实际生成。
- GitHub及魔搭公开链接未发布，正式Demo录屏未录制；部署后必须重测 live 接口。
- 举办方资料与官方图片不得作为整个资源包未经授权公开再分发；项目仓库不保存媒体二进制。
- 价格、补贴、库存、软件适配与售后权益需进一步人工核实。
