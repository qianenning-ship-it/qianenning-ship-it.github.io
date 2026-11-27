(function (w) {
  const CHANNELS = {
    ams: { id: "ams", name: "AMS 24h 舱单", agency: "US CBP ACE", prefix: "ACE" },
    isf: { id: "isf", name: "ISF 10+2", agency: "US CBP ISF", prefix: "ISF" },
  };

  function requiredKeys(channel) {
    if (channel === "isf") return ["shipper", "consignee", "pol", "containerNo", "hsCode", "description"];
    return ["shipper", "consignee", "notifyParty", "pol", "pod", "containerNo", "description", "hsCode", "packages", "grossWeight"];
  }

  function evaluate(channel, shipment) {
    const s = shipment || {};
    const reasons = [];
    const labels = {};
    ((w.SmartDoc && w.SmartDoc.FIELD_META) || []).forEach((f) => { labels[f.key] = f.label; });
    labels.notifyParty = labels.notifyParty || "Notify Party";
    requiredKeys(channel).forEach((k) => {
      if (!String(s[k] || "").trim()) reasons.push("缺失 " + (labels[k] || k));
    });
    const on = (id) => !w.SmartRules || w.SmartRules.on(id);
    if (on("iso6346") && s.containerNo && w.SmartDoc) {
      const c = String(s.containerNo).toUpperCase().replace(/[\s-]/g, "");
      if (!/^[A-Z]{4}\d{7}$/.test(c) || !w.SmartDoc.iso6346Valid(c)) {
        reasons.push("ISO 6346 柜号未通过（申报拒绝）");
      }
    }
    if (on("hs") && s.hsCode && w.SmartDoc && !w.SmartDoc.hsLooksValid(s.hsCode)) {
      reasons.push("HS / HTS 格式未通过规则库");
    }
    if (channel === "ams" && on("ams24h") && !String(s.notifyParty || "").trim()) {
      reasons.push("AMS 24h：Notify Party 为空，存在 DNL 风险");
    }
    if (channel === "isf" && on("isf102") && !String(s.consignee || "").trim()) {
      reasons.push("ISF：Importer / Consignee 必填");
    }
    if (channel === "isf" && on("isf102") && !String(s.pol || "").trim()) {
      reasons.push("ISF：Container stuffing location（POL）必填");
    }
    return reasons;
  }

  function create(channel, ticketNo) {
    const meta = CHANNELS[channel];
    if (!meta) throw new Error("未知申报通道");
    return {
      id: meta.prefix + "-" + Date.now().toString(36).toUpperCase(),
      channel,
      name: meta.name,
      agency: meta.agency,
      ticketNo: ticketNo || "",
      status: "queued",
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
      settledAt: "",
      ref: "",
      reasons: [],
    };
  }

  function settle(rec, shipment) {
    const reasons = evaluate(rec.channel, shipment);
    rec.settledAt = new Date().toISOString().slice(0, 16).replace("T", " ");
    if (reasons.length) {
      rec.status = "rejected";
      rec.reasons = reasons;
      rec.ref = "REJ-" + rec.id.slice(-5);
    } else {
      rec.status = "accepted";
      rec.reasons = [];
      rec.ref = rec.channel.toUpperCase() + Date.now().toString().slice(-8);
    }
    return rec;
  }

  w.SmartFiling = { CHANNELS, evaluate, create, settle, requiredKeys };
})(window);
