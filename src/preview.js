import { findInvoices } from "./attachments.js";
import { showResult } from "./render.js";

const errorMessages = {
  expired: "Anteprima scaduta. Torna al messaggio e fai di nuovo clic su «Visualizza fattura».",
  selection: "Seleziona un solo messaggio, poi fai clic su «Visualizza fattura».",
  message: "Impossibile leggere il messaggio o i suoi allegati.",
};

try {
  const token = location.hash.slice(1);
  const selection = token && await messenger.runtime.sendMessage({ type: "readSelection", token });
  if (Number.isInteger(selection?.messageId)) {
    showResult(await findInvoices(messenger.messages, selection.messageId));
  } else {
    document.getElementById("status").textContent = errorMessages[selection?.error ?? "expired"];
  }
} catch {
  document.getElementById("status").textContent = errorMessages.message;
}
