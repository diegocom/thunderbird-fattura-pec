const displayDate = (date) => date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
const decimal = (amount) => amount.replace(/^(-?\d+)\.(\d+)$/, "$1,$2");
const rate = (amount) => amount ? `${decimal(amount)}%` : "";

export const LINE_HEADINGS = ["N.", "Descrizione", "Quantità", "Prezzo unitario", "Importo", "IVA", "Natura"];
export const VAT_HEADINGS = ["Aliquota", "Natura", "Imponibile", "Imposta"];
export const PREVIEW_NOTE = "Anteprima per consultazione. Firma digitale non verificata.";

export { displayDate };

export function partyDetails(data) {
  return [
    data.name || "Denominazione non indicata",
    data.vatId && `Partita IVA ${data.vatId}`,
    data.fiscalCode && `Codice fiscale ${data.fiscalCode}`,
  ].filter(Boolean);
}

export function invoiceDetails(invoice) {
  const total = [decimal(invoice.total), invoice.currency].filter(Boolean).join(" ");
  return {
    title: `Documento n. ${invoice.number}`,
    subtitle: [displayDate(invoice.date), invoice.documentType, invoice.currency].filter(Boolean).join(" · "),
    lines: invoice.lines.map((line) => [
      line.number, line.description, decimal(line.quantity), decimal(line.unitPrice), decimal(line.amount),
      rate(line.rate), line.nature,
    ]),
    vat: invoice.vat.map((row) => [rate(row.rate), row.nature, decimal(row.taxable), decimal(row.tax)]),
    total: invoice.total ? `Totale documento ${total}` : "",
  };
}
