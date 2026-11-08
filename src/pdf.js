import pdfMake from "pdfmake/build/pdfmake.js";
import fonts from "pdfmake/build/vfs_fonts.js";
import { invoiceDetails, LINE_HEADINGS, partyDetails, PREVIEW_NOTE, VAT_HEADINGS } from "./invoice-view.js";

pdfMake.addVirtualFileSystem(fonts);
pdfMake.setUrlAccessPolicy(() => false);

function party(label, party) {
  return {
    width: "*",
    stack: [{ text: label, bold: true, margin: [0, 0, 0, 3] }, ...partyDetails(party)],
  };
}

function table(title, headings, widths, rows, empty) {
  return [
    { text: title, style: "heading", headlineLevel: 1 },
    rows.length ? {
      layout: "lightHorizontalLines",
      fontSize: 9,
      table: {
        widths,
        headerRows: 1,
        keepWithHeaderRows: 1,
        dontBreakRows: true,
        body: [
          headings.map((text) => ({ text, bold: true })),
          ...rows.map((row) => row.map((text) => text || "—")),
        ],
      },
    } : { text: empty },
  ];
}

export function createInvoicePdf(invoice) {
  const { title, subtitle, lines, vat, total } = invoiceDetails(invoice);
  return pdfMake.createPdf({
    info: { title, creator: "Fattura PEC" },
    pageSize: "A4",
    pageMargins: [40, 42, 40, 42],
    defaultStyle: { fontSize: 10, color: "#192129", lineHeight: 1.15 },
    styles: {
      heading: { bold: true, fontSize: 11, margin: [0, 14, 0, 5] },
      note: { fontSize: 8.5, color: "#495560" },
    },
    footer: (page, count) => ({
      text: `Pagina ${page} di ${count}`,
      style: "note",
      alignment: "right",
      margin: [40, 12, 40, 0],
    }),
    content: [
      { text: "FATTURA PEC", fontSize: 9, bold: true, color: "#146455", margin: [0, 0, 0, 8] },
      { text: title, fontSize: 20, bold: true, margin: [0, 0, 0, 5] },
      { text: subtitle, margin: [0, 0, 0, 4] },
      { text: invoice.filename, style: "note" },
      {
        columns: [party("Fornitore", invoice.supplier), party("Cliente", invoice.customer)],
        columnGap: 20,
        margin: [0, 14, 0, 0],
      },
      ...table("Righe", LINE_HEADINGS, ["6%", "36%", "11%", "14%", "13%", "10%", "10%"],
        lines, "Nessuna riga disponibile."),
      ...table("Riepilogo IVA", VAT_HEADINGS, ["25%", "25%", "25%", "25%"], vat, "Riepilogo IVA assente."),
      ...(total ? [{ text: total, bold: true, fontSize: 12, margin: [0, 12, 0, 0] }] : []),
      { text: PREVIEW_NOTE, style: "note", margin: [0, 10, 0, 0] },
    ],
    pageBreakBefore(node, context) {
      return node.headlineLevel === 1 && context.getFollowingNodesOnPage().length === 0;
    },
  }).getBlob();
}
