import { test } from "node:test";
import assert from "node:assert/strict";
import { appOrigin } from "../lib/origin";

test("preview puede conservar un origen canónico entre despliegues", () => {
  assert.equal(
    appOrigin({
      VERCEL_ENV: "preview",
      VERCEL_URL: "new-build.vercel.app",
      APP_PREVIEW_ORIGIN: "https://centinela-preview.vercel.app/",
    }),
    "https://centinela-preview.vercel.app",
  );
  for (const APP_PREVIEW_ORIGIN of [
    "https://external.example",
    "https://user:password@preview.vercel.app",
    "https://preview.vercel.app/path",
  ]) {
    assert.equal(
      appOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "new-build.vercel.app",
        APP_PREVIEW_ORIGIN,
      }),
      "",
    );
  }
});

test("preview usa la dirección de ese despliegue para formularios y recuperación", () => {
  assert.equal(
    appOrigin({
      VERCEL_ENV: "preview",
      VERCEL_URL: "-centinela-example-team.vercel.app",
      APP_ORIGIN: "http://localhost:3000",
    }),
    "https://-centinela-example-team.vercel.app",
  );
});
test("preview rechaza hosts externos, rutas y credenciales en la dirección", () => {
  for (const VERCEL_URL of [
    "",
    "evil.example",
    "ok.vercel.app/path",
    "user@ok.vercel.app",
    "ok.vercel.app:443",
    "_bad.vercel.app",
  ]) {
    assert.equal(
      appOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL,
        APP_ORIGIN: "https://production.example",
      }),
      "",
    );
  }
});
test("producción conserva el dominio configurado y normaliza la barra final", () => {
  assert.equal(
    appOrigin({
      VERCEL_ENV: "production",
      VERCEL_URL: "preview.vercel.app",
      APP_ORIGIN: "https://centinela.example/",
    }),
    "https://centinela.example",
  );
});
test("el fallback local solo está permitido en desarrollo", () => {
  assert.equal(
    appOrigin({ NODE_ENV: "development" }, "http://localhost:3000"),
    "http://localhost:3000",
  );
  assert.equal(
    appOrigin({ NODE_ENV: "production" }, "http://localhost:3000"),
    "",
  );
});
test("configuración inválida no habilita solicitudes desde otro origen", () => {
  for (const APP_ORIGIN of [
    "javascript:alert(1)",
    "https://user:password@site.example",
    "https://site.example/path",
    "https://site.example?token=x",
    "http://site.example",
  ]) {
    assert.equal(appOrigin({ APP_ORIGIN }), "");
  }
});
