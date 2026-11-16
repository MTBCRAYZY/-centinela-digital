"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  EyeOff,
  FileText,
  GraduationCap,
  Heart,
  LockKeyhole,
  MapPin,
  Paperclip,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { categories, reportSchema, type ReportInput } from "@/lib/domain";
import { api, download, type Session } from "@/lib/client";
import { encryptDraft, decryptDraft } from "@/lib/drafts";
import { MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES } from "@/lib/report-policy";
import { Button, Notice } from "./ui";
import { PageTitle, Emergency } from "./centinela-app";
const defaults = {
  reporter: "affected" as const,
  categories: [],
  description: "",
  location: "",
  occurred_at: "",
  recurring: false,
  witnesses: false,
  school: "",
  anonymous: true,
  name: "",
  email: "",
  phone: "",
  contact_consent: false,
  notification_consent: false,
  demo_ack: false,
};
export default function ReportWizard({ session }: { session: Session | null }) {
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [result, setResult] = useState<{
      id: string;
      folio: string;
      key: string;
    } | null>(null),
    [uploadErrors, setUploadErrors] = useState<string[]>([]),
    [draftPassword, setDraftPassword] = useState(""),
    [draftNotice, setDraftNotice] = useState("");
  const {
    register,
    watch,
    setValue,
    getValues,
    reset,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: defaults,
  });
  const values = watch();
  useEffect(() => {
    if (new URLSearchParams(location.search).get("context") === "student")
      setValue("reporter", "student");
  }, [setValue]);
  async function next() {
    setError("");
    const fields: (keyof ReportInput)[][] = [
      ["reporter", "categories"],
      ["description", "location", "occurred_at", "school"],
      [
        "anonymous",
        "name",
        "email",
        "phone",
        "contact_consent",
        "notification_consent",
      ],
    ];
    if (await trigger(fields[step], { shouldFocus: true })) setStep(step + 1);
  }
  function anonymous(on: boolean) {
    setValue("anonymous", on);
    if (on) {
      setValue("name", "");
      setValue("email", "");
      setValue("phone", "");
      setValue("contact_consent", false);
      setValue("notification_consent", false);
    }
  }
  async function submit(data: ReportInput) {
    setError("");
    setBusy(true);
    try {
      const v = await api<{ id: string; folio: string; key: string }>(
        "reports",
        "POST",
        data,
      );
      setResult(v);
      const failed: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        try {
          await api(`reports/${v.id}/evidence`, "POST", form);
        } catch (e) {
          failed.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      setUploadErrors(failed);
      setFiles([]);
      reset(defaults);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft() {
    setDraftNotice("");
    setError("");
    try {
      const encrypted = await encryptDraft(getValues(), draftPassword);
      download("centinela-borrador.centinela", encrypted, "application/json");
      setDraftNotice(
        "Borrador cifrado descargado. Las evidencias no se incluyen. Conserva la contraseña fuera de este dispositivo.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function loadDraft(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 50000) throw new Error("Archivo demasiado grande.");
      const parsed = await decryptDraft(await file.text(), draftPassword);
      const valid = reportSchema.partial().safeParse(parsed);
      if (!valid.success)
        throw new Error("El borrador contiene datos no válidos.");
      reset({ ...defaults, ...valid.data });
      setStep(0);
      setDraftNotice(
        "Borrador abierto. Revisa todos los datos antes de enviarlo.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (result)
    return (
      <div className="page narrow">
        <div className="success-panel panel">
          <span className="success-icon">
            <CheckCircle2 size={40} />
          </span>
          <div className="eyebrow">HEMOS RECIBIDO TU REPORTE</div>
          <h1>Gracias por dar este paso.</h1>
          <p>
            Tu reporte quedó registrado. Conserva estos datos en un lugar seguro
            para consultar el seguimiento.
          </p>
          <div className="receipt">
            <label>FOLIO</label>
            <strong>{result.folio}</strong>
            <label>CLAVE PRIVADA · SE MUESTRA SOLO AQUÍ</label>
            <code>{result.key}</code>
          </div>
          <Notice>
            La clave permite abrir tu reporte. No la compartas ni la envíes por
            mensajes. Si el reporte es anónimo y la pierdes, no podremos
            recuperarla.
          </Notice>
          {uploadErrors.length > 0 && (
            <Notice tone="error">
              <strong>
                El reporte se guardó, pero algunos archivos no se adjuntaron.
              </strong>
              {uploadErrors.map((e) => (
                <p key={e}>{e}</p>
              ))}
              Puedes volver a adjuntarlos desde el seguimiento.
            </Notice>
          )}
          <div className="button-row">
            <Button
              onClick={() =>
                download(
                  "centinela-seguimiento.txt",
                  `Centinela Digital\nFolio: ${result.folio}\nClave privada: ${result.key}\nNo compartas estos datos.\n`,
                )
              }
            >
              <Download size={17} />
              Guardar mis datos de consulta
            </Button>
            <Button variant="outline" asChild>
              <Link href="/seguimiento">
                Consultar seguimiento <ArrowRight size={17} />
              </Link>
            </Button>
          </div>
          <p className="small-text">
            Descargar deja un archivo en tu dispositivo. Hazlo solo si es seguro
            para ti.
          </p>
        </div>
        <Emergency />
      </div>
    );
  return (
    <div className="page">
      <PageTitle
        eyebrow="ESTAMOS AQUÍ PARA ESCUCHARTE"
        title="Cuéntanos lo que sucede."
        text="Puedes compartir lo que sabes, a tu ritmo. Los campos opcionales están indicados; no necesitas adjuntar pruebas."
      />
      <div className="report-layout">
        <div>
          <ol className="wizard-steps">
            {[
              "La situación",
              "Lo que ocurrió",
              "Tu privacidad",
              "Revisar y enviar",
            ].map((v, i) => (
              <li
                className={step === i ? "current" : step > i ? "done" : ""}
                key={v}
                aria-current={step === i ? "step" : undefined}
              >
                <span>{step > i ? <Check size={15} /> : i + 1}</span>
                <div>{v}</div>
              </li>
            ))}
          </ol>
          <form
            className="panel report-form"
            onSubmit={handleSubmit(submit, () =>
              setError(
                "Revisa los campos marcados y la aceptación del aviso de privacidad.",
              ),
            )}
          >
            <div className="form-heading">
              <span>PASO {step + 1} DE 4</span>
              <LockKeyhole size={17} />
            </div>
            {step === 0 && (
              <>
                <h2>¿Sobre qué quieres reportar?</h2>
                <p>Selecciona cómo te relacionas con la situación.</p>
                <div className="choice-row">
                  {[
                    ["affected", "Me está pasando", Heart],
                    ["witness", "Soy testigo", Users],
                    ["student", "En mi escuela", GraduationCap],
                  ].map(([value, label, Icon]) => {
                    const I = Icon as typeof Heart;
                    return (
                      <button
                        key={value as string}
                        type="button"
                        className={`choice ${values.reporter === value ? "selected" : ""}`}
                        onClick={() =>
                          setValue("reporter", value as ReportInput["reporter"])
                        }
                      >
                        <I size={23} />
                        {label as string}
                        {values.reporter === value && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
                <h3 className="field-heading">
                  ¿Qué tipos de violencia identificas?
                </h3>
                <p className="field-help">
                  Puedes elegir varios. Si no estás seguro, selecciona el que
                  más se acerque.
                </p>
                <div className="category-choices">
                  {categories.map((c) => (
                    <label
                      className={
                        values.categories?.includes(c) ? "selected" : ""
                      }
                      key={c}
                    >
                      <input
                        type="checkbox"
                        value={c}
                        {...register("categories")}
                      />
                      <span>{c}</span>
                      <ShieldCheck size={18} />
                    </label>
                  ))}
                </div>
                {errors.categories && (
                  <p className="field-error">
                    Selecciona al menos un tipo de violencia.
                  </p>
                )}
                <Link className="text-link" href="/informacion" target="_blank">
                  ¿Cómo reconocer los tipos de violencia?{" "}
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
            {step === 1 && (
              <>
                <h2>Comparte lo que ocurrió.</h2>
                <p>
                  No necesitas usar palabras técnicas ni recordar cada detalle.
                </p>
                <label className="field">
                  Descripción de la situación{" "}
                  <textarea
                    rows={7}
                    maxLength={8000}
                    placeholder="Por ejemplo: qué ocurrió, cuándo empezó y cómo te está afectando. Evita datos de otras personas que no sean necesarios."
                    {...register("description")}
                  />
                  <span className="field-help">
                    {values.description?.length || 0}/8000 caracteres · mínimo
                    30
                  </span>
                  {errors.description && (
                    <span className="field-error">
                      {errors.description.message}
                    </span>
                  )}
                </label>
                <div className="two-grid">
                  <label className="field">
                    Fecha aproximada (opcional)
                    <input
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      {...register("occurred_at")}
                    />
                  </label>
                  <label className="field">
                    Lugar aproximado (opcional)
                    <input
                      placeholder="Municipio, colonia o espacio público"
                      maxLength={300}
                      {...register("location")}
                    />
                  </label>
                </div>
                <p className="field-help">
                  <MapPin size={14} /> No capturamos tu ubicación
                  automáticamente. Escribe solo el lugar necesario.
                </p>
                {values.reporter === "student" && (
                  <label className="field">
                    Escuela o contexto escolar (opcional)
                    <input
                      placeholder="Puedes indicar solo el nivel o municipio"
                      maxLength={200}
                      {...register("school")}
                    />
                  </label>
                )}
                <label className="checkbox-field">
                  <input type="checkbox" {...register("recurring")} />
                  Ha ocurrido más de una vez.
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" {...register("witnesses")} />
                  Otras personas presenciaron la situación.
                </label>
                <div className="file-area">
                  <Paperclip size={22} />
                  <div>
                    <strong>Evidencias (opcional)</strong>
                    <p>
                      {session?.evidence_pdf_enabled
                        ? "JPG, PNG o PDF"
                        : "JPG o PNG"}{" "}
                      · hasta 5 archivos de 4 MB. No te pongas en riesgo para
                      conseguirlos.
                    </p>
                    <label className="file-button">
                      Elegir archivos
                      <input
                        aria-label="Elegir evidencias"
                        type="file"
                        accept={
                          session?.evidence_pdf_enabled
                            ? "image/jpeg,image/png,application/pdf"
                            : "image/jpeg,image/png"
                        }
                        multiple
                        disabled={!session?.evidence_enabled}
                        onChange={(e) => {
                          const selected = Array.from(e.target.files || []);
                          if (
                            selected.some((f) => f.size > MAX_EVIDENCE_BYTES) ||
                            selected.length + files.length > MAX_EVIDENCE_FILES
                          ) {
                            setError(
                              "Máximo 5 archivos, cada uno de hasta 4 MB.",
                            );
                            return;
                          }
                          setFiles([...files, ...selected]);
                        }}
                      />
                    </label>
                  </div>
                </div>
                {files.map((f, i) => (
                  <div className="file-item" key={`${f.name}-${i}`}>
                    <FileText size={17} />
                    {f.name}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Retirar ${f.name}`}
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
                {session && !session.evidence_enabled && (
                  <Notice>
                    La carga de evidencias todavía no está disponible. Puedes
                    continuar y enviar tu reporte sin adjuntos.
                  </Notice>
                )}
                <p className="small-text">
                  Las imágenes se procesan para retirar metadatos, como la
                  ubicación. Su contenido y nombre aún pueden identificarte.
                  Conserva tus originales en un lugar seguro: la copia guardada
                  aquí puede ser diferente. No necesitas adjuntar pruebas para
                  reportar.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <h2>Tú decides qué compartir.</h2>
                <p>No necesitas una cuenta ni identificarte para reportar.</p>
                <div className="privacy-choices">
                  <button
                    type="button"
                    className={`privacy-choice ${values.anonymous ? "selected" : ""}`}
                    onClick={() => anonymous(true)}
                  >
                    <EyeOff />
                    <div>
                      <strong>Reporte anónimo</strong>
                      <p>
                        No solicitaremos tus datos de contacto ni lo
                        vincularemos a tu cuenta.
                      </p>
                    </div>
                    {values.anonymous && <Check />}
                  </button>
                  <button
                    type="button"
                    className={`privacy-choice ${!values.anonymous ? "selected" : ""}`}
                    onClick={() => anonymous(false)}
                  >
                    <UserIcon />
                    <div>
                      <strong>Compartir datos de forma confidencial</strong>
                      <p>
                        Puedes dejar tu nombre y autorizar que el equipo te
                        contacte.
                      </p>
                    </div>
                    {!values.anonymous && <Check />}
                  </button>
                </div>
                {values.anonymous ? (
                  <Notice>
                    Evita incluir datos que te identifiquen en el relato o los
                    archivos. El anonimato no puede garantizarse frente a toda
                    la infraestructura o al contenido que compartas.
                  </Notice>
                ) : (
                  <>
                    <label className="field">
                      Nombre o cómo prefieres que te llamemos (opcional)
                      <input {...register("name")} maxLength={120} />
                    </label>
                    <div className="two-grid">
                      <label className="field">
                        Correo (opcional)
                        <input type="email" {...register("email")} />
                        {errors.email && (
                          <span className="field-error">Revisa el correo.</span>
                        )}
                      </label>
                      <label className="field">
                        Teléfono (opcional)
                        <input
                          type="tel"
                          {...register("phone")}
                          maxLength={30}
                        />
                      </label>
                    </div>
                    <label className="checkbox-field">
                      <input type="checkbox" {...register("contact_consent")} />
                      Autorizo al equipo a usar estos datos para contactarme
                      sobre mi reporte.
                    </label>
                    <p className="field-help">
                      En esta versión no se envían correos ni mensajes
                      automáticos. Consulta las novedades dentro del
                      seguimiento.
                    </p>
                    {session?.user ? (
                      <Notice>
                        Este reporte confidencial estará vinculado a tu cuenta y
                        aparecerá en “Mis reportes”.
                      </Notice>
                    ) : (
                      <Notice>
                        Puedes continuar sin cuenta. Conserva el folio y la
                        clave que recibirás al enviar.
                      </Notice>
                    )}
                  </>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <h2>Revisa antes de enviar.</h2>
                <p>Puedes volver y corregir cualquier dato.</p>
                <dl className="review-list">
                  <div>
                    <dt>Contexto</dt>
                    <dd>
                      {
                        {
                          affected: "Persona afectada",
                          witness: "Testigo",
                          student: "Escolar",
                        }[values.reporter]
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>Tipos</dt>
                    <dd>{values.categories.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Privacidad</dt>
                    <dd>
                      {values.anonymous
                        ? "Anónimo · sin cuenta vinculada"
                        : "Confidencial"}
                    </dd>
                  </div>
                  <div>
                    <dt>Descripción</dt>
                    <dd className="preserve-lines">{values.description}</dd>
                  </div>
                  {values.location && (
                    <div>
                      <dt>Lugar</dt>
                      <dd>{values.location}</dd>
                    </div>
                  )}
                  {values.school && (
                    <div>
                      <dt>Contexto escolar</dt>
                      <dd>{values.school}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Evidencias</dt>
                    <dd>{files.length} archivo(s) por adjuntar</dd>
                  </div>
                </dl>
                <label className="checkbox-field">
                  <input type="checkbox" {...register("privacy_consent")} />
                  <span>
                    He leído el{" "}
                    <Link href="/privacidad" target="_blank">
                      aviso de privacidad
                    </Link>{" "}
                    y entiendo que este reporte no equivale a una denuncia
                    formal ni activa atención de emergencia.
                  </span>
                </label>
                {errors.privacy_consent && (
                  <p className="field-error">Acepta el aviso para continuar.</p>
                )}
                {session?.demo && (
                  <label className="checkbox-field">
                    <input type="checkbox" {...register("demo_ack")} />
                    Confirmo que esta demostración solo contiene información
                    ficticia.
                  </label>
                )}
                <Notice>
                  El folio y la clave privada se generarán al enviar. La clave
                  se mostrará una sola vez.
                </Notice>
              </>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            <div className="wizard-actions">
              <div>
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setStep(step - 1)}
                  >
                    <ArrowLeft size={16} />
                    Anterior
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (
                        confirm(
                          "¿Salir del formulario? Los datos sin exportar se perderán.",
                        )
                      )
                        location.assign("/");
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
              <span className="step-count">{step + 1} / 4</span>
              {step < 3 ? (
                <Button type="button" onClick={next}>
                  Continuar <ArrowRight size={17} />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={busy || !session || !session.accepting}
                >
                  {busy ? "Guardando…" : "Enviar reporte"}{" "}
                  <ShieldCheck size={17} />
                </Button>
              )}
            </div>
          </form>
          <details className="panel draft-panel">
            <summary>
              <Download size={17} /> Guardar o abrir un borrador cifrado
            </summary>
            <p>
              Solo se guarda si lo descargas. Necesitarás esta contraseña para
              abrirlo; no podemos recuperarla. No incluye archivos adjuntos.
            </p>
            <label className="field">
              Contraseña del borrador (mínimo 12 caracteres)
              <input
                type="password"
                autoComplete="off"
                value={draftPassword}
                onChange={(e) => setDraftPassword(e.target.value)}
              />
            </label>
            <div className="button-row">
              <Button variant="outline" onClick={saveDraft}>
                Descargar borrador
              </Button>
              <label className="file-button">
                Abrir borrador
                <input
                  type="file"
                  accept=".centinela,application/json"
                  aria-label="Abrir borrador"
                  onChange={(e) => loadDraft(e.target.files?.[0])}
                />
              </label>
            </div>
            {draftNotice && <Notice>{draftNotice}</Notice>}
          </details>
        </div>
        <aside className="report-aside">
          <div className="panel guidance-card">
            <span className="quick-icon lilac">
              <Heart />
            </span>
            <h3>Este espacio es tuyo.</h3>
            <p>Comparte solo aquello con lo que te sientas cómodo.</p>
            <ul>
              <li>
                <Check size={16} />
                Puedes reportar sin dar tu nombre.
              </li>
              <li>
                <Check size={16} />
                No necesitas adjuntar pruebas.
              </li>
              <li>
                <Check size={16} />
                Solo el personal autorizado podrá revisar tu caso.
              </li>
            </ul>
            <Link className="text-link" href="/privacidad">
              Cómo cuidamos tus datos <ArrowRight size={15} />
            </Link>
          </div>
          <div className="aside-emergency">
            <PhoneIcon />
            <strong>Si hay peligro inmediato</strong>
            <p>
              En México, llama al <a href="tel:911">911</a>. No esperes una
              respuesta en esta plataforma.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
function UserIcon() {
  return <Users />;
}
function PhoneIcon() {
  return <Heart size={22} />;
}
