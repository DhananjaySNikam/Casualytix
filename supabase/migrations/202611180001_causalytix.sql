-- An explicit, authenticated archive. No anon reads/writes or service key in the UI.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create table public.cx_incidents (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null, details jsonb not null, updated_at timestamptz not null default now(),
  primary key (owner_id,id)
);
create table public.cx_evidence_docs (
  owner_id uuid not null, incident_id uuid not null, doc_no int not null, name text not null, content text not null,
  primary key(owner_id,incident_id,doc_no), foreign key(owner_id,incident_id) references public.cx_incidents on delete cascade
);
create table public.cx_document_chunks (
  owner_id uuid not null, incident_id uuid not null, doc_no int not null, chunk_no int not null, content text not null, embedding extensions.vector(256) not null,
  primary key(owner_id,incident_id,doc_no,chunk_no), foreign key(owner_id,incident_id,doc_no) references public.cx_evidence_docs on delete cascade
);
create table public.cx_cause_nodes (
  owner_id uuid not null, incident_id uuid not null, branch int not null, depth int not null check(depth between 0 and 5), category text not null, label text not null,
  primary key(owner_id,incident_id,branch,depth), foreign key(owner_id,incident_id) references public.cx_incidents on delete cascade
);
create table public.cx_reports (
  owner_id uuid not null, incident_id uuid not null, report jsonb not null,
  primary key(owner_id,incident_id), foreign key(owner_id,incident_id) references public.cx_incidents on delete cascade
);
do $$ declare t text; begin
  foreach t in array array['cx_incidents','cx_evidence_docs','cx_document_chunks','cx_cause_nodes','cx_reports'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('create policy owner_access on public.%I for all to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()))',t);
  end loop;
end $$;
create function public.cx_save_case(payload jsonb) returns void language plpgsql security invoker set search_path=public,extensions,pg_temp as $$
declare uid uuid := auth.uid(); iid uuid := (payload->>'id')::uuid; d record; k record; f record; w record;
begin
  if uid is null or length(payload::text)>6000000 or jsonb_typeof(payload->'evidence') is distinct from 'array' then raise exception 'Invalid archive'; end if;
  insert into public.cx_incidents(owner_id,id,details) values(uid,iid,payload-'evidence'-'report')
    on conflict(owner_id,id) do update set details=excluded.details,updated_at=now();
  delete from public.cx_evidence_docs where owner_id=uid and incident_id=iid;
  delete from public.cx_cause_nodes where owner_id=uid and incident_id=iid;
  delete from public.cx_reports where owner_id=uid and incident_id=iid;
  for d in select value v, ordinality n from jsonb_array_elements(payload->'evidence') with ordinality loop
    insert into public.cx_evidence_docs values(uid,iid,d.n,d.v->>'name',d.v->>'text');
    for k in select value v, ordinality n from jsonb_array_elements(d.v->'chunks') with ordinality loop
      insert into public.cx_document_chunks values(uid,iid,d.n,k.n,k.v->>'text',(k.v->>'embedding')::extensions.vector(256));
    end loop;
  end loop;
  if jsonb_typeof(payload->'report')='object' then
    insert into public.cx_reports values(uid,iid,payload->'report');
    for f in select value v, ordinality n from jsonb_array_elements(payload->'report'->'causes') with ordinality loop
      insert into public.cx_cause_nodes values(uid,iid,f.n,0,f.v->>'category',f.v->>'title');
      for w in select value v, ordinality n from jsonb_array_elements(f.v->'why') with ordinality loop
        insert into public.cx_cause_nodes values(uid,iid,f.n,w.n,f.v->>'category',w.v->>'text');
      end loop;
    end loop;
  end if;
end $$;
revoke all on function public.cx_save_case(jsonb) from public,anon;
grant execute on function public.cx_save_case(jsonb) to authenticated;
