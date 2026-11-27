(function (w) {
  const KEY = "smartdoc_audit";
  const MONTH_CAP = 500;
  const LABELS = {
    extract: "识别建档",
    generate: "同源出单",
    filing: "模拟申报",
    share: "发单/分享",
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }

  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 300)));
    return list;
  }

  function consume(state, action, ticket, detail) {
    let source = "plan";
    if ((state.processedCount || 0) < MONTH_CAP) state.processedCount = (state.processedCount || 0) + 1;
    else if ((state.payPerCount || 0) > 0) {
      state.payPerCount -= 1;
      source = "payper";
    } else source = "over";
    const row = {
      at: new Date().toISOString().slice(0, 19).replace("T", " "),
      action,
      actionLabel: LABELS[action] || action,
      ticket: ticket || "",
      by: (state._userName) || "",
      detail: detail || "",
      source,
    };
    const list = load();
    list.unshift(row);
    save(list);
    return { row, source, monthCap: MONTH_CAP };
  }

  function toCsv(list) {
    const rows = list || load();
    const head = "时间,动作,票号,操作员,额度来源,说明";
    const body = rows.map((r) =>
      [r.at, r.actionLabel || r.action, r.ticket, r.by, r.source, String(r.detail || "").replace(/,/g, "；")]
        .map((c) => '"' + String(c).replace(/"/g, '""') + '"')
        .join(",")
    );
    return [head].concat(body).join("\r\n");
  }

  w.SmartAudit = { MONTH_CAP, load, save, consume, toCsv, LABELS };
})(window);
