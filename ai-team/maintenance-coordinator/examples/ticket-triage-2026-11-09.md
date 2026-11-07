# Maintenance Triage & Contractor Dispatch Queue — 2026-11-09

**Role**: Maintenance Coordinator (`jm-maintenance-coordinator`)
**Status**: `awaiting_approval` (1 Draft Job Request + 2 Draft Messages Queued)
**Solicitor Check Required**: `false` (No tenant recharge, deposit deduction, or legal notice involved)

## 1. Triaged Open Tickets
| Ticket ID | Property & Room | Priority | Fault Summary | Status / Age | Recommended Vetted Contractor | Citations |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `tkt-fict-204` | 14 Albion Terrace, Room 3 (`prop-fict-01`) | `Urgent` | Combi boiler pressure dropping to 0.4 bar overnight | `Open` (6h) | Northern Gas Safe Services (`con-fict-01`, Gas Safe `GS-998120`, insured to `2027-06-30`) | `[record:maintenance_tickets:tkt-fict-204]`, `[record:contractors:con-fict-01]`, `[source:sop-jm-letvest-core-v1@v1]` |
| `tkt-fict-198` | 22 Victoria Avenue, Kitchen (`prop-fict-02`) | `Routine` | Extractor hood light bulb housing loose | `Assigned` (72h — **SLA Overdue > 48h**) | Peak NICEIC Electrical Ltd (`con-fict-02`, insured to `2027-04-15`) | `[record:maintenance_tickets:tkt-fict-198]`, `[record:contractors:con-fict-02]`, `[source:sop-jm-letvest-core-v1@v1]` |

## 2. Draft Actions Staged for Owner Approval
1. **Draft Work Order `draft-job-fict-204`**:
   - Ticket: `[record:maintenance_tickets:tkt-fict-204]`
   - Contractor: `[record:contractors:con-fict-01]`
   - Scope: Inspect expansion vessel, PRV, and repressurise loop at 14 Albion Terrace.
   - Proposed Callout Cap: £110.00 (`requiresApproval: true`).
2. **Draft Tenant Update `draft-msg-fict-204`**:
   - Recipient: Occupant of Room 3 (`[CONTACT:c-fict-203]`)
   - Summary: Confirms `Urgent` 24-hour triage window per `SOP-03` and requests access window confirmation once Owner approves engineer dispatch (`[source:sop-jm-letvest-core-v1@v1]`).
3. **Draft Contractor Chase `draft-msg-fict-198`**:
   - Recipient: Peak NICEIC Electrical Ltd (`[record:contractors:con-fict-02]`)
   - Summary: Chases confirmed attendance time for `tkt-fict-198` (assigned 72 hours ago, exceeding 48h `Routine` response target).

## 3. Missing Data (`INSUFFICIENT_DATA`)
- `INSUFFICIENT_DATA`: Ticket `tkt-fict-205` (Roof flashing damp patch at 22 Victoria Avenue) requires a `Roofing` trade contractor, and no contractor with `trade = 'Roofing'` and unexpired insurance exists in `jm_letvest.contractors`. Escalated to Owner.
