# -*- coding: utf-8 -*-
"""智单通本地识别服务：Excel / PDF 文本 / RapidOCR，并托管静态站点。"""
from __future__ import annotations

import io
import json
import os
import re
import time
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory

ROOT = os.path.dirname(os.path.abspath(__file__))
INBOX_DIR = os.path.join(ROOT, "data", "inbox")
VAULT_DIR = os.path.join(ROOT, "data", "vault")
os.makedirs(INBOX_DIR, exist_ok=True)
os.makedirs(VAULT_DIR, exist_ok=True)
app = Flask(__name__, static_folder=ROOT, static_url_path="")

FIELD_ALIASES = {
    "ticketNo": ["ticket", "票号", "booking", "booking no", "ref", "托书号"],
    "shipper": ["shipper", "发货人", "托运人", "exporter", "seller", "境内发货人", "卖方"],
    "consignee": ["consignee", "收货人", "importer", "buyer", "境外收货人", "买方"],
    "notifyParty": ["notify", "notify party", "通知方", "通知人"],
    "containerNo": ["container", "container no", "柜号", "箱号", "集装箱号", "cntr"],
    "sealNo": ["seal", "seal no", "封号", "铅封"],
    "hsCode": ["hs", "hs code", "hts", "商品编码", "海关编码", "hs编码", "税号"],
    "description": ["description", "goods", "cargo", "commodity", "品名", "货名", "货物名称", "商品名称"],
    "packages": ["packages", "package", "pkgs", "qty", "件数", "包装", "cartons", "ctns"],
    "grossWeight": ["gross weight", "gw", "weight", "毛重"],
    "volume": ["volume", "cbm", "measurement", "体积", "尺码"],
    "pol": ["pol", "port of loading", "loading port", "起运港", "装货港", "发运港"],
    "pod": ["pod", "port of discharge", "destination", "目的港", "卸货港", "指运港"],
    "vessel": ["vessel", "vessel name", "vsl", "船名"],
    "voyage": ["voyage", "voy", "航次"],
    "etd": ["etd", "sailing", "开船", "开船日"],
    "eta": ["eta", "arrival", "到港", "预计到港"],
    "tareWeight": ["tare", "tare weight", "皮重", "箱皮重"],
}

OCR_ENGINE = None


def get_ocr():
    global OCR_ENGINE
    if OCR_ENGINE is None:
        from rapidocr_onnxruntime import RapidOCR

        OCR_ENGINE = RapidOCR()
    return OCR_ENGINE


def norm_key(s: str) -> str:
    return re.sub(r"[\s:：_\-/#().]", "", str(s or "").lower())


def alias_key(header: str):
    n = norm_key(header)
    if not n or len(n) > 48:
        return None
    for key, names in FIELD_ALIASES.items():
        for a in names:
            if n == norm_key(a):
                return key
    leftover_ok = re.compile(r"^(name|no|number|party|code|of|the)$")
    for key, names in FIELD_ALIASES.items():
        for a in names:
            na = norm_key(a)
            if len(na) < 3 or na not in n:
                continue
            leftover = n.replace(na, "")
            if not leftover or leftover_ok.match(leftover):
                return key
    return None


def new_ticket() -> str:
    return "SH" + datetime.now().strftime("%Y%m%d%H%M")


def empty_fields() -> dict:
    keys = ["ticketNo"] + [k for k in FIELD_ALIASES if k != "ticketNo"]
    return {k: "" for k in keys}


def normalize_hs(v: str) -> str:
    d = re.sub(r"\D", "", v or "")
    if len(d) == 10:
        return f"{d[:4]}.{d[4:6]}.{d[6:]}"
    if len(d) == 8:
        return f"{d[:4]}.{d[4:6]}.{d[6:]}"
    return (v or "").strip()


def harvest(text: str, fields: dict) -> None:
    if not fields.get("containerNo"):
        m = re.search(r"\b([A-Z]{4}\s?\d{7})\b", text, re.I)
        if m:
            fields["containerNo"] = re.sub(r"\s", "", m.group(1).upper())
    if not fields.get("hsCode"):
        m = re.search(r"\b(\d{4}\.\d{2}\.\d{2,4})\b", text) or re.search(r"\bHS[^\d]{0,8}(\d{8,10})\b", text, re.I)
        if m:
            fields["hsCode"] = normalize_hs(m.group(1))
    if not fields.get("grossWeight"):
        m = re.search(r"([\d,.]+)\s*(KGS|KG|MT|TONS?)\b", text, re.I)
        if m:
            fields["grossWeight"] = f"{m.group(1)} {m.group(2).upper()}"
    if not fields.get("volume"):
        m = re.search(r"([\d,.]+)\s*(CBM|M3|M³)\b", text, re.I)
        if m:
            fields["volume"] = f"{m.group(1)} CBM"
    if not fields.get("packages"):
        m = re.search(r"(\d+)\s*(CTNS|CARTONS|PKGS|PACKAGES|PLTS|PALLETS|件数)\b", text, re.I)
        if m:
            unit = m.group(2).upper().replace("件数", "CTNS")
            fields["packages"] = f"{m.group(1)} {unit}"


def parse_text(text: str):
    fields = empty_fields()
    conf = {}
    for line in (text or "").splitlines():
        parts = re.split(r"[:：\t]", line, maxsplit=1)
        if len(parts) < 2:
            continue
        key = alias_key(parts[0])
        val = parts[1].strip()
        if key and val and not fields.get(key):
            fields[key] = normalize_hs(val) if key == "hsCode" else val
            conf[key] = 98
    harvest(text, fields)
    for k, v in fields.items():
        if v and k not in conf:
            conf[k] = 90
    if not fields.get("ticketNo"):
        fields["ticketNo"] = new_ticket()
    if fields.get("containerNo"):
        fields["containerNo"] = re.sub(r"[\s-]", "", fields["containerNo"].upper())
    return fields, conf


def split_csv_line(line: str):
    if "\t" in line:
        return [c.strip() for c in line.split("\t")]
    parts = re.split(r"[,;]", line, maxsplit=1)
    if len(parts) == 2 and alias_key(parts[0]):
        return [parts[0].strip(), parts[1].strip()]
    return [c.strip() for c in re.split(r"[,;\t]", line)]


def parse_table(rows):
    fields = empty_fields()
    conf = {}
    text_lines = []
    header_idx = -1
    mapping = []
    for i, row in enumerate(rows[:12]):
        mapped = [alias_key(str(c) if c is not None else "") for c in row]
        if sum(1 for x in mapped if x) >= 2:
            header_idx = i
            mapping = mapped
            break
    if header_idx >= 0 and header_idx + 1 < len(rows):
        data = rows[header_idx + 1]
        for idx, key in enumerate(mapping):
            if key and idx < len(data) and data[idx] and not fields.get(key):
                val = str(data[idx]).strip()
                fields[key] = normalize_hs(val) if key == "hsCode" else val
                conf[key] = 99
    for row in rows:
        cells = ["" if c is None else str(c).strip() for c in row]
        text_lines.append("\t".join(cells))
        if len(cells) >= 2:
            key = alias_key(cells[0])
            val = " ".join(x for x in cells[1:] if x).strip()
            if key and val and not fields.get(key):
                fields[key] = normalize_hs(val) if key == "hsCode" else val
                conf[key] = 97
    text = "\n".join(text_lines)
    t_fields, t_conf = parse_text(text)
    for k, v in t_fields.items():
        if v and not fields.get(k):
            fields[k] = v
            conf[k] = t_conf.get(k, 90)
    harvest(text, fields)
    if not fields.get("ticketNo"):
        fields["ticketNo"] = new_ticket()
    return fields, conf, text


def extract_xlsx(data: bytes):
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    fields = empty_fields()
    conf = {}
    chunks = []
    for ws in wb.worksheets:
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        f, c, t = parse_table(rows)
        chunks.append(f"[{ws.title}]\n{t}")
        for k, v in f.items():
            if v and not fields.get(k):
                fields[k] = v
                conf[k] = c.get(k, 96)
    return fields, conf, "\n".join(chunks), "Excel 表格解析（openpyxl）"


def ocr_image_bytes(data: bytes) -> str:
    from PIL import Image

    img = Image.open(io.BytesIO(data)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    result, _elapse = get_ocr()(buf.getvalue())
    if not result:
        return ""
    return "\n".join(item[1] for item in result if len(item) > 1)


def extract_pdf(data: bytes):
    import fitz

    doc = fitz.open(stream=data, filetype="pdf")
    text = "".join(page.get_text() for page in doc)
    method = "PDF 文本提取（PyMuPDF）"
    if len(re.sub(r"\s", "", text)) < 40:
        ocr_parts = [text]
        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            ocr_parts.append(ocr_image_bytes(pix.tobytes("png")))
        text = "\n".join(ocr_parts)
        method = "PDF OCR（RapidOCR）"
    fields, conf = parse_text(text)
    return fields, conf, text, method


def extract_image(data: bytes):
    text = ocr_image_bytes(data)
    fields, conf = parse_text(text)
    return fields, conf, text, "图片 OCR（RapidOCR）"


def inbox_meta(obj, filename):
    return {
        "id": filename[:-5] if filename.endswith(".json") else filename,
        "ticketNo": obj.get("ticketNo") or (obj.get("shipment") or {}).get("ticketNo") or "",
        "from": obj.get("from") or {},
        "to": obj.get("to") or "",
        "remark": obj.get("remark") or "",
        "sentAt": obj.get("sentAt") or "",
        "docs": obj.get("docs") or list((obj.get("generated") or {}).keys()),
    }


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "ocr": True, "engine": "rapidocr", "inbox": True, "vault": True})


@app.get("/api/inbox")
def inbox_list():
    items = []
    for name in sorted(os.listdir(INBOX_DIR), reverse=True):
        if not name.endswith(".json"):
            continue
        path = os.path.join(INBOX_DIR, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                obj = json.load(f)
            items.append(inbox_meta(obj, name))
        except Exception:
            continue
    return jsonify({"ok": True, "items": items})


@app.post("/api/inbox")
def inbox_post():
    obj = request.get_json(silent=True)
    if not obj:
        return jsonify({"error": "missing json"}), 400
    ticket = str(obj.get("ticketNo") or (obj.get("shipment") or {}).get("ticketNo") or "PACK")
    safe = re.sub(r"[^A-Za-z0-9_-]+", "", ticket)[:24] or "PACK"
    rid = datetime.now().strftime("%Y%m%d%H%M%S") + "-" + safe
    obj.setdefault("kind", "smartdoc-pack")
    obj.setdefault("sentAt", datetime.now().isoformat(timespec="seconds"))
    path = os.path.join(INBOX_DIR, rid + ".json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    return jsonify({"ok": True, "id": rid, **inbox_meta(obj, rid + ".json")})


@app.get("/api/inbox/<item_id>")
def inbox_get(item_id):
    safe = re.sub(r"[^A-Za-z0-9_-]+", "", item_id)
    path = os.path.join(INBOX_DIR, safe + ".json")
    if not os.path.isfile(path):
        return jsonify({"error": "not found"}), 404
    with open(path, "r", encoding="utf-8") as f:
        obj = json.load(f)
    return jsonify(obj)


def vault_safe(org_id: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_\-\u4e00-\u9fff]+", "", str(org_id or ""))[:48]
    return safe or "demo"


@app.get("/api/vault/<org_id>")
def vault_get(org_id):
    safe = vault_safe(org_id)
    path = os.path.join(VAULT_DIR, safe + ".json")
    if not os.path.isfile(path):
        return jsonify({"ok": True, "kind": "smartdoc-org-vault", "orgId": safe, "tickets": []})
    with open(path, "r", encoding="utf-8") as f:
        obj = json.load(f)
    obj.setdefault("ok", True)
    obj.setdefault("orgId", safe)
    return jsonify(obj)


@app.put("/api/vault/<org_id>")
@app.post("/api/vault/<org_id>")
def vault_put(org_id):
    obj = request.get_json(silent=True)
    if not obj:
        return jsonify({"error": "missing json"}), 400
    safe = vault_safe(org_id)
    tickets = obj.get("tickets") if isinstance(obj.get("tickets"), list) else []
    payload = {
        "kind": "smartdoc-org-vault",
        "version": int(obj.get("version") or 1),
        "orgId": safe,
        "company": obj.get("company") or "",
        "tickets": tickets,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
    }
    path = os.path.join(VAULT_DIR, safe + ".json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return jsonify({"ok": True, "orgId": safe, "count": len(tickets)})


@app.post("/api/extract")
def api_extract():
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "missing file"}), 400
    name = f.filename or "upload.bin"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    data = f.read()
    t0 = time.time()
    try:
        if ext in ("xlsx", "xls"):
            fields, conf, text, method = extract_xlsx(data)
        elif ext == "pdf":
            fields, conf, text, method = extract_pdf(data)
        elif ext in ("png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"):
            fields, conf, text, method = extract_image(data)
        elif ext == "json":
            obj = json.loads(data.decode("utf-8-sig"))
            fields = empty_fields()
            conf = {}
            for k in fields:
                if obj.get(k):
                    fields[k] = str(obj[k])
                    conf[k] = 100
            if not fields.get("ticketNo"):
                fields["ticketNo"] = new_ticket()
            text = data.decode("utf-8-sig", errors="ignore")
            method = "JSON 字段映射"
        else:
            text = data.decode("utf-8-sig", errors="ignore")
            rows = [split_csv_line(line) for line in text.splitlines()]
            fields, conf, table_text = parse_table(rows)
            method = "CSV/文本解析"
            text = table_text or text
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(
        {
            "fields": fields,
            "conf": conf,
            "rawText": (text or "")[:4000],
            "method": method,
            "engine": "server",
            "elapsedMs": int((time.time() - t0) * 1000),
            "fileName": name,
        }
    )


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_proxy(path):
    full = os.path.join(ROOT, path)
    if os.path.isdir(full):
        path = os.path.join(path, "index.html")
    return send_from_directory(ROOT, path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8090"))
    print(f"SmartDoc http://127.0.0.1:{port}/")
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
