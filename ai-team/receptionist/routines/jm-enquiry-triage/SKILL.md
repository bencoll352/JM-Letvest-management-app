---
name: jm-enquiry-triage
description: Drafts first replies to tenant and landlord enquiries strictly using approved SOPs and verified read-only room/ticket records. Refuses and escalates anything outside SOP scope.
metadata:
  internal: true
  role: receptionist
  timezone: Europe/London
---

# Receptionist Enquiry Triage (`jm-enquiry-triage`)

## Step 0: Pre-Flight Guard & Kill Switch
1. Check for `PAUSED` file. If present, exit with `skipped-paused`.
2. Enforce token cap (`<= 6,000`) and daily spend cap (`<= £0.75`).

## Step 1: Retrieve Approved SOPs & Context
1. Call `knowledge.search` for `sop-jm-letvest-core-v1` (`SOP-03`, `SOP-05`).
2. Call `void_rooms` and `open_tickets` for factual lookup only.

## Step 2: Draft Replies or Refuse
1. If the enquiry is covered by `SOP-03` or `SOP-05`, stage a draft reply via `create_draft_message` citing `[source:sop-jm-letvest-core-v1@v1]` and any matching `[record:rooms:<id>]` or `[record:maintenance_tickets:<id>]`.
2. If the enquiry mentions deposits, tenancy termination, rent disputes, legal notices, or lacks an approved SOP match, do not draft speculative advice: output `INSUFFICIENT_DATA` and set `check_with_solicitor: true` (`[CHECK WITH A SOLICITOR]`).
