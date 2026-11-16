"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  ClipboardList,
  Clock3,
  FileText,
  Filter,
  HeartHandshake,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { api, date, type Session } from "@/lib/client";
import { statuses, type Report, type Resource } from "@/lib/domain";
import { Button, Notice } from "./ui";
import { PageTitle } from "./centinela-app";
import { LoginRequired } from "./user-pages";
import ReportDetail, { StatusBadge, type FullReport } from "./report-detail";
type AdminData = {
  reports: Omit<Report, "token_hash">[];
  staff: { id: string; name: string; role: string }[];
  audit: {
    id: string;
    actor_id: string;
    action: string;
    created_at: string;
    report_id: string | null;
  }[];
  resources: Resource[];
};
const blankResource = {
  name: "",
  description: "",
  phone: "",
  url: "",
  region: "",
  kind: "Orientación",
  published: false,
};
export default function Admin({ session }: { session: Session | null }) {
  const [data, setData] = useState<AdminData | null>(null),
    [tab, setTab] = useState("reports"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [context, setContext] = useState(""),
    [selected, setSelected] = useState<FullReport | null>(null),
    [loading, setLoading] = useState(true),
    [resource, setResource] = useState<Partial<Resource> | null>(null),
    [member, setMember] = useState(""),
    [role, setRole] = useState("staff"),
    [busy, setBusy] = useState(false);
  async function load() {
    setError("");
    try {
      setData(await api<AdminData>("admin"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (session?.user && session.user.role !== "user" && !session.user.needsMfa)
      load();
  }, [session?.user?.id, session?.user?.needsMfa]);
  async function open(id: string) {
    setError("");
    try {
      setSelected((await api<{ report: FullReport }>(`reports/${id}`)).report);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveResource(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("resources", "POST", resource);
      setResource(null);
      setNotice(
        "Recurso guardado. La fecha registra tu revisión del contacto.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveMember(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("team", "PATCH", { email: member, role });
      setMember("");
      setNotice("Permisos del equipo actualizados.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return (
      <div className="page">
        <Notice>Comprobando acceso…</Notice>
      </div>
    );
  if (!session.user) return <LoginRequired />;
  if (session.user.role === "user")
    return (
      <div className="page narrow">
        <PageTitle
          eyebrow="ACCESO RESTRINGIDO"
          title="Esta sección es para el equipo."
          text="Tu cuenta no tiene permisos para consultar reportes de otras personas."
        />
      </div>
    );
  if (session.user.needsMfa)
    return (
      <div className="page narrow">
        <PageTitle
          eyebrow="SEGURIDAD DEL EQUIPO"
          title="Verifica tu segundo factor."
          text="Completa la verificación desde tu cuenta para acceder a los casos."
        />
        <Button asChild>
          <a href="/ingresar">
            Verificar acceso <ShieldCheck size={17} />
          </a>
        </Button>
      </div>
    );
  const isAdmin = session.user.role === "admin";
  const rows = (data?.reports || [])
    .filter(
      (r) =>
        (!status || r.status === status) &&
        (!context || r.reporter === context) &&
        `${r.folio} ${r.categories.join(" ")} ${r.school}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="page admin-page">
      <div className="admin-title-row">
        <PageTitle
          eyebrow="EQUIPO CENTINELA"
          title={
            selected ? "Atención del reporte." : "Cada reporte merece atención."
          }
          text={
            isAdmin
              ? "Revisa, organiza y acompaña los casos desde un solo lugar."
              : "Aquí aparecen únicamente los reportes que tienes asignados."
          }
        />
        <Button variant="outline" onClick={load}>
          <RefreshCw size={16} />
          Actualizar
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {selected ? (
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setSelected(null);
              load();
            }}
          >
            <ArrowLeft size={16} />
            Volver al panel
          </Button>
          <ReportDetail
            key={selected.id}
            report={selected}
            staff
            team={data?.staff}
            admin={isAdmin}
          />
        </>
      ) : (
        <>
          <div className="admin-stats">
            {[
              {
                title: "Reportes registrados",
                n: data?.reports.length || 0,
                icon: ClipboardList,
                color: "lilac",
              },
              {
                title: "Por revisar",
                n:
                  data?.reports.filter((r) => r.status === "Recibido").length ||
                  0,
                icon: Clock3,
                color: "peach",
              },
              {
                title: "En atención",
                n:
                  data?.reports.filter((r) =>
                    ["En revisión", "En atención"].includes(r.status),
                  ).length || 0,
                icon: HeartHandshake,
                color: "sage",
              },
              {
                title: "Casos cerrados",
                n:
                  data?.reports.filter((r) => r.status === "Cerrado").length ||
                  0,
                icon: CheckCheck,
                color: "blue",
              },
            ].map(({ title, n, icon: Icon, color }) => (
              <div className="panel stat-card" key={title}>
                <div>
                  <span>{title}</span>
                  <strong>{n}</strong>
                </div>
                <span className={`quick-icon ${color}`}>
                  <Icon size={21} />
                </span>
              </div>
            ))}
          </div>
          <div className="tab-bar">
            <button
              className={tab === "reports" ? "active" : ""}
              onClick={() => setTab("reports")}
            >
              <FileText size={17} />
              Reportes
            </button>
            {isAdmin && (
              <>
                <button
                  className={tab === "resources" ? "active" : ""}
                  onClick={() => setTab("resources")}
                >
                  <HeartHandshake size={17} />
                  Recursos de ayuda
                </button>
                <button
                  className={tab === "team" ? "active" : ""}
                  onClick={() => setTab("team")}
                >
                  <Users size={17} />
                  Equipo
                </button>
                <button
                  className={tab === "audit" ? "active" : ""}
                  onClick={() => setTab("audit")}
                >
                  <ShieldCheck size={17} />
                  Auditoría
                </button>
              </>
            )}
          </div>
          {loading ? (
            <Notice>Cargando el panel…</Notice>
          ) : tab === "reports" ? (
            <>
              <div className="filter-bar">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    placeholder="Buscar folio, tipo o escuela…"
                    aria-label="Buscar reportes"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filtrar estado"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar contexto"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                >
                  <option value="">Todos los contextos</option>
                  <option value="affected">Persona afectada</option>
                  <option value="witness">Testigo</option>
                  <option value="student">Escolar</option>
                </select>
              </div>
              <div className="panel table-panel">
                <div className="panel-head">
                  <h3>
                    Reportes <span className="count-badge">{rows.length}</span>
                  </h3>
                  <span className="small-text">
                    <LockIcon /> Acceso registrado en auditoría
                  </span>
                </div>
                {rows.length === 0 ? (
                  <div className="empty-state">
                    <ClipboardList size={38} />
                    <h3>No hay reportes que mostrar.</h3>
                    <p>
                      {data?.reports.length
                        ? "Prueba cambiar los filtros."
                        : "Los reportes recibidos aparecerán aquí. No hay casos de ejemplo precargados."}
                    </p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Folio / fecha</th>
                        <th>Situación</th>
                        <th>Privacidad</th>
                        <th>Estado</th>
                        <th>Prioridad</th>
                        <th>Atender</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.folio}</strong>
                            <small>{date(r.created_at)}</small>
                          </td>
                          <td>
                            {r.categories.join(", ")}
                            <small>
                              {r.reporter === "student"
                                ? "Contexto escolar"
                                : r.reporter === "witness"
                                  ? "Testigo"
                                  : "Persona afectada"}
                            </small>
                          </td>
                          <td>{r.anonymous ? "Anónimo" : "Confidencial"}</td>
                          <td>
                            <StatusBadge status={r.status} />
                          </td>
                          <td>
                            <span
                              className={`priority ${r.priority === "Alta" ? "high" : ""}`}
                            >
                              {r.priority}
                            </span>
                          </td>
                          <td>
                            <button
                              className="text-link"
                              onClick={() => open(r.id)}
                            >
                              Abrir <ArrowRight size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <Notice>
                La prioridad se determina mediante valoración humana. El sistema
                no diagnostica ni canaliza automáticamente, y no avisa a las
                escuelas sin revisión del equipo.
              </Notice>
            </>
          ) : tab === "resources" ? (
            <>
              <div className="section-head">
                <h2>Directorio de apoyo</h2>
                <Button onClick={() => setResource({ ...blankResource })}>
                  <Plus size={17} />
                  Agregar recurso
                </Button>
              </div>
              <div className="resource-grid">
                {data?.resources.map((r) => (
                  <div className="panel" key={r.id}>
                    <span className="badge">
                      {r.published ? "Publicado" : "Borrador"}
                    </span>
                    <h3>{r.name}</h3>
                    <p>{r.description}</p>
                    <p>{r.region}</p>
                    <Button variant="outline" onClick={() => setResource(r)}>
                      Editar y revisar
                    </Button>
                  </div>
                ))}
              </div>
              {resource && (
                <form className="panel resource-editor" onSubmit={saveResource}>
                  <div className="panel-head">
                    <h2>{resource.id ? "Editar recurso" : "Nuevo recurso"}</h2>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Cerrar editor"
                      onClick={() => setResource(null)}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  {[
                    ["name", "Nombre"],
                    ["region", "Región"],
                    ["kind", "Tipo de servicio"],
                    ["phone", "Teléfono"],
                    ["url", "Sitio oficial HTTPS"],
                  ].map(([key, label]) => (
                    <label className="field" key={key}>
                      {label}
                      <input
                        type={key === "url" ? "url" : "text"}
                        required={key === "name"}
                        value={String(resource[key as keyof Resource] || "")}
                        onChange={(e) =>
                          setResource({ ...resource, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label className="field">
                    Descripción
                    <textarea
                      required
                      minLength={10}
                      maxLength={1000}
                      value={resource.description || ""}
                      onChange={(e) =>
                        setResource({
                          ...resource,
                          description: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={!!resource.published}
                      onChange={(e) =>
                        setResource({
                          ...resource,
                          published: e.target.checked,
                        })
                      }
                    />
                    Publicar en el directorio
                  </label>
                  <Notice>
                    Al guardar registras que revisaste los datos de este
                    recurso. Confirma el contacto y su disponibilidad en una
                    fuente oficial.
                  </Notice>
                  <Button disabled={busy}>Guardar recurso</Button>
                </form>
              )}
            </>
          ) : tab === "team" ? (
            <>
              <section className="panel">
                <h2>Personal autorizado</h2>
                <p>
                  El personal de atención solo puede consultar casos asignados.
                  La administración puede revisar y asignar todos los casos.
                </p>
                {data?.staff.map((p) => (
                  <div className="team-member" key={p.id}>
                    <span className="avatar">{p.name.charAt(0)}</span>
                    <strong>{p.name}</strong>
                    <span className="badge">
                      {p.role === "admin" ? "Administración" : "Atención"}
                    </span>
                  </div>
                ))}
              </section>
              <form className="panel" onSubmit={saveMember}>
                <h3>Gestionar acceso de atención</h3>
                <p>
                  La persona debe crear su cuenta primero. El acceso real al
                  panel exige segundo factor.
                </p>
                <label className="field">
                  Correo de la cuenta existente
                  <input
                    type="email"
                    required
                    value={member}
                    onChange={(e) => setMember(e.target.value)}
                  />
                </label>
                <label className="field">
                  Permiso
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="staff">Dar acceso de atención</option>
                    <option value="user">Retirar acceso de atención</option>
                  </select>
                </label>
                <Button disabled={busy}>Actualizar permisos</Button>
              </form>
            </>
          ) : (
            <section className="panel table-panel">
              <div className="panel-head">
                <h3>Últimas acciones del equipo</h3>
                <span className="small-text">Hasta 40 entradas</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Persona</th>
                    <th>Acción</th>
                    <th>Referencia del caso</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.audit.map((a) => (
                    <tr key={a.id}>
                      <td>{date(a.created_at)}</td>
                      <td>
                        {data.staff.find((p) => p.id === a.actor_id)?.name ||
                          "Personal autorizado"}
                      </td>
                      <td>
                        <code>{a.action}</code>
                      </td>
                      <td>
                        {a.report_id
                          ? data.reports.find((r) => r.id === a.report_id)
                              ?.folio || "Caso no disponible"
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small-text panel-padding">
                La auditoría registra accesos y operaciones, sin copiar relatos
                ni datos de contacto.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
function LockIcon() {
  return <ShieldCheck size={13} />;
}
