import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  digest,
  newKey,
  hashPassword,
  verifyPassword,
  sign,
  unsign,
  fileMime,
} from "../lib/security";
import { encryptDraft, decryptDraft } from "../lib/drafts";
import { safeBackendError, recoveryFailure } from "../lib/diagnostics";

test("recuperación distingue cuotas y cooldown de fallas del servicio sin exponer mensajes", () => {
  const marker = randomBytes(24).toString("hex");
  const quota = recoveryFailure({
    code: "over_email_send_rate_limit",
    status: 429,
    message: marker,
  });
  assert.equal(quota.status, 429);
  assert.match(quota.message, /límite temporal/);
  assert.equal(quota.message.includes(marker), false);
  const cooldown = recoveryFailure({
    status: 429,
    message: `For security purposes, request this after 47 seconds. ${marker}`,
  });
  assert.equal(cooldown.status, 429);
  assert.match(cooldown.message, /47 segundos/);
  assert.equal(cooldown.message.includes(marker), false);
  const unavailable = recoveryFailure({
    status: 500,
    code: "unexpected_failure",
    message: marker,
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.message.includes(marker), false);
});

test("diagnóstico conserva códigos pero nunca incluye credenciales ni datos personales", () => {
  const privateValue = randomBytes(32).toString("base64url");
  const diagnostic = safeBackendError({
    code: "PGRST202",
    message: `Schema cache failure: ${privateValue}`,
    details: `private-contact-${privateValue}`,
  });
  assert.equal(diagnostic.code, "PGRST202");
  assert.equal(diagnostic.category, "missing_schema");
  assert.equal(JSON.stringify(diagnostic).includes(privateValue), false);
  assert.equal(
    safeBackendError({ code: `secret ${privateValue}` }).code,
    "unknown",
  );
});
test("contraseñas y sesiones no admiten claves equivocadas, modificaciones o caducidad", () => {
  const password = newKey(),
    secret = newKey(),
    stored = hashPassword(password);
  assert.notEqual(stored, password);
  assert.equal(verifyPassword(password, stored), true);
  assert.equal(verifyPassword(newKey(), stored), false);
  const token = sign({ id: "test", exp: Date.now() + 60000 }, secret);
  assert.equal(unsign<{ id: string }>(token, secret)?.id, "test");
  assert.equal(unsign(token + "x", secret), null);
  assert.equal(unsign(sign({ id: "test", exp: 0 }, secret), secret), null);
  assert.notEqual(digest(newKey()), digest(newKey()));
  assert.equal(fileMime(Buffer.from("invalid")), null);
});
test("borradores cifrados se recuperan solo con la contraseña correcta", async () => {
  const password = randomBytes(24).toString("base64url");
  const original = {
    description: "Datos ficticios del borrador",
    anonymous: true,
  };
  const encrypted = await encryptDraft(original, password);
  assert.equal(encrypted.includes(original.description), false);
  assert.deepEqual(await decryptDraft(encrypted, password), original);
  await assert.rejects(() => decryptDraft(encrypted, newKey()));
});
