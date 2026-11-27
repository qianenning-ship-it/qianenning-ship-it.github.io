(function (w) {
  const DOC_LABELS = {
    bl: "提单 B/L",
    ams: "AMS舱单",
    export: "出口报关",
    isf: "ISF 10+2",
  };

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
      extractFiles: state.extractFiles || (state.extractMeta && state.extractMeta.files) || [],
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
    };
  }

  w.SmartJob = { DOC_LABELS, pushEvent, checkSummaryFromRows, diffRows, archiveSlice, pushRev };
})(window);
