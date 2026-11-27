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
    if (on("hs") && s.hsCode && w.SmartDoc && !(s.lines && s.lines.length > 1)) {
      if (!w.SmartDoc.hsLooksValid(s.hsCode)) {
        items.push(item(channel, "hsCode", "HS / HTS 格式未通过规则库"));
      } else if (w.SmartDoc.hsLaneLooksValid && !w.SmartDoc.hsLaneLooksValid(s.hsCode, s.pod)) {
        items.push(item(channel, "hsCode", w.SmartDoc.hsLane(s.pod) === "us" ? "美线 HS 须 10 位（申报拒绝）" : "该航线 HS 建议 8 位（申报拒绝）"));
      }
    }
    const lines = (w.SmartDoc && w.SmartDoc.normalizeLines(s)) || [];
    if (lines.length) {
      lines.forEach((l, i) => {
        if (!String(l.description || "").trim()) items.push(item(channel, "lines", "明细第 " + (i + 1) + " 行缺少品名"));
        if (!String(l.hsCode || "").trim()) items.push(item(channel, "hsCode", "明细第 " + (i + 1) + " 行缺少 HS"));
        if (on("hs") && l.hsCode && w.SmartDoc && !w.SmartDoc.hsLooksValid(l.hsCode)) {
          items.push(item(channel, "hsCode", "明细第 " + (i + 1) + " 行 HS 格式未通过"));
        }
      });
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

  function boardRows(archive) {
    return (archive || []).map((a) => {
      const cut = cutoffState(a, a.filings || []);
      const worst = [cut.ams, cut.isf].sort((x, y) => {
        const order = { overdue: 0, open: 1, "no-etd": 2, filed: 3 };
        return (order[x.status] || 9) - (order[y.status] || 9);
      })[0];
      const t = (cut.ams.deadline && cut.ams.deadline.getTime()) || (cut.isf.deadline && cut.isf.deadline.getTime()) || Number.MAX_SAFE_INTEGER;
      const rank = { overdue: 0, open: 1, "no-etd": 2, filed: 3 }[worst.status] ?? 9;
      return { ticket: a, cut, worst, t, rank };
    }).sort((x, y) => x.rank - y.rank || x.t - y.t);
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

  function icsStamp(d) {
    const p = (n) => String(n).padStart(2, "0");
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + "00Z";
  }

  function icsText(s) {
    return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }

  function exportIcs(archive) {
    const rows = boardRows(archive);
    const events = [];
    rows.forEach((r) => {
      ["ams", "isf"].forEach((ch) => {
        const c = r.cut[ch];
        if (!c || !c.deadline) return;
        const ticket = (r.ticket && r.ticket.ticketNo) || "";
        const uid = ch + "-" + ticket + "@smartdoc";
        events.push(
          "BEGIN:VEVENT\r\nUID:" + uid + "\r\nDTSTAMP:" + icsStamp(new Date()) +
          "\r\nDTSTART:" + icsStamp(c.deadline) +
          "\r\nSUMMARY:" + icsText((ch === "isf" ? "ISF 10+2 截关 " : "AMS 24h 截关 ") + ticket) +
          "\r\nDESCRIPTION:" + icsText((r.ticket && r.ticket.shipper) || "") +
          "\r\nEND:VEVENT"
        );
      });
    });
    return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SmartDoc//Cutoff//CN\r\nCALSCALE:GREGORIAN\r\n" + events.join("\r\n") + "\r\nEND:VCALENDAR\r\n";
  }

  w.SmartFiling = { CHANNELS, evaluate, create, settle, requiredKeys, cutoffs, cutoffState, fmt, parseEtd, boardRows, exportIcs };
})(window);
