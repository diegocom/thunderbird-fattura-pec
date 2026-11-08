import assert from "node:assert/strict";
import { test } from "node:test";
import { saveInvoicePdf } from "../src/pdf-download.js";

const invoice = {
  filename: "prova.xml.p7m",
  number: "DEMO/02",
  date: "2026-11-03",
  documentType: "TD01",
  currency: "EUR",
  total: "122.00",
  supplier: { name: "Società di prova", vatId: "IT00000000000" },
  customer: { name: "Cliente di prova", fiscalCode: "11111111111" },
  lines: [{ number: "1", description: "Attività di prova", quantity: "2.00",
    unitPrice: "50.00", amount: "100.00", rate: "22.00", nature: "" }],
  vat: [{ rate: "22.00", nature: "", taxable: "100.00", tax: "22.00" }],
};

test("PDF locale con selettore Salva con nome, nome sicuro e attesa della scrittura", async () => {
  let blobUrl;
  let listener;
  const downloads = {
    async download({ url, filename, saveAs }) {
      assert.equal(saveAs, true);
      assert.equal(filename, "fattura-2026-11-03-DEMO-02.pdf");
      assert.match(url, /^blob:/);
      blobUrl = url;
      return 9;
    },
    onChanged: {
      addListener(callback) { listener = callback; },
      removeListener(callback) {
        assert.equal(callback, listener);
        listener = null;
      },
    },
    async search({ id }) {
      assert.equal(id, 9);
      const response = await fetch(blobUrl);
      assert.equal(response.headers.get("content-type"), "application/pdf");
      assert.match(Buffer.from(await response.arrayBuffer()).subarray(0, 8).toString(), /^%PDF-/);
      queueMicrotask(() => listener({ id, state: { current: "complete" } }));
      return [{ state: "in_progress" }];
    },
  };
  assert.equal(await saveInvoicePdf(invoice, downloads), true);
  assert.equal(listener, null);
  await assert.rejects(fetch(blobUrl));
});

test("Annullare il selettore rilascia il PDF in memoria", async () => {
  let blobUrl;
  const downloads = {
    async download({ url }) {
      blobUrl = url;
      throw new Error("Download canceled by the user");
    },
  };
  assert.equal(await saveInvoicePdf(invoice, downloads), false);
  await assert.rejects(fetch(blobUrl));
});
