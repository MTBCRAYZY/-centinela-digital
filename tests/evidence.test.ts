import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { prepareEvidence, EvidenceError } from "../lib/evidence";

test("las imágenes se reconstruyen sin EXIF ni contenido añadido", async () => {
  const original = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "blue" },
  })
    .jpeg()
    .withMetadata({
      exif: { IFD0: { Artist: "Dato ficticio que no debe conservarse" } },
    })
    .toBuffer();
  const marker = Buffer.from("<script>contenido añadido de prueba</script>");
  const result = await prepareEvidence(
    Buffer.concat([original, marker]),
    "image/jpeg",
    "archivo.pdf",
  );
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(result.filename, "archivo.jpg");
  assert.equal(result.mime, "image/jpeg");
  assert.equal(metadata.width, 8);
  assert.equal(metadata.exif, undefined);
  assert.equal(result.bytes.includes(marker), false);
});

test("no basta con falsificar el encabezado de una imagen", async () => {
  const invalid = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from("contenido inválido"),
  ]);
  await assert.rejects(
    () => prepareEvidence(invalid, "image/png", "prueba.png"),
    (error: unknown) => error instanceof EvidenceError && error.status === 400,
  );
});

test("los PDF siguen bloqueados si no hay análisis de seguridad", async () => {
  await assert.rejects(
    () =>
      prepareEvidence(
        Buffer.from("%PDF-1.7\nPrueba"),
        "application/pdf",
        "prueba.pdf",
      ),
    (error: unknown) => error instanceof EvidenceError && error.status === 400,
  );
});

test("si existe un analizador, su rechazo o indisponibilidad no se omiten", async (t) => {
  const image = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  const mocked = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ clean: false })),
  );
  await assert.rejects(
    () =>
      prepareEvidence(
        image,
        "image/png",
        "prueba.png",
        "https://scanner.example.invalid",
      ),
    (error: unknown) => error instanceof EvidenceError && error.status === 400,
  );
  mocked.mock.mockImplementation(async () => {
    throw new Error("Fallo ficticio");
  });
  await assert.rejects(
    () =>
      prepareEvidence(
        image,
        "image/png",
        "prueba.png",
        "https://scanner.example.invalid",
      ),
    (error: unknown) => error instanceof EvidenceError && error.status === 503,
  );
});
