(function (w) {
  const KIND = "smartdoc-pack";
  const LOCAL_KEY = "smartdoc_inbox";

  function buildPack(opts) {
    const shipment = opts.shipment || {};
    const generated = opts.generated || {};
    return {
      kind: KIND,
      version: 1,
      sentAt: new Date().toISOString(),
      from: opts.from || {},
      to: opts.to || "",
      remark: opts.remark || "",
      ticketNo: shipment.ticketNo || "",
      shipment: w.SmartDoc ? w.SmartDoc.snapshot(shipment) : shipment,
      generated,
      docs: Object.keys(generated),
      checkRows: opts.checkRows || [],
      checkSummary: opts.checkSummary || "",
      extractMeta: opts.extractMeta || {},
      fieldSource: opts.fieldSource || {},
      extractFiles: opts.extractFiles || [],
      timeline: opts.timeline || [],
      ack: opts.ack || null,
      blCarrier: opts.blCarrier || "generic",
      filings: opts.filings || [],
      rules: opts.rules || null,
      shareCode: opts.shareCode || "",
      notes: opts.notes || [],
      revisions: opts.revisions || [],
      readOnly: !!opts.readOnly,
    };
  }

  function parsePack(obj) {
    if (!obj || typeof obj !== "object") throw new Error("文件内容不是 JSON 对象");
    if (obj.kind === KIND && obj.shipment) return obj;
    if (obj.ticketNo || obj.shipper) {
      return {
        kind: KIND,
        version: 1,
        sentAt: obj.sentAt || new Date().toISOString(),
        from: obj.from || {},
        to: obj.to || "",
        remark: obj.remark || "导入字段包",
        ticketNo: obj.ticketNo || (obj.shipment && obj.shipment.ticketNo) || "",
        shipment: obj.shipment || obj,
        generated: obj.generated || {},
        docs: Object.keys(obj.generated || {}),
        checkRows: obj.checkRows || [],
        checkSummary: obj.checkSummary || "",
        extractMeta: obj.extractMeta || {},
        fieldSource: obj.fieldSource || {},
        extractFiles: obj.extractFiles || [],
        timeline: obj.timeline || [],
        ack: obj.ack || null,
        blCarrier: obj.blCarrier || "generic",
        filings: obj.filings || [],
        rules: obj.rules || null,
        shareCode: obj.shareCode || "",
        notes: obj.notes || [],
        revisions: obj.revisions || [],
        readOnly: !!obj.readOnly,
      };
    }
    throw new Error("不是智单通发单包（缺少 kind=smartdoc-pack 或货物字段）");
  }

  function localList() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function localSave(list) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 40)));
  }

  function localPush(pack, direction) {
    const list = localList();
    const id = (pack.ticketNo || "PACK") + "-" + Date.now();
    list.unshift({
      id,
      direction: direction || "in",
      ticketNo: pack.ticketNo,
      from: pack.from || {},
      to: pack.to || "",
      remark: pack.remark || "",
      sentAt: pack.sentAt,
      docs: pack.docs || [],
      pack,
    });
    localSave(list);
    return id;
  }

  async function pushInbox(pack) {
    const r = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pack),
    });
    if (!r.ok) throw new Error("inbox " + r.status);
    return r.json();
  }

  async function listInbox() {
    try {
      const r = await fetch("/api/inbox", { cache: "no-store" });
      if (!r.ok) return { server: [], local: localList() };
      const server = await r.json();
      return { server: server.items || server || [], local: localList() };
    } catch (e) {
      return { server: [], local: localList() };
    }
  }

  async function getInbox(id) {
    const r = await fetch("/api/inbox/" + encodeURIComponent(id), { cache: "no-store" });
    if (!r.ok) throw new Error("inbox item " + r.status);
    return r.json();
  }

  w.SmartExchange = {
    KIND,
    buildPack,
    parsePack,
    localList,
    localPush,
    pushInbox,
    listInbox,
    getInbox,
  };
})(window);
