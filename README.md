# 智单通 SmartDoc

面向国际货代企业的单证智能填报与校验 SaaS。界面风格参考 [海管家 hgj.com](https://www.hgj.com/)。

## 在线访问

把下面网址发给别人即可在浏览器直接打开：

**https://qianenning-ship-it.github.io/**

- 官网首页：https://qianenning-ship-it.github.io/
- 登录：https://qianenning-ship-it.github.io/login.html
- 工作台：https://qianenning-ship-it.github.io/app.html

演示账号：`demo@smartdoc.com`　密码：`demo123`

## 本地打开

用浏览器打开本目录的 `index.html`，或在本目录运行：

```
python -m http.server 8080
```

然后访问 http://127.0.0.1:8080/

## 核心功能

1. 多格式单据识别与提取（Excel/CSV/JSON 实时解析，PDF/图片演示 OCR）
2. 同源生成海运提单、AMS 舱单、出口报关单、ISF 申报表
3. 多套单证一致性校验、必填项检查、一键修正、导出报告
4. 货物档案、套餐额度、按次加购、规则库与一线反馈
