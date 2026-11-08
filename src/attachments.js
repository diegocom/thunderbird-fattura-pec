import PostalMime from "postal-mime";
import { extractSignedContent } from "./cms.js";
import { parseInvoice } from "./invoice.js";

const DOCUMENT_LIMIT = 25 * 1024 * 1024;
const EML_LIMIT = 40 * 1024 * 1024;
const MAX_EML_DEPTH = 3;

function kindOf(attachment) {
  const name = attachment.name?.trim().toLowerCase() ?? "";
  const type = attachment.contentType?.split(";")[0].trim().toLowerCase();
  if (name === "postacert.eml") return "eml";
  if (name.endsWith(".p7m")) return "cms";
  if (name.endsWith(".xml") || type === "application/xml" || type === "text/xml") return "xml";
  if (type === "application/pkcs7-mime" || type === "application/x-pkcs7-mime") return "cms";
}

function listNative(messages, messageId) {
  return messages.listAttachments(messageId).then((attachments) => attachments.map((attachment) => ({
    ...attachment,
    async read(limit) {
      const file = await messages.getAttachmentFile(messageId, attachment.partName);
      if (file.size > limit) throw new Error("Allegato troppo grande.");
      return new Uint8Array(await file.arrayBuffer());
    },
  })));
}

async function listEml(attachment) {
  const bytes = await attachment.read(EML_LIMIT);
  const message = await PostalMime.parse(bytes, {
    forceRfc822Attachments: true,
    maxNestingDepth: 30,
    maxPartCount: 1000,
  });
  if (!message.headers.length) throw new Error("Messaggio EML illeggibile.");
  return message.attachments.map((part) => ({
    name: part.filename,
    contentType: part.mimeType,
    size: part.content.byteLength,
    type: "normal",
    async read() {
      return new Uint8Array(part.content);
    },
  }));
}

export async function findInvoices(messages, messageId) {
  const invoices = [];
  const unreadable = [];

  async function scan(attachments, depth) {
    for (const attachment of attachments) {
      const kind = kindOf(attachment);
      if (!kind) continue;
      const filename = attachment.name || "Allegato senza nome";
      try {
        if (attachment.type !== "normal") throw new Error("Allegato non incluso nel messaggio.");
        if (kind === "eml") {
          if (depth >= MAX_EML_DEPTH || attachment.size > EML_LIMIT) {
            throw new Error("Messaggio EML oltre i limiti di lettura.");
          }
          // A true message/rfc822 can have its own Thunderbird message ID.
          // An .eml sent as a file, or a failed native listing, uses the MIME parser.
          const nested = Number.isInteger(attachment.message?.id)
            ? await listNative(messages, attachment.message.id).catch(() => null)
            : null;
          await scan(nested ?? await listEml(attachment), depth + 1);
        } else {
          if (attachment.size > DOCUMENT_LIMIT) throw new Error("Allegato troppo grande.");
          const bytes = await attachment.read(DOCUMENT_LIMIT);
          const xml = kind === "cms" ? extractSignedContent(bytes) : bytes;
          for (const invoice of parseInvoice(xml)) invoices.push({ ...invoice, filename });
        }
      } catch {
        unreadable.push(filename);
      }
    }
  }

  await scan(await listNative(messages, messageId), 0);
  return { invoices, unreadable };
}
