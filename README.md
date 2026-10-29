# JM Letvest property workspace

A branded UK rent-to-rent operations app using Next.js App Router, TypeScript, Tailwind 4, Radix/shadcn-style UI primitives, Recharts and Supabase PostgreSQL.

## Preview and run

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:3000. The initial workspace has six fictional HMOs, 30 rooms, maintenance tickets, landlord opportunities and an outstanding-rent ledger. Demo changes are versioned in browser localStorage. Reset them in Settings. Interior photographs are illustrative Unsplash images, not photographs of the sample addresses. Branding uses the supplied JM Letvest logo.

## Live Supabase mode

The existing **Open-dots** project (`wfkpjwstwwaftwypuuww`) is configured in the ignored `.env.local`. Only its public browser key is used. Existing public application tables were not changed. JM Letvest records live in a separate `jm_letvest` schema, accessed through narrowly scoped public RPC functions running as **SECURITY INVOKER**.

Use **Settings → Sign in to live workspace**, or click the Demo workspace label. Create an account or use an existing Supabase email/password account. Registration and email confirmation follow the project's existing Auth settings. No account credentials have been created for you. Add the published app origin to the project's allowed Auth redirect URLs before using confirmation links on that origin. An empty workspace is created for a newly signed-in account; fictional browser records are not silently imported.

Live property creation writes the property, landlord contact, head lease, rooms, initial occupancy agreements, operating budget and CP12 record in one database transaction. Initial occupied-room contacts are labelled **Occupant details pending** until their real details are entered by an administrator. CRM changes, repair reports, assignment/status changes, certificate renewals and rent receipt updates are saved through RLS-protected RPCs. The app refreshes live data every 20 seconds and supports manual refresh in Settings. Save failures show an error and reload server state.

Copy `.env.example` to `.env.local` for another installation, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and rebuild. Never use a service-role key in browser code.

## Screens and behaviour

- Dashboard: scheduled monthly rental income, net spread, occupancy, property register, certificate alerts, repair activity and CSV export.
- Properties: searchable cards and details with head landlord → JM Letvest → room occupant hierarchy; add-property form.
- CRM: five-stage opportunity board with stage selectors, new opportunities and potential monthly spread.
- Contacts: landlord, prospective landlord and occupant directory derived from portfolio records.
- Maintenance: four-stage ticket board, priority, photo attachment, contractor directory, assignment and status changes. Progressing to Assigned/In Progress requires a contractor.
- Compliance: CP12, EICR, PAT, EPC and HMO licence register; record certificate expiry dates; expired and ≤30-day certificates trigger alerts.
- Finances: per-property P&L, cash-flow chart, occupancy, spread, outstanding payments, mark received and CSV export.
- Tenant portal: report faults with priority and photo, and track status. Demo mode switches between sample properties. In live mode a resident must have their Auth user ID linked to `jm_letvest.contacts.user_id`, and a current room agreement. Residents see only permitted property/room and reported-ticket records; they cannot assign contractors or update ticket status.

## Database and seeds

The SQL migrations in `supabase/migrations/` were created with the Supabase CLI. Corresponding changes have been applied to Open-dots. For a fresh project, run the migrations in filename order. `schema.sql` is a reference, not a substitute for the ordered migrations. `lease-validation.sql`, `resident-access.sql` and `certificates.sql` are readable copies of later changes.

Tables: workspaces, contacts, properties, rooms, master_leases, sub_leases, certificates, contractors, maintenance_tickets, expenses, rent_payments and deals. Composite workspace foreign keys prevent cross-workspace references. Exclusion constraints prevent overlapping room and head leases. Triggers require room agreements to belong to the correct property and stay within head-lease dates. RLS applies to every table. Views use `security_invoker=true`; privileged definer functions are not used.

`supabase/seed.sql` adds one fictional property, linked landlord, rooms and agreements, a maintenance request, opportunity and rent ledger entry to the **authenticated manager's** workspace. It requires a real Auth user context. Six-property browser fixtures are in `src/lib/data.ts` and work without backend setup. No production data is seeded automatically.

## Financial definitions

Scheduled revenue = sum of active occupied-room rents. Net monthly spread = scheduled revenue − active guaranteed head rent − operating expense budget. Vacant rooms contribute no revenue. This is an operating forecast, not a bank-reconciled cash statement; rent payments and outstanding balances are tracked separately. Historic chart points are labelled sample data in demo mode; live mode shows the current forecast rather than invented history. Values use GBP and UK dates. Deposit schemes/references, agreement classification, head-lease break clauses and insurance requirements are modelled in SQL; legal agreement classification must be determined for each occupancy.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

`supabase/verify.sql` is a rollback-only integration test covering the financial spread, overlapping occupancy rejection and cross-user RLS isolation. It creates a temporary test Auth row and rolls it back with all test records. Database security-advisor checks returned no warnings after installation.

## Operational boundaries

This is a functional first release. Contractor entries are sample partners whose real credentials must be recorded and verified. The app does not send contractor emails/SMS, generate legal agreements, reconcile bank transactions, or run background certificate email reminders. Dashboard expiry alerts are automatic whenever data is loaded. Photos are stored as size-limited image data in ticket records for this release; a dedicated private Storage bucket is a future scale improvement. Full contact editing, individual room-agreement/deposit editing, budget editing, certificate document uploads, rent schedule generation and multi-manager invitations currently require database administration. The live UI covers property onboarding, certificate dates, CRM, faults, dispatch status and rent receipt tracking.

Browser visual QA could not run because the provided browser/desktop tool failed to initialise (`failed to write kernel assets`). Build, TypeScript, financial unit tests and database integration/security checks were used instead.
