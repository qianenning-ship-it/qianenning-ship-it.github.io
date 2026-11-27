(function (w) {
  const CSS_BODY = `
body{font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#0f172a;padding:8px}
.sheet{border:2px solid #0f172a;padding:18px 20px;max-width:190mm;margin:0 auto;background:#fff}
.sheet-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #006aff;padding-bottom:10px;margin-bottom:12px}
.mark{width:36px;height:36px;background:#006aff;color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800}
.sheet-head h1{font-size:18px;margin:0 0 4px}
.sheet-head p{margin:0;font-size:11px;color:#64748b}
.grid2{display:grid;grid-template-columns:1fr 1fr}
.cell{border:1px solid #cbd5e1;padding:8px 10px;min-height:52px}
.lbl{font-size:10px;color:#64748b;letter-spacing:.04em;margin-bottom:4px}
.val{font-size:13px;font-weight:700;word-break:break-word}
table.cargo{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
table.cargo th,table.cargo td{border:1px solid #cbd5e1;padding:7px;text-align:left}
table.cargo th{background:#f1f5f9;font-size:11px}
table.cargo tfoot td{font-weight:700;background:#f8fafc}
.clause{margin-top:12px;font-size:10px;color:#475569;line-height:1.45}
.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:28px;font-size:11px}
.sign .line{border-top:1px solid #0f172a;margin-top:36px;padding-top:6px}
.badge{display:inline-block;background:#e8f1ff;color:#006aff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px}
.sheet-foot{margin:12px auto 0;padding:8px 4px 0;border-top:1px dashed #94a3b8;font-size:9px;color:#64748b;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;max-width:190mm}
.print-bar{text-align:center;margin:0 0 10px}
.print-bar button{background:#006aff;color:#fff;border:0;border-radius:6px;padding:8px 16px;font-size:13px;cursor:pointer}
@media print{body{padding:0}.no-print{display:none!important} .sheet{border-width:1.5px;max-width:none} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

  const PRINT_PAGE = {
    generic: { size: "A4", margin: "12mm" },
    cosco: { size: "A4", margin: "12mm 12mm 12mm 20mm" },
    msc: { size: "A4", margin: "15mm 14mm 18mm 14mm" },
    maersk: { size: "A4", margin: "10mm 16mm 14mm 16mm" },
    oocl: { size: "A4", margin: "12mm 14mm 16mm 14mm" },
    cma: { size: "A4", margin: "14mm 12mm 16mm 18mm" },
    hapag: { size: "A4", margin: "12mm 15mm 14mm 15mm" },
    one: { size: "A4", margin: "11mm 13mm 15mm 13mm" },
    evergreen: { size: "A4", margin: "13mm 12mm 16mm 16mm" },
    wanhai: { size: "A4", margin: "12mm 14mm 15mm 14mm" },
    yangming: { size: "A4", margin: "11mm 15mm 14mm 15mm" },
    zim: { size: "A4", margin: "12mm 13mm 15mm 16mm" },
    hmm: { size: "A4", margin: "14mm 12mm 16mm 14mm" },
    sud: { size: "A4", margin: "13mm 15mm 14mm 13mm" },
  };

  function cssFor(carrierId) {
    const p = PRINT_PAGE[carrierId] || PRINT_PAGE.generic;
    return `@page{size:${p.size};margin:${p.margin}}\n` + CSS_BODY;
  }

  const CSS = cssFor("generic");

  function e(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cell(label, value) {
    return `<div class="cell"><div class="lbl">${label}</div><div class="val">${e(value) || "—"}</div></div>`;
  }

  function marksOf(s) {
    const v = String((s && s.marks) || "").trim();
    if (v) return v;
    return String((s && (s.containerNo || s.ticketNo)) || "").trim();
  }

  function marksHtml(s) {
    return e(marksOf(s)).replace(/\n/g, "<br>");
  }

  function containersOf(s) {
    if (w.SmartDoc && w.SmartDoc.normalizeContainers) return w.SmartDoc.normalizeContainers(s);
    if (s && s.containerNo) return [{ containerNo: s.containerNo, sealNo: s.sealNo || "", tareWeight: s.tareWeight || "" }];
    return [];
  }

  function cnText(s) {
    const list = containersOf(s);
    if (!list.length) return ((s.containerNo || "") + (s.sealNo ? " / " + s.sealNo : "")).trim();
    return list.map((c) => c.containerNo + (c.sealNo ? " / " + c.sealNo : "")).join("; ");
  }

  function parseMoney(v) {
    const m = String(v || "").replace(/,/g, "").match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function moneyLabel(n, cur) {
    if (!n && n !== 0) return "";
    const c = String(cur || "USD").trim() || "USD";
    return c + " " + (Math.round(n * 100) / 100).toFixed(2);
  }

  function lineAmount(l, s) {
    const cur = (s && s.currency) || "USD";
    if (l && String(l.amount || "").trim()) return String(l.amount).trim();
    const qty = parseKg(l && l.packages);
    const price = parseMoney(l && l.unitPrice);
    if (qty && price) return moneyLabel(qty * price, cur);
    return "";
  }

  function invoiceOf(s) {
    const currency = String((s && s.currency) || "USD").trim() || "USD";
    const incoterms = String((s && s.incoterms) || "FOB").trim() || "FOB";
    const ls = cargoLines(s).map((l) => {
      const amount = lineAmount(l, s);
      return Object.assign({}, l, { unitPrice: l.unitPrice || "", amount: amount });
    });
    let subtotal = 0;
    ls.forEach((l) => { subtotal += parseMoney(l.amount); });
    const taxRate = parseMoney(s && s.taxRate);
    const discount = parseMoney(s && s.discount);
    const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((Math.max(0, subtotal - discount) + tax) * 100) / 100;
    return {
      currency,
      incoterms,
      lines: ls,
      subtotal,
      discount,
      taxRate,
      tax,
      total,
      subtotalLabel: subtotal ? moneyLabel(subtotal, currency) : "",
      discountLabel: discount ? moneyLabel(discount, currency) : "",
      taxLabel: tax ? moneyLabel(tax, currency) : "",
      totalLabel: (total || subtotal) ? moneyLabel(total, currency) : "",
    };
  }

  function originCountryOf(s) {
    return String((s && s.originCountry) || "").trim() || "CHINA";
  }

  function originCriterionOf(s) {
    return String((s && s.originCriterion) || "").trim();
  }

  function coCertOf(s) {
    const v = String((s && s.coCertNo) || "").trim();
    if (v) return v;
    return "COO" + String((s && s.ticketNo) || "").replace(/^SH/, "");
  }

  function coIssuerOf(s) {
    return String((s && s.coIssuer) || "").trim();
  }

  function dgOf(s) {
    const imo = String((s && s.imoClass) || "").trim();
    const rawUn = String((s && s.unNumber) || "").trim().toUpperCase().replace(/\s+/g, "");
    const un = rawUn ? (rawUn.indexOf("UN") === 0 ? rawUn : "UN" + rawUn.replace(/^UN/, "")) : "";
    const pg = String((s && s.packingGroup) || "").trim().toUpperCase();
    const has = !!(imo || un);
    const bits = [];
    if (imo) bits.push("IMO Class " + imo);
    if (un) bits.push(un);
    if (pg) bits.push("Packing Group " + pg);
    const clause = has
      ? ("DANGEROUS GOODS: " + bits.join(" / ") + ". Shipper's DG declaration to be attached. 危险品条款由档案 IMO / UN 写入，未填则不生成。")
      : "";
    return { imoClass: imo, unNumber: un, packingGroup: pg, has: has, clause: clause };
  }

  function cargoLines(s) {
    const ls = (w.SmartDoc && w.SmartDoc.normalizeLines(s)) || [];
    if (ls.length) return ls;
    return [{
      hsCode: s.hsCode,
      description: s.description,
      packages: s.packages,
      grossWeight: s.grossWeight,
      volume: s.volume,
    }];
  }

  function parseKg(v) {
    const m = String(v || "").replace(/,/g, "").match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function vgmList(s) {
    const list = containersOf(s);
    const headerCargo = parseKg(s.grossWeight);
    const n = list.length || 1;
    const rows = (list.length ? list : [{ containerNo: s.containerNo, sealNo: s.sealNo, tareWeight: s.tareWeight }]).map((c) => {
      const cargo = parseKg(c.grossWeight) || (headerCargo / n);
      const tare = parseKg(c.tareWeight) || parseKg(s.tareWeight) || 3800;
      const vgm = Math.round((cargo + tare) * 100) / 100;
      return {
        containerNo: c.containerNo || "",
        sealNo: c.sealNo || "",
        type: c.type || "",
        cargo,
        tare,
        vgm,
        cargoLabel: cargo ? cargo.toFixed(0) + " KGS" : (s.grossWeight || "—"),
        tareLabel: tare.toFixed(0) + " KGS",
        label: vgm.toFixed(0) + " KGS",
      };
    });
    return rows;
  }

  function vgmOf(s) {
    const list = vgmList(s);
    const cargo = list.reduce((a, r) => a + (r.cargo || 0), 0);
    const tare = list.reduce((a, r) => a + (r.tare || 0), 0);
    const vgm = Math.round((cargo + tare) * 100) / 100;
    return {
      cargo,
      tare,
      vgm,
      list,
      label: vgm.toFixed(0) + " KGS",
      tareLabel: tare.toFixed(0) + " KGS",
      cargoLabel: cargo ? cargo.toFixed(0) + " KGS" : (s.grossWeight || "—"),
    };
  }

  function etaOf(s) {
    if (s.eta) return s.eta;
    if (!s.etd) return "";
    const d = new Date(s.etd);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + 14);
    const iso = d.toISOString();
    return iso.slice(0, 16);
  }

  function fmtWhen(v) {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toISOString().slice(0, 16).replace("T", " ");
  }

  function cargoTableHtml(s, kind) {
    const ls = cargoLines(s);
    if (kind === "export") {
      const body = ls.map((l) => `<tr><td>${e(l.hsCode)}</td><td>${e(l.description)}</td><td>${e(l.packages)}</td><td>${e(l.grossWeight)}</td><td>${e(l.volume)}</td></tr>`).join("");
      return `<table class="cargo"><thead><tr><th>商品编号 (HS)</th><th>商品名称及规格型号</th><th>件数</th><th>毛重</th><th>体积</th></tr></thead><tbody>${body}</tbody></table>`;
    }
    if (kind === "ams") {
      const body = ls.map((l) => `<tr><td>${e(l.hsCode)}</td><td>${e(l.description)}</td><td>${e(l.packages)}</td><td>${e(l.grossWeight)}</td></tr>`).join("");
      return `<table class="cargo"><thead><tr><th>HTS</th><th>Cargo Description</th><th>Quantity</th><th>Gross Weight</th></tr></thead><tbody>${body}</tbody></table>`;
    }
    if (kind === "co") {
      const oc = originCriterionOf(s) || "—";
      const mk = marksHtml(s);
      const body = ls.map((l, i) => `<tr><td>${i === 0 ? mk : ""}</td><td>${e(l.description)}</td><td>${e(l.hsCode)}</td><td>${e(l.packages)}</td><td>${e(l.grossWeight)}</td><td>${e(oc)}</td></tr>`).join("");
      return `<table class="cargo"><thead><tr><th>Marks</th><th>Description of Goods</th><th>HS</th><th>Pkgs</th><th>G.W.</th><th>Origin Criterion</th></tr></thead><tbody>${body}</tbody></table>`;
    }
    if (kind === "pl" || kind === "ci") {
      const inv = invoiceOf(s);
      let pkgs = 0, gw = 0, vol = 0;
      const mk = marksHtml(s);
      const body = inv.lines.map((l, i) => {
        pkgs += parseKg(l.packages);
        gw += parseKg(l.grossWeight);
        vol += parseKg(l.volume);
        return `<tr><td>${i === 0 ? mk : ""}</td><td>${e(l.description)}</td><td>${e(l.hsCode)}</td><td>${e(l.packages)}</td><td>${e(l.grossWeight)}</td><td>${e(l.volume)}</td><td>${e(l.unitPrice)}</td><td>${e(l.amount)}</td></tr>`;
      }).join("");
      const money = kind === "pl" ? (inv.subtotalLabel || inv.totalLabel || "—") : (inv.subtotalLabel || inv.totalLabel || "—");
      let foot = `<tfoot><tr><td colspan="3">TOTAL</td><td>${pkgs || "—"}</td><td>${gw ? gw + " KGS" : "—"}</td><td>${vol ? vol.toFixed(2) + " CBM" : "—"}</td><td></td><td>${e(money)}</td></tr>`;
      if (kind === "ci" && (inv.discount || inv.tax)) {
        if (inv.discount) foot += `<tr><td colspan="7">Discount</td><td>- ${e(inv.discountLabel)}</td></tr>`;
        if (inv.tax) foot += `<tr><td colspan="7">Tax ${e(String(inv.taxRate))}%</td><td>${e(inv.taxLabel)}</td></tr>`;
        foot += `<tr><td colspan="7">Grand Total</td><td>${e(inv.totalLabel || "—")}</td></tr>`;
      }
      foot += `</tfoot></table>`;
      return `<table class="cargo"><thead><tr><th>Marks</th><th>Description of Goods</th><th>HS</th><th>Pkgs</th><th>G.W.</th><th>Meas.</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>${body}</tbody>
        ${foot}`;
    }
    const mk = marksHtml(s);
    const body = ls.map((l, i) => `<tr><td>${i === 0 ? mk : ""}</td><td>${e(l.packages)}</td><td>${e(l.description)}<br>HS ${e(l.hsCode)}</td><td>${e(l.grossWeight)}</td><td>${e(l.volume)}</td></tr>`).join("");
    return `<table class="cargo"><thead><tr><th>Marks</th><th>No. of Pkgs</th><th>Description of Goods / HS</th><th>Gross Weight</th><th>Measurement</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  const CARRIERS = {
    generic: { id: "generic", name: "通用套版", scac: "SDTU", mark: "智", color: "#006aff", title: "OCEAN BILL OF LADING (DRAFT)", legal: "Shipped on board in apparent good order. Freight as arranged. SmartDoc homologous draft — not a signed original B/L." },
    cosco: { id: "cosco", name: "COSCO SHIPPING", scac: "COSU", mark: "中", color: "#c41e3a", title: "COSCO SHIPPING BILL OF LADING", legal: "COSCO SHIPPING Lines Co., Ltd. Combined Transport B/L (draft). Terms of carriage as per COSCO bill of lading. This copy is generated from a SmartDoc archive for checking only." },
    msc: { id: "msc", name: "MSC", scac: "MSCU", mark: "M", color: "#003366", title: "MEDITERRANEAN SHIPPING COMPANY B/L", legal: "Mediterranean Shipping Company S.A. Bill of Lading (non-negotiable draft). Particulars furnished by the shipper. Not valid for negotiation until signed by the carrier." },
    maersk: { id: "maersk", name: "MAERSK", scac: "MAEU", mark: "★", color: "#42b0d5", title: "MAERSK LINE BILL OF LADING", legal: "Maersk A/S transport document (draft). Contract of carriage subject to Maersk Bill of Lading terms. For document check and pre-alert only." },
    oocl: { id: "oocl", name: "OOCL", scac: "OOLU", mark: "O", color: "#c8102e", title: "OOCL BILL OF LADING", legal: "Orient Overseas Container Line (draft). Particulars furnished by the merchant. This copy is generated from a SmartDoc archive for checking only." },
    cma: { id: "cma", name: "CMA CGM", scac: "CMAU", mark: "C", color: "#003da5", title: "CMA CGM BILL OF LADING", legal: "CMA CGM S.A. Bill of Lading (non-negotiable draft). Particulars furnished by the merchant. This copy is generated from a SmartDoc archive for checking only." },
    hapag: { id: "hapag", name: "HAPAG-LLOYD", scac: "HLCU", mark: "H", color: "#ff6600", title: "HAPAG-LLOYD BILL OF LADING", legal: "Hapag-Lloyd AG Bill of Lading (draft). Contract of carriage subject to Hapag-Lloyd bill of lading terms. For document check and pre-alert only." },
    one: { id: "one", name: "ONE", scac: "ONEY", mark: "1", color: "#e6007e", title: "OCEAN NETWORK EXPRESS B/L", legal: "Ocean Network Express Pte. Ltd. Bill of Lading (draft). Particulars furnished by the shipper. Not valid for negotiation until signed by the carrier." },
    evergreen: { id: "evergreen", name: "EVERGREEN", scac: "EGLV", mark: "E", color: "#006633", title: "EVERGREEN LINE BILL OF LADING", legal: "Evergreen Line Bill of Lading (draft). Particulars furnished by the merchant. This copy is generated from a SmartDoc archive for checking only." },
    wanhai: { id: "wanhai", name: "WAN HAI", scac: "WHLC", mark: "W", color: "#e87722", title: "WAN HAI LINES BILL OF LADING", legal: "Wan Hai Lines Ltd. Bill of Lading (draft). Contract of carriage subject to Wan Hai bill of lading terms. For document check and pre-alert only." },
    yangming: { id: "yangming", name: "YANG MING", scac: "YMLU", mark: "Y", color: "#9e1b32", title: "YANG MING MARINE TRANSPORT B/L", legal: "Yang Ming Marine Transport Corporation Bill of Lading (draft). Particulars furnished by the shipper. Not valid for negotiation until signed by the carrier." },
    zim: { id: "zim", name: "ZIM", scac: "ZIMU", mark: "Z", color: "#003087", title: "ZIM INTEGRATED SHIPPING B/L", legal: "ZIM Integrated Shipping Services Ltd. Bill of Lading (draft). Particulars furnished by the merchant. This copy is generated from a SmartDoc archive for checking only." },
    hmm: { id: "hmm", name: "HMM", scac: "HDMU", mark: "韩", color: "#00a0e9", title: "HMM BILL OF LADING", legal: "HMM Company Limited Bill of Lading (draft). Contract of carriage subject to HMM bill of lading terms. For document check and pre-alert only." },
    sud: { id: "sud", name: "HAMBURG SÜD", scac: "SUDU", mark: "S", color: "#e30613", title: "HAMBURG SÜD BILL OF LADING", legal: "Hamburg Südamerikanische Dampfschifffahrts-Gesellschaft Bill of Lading (draft). Particulars furnished by the shipper. Not valid for negotiation until signed by the carrier." },
  };

  const OWNER_CARRIER = {
    COSU: "cosco", CBHU: "cosco",
    MSCU: "msc",
    MAEU: "maersk", MSKU: "maersk", MRKU: "maersk", MWHU: "maersk",
    OOCU: "oocl", OOLU: "oocl",
    CMAU: "cma",
    HLCU: "hapag",
    ONEU: "one", ONEY: "one",
    EGLV: "evergreen", EMCU: "evergreen", EISU: "evergreen", EITU: "evergreen", EGSU: "evergreen",
    WHLU: "wanhai", WHLC: "wanhai",
    YMLU: "yangming", YMMU: "yangming",
    ZIMU: "zim", ZCSU: "zim",
    HMMU: "hmm", HDMU: "hmm",
    SUDU: "sud", SANU: "sud",
  };

  function ownerCode(containerNo) {
    return String(containerNo || "").toUpperCase().replace(/[\s-]/g, "").replace(/0/g, "O").slice(0, 4);
  }

  function carrierFromOwner(containerNo) {
    const owner = ownerCode(containerNo);
    if (!/^[A-Z]{4}$/.test(owner)) return "";
    return OWNER_CARRIER[owner] || "";
  }

  function head(title, sub, ticket, carrier) {
    const c = CARRIERS[carrier] || CARRIERS.generic;
    return `<div class="sheet-head" style="border-color:${c.color}">
      <div style="display:flex;gap:10px;align-items:center">
        <div class="mark" style="background:${c.color}">${c.mark}</div>
        <div><h1>${e(title)}</h1><p>${e(sub)}</p></div>
      </div>
      <div style="text-align:right"><span class="badge" style="background:${c.color}22;color:${c.color}">${e(c.name)} · SCAC ${e(c.scac)}</span><p style="margin-top:6px">票号 ${e(ticket)}</p></div>
    </div>`;
  }

  function buildBl(s, carrierId) {
    const c = CARRIERS[carrierId] || CARRIERS.generic;
    const blNo = (c.scac || "SHSE") + String(s.ticketNo || "").replace(/^SH/, "");
    const dg = dgOf(s);
    return `<div class="sheet" style="border-color:${c.color}">
      ${head(c.title, "非可转让草稿 · " + c.name + " 套版 · A4 " + (PRINT_PAGE[c.id] || PRINT_PAGE.generic).margin, s.ticketNo, c.id)}
      <div class="grid2">
        ${cell("B/L No.", blNo)}${cell("Booking / Ticket", s.ticketNo)}
        ${cell("Shipper / Exporter", s.shipper)}${cell("Consignee", s.consignee)}
        ${cell("Notify Party", s.notifyParty)}${cell("Place of Receipt / POL", s.pol)}
        ${cell("Port of Discharge / POD", s.pod)}${cell("Container / Seal", cnText(s))}
        ${cell("Vessel / Voyage", (s.vessel || "") + " / " + (s.voyage || ""))}${cell("ETD", s.etd)}
      </div>
      ${cargoTableHtml(s, "bl")}
      <p class="clause">${e(c.legal)}</p>
      ${dg.clause ? `<p class="clause" style="font-weight:700;color:#9a3412">${e(dg.clause)}</p>` : ""}
      <div class="sign"><div><div class="line">Shipper</div></div><div><div class="line">${e(c.name)} / Agent</div></div><div><div class="line">Date / Place</div></div></div>
    </div>`;
  }

  function buildPl(s) {
    return `<div class="sheet">
      ${head("PACKING LIST / 装箱单", "Homologous packing list · 与提单货描同源", s.ticketNo)}
      <div class="grid2">
        ${cell("Invoice / Ticket", s.ticketNo)}${cell("Date", fmtWhen(new Date().toISOString()))}
        ${cell("Shipper", s.shipper)}${cell("Consignee", s.consignee)}
        ${cell("POL → POD", (s.pol || "") + " → " + (s.pod || ""))}${cell("Container / Seal", cnText(s))}
        ${cell("Vessel / Voyage", (s.vessel || "") + " / " + (s.voyage || ""))}${cell("Marks & Nos.", marksOf(s))}
      </div>
      ${cargoTableHtml(s, "pl")}
      <p class="clause">本装箱单由智单通按货物档案货描明细同源生成，件数 / 毛重 / 体积与提单、报关草稿一致。非正式签章件。</p>
      <div class="sign"><div><div class="line">Shipper</div></div><div><div class="line">Packed by</div></div><div><div class="line">Date</div></div></div>
    </div>`;
  }

  function buildVgm(s) {
    const v = vgmOf(s);
    const extra = (v.list && v.list.length > 1)
      ? `<table class="cargo"><thead><tr><th>Container</th><th>Seal</th><th>Cargo GW</th><th>Tare</th><th>VGM</th></tr></thead><tbody>${
        v.list.map((r) => `<tr><td>${e(r.containerNo)}</td><td>${e(r.sealNo)}</td><td>${e(r.cargoLabel)}</td><td>${e(r.tareLabel)}</td><td>${e(r.label)}</td></tr>`).join("")
      }</tbody></table>`
      : cargoTableHtml(s, "ams");
    return `<div class="sheet">
      ${head("VERIFIED GROSS MASS (VGM)", "SOLAS VI/2 · Method 2 货重 + 箱皮" + (v.list && v.list.length > 1 ? " · " + v.list.length + " 柜" : ""), s.ticketNo)}
      <div class="grid2">
        ${cell("Booking / B/L Ref.", s.ticketNo)}${cell("Shipper (responsible party)", s.shipper)}
        ${cell("Container / Seal", cnText(s))}${cell("Boxes", String((v.list && v.list.length) || 1))}
        ${cell("Vessel / Voyage", (s.vessel || "") + " / " + (s.voyage || ""))}${cell("POL", s.pol)}
        ${cell("Cargo Gross Weight", v.cargoLabel)}${cell("Container Tare", v.tareLabel)}
        ${cell("Verified Gross Mass", v.label)}${cell("Weighing Method", "Method 2 — cargo + tare")}
      </div>
      ${extra}
      <p class="clause">SOLAS 要求装船前申报 VGM。未填皮重时按默认 3800 KGS 估算；多柜时未填分柜货重则按总货重均分。出单前请按箱门铭牌核对。本单为作业草稿，不替代称重证明。</p>
      <div class="sign"><div><div class="line">Authorized signatory</div></div><div><div class="line">Weighing location</div></div><div><div class="line">Date / Time</div></div></div>
    </div>`;
  }

  function buildCi(s) {
    const inv = invoiceOf(s);
    const invNo = "INV" + String(s.ticketNo || "").replace(/^SH/, "");
    return `<div class="sheet">
      ${head("COMMERCIAL INVOICE / 商业发票", "Homologous invoice · 单价×件数 = 金额", s.ticketNo)}
      <div class="grid2">
        ${cell("Invoice No.", invNo)}${cell("Date", fmtWhen(new Date().toISOString()))}
        ${cell("Seller / Shipper", s.shipper)}${cell("Buyer / Consignee", s.consignee)}
        ${cell("POL → POD", (s.pol || "") + " → " + (s.pod || ""))}${cell("Container / Seal", cnText(s))}
        ${cell("Incoterms", inv.incoterms)}${cell("Currency", inv.currency)}
        ${cell("Tax rate", inv.taxRate ? (inv.taxRate + "%") : "—")}${cell("Discount", inv.discountLabel || "—")}
        ${cell("Marks & Nos.", marksOf(s))}${cell("Invoice Total", inv.totalLabel || "—")}
      </div>
      ${cargoTableHtml(s, "ci")}
      <p class="clause">本商业发票由智单通按货物档案同源生成。行金额 = 单价 × 件数；合计 = 小计 − 折扣 + 税率%。未填税率 / 折扣则不加。非正式税务发票，成交条款默认 ${e(inv.incoterms)} / ${e(inv.currency)}。</p>
      <div class="sign"><div><div class="line">Seller</div></div><div><div class="line">Buyer</div></div><div><div class="line">Date</div></div></div>
    </div>`;
  }

  function buildBk(s, carrierId) {
    const c = CARRIERS[carrierId] || CARRIERS.generic;
    const bkNo = "BK" + String(s.ticketNo || "").replace(/^SH/, "");
    return `<div class="sheet" style="border-color:${c.color}">
      ${head("BOOKING CONFIRMATION / 订舱确认书", "Homologous booking · 舱位以船司配载为准", s.ticketNo, c.id)}
      <div class="grid2">
        ${cell("Booking No.", bkNo)}${cell("Ticket / Ref.", s.ticketNo)}
        ${cell("Carrier / SCAC", c.name + " / " + c.scac)}${cell("Shipper", s.shipper)}
        ${cell("Consignee", s.consignee)}${cell("Notify Party", s.notifyParty)}
        ${cell("Place of Receipt / POL", s.pol)}${cell("Port of Discharge / POD", s.pod)}
        ${cell("Vessel / Voyage", (s.vessel || "") + " / " + (s.voyage || ""))}${cell("ETD", fmtWhen(s.etd))}
        ${cell("Container / Seal", cnText(s))}${cell("Packages / Weight", (s.packages || "") + " / " + (s.grossWeight || ""))}
      </div>
      ${cargoTableHtml(s, "bl")}
      <p class="clause">This booking confirmation is generated from the SmartDoc cargo archive. Space is subject to carrier allocation. Not a bill of lading. 本确认书与提单草稿同源，非正式订舱合同。</p>
      <div class="sign"><div><div class="line">Shipper</div></div><div><div class="line">${e(c.name)} Booking desk</div></div><div><div class="line">Date</div></div></div>
    </div>`;
  }

  function buildAn(s) {
    const eta = etaOf(s);
    const blNo = String(s.ticketNo || "").replace("SH", "SHSE");
    return `<div class="sheet">
      ${head("ARRIVAL NOTICE / 到货通知", "Pre-alert · ETA = ETD + 14d unless specified", s.ticketNo)}
      <div class="grid2">
        ${cell("B/L No.", blNo)}${cell("Ticket", s.ticketNo)}
        ${cell("Consignee", s.consignee)}${cell("Notify Party", s.notifyParty)}
        ${cell("Vessel / Voyage", (s.vessel || "") + " / " + (s.voyage || ""))}${cell("POL → POD", (s.pol || "") + " → " + (s.pod || ""))}
        ${cell("ETD", fmtWhen(s.etd))}${cell("ETA", fmtWhen(eta))}
        ${cell("Container / Seal", cnText(s))}${cell("Packages / Weight", (s.packages || "") + " / " + (s.grossWeight || ""))}
      </div>
      ${cargoTableHtml(s, "bl")}
      <p class="clause">Please arrange customs clearance and pickup against original B/L or telex release. Free time and demurrage are as per carrier tariff. 本通知由智单通按档案预告，ETA 未填时按开船日后 14 天估算。</p>
      <div class="sign"><div><div class="line">Agent</div></div><div><div class="line">Consignee acknowledgement</div></div><div><div class="line">Date</div></div></div>
    </div>`;
  }

  function hdrSafe(v) {
    return String(v || "").replace(/[\r\n]+/g, " ").trim();
  }

  function anEml(s) {
    s = s || {};
    const eta = etaOf(s);
    const blNo = String(s.ticketNo || "").replace("SH", "SHSE");
    const to = hdrSafe(s.notifyParty && s.notifyParty !== "SAME AS CONSIGNEE" ? s.notifyParty : (s.consignee || ""));
    const from = hdrSafe(s.shipper || "SmartDoc Agent");
    const subject = "Arrival Notice " + (s.ticketNo || "") + " / " + blNo;
    const lines = [
      "ARRIVAL NOTICE / 到货通知",
      "Ticket: " + (s.ticketNo || ""),
      "B/L No.: " + blNo,
      "Consignee: " + (s.consignee || ""),
      "Notify: " + (s.notifyParty || ""),
      "Vessel / Voyage: " + (s.vessel || "") + " / " + (s.voyage || ""),
      "POL -> POD: " + (s.pol || "") + " -> " + (s.pod || ""),
      "ETD: " + fmtWhen(s.etd),
      "ETA: " + fmtWhen(eta),
      "Container / Seal: " + cnText(s),
      "Packages / Weight: " + (s.packages || "") + " / " + (s.grossWeight || ""),
      "",
      "Please arrange customs clearance and pickup against original B/L or telex release.",
      "Generated by SmartDoc. Open locally in your mail client (no server).",
    ];
    const raw = [
      "From: " + from,
      "To: " + to,
      "Subject: " + hdrSafe(subject),
      "Date: " + new Date().toUTCString(),
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "X-Unsent: 1",
      "",
      lines.join("\r\n"),
    ].join("\r\n");
    return { filename: "AN_" + (s.ticketNo || "notice") + ".eml", raw: raw, subject: subject };
  }

  function buildCo(s) {
    const origin = originCountryOf(s);
    const oc = originCriterionOf(s);
    const invNo = "INV" + String(s.ticketNo || "").replace(/^SH/, "");
    const cert = coCertOf(s);
    const issuer = coIssuerOf(s);
    return `<div class="sheet">
      ${head("CERTIFICATE OF ORIGIN / 原产地证书", "Homologous COO · Form-style draft · 非正式签证", s.ticketNo)}
      <div class="grid2">
        ${cell("1. Exporter", s.shipper)}${cell("2. Consignee", s.consignee)}
        ${cell("3. Means of transport and route", ((s.vessel || "") + " " + (s.voyage || "")).trim() + " · " + (s.pol || "") + " → " + (s.pod || ""))}${cell("4. Country of origin", origin)}
        ${cell("5. Origin criterion", oc || "—")}${cell("6. Invoice No. / Date", invNo + " / " + fmtWhen(new Date().toISOString()))}
        ${cell("7. Marks & Nos.", marksOf(s))}${cell("8. Container / Seal", cnText(s))}
        ${cell("9. Certificate No.", cert)}${cell("10. Issuing authority", issuer || "—")}
      </div>
      ${cargoTableHtml(s, "co")}
      <p class="clause">The undersigned hereby declares that the above details and statements are correct; that all the goods were produced in ${e(origin)}. Origin criterion ${e(oc || "not specified")} (WO = wholly obtained, WP = sufficiently worked, PSR = product-specific rule). Certificate ${e(cert)}${issuer ? (" issued by " + e(issuer)) : ""}. 本产地证由智单通按货物档案同源生成，非正式贸促会 / 海关签证件；签证机关未填则留空。</p>
      <div class="sign"><div><div class="line">Exporter</div></div><div><div class="line">${e(issuer || "Competent authority")}</div></div><div><div class="line">Date / Place</div></div></div>
    </div>`;
  }

  function build(type, s, opts) {
    s = s || {};
    const carrier = (opts && opts.carrier) || s.blCarrier || "generic";
    const blNo = String(s.ticketNo || "").replace("SH", "SHSE");
    if (type === "bl") return buildBl(s, carrier);
    if (type === "pl") return buildPl(s);
    if (type === "vgm") return buildVgm(s);
    if (type === "an") return buildAn(s);
    if (type === "bk") return buildBk(s, carrier);
    if (type === "ci") return buildCi(s);
    if (type === "co") return buildCo(s);
    if (type === "ams") {
      const dg = dgOf(s);
      return `<div class="sheet">
        ${head("US CUSTOMS AMS MANIFEST", "Automated Manifest System · 24-Hour Rule", s.ticketNo)}
        <div class="grid2">
          ${cell("AMS House Bill", "AMS" + String(s.ticketNo || "").slice(2))}${cell("Master B/L", blNo)}
          ${cell("Shipper", s.shipper)}${cell("Consignee", s.consignee)}
          ${cell("Notify Party (mandatory)", s.notifyParty)}${cell("Last Foreign Port / POL", s.pol)}
          ${cell("Port of Unlading / POD", s.pod)}${cell("Container / Seal", cnText(s))}
        </div>
        ${cargoTableHtml(s, "ams")}
        <p class="clause">AMS must be filed at least 24 hours before cargo is laden aboard the vessel at the foreign port. Empty notify party may trigger a do-not-load (DNL) hold.</p>
        ${dg.clause ? `<p class="clause" style="font-weight:700;color:#9a3412">${e(dg.clause)}</p>` : ""}
      </div>`;
    }
    if (type === "isf") {
      return `<div class="sheet">
      ${head("IMPORTER SECURITY FILING (ISF 10+2)", "U.S. CBP · file 24 hours before loading", s.ticketNo)}
      <div class="grid2">
        ${cell("ISF No.", "ISF" + String(s.ticketNo || "").slice(2))}${cell("B/L No.", blNo)}
        ${cell("1. Importer of Record", s.consignee)}${cell("2. Consignee", s.consignee)}
        ${cell("3. Seller / Owner", s.shipper)}${cell("4. Manufacturer / Supplier", s.shipper)}
        ${cell("5. Ship to Party", s.consignee)}${cell("6. Country of Origin", originCountryOf(s))}
        ${cell("7. HTSUS", cargoLines(s).map((l) => l.hsCode).filter(Boolean).join(" / ") || s.hsCode)}${cell("8. Container Stuffing Location", s.pol)}
        ${cell("9. Consolidator", s.shipper)}${cell("10. Container No.", cnText(s))}
      </div>
      ${cargoTableHtml(s, "ams")}
      <p class="clause">+2 data elements (stow plan / container status) are filed by the carrier. Commodity: ${e(s.description)}. Packages: ${e(s.packages)}.</p>
    </div>`;
    }
    if (type === "export") {
      return `<div class="sheet">
        ${head("中华人民共和国海关出口货物报关单", "Export Customs Declaration · 预录入草稿", s.ticketNo)}
        <div class="grid2">
          ${cell("预录入编号", "3102" + String(s.ticketNo || "").slice(2))}${cell("境内发货人", s.shipper)}
          ${cell("境外收货人", s.consignee)}${cell("提运单号", blNo)}
          ${cell("集装箱号 / 封号", cnText(s))}${cell("运输路线", (s.pol || "") + " → " + (s.pod || ""))}
        </div>
        ${cargoTableHtml(s, "export")}
        <p class="clause">本单为智单通按货物档案同源生成的报关草稿，申报前须由报关员核对品名、税号与成交数量。</p>
        <div class="sign"><div><div class="line">申报单位</div></div><div><div class="line">报关员</div></div><div><div class="line">申报日期</div></div></div>
      </div>`;
    }
    return `<div class="sheet"><p class="clause">未知单证类型 ${e(type)}</p></div>`;
  }

  const TITLES = { bl: "B/L", ams: "AMS", export: "EXPORT", isf: "ISF", pl: "PACKING", vgm: "VGM", an: "ARRIVAL", bk: "BOOKING", ci: "INVOICE", co: "COO" };

  function stampHtml(opts, s) {
    opts = opts || {};
    const code = String(opts.shareCode || "").trim();
    const url = String(opts.shareUrl || "").trim();
    if (!code && !url) return "";
    const right = url ? (url.length > 96 ? url.slice(0, 93) + "…" : url) : "打开 view.html 粘贴短码（本机分享簿）";
    return `<div class="sheet-foot"><span>智单通 · ${e(s.ticketNo || "")} · 只读码 ${e(code || "—")}</span><span>${e(right)}</span></div>`;
  }

  function wrap(type, s, opts) {
    opts = opts || {};
    const carrier = (type === "bl" || type === "bk") ? (opts.carrier || s.blCarrier || "generic") : "generic";
    const css = cssFor(carrier);
    const bar = `<div class="print-bar no-print"><button type="button" onclick="window.print()">打印 A4（${e((PRINT_PAGE[carrier] || PRINT_PAGE.generic).margin)}）</button></div>`;
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${TITLES[type] || type}-${e(s.ticketNo)}</title><style>${css}</style></head><body>${bar}${build(type, s, opts)}${stampHtml(opts, s)}</body></html>`;
  }

  function print(type, s, opts) {
    const html = wrap(type, s, opts);
    const win = w.open("", "_blank");
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try { win.print(); } catch (err) { /* ignore */ }
    }, 350);
    return true;
  }

  function carrierName(id) {
    return (CARRIERS[id] || CARRIERS.generic).name;
  }

  function checkReport(shipment, rows, selected, summary) {
    const labels = { bl: "B/L", ams: "AMS", export: "报关单", isf: "ISF", pl: "装箱单", vgm: "VGM", an: "到货通知", bk: "订舱确认", ci: "商业发票", co: "产地证" };
    const body = (rows || [])
      .map((row) => {
        const cells = selected.map((d) => `<td>${e(row[d] || "")}</td>`).join("");
        const st = row.hasEmpty ? "缺失" : row.mismatch || row.sourceMismatch ? "不一致" : row.ruleWarn ? "规则" : row.stale ? "过期" : "通过";
        return `<tr><td>${e(row.label)}</td><td>${e(row.source)}</td>${cells}<td>${st}</td></tr>`;
      })
      .join("");
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>校验报告 ${e(shipment.ticketNo)}</title><style>${cssFor("generic")}</style></head><body>
      <div class="sheet">
        ${head("装船前一致性校验报告", summary || "", shipment.ticketNo)}
        <table class="cargo"><thead><tr><th>字段</th><th>货物档案</th>${selected.map((d) => `<th>${labels[d] || d}</th>`).join("")}<th>结论</th></tr></thead><tbody>${body}</tbody></table>
        <p class="clause">本报告由智单通根据已生成单证快照与当前档案比对生成，不替代人工签章与正式申报。</p>
      </div></body></html>`;
  }

  w.SmartDocs = { build, wrap, print, checkReport, CSS, cssFor, CARRIERS, PRINT_PAGE, carrierName, vgmOf, vgmList, etaOf, TITLES, stampHtml, ownerCode, carrierFromOwner, OWNER_CARRIER, marksOf, containersOf, cnText, invoiceOf, originCountryOf, originCriterionOf, dgOf, anEml, coCertOf, coIssuerOf };
})(window);
