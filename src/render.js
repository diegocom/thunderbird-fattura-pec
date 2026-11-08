import { displayDate, invoiceDetails, LINE_HEADINGS, partyDetails, PREVIEW_NOTE, VAT_HEADINGS } from "./invoice-view.js";
import { saveInvoicePdf } from "./pdf-download.js";

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function party(title, data) {
  const section = element("section");
  section.append(element("h3", title), ...partyDetails(data).map((text) => element("p", text)));
  return section;
}

function tableSection(title, headings, rows, empty) {
  const section = element("section");
  const label = element("h3", title);
  section.append(label);
  if (!rows.length) {
    section.append(element("p", empty));
    return section;
  }
  label.id = title === "Righe" ? "lines-title" : "vat-title";
  const scroll = element("div", undefined, "table-scroll");
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-labelledby", label.id);
  const table = element("table");
  table.setAttribute("aria-labelledby", label.id);
  const header = table.createTHead().insertRow();
  for (const heading of headings) {
    const th = element("th", heading);
    th.scope = "col";
    header.append(th);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const text of values) row.append(element("td", text || "—"));
  }
  scroll.append(table);
  section.append(scroll);
  return section;
}

export function showResult({ invoices, unreadable }) {
  const status = document.getElementById("status");
  if (unreadable.length) {
    const list = document.getElementById("warning-list");
    for (const filename of new Set(unreadable)) list.append(element("li", filename));
    document.getElementById("warnings").hidden = false;
  }
  if (!invoices.length) {
    status.textContent = unreadable.length
      ? "Non è stato possibile leggere una fattura dagli allegati indicati."
      : "Nessuna fattura elettronica trovata in questo messaggio.";
    return;
  }
  status.hidden = true;
  const choices = document.getElementById("choices");
  const article = document.getElementById("invoice");

  function open(invoice, focusTitle) {
    const details = invoiceDetails(invoice);
    const title = element("h2", details.title);
    title.id = "invoice-title";
    title.tabIndex = -1;
    document.title = `Fattura ${invoice.number} - ${invoice.date}`;
    const parties = element("div", undefined, "parties");
    parties.append(party("Fornitore", invoice.supplier), party("Cliente", invoice.customer));
    article.replaceChildren(
      title, element("p", details.subtitle), element("p", invoice.filename, "source"), parties,
      tableSection("Righe", LINE_HEADINGS, details.lines, "Nessuna riga disponibile."),
      tableSection("Riepilogo IVA", VAT_HEADINGS, details.vat, "Riepilogo IVA assente."),
    );
    if (details.total) article.append(element("p", details.total, "total"));
    article.append(element("p", PREVIEW_NOTE, "note"));
    const actions = element("div", undefined, "invoice-actions");
    const save = element("button", "Salva PDF");
    save.type = "button";
    const exportStatus = element("p", "", "export-status");
    exportStatus.setAttribute("role", "status");
    save.addEventListener("click", async () => {
      const buttons = actions.querySelectorAll("button");
      for (const button of buttons) button.disabled = true;
      exportStatus.textContent = "Preparazione del PDF…";
      try {
        const saved = await saveInvoicePdf(invoice, messenger.downloads);
        exportStatus.textContent = saved ? "PDF salvato." : "Salvataggio annullato.";
      } catch {
        exportStatus.textContent = "Impossibile salvare il PDF.";
      } finally {
        for (const button of buttons) button.disabled = false;
      }
    });
    actions.append(save);
    if (invoices.length > 1) {
      const back = element("button", "Torna all’elenco");
      back.type = "button";
      back.addEventListener("click", () => {
        article.hidden = true;
        choices.hidden = false;
        document.title = "Fattura PEC";
        document.getElementById("choices-title").focus();
      });
      actions.prepend(back);
    }
    article.prepend(actions, exportStatus);
    choices.hidden = true;
    article.hidden = false;
    if (focusTitle) title.focus();
  }

  if (invoices.length === 1) {
    open(invoices[0], false);
    return;
  }
  const list = document.getElementById("invoice-list");
  for (const invoice of invoices) {
    const label = [`N. ${invoice.number}`, displayDate(invoice.date), invoice.supplier.name, invoice.filename];
    const button = element("button", label.filter(Boolean).join(" · "));
    button.type = "button";
    button.addEventListener("click", () => open(invoice, true));
    const item = element("li");
    item.append(button);
    list.append(item);
  }
  choices.hidden = false;
}
