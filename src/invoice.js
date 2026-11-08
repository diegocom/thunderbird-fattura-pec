function decodeXml(bytes) {
  const hasPrefix = (...prefix) => prefix.every((byte, index) => bytes[index] === byte);
  let encoding = "utf-8";
  if (hasPrefix(0xff, 0xfe) || hasPrefix(0x3c, 0x00)) {
    encoding = "utf-16le";
  } else if (hasPrefix(0xfe, 0xff) || hasPrefix(0x00, 0x3c)) {
    encoding = "utf-16be";
  } else if (!hasPrefix(0xef, 0xbb, 0xbf)) {
    const prefix = new TextDecoder().decode(bytes.subarray(0, 512));
    encoding = /^<\?xml\s+[^?]*?\bencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(prefix)?.[1] ?? encoding;
  }
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}

const children = (node, name) => Array.from(node?.children ?? []).filter((child) => child.localName === name);
const child = (node, name) => children(node, name)[0];
const value = (node, name) => child(node, name)?.textContent.trim() ?? "";

function party(taxData, nameData) {
  const taxId = child(taxData, "IdFiscaleIVA");
  return {
    name: value(nameData, "Denominazione") ||
      [value(nameData, "Nome"), value(nameData, "Cognome")].filter(Boolean).join(" "),
    vatId: value(taxId, "IdPaese") + value(taxId, "IdCodice"),
    fiscalCode: value(taxData, "CodiceFiscale"),
  };
}

function ordinaryParty(node) {
  const data = child(node, "DatiAnagrafici");
  return party(data, child(data, "Anagrafica"));
}

function ordinaryDetails(items) {
  return {
    lines: children(items, "DettaglioLinee").map((line) => ({
      number: value(line, "NumeroLinea"),
      description: value(line, "Descrizione"),
      quantity: value(line, "Quantita"),
      unitPrice: value(line, "PrezzoUnitario"),
      amount: value(line, "PrezzoTotale"),
      rate: value(line, "AliquotaIVA"),
      nature: value(line, "Natura"),
    })),
    vat: children(items, "DatiRiepilogo").map((entry) => ({
      rate: value(entry, "AliquotaIVA"),
      nature: value(entry, "Natura"),
      taxable: value(entry, "ImponibileImporto"),
      tax: value(entry, "Imposta"),
    })),
  };
}

function simplifiedDetails(items) {
  const lines = [];
  const vat = [];
  for (const [index, line] of items.entries()) {
    const data = child(line, "DatiIVA");
    const rate = value(data, "Aliquota");
    const nature = value(line, "Natura");
    lines.push({
      number: String(index + 1),
      description: value(line, "Descrizione"),
      quantity: "",
      unitPrice: "",
      amount: value(line, "Importo"),
      rate,
      nature,
    });
    if (data || nature) vat.push({ rate, nature, taxable: "", tax: value(data, "Imposta") });
  }
  return { lines, vat };
}

export function parseInvoice(bytes) {
  const xml = decodeXml(bytes);
  if (xml.includes("<!DOCTYPE")) {
    const markup = xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g, "");
    // PEC transport metadata can declare daticert.dtd. Ignore it before invoking the XML parser.
    if (/^\s*<!DOCTYPE\s+postacert(?=[\s>\[])/.test(markup)) return [];
    if (markup.includes("<!DOCTYPE")) throw new Error("Dichiarazione DOCTYPE non supportata.");
  }
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const root = document.documentElement;
  if (root.localName === "parsererror") throw new Error("XML non valido.");
  const simplified = root.localName === "FatturaElettronicaSemplificata";
  if (!simplified && root.localName !== "FatturaElettronica") return [];

  const header = child(root, "FatturaElettronicaHeader");
  const supplierNode = child(header, "CedentePrestatore");
  const customerNode = child(header, "CessionarioCommittente");
  const bodies = children(root, "FatturaElettronicaBody");
  if (!supplierNode || !customerNode || !bodies.length) {
    throw new Error("Struttura FatturaPA incompleta.");
  }
  const supplier = simplified ? party(supplierNode, supplierNode) : ordinaryParty(supplierNode);
  const customer = simplified
    ? party(child(customerNode, "IdentificativiFiscali"), child(customerNode, "AltriDatiIdentificativi"))
    : ordinaryParty(customerNode);
  return bodies.map((body) => {
    const documentData = child(child(body, "DatiGenerali"), "DatiGeneraliDocumento");
    const items = children(body, "DatiBeniServizi");
    const number = value(documentData, "Numero");
    const date = value(documentData, "Data");
    if (!number || !date || !items.length) throw new Error("Dati della fattura incompleti.");
    return {
      supplier,
      customer,
      number,
      date,
      documentType: value(documentData, "TipoDocumento"),
      currency: value(documentData, "Divisa"),
      total: value(documentData, "ImportoTotaleDocumento"),
      ...(simplified ? simplifiedDetails(items) : ordinaryDetails(items[0])),
    };
  });
}
