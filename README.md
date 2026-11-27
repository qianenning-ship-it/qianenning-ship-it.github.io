# 智单通 SmartDoc

面向国际货代企业的单证智能填报与校验 SaaS。界面风格参考 [海管家 hgj.com](https://www.hgj.com/)。

## 在线访问

把下面网址发给别人即可在浏览器直接打开：

**https://qianenning-ship-it.github.io/**

- 官网首页：https://qianenning-ship-it.github.io/
- 登录：https://qianenning-ship-it.github.io/login.html
- 工作台：https://qianenning-ship-it.github.io/app.html
- 只读协作页：https://qianenning-ship-it.github.io/view.html（发单页「只读协作链接」，对方无需登录）

演示账号：制单员 `demo@smartdoc.com`　复核员 `checker@smartdoc.com`　密码均为 `demo123`

GitHub Pages 走浏览器解析：Excel / 电子 PDF 抽文本；扫描件用 PP-OCRv5（ONNX / WASM，中英）。首次打开扫描识别会下载约 20MB 模型并缓存在浏览器。Mac / Windows 用 Chrome 即可。档案按企业名称写入 `smartdoc_vault_*`，同一公司的制单员 / 复核员共用票库；可导出 JSON 给同事导入。

## 本地（含 RapidOCR）

双击本目录的 `启动智单通.bat`，或运行：

```
D:\Python\python.exe server.py
```

然后访问 http://127.0.0.1:8090/

发给别人用在线地址即可，不必开本机服务。

依赖：`flask`、`openpyxl`、`pymupdf`、`pillow`、`rapidocr_onnxruntime`（见 `requirements.txt`）。

工作台会探测 `/api/health`：连上则 Excel/PDF/图片走服务端识别；否则自动退回浏览器解析。

## 核心流程（不可跳过）

1. 上传真实 Excel / CSV / PDF / 图片（可一次多份合并成一票），抽出可改字段。多文件部分失败时保留成功份，提示失败文件下一步怎么处理
2. 确认建档后同源生成海运提单、AMS、出口报关单、ISF、装箱单、VGM、到货通知（写入档案快照）。出单页对照档案与快照：整票覆盖、保留快照、或按字段写回
3. 对已生成快照做交叉校验：一致性、ISO 6346 柜号、HS 格式、AMS 24h / ISF 10+2 提示
4. 一键按档案修正快照，导出/打印校验报告；单证可下载 HTML / Word / A4 PDF（船司套版），或打包 ZIP
5. 发单与收件：JSON 包带校验报告与时间线；导入先核对再载入，可点「已核对并回传」
6. 货物档案里打开「作业夹」回看来源文件、已出单证、校验摘要、发单时间线、模拟申报回执、截关状态与批注
7. 提单可切换 COSCO / MSC / MAERSK / OOCL / CMA CGM / Hapag-Lloyd / ONE / Evergreen / Wan Hai / Yang Ming 套版；规则库可开关并随包发出；校验页可模拟申报 AMS / ISF，并下载 CUSCAR / ISF XML 草稿（拒绝原因对应报文节点）
8. 档案填 ETD 后自动计算 AMS 24h / ISF 截关；过点未 Accepted 在顶栏和作业夹标红
9. 顶栏可切换已挂起的票，或「复制上一票」改柜号/船期；发单页分享码 / `#sd=` 链接跨浏览器载入
10. 截关看板按 AMS/ISF 截止排序全库票；作业夹记录字段修订并可回滚；只读协作链接走 `view.html`（可看档案/批注，不能写入）
11. 识别建档、同源出单、模拟申报各扣 1 票额度，套餐页可导出审计 CSV
12. 货描支持多行品名 / HS / 件数 / 毛重 / 单价，同源写入九套单证与 AMS CUSCAR / ISF XML
13. 收件遇本机同票时并排对账，可整票覆盖或按字段合并
14. 制单员校验通过后须复核员（checker@smartdoc.com）确认，才能模拟申报
15. 截关看板可导出 ICS；工作台票数 / 待办 / 通过率 / 工时按档案库实算
16. 装箱单 / VGM（货重+默认皮重 3800 KGS）/ 到货通知（ETA=ETD+14d）同源出单；提单 HTML 按船司 A4 页边距打印
17. 发单页可设分享口令，生成 SD2（AES-GCM + PBKDF2）加密令牌，对方在 `view.html` 输入口令解锁
18. 套餐页可导出 / 导入企业票库 JSON；本地 8090 可选提供 `/api/vault`（没有常开主机时不要依赖它）
19. 扫描装箱单 / 托书会拆货描多行，低置信行黄底待确认
20. 作业夹把扫描件缩略图和 OCR 原文存在本机 IndexedDB
21. 协作收件只走浏览器：粘贴 SD2/JSON 写入本机收件箱，不需要 8090 或云主机
22. 同源输出订舱确认书（Booking Confirmation），与提单船司套版同一档案
23. 柜号 ISO 6346 校验位与 HS 点分格式可一键采用建议修正
24. Service Worker 缓存 PP-OCRv5 / ONNX WASM，第二次扫描不必再下约 20MB 模型
25. A4 PDF / HTML 页脚盖只读短码，对方打开 `view.html` 粘贴（本机分享簿）
26. 柜号前四位箱主码（COSU/MSCU/MAEU/MSKU/OOCU）建议提单/订舱套版，一键采用
27. 只读页可下载「已核对 ACK」JSON，制单员拖进本机收件箱写入回执，不改档案
28. 同源结果可一次打成带页脚短码的 PDF ZIP
29. 美线 HS 须 10 位、其他航线建议 8 位，识别页与校验页可一键采用
30. 唛头 Marks 写入货物档案，同源填入提单 Marks 栏与装箱单 Marks & Nos.
31. 只读协作页可内嵌预览九套单证 HTML，不必先下载
32. 档案列表与作业夹显示协作 ACK 灯（已核对 / 待回执）
33. 箱主码 CMAU / HLCU / ONEU 分别建议 CMA CGM / Hapag-Lloyd / ONE 套版
34. 商业发票同源第 9 套：单价 × 件数 = 金额，装箱单同步金额栏
35. 一票多柜 `containers[]` 写入提单 / VGM / AMS / ISF XML，第一柜同步表头
36. 分享簿可导出 / 导入 JSON，同事本机同步短码，无需 8090
37. 箱主码 EGLV/EMCU → Evergreen，WHLU → Wan Hai，YMLU → Yang Ming

示例文件在 `samples/`。
