import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import PostalMime from "postal-mime";
import { findInvoices } from "../src/attachments.js";
import { extractSignedContent } from "../src/cms.js";
import { parseInvoice } from "../src/invoice.js";
import { showResult } from "../src/render.js";

const preview = await readFile(new URL("../extension/preview.html", import.meta.url), "utf8");
const { window } = new JSDOM(preview);
globalThis.DOMParser = window.DOMParser;
globalThis.document = window.document;

async function fixture(name) {
  const bytes = await readFile(new URL(`../fixtures/${name}.eml`, import.meta.url));
  const levels = new Map();
  const files = new Map();
  async function register(raw) {
    const id = levels.size + 1;
    const { attachments } = await PostalMime.parse(raw, { forceRfc822Attachments: true });
    const list = [];
    levels.set(id, list);
    for (const part of attachments) {
      const partName = `1.${list.length + 1}`;
      const record = { partName, name: part.filename, contentType: part.mimeType, type: "normal", size: part.content.byteLength };
      if (part.mimeType === "message/rfc822") record.message = { id: await register(part.content) };
      list.push(record);
      files.set(`${id}:${partName}`, new Blob([part.content]));
    }
    return id;
  }
  const messageId = await register(bytes);
  const read = [];
  const list = [];
  const messages = {
    async listAttachments(id) {
      list.push(id);
      return levels.get(id);
    },
    async getAttachmentFile(id, partName) {
      read.push(`${id}:${partName}`);
      return files.get(`${id}:${partName}`);
    },
  };
  return { messages, messageId, read, list };
}

test("XML diretto, dati e visualizzazione come testo", async () => {
  const { messages, messageId } = await fixture("01-xml-diretto");
  const result = await findInvoices(messages, messageId);
  assert.deepEqual(result.unreadable, []);
  assert.equal(result.invoices.length, 1);
  const [invoice] = result.invoices;
  assert.equal(invoice.supplier.name, "Fornitore Dimostrativo S.r.l.");
  assert.equal(invoice.customer.name, "Anna Dimostrativa");
  assert.equal(invoice.number, "DEMO/01");
  assert.equal(invoice.date, "2026-11-03");
  assert.equal(invoice.total, "122.00");
  assert.deepEqual(invoice.vat, [{ rate: "22.00", nature: "", taxable: "100.00", tax: "22.00" }]);
  assert.equal(invoice.lines[0].description, "Attività di prova <img src=x onerror=alert(1)>");
  showResult(result);
  assert.equal(document.querySelector("#invoice img"), null);
  assert.match(document.getElementById("invoice").textContent, /Attività di prova <img src=x onerror=alert\(1\)>/);
  assert.match(document.querySelector(".total").textContent, /122,00 EUR/);
  assert.equal(document.querySelector(".invoice-actions button").textContent, "Salva PDF");
});

test("postacert.eml RFC 822 con XML: API nativa del messaggio annidato", async () => {
  const { messages, messageId, read, list } = await fixture("02-xml-annidato");
  const result = await findInvoices(messages, messageId);
  assert.equal(result.invoices[0]?.number, "DEMO/01");
  assert.deepEqual(result.unreadable, []);
  assert.deepEqual(list, [1, 2]);
  assert.deepEqual(read, ["1:1.1", "2:1.1"]);
});

test("postacert.eml come file con P7M CAdES: parser MIME e contenuto CMS", async () => {
  const { messages, messageId, read, list } = await fixture("03-p7m-annidato");
  const result = await findInvoices(messages, messageId);
  assert.deepEqual(result.unreadable, []);
  assert.equal(result.invoices[0]?.filename, "IT00000000000_demo.xml.p7m");
  assert.equal(result.invoices[0]?.number, "DEMO/01");
  assert.deepEqual(list, [1]);
  assert.deepEqual(read, ["1:1.1", "1:1.2"]);
});

test("i metadati PEC e SdI e le notifiche SdI non diventano fatture", async () => {
  const { messages, messageId } = await fixture("04-soli-metadati");
  assert.deepEqual(await findInvoices(messages, messageId), { invoices: [], unreadable: [] });
});

test("P7M nel messaggio RFC 822 esposto dall’API nativa", async () => {
  const { messages, messageId, list } = await fixture("07-p7m-rfc822");
  const { invoices, unreadable } = await findInvoices(messages, messageId);
  assert.deepEqual(unreadable, []);
  assert.equal(invoices[0]?.number, "DEMO/01");
  assert.equal(invoices[0]?.filename, "IT00000000000_demo.xml.p7m");
  assert.deepEqual(list, [1, 2]);
});

test("tracciato FSM10: più righe e dati IVA senza ricavare valori assenti", async () => {
  const { messages, messageId } = await fixture("08-xml-semplificato");
  const { invoices, unreadable } = await findInvoices(messages, messageId);
  assert.deepEqual(unreadable, []);
  const [invoice] = invoices;
  assert.equal(invoice.number, "DEMO/S1");
  assert.equal(invoice.customer.fiscalCode, "11111111111");
  assert.equal(invoice.supplier.name, "Fornitore Dimostrativo S.r.l.");
  assert.equal(invoice.total, "");
  assert.deepEqual(invoice.lines.map(({ amount }) => amount), ["55.00", "12.20"]);
  assert.deepEqual(invoice.vat.map(({ rate, tax }) => [rate, tax]), [["10.00", ""], ["", "2.20"]]);
});

test("più fatture: elenco e apertura del documento scelto", async () => {
  const { messages, messageId } = await fixture("05-piu-fatture");
  const result = await findInvoices(messages, messageId);
  assert.deepEqual(result.invoices.map(({ number }) => number), ["DEMO/01", "DEMO/02"]);
  globalThis.document = new JSDOM(preview).window.document;
  showResult(result);
  assert.equal(document.getElementById("invoice").hidden, true);
  assert.equal(document.querySelector(".invoice-actions"), null);
  const buttons = document.querySelectorAll("#invoice-list button");
  assert.equal(buttons.length, 2);
  buttons[1].click();
  assert.equal(document.getElementById("invoice-title").textContent, "Documento n. DEMO/02");
  assert.equal(document.querySelector(".invoice-actions button:last-child").textContent, "Salva PDF");
  document.querySelector(".invoice-actions button:first-child").click();
  assert.equal(document.getElementById("choices").hidden, false);
});

test("XML illeggibile e allegati collegati non letti", async () => {
  const { messages, messageId, read } = await fixture("06-xml-illeggibile");
  const attachments = await messages.listAttachments(messageId);
  messages.listAttachments = async () => [
    ...attachments,
    { name: "esterna.xml", type: "linked", partName: "1.3" },
  ];
  assert.deepEqual(await findInvoices(messages, messageId), {
    invoices: [],
    unreadable: ["fattura-rotta.xml", "esterna.xml"],
  });
  assert.deepEqual(read, ["1:1.1", "1:1.2"]);
});

test("lotto FatturaPA UTF-16 e totale facoltativo", async () => {
  const { messages, messageId } = await fixture("01-xml-diretto");
  const file = await messages.getAttachmentFile(messageId, "1.2");
  const xml = await file.text();
  const body = xml.match(/<FatturaElettronicaBody>[\s\S]*?<\/FatturaElettronicaBody>/)[0];
  const extra = body.replace("DEMO/01", "DEMO/02").replace(/<ImportoTotaleDocumento>.*?<\/ImportoTotaleDocumento>/, "");
  const batch = xml.replace(body, body + extra).replace("UTF-8", "UTF-16");
  const invoices = parseInvoice(Buffer.from("\uFEFF" + batch, "utf16le"));
  assert.deepEqual(invoices.map(({ number, total }) => [number, total]), [["DEMO/01", "122.00"], ["DEMO/02", ""]]);
});

test("DOCTYPE bloccato e P7M malformato rifiutato", () => {
  assert.throws(() => parseInvoice(Buffer.from('<!DOCTYPE x [<!ENTITY a "test">]><x>&a;</x>')), /DOCTYPE/);
  assert.throws(() => extractSignedContent(new Uint8Array([0x30, 0x01, 0x00])), /P7M/);
});
