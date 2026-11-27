(function (w) {
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const NODES = {
    ams: {
      shipper: "CUSCAR/NAD+CZ Consignor",
      consignee: "CUSCAR/NAD+CN Consignee",
      notifyParty: "CUSCAR/NAD+NI Notify",
      containerNo: "CUSCAR/EQD+CN Container",
      sealNo: "CUSCAR/SEL Seal",
      hsCode: "CUSCAR/FTX+AAA HTS",
      description: "CUSCAR/FTX+AAA Goods",
      packages: "CUSCAR/GID Packages",
      grossWeight: "CUSCAR/MEA+WT GrossWeight",
      pol: "CUSCAR/LOC+9 POL",
      pod: "CUSCAR/LOC+11 POD",
      vessel: "CUSCAR/TDT+20 Vessel",
      voyage: "CUSCAR/TDT+20 Voyage",
      etd: "CUSCAR/DTM+132 ETD",
    },
    isf: {
      shipper: "ISF/SellerManufacturer",
      consignee: "ISF/ImporterOfRecord",
      notifyParty: "ISF/ShipToParty",
      containerNo: "ISF/Equipment/ContainerNumber",
      hsCode: "ISF/Commodity/HTSUS",
      description: "ISF/Commodity/Description",
      pol: "ISF/StuffingLocation",
      pod: "ISF/LastForeignPort",
      vessel: "ISF/Conveyance/Vessel",
      voyage: "ISF/Conveyance/Voyage",
      etd: "ISF/DTM/LoadingDate",
    },
  };

  function nodeOf(channel, key) {
    return (NODES[channel] && NODES[channel][key]) || (channel.toUpperCase() + "/" + key);
  }

  function amsXml(s, rec) {
    s = s || {};
    rec = rec || {};
    return `<?xml version="1.0" encoding="UTF-8"?>
<CUSCAR xmlns="urn:smartdoc:edi:cuscar:draft">
  <Header>
    <DocumentName>CUSCAR</DocumentName>
    <Function>9</Function>
    <Draft>true</Draft>
    <MessageRef>${esc(rec.ref || rec.id || s.ticketNo)}</MessageRef>
    <TicketNo>${esc(s.ticketNo)}</TicketNo>
    <FiledAt>${esc(rec.settledAt || rec.at || "")}</FiledAt>
    <Status>${esc(rec.status || "draft")}</Status>
  </Header>
  <TDT code="20">
    <Vessel>${esc(s.vessel)}</Vessel>
    <Voyage>${esc(s.voyage)}</Voyage>
  </TDT>
  <DTM qualifier="132"><DateTime>${esc(s.etd)}</DateTime></DTM>
  <LOC qualifier="9"><Port>${esc(s.pol)}</Port></LOC>
  <LOC qualifier="11"><Port>${esc(s.pod)}</Port></LOC>
  <NAD qualifier="CZ"><Name>${esc(s.shipper)}</Name></NAD>
  <NAD qualifier="CN"><Name>${esc(s.consignee)}</Name></NAD>
  <NAD qualifier="NI"><Name>${esc(s.notifyParty)}</Name></NAD>
  <EQD qualifier="CN">
    <ContainerNumber>${esc(s.containerNo)}</ContainerNumber>
    <SEL>${esc(s.sealNo)}</SEL>
  </EQD>
  <GID>
    <Packages>${esc(s.packages)}</Packages>
    <FTX>${esc(s.description)}</FTX>
    <HTS>${esc(s.hsCode)}</HTS>
    <MEA qualifier="WT">${esc(s.grossWeight)}</MEA>
    <MEA qualifier="VOL">${esc(s.volume)}</MEA>
  </GID>
  <Remark>SmartDoc homologous draft. Not a live ACE filing.</Remark>
</CUSCAR>
`;
  }

  function isfXml(s, rec) {
    s = s || {};
    rec = rec || {};
    return `<?xml version="1.0" encoding="UTF-8"?>
<ISF10Plus2 xmlns="urn:smartdoc:edi:isf:draft">
  <Header>
    <DocumentName>ISF-10</DocumentName>
    <Draft>true</Draft>
    <ISFRef>${esc(rec.ref || rec.id || s.ticketNo)}</ISFRef>
    <TicketNo>${esc(s.ticketNo)}</TicketNo>
    <Status>${esc(rec.status || "draft")}</Status>
  </Header>
  <ImporterOfRecord>${esc(s.consignee)}</ImporterOfRecord>
  <Consignee>${esc(s.consignee)}</Consignee>
  <SellerManufacturer>${esc(s.shipper)}</SellerManufacturer>
  <ShipToParty>${esc(s.notifyParty || s.consignee)}</ShipToParty>
  <StuffingLocation>${esc(s.pol)}</StuffingLocation>
  <Consolidator>${esc(s.shipper)}</Consolidator>
  <Commodity>
    <HTSUS>${esc(s.hsCode)}</HTSUS>
    <Description>${esc(s.description)}</Description>
  </Commodity>
  <Equipment>
    <ContainerNumber>${esc(s.containerNo)}</ContainerNumber>
  </Equipment>
  <Conveyance>
    <Vessel>${esc(s.vessel)}</Vessel>
    <Voyage>${esc(s.voyage)}</Voyage>
    <LoadingDate>${esc(s.etd)}</LoadingDate>
  </Conveyance>
  <Remark>SmartDoc homologous draft. Not a live CBP ISF filing.</Remark>
</ISF10Plus2>
`;
  }

  function build(channel, shipment, rec) {
    return channel === "isf" ? isfXml(shipment, rec) : amsXml(shipment, rec);
  }

  function filename(channel, shipment, rec) {
    const t = (shipment && shipment.ticketNo) || "TICKET";
    const ref = (rec && rec.ref) || "DRAFT";
    return (channel === "isf" ? "ISF_" : "CUSCAR_AMS_") + t + "_" + ref + ".xml";
  }

  w.SmartEdi = { NODES, nodeOf, build, filename, amsXml, isfXml };
})(window);
