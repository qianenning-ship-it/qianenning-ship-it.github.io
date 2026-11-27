(function (w) {
  const BOOK = "smartdoc_sharebook";
  const PBKDF2_ITERS = 100000;

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

  function b64uEncodeBytes(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function b64uDecodeBytes(str) {
    const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
    const b64 = String(str || "").replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
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
      rv: (pack.revisions || []).slice(0, 20),
      ro: pack.readOnly ? 1 : 0,
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
      revisions: c.rv || c.revisions || [],
      readOnly: !!(c.ro || c.readOnly),
      remark: c.ro ? "只读协作载入" : "分享码载入",
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

  function extractToken(input) {
    const raw = String(input || "").trim();
    if (!raw) throw new Error("请粘贴分享码或令牌");
    const book = readBook();
    let token = raw;
    if (book[raw]) token = book[raw];
    const hash = raw.match(/#sd=([A-Za-z0-9._\-]+)/);
    if (hash) token = hash[1];
    if (token.indexOf("sd=") === 0) token = token.slice(3);
    return token;
  }

  function isEncrypted(input) {
    try {
      return extractToken(input).indexOf("SD2.") === 0;
    } catch (e) {
      return String(input || "").indexOf("SD2.") >= 0;
    }
  }

  function peek(input) {
    let token = "";
    try { token = extractToken(input); } catch (e) { token = String(input || ""); }
    return {
      token,
      encrypted: token.indexOf("SD2.") === 0,
      version: token.indexOf("SD2.") === 0 ? 2 : 1,
    };
  }

  function shareUrl(token, opts) {
    const origin = location.origin || "";
    let path = location.pathname || "/";
    const encrypted = String(token || "").indexOf("SD2.") === 0;
    const file = (opts && opts.readOnly) || encrypted ? "view.html" : "app.html";
    if (!new RegExp(file + "$", "i").test(path)) {
      path = path.replace(/index\.html$/i, "").replace(/app\.html$/i, "").replace(/view\.html$/i, "");
      if (!path.endsWith("/")) path += "/";
      path += file;
    }
    return token.length < 7000 ? origin + path + "#sd=" + token : "";
  }

  function storeToken(pack, token) {
    const code = shortCode(pack.ticketNo);
    const book = readBook();
    book[code] = token;
    writeBook(book);
    return code;
  }

  async function encode(pack, opts) {
    opts = opts || {};
    const p = Object.assign({}, pack, { readOnly: !!(opts.readOnly || pack.readOnly) });
    const json = JSON.stringify(compact(p));
    let token;
    if (opts.password) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(String(opts.password), salt);
      const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(json));
      const packed = new Uint8Array(16 + 12 + cipher.byteLength);
      packed.set(salt, 0);
      packed.set(iv, 16);
      packed.set(new Uint8Array(cipher), 28);
      token = "SD2." + b64uEncodeBytes(packed);
    } else {
      token = "SD1." + b64uEncode(json);
    }
    const code = storeToken(pack, token);
    const url = shareUrl(token, { readOnly: !!(opts.readOnly || token.indexOf("SD2.") === 0) });
    return { code, token, url, bytes: token.length, readOnly: !!opts.readOnly, encrypted: token.indexOf("SD2.") === 0 };
  }

  function decodeSync(input) {
    const token = extractToken(input);
    if (token.indexOf("SD2.") === 0) {
      const err = new Error("NEED_PASSWORD");
      err.code = "NEED_PASSWORD";
      throw err;
    }
    let body = token;
    if (body.indexOf("SD1.") === 0) body = body.slice(4);
    try {
      return expand(JSON.parse(b64uDecode(body)));
    } catch (e) {
      throw new Error("无法解析分享令牌（已过期或复制不完整）");
    }
  }

  async function decode(input, password) {
    const token = extractToken(input);
    if (token.indexOf("SD2.") === 0) {
      if (!password) {
        const err = new Error("NEED_PASSWORD");
        err.code = "NEED_PASSWORD";
        throw err;
      }
      const raw = b64uDecodeBytes(token.slice(4));
      if (raw.length < 30) throw new Error("加密令牌不完整");
      const salt = raw.slice(0, 16);
      const iv = raw.slice(16, 28);
      const data = raw.slice(28);
      const key = await deriveKey(String(password), salt);
      try {
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
        return expand(JSON.parse(new TextDecoder().decode(plain)));
      } catch (e) {
        throw new Error("口令不正确或令牌已损坏");
      }
    }
    return decodeSync(input);
  }

  w.SmartShare = { encode, decode, decodeSync, compact, expand, peek, isEncrypted };
})(window);
