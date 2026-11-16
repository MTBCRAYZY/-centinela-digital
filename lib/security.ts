import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const newKey = () => randomBytes(32).toString("base64url");
export function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}
export function verifyPassword(value: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const a = Buffer.from(key, "hex"),
    b = scryptSync(value, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function sign(value: object, secret: string) {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function unsign<T>(token: string | undefined, secret: string): T | null {
  try {
    if (!token) return null;
    const [body, sig] = token.split(".");
    const expected = createHmac("sha256", secret).update(body).digest();
    const received = Buffer.from(sig, "base64url");
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      return null;
    const value = JSON.parse(Buffer.from(body, "base64url").toString());
    if (value.exp < Date.now() || typeof value.exp !== "number") return null;
    return value as T;
  } catch {
    return null;
  }
}
export function fileMime(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}
export function cleanFilename(s: string) {
  return s.replace(/[^\p{L}\p{N} ._-]/gu, "_").slice(0, 100) || "evidencia";
}
