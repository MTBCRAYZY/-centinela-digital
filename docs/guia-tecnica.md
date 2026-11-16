# Guía técnica de Centinela Digital

Aplicación web en español para registrar situaciones de violencia, consultar seguimiento privado y gestionar la atención desde un panel del equipo. Next.js, React, TypeScript, Tailwind CSS, componentes con el patrón de shadcn/ui (Radix Slot + CVA), Lucide y Supabase/PostgreSQL.

## Estado y alcance

Implementados: reportes de personas afectadas, testigos y contexto escolar; modalidad anónima o confidencial; categorías múltiples; formulario por pasos; folio con clave privada; evidencias privadas; mensajes asíncronos de seguimiento; aclaraciones sin sobrescribir el relato; notas internas; asignación, estado y prioridad por valoración humana; evaluación de casos cerrados; cuentas opcionales, recuperación y MFA del equipo; directorio editable; material educativo; novedades dentro de la cuenta y auditoría.

La demostración local funciona con SQLite y datos **exclusivamente ficticios**. La integración de este entorno con Supabase ya se verificó: esquema, Auth, MFA, permisos y almacenamiento privado. La migración inicial ya está aplicada en el proyecto configurado; **no hay que volver a ejecutarla**. La recepción está habilitada en producción por solicitud del equipo. El contacto y el horario se publican en Ayuda y Privacidad. El equipo todavía no dispone de domicilio institucional público y debe completar sus plazos de conservación. Consulta el [protocolo de atención](protocolo-atencion.md).

El seguimiento muestra la fecha de primera apertura por el equipo (consultar el listado no marca un caso como abierto). La evaluación de un caso cerrado permanece visible después de recargar y el equipo puede consultarla; solo quien reportó puede enviarla. Las imágenes JPG/PNG se procesan en el servidor mediante Sharp, con un límite de 20 megapíxeles, sin copiar metadatos ni contenido adicional. Los PDF requieren el servicio de análisis de archivos.

Aplicación: https://centinela-digital-yael-4ef9.vercel.app. El código se mantiene en https://github.com/MTBCRAYZY/-centinela-digital. La integración de GitHub con Vercel está activa: cada cambio en `main` inicia un despliegue automático. El enlace de prueba anterior es independiente de ese despliegue.

La identidad visual utiliza la paleta del segundo entregable y el logotipo original extraído del PDF. Los colores y sus usos están documentados en [Identidad visual](identidad-visual.md) y centralizados en `app/globals.css`.

No hay atención humana por chat en tiempo real, envío automático de correos/SMS, mapas con datos geográficos verificados ni canalización institucional automática. Los mensajes se consultan dentro del seguimiento. Los portales del directorio son referencias oficiales; confirma servicios y horarios. La plataforma no presenta denuncias ante autoridades ni activa emergencias.

## Inicio local

Requiere **Node.js 24** y npm. Trabaja en el checkout existente `/workspace/-centinela-digital`; cada tarea de nube ya está aislada, por lo que no necesitas crear un worktree.

```bash
npm ci --cache /tmp/centinela-npm
cp .env.example .env.local
npm run dev
```

Copia `.env.example` únicamente si `.env.local` todavía no existe; conserva cualquier configuración previa. `DEMO_MODE=true` permite probar la aplicación sin Supabase. La clave de firma de la demo se genera aleatoriamente en `.data/session-key`, fuera de Git. En **Iniciar sesión**, los botones **Entrar como usuario** y **Entrar como equipo** abren perfiles ficticios, sin contraseñas compartidas. Estos accesos se desactivan cuando `DEMO_MODE` no es `true`.

La demo persiste los reportes y archivos en `.data/`, nunca en `public/`. No la despliegues con información real. `.data/`, los archivos `.env`, las dependencias, resultados de pruebas y la compilación están excluidos de Git.

## Conectar Supabase

Proyecto indicado por el equipo: `https://jeoyyjhxxnayisjallpa.supabase.co`. Esta URL es pública, no una contraseña.

1. Ejecuta **una vez** `supabase/migrations/001_centinela.sql` en el SQL Editor del proyecto, o aplícala con Supabase CLI. La migración crea tablas, políticas RLS, funciones restringidas, el bucket privado `evidence` y referencias institucionales iniciales. No contiene usuarios reales ni claves. No la ejecutes sobre un esquema con tablas del mismo nombre sin revisar sus datos y compatibilidad.
2. Introduce los valores en los ajustes seguros del entorno (o en un `.env.local` ignorado en tu propia máquina). Nunca los pegues en incidencias, commits, capturas o chats.

| Variable                        | Uso                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL HTTPS del proyecto.                                                                                                                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave **publicable** o `anon` de Supabase. Es pública; no concede privilegios administrativos.                                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Clave **secreta** o `service_role`. Solo servidor; evita RLS, por eso nunca debe llegar al navegador.                                                              |
| `SESSION_SECRET`                | Valor aleatorio de al menos 32 caracteres para firmar accesos temporales al seguimiento. Se genera fuera del código. No es una clave de Supabase.                  |
| `APP_ORIGIN`                    | Origen exacto de la aplicación, con esquema y puerto si corresponde; sin barra final. Se usa para rechazar solicitudes de otros orígenes.                          |
| `DEMO_MODE`                     | `false` para conectar Supabase.                                                                                                                                    |
| `ACCEPT_REAL_REPORTS`           | `true` habilita la recepción. En producción ya está habilitada por el equipo; el ejemplo local conserva `false`.                                                   |
| `EVIDENCE_SCANNER_URL`          | Servicio de análisis de archivos para habilitar PDF. Las imágenes se reconstruyen en el servidor y no lo requieren. Si se configura, sus fallos bloquean la carga. |
| `TRUST_PROXY`                   | Por defecto desactivado. Activar solo si el despliegue garantiza que reemplaza `X-Forwarded-For`; en otro caso se usa un límite global compartido.                 |

3. En Supabase Auth, configura la URL del sitio y autoriza el destino `${APP_ORIGIN}/cuenta` para confirmaciones y recuperación. Habilita confirmación de correo y TOTP. Configura un proveedor de correo antes de depender del registro y la recuperación. La aplicación no gestiona ni conoce sus credenciales de correo.
4. Crea y confirma una cuenta del equipo. En el SQL Editor, asigna `role = 'admin'` a **su ID concreto de `auth.users`** en `public.profiles`. No incluyas IDs o correos reales en archivos SQL versionados. Las cuentas nuevas siempre reciben `user`; los metadatos enviados por el navegador no pueden otorgar roles.
5. Inicia sesión y configura el autenticador desde la pantalla de acceso. El personal real requiere AAL2 tanto en las rutas como en las políticas de lectura de PostgreSQL. La administración puede dar o retirar `staff` a cuentas existentes; cada integrante solo ve casos asignados.
6. Ejecuta `npm run check:config`. Solo imprime nombres/presencia y códigos HTTP; hace lecturas de configuración de Auth y de existencia del esquema. No imprime claves ni crea cuentas o reportes.
7. Cambia a `DEMO_MODE=false`, reinicia la aplicación y repite un recorrido con datos ficticios en Supabase antes de habilitar recepción real.

Los ajustes de la nube son un borrador separado del proceso en ejecución. Guardarlos no garantiza que ya estén inyectados; aplica/publica mediante el producto cuando corresponda y vuelve a ejecutar la comprobación. Los comandos de arranque usan el soporte de proxy de Node 24 para respetar el proxy HTTPS y las credenciales inyectadas por la plataforma.

### Servicio de análisis de evidencias

Cuando se configura `EVIDENCE_SCANNER_URL`, la aplicación envía `POST` con el archivo como `application/octet-stream` a ese servicio antes de aceptarlo. El servicio debe ser controlado por la institución, tener análisis antimalware real y responder con HTTP 2xx y JSON `{ "clean": true }` únicamente si lo comprobó. Un error, timeout o cualquier otra respuesta bloquea la carga. No uses un endpoint que devuelva éxito fijo. La demo utiliza el mismo procesamiento de imágenes y rechaza los PDF si falta el analizador; utiliza únicamente datos ficticios.

Se permiten JPG y PNG de hasta **4 MB** y 20 megapíxeles; los PDF se admiten solo si existe un analizador configurado. Máximo 5 archivos por reporte. El límite deja espacio para la solicitud multipart dentro de los 4.5 MB permitidos por Vercel. El bucket original admite hasta 5 MB; la API aplica el límite menor sin requerir otra migración. Se comprueba la firma del contenido, se usan rutas aleatorias y se fuerzan descargas como adjuntos. No se publica el bucket ni se exponen rutas internas. Las imágenes se reconstruyen sin EXIF, XMP ni metadatos de ubicación. Las copias almacenadas pueden diferir de los originales; se informa a la persona para que conserve los originales. Los PDF aprobados por el analizador se conservan sin transformar. La política de retención debe contemplar también archivos, copias de seguridad y posibles análisis de terceros.

## Comprobaciones

```bash
npm run typecheck
npm run test:unit
npm run build
npm run start
# En otra terminal, con el servidor anterior en ejecución:
npm test
```

`npm test` requiere Chromium; por defecto usa `/usr/bin/chromium`. Si está en otra ubicación, define `CHROMIUM_PATH`. Las pruebas de navegador y API **solo se deben ejecutar en la demo**: crean reportes y cuentas ficticias. `test:unit` usa PostgreSQL embebido (PGlite) para ejecutar la migración y comprobar RLS, acceso por asignación, MFA, privilegios de funciones y ocultación de notas internas. Esto no sustituye pruebas de Auth/Storage contra un proyecto de Supabase real.

Los tests de seguridad también verifican firmas, caducidad, hashes y exportación/importación de borradores AES-GCM con PBKDF2. Los recorridos comprueban el formulario, seguimiento, adjuntos privados, permisos y uso móvil. Las pruebas generan claves al ejecutarse; no hay contraseñas privadas versionadas.

## Protección de datos y operación

- Rutas de servidor con autorización por cada caso. El navegador no decide los permisos y nunca recibe la clave privilegiada.
- Sesiones HttpOnly/SameSite; cookies Secure en producción; verificación de origen para mutaciones. CSP con nonce, sin `unsafe-eval` en producción; sin analítica ni carga de fuentes externas.
- Los reportes anónimos tienen `owner_id = null` incluso con sesión iniciada. La clave de consulta es aleatoria de 256 bits y solo se conserva su hash. El acceso concede una cookie de 30 minutos; la clave no va en URL ni logs. No se puede recuperar una clave anónima perdida.
- Contactos separados del relato. Las notas internas nunca se incluyen en la respuesta de seguimiento de la persona. Los cambios de estado y prioridad los decide una persona del equipo.
- No hay autoguardado de relatos en localStorage. Se pueden descargar borradores cifrados con contraseña por decisión explícita. Descargar deja un archivo en el dispositivo.
- La salida rápida intenta cerrar la sesión y cambia de página. No borra historial, descargas ni otras copias; no se presenta como protección absoluta.
- Los registros de auditoría guardan acciones y referencias, sin duplicar relatos ni datos de contacto. El servidor evita imprimir solicitudes, claves y contenido de archivos.
- El equipo publicó su nombre, correo y horario, y dispone de un protocolo de atención y solicitudes sobre datos. No cuenta todavía con domicilio institucional público ni purga automática por plazo. Debe completar esos datos, definir conservación y eliminación, revisar sus obligaciones legales y validar respaldos. No remitir automáticamente casos a una escuela que podría estar involucrada.
- La demostración y las pruebas no validan un nivel de servicio ni tiempos de respuesta. Para un volumen grande, agregar paginación de interfaz y métricas operativas sin datos sensibles.

## Estructura

- `app/`: rutas, estilos, layout y API.
- `components/`: interfaz pública, formulario, cuenta, seguimiento y panel.
- `lib/domain.ts`: esquema de entrada y tipos compartidos.
- `lib/backend.ts`: acceso a Supabase, demo, identidad y límites persistentes.
- `lib/security.ts`, `lib/drafts.ts`: firmas, hashes, archivos y borradores cifrados.
- `supabase/migrations/`: esquema versionado y permisos.
- `tests/`: recorridos y verificaciones de seguridad.
- `.env.example`: nombres de variables, sin secretos.

No se incluyen servicios externos que no hayan sido conectados como si funcionaran. La publicación del entorno o de la aplicación es un paso separado de guardar este código.
