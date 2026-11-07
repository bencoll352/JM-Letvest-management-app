---
name: jm-compliance-check
description: Daily 08:00 Europe/London statutory certificate audit (CP12, EICR, PAT, EPC, HMO Licence). Flags anything expired or due within 30 days and queues draft renewal bookings for approval.
metadata:
  internal: true
  role: compliance-officer
  timezone: Europe/London
---

# Daily Compliance Check (`jm-compliance-check`)

## Step 0: Pre-Flight Guard & Kill Switch
1. Check for `PAUSED` file. If present, exit with `skipped-paused`.
2. Run `node scripts/guard.mjs jm-compliance-check` (`Europe/London` timezone).
3. Enforce token cap (`<= 8,000`) and daily spend cap (`<= £1.00`).

## Step 1: Query Statutory Certificate Register
1. Call `expiring_certificates` with `{ within_days: 30 }`.
2. Call `knowledge.search` for `SOP-01` (`sop-jm-letvest-core-v1`).

## Step 2: Classify & Draft Renewal Bookings
For each property:
1. Check all five statutory types: `CP12`, `EICR`, `PAT`, `EPC`, `HMO Licence`.
2. Flag any certificate where `expires_on < current_date` as `EXPIRED` (`[CHECK WITH A SOLICITOR]` if letting/licensing compliance is affected).
3. Flag any certificate where `expires_on <= current_date + 30` as `EXPIRING_WITHIN_30_DAYS`.
4. Flag any absent required certificate as `INSUFFICIENT_DATA: Missing certificate record`.
5. For each `EXPIRED` or `EXPIRING_WITHIN_30_DAYS` item, stage a draft via `create_job_request` and `create_draft_message` to a vetted contractor with valid insurance (`insurance_expires_on > current_date`).
