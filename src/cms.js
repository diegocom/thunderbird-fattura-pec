import { Constructed, Integer, ObjectIdentifier, OctetString, Sequence, Set, fromBER } from "asn1js";

const SIGNED_DATA = "1.2.840.113549.1.7.2";
const DATA = "1.2.840.113549.1.7.1";

function explicitContent(node) {
  if (node instanceof Constructed && node.idBlock.tagClass === 3 &&
      node.idBlock.tagNumber === 0 && node.valueBlock.value.length === 1) {
    return node.valueBlock.value[0];
  }
}

function hasOid(node, oid) {
  return node instanceof ObjectIdentifier && node.valueBlock.toString() === oid;
}

function octetChunks(node) {
  if (node.idBlock.isConstructed) {
    return node.valueBlock.value.flatMap(octetChunks);
  }
  return [node.valueBlock.valueHexView];
}

export function extractSignedContent(bytes) {
  if (bytes[0] === 45) {
    const pem = new TextDecoder().decode(bytes);
    const match = /^\s*-----BEGIN (CMS|PKCS7)-----\s+([A-Za-z0-9+/=\s]+?)-----END \1-----\s*$/.exec(pem);
    if (!match) throw new Error("Busta P7M illeggibile.");
    bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  }
  const { offset, result } = fromBER(bytes, { maxDepth: 48, maxNodes: 30_000, maxContentLength: bytes.length });
  if (offset !== bytes.byteLength || !(result instanceof Sequence)) {
    throw new Error("Busta P7M illeggibile.");
  }
  // RFC 5652, sections 3 and 5.1. Read only the encapsulated bytes.
  const [contentType, wrapper] = result.valueBlock.value;
  const signedData = explicitContent(wrapper);
  if (result.valueBlock.value.length !== 2 || !hasOid(contentType, SIGNED_DATA) ||
      !(signedData instanceof Sequence)) {
    throw new Error("La busta P7M non contiene un documento CMS SignedData.");
  }
  const fields = signedData.valueBlock.value;
  const [version, digests, encapsulated] = fields;
  if (!(version instanceof Integer) || !(digests instanceof Set) ||
      !(encapsulated instanceof Sequence) || !(fields.at(-1) instanceof Set)) {
    throw new Error("Busta P7M illeggibile.");
  }
  const [embeddedType, embeddedWrapper] = encapsulated.valueBlock.value;
  const octets = explicitContent(embeddedWrapper);
  if (encapsulated.valueBlock.value.length !== 2 || !hasOid(embeddedType, DATA) || !(octets instanceof OctetString)) {
    throw new Error("La busta P7M non contiene un documento incorporato.");
  }
  const chunks = octetChunks(octets);
  const content = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    content.set(chunk, position);
    position += chunk.length;
  }
  return content;
}
