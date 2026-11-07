---
name: jm-pipeline-review
description: Reviews CRM pipeline deals, scores each deal against SOP-04 Deal Analyser thresholds (including 12% void + 15% bills stress test), and queues draft landlord follow-ups for approval.
metadata:
  internal: true
  role: landlord-acquisition-scout
  timezone: Europe/London
---

# Acquisition Pipeline & Deal Analyser Review (`jm-pipeline-review`)

## Step 0: Pre-Flight Guard & Kill Switch
1. Check for `PAUSED` file. If present, exit with `skipped-paused`.
2. Enforce token cap (`<= 10,000`) and daily spend cap (`<= £1.25`).

## Step 1: Load Pipeline & Portfolio Benchmarks
1. Call `pipeline_summary`, `property_pnl`, and `void_rooms`.
2. Call `knowledge.search` for `SOP-04` (`sop-jm-letvest-core-v1`).

## Step 2: Score Deals & Stage Follow-Up Drafts
1. Evaluate each deal in `jm_letvest.deals` across stages `0` to `4`.
2. Check baseline net spread per room (`>= £150/room/mo` per `SOP-04`) and stress-test scenario (`12% void + 15% bills increase`).
3. Stage landlord follow-up drafts via `create_draft_message`. Set `check_with_solicitor: true` whenever guaranteed rent figures or lease heads of terms are discussed.
4. Report `INSUFFICIENT_DATA` for any deal missing room rent breakdown, operating bill inputs, or licensing cost data.
