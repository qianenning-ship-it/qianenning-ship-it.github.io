# 智单通 SmartDoc

面向国际货代企业的单证智能填报与校验 SaaS。界面风格参考 [海管家 hgj.com](https://www.hgj.com/)。

## 在线访问

把下面网址发给别人即可在浏览器直接打开：

**https://qianenning-ship-it.github.io/**

- 官网首页：https://qianenning-ship-it.github.io/
- 登录：https://qianenning-ship-it.github.io/login.html
- 工作台：https://qianenning-ship-it.github.io/app.html

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

1. 上传真实 Excel / CSV / PDF / 图片（可一次多份合并成一票），抽出可改字段
2. 确认建档后同源生成海运提单、AMS、出口报关单、ISF（写入档案快照）
3. 对已生成快照做交叉校验：一致性、ISO 6346 柜号、HS 格式、AMS 24h / ISF 10+2 提示
4. 一键按档案修正快照，导出/打印校验报告；单证可下载 HTML / Word，或打包 ZIP
5. 发单与收件：导出智单通 JSON 包给报关行/船司/同事；本地 `server.py` 另有本机收件箱 `/api/inbox`

示例文件在 `samples/`。
