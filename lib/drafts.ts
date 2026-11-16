// Explicit, password-protected exports. No sensitive localStorage or automatic persistence.
const encode = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
const decode = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function key(password: string, salt: Uint8Array, usage: KeyUsage[]) {
  const source = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: BufferSourceCopy(salt),
      iterations: 310000,
      hash: "SHA-256",
    },
    source,
    { name: "AES-GCM", length: 256 },
    false,
    usage,
  );
}
function BufferSourceCopy(bytes: Uint8Array) {
  return new Uint8Array(bytes).buffer;
}
export async function encryptDraft(value: unknown, password: string) {
  if (password.length < 12)
    throw new Error(
      "Usa una contraseña de al menos 12 caracteres para el borrador.",
    );
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(password, salt, ["encrypt"]),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return JSON.stringify({
    format: "centinela-draft-v1",
    salt: encode(salt),
    iv: encode(iv),
    data: encode(new Uint8Array(cipher)),
  });
}
export async function decryptDraft(text: string, password: string) {
  try {
    const v = JSON.parse(text);
    if (v.format !== "centinela-draft-v1" || text.length > 50000)
      throw new Error();
    const value = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: BufferSourceCopy(decode(v.iv)) },
      await key(password, decode(v.salt), ["decrypt"]),
      BufferSourceCopy(decode(v.data)),
    );
    return JSON.parse(new TextDecoder().decode(value));
  } catch {
    throw new Error(
      "No se pudo abrir el borrador. Revisa el archivo y la contraseña.",
    );
  }
}
