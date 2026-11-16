-- Run once using the Supabase SQL editor or `supabase db push`.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, name text not null default 'Usuario',
 role text not null default 'user' check(role in ('user','staff','admin')),
 created_at timestamptz not null default now()
);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,email,name) values(new.id,new.email,coalesce(left(new.raw_user_meta_data->>'name',100),'Usuario'));return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create table public.reports (
 id uuid primary key, folio text unique not null, owner_id uuid references public.profiles(id) on delete set null,
 reporter text not null check(reporter in ('affected','witness','student')), categories text[] not null,
 description text not null check(length(description) between 30 and 8000), location text not null default '', occurred_at text not null default '', recurring boolean not null, witnesses boolean not null,
 school text not null default '', anonymous boolean not null,
 status text not null default 'Recibido' check(status in ('Recibido','En revisión','En atención','Canalizado','Cerrado')),
 priority text not null default 'Por valorar' check(priority in ('Por valorar','Baja','Media','Alta')),
 assignee_id uuid references public.profiles(id) on delete set null,
 token_hash text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(not anonymous or owner_id is null)
);
create index reports_owner on public.reports(owner_id);
create index reports_assignee on public.reports(assignee_id);
create index reports_status on public.reports(status);
create table public.contacts (
 id uuid primary key, report_id uuid unique not null references public.reports(id) on delete cascade,
 name text not null default '', email text not null default '', phone text not null default '', contact_consent boolean not null, notification_consent boolean not null,
 check(not notification_consent or contact_consent)
);
create table public.updates (
 id uuid primary key, report_id uuid not null references public.reports(id) on delete cascade,author_id uuid references public.profiles(id) on delete set null,
 body text not null, kind text not null check(kind in ('public','internal','reporter')),created_at timestamptz not null default now()
);
create index updates_report on public.updates(report_id);
create table public.evidence (
 id uuid primary key, report_id uuid not null references public.reports(id) on delete cascade,
 filename text not null,mime text not null check(mime in ('image/jpeg','image/png','application/pdf')),
 size integer not null check(size between 1 and 5242880),path text unique not null,created_at timestamptz not null default now()
);
create index evidence_report on public.evidence(report_id);
create table public.resources (
 id text primary key,name text not null,description text not null,phone text not null default '',url text not null default '',region text not null default '',kind text not null default 'Orientación',verified_at timestamptz,published boolean not null default false
);
create table public.audit (
 id uuid primary key,actor_id uuid references public.profiles(id) on delete set null,report_id uuid references public.reports(id) on delete set null,action text not null,created_at timestamptz not null default now()
);
create table public.feedback (
 id uuid primary key,report_id uuid unique not null references public.reports(id) on delete cascade,rating integer not null check(rating between 1 and 5),comment text not null default '',created_at timestamptz not null default now()
);
create table public.rate_limits (key text primary key,count integer not null,reset_at timestamptz not null);
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin') and coalesce(auth.jwt()->>'aal','')='aal2';$$;
create function public.can_attend(report uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.reports r join public.profiles p on p.id=auth.uid() where r.id=report and (p.role='admin' or (p.role='staff' and r.assignee_id=p.id))) and coalesce(auth.jwt()->>'aal','')='aal2';$$;
create function public.owns_report(report uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.reports where id=report and owner_id=auth.uid());$$;
-- All mutations pass through validated server routes. No browser receives the service role.
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.contacts enable row level security;
alter table public.updates enable row level security;
alter table public.evidence enable row level security;
alter table public.resources enable row level security;
alter table public.audit enable row level security;
alter table public.feedback enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.profiles,public.reports,public.contacts,public.updates,public.evidence,public.resources,public.audit,public.feedback,public.rate_limits from anon,authenticated;
grant select on public.profiles,public.reports,public.contacts,public.updates,public.evidence,public.resources,public.audit,public.feedback to authenticated;
grant select on public.resources to anon;
grant all on public.profiles,public.reports,public.contacts,public.updates,public.evidence,public.resources,public.audit,public.feedback,public.rate_limits to service_role;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy report_read on public.reports for select to authenticated using(owner_id=auth.uid() or public.can_attend(id));
create policy contact_read on public.contacts for select to authenticated using(public.can_attend(report_id));
create policy update_read on public.updates for select to authenticated using(public.can_attend(report_id) or (kind<>'internal' and public.owns_report(report_id)));
create policy evidence_read on public.evidence for select to authenticated using(public.can_attend(report_id) or public.owns_report(report_id));
create policy resource_read on public.resources for select to anon,authenticated using(published);
create policy resource_admin_read on public.resources for select to authenticated using(public.is_admin());
create policy audit_read on public.audit for select to authenticated using(public.is_admin());
create policy feedback_read on public.feedback for select to authenticated using(public.can_attend(report_id));
create function public.consume_rate_limit(bucket text,max_count integer,window_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare hits integer;begin
 delete from public.rate_limits where reset_at<now();
 insert into public.rate_limits as r values(bucket,1,now()+make_interval(secs=>window_seconds)) on conflict(key) do update set count=r.count+1 returning count into hits;
 return hits<=max_count;
end;$$;
create function public.create_report_bundle(report_data jsonb,contact_data jsonb,update_data jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.reports select (jsonb_populate_record(null::public.reports,report_data)).*;
 if contact_data is not null then insert into public.contacts select (jsonb_populate_record(null::public.contacts,contact_data)).*;end if;
 insert into public.updates select (jsonb_populate_record(null::public.updates,update_data)).*;
end;$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.create_report_bundle(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
grant execute on function public.create_report_bundle(jsonb,jsonb,jsonb) to service_role;
revoke all on function public.is_admin(),public.can_attend(uuid),public.owns_report(uuid) from public,anon;
grant execute on function public.is_admin(),public.can_attend(uuid),public.owns_report(uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evidence','evidence',false,5242880,array['image/png','image/jpeg','application/pdf']);
-- No browser policies on storage.objects: only the authorized server reads or writes.
insert into public.resources(id,name,description,phone,url,region,kind,published) values
('911','Emergencias en México','Si existe peligro inmediato, llama al número nacional de emergencias.','911','https://www.gob.mx/911','Nacional','Emergencias',true),
('directorio','Centros de Justicia para las Mujeres','Consulta servicios y directorios en el portal oficial; confirma disponibilidad directamente con la institución.','','https://www.gob.mx/conavim','México','Orientación',true),
('edomex','Secretaría de las Mujeres · Estado de México','Información institucional de orientación y apoyo.','','https://semujeres.edomex.gob.mx/','Estado de México','Orientación',true);
commit;
