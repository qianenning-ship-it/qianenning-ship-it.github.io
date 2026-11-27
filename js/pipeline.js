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
  };

  function emptyShipment() {
    const o = { ticketNo: "" };
    FIELD_META.forEach((f) => (o[f.key] = ""));
    return o;
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

  function iso6346Valid(code) {
    const c = String(code || "").toUpperCase().replace(/[\s-]/g, "");
    if (!/^[A-Z]{4}\d{7}$/.test(c)) return false;
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
      total += val * Math.pow(2, i);
    }
    let check = total % 11;
    if (check === 10) check = 0;
    return check === parseInt(c[10], 10);
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
      const dataRow = clean[headerIdx + 1] || [];
      mapping.forEach((key, idx) => {
        if (key && dataRow[idx] && !fields[key]) {
          fields[key] = key === "hsCode" ? normalizeHs(dataRow[idx]) : dataRow[idx];
          conf[key] = 99;
        }
      });
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
      if (!fields[k] && labeled.fields[k]) {
        fields[k] = labeled.fields[k];
        conf[k] = labeled.conf[k] || 90;
      }
    });
    harvestRegex(text, fields);
    if (!fields.ticketNo) fields.ticketNo = newTicket();
    if (fields.containerNo) fields.containerNo = fields.containerNo.toUpperCase().replace(/[\s-]/g, "");
    return { fields, conf, text };
  }

  function sourceHash(s) {
    return FIELD_META.map((f) => String((s && s[f.key]) || "").trim()).join("|") + "|" + String((s && s.ticketNo) || "");
  }

  function snapshot(s) {
    const o = { ticketNo: s.ticketNo };
    FIELD_META.forEach((f) => (o[f.key] = s[f.key] || ""));
    return o;
  }

  function buildCheck(source, generated, selectedDocs) {
    const currentHash = sourceHash(source);
    const rows = [];
    const fields = [{ key: "ticketNo", label: "票号 / Ticket", required: true }].concat(FIELD_META);
    fields.forEach((meta) => {
      const row = { key: meta.key, label: meta.label, required: !!meta.required, source: String(source[meta.key] || "").trim() };
      selectedDocs.forEach((d) => {
        const g = generated[d];
        row[d] = g && g.fields ? String(g.fields[meta.key] || "").trim() : "";
        row[d + "_stale"] = !!(g && g.sourceHash && g.sourceHash !== currentHash);
      });
      const vals = selectedDocs.map((d) => row[d]);
      const present = vals.filter((v) => v && v !== "（未生成）");
      const hasEmpty = meta.required && vals.some((v) => !v);
      const unique = new Set(present.map((v) => v.toUpperCase()));
      let ruleWarn = "";
      if (meta.key === "containerNo" && row.source) {
        if (!/^[A-Z]{4}\d{7}$/.test(row.source)) ruleWarn = "柜号应为 4 位字母 + 7 位数字（ISO 6346）";
        else if (!iso6346Valid(row.source)) ruleWarn = "柜号校验位不正确（ISO 6346 check digit）";
      }
      if (meta.key === "hsCode" && row.source && !hsLooksValid(row.source)) {
        ruleWarn = "HS 编码建议采用 xxxx.xx.xxxx 格式";
      }
      const stale = selectedDocs.some((d) => row[d + "_stale"]);
      row.ruleWarn = ruleWarn;
      row.stale = stale;
      row.hasEmpty = hasEmpty;
      row.mismatch = unique.size > 1;
      row.sourceMismatch = present.some((v) => v.toUpperCase() !== row.source.toUpperCase() && row.source);
      rows.push(row);
    });
    return rows;
  }

  w.SmartDoc = {
    FIELD_META,
    emptyShipment,
    parseLabeledText,
    parseTable,
    iso6346Valid,
    normalizeHs,
    hsLooksValid,
    sourceHash,
    snapshot,
    buildCheck,
    newTicket,
    harvestRegex,
    splitCsvLine,
    aliasKey,
  };
})(window);
