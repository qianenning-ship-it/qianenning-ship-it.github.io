(function (w) {
  const DB_NAME = "smartdoc_blobs";
  const STORE = "files";
  const MAX_BYTES = 4 * 1024 * 1024;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const st = db.createObjectStore(STORE, { keyPath: "id" });
          st.createIndex("ticketNo", "ticketNo", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function makeThumb(file) {
    if (!file || !String(file.type || "").startsWith("image/")) return "";
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("thumb"));
        el.src = url;
      });
      URL.revokeObjectURL(url);
      const max = 240;
      const scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.72);
    } catch (e) {
      return "";
    }
  }

  async function put(ticketNo, file, extra) {
    extra = extra || {};
    if (!file || !ticketNo) return null;
    if (file.size > MAX_BYTES) {
      return {
        id: ticketNo + ":" + (file.name || Date.now()),
        ticketNo,
        fileName: file.name,
        mime: file.type,
        size: file.size,
        skipped: true,
        reason: "oversize",
        ocrText: extra.ocrText || "",
        method: extra.method || "",
        at: new Date().toISOString(),
      };
    }
    const thumb = extra.thumb || (await makeThumb(file));
    const rec = {
      id: ticketNo + ":" + (file.name || Date.now()) + ":" + (file.size || 0),
      ticketNo,
      fileName: file.name || "upload.bin",
      mime: file.type || "application/octet-stream",
      size: file.size || 0,
      blob: file,
      thumb,
      ocrText: extra.ocrText || "",
      method: extra.method || "",
      at: new Date().toISOString(),
    };
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    await txDone(tx);
    db.close();
    return {
      id: rec.id,
      ticketNo: rec.ticketNo,
      fileName: rec.fileName,
      mime: rec.mime,
      size: rec.size,
      thumb: rec.thumb,
      ocrText: rec.ocrText,
      method: rec.method,
      at: rec.at,
    };
  }

  async function list(ticketNo) {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const idx = tx.objectStore(STORE).index("ticketNo");
    const rows = await new Promise((resolve, reject) => {
      const req = idx.getAll(ticketNo);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.map((r) => ({
      id: r.id,
      ticketNo: r.ticketNo,
      fileName: r.fileName,
      mime: r.mime,
      size: r.size,
      thumb: r.thumb || "",
      ocrText: r.ocrText || "",
      method: r.method || "",
      at: r.at,
    }));
  }

  function compactMeta(list) {
    return (list || []).map((f) => {
      if (typeof f === "string") return { fileName: f };
      return {
        fileName: f.fileName || f.name || "",
        mime: f.mime || "",
        size: f.size || 0,
        thumb: f.thumb || "",
        ocrText: String(f.ocrText || "").slice(0, 800),
        method: f.method || "",
        at: f.at || "",
      };
    });
  }

  w.SmartBlobs = { put, list, makeThumb, compactMeta };
})(window);
