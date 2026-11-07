---
name: jm-friday-scoreboard
description: Friday 16:00 Europe/London weekly owner report and operational scoreboard for JM Letvest.
metadata:
  internal: true
  role: chief-of-staff
  timezone: Europe/London
---

# Weekly Owner Report & Scoreboard (`jm-friday-scoreboard`)

## Step 0: Pre-Flight Guard
1. Verify `PAUSED` does not exist and `node scripts/guard.mjs jm-friday-scoreboard` returns `run` in `Europe/London` time.
2. Enforce run token limit (`12,000`) and daily spend limit (`£1.50`).

## Step 1: Collect Weekly Portfolio Metrics
Query `property_pnl`, `overdue_rent`, `expiring_certificates`, `open_tickets`, `void_rooms`, and `pipeline_summary`.

## Step 2: Compile Weekly Scoreboard Deliverable
Include exact citations for every metric:
1. **Portfolio Financial Summary**: Scheduled monthly room revenue vs guaranteed head rent, operating expenses, net monthly spread across all active properties.
2. **Occupancy & Void Cost**: Occupied rooms vs total rooms and weekly void loss.
3. **Arrears & Collections**: Total collected vs overdue, flagging any account requiring legal/solicitor review (`[CHECK WITH A SOLICITOR]`).
4. **Statutory Compliance Coverage**: Percentage of properties with 100% valid `CP12`, `EICR`, `PAT`, `EPC`, and `HMO Licence` > 30 days from expiry.
5. **Maintenance SLA & Acquisition Pipeline**: Tickets resolved vs opened, and deal stage movements.
