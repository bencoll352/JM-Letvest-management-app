# JM Letvest AI Operations Team (`employees/jm-letvest/`)

This directory defines the six-role AI Operations Team for **JM Letvest** (UK rent-to-rent HMO management operating guaranteed head leases from landlords and letting rooms on individual agreements).

The legacy GTM Engineer pack at the repository root (`employee.json`, `ROLE.md`, `routines/`) is preserved separately and unchanged.

## Roster of AI Employees

| Slug | Name & Role | Primary Routines | Allowed Read Tools | Allowed Draft Tools (Approval-Gated) | Token Cap / Run | Budget Cap / Day (GBP) |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| `chief-of-staff` | **Chief of Staff** — Daily operations briefing, prioritisation, routing & weekly owner scoreboard | `jm-daily-briefing` (07:30), `jm-friday-scoreboard` (Fri 16:00) | `knowledge.search`, `overdue_rent`, `expiring_certificates`, `open_tickets`, `void_rooms`, `pipeline_summary`, `property_pnl` | `deliverable.write`, `create_draft_message` | 12,000 | £1.50 |
| `compliance-officer` | **Compliance Officer** — Statutory certificate monitoring (CP12, EICR, PAT, EPC, HMO Licence) & renewal booking drafts | `jm-compliance-check` (08:00) | `knowledge.search`, `expiring_certificates`, `open_tickets` | `deliverable.write`, `create_draft_message`, `create_job_request` | 8,000 | £1.00 |
| `rent-finance-controller` | **Rent and Finance Controller** — Arrears tracking, scheduled room revenue vs head rent, net spread, voids & monthly landlord statements | `jm-monday-arrears` (Mon 08:30), `jm-monthly-statements` | `knowledge.search`, `overdue_rent`, `void_rooms`, `property_pnl` | `deliverable.write`, `create_draft_message`, `create_landlord_statement` | 10,000 | £1.25 |
| `maintenance-coordinator` | **Maintenance Coordinator** — Fault triage (`Emergency` / `Urgent` / `Routine`), vetted contractor matching, overdue job chasing & tenant updates | `jm-ticket-triage` | `knowledge.search`, `open_tickets`, `expiring_certificates` | `deliverable.write`, `create_job_request`, `create_draft_message` | 8,000 | £1.00 |
| `landlord-acquisition-scout` | **Landlord Acquisition Scout** — R2R CRM pipeline progression, follow-up drafting & Deal Analyser scoring | `jm-pipeline-review` | `knowledge.search`, `pipeline_summary`, `property_pnl`, `void_rooms` | `deliverable.write`, `create_draft_message` | 10,000 | £1.25 |
| `receptionist` | **Receptionist** — First-line replies to tenant and landlord enquiries strictly from approved SOPs | `jm-enquiry-triage` | `knowledge.search`, `open_tickets`, `void_rooms` | `deliverable.write`, `create_draft_message` | 6,000 | £0.75 |

## Non-Negotiable Rules for Every Role

1. **Read-Only by Default**:
   - No AI employee has direct write, send, payment, or mutation permissions against live tenant, landlord, or bank records.
   - Every outbound communication or operational mutation (`create_draft_message`, `create_job_request`, `create_landlord_statement`) is created exclusively as a **DRAFT** (`status: 'pending'`) in the approval queue and requires explicit human owner/reviewer approval (`Team.approve()` + `Team.accept()`).
2. **Mandatory Solicitor-Check Flag (`check_with_solicitor: true`)**:
   - Any output, draft, or recommendation that touches **money demands, rent arrears notices, legal notices (e.g. Section 8 / Section 21 / Notice to Quit), evictions, tenancy deposits (DPS / TDS / MyDeposits prescribed information or deductions), head-lease break clauses, or tenancy agreement wording** automatically sets `requiresApproval: true` and `checkWithSolicitor: true` with a prominent `[CHECK WITH A SOLICITOR]` banner.
3. **Strict Citation Integrity & Refusal on Missing Data**:
   - Every factual figure, date, certificate status, rent amount, or policy statement must cite either an approved knowledge document (`[source:<id>@v<version>]`) or a verified Supabase RPC record (`[record:<table>:<id>]`).
   - If required data or an approved SOP is missing, the employee must explicitly state `INSUFFICIENT_DATA` and name the missing record or document—never invent figures, dates, statutory deadlines, or legal rules.
4. **Per-Role Token & Spend Caps + Global Kill Switch (`PAUSED`)**:
   - Every role manifest (`employee.json`) enforces `limits.maxTokensPerRun` and `limits.maxDailySpendGbp`.
   - Creating a `PAUSED` file at the repository root (or inside `employees/jm-letvest/PAUSED`) immediately halts all scheduled routines (`scripts/guard.mjs`) and worker job execution (`Team.work()`).
