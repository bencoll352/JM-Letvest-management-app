-- Proposed Migration (Phase 4): Dedicated RLS Manager Membership & Read/Draft RPCs
-- Branch: feature/ai-tools-rpcs
-- NOTE: Do NOT apply to a live database without explicit owner review and approval.

-- 1. Workspace members table so a dedicated AI Manager account can read workspace data
--    under Row-Level Security (SECURITY INVOKER) without using a service_role key.
create table if not exists jm_letvest.workspace_members (
  workspace_id uuid not null references jm_letvest.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table jm_letvest.workspace_members enable row level security;

drop policy if exists workspace_members_owner_all on jm_letvest.workspace_members;
create policy workspace_members_owner_all on jm_letvest.workspace_members
  for all to authenticated
  using (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()))
  with check (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()));

drop policy if exists workspace_members_self_select on jm_letvest.workspace_members;
create policy workspace_members_self_select on jm_letvest.workspace_members
  for select to authenticated
  using (user_id = auth.uid());

-- Helper function returning accessible workspace IDs for owner, manager, or viewer
create or replace function jm_letvest.accessible_workspace_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = jm_letvest, public
as $$
  select id from jm_letvest.workspaces where owner_id = auth.uid()
  union
  select workspace_id from jm_letvest.workspace_members where user_id = auth.uid()
$$;

-- Allow authenticated workspace managers/viewers to SELECT across jm_letvest operational tables
do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'contacts','properties','rooms','master_leases','sub_leases',
    'certificates','contractors','maintenance_tickets','expenses','rent_payments','deals'
  ]) loop
    execute format('drop policy if exists %I_manager_select on jm_letvest.%I', tbl, tbl);
    execute format(
      'create policy %I_manager_select on jm_letvest.%I for select to authenticated using (workspace_id in (select jm_letvest.accessible_workspace_ids()))',
      tbl, tbl
    );
  end loop;
end $$;

-- 2. Approval-gated AI Drafts table (nothing sent automatically)
create table if not exists jm_letvest.ai_drafts (
  id text primary key,
  workspace_id uuid not null references jm_letvest.workspaces(id) on delete cascade,
  role_slug text not null,
  tool_name text not null check (tool_name in ('create_draft_message', 'create_job_request', 'create_landlord_statement')),
  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'rejected')),
  check_with_solicitor boolean not null default false,
  payload jsonb not null,
  citations jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table jm_letvest.ai_drafts enable row level security;

drop policy if exists ai_drafts_select on jm_letvest.ai_drafts;
create policy ai_drafts_select on jm_letvest.ai_drafts
  for select to authenticated
  using (workspace_id in (select jm_letvest.accessible_workspace_ids()));

drop policy if exists ai_drafts_insert_manager on jm_letvest.ai_drafts;
create policy ai_drafts_insert_manager on jm_letvest.ai_drafts
  for insert to authenticated
  with check (
    status = 'pending_approval'
    and workspace_id in (
      select id from jm_letvest.workspaces where owner_id = auth.uid()
      union
      select workspace_id from jm_letvest.workspace_members where user_id = auth.uid() and role in ('owner', 'manager')
    )
  );

drop policy if exists ai_drafts_owner_decide on jm_letvest.ai_drafts;
create policy ai_drafts_owner_decide on jm_letvest.ai_drafts
  for update to authenticated
  using (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()))
  with check (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()));

-- 3. Granular Read RPC for Phase 4 AI Tools (SECURITY INVOKER)
create or replace function public.jm_letvest_ai_read(tool_name text, params jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = jm_letvest, public
as $$
declare
  ref_date date := coalesce((params->>'referenceDate')::date, current_date);
  within_days integer := coalesce((params->>'withinDays')::integer, 30);
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if tool_name = 'overdue_rent' then
    select jsonb_build_object(
      'records', coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb)
    ) into result
    from (
      select
        rp.id,
        format('[record:rent_payments:%s]', rp.id) as citation,
        r.property_id,
        r.name as room,
        c.id as occupant_id,
        c.name as tenant_name,
        rp.due_on,
        (ref_date - rp.due_on) as days_overdue,
        rp.amount,
        true as check_with_solicitor
      from jm_letvest.rent_payments rp
      join jm_letvest.sub_leases sl on sl.id = rp.sub_lease_id
      join jm_letvest.rooms r on r.id = sl.room_id
      left join jm_letvest.contacts c on c.id = sl.occupant_id
      where rp.paid_at is null and rp.due_on < ref_date
      order by rp.due_on asc
    ) q;

  elsif tool_name = 'expiring_certificates' then
    select jsonb_build_object(
      'records', coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb)
    ) into result
    from (
      select
        cert.id,
        format('[record:certificates:%s]', cert.id) as citation,
        cert.property_id,
        p.address as property_address,
        cert.kind,
        cert.expires_on,
        (cert.expires_on - ref_date) as days_remaining,
        case when cert.expires_on < ref_date then 'EXPIRED' else 'EXPIRING_WITHIN_30_DAYS' end as status,
        (cert.expires_on < ref_date or cert.kind = 'HMO Licence') as check_with_solicitor
      from jm_letvest.certificates cert
      join jm_letvest.properties p on p.id = cert.property_id
      where cert.expires_on <= (ref_date + within_days)
      order by cert.expires_on asc
    ) q;

  elsif tool_name = 'open_tickets' then
    select jsonb_build_object(
      'records', coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb)
    ) into result
    from (
      select
        t.id,
        format('[record:maintenance_tickets:%s]', t.id) as citation,
        t.property_id,
        t.room,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.contractor_id,
        t.created_at
      from jm_letvest.maintenance_tickets t
      where t.status <> 'Resolved'
      order by
        case t.priority when 'Emergency' then 0 when 'Urgent' then 1 else 2 end,
        t.created_at asc
    ) q;

  elsif tool_name = 'void_rooms' then
    select jsonb_build_object(
      'records', coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb)
    ) into result
    from (
      select
        r.id,
        format('[record:rooms:%s]', r.id) as citation,
        r.property_id,
        p.address as property_address,
        r.name as room_name,
        r.advertised_rent
      from jm_letvest.rooms r
      join jm_letvest.properties p on p.id = r.property_id
      where not exists (
        select 1 from jm_letvest.sub_leases sl
        where sl.room_id = r.id
          and sl.starts_on <= ref_date
          and (sl.ends_on is null or sl.ends_on >= ref_date)
      )
      order by r.property_id, r.name
    ) q;

  elsif tool_name = 'pipeline_summary' then
    select jsonb_build_object(
      'records', coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb)
    ) into result
    from (
      select
        d.id,
        format('[record:deals:%s]', d.id) as citation,
        d.address,
        d.contact_name,
        d.rooms,
        d.stage,
        d.potential_spread,
        round((d.potential_spread / greatest(d.rooms, 1))::numeric, 2) as spread_per_room
      from jm_letvest.deals d
      order by d.stage desc, d.potential_spread desc
    ) q;

  elsif tool_name = 'property_pnl' then
    select jsonb_build_object(
      'records', coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb)
    ) into result
    from (
      select
        pnl.id,
        format('[record:property_pnl:%s]', pnl.id) as citation,
        pnl.address,
        pnl.revenue as scheduled_revenue,
        pnl.head_rent,
        pnl.expenses,
        (pnl.revenue - pnl.head_rent - pnl.expenses) as net_spread
      from jm_letvest.property_pnl pnl
      order by pnl.id
    ) q;

  else
    raise exception 'Unsupported AI read tool: %', tool_name;
  end if;

  return result;
end;
$$;

grant usage on schema jm_letvest to authenticated;
grant select on jm_letvest.workspace_members to authenticated;
grant select, insert, update on jm_letvest.ai_drafts to authenticated;
grant execute on function public.jm_letvest_ai_read(text, jsonb) to authenticated;
