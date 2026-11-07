# JM LetVest Ltd — Standalone Property Management & AI Operations App

A standalone UK Rent-to-Rent (HMO) property management workspace and 6-role AI Operations Command Centre supporting the public website (**https://jmletvest.co.uk/**). Built with Next.js App Router, TypeScript, Tailwind 4, Recharts, Supabase PostgreSQL (`jm_letvest` schema with RLS), and the JM LetVest AI Team engine (`ai-team/`).

- **Live Standalone App (Testing Stage)**: **https://jm-letvest-ops.web.app**
- **Direct 6-Role AI Command Centre**: **https://jm-letvest-ops.web.app/ai**
- **Public Website (Untouched)**: **https://jmletvest.co.uk/**
- **Branding**: Uses the current `jmletvest.co.uk` slate-trimmed logo (`/letvest-logo-slate-trimmed.png`), Silver-Blue & Deep Navy palette (`#263b57` / `#365b85` / `#172334`), `Fraunces` & `DM Sans` typography, `PRS058309`, and West Sussex portfolio fixtures.

## Preview and run locally

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:3000`. All browser demo records are fictional West Sussex HMO properties and persist locally in `localStorage` until signed in to Supabase.

## Included Modules & Full Functionality

1. **AI Operations Team (`/ai` & `ai-team/`)**:
   - **Chief of Staff (`jm-chief-of-staff`)**: `07:30` daily briefing, priority routing, and `16:00` Friday scoreboard.
   - **Compliance Officer (`jm-compliance-officer`)**: Audits `CP12`, `EICR`, `PAT`, `EPC`, and `HMO Licence` expiries (≤30 days or expired) and queues renewal booking drafts.
   - **Rent & Finance Controller (`jm-rent-finance-controller`)**: Tracks room rent collections vs guaranteed head rent, net R2R spread, voids, and queues arrears reminders + monthly landlord statements.
   - **Maintenance Coordinator (`jm-maintenance-coordinator`)**: Triages open tickets (`Emergency` / `Urgent` / `Routine`), matches contractors, and queues work orders.
   - **Landlord Acquisition Scout (`jm-landlord-acquisition-scout`)**: Scores West Sussex CRM opportunities using the R2R Deal Analyser and queues follow-ups.
   - **Receptionist (`jm-receptionist`)**: First-line tenant and landlord enquiry drafter strictly grounded in approved SOPs (`ai-team/sops/approved-sops.md`).
   - **Human Approval Queue & Safety Gates**: Read-only by default; all outbound/write actions are queued as drafts (`create_draft_message`, `create_job_request`, `create_landlord_statement`). Automatic `Check with a solicitor` flags on money, notices, deposits, evictions, and tenancy wording. Includes per-role token/spend caps, PII redaction, and a global `PAUSED` kill switch.
2. **CRM Pipeline & R2R Deal Analyser (`/pipeline`)**:
   - 5-stage Kanban board plus interactive **R2R HMO Deal Analyser & Downside Stress Test** (`5%` baseline void vs `12%` void + `15%` bills shock and 5-year HMO licence amortisation).
3. **Finances & Bank Feed Matching (`/finances`)**:
   - Property P&L, R2R spread calculator, rent collection ledger, and feature-flagged **Open Banking / GoCardless Bank Feed Matching** (`proposed_match` requiring owner confirmation).
4. **Compliance, Document Vault & Scheduled Alerts (`/compliance`)**:
   - Certificate register, **Private Document Vault** (`CP12`, `EICR`, `PAT`, `EPC`, `HMO Licence`, `Head Lease`, `Room Agreement`, `Check-In/Out Inventory`), and `07:15 UTC` scheduled notification previews.
5. **Contacts, Admin Governance & RBAC / Audit Log (`/contacts`)**:
   - Landlord/occupant directory, **Portfolio Administration Panel** (`DPS` / `TDS` / `MyDeposits` validation & RLS-scoped manager invitations), and **Role-Based Access Control (RBAC) & Immutable Audit Log Inspector**.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```
