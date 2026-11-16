import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
const origin = "http://localhost:3000";
test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/session");
  expect(response.ok()).toBe(true);
  expect(
    (await response.json()).demo,
    "Never run mutation tests against real reports",
  ).toBe(true);
});
const input = {
  reporter: "student",
  categories: ["Digital"],
  description:
    "Situación completamente ficticia para comprobar el seguimiento de un reporte escolar.",
  location: "Municipio de ejemplo",
  occurred_at: "",
  recurring: true,
  witnesses: false,
  school: "Escuela ficticia",
  anonymous: true,
  name: "",
  email: "",
  phone: "",
  contact_consent: false,
  notification_consent: false,
  privacy_consent: true,
  demo_ack: true,
};
async function post(api: APIRequestContext, url: string, data: unknown) {
  return api.post(`/api/${url}`, { data, headers: { Origin: origin } });
}

test("acceso desde el formulario no exige nombre y admite el cliente anterior", async ({
  page,
  request,
}) => {
  const email = `login-${randomBytes(6).toString("hex")}@example.test`;
  const password = randomBytes(24).toString("base64url");
  expect(
    (
      await post(request, "auth/signup", {
        email,
        password,
        name: "Persona ficticia",
      })
    ).ok(),
  ).toBeTruthy();
  await post(request, "auth/logout", {});
  expect(
    (await post(request, "auth/login", { email, password, name: "" })).status(),
  ).toBe(200);
  await post(request, "auth/logout", {});
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const login = await response;
  expect(login.status()).toBe(200);
  expect(Object.hasOwn(login.request().postDataJSON(), "name")).toBe(false);
  await expect(
    page.getByRole("heading", { name: "Hola, Persona ficticia." }),
  ).toBeVisible();
});
test("flujo escolar completo en navegador, con consulta privada", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/reportar?context=student");
  await expect(page.getByRole("button", { name: "En mi escuela" })).toHaveClass(
    /selected/,
  );
  await page.getByLabel("Digital", { exact: true }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Descripción de la situación").fill(input.description);
  await page.getByLabel("Escuela o contexto escolar").fill("Escuela ficticia");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("button", { name: /Reporte anónimo/ }),
  ).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("checkbox", { name: /He leído/ }).check();
  await page.getByRole("checkbox", { name: /Confirmo/ }).check();
  await page.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(
    page.getByRole("heading", { name: "Gracias por dar este paso." }),
  ).toBeVisible();
  const folio = await page.locator(".receipt strong").innerText(),
    key = await page.locator(".receipt code").innerText();
  await page
    .getByRole("link", { name: "Consultar seguimiento", exact: true })
    .click();
  await page.getByLabel("Folio", { exact: true }).fill(folio);
  await page.getByLabel("Clave privada", { exact: true }).fill(key);
  await page.getByRole("button", { name: "Consultar mi reporte" }).click();
  await expect(page.getByRole("heading", { name: folio })).toBeVisible();
  await expect(
    page.getByText(input.description, { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("permisos: clave, casos ajenos, notas internas, evidencias y seguimiento", async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({ baseURL: origin }),
    stranger = await playwright.request.newContext({ baseURL: origin }),
    admin = await playwright.request.newContext({ baseURL: origin });
  const created = await post(owner, "reports", input);
  expect(created.ok()).toBeTruthy();
  const r = await created.json();
  const received = await (await owner.get(`/api/reports/${r.id}`)).json();
  expect(received.report.first_reviewed_at).toBeNull();
  expect(received.report.feedback).toBeNull();
  expect(received.report.evidence_enabled).toBe(true);
  expect((await stranger.get(`/api/reports/${r.id}`)).status()).toBe(403);
  expect(
    (
      await post(stranger, "track", {
        folio: r.folio,
        key: "incorrecta-muy-larga",
      })
    ).status(),
  ).toBe(404);
  expect((await stranger.get("/api/admin")).status()).toBe(401);
  await post(stranger, "auth/demo", { role: "user" });
  expect((await stranger.get("/api/admin")).status()).toBe(403);
  expect(
    (
      await post(owner, `reports/${r.id}/updates`, {
        body: "Intento ficticio de cambiar estado.",
        status: "Cerrado",
      })
    ).status(),
  ).toBe(403);
  await post(admin, "auth/demo", { role: "admin" });
  expect((await admin.get("/api/admin")).ok()).toBeTruthy();
  expect(
    (await (await owner.get(`/api/reports/${r.id}`)).json()).report
      .first_reviewed_at,
  ).toBeNull();
  const opened = await (await admin.get(`/api/reports/${r.id}`)).json();
  expect(Number.isNaN(Date.parse(opened.report.first_reviewed_at))).toBe(false);
  const reopened = await (await admin.get(`/api/reports/${r.id}`)).json();
  expect(reopened.report.first_reviewed_at).toBe(
    opened.report.first_reviewed_at,
  );
  expect(
    (
      await post(admin, `reports/${r.id}/updates`, {
        body: "Nota interna ficticia, solo para el equipo.",
        internal: true,
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await post(admin, `reports/${r.id}/updates`, {
        body: "Actualización pública de prueba.",
        status: "En atención",
      })
    ).ok(),
  ).toBeTruthy();
  const own = await (await owner.get(`/api/reports/${r.id}`)).json();
  expect(own.report.status).toBe("En atención");
  expect(own.report.token_hash).toBeUndefined();
  expect(
    own.report.updates.some((u: { body: string }) =>
      u.body.includes("Nota interna"),
    ),
  ).toBe(false);
  const staffView = await (await admin.get(`/api/reports/${r.id}`)).json();
  expect(
    staffView.report.updates.some(
      (u: { kind: string }) => u.kind === "internal",
    ),
  ).toBe(true);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5l8AAAAASUVORK5CYII=",
    "base64",
  );
  const upload = await owner.post(`/api/reports/${r.id}/evidence`, {
    headers: { Origin: origin },
    multipart: {
      file: { name: "prueba.png", mimeType: "image/png", buffer: png },
    },
  });
  expect(upload.ok()).toBeTruthy();
  const detail = await (await owner.get(`/api/reports/${r.id}`)).json();
  const e = detail.report.evidence[0];
  expect(e.path).toBeUndefined();
  expect(
    (await stranger.get(`/api/reports/${r.id}/evidence/${e.id}`)).status(),
  ).toBe(403);
  expect(
    (await owner.get(`/api/reports/${r.id}/evidence/${e.id}`)).ok(),
  ).toBeTruthy();
  const spoof = await owner.post(`/api/reports/${r.id}/evidence`, {
    headers: { Origin: origin },
    multipart: {
      file: {
        name: "spoof.png",
        mimeType: "image/png",
        buffer: Buffer.from("not-an-image"),
      },
    },
  });
  expect(spoof.status()).toBe(400);
  const oversized = await owner.post(`/api/reports/${r.id}/evidence`, {
    headers: { Origin: origin },
    multipart: {
      file: {
        name: "grande.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(4 * 1024 * 1024 + 1),
      },
    },
  });
  expect(oversized.status()).toBe(400);
  await post(admin, `reports/${r.id}/updates`, {
    body: "Cierre ficticio del ejercicio.",
    status: "Cerrado",
  });
  expect(
    (
      await post(admin, `reports/${r.id}/feedback`, { rating: 5, comment: "" })
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(owner, `reports/${r.id}/feedback`, {
        rating: 5,
        comment: "Prueba ficticia.",
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await post(owner, `reports/${r.id}/feedback`, { rating: 5, comment: "" })
    ).status(),
  ).toBe(409);
  const evaluated = await (await owner.get(`/api/reports/${r.id}`)).json();
  expect(evaluated.report.feedback.rating).toBe(5);
  expect(evaluated.report.feedback.comment).toBe("Prueba ficticia.");
  expect(evaluated.report.feedback.report_id).toBeUndefined();
  expect(
    (await (await admin.get(`/api/reports/${r.id}`)).json()).report.feedback,
  ).toEqual(evaluated.report.feedback);
  await post(owner, "auth/logout", {});
  expect((await owner.get(`/api/reports/${r.id}`)).status()).toBe(403);
  await owner.dispose();
  await stranger.dispose();
  await admin.dispose();
});
test("cuentas y acceso de atención limitado a asignaciones", async ({
  playwright,
}) => {
  const account = await playwright.request.newContext({ baseURL: origin }),
    staff = await playwright.request.newContext({ baseURL: origin }),
    admin = await playwright.request.newContext({ baseURL: origin });
  const email = `prueba-${randomBytes(5).toString("hex")}@example.test`,
    password = randomBytes(24).toString("base64url");
  expect(
    (
      await post(account, "auth/signup", {
        email,
        password,
        name: "Persona ficticia",
      })
    ).ok(),
  ).toBeTruthy();
  const a = await (
    await post(account, "reports", {
      ...input,
      anonymous: false,
      name: "Alias ficticio",
    })
  ).json();
  const b = await (await post(account, "reports", input)).json();
  const mine = await (await account.get("/api/reports")).json();
  expect(mine.reports.map((r: { id: string }) => r.id)).toEqual([a.id]);
  const staffEmail = `atencion-${randomBytes(5).toString("hex")}@example.test`;
  await post(staff, "auth/signup", {
    email: staffEmail,
    password,
    name: "Atención ficticia",
  });
  await post(admin, "auth/demo", { role: "admin" });
  expect(
    (
      await post(admin, "auth/login", {
        email: staffEmail,
        password: "incorrecta-muy-larga",
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await admin.patch("/api/team", {
        headers: { Origin: origin },
        data: { email: staffEmail, role: "staff" },
      })
    ).ok(),
  ).toBeTruthy();
  expect((await staff.get(`/api/reports/${a.id}`)).status()).toBe(403);
  const current = await (await staff.get("/api/session")).json();
  await post(admin, `reports/${a.id}/updates`, {
    body: "Asignación ficticia de caso.",
    assignee_id: current.user.id,
  });
  expect((await staff.get(`/api/reports/${a.id}`)).ok()).toBeTruthy();
  expect((await staff.get(`/api/reports/${b.id}`)).status()).toBe(403);
  const list = await (await staff.get("/api/admin")).json();
  expect(list.reports.map((r: { id: string }) => r.id)).toEqual([a.id]);
  expect(
    (
      await staff.patch("/api/team", {
        headers: { Origin: origin },
        data: { email, role: "staff" },
      })
    ).status(),
  ).toBe(403);
  await account.dispose();
  await staff.dispose();
  await admin.dispose();
});
test("la persona ve la apertura del equipo y su evaluación después de volver a consultar", async ({
  page,
  playwright,
}) => {
  const report = await (await post(page.request, "reports", input)).json();
  const admin = await playwright.request.newContext({ baseURL: origin });
  try {
    await page.goto("/seguimiento");
    async function consult() {
      await page.getByLabel("Folio", { exact: true }).fill(report.folio);
      await page.getByLabel("Clave privada", { exact: true }).fill(report.key);
      await page.getByRole("button", { name: "Consultar mi reporte" }).click();
    }
    await consult();
    await expect(
      page.getByText(/El equipo todavía no lo ha abierto/),
    ).toBeVisible();
    await post(admin, "auth/demo", { role: "admin" });
    expect((await admin.get(`/api/reports/${report.id}`)).ok()).toBe(true);
    await page.getByRole("button", { name: "Actualizar seguimiento" }).click();
    await expect(
      page.getByText(/El equipo abrió tu reporte por primera vez/),
    ).toBeVisible();
    expect(
      (
        await post(admin, `reports/${report.id}/updates`, {
          body: "Cierre de un caso ficticio para verificar la evaluación.",
          status: "Cerrado",
        })
      ).ok(),
    ).toBe(true);
    await page.getByRole("button", { name: "Actualizar seguimiento" }).click();
    await page
      .getByLabel("Comentario opcional")
      .fill("Evaluación ficticia desde el navegador.");
    await page.getByRole("button", { name: "Enviar evaluación" }).click();
    await expect(
      page.getByRole("heading", { name: "Tu evaluación fue registrada" }),
    ).toBeVisible();
    await page.reload();
    await consult();
    await expect(
      page.getByText("Evaluación ficticia desde el navegador.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar evaluación" }),
    ).toHaveCount(0);
  } finally {
    await admin.dispose();
  }
});
test("valida consentimiento, tamaño y origen; no admite identidad en modo anónimo", async ({
  request,
}) => {
  expect(
    (
      await post(request, "reports", { ...input, name: "Persona ficticia" })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(request, "reports", { ...input, privacy_consent: false })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(request, "reports", {
        ...input,
        description: "x".repeat(26000),
      })
    ).status(),
  ).toBe(413);
  expect(
    (
      await request.post("/api/reports", {
        data: input,
        headers: { Origin: "https://otro.example" },
      })
    ).status(),
  ).toBe(403);
});
test("inicio y navegación móvil sin desbordamientos ni errores de JavaScript", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Tu voz importa/ }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/centinela-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/centinela-mobile.png", fullPage: true });
  for (const route of [
    "/",
    "/reportar",
    "/seguimiento",
    "/estudiantes",
    "/informacion",
    "/ayuda",
    "/ingresar",
    "/privacidad",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("acceso demo al panel, edición de recursos y notas desde la interfaz", async ({
  page,
}) => {
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrar como equipo" }).click();
  await page.getByRole("link", { name: "Ir a mi espacio" }).click();
  await expect(
    page.getByRole("heading", { name: "Cada reporte merece atención." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Recursos de ayuda", exact: true })
    .click();
  await page.getByRole("button", { name: "Agregar recurso" }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Recurso ficticio de pruebas");
  await page
    .getByLabel("Descripción", { exact: true })
    .fill("Un recurso ficticio sin datos reales, creado por la prueba.");
  await page.getByRole("button", { name: "Guardar recurso" }).click();
  await expect(
    page.getByText("Recurso guardado.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reportes", exact: true }).click();
  await page
    .getByRole("button", { name: "Abrir", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Atención del reporte." }),
  ).toBeVisible();
  await page
    .getByLabel("Mensaje o nota", { exact: true })
    .fill("Nota interna de prueba desde la interfaz.");
  await page.getByRole("checkbox", { name: /Nota interna/ }).check();
  await page.getByRole("button", { name: "Guardar nota interna" }).click();
  await expect(
    page.getByText("Nota interna guardada.", { exact: true }),
  ).toBeVisible();
});
