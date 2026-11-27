(function (w) {
  async function loadLibs() {
    if (!w.SmartExtract || !w.SmartExtract.loadScript) throw new Error("缺少脚本加载器");
    if (!w.html2canvas) {
      await w.SmartExtract.loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
    }
    if (!(w.jspdf && w.jspdf.jsPDF)) {
      await w.SmartExtract.loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js");
    }
  }

  async function exportPdfBlob(type, shipment, opts) {
    if (!w.SmartDocs) throw new Error("单证模块未加载");
    await loadLibs();
    const html = w.SmartDocs.wrap(type, shipment, opts || {}).replace("class=\"print-bar no-print\"", "class=\"print-bar no-print\" style=\"display:none\"");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;left:-12000px;top:0;width:794px;height:1123px;border:0;background:#fff;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    await new Promise((resolve) => setTimeout(resolve, 450));
    const canvas = await w.html2canvas(doc.body, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
    document.body.removeChild(iframe);
    const JsPDF = w.jspdf.jsPDF;
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = 210;
    const pageH = 297;
    const imgH = (canvas.height * pageW) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.92);
    let y = 0;
    let left = imgH;
    let first = true;
    while (left > 0.5) {
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(img, "JPEG", 0, -y, pageW, imgH);
      y += pageH;
      left -= pageH;
    }
    const name = String(type || "DOC").toUpperCase() + "_" + (shipment.ticketNo || "TICKET") + ".pdf";
    return { name, blob: pdf.output("blob"), pdf };
  }

  async function exportPdf(type, shipment, opts) {
    const out = await exportPdfBlob(type, shipment, opts);
    out.pdf.save(out.name);
    return out.name;
  }

  w.SmartPdf = { exportPdf, exportPdfBlob };
})(window);
