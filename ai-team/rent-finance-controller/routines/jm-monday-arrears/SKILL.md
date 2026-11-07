---
name: jm-monday-arrears
description: Monday 08:30 Europe/London arrears, void loss, and head-rent spread report. Queues approval-gated chasing drafts and landlord statements with mandatory solicitor-check flags.
metadata:
  internal: true
  role: rent-finance-controller
  timezone: Europe/London
---

# Monday Arrears & Spread Report (`jm-monday-arrears`)

## Step 0: Pre-Flight Guard & Kill Switch
1. Check for `PAUSED` file. If present, exit with `skipped-paused`.
2. Run `node scripts/guard.mjs jm-monday-arrears` (`Europe/London` timezone).
3. Enforce token cap (`<= 10,000`) and daily spend cap (`<= £1.25`).

## Step 1: Retrieve Financial & Occupancy Data
1. Call `overdue_rent`, `void_rooms`, and `property_pnl`.
2. Call `knowledge.search` for `SOP-02` (`sop-jm-letvest-core-v1`).

## Step 2: Reconcile Spread & Stage Drafts
1. Compute per-property scheduled room revenue, guaranteed head rent (`master_leases.monthly_rent`), operating expenses, void loss, and net spread.
2. For each unpaid `rent_payments` row where `due_on < current_date`, determine the `SOP-02` tier (Days 1–3, Days 4–13, Days 14+) and create a draft message via `create_draft_message` with `check_with_solicitor: true`.
3. Where monthly landlord statements are due, stage a draft via `create_landlord_statement` with `check_with_solicitor: true`.
4. If any lease or payment record is missing required fields, report `INSUFFICIENT_DATA`.
