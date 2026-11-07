# JM Letvest Daily Briefing — 2026-11-09 07:30 (Europe/London)

**Role**: Chief of Staff (`jm-chief-of-staff`)
**Status**: `ready_for_review` (Read-Only Briefing — All Outbound Actions Held as Drafts)
**Solicitor Check Required**: `true` — `[CHECK WITH A SOLICITOR]` (Contains rent arrears & head-lease financial items)

## 1. Red Alerts (Immediate Owner Decisions)
- **Certificate Expiring in 9 Days**: `EICR` at **14 Albion Terrace, Manchester M14 5AA** (`[record:certificates:cert-fict-102]`) expires on `2026-11-18`. Routed to `compliance-officer` to draft inspection booking (`[source:sop-jm-letvest-core-v1@v1]`).
- **Urgent Maintenance Fault**: Boiler pressure drop reported in Room 3 at **14 Albion Terrace** (`[record:maintenance_tickets:tkt-fict-204]`, status `Open`, priority `Urgent`). Routed to `maintenance-coordinator` to draft job request for vetted gas engineer (`[source:sop-jm-letvest-core-v1@v1]`).

## 2. Rent Arrears & Portfolio Cashflow (`[CHECK WITH A SOLICITOR]`)
- **Overdue Occupant Rent**: £650.00 due on `2026-11-01` (8 days overdue) for Room 2, **14 Albion Terrace** (`[record:rent_payments:pay-fict-301]`, sub-lease `[record:sub_leases:sub-fict-12]`). Routed to `rent-finance-controller` for Tier-2 formal arrears follow-up draft (`[source:sop-jm-letvest-core-v1@v1]`).
- **Portfolio Monthly Net Spread**:
  - Scheduled Room Revenue: £3,850.00/mo (`[record:property_pnl:prop-fict-01]`)
  - Guaranteed Head Rent: £2,200.00/mo (`[record:master_leases:ml-fict-01]`)
  - Operating Expenses: £540.00/mo (`[record:property_pnl:prop-fict-01]`)
  - Net Spread: **£1,110.00/mo** (`[record:property_pnl:prop-fict-01]`)

## 3. Void Rooms
- **Room 6, 22 Victoria Avenue, Salford M6 5PL** (`[record:rooms:rm-fict-06]`): Currently vacant; advertised rent £625.00/mo (`[record:rooms:rm-fict-06]`).

## 4. Acquisition Pipeline
- **88 Clarendon Road (6-bed HMO)** (`[record:deals:deal-fict-09]`): Stage `2` (Viewing & Property Inspection), projected spread £980.00/mo. Routed to `landlord-acquisition-scout` for Deal Analyser stress test.

## 5. Missing Data / Unverified Items
- `INSUFFICIENT_DATA`: PAT testing certificate record is not present in `jm_letvest.certificates` for **22 Victoria Avenue** (`[record:properties:prop-fict-02]`). Please upload or confirm expiry date before marketing Room 6 (`[source:sop-jm-letvest-core-v1@v1]`).
