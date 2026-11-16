import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { hashPassword, sign, unsign } from "./security";
import { starterResources, type Tables, type Profile } from "./domain";
export const demo = process.env.DEMO_MODE === "true";
export const dataDir = path.join(process.cwd(), ".data");
let local: DatabaseSync | undefined;
export function db() {
  if (!demo) throw new Error("Demo disabled");
  if (!local) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    local = new DatabaseSync(path.join(dataDir, "demo.sqlite"));
    local.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (table_name TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(table_name,id)); CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);",
    );
    const put = (t: string, v: { id: string }) =>
      local!
        .prepare("INSERT OR IGNORE INTO records VALUES(?,?,?)")
        .run(t, v.id, JSON.stringify(v));
    for (const [email, name, role] of [
      ["equipo@demo.local", "Equipo Centinela", "admin"],
      ["persona@demo.local", "Persona de prueba", "user"],
    ])
      put("profiles", {
        id: email,
        email,
        name,
        role,
        password_hash: hashPassword(randomBytes(32).toString("hex")),
        created_at: new Date().toISOString(),
      } as Profile);
    starterResources.forEach((v) => put("resources", v));
  }
  return local;
}
export function secret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32)
    return process.env.SESSION_SECRET;
  if (!demo) throw new Error("SESSION_SECRET must have at least 32 characters");
  db();
  const p = path.join(dataDir, "session-key");
  if (!existsSync(p))
    writeFileSync(p, randomBytes(48).toString("hex"), { mode: 0o600 });
  return readFileSync(p, "utf8");
}
export function service() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new Error("Supabase no está configurado.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function authClient() {
  const jar = await cookies();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    throw new Error("Supabase no está configurado.");
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) =>
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, {
              ...options,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              httpOnly: true,
            }),
          ),
      },
    },
  );
}
export async function all<K extends keyof Tables>(
  table: K,
  filters: Record<string, unknown> = {},
): Promise<Tables[K][]> {
  if (demo)
    return (
      db()
        .prepare("SELECT data FROM records WHERE table_name=?")
        .all(table) as { data: string }[]
    )
      .map((v) => JSON.parse(v.data))
      .filter((v) => Object.entries(filters).every(([k, val]) => v[k] === val));
  const rows: Tables[K][] = [];
  for (let start = 0; ; start += 1000) {
    let query = service().from(table).select("*");
    for (const [k, v] of Object.entries(filters))
      query = v === null ? query.is(k, null) : query.eq(k, v);
    const { data, error } = await query.order("id").range(start, start + 999);
    if (error) throw error;
    rows.push(...(data as Tables[K][]));
    if (data.length < 1000) break;
  }
  return rows;
}
export async function insert<K extends keyof Tables>(
  table: K,
  value: Tables[K],
) {
  if (demo) {
    db()
      .prepare("INSERT INTO records VALUES(?,?,?)")
      .run(table, value.id, JSON.stringify(value));
    return;
  }
  const { error } = await service().from(table).insert(value);
  if (error) throw error;
}
export async function patch<K extends keyof Tables>(
  table: K,
  id: string,
  value: Partial<Tables[K]>,
) {
  if (demo) {
    const old = (await all(table, { id }))[0];
    if (!old) throw new Error("Not found");
    db()
      .prepare("UPDATE records SET data=? WHERE table_name=? AND id=?")
      .run(JSON.stringify({ ...old, ...value }), table, id);
    return;
  }
  const update: Record<string, unknown> = { ...value };
  const { error } = await service().from(table).update(update).eq("id", id);
  if (error) throw error;
}
export async function remove<K extends keyof Tables>(table: K, id: string) {
  if (demo) {
    db()
      .prepare("DELETE FROM records WHERE table_name=? AND id=?")
      .run(table, id);
    return;
  }
  const { error } = await service().from(table).delete().eq("id", id);
  if (error) throw error;
}
export async function identity(): Promise<{
  profile: Profile;
  aal: string;
} | null> {
  if (demo) {
    const token = (await cookies()).get("cd_session")?.value;
    const session = unsign<{ id: string; exp: number }>(token, secret());
    if (!session) return null;
    const profile = (await all("profiles", { id: session.id }))[0];
    return profile ? { profile, aal: "demo" } : null;
  }
  const supabase = await authClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = (await all("profiles", { id: user.id }))[0];
  if (!profile) return null;
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { profile, aal: data?.currentLevel || "aal1" };
}
export async function setSession(id: string) {
  (await cookies()).set(
    "cd_session",
    sign({ id, exp: Date.now() + 8 * 3600000 }, secret()),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 3600,
    },
  );
}
export async function grantReport(id: string) {
  (await cookies()).set(
    "cd_report",
    sign({ id, exp: Date.now() + 30 * 60000 }, secret()),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 1800,
    },
  );
}
export async function reportGrant() {
  return unsign<{ id: string; exp: number }>(
    (await cookies()).get("cd_report")?.value,
    secret(),
  )?.id;
}
export async function audit(
  actor: string,
  report: string | null,
  action: string,
) {
  await insert("audit", {
    id: randomUUID(),
    actor_id: actor,
    report_id: report,
    action,
    created_at: new Date().toISOString(),
  });
}
export async function limit(key: string, max: number, seconds: number) {
  if (demo) {
    const now = Date.now();
    db().prepare("DELETE FROM limits WHERE reset<?").run(now);
    db()
      .prepare(
        "INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
      )
      .run(key, now + seconds * 1000);
    const value = db()
      .prepare("SELECT count FROM limits WHERE key=?")
      .get(key) as { count: number };
    return value.count <= max;
  }
  const { data, error } = await service().rpc("consume_rate_limit", {
    bucket: key,
    max_count: max,
    window_seconds: seconds,
  });
  if (error) throw error;
  return data === true;
}
