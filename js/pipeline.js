(function (w) {
  const FIELD_META = [
    { key: "shipper", label: "发货人 / Shipper", required: true },
    { key: "consignee", label: "收货人 / Consignee", required: true },
    { key: "notifyParty", label: "通知方 / Notify Party", required: true },
    { key: "containerNo", label: "柜号 / Container No.", required: true },
    { key: "sealNo", label: "封号 / Seal No.", required: false },
    { key: "hsCode", label: "HS编码 / HS Code", required: true },
    { key: "description", label: "品名 / Description", required: true },
    { key: "packages", label: "件数 / Packages", required: true },
    { key: "grossWeight", label: "毛重 / Gross Weight", required: true },
    { key: "volume", label: "体积 / Volume", required: false },
    { key: "pol", label: "起运港 / POL", required: true },
    { key: "pod", label: "目的港 / POD", required: true },
    { key: "vessel", label: "船名 / Vessel", required: false },
    { key: "voyage", label: "航次 / Voyage", required: false },
    { key: "etd", label: "开船时间 / ETD", required: false },
    { key: "eta", label: "预计到港 / ETA", required: false },
    { key: "tareWeight", label: "箱皮重 / Tare", required: false },
  ];

  const ALIASES = {
    ticketNo: ["ticket", "票号", "booking", "booking no", "bookingno", "ref", "reference", "托书号"],
    shipper: ["shipper", "发货人", "托运人", "exporter", "shipper name", "境内发货人", "卖方", "seller"],
    consignee: ["consignee", "收货人", "importer", "境外收货人", "买方", "buyer"],
    notifyParty: ["notify", "notify party", "notifyparty", "通知方", "通知人"],
    containerNo: ["container", "container no", "containerno", "柜号", "箱号", "集装箱号", "cntr"],
    sealNo: ["seal", "seal no", "sealno", "封号", "铅封"],
    hsCode: ["hs", "hs code", "hscode", "hts", "htsus", "商品编码", "海关编码", "hs编码", "税号"],
    description: ["description", "goods", "cargo", "commodity", "品名", "货名", "货物名称", "商品名称"],
    packages: ["packages", "package", "pkgs", "qty", "quantity", "件数", "包装", "cartons", "ctns"],
    grossWeight: ["gross weight", "grossweight", "gw", "weight", "毛重", "净重"],
    volume: ["volume", "cbm", "measurement", "meas", "体积", "尺码"],
    pol: ["pol", "port of loading", "loading port", "place of receipt", "起运港", "装货港", "发运港"],
    pod: ["pod", "port of discharge", "discharge port", "port of destination", "destination", "目的港", "卸货港", "指运港"],
    vessel: ["vessel", "vessel name", "vsl", "船名", "船名航次"],
    voyage: ["voyage", "voy", "voyage no", "航次"],
    etd: ["etd", "etd date", "sailing", "departure", "开船", "开船日", "预计开船"],
    eta: ["eta", "eta date", "arrival", "eta time", "到港", "预计到港", "到港日"],
    tareWeight: ["tare", "tare weight", "tareweight", "皮重", "箱皮重", "柜皮"],
  };

  const LINE_KEYS = ["hsCode", "description", "packages", "grossWeight", "volume"];

  function emptyShipment() {
    const o = { ticketNo: "", lines: [] };
    FIELD_META.forEach((f) => (o[f.key] = ""));
    return o;
  }

  function emptyLine() {
    const o = {};
    LINE_KEYS.forEach((k) => (o[k] = ""));
    return o;
  }

  function cleanLine(raw) {
    const o = emptyLine();
    LINE_KEYS.forEach((k) => {
      const v = raw && raw[k];
      o[k] = k === "hsCode" ? normalizeHs(v || "") : String(v || "").trim();
    });
    if (raw && raw.conf != null) o.conf = raw.conf;
    if (raw && raw.flagged) o.flagged = true;
    return o;
  }

  function lineFilled(l) {
    return !!(l && (String(l.description || "").trim() || String(l.hsCode || "").trim() || String(l.packages || "").trim()));
  }

  function normalizeLines(s) {
    const raw = s && Array.isArray(s.lines) ? s.lines : [];
    const lines = raw.map(cleanLine).filter(lineFilled).slice(0, 30);
    if (lines.length) return lines;
    if (s && (s.description || s.hsCode)) {
      return [cleanLine({
        hsCode: s.hsCode,
        description: s.description,
        packages: s.packages,
        grossWeight: s.grossWeight,
        volume: s.volume,
      })];
    }
    return [];
  }

  function sumQty(list, key) {
    let unit = "";
    let n = 0;
    let all = true;
    (list || []).forEach((l) => {
      const m = String(l[key] || "").match(/([\d,.]+)\s*([A-Za-z]*)/);
      if (!m) {
        all = false;
        return;
      }
      n += parseFloat(m[1].replace(/,/g, "")) || 0;
      if (m[2]) unit = m[2].toUpperCase();
    });
    if (!all || !(list || []).length) {
      return (list || []).map((l) => l[key]).filter(Boolean).join(" + ");
    }
    const rounded = Math.round(n * 1000) / 1000;
    return (String(rounded) + (unit ? " " + unit : "")).trim();
  }

  function rollupHeader(s) {
    const lines = normalizeLines(s);
    if (!s) return s;
    s.lines = lines;
    if (!lines.length) return s;
    if (lines.length === 1) {
      LINE_KEYS.forEach((k) => {
        if (lines[0][k]) s[k] = lines[0][k];
      });
    } else {
      s.description = (lines[0].description || "GOODS") + " +" + (lines.length - 1) + " SKU";
      s.hsCode = lines.map((l) => l.hsCode).filter(Boolean).join("; ");
      s.packages = sumQty(lines, "packages");
      s.grossWeight = sumQty(lines, "grossWeight");
      s.volume = sumQty(lines, "volume");
    }
    return s;
  }

  function linesLabel(s) {
    const ls = normalizeLines(s);
    if (!ls.length) return "";
    return ls.length + " 行 · " + ls.map((l) => l.description || l.hsCode || "—").join(" / ");
  }

  function linesSig(s) {
    return JSON.stringify(normalizeLines(s).map((l) => LINE_KEYS.map((k) => l[k] || "")));
  }

  function normKey(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[\s:：_\-\/#().]/g, "");
  }

  function aliasKey(header) {
    const n = normKey(header);
    if (!n || n.length > 48) return null;
    for (const [key, list] of Object.entries(ALIASES)) {
      for (const a of list) {
        if (n === normKey(a)) return key;
      }
    }
    const leftoverOk = /^(name|no|number|party|code|of|the)$/;
    for (const [key, list] of Object.entries(ALIASES)) {
      for (const a of list) {
        const na = normKey(a);
        if (na.length < 3 || !n.includes(na)) continue;
        const leftover = n.split(na).join("");
        if (!leftover || leftoverOk.test(leftover)) return key;
      }
    }
    return null;
  }

  function newTicket() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return "SH" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes());
  }

  function iso6346Digit(prefix10) {
    const c = String(prefix10 || "").toUpperCase().replace(/[\s-]/g, "").slice(0, 10);
    if (!/^[A-Z]{4}\d{6}$/.test(c)) return "";
    const map = {};
    let n = 10;
    for (let i = 0; i < 26; i++) {
      if (n % 11 === 0) n += 1;
      map[String.fromCharCode(65 + i)] = n;
      n += 1;
    }
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const ch = c[i];
      const val = /[A-Z]/.test(ch) ? map[ch] : parseInt(ch, 10);
      if (Number.isNaN(val)) return "";
      total += val * Math.pow(2, i);
    }
    let check = total % 11;
    if (check === 10) check = 0;
    return String(check);
  }

  function iso6346Valid(code) {
    const c = String(code || "").toUpperCase().replace(/[\s-]/g, "");
    if (!/^[A-Z]{4}\d{7}$/.test(c)) return false;
    return iso6346Digit(c.slice(0, 10)) === c[10];
  }

  function iso6346Fix(code) {
    const raw = String(code || "").toUpperCase().replace(/[\s-]/g, "");
    if (!raw) return "";
    const owner = raw.slice(0, 4).replace(/0/g, "O");
    const serial = raw.slice(4).replace(/O/g, "0").replace(/[IL]/g, "1").replace(/\D/g, "");
    if (!/^[A-Z]{4}$/.test(owner) || serial.length < 6) return "";
    const prefix10 = owner + serial.slice(0, 6);
    const d = iso6346Digit(prefix10);
    if (!d) return "";
    return prefix10 + d;
  }

  function hsFix(v) {
    const n = normalizeHs(v);
    return hsLooksValid(n) ? n : "";
  }

  function suggestFixes(s) {
    const items = [];
    if (!s) return items;
    const cn = String(s.containerNo || "").trim();
    if (cn && !iso6346Valid(cn)) {
      const to = iso6346Fix(cn);
      if (to && to !== cn) {
        items.push({ id: "hdr-container", scope: "header", field: "containerNo", from: cn, to, reason: "ISO 6346 校验位" });
      }
    }
    const hs = String(s.hsCode || "").trim();
    if (hs && !hsLooksValid(hs)) {
      const to = hsFix(hs);
      if (to && to !== hs) items.push({ id: "hdr-hs", scope: "header", field: "hsCode", from: hs, to, reason: "HS 点分格式" });
    }
    (s.lines || []).forEach((l, i) => {
      const lhs = String((l && l.hsCode) || "").trim();
      if (!lhs || hsLooksValid(lhs)) return;
      const to = hsFix(lhs);
      if (to && to !== lhs) {
        items.push({ id: "line-" + i + "-hs", scope: "line", index: i, field: "hsCode", from: lhs, to, reason: "HS 点分格式" });
      }
    });
    return items;
  }

  function normalizeHs(v) {
    const d = String(v || "").replace(/\D/g, "");
    if (d.length === 10) return d.slice(0, 4) + "." + d.slice(4, 6) + "." + d.slice(6);
    if (d.length === 8) return d.slice(0, 4) + "." + d.slice(4, 6) + "." + d.slice(6);
    return String(v || "").trim();
  }

  function hsLooksValid(v) {
    const s = String(v || "").trim();
    return /^\d{4}\.\d{2}\.\d{2,4}$/.test(s) || /^\d{8,10}$/.test(s);
  }

  function harvestFuzzyContainer(text, fields) {
    if (fields.containerNo && iso6346Valid(fields.containerNo)) return;
    const t = String(text || "").toUpperCase();
    const re = /\b([A-Z]{3}[UJZ])[\s\-]?([0-9OIL]{6,8})\b/g;
    let m;
    let fallback = "";
    while ((m = re.exec(t))) {
      let digits = m[2].replace(/O/g, "0").replace(/[IL]/g, "1");
      if (digits.length < 7) continue;
      digits = digits.slice(0, 7);
      const code = m[1] + digits;
      if (!/^[A-Z]{4}\d{7}$/.test(code)) continue;
      if (iso6346Valid(code)) {
        fields.containerNo = code;
        return;
      }
      if (!fallback) fallback = code;
    }
    if (!fields.containerNo && fallback) fields.containerNo = fallback;
  }

  function harvestRegex(text, fields) {
    const t = String(text || "");
    if (!fields.containerNo) {
      const m =
        t.match(/\b([A-Z]{4}[\s\-]?\d{7})\b/i) ||
        t.match(/\b([A-Z]{4}\u0020?\d{3}\u0020?\d{3}\u0020?\d)\b/i);
      if (m) fields.containerNo = m[1].toUpperCase().replace(/[\s-]/g, "");
    }
    harvestFuzzyContainer(t, fields);
    if (!fields.hsCode) {
      const m =
        t.match(/\b(\d{4}\.\d{2}\.\d{2,4})\b/) ||
        t.match(/\bHS[^\d]{0,8}(\d{8,10})\b/i) ||
        t.match(/\b(\d{4}[\s.]\d{2}[\s.]\d{4})\b/) ||
        t.match(/\b(8471\d{6}|9403\d{6}|8483\d{6}|6204\d{6}|6912\d{6})\b/);
      if (m) fields.hsCode = normalizeHs(m[1].replace(/\s/g, "."));
    }
    if (!fields.grossWeight) {
      const m = t.match(/([\d,.]+)\s*(KGS|KG|MT|TONS?)\b/i);
      if (m) fields.grossWeight = m[1] + " " + m[2].toUpperCase();
    }
    if (!fields.volume) {
      const m = t.match(/([\d,.]+)\s*(CBM|M3|M³)\b/i);
      if (m) fields.volume = m[1] + " CBM";
    }
    if (!fields.packages) {
      const m = t.match(/(\d+)\s*(CTNS|CARTONS|PKGS|PACKAGES|PLTS|PALLETS|件数)\b/i);
      if (m) fields.packages = m[1] + " " + String(m[2]).toUpperCase().replace("件数", "CTNS");
    }
  }

  function assignField(fields, conf, key, val, score) {
    if (!key || !val || fields[key]) return;
    fields[key] = key === "hsCode" ? normalizeHs(val) : val;
    conf[key] = score;
  }

  function splitCsvLine(line) {
    const s = String(line || "");
    if (s.includes("\t")) return s.split("\t").map((c) => c.trim());
    const once = s.split(/[,;]/);
    if (once.length >= 2 && aliasKey(once[0])) {
      const i = s.search(/[,;]/);
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    }
    return s.split(/[,;\t]/).map((c) => c.trim());
  }

  function parseLabeledText(text) {
    const fields = emptyShipment();
    const conf = {};
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const colonParts = line.split(/[:：\t]/);
      let key = aliasKey(colonParts[0]);
      let val = colonParts.slice(1).join(":").trim();
      if (key && val) {
        assignField(fields, conf, key, val, 98);
        continue;
      }
      const spaced = line.match(/^(.{2,32}?)[:：]?\s+([A-Za-z0-9].+)$/);
      if (spaced) {
        key = aliasKey(spaced[1]);
        if (key && spaced[2]) {
          assignField(fields, conf, key, spaced[2].trim(), 93);
          continue;
        }
      }
      key = aliasKey(line.replace(/[:：]\s*$/, ""));
      if (key && !fields[key] && i + 1 < lines.length) {
        const next = lines[i + 1];
        const nextHead = next.split(/[:：\t]/)[0];
        const nextKeyed = !!(aliasKey(nextHead) && /[:：]/.test(next));
        const nextLabelOnly = !!aliasKey(next.replace(/[:：]\s*$/, "")) && next.length < 28 && !/[0-9]/.test(next);
        if (!nextKeyed && !nextLabelOnly) {
          assignField(fields, conf, key, next, 88);
          i += 1;
        }
      }
    }

    harvestRegex(text, fields);
    FIELD_META.forEach((f) => {
      if (fields[f.key] && !conf[f.key]) conf[f.key] = 90;
    });
    if (!fields.ticketNo) fields.ticketNo = newTicket();
    if (fields.containerNo) fields.containerNo = fields.containerNo.toUpperCase().replace(/[\s-]/g, "");
    attachLines(fields, conf, text);
    return { fields, conf };
  }

  function parseTable(rows) {
    const fields = emptyShipment();
    const conf = {};
    if (!rows || !rows.length) return { fields, conf, text: "" };
    const clean = rows.map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? "" : String(c).trim())) : [String(r)]));
    const text = clean.map((r) => r.join("\t")).join("\n");

    let headerIdx = -1;
    let mapping = [];
    for (let i = 0; i < Math.min(clean.length, 12); i++) {
      const mapped = clean[i].map(aliasKey);
      const hits = mapped.filter(Boolean).length;
      if (hits >= 2) {
        headerIdx = i;
        mapping = mapped;
        break;
      }
    }
    if (headerIdx >= 0) {
      const cargoHits = mapping.filter((k) => LINE_KEYS.indexOf(k) >= 0).length;
      if (cargoHits >= 2) {
        const lines = [];
        for (let r = headerIdx + 1; r < clean.length; r++) {
          const dataRow = clean[r] || [];
          const line = emptyLine();
          let any = false;
          mapping.forEach((key, idx) => {
            if (!key || !dataRow[idx]) return;
            if (LINE_KEYS.indexOf(key) >= 0) {
              line[key] = key === "hsCode" ? normalizeHs(dataRow[idx]) : dataRow[idx];
              any = true;
            } else if (!fields[key]) {
              fields[key] = key === "hsCode" ? normalizeHs(dataRow[idx]) : dataRow[idx];
              conf[key] = 99;
            }
          });
          if (any && lineFilled(line)) lines.push(cleanLine(line));
        }
        if (lines.length) {
          fields.lines = lines;
          rollupHeader(fields);
          conf.description = 99;
          conf.hsCode = 99;
        }
      } else {
        const dataRow = clean[headerIdx + 1] || [];
        mapping.forEach((key, idx) => {
          if (key && dataRow[idx] && !fields[key]) {
            fields[key] = key === "hsCode" ? normalizeHs(dataRow[idx]) : dataRow[idx];
            conf[key] = 99;
          }
        });
      }
    }

    clean.forEach((r) => {
      if (r.length >= 2) {
        const key = aliasKey(r[0]);
        const val = r.slice(1).filter(Boolean).join(" ").trim();
        if (key && val && !fields[key]) {
          fields[key] = key === "hsCode" ? normalizeHs(val) : val;
          conf[key] = 97;
        }
      }
    });

    const labeled = parseLabeledText(text);
    Object.keys(labeled.fields).forEach((k) => {
      if (k === "lines") return;
      if (!fields[k] && labeled.fields[k]) {
        fields[k] = labeled.fields[k];
        conf[k] = labeled.conf[k] || 90;
      }
    });
    if ((!fields.lines || !fields.lines.length) && labeled.fields.lines && labeled.fields.lines.length) {
      fields.lines = labeled.fields.lines;
      rollupHeader(fields);
    }
    harvestRegex(text, fields);
    attachLines(fields, conf, text);
    if (!fields.ticketNo) fields.ticketNo = newTicket();
    if (fields.containerNo) fields.containerNo = fields.containerNo.toUpperCase().replace(/[\s-]/g, "");
    return { fields, conf, text };
  }

  function scoreLine(l) {
    const o = cleanLine(l);
    let score = typeof l.conf === "number" ? l.conf : 0;
    if (!score) {
      score = (o.hsCode ? 35 : 0) + (o.description.length >= 4 ? 25 : 0) + (o.packages ? 20 : 0) + (o.grossWeight ? 15 : 0) + (o.volume ? 5 : 0);
    }
    o.conf = Math.min(98, score);
    o.flagged = !!(l.flagged || o.conf < 80 || !o.description || !o.hsCode);
    return o;
  }

  function harvestCargoLines(text) {
    const rows = String(text || "")
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const out = [];
    const seen = {};
    const headerish = /^(no\.?|marks|#|item|description|goods|hs|hts|qty|pkgs|packages|gw|weight|cbm|volume|品名|税号|件数|毛重|体积|装箱单|packing)/i;
    rows.forEach((line) => {
      const colon = line.split(/[:：]/);
      if (colon.length >= 2) {
        const headKey = aliasKey(colon[0]);
        if (headKey) {
          const rest = colon.slice(1).join(":").trim();
          if (LINE_KEYS.indexOf(headKey) < 0) return;
          if (rest.split(/\s+/).length < 8) return;
        }
      }
      if (headerish.test(line) && !/\d{4}\.\d{2}/.test(line) && !/\d{8,10}/.test(line)) return;
      const hsM = line.match(/\b(\d{4}\.\d{2}\.\d{2,4}|\d{8,10})\b/);
      const gwM = line.match(/([\d,.]+)\s*(KGS|KG|MT)\b/i);
      const volM = line.match(/([\d,.]+)\s*(CBM|M3|M³)\b/i);
      const pkgM = line.match(/(\d[\d,]*)\s*(CTNS|CARTONS|PKGS|PACKAGES|PLTS|PALLETS|PCS|CARTON|件|箱)\b/i);
      const looksRow = (hsM && pkgM) || (hsM && gwM) || (pkgM && gwM && /[A-Za-z\u4e00-\u9fff]{4,}/.test(line));
      if (!looksRow) return;
      let desc = line
        .replace(/\b(\d{4}\.\d{2}\.\d{2,4}|\d{8,10})\b/, " ")
        .replace(/([\d,.]+)\s*(KGS|KG|MT)\b/gi, " ")
        .replace(/([\d,.]+)\s*(CBM|M3|M³)\b/gi, " ")
        .replace(/(\d[\d,]*)\s*(CTNS|CARTONS|PKGS|PACKAGES|PLTS|PALLETS|PCS|CARTON|件|箱)\b/gi, " ")
        .replace(/\b(HS|HTS|CODE|NO\.?|#)\b/gi, " ")
        .replace(/^[\d.\-)]+\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
      const lineObj = scoreLine({
        hsCode: hsM ? hsM[1] : "",
        description: desc.slice(0, 90),
        packages: pkgM ? pkgM[1].replace(/,/g, "") + " " + String(pkgM[2]).toUpperCase().replace("件", "CTNS").replace("箱", "CTNS") : "",
        grossWeight: gwM ? gwM[1] + " " + gwM[2].toUpperCase().replace(/^KG$/, "KGS") : "",
        volume: volM ? volM[1] + " CBM" : "",
      });
      const sig = LINE_KEYS.map((k) => lineObj[k]).join("|");
      if (seen[sig] || !lineFilled(lineObj)) return;
      seen[sig] = 1;
      out.push(lineObj);
    });
    return out.slice(0, 30);
  }

  function attachLines(fields, conf, text) {
    fields = fields || emptyShipment();
    conf = conf || {};
    let lines = Array.isArray(fields.lines) ? fields.lines.map(scoreLine).filter(lineFilled) : [];
    if (!lines.length) lines = harvestCargoLines(text);
    if (lines.length) {
      fields.lines = lines;
      rollupHeader(fields);
      const scores = lines.map((l) => l.conf || 70);
      conf.lines = Math.min.apply(null, scores);
    }
    return { fields, conf };
  }

  function sourceHash(s) {
    return FIELD_META.map((f) => String((s && s[f.key]) || "").trim()).join("|") + "|" + String((s && s.ticketNo) || "") + "|" + linesSig(s);
  }

  function snapshot(s) {
    const o = { ticketNo: s.ticketNo };
    FIELD_META.forEach((f) => (o[f.key] = s[f.key] || ""));
    o.lines = normalizeLines(s);
    return o;
  }

  function ruleOn(id) {
    return !w.SmartRules || w.SmartRules.on(id);
  }

  function buildCheck(source, generated, selectedDocs) {
    const currentHash = sourceHash(source);
    const rows = [];
    const fields = [{ key: "ticketNo", label: "票号 / Ticket", required: true }].concat(FIELD_META);
    const notifyRequired = ruleOn("notify") && selectedDocs.some((d) => d === "ams" || d === "bl");
    fields.forEach((meta) => {
      const row = { key: meta.key, label: meta.label, required: !!meta.required, source: String(source[meta.key] || "").trim() };
      selectedDocs.forEach((d) => {
        const g = generated[d];
        row[d] = g && g.fields ? String(g.fields[meta.key] || "").trim() : "";
        row[d + "_stale"] = !!(g && g.sourceHash && g.sourceHash !== currentHash);
      });
      const vals = selectedDocs.map((d) => row[d]);
      const present = vals.filter((v) => v && v !== "（未生成）");
      const hasEmpty = (meta.required || (meta.key === "notifyParty" && notifyRequired)) && vals.some((v) => !v);
      const unique = new Set(present.map((v) => v.toUpperCase()));
      let ruleWarn = "";
      if (ruleOn("iso6346") && meta.key === "containerNo" && row.source) {
        if (!/^[A-Z]{4}\d{7}$/.test(row.source)) ruleWarn = "柜号应为 4 位字母 + 7 位数字（ISO 6346）";
        else if (!iso6346Valid(row.source)) ruleWarn = "柜号校验位不正确（ISO 6346 check digit）";
      }
      if (ruleOn("hs") && meta.key === "hsCode" && row.source && !hsLooksValid(row.source)) {
        ruleWarn = "HS 编码建议采用 xxxx.xx.xxxx 格式";
      }
      if (ruleOn("notify") && meta.key === "notifyParty" && selectedDocs.includes("ams") && !row.source) {
        ruleWarn = "AMS 24h：Notify Party 为空，可能触发 DNL";
      }
      const stale = selectedDocs.some((d) => row[d + "_stale"]);
      row.ruleWarn = ruleWarn;
      row.stale = stale;
      row.hasEmpty = hasEmpty;
      row.mismatch = unique.size > 1;
      row.sourceMismatch = present.some((v) => v.toUpperCase() !== row.source.toUpperCase() && row.source);
      rows.push(row);
    });
    const srcLines = linesLabel(source);
    if (srcLines) {
      const row = { key: "lines", label: "货描明细行", required: false, source: srcLines };
      selectedDocs.forEach((d) => {
        const g = generated[d];
        row[d] = g && g.fields ? linesLabel(g.fields) : "";
        row[d + "_stale"] = !!(g && g.sourceHash && g.sourceHash !== currentHash);
      });
      const vals = selectedDocs.map((d) => row[d]);
      const unique = new Set(vals.filter(Boolean).map((v) => v.toUpperCase()));
      row.ruleWarn = "";
      row.stale = selectedDocs.some((d) => row[d + "_stale"]);
      row.hasEmpty = false;
      row.mismatch = unique.size > 1;
      row.sourceMismatch = vals.some((v) => v && v.toUpperCase() !== srcLines.toUpperCase());
      rows.push(row);
    }
    normalizeLines(source).forEach((l, i) => {
      if (ruleOn("hs") && l.hsCode && !hsLooksValid(l.hsCode)) {
        const row = { key: "line-hs-" + i, label: "明细 HS #" + (i + 1), required: false, source: l.hsCode, ruleWarn: "明细行 HS 格式未通过", stale: false, hasEmpty: false, mismatch: false, sourceMismatch: false };
        selectedDocs.forEach((d) => { row[d] = l.hsCode; });
        rows.push(row);
      }
    });
    const custom = (w.SmartRules && w.SmartRules.get().custom) || [];
    custom.filter((r) => r.enabled).forEach((r) => {
      const val = String(source[r.field] || "").trim();
      let fail = false;
      if (r.test === "regex") {
        try { fail = !(new RegExp(r.pattern)).test(val); } catch (e) { fail = true; }
      } else {
        fail = !val;
      }
      if (!fail) return;
      const row = { key: r.field, label: r.name, required: r.test !== "regex", source: val, ruleWarn: r.message || "未通过自定义规则", stale: false, hasEmpty: !val, mismatch: false, sourceMismatch: false };
      selectedDocs.forEach((d) => {
        const g = generated[d];
        row[d] = g && g.fields ? String(g.fields[r.field] || "").trim() : "";
      });
      rows.push(row);
    });
    return rows;
  }

  function mergeExtracts(results) {
    const fields = emptyShipment();
    const conf = {};
    const source = {};
    const rawParts = [];
    (results || []).forEach((r) => {
      if (!r || !r.fields) return;
      if (r.rawText) rawParts.push("----- " + (r.fileName || r.method || "file") + " -----\n" + r.rawText);
      const keys = Object.keys(emptyShipment()).filter((k) => k !== "lines");
      keys.forEach((k) => {
        const v = r.fields[k];
        const c = (r.conf && r.conf[k]) || (v ? 80 : 0);
        if (v && (!fields[k] || c > (conf[k] || 0))) {
          fields[k] = v;
          conf[k] = c;
          source[k] = r.fileName || r.method || "";
        }
      });
    });
    const allLines = [];
    (results || []).forEach((r) => {
      (normalizeLines(r.fields || {})).forEach((l) => {
        if (!allLines.some((x) => linesSig({ lines: [x] }) === linesSig({ lines: [l] }))) allLines.push(l);
      });
    });
    if (allLines.length) {
      fields.lines = allLines;
      rollupHeader(fields);
    }
    if (!fields.ticketNo) fields.ticketNo = newTicket();
    return {
      fields,
      conf,
      source,
      rawText: rawParts.join("\n"),
      method: "多文件合并 " + (results || []).length + " 份",
      engine: ((results || []).map((r) => r.engine).filter(Boolean)[0]) || "merge",
      files: (results || []).map((r) => r.fileName).filter(Boolean),
    };
  }

  w.SmartDoc = {
    FIELD_META,
    emptyShipment,
    parseLabeledText,
    parseTable,
    iso6346Digit,
    iso6346Valid,
    iso6346Fix,
    normalizeHs,
    hsLooksValid,
    hsFix,
    suggestFixes,
    sourceHash,
    snapshot,
    buildCheck,
    newTicket,
    harvestRegex,
    splitCsvLine,
    aliasKey,
    mergeExtracts,
    LINE_KEYS,
    emptyLine,
    normalizeLines,
    rollupHeader,
    linesLabel,
    linesSig,
    harvestCargoLines,
    attachLines,
    scoreLine,
  };
})(window);
