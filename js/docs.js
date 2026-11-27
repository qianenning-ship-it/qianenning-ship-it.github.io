(function (w) {
  const CSS = `
@page{size:A4;margin:12mm}
body{font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#0f172a;padding:8px}
.sheet{border:2px solid #0f172a;padding:18px 20px;max-width:860px;margin:0 auto;background:#fff}
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
.clause{margin-top:12px;font-size:10px;color:#475569;line-height:1.45}
.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:28px;font-size:11px}
.sign .line{border-top:1px solid #0f172a;margin-top:36px;padding-top:6px}
.badge{display:inline-block;background:#e8f1ff;color:#006aff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px}
@media print{body{padding:0}.no-print{display:none!important}}
`;

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

  const CARRIERS = {
    generic: { id: "generic", name: "通用套版", scac: "SDTU", mark: "智", color: "#006aff", title: "OCEAN BILL OF LADING (DRAFT)", legal: "Shipped on board in apparent good order. Freight as arranged. SmartDoc homologous draft — not a signed original B/L." },
    cosco: { id: "cosco", name: "COSCO SHIPPING", scac: "COSU", mark: "中", color: "#c41e3a", title: "COSCO SHIPPING BILL OF LADING", legal: "COSCO SHIPPING Lines Co., Ltd. Combined Transport B/L (draft). Terms of carriage as per COSCO bill of lading. This copy is generated from a SmartDoc archive for checking only." },
    msc: { id: "msc", name: "MSC", scac: "MSCU", mark: "M", color: "#003366", title: "MEDITERRANEAN SHIPPING COMPANY B/L", legal: "Mediterranean Shipping Company S.A. Bill of Lading (non-negotiable draft). Particulars furnished by the shipper. Not valid for negotiation until signed by the carrier." },
    maersk: { id: "maersk", name: "MAERSK", scac: "MAEU", mark: "★", color: "#42b0d5", title: "MAERSK LINE BILL OF LADING", legal: "Maersk A/S transport document (draft). Contract of carriage subject to Maersk Bill of Lading terms. For document check and pre-alert only." },
  };

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
    return `<div class="sheet" style="border-color:${c.color}">
      ${head(c.title, "非可转让草稿 · " + c.name + " 套版", s.ticketNo, c.id)}
      <div class="grid2">
        ${cell("B/L No.", blNo)}${cell("Booking / Ticket", s.ticketNo)}
        ${cell("Shipper / Exporter", s.shipper)}${cell("Consignee", s.consignee)}
        ${cell("Notify Party", s.notifyParty)}${cell("Place of Receipt / POL", s.pol)}
        ${cell("Port of Discharge / POD", s.pod)}${cell("Container / Seal", (s.containerNo || "") + " / " + (s.sealNo || ""))}
        ${cell("Vessel / Voyage", (s.vessel || "") + " / " + (s.voyage || ""))}${cell("ETD", s.etd)}
      </div>
      <table class="cargo">
        <thead><tr><th>Marks</th><th>No. of Pkgs</th><th>Description of Goods / HS</th><th>Gross Weight</th><th>Measurement</th></tr></thead>
        <tbody><tr>
          <td>N/M</td><td>${e(s.packages)}</td>
          <td>${e(s.description)}<br>HS ${e(s.hsCode)}</td>
          <td>${e(s.grossWeight)}</td><td>${e(s.volume)}</td>
        </tr></tbody>
      </table>
      <p class="clause">${e(c.legal)}</p>
      <div class="sign"><div><div class="line">Shipper</div></div><div><div class="line">${e(c.name)} / Agent</div></div><div><div class="line">Date / Place</div></div></div>
    </div>`;
  }

  function build(type, s, opts) {
    s = s || {};
    const carrier = (opts && opts.carrier) || s.blCarrier || "generic";
    const blNo = String(s.ticketNo || "").replace("SH", "SHSE");
    if (type === "bl") return buildBl(s, carrier);
    if (type === "ams") {
      return `<div class="sheet">
        ${head("US CUSTOMS AMS MANIFEST", "Automated Manifest System · 24-Hour Rule", s.ticketNo)}
        <div class="grid2">
          ${cell("AMS House Bill", "AMS" + String(s.ticketNo || "").slice(2))}${cell("Master B/L", blNo)}
          ${cell("Shipper", s.shipper)}${cell("Consignee", s.consignee)}
          ${cell("Notify Party (mandatory)", s.notifyParty)}${cell("Last Foreign Port / POL", s.pol)}
          ${cell("Port of Unlading / POD", s.pod)}${cell("Container / Seal", (s.containerNo || "") + " / " + (s.sealNo || ""))}
        </div>
        <table class="cargo">
          <thead><tr><th>HTS</th><th>Cargo Description</th><th>Quantity</th><th>Gross Weight</th></tr></thead>
          <tbody><tr><td>${e(s.hsCode)}</td><td>${e(s.description)}</td><td>${e(s.packages)}</td><td>${e(s.grossWeight)}</td></tr></tbody>
        </table>
        <p class="clause">AMS must be filed at least 24 hours before cargo is laden aboard the vessel at the foreign port. Empty notify party may trigger a do-not-load (DNL) hold.</p>
      </div>`;
    }
    if (type === "export") {
      return `<div class="sheet">
        ${head("中华人民共和国海关出口货物报关单", "Export Customs Declaration · 预录入草稿", s.ticketNo)}
        <div class="grid2">
          ${cell("预录入编号", "3102" + String(s.ticketNo || "").slice(2))}${cell("境内发货人", s.shipper)}
          ${cell("境外收货人", s.consignee)}${cell("提运单号", blNo)}
          ${cell("集装箱号 / 封号", (s.containerNo || "") + " / " + (s.sealNo || ""))}${cell("运输路线", (s.pol || "") + " → " + (s.pod || ""))}
        </div>
        <table class="cargo">
          <thead><tr><th>商品编号 (HS)</th><th>商品名称及规格型号</th><th>件数</th><th>毛重</th><th>体积</th></tr></thead>
          <tbody><tr><td>${e(s.hsCode)}</td><td>${e(s.description)}</td><td>${e(s.packages)}</td><td>${e(s.grossWeight)}</td><td>${e(s.volume)}</td></tr></tbody>
        </table>
        <p class="clause">本单为智单通按货物档案同源生成的报关草稿，申报前须由报关员核对品名、税号与成交数量。</p>
        <div class="sign"><div><div class="line">申报单位</div></div><div><div class="line">报关员</div></div><div><div class="line">申报日期</div></div></div>
      </div>`;
    }
    return `<div class="sheet">
      ${head("IMPORTER SECURITY FILING (ISF 10+2)", "U.S. CBP · file 24 hours before loading", s.ticketNo)}
      <div class="grid2">
        ${cell("ISF No.", "ISF" + String(s.ticketNo || "").slice(2))}${cell("B/L No.", blNo)}
        ${cell("1. Importer of Record", s.consignee)}${cell("2. Consignee", s.consignee)}
        ${cell("3. Seller / Owner", s.shipper)}${cell("4. Manufacturer / Supplier", s.shipper)}
        ${cell("5. Ship to Party", s.consignee)}${cell("6. Country of Origin", "CHINA")}
        ${cell("7. HTSUS", s.hsCode)}${cell("8. Container Stuffing Location", s.pol)}
        ${cell("9. Consolidator", s.shipper)}${cell("10. Container No.", s.containerNo)}
      </div>
      <p class="clause">+2 data elements (stow plan / container status) are filed by the carrier. Commodity: ${e(s.description)}. Packages: ${e(s.packages)}.</p>
    </div>`;
  }

  function wrap(type, s, opts) {
    const titles = { bl: "B/L", ams: "AMS", export: "EXPORT", isf: "ISF" };
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${titles[type] || type}-${e(s.ticketNo)}</title><style>${CSS}</style></head><body>${build(type, s, opts)}</body></html>`;
  }

  function carrierName(id) {
    return (CARRIERS[id] || CARRIERS.generic).name;
  }

  function checkReport(shipment, rows, selected, summary) {
    const labels = { bl: "B/L", ams: "AMS", export: "报关单", isf: "ISF" };
    const body = (rows || [])
      .map((row) => {
        const cells = selected.map((d) => `<td>${e(row[d] || "")}</td>`).join("");
        const st = row.hasEmpty ? "缺失" : row.mismatch || row.sourceMismatch ? "不一致" : row.ruleWarn ? "规则" : row.stale ? "过期" : "通过";
        return `<tr><td>${e(row.label)}</td><td>${e(row.source)}</td>${cells}<td>${st}</td></tr>`;
      })
      .join("");
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>校验报告 ${e(shipment.ticketNo)}</title><style>${CSS}</style></head><body>
      <div class="sheet">
        ${head("装船前一致性校验报告", summary || "", shipment.ticketNo)}
        <table class="cargo"><thead><tr><th>字段</th><th>货物档案</th>${selected.map((d) => `<th>${labels[d] || d}</th>`).join("")}<th>结论</th></tr></thead><tbody>${body}</tbody></table>
        <p class="clause">本报告由智单通根据已生成单证快照与当前档案比对生成，不替代人工签章与正式申报。</p>
      </div></body></html>`;
  }

  w.SmartDocs = { build, wrap, checkReport, CSS, CARRIERS, carrierName };
})(window);
