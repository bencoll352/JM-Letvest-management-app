# JM Letvest UK GDPR & Data Protection Compliance Checklist

> [!IMPORTANT]
> This checklist governs personal data processed across `AI-Employee`, `JM-Letvest-management-app`, and `Letvest-Property-Showcase` under the **UK General Data Protection Regulation (UK GDPR)** and the **Data Protection Act 2018**.
> Review this checklist with your legal/data-protection adviser before enabling live LLM API keys or processing real resident/landlord data.

---

## 1. Repository & Infrastructure Privacy Audit Findings

| Repository | Current GitHub Visibility | Audit Findings | Required Action |
| :--- | :---: | :--- | :--- |
| `bencoll352/AI-Employee` | **PUBLIC** | Previously contained 3 scraped Hacker News contacts in `crm/contacts.csv`, `crm/signals.jsonl`, `queue/2026-10-24-*.md` (now replaced with `@example.test` synthetic fixtures), plus tracked runtime logs (`runlog.jsonl`, `calls/call-log.jsonl`). | **Make repository PRIVATE immediately** (`gh repo edit bencoll352/AI-Employee --visibility private --accept-visibility-change-consequences`). |
| `bencoll352/JM-Letvest-management-app` | **PUBLIC** | Contains no committed secrets or real tenant data (`src/lib/data.ts` uses fictional sample rows), but exposes internal schema (`jm_letvest`) and Supabase project ref `wfkpjwstwwaftwypuuww` in `README.md`. | **Make repository PRIVATE immediately** (`gh repo edit bencoll352/JM-Letvest-management-app --visibility private --accept-visibility-change-consequences`). |
| `bencoll352/Letvest-Property-Showcase` | **PUBLIC** | Public marketing site. No committed secrets (`server/.env.example` contains placeholders only). | Keep public only if desired for open source; otherwise make private (`gh repo edit bencoll352/Letvest-Property-Showcase --visibility private --accept-visibility-change-consequences`). |

---

## 2. Lawful Basis for Processing (UK GDPR Article 6)

| Data Subject Category | Personal Data Elements | Lawful Basis (UK GDPR Art. 6) | Operational Purpose |
| :--- | :--- | :--- | :--- |
| **Room Occupants / Tenants** | Name, email, phone, room assignment, rent due/paid dates, deposit protection reference, maintenance fault reports. | **Art. 6(1)(b) Contract** (performance of room tenancy/licence agreement) & **Art. 6(1)(c) Legal Obligation** (Gas Safety, Electrical Safety, Deposit Protection, HMO licensing). | Rent ledger reconciliation, statutory compliance scheduling, and maintenance fault triage. |
| **Landlords (Property Owners)** | Name, email, phone, property address, guaranteed head-lease rent and dates, monthly statements. | **Art. 6(1)(b) Contract** (guaranteed rent head lease) & **Art. 6(1)(f) Legitimate Interests** (B2B property acquisition pipeline). | Head-lease administration, monthly statements, and property compliance coordination. |
| **Contractors** | Name, trade, phone, Gas Safe / NICEIC vetting reference, public liability insurance expiry date. | **Art. 6(1)(b) Contract** & **Art. 6(1)(f) Legitimate Interests**. | Dispatching vetted, insured tradespeople to resolve maintenance faults and renew certificates. |
| **AI-Assisted Drafting & Triage** | Pseudonymised operational records (`[CONTACT:<id>]`, `[REDACTED_EMAIL]`, `[REDACTED_PHONE]`). | **Art. 6(1)(f) Legitimate Interests** (internal administrative efficiency with mandatory human-in-the-loop review; no automated decision-making under Art. 22). | Preparing internal briefings and approval-gated draft messages/statements for Owner review. |

---

## 3. Data Minimisation & Technical Safeguards (UK GDPR Article 5(1)(c) & Article 25)

- [x] **Pre-LLM PII Redaction (`team/llm-adapter.mjs`)**:
  - `redactPersonalData()` strips email addresses (`[REDACTED_EMAIL]`), UK phone numbers (`[REDACTED_PHONE]`), National Insurance numbers (`[REDACTED_NI]`), bank sort codes (`[REDACTED_SORT_CODE]`), card/account numbers (`[REDACTED_CARD_OR_ACCOUNT]`), and replaces personal names with pseudonymous record tokens (`[CONTACT:<id>]`) before any prompt is sent to an external LLM API.
- [x] **No Automated Decision-Making (UK GDPR Article 22)**:
  - All 6 AI employees operate in read-only mode by default. Every outbound message, contractor job request, or landlord statement is queued as a draft (`pending_approval`) requiring explicit human Owner approval.
- [x] **Row-Level Security (RLS) Isolation**:
  - `SupabaseRlsClient` strictly rejects `service_role` keys (`SERVICE_ROLE_FORBIDDEN`) and authenticates as a dedicated `manager` account restricted by Postgres RLS.

---

## 4. Processor Agreements (UK GDPR Article 28 & International Transfers)

Before setting `LLM_ADAPTER=llm-provider-v1` with a live API key, the Owner must complete:

- [ ] **Sign a Data Processing Addendum (DPA)** with the chosen LLM API provider (OpenAI Enterprise/API DPA, Anthropic Commercial Terms DPA, or Google Cloud / Gemini API Data Processing Addendum).
- [ ] **Verify Zero Training on API Data**: Confirm that the API tier disables model training on customer API prompts and completions, and configure Zero Data Retention (ZDR) or maximum 30-day abuse-monitoring log retention.
- [ ] **International Data Transfer Safeguards**: Where the LLM provider or Supabase region processes data outside the UK/EEA, ensure the provider's DPA incorporates the **UK International Data Transfer Addendum (IDTA)** to the EU Standard Contractual Clauses (or UK-US Data Bridge certification where applicable).
- [ ] **Verify ICO Registration**: Confirm JM Letvest's ICO Data Protection Fee registration number is active and displayed on `Letvest-Property-Showcase`.

---

## 5. Data Retention Schedule (UK GDPR Article 5(1)(e))

| Record Type | Retention Period | Disposal / Archival Mechanism |
| :--- | :--- | :--- |
| **Signed Head Leases, Room Agreements & Deposit Records** | **6 years** after tenancy/lease end (Limitation Act 1980). | Encrypted archive in private Supabase Storage (`property-documents`). |
| **Statutory Safety Certificates (`CP12`, `EICR`, `PAT`, `EPC`, `HMO Licence`)** | Minimum **2 years** for CP12 (Gas Safety Regs) or duration of licence + **6 years** for civil liability defence. | Private Supabase Storage (`property-documents`). |
| **Unsuccessful Landlord Acquisition Leads (`deals`)** | **12 months** from last contact (unless opt-out requested earlier). | Purge inactive stage 0–1 leads annually. |
| **AI Drafts, Approval Queue & LLM Run Logs (`team-data/team.sqlite`)** | **90 days** for operational drafts and token logs; **12 months** for accepted financial/compliance audit trails. | Prune unaccepted drafts > 90 days; store `team-data/` outside OneDrive sync folders. |

---

## 6. Privacy Notice Update Requirement

The public privacy notice on `Letvest-Property-Showcase` has been updated on branch `feature/privacy-notice-ai-disclosure` to disclose:
1. Categories of personal data collected from landlords, tenants/occupants, and contractors.
2. Lawful bases (Contract, Legal Obligation, Legitimate Interests).
3. Use of internal, human-reviewed software and AI-assisted drafting tools with pseudonymisation/redaction, confirming that **no solely automated decisions with legal or similarly significant effects** are made regarding tenancies, applications, or deposits.
4. Data subject rights (access, rectification, erasure, restriction, objection, and right to lodge a complaint with the Information Commissioner's Office at `ico.org.uk`).
