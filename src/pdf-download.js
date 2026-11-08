function suggestedFilename(invoice) {
  const stem = `${invoice.date}-${invoice.number}`.normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]+/g, "-")
    .replace(/\s+/g, "-").slice(0, 120).replace(/[-.]+$/, "");
  return `fattura-${stem}.pdf`;
}

function waitForDownload(downloads, id) {
  return new Promise((resolve, reject) => {
    let finished = false;
    function finish(state, error) {
      if (finished || (state !== "complete" && state !== "interrupted")) return;
      finished = true;
      downloads.onChanged.removeListener(onChanged);
      if (state === "complete") resolve();
      else reject(new Error(error || "Scrittura del PDF interrotta."));
    }
    function onChanged(change) {
      if (change.id === id) finish(change.state?.current, change.error?.current);
    }
    downloads.onChanged.addListener(onChanged);
    // A small file may finish before the listener is registered.
    downloads.search({ id }).then(([item]) => {
      finish(item?.state ?? "interrupted", item?.error);
    }, () => finish("interrupted"));
  });
}

export async function saveInvoicePdf(invoice, downloads) {
  // The build emits pdf.js as a separate local module, loaded only on export.
  const moduleUrl = new URL("./pdf.js", import.meta.url);
  const { createInvoicePdf } = await import(moduleUrl.href);
  const url = URL.createObjectURL(await createInvoicePdf(invoice));
  try {
    const id = await downloads.download({ url, filename: suggestedFilename(invoice), saveAs: true });
    await waitForDownload(downloads, id);
    return true;
  } catch (error) {
    if (error.message === "Download canceled by the user" || error.message === "USER_CANCELED") return false;
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
