(function (w) {
  const LEGACY = "smartdoc_archive";
  const KIND = "smartdoc-org-vault";

  function orgId(company) {
    const user = (w.SmartAuth && w.SmartAuth.current && w.SmartAuth.current()) || {};
    const raw = String(company || user.company || "demo").trim();
    const slug = raw.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
    return slug || "demo";
  }

  function key(company) {
    return "smartdoc_vault_" + orgId(company);
  }

  function envelope(tickets, extra) {
    const user = (w.SmartAuth && w.SmartAuth.current && w.SmartAuth.current()) || {};
    return Object.assign({
      kind: KIND,
      version: 1,
      orgId: orgId(),
      company: user.company || "",
      tickets: Array.isArray(tickets) ? tickets : [],
      updatedAt: new Date().toISOString(),
    }, extra || {});
  }

  function readRaw(company) {
    try {
      return JSON.parse(localStorage.getItem(key(company)) || "null");
    } catch (e) {
      return null;
    }
  }

  function isDemoOrg() {
    const user = (w.SmartAuth && w.SmartAuth.current && w.SmartAuth.current()) || {};
    const email = String(user.email || "");
    const id = orgId();
    return email.indexOf("@smartdoc.com") >= 0 || id.indexOf("demo") === 0;
  }

  function migrateLegacy() {
    const current = readRaw();
    if (current && Array.isArray(current.tickets) && current.tickets.length) return current;
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem(LEGACY) || "[]") || []; } catch (e) { legacy = []; }
    if (!Array.isArray(legacy) || !legacy.length) return current;
    if (!isDemoOrg() && current && current.migrated) return current;
    const payload = envelope(legacy, { migrated: true });
    localStorage.setItem(key(), JSON.stringify(payload));
    return payload;
  }

  function initialized() {
    migrateLegacy();
    return localStorage.getItem(key()) != null;
  }

  function load() {
    const data = migrateLegacy() || readRaw();
    if (data && Array.isArray(data.tickets)) return data.tickets;
    return [];
  }

  function save(tickets) {
    const payload = envelope(tickets);
    localStorage.setItem(key(), JSON.stringify(payload));
    return payload;
  }

  function exportJson(tickets) {
    return JSON.stringify(envelope(tickets), null, 2);
  }

  function parseVault(obj) {
    if (!obj) throw new Error("空票库");
    if (typeof obj === "string") obj = JSON.parse(obj);
    if (obj.kind !== KIND && !Array.isArray(obj.tickets) && !Array.isArray(obj)) {
      throw new Error("不是智单通企业票库文件");
    }
    const tickets = Array.isArray(obj.tickets) ? obj.tickets : (Array.isArray(obj) ? obj : []);
    return envelope(tickets, { importedAt: new Date().toISOString() });
  }

  function mergeTickets(local, incoming) {
    const map = {};
    (local || []).forEach((t) => { if (t && t.ticketNo) map[t.ticketNo] = t; });
    (incoming || []).forEach((t) => {
      if (!t || !t.ticketNo) return;
      const prev = map[t.ticketNo];
      if (!prev) { map[t.ticketNo] = t; return; }
      const pt = Date.parse(prev.updatedAt || prev.createdAt || 0) || 0;
      const it = Date.parse(t.updatedAt || t.createdAt || 0) || 0;
      map[t.ticketNo] = it >= pt ? Object.assign({}, prev, t) : Object.assign({}, t, prev);
    });
    return Object.keys(map).map((k) => map[k]);
  }

  async function pull() {
    const id = orgId();
    const r = await fetch("/api/vault/" + encodeURIComponent(id));
    if (!r.ok) throw new Error("票库服务不可用");
    const data = await r.json();
    const remote = Array.isArray(data.tickets) ? data.tickets : [];
    const merged = mergeTickets(load(), remote);
    save(merged);
    return { tickets: merged, remote: remote.length, orgId: data.orgId || id };
  }

  async function push(tickets) {
    const id = orgId();
    const payload = envelope(tickets || load());
    const r = await fetch("/api/vault/" + encodeURIComponent(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error("票库写入失败");
    const data = await r.json();
    return data;
  }

  w.SmartVault = { orgId, key, load, save, exportJson, parseVault, mergeTickets, pull, push, migrateLegacy, isDemoOrg, initialized, KIND };
})(window);
