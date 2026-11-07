-- Phase 6e: R2R Deal Analyser Columns & Stress Test Storage on jm_letvest.deals

alter table jm_letvest.deals
  add column if not exists guaranteed_head_rent numeric not null default 0 check (guaranteed_head_rent >= 0),
  add column if not exists projected_room_rents jsonb not null default '[]'::jsonb,
  add column if not exists baseline_void_rate numeric not null default 0.05 check (baseline_void_rate >= 0 and baseline_void_rate <= 1),
  add column if not exists monthly_bills numeric not null default 0 check (monthly_bills >= 0),
  add column if not exists five_year_licence_fee numeric not null default 0 check (five_year_licence_fee >= 0),
  add column if not exists monthly_maintenance_reserve numeric not null default 0 check (monthly_maintenance_reserve >= 0),
  add column if not exists stress_net_spread numeric not null default 0;
