"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  House,
  FilePlus2,
  Search,
  BookOpen,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  ArrowUpRight,
  ArrowRight,
  LockKeyhole,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Phone,
  Check,
  EyeOff,
  Heart,
  Users,
  MessagesSquare,
  UserRound,
  Bell,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { api, type Session } from "@/lib/client";
import { education, type Resource } from "@/lib/domain";
import { Button, Notice } from "./ui";
import ReportWizard from "./report-wizard";
import { Tracking, MyReports, Account, Login } from "./user-pages";
import Admin from "./admin";
const nav = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/reportar", label: "Crear un reporte", icon: FilePlus2 },
  { href: "/seguimiento", label: "Dar seguimiento", icon: Search },
  { href: "/informacion", label: "Conoce la violencia", icon: BookOpen },
  { href: "/estudiantes", label: "Espacio estudiantil", icon: GraduationCap },
  { href: "/ayuda", label: "Encontrar ayuda", icon: HeartHandshake },
];
export default function CentinelaApp() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false);
  const refresh = () =>
    api<Session>("session")
      .then(setSession)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  async function logout() {
    try {
      await api("auth/logout", "POST");
      await refresh();
      location.assign("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function exit() {
    navigator.sendBeacon("/api/auth/logout");
    location.replace("https://www.google.com");
  }
  let content: ReactNode;
  if (pathname === "/") content = <Home />;
  else if (pathname === "/reportar")
    content = <ReportWizard session={session} />;
  else if (pathname === "/seguimiento") content = <Tracking />;
  else if (pathname === "/informacion") content = <Information />;
  else if (pathname === "/estudiantes") content = <Students />;
  else if (pathname === "/ayuda") content = <Resources />;
  else if (pathname === "/ingresar")
    content = <Login session={session} refresh={refresh} />;
  else if (pathname === "/mis-reportes" || pathname === "/notificaciones")
    content = (
      <MyReports
        session={session}
        notifications={pathname === "/notificaciones"}
      />
    );
  else if (pathname === "/cuenta")
    content = <Account session={session} refresh={refresh} />;
  else if (pathname === "/equipo") content = <Admin session={session} />;
  else if (pathname === "/privacidad" || pathname === "/terminos")
    content = (
      <Privacy terms={pathname === "/terminos"} demo={session?.demo ?? true} />
    );
  else
    content = (
      <div className="page">
        <PageTitle
          eyebrow="CENTINELA DIGITAL"
          title="Esta página no está disponible."
          text="Puedes volver al inicio para encontrar lo que buscas."
        />
        <Button asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    );
  return (
    <div className="app-shell">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link href="/" className="brand">
          <span className="brand-mark">
            <ShieldCheck size={27} />
          </span>
          <span>
            centinela
            <span className="brand-digital">
              digital<span className="brand-dot">.</span>
            </span>
          </span>
        </Link>
        <div className="sidebar-label">TU ESPACIO SEGURO</div>
        <nav aria-label="Navegación principal">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`nav-link ${pathname === href ? "active" : ""}`}
            >
              <Icon size={19} />
              {label}
              {pathname === href && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        {session?.user && (
          <>
            <div className="sidebar-label">MI ESPACIO</div>
            <nav aria-label="Mi cuenta">
              <Link
                className={`nav-link ${pathname === "/mis-reportes" ? "active" : ""}`}
                href="/mis-reportes"
              >
                <FilePlus2 size={19} />
                Mis reportes
              </Link>
              <Link
                className={`nav-link ${pathname === "/notificaciones" ? "active" : ""}`}
                href="/notificaciones"
              >
                <Bell size={19} />
                Notificaciones
              </Link>
              <Link className="nav-link" href="/cuenta">
                <UserRound size={19} />
                Mi cuenta
              </Link>
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="support-note">
            <span className="mini-icon">
              <Heart size={19} />
            </span>
            <strong>
              No tienes que vivirlo
              <br />
              en soledad.
            </strong>
            <p>
              Pedir ayuda también es una
              <br />
              forma de cuidarte.
            </p>
            <Link href="/ayuda">
              Conoce tus opciones <ArrowUpRight size={15} />
            </Link>
          </div>
          <Link
            href="/equipo"
            className={`nav-link team-link ${pathname === "/equipo" ? "active" : ""}`}
          >
            <LayoutDashboard size={18} />
            Acceso del equipo <ArrowUpRight size={15} />
          </Link>
          <div className="sidebar-foot">
            <ShieldCheck size={13} /> Hecho para acompañarte
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="menu-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <span className="availability-dot" />
            <span>Un espacio para ser escuchado</span>
          </div>
          <div className="topbar-actions">
            {session?.user ? (
              <>
                <Link href="/cuenta" className="account-chip">
                  <span>{session.user.name.charAt(0)}</span>
                  <span className="account-name">{session.user.name}</span>
                </Link>
                <button
                  className="icon-button"
                  onClick={logout}
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="login-link" href="/ingresar">
                Iniciar sesión <UserRound size={16} />
              </Link>
            )}
            <button className="exit-button" onClick={exit}>
              <LogOut size={16} /> Salida rápida <span>↗</span>
            </button>
          </div>
        </header>
        {session?.demo && (
          <div className="demo-strip">
            <span className="demo-pill">DEMOSTRACIÓN</span> Usa únicamente datos
            ficticios. Los reportes de prueba no reciben atención real.
          </div>
        )}
        {session && !session.demo && !session.accepting && (
          <Notice>
            La recepción de reportes reales aún no está habilitada.
          </Notice>
        )}
        <main id="contenido">
          {error && (
            <div className="page">
              <Notice tone="error">
                {error} <button onClick={refresh}>Reintentar</button>
              </Notice>
            </div>
          )}
          {content}
        </main>
        <footer className="footer">
          <span>
            © {new Date().getFullYear()} Centinela Digital{" "}
            <span className="footer-separator">·</span> Tu voz importa.
          </span>
          <div>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/terminos">Términos de uso</Link>
            <Link href="/ayuda">Ayuda</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div className="eyebrow">
        <span />
        {eyebrow}
      </div>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
function Home() {
  return (
    <div className="page home-page">
      <div className="welcome-line">
        <span>ESTAMOS CONTIGO</span>
        <span>
          <LockKeyhole size={13} /> Tu privacidad es nuestra prioridad
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-tag">
            <span /> UN PRIMER PASO PUEDE CAMBIARLO TODO
          </div>
          <h1>
            Tu voz importa.
            <br />
            Tu seguridad,
            <br />
            <em>también.</em>
          </h1>
          <p>
            Un espacio para hablar de lo que estás viviendo,
            <br className="desktop-break" /> encontrar orientación y dar el
            siguiente paso.
            <br className="desktop-break" /> A tu ritmo, sin juicios.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/reportar">
                Quiero hacer un reporte <ArrowUpRight size={18} />
              </Link>
            </Button>
            <Link className="text-link" href="/ayuda">
              Necesito orientación <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero-trust">
            <span>
              <EyeOff size={15} /> Reporte anónimo opcional
            </span>
            <span>
              <LockKeyhole size={15} /> Acceso restringido
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-orbit orbit-three" />
          <span className="art-spark spark-one">✳</span>
          <span className="art-spark spark-two">✦</span>
          <div className="art-shield">
            <ShieldCheck strokeWidth={1.1} />
            <span>
              Un espacio
              <br />
              <strong>para ti.</strong>
            </span>
          </div>
          <div className="art-note">
            <span>
              <Heart size={17} />
            </span>{" "}
            Aquí, tu historia cuenta.
          </div>
          <span className="art-dot dot-one" />
          <span className="art-dot dot-two" />
        </div>
      </section>
      <section className="quick-grid" aria-label="Accesos rápidos">
        <QuickCard
          icon={<FilePlus2 />}
          title="Haz un reporte"
          text="Cuéntanos lo que sucede, con o sin tus datos."
          href="/reportar"
          color="lilac"
        />
        <QuickCard
          icon={<Search />}
          title="Consulta tu seguimiento"
          text="Conoce los avances de tu reporte de forma privada."
          href="/seguimiento"
          color="peach"
        />
        <QuickCard
          icon={<HeartHandshake />}
          title="Encuentra apoyo"
          text="Explora recursos y opciones para pedir ayuda."
          href="/ayuda"
          color="sage"
        />
      </section>
      <section className="home-section">
        <div className="section-head">
          <div>
            <div className="eyebrow">INFORMARTE TAMBIÉN ES CUIDARTE</div>
            <h2>Reconocerlo es el primer paso.</h2>
            <p>La violencia tiene distintas formas. Ninguna es tu culpa.</p>
          </div>
          <Link className="text-link" href="/informacion">
            Conoce todos los tipos <ArrowRight size={16} />
          </Link>
        </div>
        <div className="education-grid">
          {education.slice(0, 4).map((v, i) => (
            <Link
              href={`/informacion#${v.name}`}
              className="education-card"
              key={v.name}
            >
              <span className={`category-icon c-${i}`}>
                {
                  [
                    <Heart key="h" />,
                    <ShieldCheck key="s" />,
                    <Users key="u" />,
                    <LockKeyhole key="l" />,
                  ][i]
                }
              </span>
              <h3>Violencia {v.name.toLowerCase()}</h3>
              <p>{v.text}</p>
              <span className="learn-link">
                Conocer más <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="student-banner">
        <div className="student-illustration">
          <GraduationCap size={58} strokeWidth={1.3} />
          <span>✦</span>
        </div>
        <div>
          <div className="eyebrow">
            TU ESCUELA TAMBIÉN DEBE SER UN LUGAR SEGURO
          </div>
          <h2>Un espacio para estudiantes.</h2>
          <p>
            Si vives o presencias violencia en tu escuela, puedes hablar.
            <br />
            Estamos aquí para orientarte, sin importar quién esté involucrado.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/estudiantes">
            Ir al espacio estudiantil <ArrowUpRight size={17} />
          </Link>
        </Button>
      </section>
      <section className="home-section how-section">
        <div>
          <div className="eyebrow">TÚ DECIDES CÓMO EMPEZAR</div>
          <h2>Un paso a la vez.</h2>
          <p>
            No necesitas tener todas las respuestas.
            <br />
            Puedes empezar por contarnos lo que sabes.
          </p>
        </div>
        <div className="steps-inline">
          {[
            ["01", "Cuéntanos", "Describe la situación a tu ritmo."],
            ["02", "Elige tu privacidad", "Decide qué datos compartir."],
            [
              "03",
              "Consulta los avances",
              "Conserva tu folio y clave privada.",
            ],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>
      <Emergency />
    </div>
  );
}
function QuickCard({
  icon,
  title,
  text,
  href,
  color,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href} className="quick-card">
      <span className={`quick-icon ${color}`}>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <ArrowUpRight size={19} />
    </Link>
  );
}
export function Emergency() {
  return (
    <div className="emergency">
      <div className="emergency-icon">
        <Phone size={20} />
      </div>
      <div>
        <strong>¿Estás en peligro inmediato?</strong>
        <p>
          En México, llama al <a href="tel:911">911</a>. Esta plataforma no es
          un servicio de emergencias.
        </p>
      </div>
      <a className="emergency-call" href="tel:911">
        Llamar al 911 <ArrowUpRight size={16} />
      </a>
    </div>
  );
}
function Information() {
  return (
    <div className="page">
      <PageTitle
        eyebrow="CONOCER PARA RECONOCER"
        title="La violencia no siempre se ve."
        text="Reconocer una situación puede ser difícil. Estas señales pueden ayudarte a ponerle nombre a lo que sucede."
      />
      <div className="info-grid">
        {education.map((v, i) => (
          <article className="panel info-card" id={v.name} key={v.name}>
            <span className={`category-icon c-${i % 4}`}>
              <ShieldCheck />
            </span>
            <h2>Violencia {v.name.toLowerCase()}</h2>
            <p>{v.text}</p>
            <h3>Algunas señales</h3>
            <p>{v.signs}</p>
            <div className="help-tip">
              <Heart size={18} />
              <p>{v.action}</p>
            </div>
          </article>
        ))}
      </div>
      <Notice>
        Una situación puede incluir varios tipos de violencia. No necesitas
        identificar una categoría con exactitud para buscar orientación.
      </Notice>
      <Button asChild>
        <Link href="/reportar">
          Quiero reportar una situación <ArrowRight size={17} />
        </Link>
      </Button>
      <Emergency />
    </div>
  );
}
function Students() {
  return (
    <div className="page">
      <PageTitle
        eyebrow="ESPACIO ESTUDIANTIL"
        title="Tu escuela debe ser un lugar seguro."
        text="Puedes reportar lo que te pasa o una situación que presencias, aunque involucre a compañeros, docentes u otras personas."
      />
      <div className="student-hero panel">
        <GraduationCap size={75} strokeWidth={1.2} />
        <div>
          <h2>No tienes que enfrentarlo a solas.</h2>
          <p>
            Hablar puede ser el primer paso. No necesitas una cuenta escolar ni
            compartir tu nombre para enviar un reporte.
          </p>
          <Button asChild>
            <Link href="/reportar?context=student">
              Crear un reporte escolar <ArrowUpRight size={17} />
            </Link>
          </Button>
        </div>
      </div>
      <div className="three-grid">
        {[
          [
            "Acoso entre estudiantes",
            "Burlas, exclusión, amenazas, golpes o difusión de rumores.",
          ],
          [
            "Violencia de una persona adulta",
            "Intimidación, comentarios sexuales, castigos humillantes o abuso de autoridad.",
          ],
          [
            "También puedes ser testigo",
            "Si viste una situación, cuenta lo que observaste sin investigar ni ponerte en riesgo.",
          ],
        ].map(([t, d]) => (
          <article className="panel" key={t}>
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
      </div>
      <Notice>
        Tu reporte no se enviará automáticamente a la escuela. La canalización
        requiere una revisión del equipo y un protocolo de protección,
        especialmente si hay menores de edad.
      </Notice>
      <section className="panel">
        <h2>Antes de reportar</h2>
        <ul className="check-list">
          <li>
            <Check />
            Usa un dispositivo seguro si alguien supervisa tu actividad.
          </li>
          <li>
            <Check />
            No necesitas confrontar a la persona ni conseguir pruebas.
          </li>
          <li>
            <Check />
            Evita incluir nombres de otros estudiantes si no son necesarios.
          </li>
          <li>
            <Check />
            Si puedes hacerlo con seguridad, busca a una persona adulta de
            confianza.
          </li>
        </ul>
      </section>
      <Emergency />
    </div>
  );
}
export function Resources() {
  const [resources, setResources] = useState<Resource[]>([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ resources: Resource[] }>("resources")
      .then((v) => setResources(v.resources))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="page">
      <PageTitle
        eyebrow="REDES DE APOYO"
        title="Hay opciones para pedir ayuda."
        text="Encuentra orientación y consulta fuentes institucionales. Confirma los horarios y la disponibilidad directamente con cada servicio."
      />
      <Emergency />
      <label className="search-box">
        <Search size={19} />
        <input
          aria-label="Buscar recursos"
          placeholder="Buscar por servicio, institución o región…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="resource-grid">
        {resources
          .filter((v) =>
            `${v.name} ${v.description} ${v.region}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((r) => (
            <article className="panel resource-card" key={r.id}>
              <div className="resource-top">
                <span className="quick-icon sage">
                  <HeartHandshake />
                </span>
                <span className="badge">{r.kind}</span>
              </div>
              <h2>{r.name}</h2>
              <p>{r.description}</p>
              <div className="resource-region">
                <MapPin size={15} />
                {r.region}
              </div>
              <small>
                {r.verified_at
                  ? `Revisión registrada: ${new Date(r.verified_at).toLocaleDateString("es-MX")}`
                  : "Consulta el portal oficial para confirmar los datos vigentes."}
              </small>
              <div className="resource-actions">
                {r.phone && (
                  <Button variant="outline" asChild>
                    <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>
                      <Phone size={16} />
                      {r.phone}
                    </a>
                  </Button>
                )}
                {r.url && (
                  <a
                    className="text-link"
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sitio oficial <ExternalLink size={15} />
                  </a>
                )}
              </div>
            </article>
          ))}
      </div>
      {resources.length > 0 &&
        !resources.some((v) =>
          `${v.name} ${v.description} ${v.region}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        ) && (
          <Notice>No encontramos coincidencias. Prueba otro término.</Notice>
        )}
      <section className="panel">
        <h2>Ayuda para usar Centinela</h2>
        <details>
          <summary>¿Necesito una cuenta para reportar?</summary>
          <p>
            No. Puedes crear un reporte sin cuenta y consultar el seguimiento
            con tu folio y clave privada.
          </p>
        </details>
        <details>
          <summary>¿Mi reporte es una denuncia formal?</summary>
          <p>
            No. Es un registro dentro de la plataforma. Una denuncia formal debe
            presentarse por los canales de la autoridad competente.
          </p>
        </details>
        <details>
          <summary>¿Cómo recupero una clave de seguimiento?</summary>
          <p>
            Por privacidad, una clave anónima perdida no se recupera mediante
            datos personales. Consérvala en un lugar seguro. Los reportes
            identificados vinculados a tu cuenta siguen disponibles en “Mis
            reportes”.
          </p>
        </details>
        <details>
          <summary>¿Puedo hablar por chat?</summary>
          <p>
            No hay atención humana por chat disponible en esta versión. Puedes
            escribir dentro del seguimiento de tu reporte; las respuestas son
            asíncronas. Para una emergencia, llama al 911.
          </p>
        </details>
      </section>
    </div>
  );
}
function Privacy({ terms, demo }: { terms: boolean; demo: boolean }) {
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow="CLARIDAD Y CONFIANZA"
        title={terms ? "Términos de uso" : "Tu privacidad importa."}
        text="Información sobre el alcance del servicio y el tratamiento de los datos."
      />
      <article className="panel prose">
        {demo && (
          <Notice>
            Esta es una demostración académica. Usa exclusivamente información
            ficticia.
          </Notice>
        )}
        <h2>Alcance de la plataforma</h2>
        <p>
          Centinela Digital permite registrar situaciones y consultar respuestas
          del equipo. No sustituye servicios de emergencia, atención profesional
          ni la presentación de una denuncia ante una autoridad. No garantiza
          tiempos de respuesta ni atención permanente.
        </p>
        <h2>Qué datos se solicitan</h2>
        <p>
          Descripción de los hechos, categorías, contexto, fecha y lugar
          aproximados. El contacto y las evidencias son opcionales. No se
          solicita identificación oficial. No publiques datos de terceros que no
          sean necesarios.
        </p>
        <h2>Anónimo o confidencial</h2>
        <p>
          Un reporte anónimo no se vincula a una cuenta ni requiere nombre o
          contacto. Aun así, el relato, la ubicación o los archivos pueden
          identificarte. Los proveedores de infraestructura pueden procesar
          metadatos técnicos. No se promete anonimato absoluto.
        </p>
        <h2>Acceso y contacto</h2>
        <p>
          El equipo autorizado puede acceder a los casos según su rol y
          asignación. Las notas internas no se muestran a quien reporta. La
          autorización para contacto es independiente de la aceptación de este
          aviso. No se envían avisos externos en esta versión; las novedades se
          consultan dentro del seguimiento.
        </p>
        <h2>Dispositivos compartidos</h2>
        <p>
          La salida rápida abre una página externa e intenta cerrar la sesión.
          No borra el historial, los archivos descargados ni las copias del
          dispositivo. Los borradores se exportan cifrados únicamente cuando tú
          lo solicitas.
        </p>
        <h2>Antes de recibir casos reales</h2>
        <p>
          La institución operadora debe completar y publicar su aviso de
          privacidad: identidad y domicilio del responsable, finalidades,
          fundamento aplicable, derechos ARCO y contacto para ejercerlos,
          transferencias, plazos de conservación y eliminación. También debe
          aprobar los protocolos de atención a menores y de canalización. Este
          texto provisional no sustituye ese aviso.
        </p>
        <h2>Uso responsable</h2>
        <p>
          No compartas tus claves ni accedas a casos ajenos. Las evidencias
          deben corresponder al reporte y no contener programas ejecutables. El
          equipo debe tratar los relatos con respeto y sin juicios.
        </p>
        <Link className="text-link" href="/ayuda">
          Consultar opciones de ayuda <ChevronRight size={16} />
        </Link>
      </article>
    </div>
  );
}
