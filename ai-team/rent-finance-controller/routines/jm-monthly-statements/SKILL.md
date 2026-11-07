---
name: jm-monthly-statements
description: Prepares draft monthly guaranteed head-rent statements for landlords with full citation coverage and mandatory owner/solicitor approval.
metadata:
  internal: true
  role: rent-finance-controller
  timezone: Europe/London
---

# Monthly Landlord Statements (`jm-monthly-statements`)

## Step 1: Gather Master Lease & P&L Data
Query `property_pnl` and `overdue_rent`, plus `SOP-02` from `knowledge.search`.

## Step 2: Draft Statements (`create_landlord_statement`)
For each active `master_leases` record:
1. Quote exact `monthly_rent` and lease period from `[record:master_leases:<id>]`.
2. Set `check_with_solicitor: true` and `requiresApproval: true`.
3. Never deduct repair costs unless an explicit approved landlord deduction record and head-lease clause citation exist; otherwise state `INSUFFICIENT_DATA` for deductions and set deductions to `£0.00`.
