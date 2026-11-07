-- Phase 6g: Immutable Audit Log & Role-Based Access Control (RBAC)

create table if not exists jm_letvest.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references jm_letvest.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table jm_letvest.audit_logs enable row level security;

-- Append-only: owners can SELECT audit logs; trigger inserts via security definer; no UPDATE/DELETE policies exist.
drop policy if exists audit_logs_owner_select on jm_letvest.audit_logs;
create policy audit_logs_owner_select on jm_letvest.audit_logs
  for select to authenticated
  using (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()));

create or replace function jm_letvest.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = jm_letvest, public
as $$
declare
  ws_id uuid;
  rec_id text;
begin
  if tg_op = 'DELETE' then
    ws_id := old.workspace_id;
    rec_id := old.id::text;
    insert into jm_letvest.audit_logs (workspace_id, actor_id, table_name, record_id, action, before_data, after_data)
    values (ws_id, auth.uid(), tg_table_name, rec_id, tg_op, to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    ws_id := new.workspace_id;
    rec_id := new.id::text;
    insert into jm_letvest.audit_logs (workspace_id, actor_id, table_name, record_id, action, before_data, after_data)
    values (ws_id, auth.uid(), tg_table_name, rec_id, tg_op, to_jsonb(old), to_jsonb(new));
    return new;
  else
    ws_id := new.workspace_id;
    rec_id := new.id::text;
    insert into jm_letvest.audit_logs (workspace_id, actor_id, table_name, record_id, action, before_data, after_data)
    values (ws_id, auth.uid(), tg_table_name, rec_id, tg_op, null, to_jsonb(new));
    return new;
  end if;
end;
$$;

do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'master_leases','sub_leases','rent_payments','certificates','maintenance_tickets','deals'
  ]) loop
    execute format('drop trigger if exists trg_audit_%I on jm_letvest.%I', tbl, tbl);
    execute format(
      'create trigger trg_audit_%I after insert or update or delete on jm_letvest.%I for each row execute function jm_letvest.record_audit_log()',
      tbl, tbl
    );
  end loop;
end $$;

grant select on jm_letvest.audit_logs to authenticated;
