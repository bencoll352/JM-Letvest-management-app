# Remaining scope, not completed claims

Implemented locally:
- First research/revision/acceptance milestone, basic employee templates/config snapshots, approved company text, scoped proposed memory API, local approval wait, bounded atomic worker, event history, reference receipt recovery test, company profile, basic reports and ten navigation sections. Optional browser dictation preserves confirmation before assignment creation. Legacy GTM and free voice paths retained.
- **JM Letvest AI Operations Team (`employees/jm-letvest/`)**: Six role packs (`chief-of-staff`, `compliance-officer`, `rent-finance-controller`, `maintenance-coordinator`, `landlord-acquisition-scout`, `receptionist`) with `ai-employee/1` schemas, approved SOPs, per-role token/spend caps, solicitor-review flags on money/legal/deposit/eviction/tenancy wording, and global `PAUSED` kill switch.
- **Provider-agnostic LLM execution adapter (`team/llm-adapter.mjs`)**: Plugs behind `team/execution-contract.mjs` with deterministic local extractive fallback (`AI_EXECUTION_MODE=extractive`), PII redaction before outbound prompts, context restriction to approved company text + tool payloads, and per-run token/cost accounting in SQLite `records` (`kind = 'llm_run'`).
- **RLS-isolated Supabase data tools (`team/tools/`)**: Read tools (`overdue_rent`, `expiring_certificates`, `open_tickets`, `void_rooms`, `pipeline_summary`, `property_pnl`) and approval-gated draft tools (`create_draft_message`, `create_job_request`, `create_landlord_statement`). Service-role keys are rejected by code inspection.
- **Routine schedules & guard (`SCHEDULE.md`, `scripts/guard.mjs`)**: Four JM Letvest schedules (`jm-daily-briefing`, `jm-compliance-check`, `jm-monday-arrears`, `jm-friday-scoreboard`) stored as inactive (`days: off`), with `Europe/London` GMT/BST DST offset resolution, missed-run catch-up detection, and overlapping worker lease protection.
- **UK GDPR & Safety (`docs/team/UK-GDPR-CHECKLIST.md`, `tests/jm-letvest-safety.test.mjs`)**: Scrubbed legacy scraped contacts from git working tree, added UK GDPR compliance checklist, and added automated safety tests for approval gating, citation integrity, budget caps, RLS isolation, and missing-data refusal.

Still incomplete or stubbed (not production-ready):

- **Live LLM Provider Integration & Evaluation**: While `team/llm-adapter.mjs` supports `openai-compatible` and `anthropic` HTTP endpoints when `AI_EXECUTION_MODE=llm`, no live API keys are configured and multi-step generative orchestration, Promptfoo model comparisons, Langfuse telemetry, and live provider spend reconciliation remain unimplemented.
- **Live Supabase Database Migrations & Manager Provisioning**: The SQL migrations in `JM-Letvest-management-app` (`feature/ai-tools-rpcs` and Phase 6 branches `6a`–`6g`) have **not** been applied to a live Supabase project. They must be reviewed and applied manually by the owner before live RPC queries work.
- **Outbound Delivery Adapters**: Draft tools (`create_draft_message`, `create_job_request`, `create_landlord_statement`) only record `pending_approval` drafts in the approval queue (`records` table and `/api/drafts`). No email/SMS/WhatsApp/contractor dispatch adapter is connected after approval.
- **Bank Feed Live Connectivity (`feature/bank-feed-matching`)**: Open Banking / GoCardless sync is stubbed behind `FEATURE_BANK_FEED_ENABLED=false`; only deterministic local transaction-to-rent-charge matching logic is implemented.
- **Active Recurring Routines**: All four JM Letvest schedules in `SCHEDULE.md` are inactive (`days: off`) by default and require an external OS scheduler (Task Scheduler / cron) plus explicit owner activation.
- **Master Specification Platform Items**:
  - Full membership lifecycle, user invitation/SSO, fine-grained capabilities, per-action human approver assignment, immutable approval configuration history and production security review in `AI-Employee`.
  - PDF/office uploads, connected-document refresh, FTS/semantic hybrid retrieval, contradiction/staleness detection, embedding/index deletion, cache invalidation and retention propagation.
  - Rich memory editing/export UI and automated approved outcome-memory proposals.
  - Distributed/checkpointed long work, process kill testing during an external call, provider polling, heartbeat dashboards and tested production receipt reconciliation.
  - Full browser/computer isolation, voice progress narration, standalone mobile/desktop applications and authenticated remote hosting.

These are engineering and operational tasks, not merely missing API keys. The application must **not** be marketed or treated as production-ready. Current code has been committed to local feature branches only and has not been pushed or deployed.
