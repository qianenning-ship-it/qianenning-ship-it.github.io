# 智单通 SmartDoc

面向国际货代企业的单证智能填报与校验 SaaS。界面风格参考 [海管家 hgj.com](https://www.hgj.com/)。

## 在线访问

把下面网址发给别人即可在浏览器直接打开：

**https://qianenning-ship-it.github.io/**

- 官网首页：https://qianenning-ship-it.github.io/
- 登录：https://qianenning-ship-it.github.io/login.html
- 工作台：https://qianenning-ship-it.github.io/app.html

演示账号：`demo@smartdoc.com`　密码：`demo123`

GitHub Pages 走浏览器解析（SheetJS / PDF.js；扫描件走 Tesseract.js CDN）。数据存在本机 `localStorage`。

## 本地（含 RapidOCR）

在本目录运行：

```
D:\Python\python.exe server.py
```

然后访问 http://127.0.0.1:8090/

依赖：`flask`、`openpyxl`、`pymupdf`、`pillow`、`rapidocr_onnxruntime`（见 `requirements.txt`）。

工作台会探测 `/api/health`：连上则 Excel/PDF/图片走服务端识别；否则自动退回浏览器解析。

## 核心流程（不可跳过）

1. 上传真实 Excel / CSV / PDF / 图片，抽出可改字段
2. 确认建档后同源生成海运提单、AMS、出口报关单、ISF（写入档案快照）
3. 对已生成快照做交叉校验：一致性、ISO 6346 柜号、HS 格式、AMS 24h / ISF 10+2 提示
4. 一键按档案修正快照，导出 HTML 报告；单证可下载 HTML / Word

示例文件在 `samples/`。
