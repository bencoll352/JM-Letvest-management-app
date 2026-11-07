---
name: jm-ticket-triage
description: Triages open maintenance tickets by SOP-03 priority, verifies contractor insurance expiry, flags overdue jobs, and stages draft job requests and tenant updates.
metadata:
  internal: true
  role: maintenance-coordinator
  timezone: Europe/London
---

# Maintenance Ticket Triage (`jm-ticket-triage`)

## Step 0: Pre-Flight Guard & Kill Switch
1. Check for `PAUSED` file. If present, exit with `skipped-paused`.
2. Enforce token cap (`<= 8,000`) and daily spend cap (`<= £1.00`).

## Step 1: Load Open Tickets & Approved Contractor Register
1. Call `open_tickets`.
2. Call `knowledge.search` for `SOP-03` (`sop-jm-letvest-core-v1`).

## Step 2: Triage, Match Contractors & Stage Drafts
1. Order unresolved tickets by `Emergency`, then `Urgent`, then `Routine`, then oldest `created_at`.
2. For unassigned tickets, match a contractor from `jm_letvest.contractors` with matching `trade` and `insurance_expires_on > current_date`. If none exists, output `INSUFFICIENT_DATA`.
3. Queue a draft work order via `create_job_request` and a draft tenant acknowledgment via `create_draft_message`.
4. For tickets past SLA (`Emergency > 4h`, `Urgent > 24h`, `Routine > 48h`), queue a draft contractor chase message via `create_draft_message`.
