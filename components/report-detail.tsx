"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  FileText,
  LockKeyhole,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { api, date } from "@/lib/client";
import { MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES } from "@/lib/report-policy";
import {
  statuses,
  type Report,
  type Update,
  type Evidence,
  type Contact,
} from "@/lib/domain";
import { Button, Notice } from "./ui";
export type FullReport = Omit<Report, "token_hash"> & {
  updates: Update[];
  evidence: Omit<Evidence, "path">[];
  contact?: Contact;
  first_reviewed_at: string | null;
  evidence_enabled: boolean;
  evidence_pdf_enabled: boolean;
  feedback: { rating: number; comment: string; created_at: string } | null;
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`status-badge status-${statuses.indexOf(status as (typeof statuses)[number])}`}
    >
      <span />
      {status}
    </span>
  );
}
export default function ReportDetail({
  report: initial,
  staff = false,
  team = [],
  admin = false,
}: {
  report: FullReport;
  staff?: boolean;
  team?: { id: string; name: string }[];
  admin?: boolean;
}) {
  const [report, setReport] = useState(initial),
    [message, setMessage] = useState(""),
    [internal, setInternal] = useState(false),
    [status, setStatus] = useState(initial.status),
    [priority, setPriority] = useState(initial.priority),
    [assignee, setAssignee] = useState(initial.assignee_id || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState(""),
    [rated, setRated] = useState(!!initial.feedback);
  async function refresh() {
    try {
      const v = await api<{ report: FullReport }>(`reports/${report.id}`);
      setReport(v.report);
      setStatus(v.report.status);
      setPriority(v.report.priority);
      setAssignee(v.report.assignee_id || "");
      setRated(!!v.report.feedback);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`reports/${report.id}/updates`, "POST", {
        body: message,
        internal: staff && internal,
        ...(staff
          ? {
              status,
              priority,
              ...(admin ? { assignee_id: assignee || null } : {}),
            }
          : {}),
      });
      setMessage("");
      await refresh();
      setNotice(
        internal
          ? "Nota interna guardada."
          : "Actualización guardada en el seguimiento.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_EVIDENCE_BYTES) {
      setError("Elige un PNG, JPG o PDF de hasta 4 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.set("file", file);
      await api(`reports/${report.id}/evidence`, "POST", data);
      await refresh();
      setNotice("Archivo adjuntado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (
      !confirm(
        "¿Retirar este archivo? Esta acción lo elimina del almacenamiento.",
      )
    )
      return;
    setError("");
    try {
      await api(`reports/${report.id}/evidence/${id}`, "DELETE");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function feedback(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`reports/${report.id}/feedback`, "POST", { rating, comment });
      setRated(true);
      await refresh();
      setNotice("Gracias. Tu evaluación fue registrada.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="detail-view">
      <div className="detail-header">
        <div>
          <span className="eyebrow">REPORTE</span>
          <h2>{report.folio}</h2>
          <p>Registrado el {date(report.created_at)}</p>
        </div>
        <div className="button-row">
          <StatusBadge status={report.status} />
          <button
            className="icon-button"
            aria-label="Actualizar seguimiento"
            onClick={refresh}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      <Notice>
        {report.first_reviewed_at
          ? `El equipo abrió tu reporte por primera vez el ${date(report.first_reviewed_at)}. Esto no confirma que la atención haya concluido.`
          : "Tu reporte está registrado. El equipo todavía no lo ha abierto."}
      </Notice>
      <div className="detail-columns">
        <div>
          <section className="panel">
            <div className="panel-head">
              <h3>Lo que se reportó</h3>
              <span className="badge">
                <LockKeyhole size={12} />
                {report.anonymous ? "Anónimo" : "Confidencial"}
              </span>
            </div>
            <div className="tag-row">
              {report.categories.map((c) => (
                <span className="tag" key={c}>
                  {c}
                </span>
              ))}
            </div>
            <p className="preserve-lines report-description">
              {report.description}
            </p>
            <dl className="review-list compact">
              <div>
                <dt>Contexto</dt>
                <dd>
                  {{
                    affected: "Persona afectada",
                    witness: "Testigo",
                    student: "Escolar",
                  }[report.reporter] || report.reporter}
                </dd>
              </div>
              {report.location && (
                <div>
                  <dt>Lugar</dt>
                  <dd>{report.location}</dd>
                </div>
              )}
              {report.school && (
                <div>
                  <dt>Escuela / contexto</dt>
                  <dd>{report.school}</dd>
                </div>
              )}
              {report.occurred_at && (
                <div>
                  <dt>Fecha aproximada</dt>
                  <dd>{report.occurred_at}</dd>
                </div>
              )}
              <div>
                <dt>Frecuencia</dt>
                <dd>
                  {report.recurring
                    ? "Ha ocurrido más de una vez"
                    : "No se indicó recurrencia"}
                </dd>
              </div>
              <div>
                <dt>Testigos</dt>
                <dd>
                  {report.witnesses
                    ? "Se mencionan testigos"
                    : "No se indicaron testigos"}
                </dd>
              </div>
            </dl>
            {staff && report.contact && (
              <div className="contact-box">
                <h4>Contacto autorizado</h4>
                <p>
                  {report.contact.name || "Sin nombre"}
                  <br />
                  {report.contact.contact_consent ? (
                    <>
                      {report.contact.email}
                      <br />
                      {report.contact.phone}
                    </>
                  ) : (
                    "No se autorizó contacto."
                  )}
                </p>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-head">
              <h3>
                <Clock size={18} />
                Historial de seguimiento
              </h3>
              <span className="small-text">
                {report.updates.length} entradas
              </span>
            </div>
            <div className="timeline">
              {report.updates.map((u) => (
                <article
                  className={`timeline-item ${u.kind === "internal" ? "internal" : ""}`}
                  key={u.id}
                >
                  <span className="timeline-dot" />
                  <div className="timeline-meta">
                    <strong>
                      {u.kind === "internal"
                        ? "Nota interna"
                        : u.kind === "reporter"
                          ? "Información de quien reporta"
                          : "Equipo Centinela"}
                    </strong>
                    <time>{date(u.created_at)}</time>
                  </div>
                  <p className="preserve-lines">{u.body}</p>
                </article>
              ))}
            </div>
          </section>
          <form className="panel" onSubmit={send}>
            <h3>
              <MessageSquare size={19} />
              {staff
                ? "Registrar seguimiento"
                : "Agregar información o una aclaración"}
            </h3>
            <p className="field-help">
              {staff
                ? "Escribe con claridad y evita exponer datos innecesarios."
                : "Puedes ampliar o corregir tu relato. El texto original se conserva. Las respuestas no son inmediatas."}
            </p>
            <label className="field">
              {staff ? "Mensaje o nota" : "Tu mensaje"}
              <textarea
                required
                minLength={3}
                maxLength={4000}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  staff
                    ? "Describe las acciones y los siguientes pasos…"
                    : "Escribe lo que quieres añadir…"
                }
              />
            </label>
            {staff && (
              <>
                <div className="two-grid">
                  <label className="field">
                    Estado
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Prioridad (valoración humana)
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      {["Por valorar", "Baja", "Media", "Alta"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {admin && (
                  <label className="field">
                    Responsable
                    <select
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                    >
                      <option value="">Sin asignar</option>
                      {team.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />
                  Nota interna: no mostrar este mensaje a quien reporta.
                </label>
              </>
            )}
            <Button disabled={busy} type="submit">
              <Send size={16} />
              {busy
                ? "Guardando…"
                : internal
                  ? "Guardar nota interna"
                  : "Guardar actualización"}
            </Button>
          </form>
          {report.feedback && (
            <section className="panel">
              <h3>
                {staff
                  ? "Evaluación de quien reportó"
                  : "Tu evaluación fue registrada"}
              </h3>
              <p>
                {report.feedback.rating} de 5 ·{" "}
                {date(report.feedback.created_at)}
              </p>
              {report.feedback.comment && (
                <p className="preserve-lines">{report.feedback.comment}</p>
              )}
            </section>
          )}
          {!staff && report.status === "Cerrado" && !rated && (
            <form className="panel" onSubmit={feedback}>
              <h3>¿Cómo fue tu experiencia?</h3>
              <label className="field">
                Calificación
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option value={n} key={n}>
                      {n} de 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Comentario opcional
                <textarea
                  value={comment}
                  maxLength={1000}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
              <Button variant="outline" disabled={busy}>
                <Star size={16} />
                Enviar evaluación
              </Button>
            </form>
          )}
        </div>
        <aside>
          <section className="panel">
            <h3>
              <Paperclip size={18} />
              Evidencias
            </h3>
            <p className="field-help">
              Archivos privados. Descárgalos solo en un dispositivo seguro.
            </p>
            {report.evidence.length === 0 && (
              <div className="empty-inline">
                <FileText size={27} />
                <p>No se adjuntaron archivos.</p>
              </div>
            )}
            {report.evidence.map((e) => (
              <div className="evidence-item" key={e.id}>
                <FileText size={20} />
                <div>
                  <strong>{e.filename}</strong>
                  <small>{Math.ceil(e.size / 1024)} KB</small>
                </div>
                <a
                  className="icon-button"
                  href={`/api/reports/${report.id}/evidence/${e.id}`}
                  download
                  aria-label={`Descargar ${e.filename}`}
                >
                  <ArrowDownToLine size={17} />
                </a>
                {!staff && (
                  <button
                    className="icon-button"
                    aria-label={`Eliminar ${e.filename}`}
                    onClick={() => remove(e.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            {!staff && !report.evidence_enabled && (
              <Notice>
                La carga de evidencias todavía no está disponible. Tu reporte y
                su seguimiento funcionan sin adjuntos.
              </Notice>
            )}
            {!staff &&
              report.evidence_enabled &&
              report.evidence.length < MAX_EVIDENCE_FILES && (
                <label className={`file-button ${busy ? "disabled" : ""}`}>
                  <Paperclip size={16} />
                  Adjuntar archivo
                  <input
                    disabled={busy}
                    type="file"
                    accept={
                      report.evidence_pdf_enabled
                        ? "image/jpeg,image/png,application/pdf"
                        : "image/jpeg,image/png"
                    }
                    onChange={(e) => {
                      upload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            {!staff && report.evidence_enabled && (
              <p className="field-help">
                {report.evidence_pdf_enabled ? "PNG, JPG o PDF" : "PNG o JPG"} ·
                máximo 5 archivos de 4 MB. Las imágenes se procesan para retirar
                metadatos; conserva tus originales en un lugar seguro.
              </p>
            )}
          </section>
          <div className="notice">
            <ShieldIcon />
            <strong>Tu seguimiento es privado.</strong>
            <p>
              Conserva tu clave. El equipo no te pedirá contraseñas ni claves
              bancarias.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
function ShieldIcon() {
  return <CheckCircle2 size={22} />;
}
