import sharp from "sharp";
import { fileMime, cleanFilename } from "./security";
import { MAX_EVIDENCE_BYTES } from "./report-policy";

export class EvidenceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function prepareEvidence(
  original: Buffer,
  declaredMime: string,
  originalName: string,
  scannerUrl?: string,
) {
  if (!original.length || original.length > MAX_EVIDENCE_BYTES)
    throw new EvidenceError(400, "Adjunta un archivo de hasta 4 MB.");
  const mime = fileMime(original);
  if (!mime || mime !== declaredMime)
    throw new EvidenceError(
      400,
      "El contenido no coincide con un PNG, JPG o PDF válido.",
    );
  if (mime === "application/pdf" && !scannerUrl)
    throw new EvidenceError(
      400,
      "Por ahora adjunta imágenes JPG o PNG. Los PDF todavía no están habilitados.",
    );

  if (scannerUrl) {
    try {
      const scan = await fetch(scannerUrl, {
        method: "POST",
        body: new Uint8Array(original),
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/octet-stream" },
      });
      if (!scan.ok || (await scan.json()).clean !== true)
        throw new EvidenceError(
          400,
          "No se pudo validar la seguridad del archivo.",
        );
    } catch (error) {
      if (error instanceof EvidenceError) throw error;
      throw new EvidenceError(
        503,
        "El análisis de archivos no está disponible. Intenta más tarde.",
      );
    }
  }

  let bytes = original;
  if (mime !== "application/pdf") {
    try {
      // Decode real pixels and create a fresh image. Do not copy EXIF, XMP,
      // location, extra frames or trailing payloads from the original file.
      const image = sharp(original, {
        limitInputPixels: 20_000_000,
        failOn: "warning",
      }).rotate();
      bytes =
        mime === "image/png"
          ? await image.png({ compressionLevel: 6 }).toBuffer()
          : await image.jpeg({ quality: 90 }).toBuffer();
    } catch {
      throw new EvidenceError(
        400,
        "No se pudo procesar la imagen. Usa un JPG o PNG válido de hasta 20 megapíxeles.",
      );
    }
  }
  if (bytes.length > MAX_EVIDENCE_BYTES)
    throw new EvidenceError(
      400,
      "La imagen procesada supera 4 MB. Reduce sus dimensiones antes de adjuntarla.",
    );
  const extension =
    mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "pdf";
  const stem =
    cleanFilename(originalName)
      .replace(/\.[^.]*$/, "")
      .slice(0, 90) || "evidencia";
  return { bytes, mime, filename: `${stem}.${extension}` };
}
