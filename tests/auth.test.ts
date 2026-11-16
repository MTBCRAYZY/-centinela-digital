import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loginSchema, signupSchema } from "../lib/auth";

test("acceso acepta clientes anteriores que envían el nombre vacío y lo descarta", () => {
  const password = randomBytes(20).toString("base64url");
  const credentials = loginSchema.parse({
    email: " Persona@EXAMPLE.test ",
    password,
    name: "",
  });
  assert.equal(credentials.email, "persona@example.test");
  assert.equal("name" in credentials, false);
});
test("acceso permite contraseñas existentes sin aplicar la política de registro", () => {
  assert.equal(
    loginSchema.safeParse({ email: "test@example.test", password: "existing" })
      .success,
    true,
  );
  assert.equal(
    loginSchema.safeParse({ email: "test@example.test", password: "" }).success,
    false,
  );
});
test("registro conserva los requisitos de nombre y contraseña fuerte", () => {
  const password = randomBytes(20).toString("base64url");
  assert.equal(
    signupSchema.safeParse({ email: "test@example.test", password, name: "" })
      .success,
    false,
  );
  assert.equal(
    signupSchema.safeParse({
      email: "test@example.test",
      password: "short",
      name: "Persona",
    }).success,
    false,
  );
  assert.equal(
    signupSchema.safeParse({
      email: "test@example.test",
      password,
      name: "Persona",
    }).success,
    true,
  );
});
