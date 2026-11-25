(function (w) {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((s) => s.src.includes(src))) return resolve();
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error("failed to load " + src));
      document.head.appendChild(el);
    });
  }

  async function health() {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  async function extractViaApi(file) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    const r = await fetch("/api/extract", { method: "POST", body: fd });
    if (!r.ok) throw new Error("api " + r.status);
    return r.json();
  }

  async function readAsText(file) {
    return await file.text();
  }

  async function loadFirst(urls) {
    let last = null;
    for (const src of urls) {
      try {
        await loadScript(src);
        return src;
      } catch (e) {
        last = e;
      }
    }
    throw last || new Error("script load failed");
  }

  async function extractSpreadsheet(file) {
    if (!w.XLSX) {
      await loadFirst([
        "vendor/xlsx.full.min.js",
        "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
      ]);
    }
    const buf = await file.arrayBuffer();
    const wb = w.XLSX.read(buf, { type: "array" });
    let fields = SmartDoc.emptyShipment();
    let conf = {};
    let text = "";
    wb.SheetNames.forEach((name) => {
      const rows = w.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
      const parsed = SmartDoc.parseTable(rows);
      text += "\n[" + name + "]\n" + parsed.text;
      Object.keys(parsed.fields).forEach((k) => {
        if (parsed.fields[k] && !fields[k]) {
          fields[k] = parsed.fields[k];
          conf[k] = parsed.conf[k] || 96;
        }
      });
    });
    const labeled = SmartDoc.parseLabeledText(text);
    Object.keys(labeled.fields).forEach((k) => {
      if (!fields[k] && labeled.fields[k]) {
        fields[k] = labeled.fields[k];
        conf[k] = labeled.conf[k];
      }
    });
    if (!fields.ticketNo) fields.ticketNo = SmartDoc.newTicket();
    return { fields, conf, rawText: text.slice(0, 4000), method: "Excel 表格解析" };
  }

  async function extractPdfClient(file) {
    if (!w.pdfjsLib) {
      const src = await loadFirst([
        "vendor/pdf.min.js",
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
      ]);
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = src.includes("cdn.jsdelivr.net")
        ? "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
        : "vendor/pdf.worker.min.js";
    } else if (!w.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
    }
    const data = await file.arrayBuffer();
    const pdf = await w.pdfjsLib.getDocument({ data }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    if (text.replace(/\s/g, "").length >= 40) {
      const parsed = SmartDoc.parseLabeledText(text);
      return { fields: parsed.fields, conf: parsed.conf, rawText: text.slice(0, 4000), method: "PDF 文本提取" };
    }
    let ocrText = text + "\n";
    await ensureTesseract();
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const { data: res } = await w.Tesseract.recognize(canvas, "eng", { logger: () => {} });
      ocrText += (res && res.text) || "";
    }
    const parsed = SmartDoc.parseLabeledText(ocrText);
    return { fields: parsed.fields, conf: parsed.conf, rawText: ocrText.slice(0, 4000), method: "PDF OCR（浏览器）" };
  }

  async function ensureTesseract() {
    if (w.Tesseract) return;
    const cdns = [
      "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
      "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js",
    ];
    let last = null;
    for (const src of cdns) {
      try {
        await loadScript(src);
        if (w.Tesseract) return;
      } catch (e) {
        last = e;
      }
    }
    throw last || new Error("Tesseract 加载失败");
  }

  async function extractImageClient(file) {
    await ensureTesseract();
    const { data } = await w.Tesseract.recognize(file, "eng", { logger: () => {} });
    const text = (data && data.text) || "";
    const parsed = SmartDoc.parseLabeledText(text);
    return { fields: parsed.fields, conf: parsed.conf, rawText: text.slice(0, 4000), method: "图片 OCR（浏览器）" };
  }

  async function extractFromFile(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const api = await health();
    if (api && api.ok) {
      try {
        return await extractViaApi(file);
      } catch (e) {
        /* fall through to browser parsers */
      }
    }
    if (["csv", "txt"].includes(ext)) {
      const text = await readAsText(file);
      const parsed = SmartDoc.parseLabeledText(text);
      const table = SmartDoc.parseTable(text.split(/\r?\n/).map((l) => SmartDoc.splitCsvLine(l)));
      const fields = { ...parsed.fields };
      Object.keys(table.fields).forEach((k) => {
        if (table.fields[k]) fields[k] = table.fields[k];
      });
      return { fields, conf: { ...table.conf, ...parsed.conf }, rawText: text.slice(0, 4000), method: "CSV/文本解析", engine: "browser" };
    }
    if (ext === "json") {
      const text = await readAsText(file);
      const obj = JSON.parse(text);
      const fields = SmartDoc.emptyShipment();
      Object.keys(fields).forEach((k) => {
        if (obj[k]) fields[k] = String(obj[k]);
      });
      if (!fields.ticketNo) fields.ticketNo = SmartDoc.newTicket();
      const conf = {};
      Object.keys(fields).forEach((k) => {
        if (fields[k]) conf[k] = 100;
      });
      return { fields, conf, rawText: text.slice(0, 4000), method: "JSON 字段映射", engine: "browser" };
    }
    if (["xlsx", "xls"].includes(ext)) return extractSpreadsheet(file);
    if (ext === "pdf") return extractPdfClient(file);
    if (["png", "jpg", "jpeg", "webp", "bmp"].includes(ext)) return extractImageClient(file);
    const text = await readAsText(file).catch(() => "");
    const parsed = SmartDoc.parseLabeledText(text);
    return { fields: parsed.fields, conf: parsed.conf, rawText: text.slice(0, 4000), method: "通用文本解析", engine: "browser" };
  }

  w.SmartExtract = { extractFromFile, health };
})(window);
