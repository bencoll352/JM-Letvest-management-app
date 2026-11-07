---
name: jm-daily-briefing
description: Daily 07:30 Europe/London operational briefing for JM Letvest. Summarises compliance alerts, rent arrears, maintenance tickets, void rooms, and P&L spread, and routes draft tasks for owner approval.
metadata:
  internal: true
  role: chief-of-staff
  timezone: Europe/London
---

# Daily 07:30 Briefing (`jm-daily-briefing`)

## Step 0: Pre-Flight Guard & Kill Switch
1. Check for the `PAUSED` file at repository root or `employees/jm-letvest/PAUSED`. If present, exit immediately with `skipped-paused`.
2. Run `node scripts/guard.mjs jm-daily-briefing`. Verify schedule row in `SCHEDULE.md` (`Europe/London` wall-clock time) and ensure no overlapping lease exists in `state/run-leases/jm-daily-briefing.json`.
3. Verify token cap (`<= 12,000` tokens) and daily spend cap (`<= £1.50`).

## Step 1: Gather Read-Only Portfolio Telemetry
Call the following RLS-protected read tools:
- `expiring_certificates` (`within_days: 30`)
- `open_tickets`
- `overdue_rent`
- `void_rooms`
- `property_pnl`
- `pipeline_summary`
- `knowledge.search` (`sop-jm-letvest-core-v1`)

## Step 2: Prioritise & Route Work
Assemble the briefing in five sections, citing `[record:<table>:<id>]` and `[source:<id>@v<version>]` for every line:
1. **Red Alerts (Immediate Owner Attention)**: Expired certificates, `Emergency` tickets, or rent arrears >= 14 days (`[CHECK WITH A SOLICITOR]`).
2. **30-Day Compliance Window**: Certificates expiring within 30 days routed to `compliance-officer`.
3. **Cashflow, Arrears & Voids**: Total overdue rent, void rooms with daily revenue impact, and upcoming head-rent commitments routed to `rent-finance-controller`.
4. **Maintenance Queue**: Open `Urgent` and `Routine` faults routed to `maintenance-coordinator`.
5. **Acquisition Pipeline**: Deals awaiting follow-up or Deal Analyser scoring routed to `landlord-acquisition-scout`.

## Step 3: Missing Data & Approval Gate
- If any tool returns empty/unreachable data, write an explicit `INSUFFICIENT_DATA` notice naming the unavailable RPC or table. Never estimate or invent numbers.
- Submit deliverable to the `AI-Employee` review queue (`ready_for_review`).
