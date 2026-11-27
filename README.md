# 智单通 SmartDoc

面向国际货代企业的单证智能填报与校验 SaaS。界面风格参考 [海管家 hgj.com](https://www.hgj.com/)。

## 在线访问

把下面网址发给别人即可在浏览器直接打开：

**https://qianenning-ship-it.github.io/**

- 官网首页：https://qianenning-ship-it.github.io/
- 登录：https://qianenning-ship-it.github.io/login.html
- 工作台：https://qianenning-ship-it.github.io/app.html
- 只读协作页：https://qianenning-ship-it.github.io/view.html（发单页「只读协作链接」，对方无需登录）

演示账号：`demo@smartdoc.com`　密码：`demo123`

GitHub Pages 走浏览器解析：Excel / 电子 PDF 抽文本；扫描件用 PP-OCRv5（ONNX / WASM，中英）。首次打开扫描识别会下载约 20MB 模型并缓存在浏览器。Mac / Windows 用 Chrome 即可。数据存在本机 `localStorage`。

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
2. 确认建档后同源生成海运提单、AMS、出口报关单、ISF（写入档案快照）。出单页对照档案与快照：整票覆盖、保留快照、或按字段写回
3. 对已生成快照做交叉校验：一致性、ISO 6346 柜号、HS 格式、AMS 24h / ISF 10+2 提示
4. 一键按档案修正快照，导出/打印校验报告；单证可下载 HTML / Word，或打包 ZIP
5. 发单与收件：JSON 包带校验报告与时间线；导入先核对再载入，可点「已核对并回传」
6. 货物档案里打开「作业夹」回看来源文件、已出单证、校验摘要、发单时间线、模拟申报回执、截关状态与批注
7. 提单可切换 COSCO / MSC / MAERSK 套版；规则库可开关并随包发出；校验页可模拟申报 AMS / ISF，并下载 CUSCAR / ISF XML 草稿（拒绝原因对应报文节点）
8. 档案填 ETD 后自动计算 AMS 24h / ISF 截关；过点未 Accepted 在顶栏和作业夹标红
9. 顶栏可切换已挂起的票，或「复制上一票」改柜号/船期；发单页分享码 / `#sd=` 链接跨浏览器载入
10. 截关看板按 AMS/ISF 截止排序全库票；作业夹记录字段修订并可回滚；只读协作链接走 `view.html`（可看档案/批注，不能写入）
11. 识别建档、同源出单、模拟申报各扣 1 票额度，套餐页可导出审计 CSV

示例文件在 `samples/`。
