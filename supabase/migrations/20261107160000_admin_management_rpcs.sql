-- Phase 6d: Admin RPCs & Tables for Contacts, Room Agreements, Deposits, Expense Budgets, and Manager Invitations

create table if not exists jm_letvest.manager_invitations (
  id text primary key,
  workspace_id uuid not null references jm_letvest.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

alter table jm_letvest.manager_invitations enable row level security;

drop policy if exists manager_invitations_owner_all on jm_letvest.manager_invitations;
create policy manager_invitations_owner_all on jm_letvest.manager_invitations
  for all to authenticated
  using (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()))
  with check (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()));

create or replace function public.jm_letvest_admin_mutate(operation text, payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = jm_letvest, public
as $$
declare
  ws_id uuid;
begin
  select id into ws_id from jm_letvest.workspaces where owner_id = auth.uid() limit 1;
  if ws_id is null then
    raise exception 'Workspace owner access required';
  end if;

  if operation = 'upsert_contact' then
    insert into jm_letvest.contacts (id, workspace_id, name, kind, email, phone)
    values (
      coalesce(payload->>'id', 'c-' || substr(md5(random()::text), 1, 8)),
      ws_id,
      trim(payload->>'name'),
      payload->>'kind',
      nullif(trim(payload->>'email'), ''),
      nullif(trim(payload->>'phone'), '')
    )
    on conflict (id) do update
    set
      name = excluded.name,
      kind = excluded.kind,
      email = excluded.email,
      phone = excluded.phone
    where jm_letvest.contacts.workspace_id = ws_id;

  elsif operation = 'upsert_room_agreement' then
    insert into jm_letvest.sub_leases (
      id, workspace_id, room_id, master_lease_id, occupant_id,
      monthly_rent, starts_on, ends_on, agreement_type, deposit_scheme, deposit_reference
    )
    values (
      coalesce(payload->>'id', 'sl-' || substr(md5(random()::text), 1, 8)),
      ws_id,
      payload->>'roomId',
      payload->>'masterLeaseId',
      payload->>'occupantId',
      (payload->>'monthlyRent')::numeric,
      (payload->>'startsOn')::date,
      nullif(payload->>'endsOn', '')::date,
      coalesce(payload->>'agreementType', 'AST room-only'),
      payload->>'depositScheme',
      nullif(trim(payload->>'depositReference'), '')
    )
    on conflict (id) do update
    set
      monthly_rent = excluded.monthly_rent,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      agreement_type = excluded.agreement_type,
      deposit_scheme = excluded.deposit_scheme,
      deposit_reference = excluded.deposit_reference
    where jm_letvest.sub_leases.workspace_id = ws_id;

  elsif operation = 'upsert_expense_budget' then
    insert into jm_letvest.expenses (id, workspace_id, property_id, category, monthly_amount)
    values (
      coalesce(payload->>'id', 'exp-' || substr(md5(random()::text), 1, 8)),
      ws_id,
      payload->>'propertyId',
      trim(payload->>'category'),
      (payload->>'monthlyAmount')::numeric
    )
    on conflict (id) do update
    set
      category = excluded.category,
      monthly_amount = excluded.monthly_amount
    where jm_letvest.expenses.workspace_id = ws_id;

  elsif operation = 'invite_manager' then
    insert into jm_letvest.manager_invitations (id, workspace_id, email, role, status, invited_by)
    values (
      coalesce(payload->>'id', 'inv-' || substr(md5(random()::text), 1, 8)),
      ws_id,
      lower(trim(payload->>'email')),
      coalesce(payload->>'role', 'manager'),
      'pending',
      auth.uid()
    )
    on conflict (workspace_id, email) do update
    set
      role = excluded.role,
      status = 'pending',
      expires_at = now() + interval '7 days';

  else
    raise exception 'Unsupported admin operation: %', operation;
  end if;

  return public.jm_letvest_snapshot();
end;
$$;

grant select, insert, update, delete on jm_letvest.manager_invitations to authenticated;
grant execute on function public.jm_letvest_admin_mutate(text, jsonb) to authenticated;
