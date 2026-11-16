import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  all,
  insert,
  patch,
  remove,
  identity,
  authClient,
  setSession,
  demo,
  grantReport,
  reportGrant,
  audit,
  limit,
  dataDir,
  service,
  db,
  secret,
} from "@/lib/backend";
import {
  digest,
  newKey,
  hashPassword,
  verifyPassword,
  fileMime,
  cleanFilename,
} from "@/lib/security";
import { reportSchema, statuses, type Report } from "@/lib/domain";
import { appOrigin } from "@/lib/origin";
import { safeBackendError, recoveryFailure } from "@/lib/diagnostics";
import { loginSchema, signupSchema } from "@/lib/auth";
import {
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_FILES,
  MAX_UPLOAD_BYTES,
} from "@/lib/report-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(code: number, message: string): never {
  throw new HttpError(code, message);
}
const ok = (value: unknown) =>
  NextResponse.json(value, { headers: { "Cache-Control": "no-store" } });
async function bounded(req: NextRequest, max: number) {
  if (Number(req.headers.get("content-length") || 0) > max)
    fail(413, "La solicitud es demasiado grande.");
  const reader = req.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      fail(413, "La solicitud es demasiado grande.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function body(req: NextRequest) {
  const text = (await bounded(req, 25000)).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    fail(400, "Solicitud no válida.");
  }
}

async function user(staff = false) {
  const who = await identity();
  if (!who) fail(401, "Inicia sesión para continuar.");
  if (staff && !["staff", "admin"].includes(who.profile.role))
    fail(403, "No tienes permisos para acceder al equipo.");
  if (staff && !demo && who.aal !== "aal2")
    fail(403, "Verifica tu segundo factor para entrar al panel.");
  return who;
}
async function authorizedReport(id: string, staffOnly = false) {
  const r = (await all("reports", { id }))[0];
  if (!r) fail(404, "No se encontró el reporte.");
  const who = await identity();
  const isStaff =
    !!who &&
    ["staff", "admin"].includes(who.profile.role) &&
    (demo || who.aal === "aal2");
  if (staffOnly && !isStaff) fail(403, "Acceso restringido.");
  const assigned =
    isStaff &&
    (who!.profile.role === "admin" || r.assignee_id === who!.profile.id);
  if (
    !assigned &&
    !(who?.profile.id === r.owner_id && !staffOnly) &&
    !(!staffOnly && (await reportGrant()) === id)
  )
    fail(403, "No tienes acceso a este reporte.");
  return { r, who, staff: assigned };
}
async function publicReport(r: Report, staff: boolean) {
  const { token_hash: _, ...safe } = r;
  const updates = (await all("updates", { report_id: r.id }))
    .filter((u) => staff || u.kind !== "internal")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const evidence = (await all("evidence", { report_id: r.id })).map(
    ({ path: _, ...v }) => v,
  );
  const contact = staff
    ? (await all("contacts", { report_id: r.id }))[0]
    : undefined;
  const firstReviewedAt =
    (await all("audit", { report_id: r.id, action: "report.opened" }))
      .map((entry) => entry.created_at)
      .sort()[0] || null;
  const evaluation = (await all("feedback", { report_id: r.id }))[0];
  return {
    ...safe,
    updates,
    evidence,
    contact,
    first_reviewed_at: firstReviewedAt,
    evidence_enabled: demo || !!process.env.EVIDENCE_SCANNER_URL,
    feedback: evaluation
      ? {
          rating: evaluation.rating,
          comment: evaluation.comment,
          created_at: evaluation.created_at,
        }
      : null,
  };
}
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const parts = (await params).path;
    const route = parts.join("/");
    const method = req.method;
    if (method !== "GET") {
      const origin = appOrigin(process.env, req.nextUrl.origin);
      if (!origin || req.headers.get("origin") !== origin)
        fail(403, "Origen de solicitud no permitido.");
      const trusted =
        process.env.TRUST_PROXY === "true"
          ? req.headers.get("x-forwarded-for")?.split(",")[0].trim()
          : "shared";
      if (!(await limit(`request:${digest(trusted || "shared")}`, 120, 60)))
        fail(429, "Hay demasiadas solicitudes. Intenta más tarde.");
    }
    if (route === "session" && method === "GET") {
      const who = await identity();
      return ok({
        demo,
        accepting: demo || process.env.ACCEPT_REAL_REPORTS === "true",
        evidence_enabled: demo || !!process.env.EVIDENCE_SCANNER_URL,
        user: who
          ? {
              id: who.profile.id,
              name: who.profile.name,
              email: who.profile.email,
              role: who.profile.role,
              needsMfa:
                !demo &&
                ["admin", "staff"].includes(who.profile.role) &&
                who.aal !== "aal2",
            }
          : null,
      });
    }
    if (route === "auth/demo" && method === "POST") {
      if (!demo) fail(404, "Ruta no encontrada.");
      const v = z
        .object({ role: z.enum(["user", "admin"]) })
        .parse(await body(req));
      await setSession(
        v.role === "admin" ? "equipo@demo.local" : "persona@demo.local",
      );
      return ok({ ok: true });
    }
    if (route === "team" && method === "PATCH") {
      const who = await user(true);
      if (who.profile.role !== "admin")
        fail(403, "Solo administración puede gestionar el equipo.");
      const v = z
        .object({
          email: z.email().transform((s) => s.toLowerCase()),
          role: z.enum(["user", "staff"]),
        })
        .parse(await body(req));
      const target = (await all("profiles", { email: v.email }))[0];
      if (!target)
        fail(404, "La persona debe crear y confirmar su cuenta primero.");
      if (target.role === "admin")
        fail(
          403,
          "El rol de administración se gestiona de forma separada en la base de datos.",
        );
      await patch("profiles", target.id, { role: v.role });
      await audit(who.profile.id, null, "team.role.updated");
      return ok({ ok: true });
    }
    if (route === "auth/logout" && method === "POST") {
      if (!demo) await (await authClient()).auth.signOut();
      (await cookies()).delete("cd_session");
      (await cookies()).delete("cd_report");
      return ok({ ok: true });
    }
    if (
      (route === "auth/login" || route === "auth/signup") &&
      method === "POST"
    ) {
      const input = await body(req);
      const signup = route === "auth/signup" ? signupSchema.parse(input) : null;
      const v = signup ?? loginSchema.parse(input);
      if (!(await limit(`auth:${digest(v.email)}`, 8, 900)))
        fail(429, "Espera unos minutos antes de volver a intentarlo.");
      if (demo) {
        if (route.endsWith("signup")) {
          if ((await all("profiles", { email: v.email })).length)
            fail(400, "No se pudo crear la cuenta. Prueba iniciar sesión.");
          const id = randomUUID();
          await insert("profiles", {
            id,
            email: v.email,
            name: signup?.name || "Persona de prueba",
            role: "user",
            password_hash: hashPassword(v.password),
            created_at: new Date().toISOString(),
          });
          await setSession(id);
        } else {
          const p = (await all("profiles", { email: v.email }))[0];
          if (!p || !verifyPassword(v.password, p.password_hash || ""))
            fail(401, "Correo o contraseña incorrectos.");
          await setSession(p.id);
        }
        return ok({ ok: true });
      }
      const client = await authClient();
      if (route.endsWith("signup")) {
        const { error } = await client.auth.signUp({
          email: v.email,
          password: v.password,
          options: {
            emailRedirectTo: `${appOrigin()}/cuenta`,
            data: { name: signup?.name || "Usuario" },
          },
        });
        if (error)
          fail(400, "No se pudo crear la cuenta. Comprueba los datos.");
        return ok({
          ok: true,
          confirmation:
            "Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.",
        });
      }
      const { error } = await client.auth.signInWithPassword({
        email: v.email,
        password: v.password,
      });
      if (error) fail(401, "Correo o contraseña incorrectos.");
      return ok({ ok: true });
    }
    if (route === "auth/recover" && method === "POST") {
      const v = z.object({ email: z.email() }).parse(await body(req));
      if (!demo) {
        const { error } = await (
          await authClient()
        ).auth.resetPasswordForEmail(v.email, {
          redirectTo: `${appOrigin()}/cuenta`,
        });
        if (error) {
          console.error("Recovery service failed", safeBackendError(error));
          const failure = recoveryFailure(error);
          fail(failure.status, failure.message);
        }
      }
      return ok({
        message: demo
          ? "En la demo puedes usar las cuentas de prueba. No se envían correos."
          : "Si existe una cuenta, recibirás las instrucciones por correo.",
      });
    }
    if (route === "auth/mfa" && method === "GET") {
      await user();
      if (demo) return ok({ factors: [] });
      const { data, error } = await (await authClient()).auth.mfa.listFactors();
      if (error) throw error;
      return ok({ factors: data.totp });
    }
    if (route === "auth/mfa/enroll" && method === "POST") {
      await user();
      if (demo) fail(400, "La demo no usa un segundo factor real.");
      const { data, error } = await (
        await authClient()
      ).auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Centinela ${new Date().toISOString()}`,
      });
      if (error) fail(400, "No se pudo configurar el autenticador.");
      return ok(data);
    }
    if (route === "auth/mfa/verify" && method === "POST") {
      await user();
      const v = z
        .object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) })
        .parse(await body(req));
      const { error } = await (
        await authClient()
      ).auth.mfa.challengeAndVerify(v);
      if (error) fail(400, "Código no válido. Intenta nuevamente.");
      return ok({ ok: true });
    }
    if (route === "auth/exchange" && method === "POST") {
      const v = z
        .object({ code: z.string().min(1).max(3000) })
        .parse(await body(req));
      const { error } = await (
        await authClient()
      ).auth.exchangeCodeForSession(v.code);
      if (error) fail(400, "El enlace caducó o ya fue utilizado.");
      return ok({ ok: true });
    }
    if (route === "account" && method === "PATCH") {
      const who = await user();
      const v = z
        .object({
          name: z.string().trim().min(2).max(100),
          password: z.string().min(12).max(128).optional(),
        })
        .parse(await body(req));
      await patch("profiles", who.profile.id, {
        name: v.name,
        ...(demo && v.password
          ? { password_hash: hashPassword(v.password) }
          : {}),
      });
      if (!demo && v.password) {
        const { error } = await (
          await authClient()
        ).auth.updateUser({ password: v.password });
        if (error) fail(400, "No se pudo actualizar la contraseña.");
      }
      return ok({ ok: true });
    }
    if (route === "resources" && method === "GET")
      return ok({ resources: await all("resources", { published: true }) });
    if (route === "resources" && method === "POST") {
      const who = await user(true);
      if (who.profile.role !== "admin")
        fail(403, "Solo administración puede publicar recursos.");
      const v = z
        .object({
          id: z.string().optional(),
          name: z.string().trim().min(3).max(160),
          description: z.string().trim().min(10).max(1000),
          phone: z
            .string()
            .regex(/^[\d +()-]*$/)
            .max(30),
          url: z.union([z.literal(""), z.url().startsWith("https://")]),
          region: z.string().max(100),
          kind: z.string().max(60),
          published: z.boolean(),
        })
        .parse(await body(req));
      const { id, ...fields } = v;
      const value = { ...fields, verified_at: new Date().toISOString() };
      if (id) await patch("resources", id, value);
      else await insert("resources", { ...value, id: randomUUID() });
      await audit(who.profile.id, null, "resource.updated");
      return ok({ ok: true });
    }
    if (route === "reports" && method === "POST") {
      if (!demo && process.env.ACCEPT_REAL_REPORTS !== "true")
        fail(
          503,
          "La recepción de reportes reales todavía no está habilitada.",
        );
      secret();
      const v = reportSchema.parse(await body(req));
      if (demo && !v.demo_ack)
        fail(400, "Confirma que solo utilizarás información ficticia.");
      const who = await identity();
      const id = randomUUID(),
        key = newKey(),
        now = new Date().toISOString();
      const r: Report = {
        id,
        folio: `CD-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        owner_id: v.anonymous ? null : who?.profile.id || null,
        reporter: v.reporter,
        categories: v.categories,
        description: v.description,
        location: v.location,
        occurred_at: v.occurred_at,
        recurring: v.recurring,
        witnesses: v.witnesses,
        school: v.school,
        anonymous: v.anonymous,
        status: "Recibido",
        priority: "Por valorar",
        assignee_id: null,
        token_hash: digest(key),
        created_at: now,
        updated_at: now,
      };
      const contact = !v.anonymous
        ? {
            id: randomUUID(),
            report_id: id,
            name: v.name,
            email: v.email,
            phone: v.phone,
            contact_consent: v.contact_consent,
            notification_consent: v.notification_consent,
          }
        : null;
      const update = {
        id: randomUUID(),
        report_id: id,
        author_id: null,
        body: "Recibimos tu reporte. El equipo debe revisarlo; este registro no activa atención de emergencias.",
        kind: "public" as const,
        created_at: now,
      };
      if (demo) {
        const database = db();
        database.exec("BEGIN");
        try {
          for (const [table, value] of [
            ["reports", r],
            ["updates", update],
            ...(contact ? [["contacts", contact]] : []),
          ] as [string, { id: string }][])
            database
              .prepare("INSERT INTO records VALUES(?,?,?)")
              .run(table, value.id, JSON.stringify(value));
          database.exec("COMMIT");
        } catch (e) {
          database.exec("ROLLBACK");
          throw e;
        }
      } else {
        const { error } = await service().rpc("create_report_bundle", {
          report_data: r,
          contact_data: contact,
          update_data: update,
        });
        if (error) throw error;
      }
      await grantReport(id);
      return ok({ id, folio: r.folio, key });
    }
    if (route === "reports" && method === "GET") {
      const who = await user();
      const rows = await all("reports", { owner_id: who.profile.id });
      return ok({
        reports: await Promise.all(rows.map((r) => publicReport(r, false))),
      });
    }
    if (route === "track" && method === "POST") {
      const v = z
        .object({
          folio: z
            .string()
            .trim()
            .min(5)
            .max(50)
            .transform((v) => v.toUpperCase()),
          key: z.string().min(10).max(100),
        })
        .parse(await body(req));
      if (!(await limit(`track:${digest(v.folio)}`, 10, 900)))
        fail(429, "Demasiados intentos. Vuelve a intentarlo en 15 minutos.");
      const r = (await all("reports", { folio: v.folio }))[0];
      const actual = Buffer.from(digest(v.key), "hex");
      const expected = Buffer.from(r?.token_hash || digest("invalid"), "hex");
      if (!timingSafeEqual(actual, expected) || !r)
        fail(404, "Folio o clave incorrectos.");
      await grantReport(r.id);
      return ok({ report: await publicReport(r, false) });
    }
    if (route === "admin" && method === "GET") {
      const who = await user(true);
      const reports = await all(
        "reports",
        who.profile.role === "admin" ? {} : { assignee_id: who.profile.id },
      );
      const staff = (await all("profiles"))
        .filter((p) => ["staff", "admin"].includes(p.role))
        .map((p) => ({ id: p.id, name: p.name, role: p.role }));
      await audit(who.profile.id, null, "reports.listed");
      return ok({
        reports: reports.map(({ token_hash: _, ...r }) => r),
        staff,
        audit:
          who.profile.role === "admin"
            ? (await all("audit"))
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, 40)
            : [],
        resources: who.profile.role === "admin" ? await all("resources") : [],
      });
    }
    if (parts[0] === "reports" && parts[1]) {
      const { r, who, staff } = await authorizedReport(parts[1]);
      if (parts.length === 2 && method === "GET") {
        if (staff) await audit(who!.profile.id, r.id, "report.opened");
        return ok({ report: await publicReport(r, staff) });
      }
      if (parts.length === 2 && method === "PATCH") {
        const v = z
          .object({ description: z.string().trim().min(30).max(8000) })
          .parse(await body(req));
        if (staff)
          fail(403, "El equipo no puede reescribir el relato de la persona.");
        await insert("updates", {
          id: randomUUID(),
          report_id: r.id,
          author_id: who?.profile.id || null,
          body: `Aclaración aportada por quien reporta:\n${v.description}`,
          kind: "reporter",
          created_at: new Date().toISOString(),
        });
        return ok({ ok: true });
      }
      if (parts[2] === "updates" && method === "POST") {
        const v = z
          .object({
            body: z.string().trim().min(3).max(4000),
            internal: z.boolean().default(false),
            status: z.enum(statuses).optional(),
            priority: z
              .enum(["Por valorar", "Baja", "Media", "Alta"])
              .optional(),
            assignee_id: z.string().nullable().optional(),
          })
          .parse(await body(req));
        if (
          !staff &&
          (v.internal || v.status || v.priority || v.assignee_id !== undefined)
        )
          fail(403, "Solo el equipo puede actualizar la atención.");
        const changes: Partial<Report> = {
          updated_at: new Date().toISOString(),
        };
        if (staff) {
          if (v.status) changes.status = v.status;
          if (v.priority) changes.priority = v.priority;
          if (v.assignee_id !== undefined) {
            if (who!.profile.role !== "admin")
              fail(403, "Solo administración puede asignar casos.");
            if (v.assignee_id) {
              const p = (await all("profiles", { id: v.assignee_id }))[0];
              if (!p || !["admin", "staff"].includes(p.role))
                fail(400, "Responsable no válido.");
            }
            changes.assignee_id = v.assignee_id;
          }
        }
        const message = [
          v.body,
          v.status ? `Estado: ${v.status}.` : "",
          v.priority ? "La prioridad interna se actualizó." : "",
        ]
          .filter(Boolean)
          .join("\n");
        await insert("updates", {
          id: randomUUID(),
          report_id: r.id,
          author_id: who?.profile.id || null,
          body: message,
          kind: v.internal ? "internal" : staff ? "public" : "reporter",
          created_at: new Date().toISOString(),
        });
        await patch("reports", r.id, changes);
        if (staff)
          await audit(
            who!.profile.id,
            r.id,
            v.internal ? "note.internal" : "followup.updated",
          );
        return ok({ ok: true });
      }
      if (parts[2] === "feedback" && method === "POST") {
        if (staff) fail(403, "Solo quien reporta puede evaluar la atención.");
        if (r.status !== "Cerrado")
          fail(400, "Puedes evaluar cuando el reporte esté cerrado.");
        const v = z
          .object({
            rating: z.number().int().min(1).max(5),
            comment: z.string().max(1000),
          })
          .parse(await body(req));
        if ((await all("feedback", { report_id: r.id })).length)
          fail(409, "Ya recibimos tu evaluación.");
        await insert("feedback", {
          id: randomUUID(),
          report_id: r.id,
          ...v,
          created_at: new Date().toISOString(),
        });
        return ok({ ok: true });
      }
      if (parts[2] === "evidence" && method === "POST") {
        if (staff) fail(403, "Solo quien reporta puede agregar evidencias.");
        if (!demo && !process.env.EVIDENCE_SCANNER_URL)
          fail(
            503,
            "La carga de evidencias todavía no está disponible. Puedes enviar y consultar tu reporte sin adjuntos.",
          );
        if (Number(req.headers.get("content-length") || 0) > MAX_UPLOAD_BYTES)
          fail(413, "El archivo supera el límite.");
        if (
          (await all("evidence", { report_id: r.id })).length >=
          MAX_EVIDENCE_FILES
        )
          fail(400, "Máximo 5 archivos por reporte.");
        const bytesBody = await bounded(req, MAX_UPLOAD_BYTES);
        const data = await new Response(bytesBody, {
          headers: { "Content-Type": req.headers.get("content-type") || "" },
        }).formData();
        const file = data.get("file");
        if (
          !(file instanceof File) ||
          !file.size ||
          file.size > MAX_EVIDENCE_BYTES
        )
          fail(400, "Adjunta un PNG, JPG o PDF de hasta 4 MB.");
        const bytes = Buffer.from(await file.arrayBuffer());
        const mime = fileMime(bytes);
        if (!mime || file.type !== mime)
          fail(
            400,
            "El contenido del archivo no coincide con un PNG, JPG o PDF válido.",
          );
        if (!demo) {
          if (!process.env.EVIDENCE_SCANNER_URL)
            fail(
              503,
              "La carga de evidencias no está habilitada: falta configurar el análisis de seguridad.",
            );
          const scan = await fetch(process.env.EVIDENCE_SCANNER_URL, {
            method: "POST",
            body: bytes,
            signal: AbortSignal.timeout(15000),
            headers: { "Content-Type": "application/octet-stream" },
          });
          if (!scan.ok || (await scan.json()).clean !== true)
            fail(400, "No se pudo validar la seguridad del archivo.");
        }
        const id = randomUUID(),
          location = `${r.id}/${id}`;
        if (demo) {
          await mkdir(path.join(dataDir, r.id), {
            recursive: true,
            mode: 0o700,
          });
          await writeFile(path.join(dataDir, location), bytes, { mode: 0o600 });
        } else {
          const { error } = await service()
            .storage.from("evidence")
            .upload(location, bytes, { contentType: mime, upsert: false });
          if (error) throw error;
        }
        await insert("evidence", {
          id,
          report_id: r.id,
          filename: cleanFilename(file.name),
          mime,
          size: file.size,
          path: location,
          created_at: new Date().toISOString(),
        });
        return ok({ ok: true });
      }
      if (parts[2] === "evidence" && parts[3] && method === "GET") {
        const e = (await all("evidence", { id: parts[3], report_id: r.id }))[0];
        if (!e) fail(404, "Archivo no encontrado.");
        let bytes: Uint8Array;
        if (demo) bytes = await readFile(path.join(dataDir, e.path));
        else {
          const { data, error } = await service()
            .storage.from("evidence")
            .download(e.path);
          if (error) throw error;
          bytes = new Uint8Array(await data.arrayBuffer());
        }
        if (staff) await audit(who!.profile.id, r.id, "evidence.downloaded");
        return new NextResponse(Buffer.from(bytes), {
          headers: {
            "Content-Type": e.mime,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(e.filename)}`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (parts[2] === "evidence" && parts[3] && method === "DELETE") {
        if (staff)
          fail(403, "Solo quien reporta puede retirar sus evidencias.");
        const e = (await all("evidence", { id: parts[3], report_id: r.id }))[0];
        if (!e) fail(404, "Archivo no encontrado.");
        if (!demo) {
          const { error } = await service()
            .storage.from("evidence")
            .remove([e.path]);
          if (error) throw error;
        } else {
          const { unlink } = await import("node:fs/promises");
          await unlink(path.join(dataDir, e.path));
        }
        await remove("evidence", e.id);
        return ok({ ok: true });
      }
    }
    fail(404, "Ruta no encontrada.");
  } catch (error) {
    if (error instanceof HttpError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message || "Revisa los datos." },
        { status: 400 },
      );
    // Never log request payloads, credentials or report content.
    console.error("API operation failed", safeBackendError(error));
    return NextResponse.json(
      {
        error:
          "No se pudo completar la operación. Intenta nuevamente o contacta al equipo.",
      },
      { status: 503 },
    );
  }
}
export const GET = handle,
  POST = handle,
  PATCH = handle,
  DELETE = handle;
