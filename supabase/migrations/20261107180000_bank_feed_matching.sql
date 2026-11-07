-- Phase 6f: Bank Feed Matching (Open Banking / GoCardless) Behind Feature Flag

create table if not exists jm_letvest.bank_transactions (
  id text primary key,
  workspace_id uuid not null references jm_letvest.workspaces(id) on delete cascade,
  provider text not null check (provider in ('gocardless', 'open_banking')),
  external_tx_id text not null,
  booked_on date not null,
  amount numeric not null check (amount > 0),
  reference text not null,
  matched_payment_id text references jm_letvest.rent_payments(id) on delete set null,
  match_status text not null default 'unmatched' check (match_status in ('unmatched', 'proposed_match', 'confirmed')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, external_tx_id)
);

alter table jm_letvest.bank_transactions enable row level security;

drop policy if exists bank_transactions_owner_all on jm_letvest.bank_transactions;
create policy bank_transactions_owner_all on jm_letvest.bank_transactions
  for all to authenticated
  using (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()))
  with check (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()));

grant select, insert, update on jm_letvest.bank_transactions to authenticated;
