import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  other: "00000000-0000-4000-8000-000000000002",
  staff: "00000000-0000-4000-8000-000000000003",
  admin: "00000000-0000-4000-8000-000000000004",
  report: "00000000-0000-4000-8000-000000000005",
};
test("migración PostgreSQL y RLS: propietarios, personal asignado, MFA y notas internas", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub' $$;
 `.replace(
        "select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'",
        "select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid",
      ),
    );
    await db.exec(
      `create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/001_centinela.sql", import.meta.url),
        "utf8",
      ),
    );
    for (const [name, id] of Object.entries(ids).filter(
      ([k]) => k !== "report",
    ))
      await db.query("insert into auth.users values($1,$2,$3)", [
        id,
        `${name}@example.test`,
        JSON.stringify({ name, role: "admin" }),
      ]);
    assert.equal(
      (
        await db.query<{ role: string }>(
          "select role from profiles where id=$1",
          [ids.owner],
        )
      ).rows[0].role,
      "user",
      "User metadata must never grant admin",
    );
    await db.query("update profiles set role='staff' where id=$1", [ids.staff]);
    await db.query("update profiles set role='admin' where id=$1", [ids.admin]);
    const report = {
      id: ids.report,
      folio: "CD-TEST",
      owner_id: ids.owner,
      reporter: "student",
      categories: ["Digital"],
      description: "Relato ficticio de prueba con longitud suficiente.",
      location: "",
      occurred_at: "",
      school: "",
      recurring: false,
      witnesses: false,
      anonymous: false,
      status: "Recibido",
      priority: "Por valorar",
      assignee_id: ids.staff,
      token_hash: "hash-not-secret",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const update = {
      id: "00000000-0000-4000-8000-000000000006",
      report_id: ids.report,
      author_id: null,
      body: "Mensaje público ficticio",
      kind: "public",
      created_at: new Date().toISOString(),
    };
    await db.query("select create_report_bundle($1,$2,$3)", [
      JSON.stringify(report),
      null,
      JSON.stringify(update),
    ]);
    await db.exec(
      `insert into updates values('00000000-0000-4000-8000-000000000007','${ids.report}',null,'Nota interna ficticia','internal',now());`,
    );
    const as = async (id: string, aal = "aal1") => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: id, aal }),
      ]);
      await db.exec("set role authenticated");
    };
    await as(ids.owner);
    assert.equal((await db.query("select * from reports")).rows.length, 1);
    assert.equal((await db.query("select * from updates")).rows.length, 1);
    await assert.rejects(() => db.exec("update profiles set role='admin'"));
    await assert.rejects(() => db.exec("select * from rate_limits"));
    await as(ids.other);
    assert.equal((await db.query("select * from reports")).rows.length, 0);
    await as(ids.staff);
    assert.equal(
      (await db.query("select * from reports")).rows.length,
      0,
      "Staff needs MFA",
    );
    await as(ids.staff, "aal2");
    assert.equal((await db.query("select * from reports")).rows.length, 1);
    assert.equal((await db.query("select * from updates")).rows.length, 2);
    await as(ids.admin, "aal2");
    assert.equal((await db.query("select * from reports")).rows.length, 1);
    await db.exec("reset role;set role anon");
    assert.equal((await db.query("select * from resources")).rows.length, 3);
    await assert.rejects(() => db.exec("select * from reports"));
    await assert.rejects(() => db.exec("select consume_rate_limit('x',1,60)"));
    await db.exec("reset role;set role service_role");
    assert.equal(
      (
        await db.query<{ consume_rate_limit: boolean }>(
          "select consume_rate_limit('test',1,60)",
        )
      ).rows[0].consume_rate_limit,
      true,
    );
    assert.equal(
      (
        await db.query<{ consume_rate_limit: boolean }>(
          "select consume_rate_limit('test',1,60)",
        )
      ).rows[0].consume_rate_limit,
      false,
    );
  } finally {
    await db.close();
  }
});
