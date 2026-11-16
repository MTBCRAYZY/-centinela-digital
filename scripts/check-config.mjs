import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
  "APP_ORIGIN",
];
let missing = false;
for (const name of names) {
  const set = !!process.env[name];
  console.log(`${name}: ${set ? "presente" : "falta"}`);
  missing ||= !set;
}
if (missing) {
  process.exitCode = 1;
  console.log(
    "Introduce los valores en ajustes seguros; no los envíes por chat ni los guardes en Git.",
  );
} else {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (new URL(base).protocol !== "https:") throw new Error("url");
    if (process.env.SESSION_SECRET.length < 32) throw new Error("session");
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // This check only reads settings/schema. It never creates accounts or reports.
    const auth = await fetch(`${base}/auth/v1/settings`, {
      headers: { apikey: publicKey },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`Autenticación pública: HTTP ${auth.status}`);
    const database = await fetch(`${base}/rest/v1/profiles?select=id&limit=0`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`Acceso del servidor y esquema: HTTP ${database.status}`);
    if (!auth.ok || !database.ok) process.exitCode = 1;
  } catch {
    console.log(
      "No se pudo verificar la configuración. Revisa la URL, SESSION_SECRET, la red y la aplicación de la migración. No se han impreso valores privados.",
    );
    process.exitCode = 1;
  }
}
