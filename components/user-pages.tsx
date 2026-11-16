"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Eye,
  EyeOff,
  FilePlus2,
  KeyRound,
  LockKeyhole,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { api, date, type Session } from "@/lib/client";
import { Button, Notice } from "./ui";
import { PageTitle } from "./centinela-app";
import ReportDetail, { StatusBadge, type FullReport } from "./report-detail";
export function Tracking() {
  const [folio, setFolio] = useState(""),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false),
    [report, setReport] = useState<FullReport | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const v = await api<{ report: FullReport }>("track", "POST", {
        folio,
        key,
      });
      setReport(v.report);
      setKey("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`page ${report ? "" : "narrow"}`}>
      <PageTitle
        eyebrow="UN PASO A LA VEZ"
        title={
          report
            ? "El seguimiento de tu reporte."
            : "Consulta cómo va tu reporte."
        }
        text="Tu folio y clave privada permiten acceder al seguimiento sin crear una cuenta."
      />
      {report ? (
        <>
          <Button variant="ghost" onClick={() => setReport(null)}>
            <ArrowLeft size={16} />
            Consultar otro reporte
          </Button>
          <ReportDetail key={report.id} report={report} />
        </>
      ) : (
        <>
          <form className="panel tracking-form" onSubmit={submit}>
            <div className="large-icon">
              <Search size={29} />
            </div>
            <h2>Seguimiento privado</h2>
            <p>Introduce los datos que recibiste al enviar tu reporte.</p>
            <label className="field">
              Folio
              <input
                required
                autoComplete="off"
                placeholder="CD-XXXXXXXXXXXX"
                value={folio}
                maxLength={50}
                onChange={(e) => setFolio(e.target.value)}
              />
            </label>
            <label className="field">
              Clave privada
              <div className="password-field">
                <input
                  type={show ? "text" : "password"}
                  required
                  autoComplete="off"
                  value={key}
                  maxLength={100}
                  onChange={(e) => setKey(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Ocultar clave" : "Mostrar clave"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" disabled={busy}>
              {busy ? "Consultando…" : "Consultar mi reporte"}
              <ArrowRight size={17} />
            </Button>
            <p className="small-text">
              <LockKeyhole size={13} /> No compartas tu clave privada.
            </p>
          </form>
          <Notice>
            ¿Creaste un reporte confidencial desde tu cuenta? También puedes
            encontrarlo en <Link href="/mis-reportes">Mis reportes</Link>. Las
            claves de reportes anónimos no se recuperan.
          </Notice>
        </>
      )}
    </div>
  );
}
export function MyReports({
  session,
  notifications = false,
}: {
  session: Session | null;
  notifications?: boolean;
}) {
  const [reports, setReports] = useState<FullReport[]>([]),
    [selected, setSelected] = useState<FullReport | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (session?.user)
      api<{ reports: FullReport[] }>("reports")
        .then((v) =>
          setReports(
            v.reports.sort((a, b) => b.created_at.localeCompare(a.created_at)),
          ),
        )
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
  }, [session?.user?.id]);
  if (!session)
    return (
      <div className="page">
        <Notice>Cargando tu espacio…</Notice>
      </div>
    );
  if (!session.user) return <LoginRequired />;
  return (
    <div className="page">
      <PageTitle
        eyebrow="MI ESPACIO"
        title={notifications ? "Tus novedades." : "Mis reportes."}
        text={
          notifications
            ? "Las actualizaciones de los reportes vinculados a tu cuenta."
            : "Aquí aparecen los reportes confidenciales que enviaste con tu sesión iniciada. Los anónimos se consultan con folio y clave."
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {selected ? (
        <>
          <Button variant="ghost" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} />
            Volver
          </Button>
          <ReportDetail key={selected.id} report={selected} />
        </>
      ) : loading ? (
        <Notice>Cargando reportes…</Notice>
      ) : reports.length === 0 ? (
        <div className="panel empty-state">
          <FilePlus2 size={40} />
          <h2>Aún no tienes reportes vinculados.</h2>
          <p>Puedes crear uno o consultar un reporte anónimo con tu folio.</p>
          <Button asChild>
            <Link href="/reportar">
              Crear un reporte <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      ) : notifications ? (
        <div className="notification-list">
          {reports
            .flatMap((r) =>
              r.updates
                .filter((u) => u.kind === "public")
                .map((u) => ({ r, u })),
            )
            .sort((a, b) => b.u.created_at.localeCompare(a.u.created_at))
            .map(({ r, u }) => (
              <button
                className="panel notification-item"
                key={u.id}
                onClick={() => setSelected(r)}
              >
                <span className="quick-icon lilac">
                  <Bell size={20} />
                </span>
                <div>
                  <strong>{r.folio}</strong>
                  <p>{u.body}</p>
                  <small>{date(u.created_at)}</small>
                </div>
                <ArrowRight size={17} />
              </button>
            ))}
        </div>
      ) : (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Consultar</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.folio}</strong>
                  </td>
                  <td>{date(r.created_at)}</td>
                  <td>{r.categories.join(", ")}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => setSelected(r)}
                    >
                      Ver <ArrowUpIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export function LoginRequired() {
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow="TU CUENTA"
        title="Entra a tu espacio."
        text="Para esta sección necesitas una cuenta. Los reportes anónimos se consultan sin iniciar sesión."
      />
      <div className="panel empty-state">
        <LockKeyhole size={35} />
        <Button asChild>
          <Link href="/ingresar">
            Iniciar sesión <ArrowRight size={16} />
          </Link>
        </Button>
        <Link className="text-link" href="/seguimiento">
          Consultar con folio y clave
        </Link>
      </div>
    </div>
  );
}
export function Login({
  session,
  refresh,
}: {
  session: Session | null;
  refresh: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "recover">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const v = await api<{ confirmation?: string; message?: string }>(
        `auth/${mode}`,
        "POST",
        {
          email,
          ...(mode !== "recover" ? { password } : {}),
          ...(mode === "signup" ? { name } : {}),
        },
      );
      if (v.confirmation || v.message)
        setNotice(v.confirmation || v.message || "");
      else await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enterDemo(role: string) {
    setError("");
    setBusy(true);
    try {
      await api("auth/demo", "POST", { role });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (session?.user)
    return (
      <div className="page narrow">
        <PageTitle
          eyebrow="TU ESPACIO"
          title={`Hola, ${session.user.name}.`}
          text="Tu sesión está iniciada."
        />
        {session.user.needsMfa ? (
          <Mfa refresh={refresh} />
        ) : (
          <div className="panel empty-state">
            <ShieldCheck size={42} />
            <Button asChild>
              <Link
                href={
                  session.user.role === "user" ? "/mis-reportes" : "/equipo"
                }
              >
                Ir a mi espacio <ArrowRight size={17} />
              </Link>
            </Button>
          </div>
        )}
      </div>
    );
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow="UN ESPACIO PARA TI"
        title={
          mode === "signup"
            ? "Crea tu cuenta."
            : mode === "recover"
              ? "Recupera tu acceso."
              : "Qué bueno tenerte aquí."
        }
        text="Tener una cuenta es opcional. Puedes enviar un reporte anónimo sin registrarte."
      />
      <form className="panel auth-form" onSubmit={submit}>
        <div className="large-icon">
          <UserRound size={28} />
        </div>
        <h2>
          {mode === "signup"
            ? "Registro"
            : mode === "recover"
              ? "Recuperar contraseña"
              : "Iniciar sesión"}
        </h2>
        {mode === "signup" && (
          <label className="field">
            Nombre o alias
            <input
              required
              minLength={2}
              maxLength={100}
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label className="field">
          Correo electrónico
          <input
            required
            type="email"
            autoComplete="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode !== "recover" && (
          <label className="field">
            Contraseña
            <input
              required
              type="password"
              minLength={mode === "signup" ? 12 : 1}
              maxLength={128}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "signup" && (
              <span className="field-help">
                Al menos 12 caracteres. Usa una contraseña única.
              </span>
            )}
          </label>
        )}
        {mode === "signup" && (
          <label className="checkbox-field">
            <input type="checkbox" required />
            <span>
              Leí el <Link href="/privacidad">aviso de privacidad</Link> y los{" "}
              <Link href="/terminos">términos de uso</Link>.
              {session?.demo ? " Usaré solo datos ficticios." : ""}
            </span>
          </label>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice>{notice}</Notice>}
        <Button disabled={busy}>
          {busy
            ? "Procesando…"
            : mode === "signup"
              ? "Crear cuenta"
              : mode === "recover"
                ? "Enviar instrucciones"
                : "Entrar"}
          <ArrowRight size={17} />
        </Button>
        <div className="auth-links">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
              setNotice("");
            }}
          >
            {mode === "signup" ? "Ya tengo una cuenta" : "Crear una cuenta"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "recover" ? "login" : "recover")}
          >
            {mode === "recover" ? "Volver al ingreso" : "Olvidé mi contraseña"}
          </button>
        </div>
      </form>
      {session?.demo && (
        <div className="panel demo-access">
          <span className="eyebrow">RECORRIDO CON DATOS FICTICIOS</span>
          <p>
            Prueba ambos perfiles sin introducir contraseñas ni crear cuentas
            reales.
          </p>
          <div className="button-row">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => enterDemo("user")}
            >
              Entrar como usuario
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => enterDemo("admin")}
            >
              Entrar como equipo
            </Button>
          </div>
        </div>
      )}
      <Link className="text-link centered" href="/reportar">
        Prefiero reportar sin cuenta <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function Mfa({ refresh }: { refresh: () => Promise<unknown> }) {
  const [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [setupKey, setSetupKey] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ factors: { id: string; status: string }[] }>("auth/mfa")
      .then((v) => {
        const found = v.factors.find((f) => f.status === "verified");
        if (found) setFactor(found.id);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function enroll() {
    setError("");
    setBusy(true);
    try {
      const v = await api<{
        id: string;
        totp: { qr_code: string; secret: string };
      }>("auth/mfa/enroll", "POST");
      setFactor(v.id);
      setQr(v.totp.qr_code);
      setSetupKey(v.totp.secret);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("auth/mfa/verify", "POST", { factorId: factor, code });
      setSetupKey("");
      setQr("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>
        <ShieldCheck size={22} />
        Verificación del equipo
      </h2>
      <p>El panel requiere un código de tu aplicación autenticadora.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {!factor ? (
        <Button disabled={busy} onClick={enroll}>
          Configurar autenticador
        </Button>
      ) : (
        <form onSubmit={verify}>
          {qr && (
            <>
              <img
                className="mfa-qr"
                src={
                  qr.startsWith("data:")
                    ? qr
                    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`
                }
                alt="Código QR para configurar tu autenticador"
              />
              <p className="small-text">
                Escanea con tu autenticador. Esta clave es privada: no la
                compartas.
              </p>
              <code className="secret-code">{setupKey}</code>
            </>
          )}
          <label className="field">
            Código de 6 dígitos
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <Button disabled={busy}>Verificar acceso</Button>
        </form>
      )}
    </section>
  );
}
export function Account({
  session,
  refresh,
}: {
  session: Session | null;
  refresh: () => Promise<unknown>;
}) {
  const [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(session?.user?.name || "");
  }, [session?.user?.name]);
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("code");
    if (code) {
      history.replaceState(null, "", "/cuenta");
      api("auth/exchange", "POST", { code })
        .then(() => {
          setNotice("Enlace validado. Ya puedes cambiar tu contraseña.");
          return refresh();
        })
        .catch((e) => setError(e.message));
    }
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("account", "PATCH", {
        name,
        ...(password ? { password } : {}),
      });
      setPassword("");
      setNotice("Cambios guardados.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow="MI ESPACIO"
        title="Tu cuenta."
        text="Elige cómo quieres que te llamemos y mantén tu acceso protegido."
      />
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      {!session ? (
        <Notice>Cargando…</Notice>
      ) : !session.user ? (
        <LoginRequired />
      ) : (
        <>
          <form className="panel" onSubmit={save}>
            <label className="field">
              Nombre o alias
              <input
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              Correo
              <input disabled value={session.user.email} />
            </label>
            <label className="field">
              Nueva contraseña (opcional)
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <Button disabled={busy}>
              {busy ? "Guardando…" : "Guardar cambios"}
            </Button>
          </form>
          {session.user.needsMfa && <Mfa refresh={refresh} />}
          <Notice>
            Los reportes anónimos no se vinculan a tu perfil, aunque tengas una
            sesión iniciada.
          </Notice>
        </>
      )}
    </div>
  );
}
function ArrowUpIcon() {
  return <ArrowRight size={15} />;
}
