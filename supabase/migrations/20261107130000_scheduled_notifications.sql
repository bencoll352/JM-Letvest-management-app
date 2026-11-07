-- Phase 6a: Scheduled Certificate Expiry & Rent Arrears Notifications (pg_cron + notifications table)
-- NOTE: Creates in-app owner notifications only; never sends external tenant messages automatically.

create table if not exists jm_letvest.notifications (
  id text primary key,
  workspace_id uuid not null references jm_letvest.workspaces(id) on delete cascade,
  kind text not null check (kind in ('certificate_expiry', 'rent_arrears')),
  severity text not null check (severity in ('critical', 'warning')),
  record_id text not null,
  title text not null,
  message text not null,
  check_with_solicitor boolean not null default false,
  acknowledged_at timestamptz,
  created_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, record_id, created_on)
);

alter table jm_letvest.notifications enable row level security;

drop policy if exists notifications_owner_all on jm_letvest.notifications;
create policy notifications_owner_all on jm_letvest.notifications
  for all to authenticated
  using (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()))
  with check (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()));

create or replace function jm_letvest.enqueue_daily_notifications(ref_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = jm_letvest, public
as $$
declare
  inserted_count integer := 0;
  c_count integer := 0;
  r_count integer := 0;
begin
  -- 1. Certificate expiry alerts (expired or expiring within 30 days)
  insert into jm_letvest.notifications (
    id, workspace_id, kind, severity, record_id, title, message, check_with_solicitor, created_on
  )
  select
    format('notif-cert-%s-%s', c.id, to_char(ref_date, 'YYYYMMDD')),
    c.workspace_id,
    'certificate_expiry',
    case when c.expires_on < ref_date then 'critical' else 'warning' end,
    c.id,
    format('%s %s at %s', c.kind, case when c.expires_on < ref_date then 'EXPIRED' else 'expiring within 30 days' end, p.address),
    format('Certificate %s (%s) for %s expires on %s (%s days remaining).', c.kind, c.id, p.address, c.expires_on, (c.expires_on - ref_date)),
    (c.expires_on < ref_date or c.kind = 'HMO Licence'),
    ref_date
  from jm_letvest.certificates c
  join jm_letvest.properties p on p.id = c.property_id
  where c.expires_on <= (ref_date + 30)
  on conflict (workspace_id, kind, record_id, created_on) do nothing;

  get diagnostics c_count = row_count;

  -- 2. Rent arrears alerts (unpaid past due_on)
  insert into jm_letvest.notifications (
    id, workspace_id, kind, severity, record_id, title, message, check_with_solicitor, created_on
  )
  select
    format('notif-rent-%s-%s', rp.id, to_char(ref_date, 'YYYYMMDD')),
    rp.workspace_id,
    'rent_arrears',
    case when (ref_date - rp.due_on) >= 14 then 'critical' else 'warning' end,
    rp.id,
    format('Overdue rent (£%s) — %s, %s', rp.amount, r.name, p.address),
    format('Rent payment %s (£%s) due on %s is %s days overdue. Check with a solicitor before issuing any formal notice.', rp.id, rp.amount, rp.due_on, (ref_date - rp.due_on)),
    true,
    ref_date
  from jm_letvest.rent_payments rp
  join jm_letvest.sub_leases sl on sl.id = rp.sub_lease_id
  join jm_letvest.rooms r on r.id = sl.room_id
  join jm_letvest.properties p on p.id = r.property_id
  where rp.paid_at is null and rp.due_on < ref_date
  on conflict (workspace_id, kind, record_id, created_on) do nothing;

  get diagnostics r_count = row_count;
  inserted_count := c_count + r_count;
  return inserted_count;
end;
$$;

-- Schedule via pg_cron if extension is enabled (07:30 UTC daily)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'jm-letvest-daily-notifications',
      '30 7 * * *',
      $cron$select jm_letvest.enqueue_daily_notifications(current_date);$cron$
    );
  end if;
end $$;

grant select, update on jm_letvest.notifications to authenticated;
