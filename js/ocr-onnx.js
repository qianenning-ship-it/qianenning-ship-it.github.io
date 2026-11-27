/**
 * 浏览器端 PP-OCRv5（ONNX Runtime Web / WASM，可选 WebGPU）。
 * 扫描件在对方电脑识别，模型走 CDN，可缓存在 Cache API。
 */
const PHASE = {
  loading_dictionary: "正在加载中文词典",
  loading_detection_model: "正在下载文字检测模型",
  loading_recognition_model: "正在下载文字识别模型（约 16MB，仅首次）",
  warmup: "正在预热识别引擎",
  preprocessing: "正在预处理图像",
  detecting: "正在检测文字区域",
  recognizing: "正在识别文字",
};

const ORT_WASM = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";
const MODEL_GH = "https://cdn.jsdelivr.net/gh/bent2685/ocr-web@v0.1.1/models";

function emit(message, extra) {
  const el = document.getElementById("recogStatus");
  if (el) el.textContent = message;
  window.dispatchEvent(new CustomEvent("smartdoc-ocr", { detail: { message, ...(extra || {}) } }));
}

function pick(mod, names) {
  for (const n of names) {
    if (mod && typeof mod[n] === "function") return mod[n];
    if (mod && mod.default && typeof mod.default[n] === "function") return mod.default[n];
  }
  if (typeof mod === "function") return mod;
  if (mod && typeof mod.default === "function") return mod.default;
  return null;
}

async function createFfocr() {
  const mod = await import("https://cdn.jsdelivr.net/npm/ffocr@0.1.11/+esm");
  const factory = pick(mod, ["createDefaultPPOcrV5", "ocrWithDefaultPPOcrV5"]);
  if (!factory) throw new Error("ffocr 未导出 createDefaultPPOcrV5");
  const ocr = factory({
    cacheModels: true,
    providerPreference: "auto",
    warmup: false,
    ort: { wasmPaths: ORT_WASM, wasmThreads: 1 },
  });
  if (!ocr || typeof ocr.ocr !== "function") throw new Error("ffocr 实例无效");
  return {
    kind: "ffocr",
    async recognize(blob) {
      const result = await ocr.ocr(blob, {
        onProgress(p) {
          const base = PHASE[p.phase] || p.phase || "识别中";
          let extra = "";
          if (p.loaded != null && p.totalBytes) extra = " " + Math.round((p.loaded / p.totalBytes) * 100) + "%";
          else if (p.phase === "recognizing" && p.total) extra = " " + (p.current || 0) + "/" + p.total;
          emit(base + extra + "…");
        },
      });
      return {
        text: (result && result.text) || "",
        lines: (result && result.lines) || [],
        engine: "PP-OCRv5 ONNX",
      };
    },
  };
}

async function createOcrWeb() {
  emit("正在加载备用中文 OCR 引擎…");
  const [core, models] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/@ocr-web/core@0.2.1/+esm"),
    import("https://cdn.jsdelivr.net/npm/@ocr-web/models-ppocrv5@0.1.1/+esm"),
  ]);
  const OcrEngine = core.OcrEngine || (core.default && core.default.OcrEngine);
  const urls = (models && models.ppocrV5) || (models.default && models.default.ppocrV5) || {
    detection: MODEL_GH + "/ppocrv5_det.onnx",
    recognition: MODEL_GH + "/ppocrv5_rec.onnx",
    dictionary: MODEL_GH + "/ppocrv5_dict.txt",
  };
  if (!OcrEngine || typeof OcrEngine.create !== "function") throw new Error("@ocr-web/core 不可用");
  const engine = await OcrEngine.create({
    models: { detection: urls.detection, recognition: urls.recognition },
    dictionary: urls.dictionary,
    runtime: "wasm",
    wasmPaths: ORT_WASM,
    numThreads: 1,
    onProgress(p) {
      const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
      emit("正在下载识别模型 " + (p.file || "") + " " + pct + "%");
    },
  });
  return {
    kind: "ocr-web",
    async recognize(blob) {
      emit("正在用 PP-OCRv5 识别…");
      const result = await engine.recognize(blob, { maxSideLen: 960, detThreshold: 0.3 });
      return {
        text: (result && result.fullText) || ((result && result.lines) || []).map((l) => l.text).join("\n"),
        lines: (result && result.lines) || [],
        engine: "PP-OCRv5 ONNX",
      };
    },
  };
}

let loading = null;
let engine = null;

async function getEngine() {
  if (engine) return engine;
  if (!loading) {
    loading = (async () => {
      emit("正在加载浏览器中文 OCR（PP-OCRv5 / ONNX）…");
      try {
        engine = await createFfocr();
      } catch (e) {
        console.warn("[SmartOcr] ffocr 失败，改用 @ocr-web/core", e);
        engine = await createOcrWeb();
      }
      emit("中文识别引擎已就绪，开始识图…");
      return engine;
    })();
  }
  return loading;
}

async function recognize(blob) {
  const inst = await getEngine();
  return inst.recognize(blob);
}

const api = { recognize, getEngine };
window.SmartOcr = api;
export { recognize, getEngine };
