(function (w) {
  const DOC_LABELS = {
    bl: "提单 B/L",
    ams: "AMS舱单",
    export: "出口报关",
    isf: "ISF 10+2",
    pl: "装箱单 P/L",
    vgm: "VGM 称重",
    an: "到货通知",
    bk: "订舱确认",
    ci: "商业发票",
    co: "产地证",
  };
  const DOC_IDS = ["bl", "ams", "export", "isf", "pl", "vgm", "an", "bk", "ci", "co"];

  function pushEvent(list, text) {
    const next = Array.isArray(list) ? list.slice() : [];
    next.unshift({ at: new Date().toISOString().slice(0, 16).replace("T", " "), text });
    return next.slice(0, 30);
  }

  function checkSummaryFromRows(rows) {
    const all = rows || [];
    let ok = 0, warn = 0, err = 0;
    all.forEach((r) => {
      if (r.hasEmpty) err += 1;
      else if (r.mismatch || r.sourceMismatch || r.stale || r.ruleWarn) warn += 1;
      else ok += 1;
    });
    return { ok, warn, err, text: "通过 " + ok + " / 风险 " + warn + " / 缺失 " + err };
  }

  function diffRows(source, generated) {
    const meta = (w.SmartDoc && w.SmartDoc.FIELD_META) || [];
    const keys = [{ key: "ticketNo", label: "票号" }].concat(meta);
    const docs = Object.keys(generated || {});
    return keys.map((f) => {
      const src = String((source && source[f.key]) || "");
      const cells = {};
      let anyDiff = false;
      docs.forEach((d) => {
        const v = String((generated[d] && generated[d].fields && generated[d].fields[f.key]) || "");
        cells[d] = v;
        if (v.toUpperCase() !== src.toUpperCase()) anyDiff = true;
      });
      const stale = docs.some((d) => generated[d] && generated[d].sourceHash && w.SmartDoc && generated[d].sourceHash !== w.SmartDoc.sourceHash(source));
      return { key: f.key, label: f.label, source: src, cells, anyDiff: anyDiff || stale, stale };
    });
  }

  function pushRev(list, key, from, to, by, label) {
    if (String(from ?? "") === String(to ?? "")) return Array.isArray(list) ? list : [];
    const next = Array.isArray(list) ? list.slice() : [];
    next.unshift({
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
      by: by || "",
      key,
      label: label || key,
      from: String(from ?? ""),
      to: String(to ?? ""),
    });
    return next.slice(0, 80);
  }

  function archiveSlice(state) {
    return {
      extractFiles: (state.extractFiles || (state.extractMeta && state.extractMeta.files) || []).map((f) => {
        if (typeof f === "string") return f;
        return { fileName: f.fileName || f.name || "", method: f.method || "", size: f.size || 0, at: f.at || "", ocrText: String(f.ocrText || "").slice(0, 200) };
      }),
      timeline: state.timeline || [],
      checkRows: state.checkRows || [],
      checkSummary: state.checkSummary || "",
      fieldSource: state.fieldSource || {},
      fieldConf: state.fieldConf || {},
      ack: state.ack || null,
      blCarrier: state.blCarrier || "generic",
      filings: state.filings || [],
      shareCode: state.shareCode || "",
      notes: state.notes || [],
      revisions: state.revisions || [],
      checkRun: state.checkRun || null,
      checkApproval: state.checkApproval || null,
    };
  }

  function fieldPairs(local, incoming) {
    const meta = [{ key: "ticketNo", label: "票号" }].concat((w.SmartDoc && w.SmartDoc.FIELD_META) || []);
    meta.push({ key: "lines", label: "货描明细" });
    meta.push({ key: "containers", label: "柜清单" });
    const fmt = (obj, key) => {
      if (key === "lines") return (w.SmartDoc && w.SmartDoc.linesLabel(obj)) || "";
      if (key === "containers") return (w.SmartDoc && w.SmartDoc.containersLabel(obj)) || "";
      return String((obj && obj[key]) || "");
    };
    return meta.map((f) => {
      const a = fmt(local, f.key);
      const b = fmt(incoming, f.key);
      return { key: f.key, label: f.label, local: a, incoming: b, differ: a !== b };
    }).filter((r) => r.differ);
  }

  function applyMerge(local, incoming, choices) {
    const snapIn = w.SmartDoc ? w.SmartDoc.snapshot(incoming || {}) : Object.assign({}, incoming);
    const snapLoc = w.SmartDoc ? w.SmartDoc.snapshot(local || {}) : Object.assign({}, local);
    const out = Object.assign({}, snapLoc, snapIn);
    Object.keys(choices || {}).forEach((key) => {
      if (choices[key] === "local") {
        if (key === "lines") out.lines = snapLoc.lines || [];
        else if (key === "containers") out.containers = snapLoc.containers || [];
        else out[key] = snapLoc[key] || "";
      } else if (choices[key] === "incoming") {
        if (key === "lines") out.lines = snapIn.lines || [];
        else if (key === "containers") out.containers = snapIn.containers || [];
        else out[key] = snapIn[key] || "";
      }
    });
    if (w.SmartDoc && w.SmartDoc.rollupHeader) w.SmartDoc.rollupHeader(out);
    out.ticketNo = (choices && choices.ticketNo === "local" ? snapLoc.ticketNo : snapIn.ticketNo) || snapIn.ticketNo || snapLoc.ticketNo;
    return out;
  }

  w.SmartJob = { DOC_LABELS, DOC_IDS, pushEvent, checkSummaryFromRows, diffRows, archiveSlice, pushRev, fieldPairs, applyMerge };
})(window);
