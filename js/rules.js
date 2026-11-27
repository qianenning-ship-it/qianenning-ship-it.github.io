(function (w) {
  const KEY = "smartdoc_rules";
  const VERSION = "2026.11.27";

  const CATALOG = [
    { id: "iso6346", name: "ISO 6346 柜号校验位", desc: "4 字母 + 7 数字，并核对 check digit", enabled: true },
    { id: "hs", name: "HS / HTS 格式", desc: "建议 xxxx.xx.xxxx 或 8–10 位数字", enabled: true },
    { id: "ams24h", name: "AMS 24-Hour Rule", desc: "装船前 24 小时舱单；Notify Party 必填", enabled: true },
    { id: "isf102", name: "ISF 10+2", desc: "装船前申报；Importer、Manufacturer、HTS、柜号、装柜地", enabled: true },
    { id: "notify", name: "Notify Party 必填（提单/AMS）", desc: "空通知方可能导致 DNL", enabled: true },
  ];

  function defaults() {
    return {
      version: VERSION,
      list: CATALOG.map((r) => ({ ...r })),
      custom: [],
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw || !Array.isArray(raw.list)) return defaults();
      const byId = {};
      raw.list.forEach((r) => { byId[r.id] = r; });
      const list = CATALOG.map((c) => ({ ...c, enabled: byId[c.id] ? !!byId[c.id].enabled : c.enabled }));
      return { version: raw.version || VERSION, list, custom: Array.isArray(raw.custom) ? raw.custom : [] };
    } catch (e) {
      return defaults();
    }
  }

  function save(bundle) {
    localStorage.setItem(KEY, JSON.stringify(bundle));
    return bundle;
  }

  function get() {
    return load();
  }

  function on(id) {
    const b = load();
    const r = b.list.find((x) => x.id === id);
    if (!r) return true;
    return !!r.enabled;
  }

  function setEnabled(id, enabled) {
    const b = load();
    const r = b.list.find((x) => x.id === id);
    if (r) r.enabled = !!enabled;
    b.version = VERSION;
    return save(b);
  }

  function addCustom(rule) {
    const b = load();
    const item = {
      id: "c" + Date.now().toString(36),
      kind: "custom",
      name: String(rule.name || "自定义规则").slice(0, 40),
      field: rule.field || "sealNo",
      test: rule.test === "regex" ? "regex" : "required",
      pattern: rule.pattern || "",
      message: rule.message || "未通过自定义规则",
      enabled: true,
    };
    b.custom.push(item);
    return save(b);
  }

  function removeCustom(id) {
    const b = load();
    b.custom = b.custom.filter((x) => x.id !== id);
    return save(b);
  }

  function toggleCustom(id, enabled) {
    const b = load();
    const r = b.custom.find((x) => x.id === id);
    if (r) r.enabled = !!enabled;
    return save(b);
  }

  function snapshot() {
    const b = load();
    return { version: b.version, list: b.list, custom: b.custom };
  }

  function applyImported(snap) {
    if (!snap || !Array.isArray(snap.list)) return load();
    return save({
      version: snap.version || VERSION,
      list: CATALOG.map((c) => {
        const hit = snap.list.find((x) => x.id === c.id);
        return { ...c, enabled: hit ? !!hit.enabled : c.enabled };
      }),
      custom: Array.isArray(snap.custom) ? snap.custom : [],
    });
  }

  w.SmartRules = {
    VERSION,
    CATALOG,
    get,
    on,
    setEnabled,
    addCustom,
    removeCustom,
    toggleCustom,
    snapshot,
    applyImported,
  };
})(window);
