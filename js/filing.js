(function (w) {
  const CHANNELS = {
    ams: { id: "ams", name: "AMS 24h 舱单", agency: "US CBP ACE", prefix: "ACE" },
    isf: { id: "isf", name: "ISF 10+2", agency: "US CBP ISF", prefix: "ISF" },
  };

  function requiredKeys(channel) {
    if (channel === "isf") return ["shipper", "consignee", "pol", "containerNo", "hsCode", "description"];
    return ["shipper", "consignee", "notifyParty", "pol", "pod", "containerNo", "description", "hsCode", "packages", "grossWeight"];
  }

  function nodeOf(channel, key) {
    return (w.SmartEdi && w.SmartEdi.nodeOf) ? w.SmartEdi.nodeOf(channel, key) : (channel + "/" + key);
  }

  function item(channel, key, message) {
    return { key, message, node: nodeOf(channel, key) };
  }

  function evaluate(channel, shipment) {
    const s = shipment || {};
    const items = [];
    const labels = {};
    ((w.SmartDoc && w.SmartDoc.FIELD_META) || []).forEach((f) => { labels[f.key] = f.label; });
    labels.notifyParty = labels.notifyParty || "Notify Party";
    requiredKeys(channel).forEach((k) => {
      if (!String(s[k] || "").trim()) items.push(item(channel, k, "缺失 " + (labels[k] || k)));
    });
    const on = (id) => !w.SmartRules || w.SmartRules.on(id);
    if (on("iso6346") && s.containerNo && w.SmartDoc) {
      const c = String(s.containerNo).toUpperCase().replace(/[\s-]/g, "");
      if (!/^[A-Z]{4}\d{7}$/.test(c) || !w.SmartDoc.iso6346Valid(c)) {
        items.push(item(channel, "containerNo", "ISO 6346 柜号未通过（申报拒绝）"));
      }
    }
    if (on("hs") && s.hsCode && w.SmartDoc && !w.SmartDoc.hsLooksValid(s.hsCode)) {
      items.push(item(channel, "hsCode", "HS / HTS 格式未通过规则库"));
    }
    if (channel === "ams" && on("ams24h") && !String(s.notifyParty || "").trim()) {
      items.push(item(channel, "notifyParty", "AMS 24h：Notify Party 为空，存在 DNL 风险"));
    }
    if (channel === "isf" && on("isf102") && !String(s.consignee || "").trim()) {
      items.push(item(channel, "consignee", "ISF：Importer / Consignee 必填"));
    }
    if (channel === "isf" && on("isf102") && !String(s.pol || "").trim()) {
      items.push(item(channel, "pol", "ISF：Container stuffing location（POL）必填"));
    }
    return items;
  }

  function parseEtd(shipment) {
    const v = String((shipment && shipment.etd) || "").trim();
    if (!v) return null;
    const d = new Date(v.replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }

  function cutoffs(shipment) {
    const etd = parseEtd(shipment);
    if (!etd) return { etd: null, ams: null, isf: null };
    const ms = 24 * 3600 * 1000;
    return { etd, ams: new Date(etd.getTime() - ms), isf: new Date(etd.getTime() - ms) };
  }

  function fmt(d) {
    if (!d) return "";
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function oneCutoff(channel, deadline, filings) {
    const rec = (filings || []).find((f) => f.channel === channel && f.status === "accepted");
    if (!deadline) return { channel, status: "no-etd", label: "未填 ETD", deadline: null, rec: rec || null };
    if (rec) return { channel, status: "filed", label: "已 Accepted " + (rec.ref || ""), deadline, rec };
    if (Date.now() > deadline.getTime()) return { channel, status: "overdue", label: "已过截关仍未 Accepted", deadline, rec: null };
    const hrs = Math.max(0, Math.round((deadline.getTime() - Date.now()) / 3600000));
    return { channel, status: "open", label: "距截关约 " + hrs + " 小时", deadline, rec: null };
  }

  function cutoffState(shipment, filings) {
    const c = cutoffs(shipment);
    return { etd: c.etd, ams: oneCutoff("ams", c.ams, filings), isf: oneCutoff("isf", c.isf, filings) };
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
      nodes: [],
      late: false,
    };
  }

  function settle(rec, shipment) {
    const items = evaluate(rec.channel, shipment);
    rec.settledAt = new Date().toISOString().slice(0, 16).replace("T", " ");
    rec.nodes = items;
    rec.reasons = items.map((i) => i.message + (i.node ? " [" + i.node + "]" : ""));
    const c = cutoffState(shipment, []);
    const ch = rec.channel === "isf" ? c.isf : c.ams;
    rec.late = !!(ch && ch.status === "overdue");
    if (items.length) {
      rec.status = "rejected";
      rec.ref = "REJ-" + rec.id.slice(-5);
    } else {
      rec.status = "accepted";
      rec.ref = rec.channel.toUpperCase() + Date.now().toString().slice(-8);
    }
    return rec;
  }

  w.SmartFiling = { CHANNELS, evaluate, create, settle, requiredKeys, cutoffs, cutoffState, fmt, parseEtd };
})(window);
