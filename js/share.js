(function (w) {
  const BOOK = "smartdoc_sharebook";

  function b64uEncode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function b64uDecode(str) {
    const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
    const b64 = String(str || "").replace(/-/g, "+").replace(/_/g, "/") + pad;
    return decodeURIComponent(escape(atob(b64)));
  }

  function compact(pack) {
    return {
      k: "smartdoc-pack",
      t: pack.ticketNo,
      s: pack.shipment,
      g: pack.generated || {},
      c: pack.checkSummary || "",
      rows: pack.checkRows || [],
      r: pack.rules || null,
      b: pack.blCarrier || "generic",
      f: pack.filings || [],
      tl: (pack.timeline || []).slice(0, 12),
      files: pack.extractFiles || [],
      ack: pack.ack || null,
      n: (pack.notes || []).slice(0, 20),
    };
  }

  function expand(c) {
    if (!c || (c.k !== "smartdoc-pack" && !c.s && !c.shipment)) throw new Error("不是智单通分享令牌");
    const shipment = c.s || c.shipment || {};
    const generated = c.g || c.generated || {};
    return {
      kind: "smartdoc-pack",
      version: 2,
      ticketNo: c.t || c.ticketNo || shipment.ticketNo || "",
      shipment,
      generated,
      docs: Object.keys(generated),
      checkSummary: c.c || c.checkSummary || "",
      checkRows: c.rows || c.checkRows || [],
      rules: c.r || c.rules || null,
      blCarrier: c.b || c.blCarrier || "generic",
      filings: c.f || c.filings || [],
      timeline: c.tl || c.timeline || [],
      extractFiles: c.files || c.extractFiles || [],
      ack: c.ack || null,
      notes: c.n || c.notes || [],
      remark: "分享码载入",
    };
  }

  function shortCode(ticketNo) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let n = Date.now() % 1073741824;
    let out = "";
    for (let i = 0; i < 6; i++) {
      out = alphabet[n % alphabet.length] + out;
      n = Math.floor(n / alphabet.length);
    }
    const prefix = String(ticketNo || "SD").replace(/[^A-Z0-9]/gi, "").slice(-2).toUpperCase() || "SD";
    return prefix + "-" + out;
  }

  function readBook() {
    try { return JSON.parse(localStorage.getItem(BOOK) || "{}"); } catch (e) { return {}; }
  }

  function writeBook(book) {
    const keys = Object.keys(book);
    if (keys.length > 40) keys.slice(40).forEach((k) => delete book[k]);
    localStorage.setItem(BOOK, JSON.stringify(book));
  }

  function encode(pack) {
    const token = "SD1." + b64uEncode(JSON.stringify(compact(pack)));
    const code = shortCode(pack.ticketNo);
    const book = readBook();
    book[code] = token;
    writeBook(book);
    const origin = location.origin || "";
    let path = location.pathname || "/";
    if (!/app\.html$/i.test(path)) {
      path = path.replace(/index\.html$/i, "");
      if (!path.endsWith("/")) path += "/";
      path += "app.html";
    }
    const url = token.length < 7000 ? origin + path + "#sd=" + token : "";
    return { code, token, url, bytes: token.length };
  }

  function decode(input) {
    const raw = String(input || "").trim();
    if (!raw) throw new Error("请粘贴分享码或令牌");
    const book = readBook();
    let token = raw;
    if (book[raw]) token = book[raw];
    const hash = raw.match(/#sd=([A-Za-z0-9._\-]+)/);
    if (hash) token = hash[1];
    if (token.indexOf("SD1.") === 0) token = token.slice(4);
    if (token.indexOf("sd=") === 0) token = token.slice(3);
    try {
      return expand(JSON.parse(b64uDecode(token)));
    } catch (e) {
      throw new Error("无法解析分享令牌（已过期或复制不完整）");
    }
  }

  w.SmartShare = { encode, decode, compact, expand };
})(window);
