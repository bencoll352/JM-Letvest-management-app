# Monday Arrears, Spread & Landlord Statement Report — 2026-11-09

**Role**: Rent and Finance Controller (`jm-rent-finance-controller`)
**Status**: `awaiting_approval` (1 Arrears Chase Draft + 1 Landlord Statement Draft Queued)
**Solicitor Check Required**: `true` — `[CHECK WITH A SOLICITOR]` (All rent arrears communications, tenancy payment terms, and landlord statements require owner approval and solicitor review before any legal notice or deduction is issued)

## 1. Portfolio Revenue vs Head Rent & Net Spread
| Property | Scheduled Room Revenue | Guaranteed Head Rent | Monthly Expenses | Void Loss | Net Monthly Spread | Citations |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| 14 Albion Terrace (`prop-fict-01`) | £3,850.00 | £2,200.00 | £540.00 | £0.00 | **£1,110.00** | `[record:property_pnl:prop-fict-01]`, `[record:master_leases:ml-fict-01]` |
| 22 Victoria Avenue (`prop-fict-02`) | £3,100.00 | £1,950.00 | £490.00 | £625.00 (1 void room) | **£660.00** | `[record:property_pnl:prop-fict-02]`, `[record:rooms:rm-fict-06]` |

## 2. Overdue Rent Ledger & Staged Drafts (`[CHECK WITH A SOLICITOR]`)
- **Payment `pay-fict-301`**:
  - Property & Room: Room 2, 14 Albion Terrace (`[record:sub_leases:sub-fict-12]`)
  - Occupant Ref: `[CONTACT:c-fict-202]` (PII redacted in LLM context)
  - Due Date: `2026-11-01` (8 days overdue)
  - Amount Overdue: **£650.00** (`[record:rent_payments:pay-fict-301]`)
  - Escalation Tier: **SOP-02 Tier 2 (Days 4–13 Formal Arrears Follow-Up)** (`[source:sop-jm-letvest-core-v1@v1]`)
  - Draft Queued: `draft-msg-fict-301` (`requiresApproval: true`, `check_with_solicitor: true`)

## 3. Draft Monthly Landlord Statement Queued (`[CHECK WITH A SOLICITOR]`)
- **Statement `draft-stmt-fict-11`**:
  - Master Lease: `ml-fict-01` (14 Albion Terrace, Landlord Ref `[CONTACT:c-fict-101]`)
  - Period: `2026-11`
  - Guaranteed Head Rent Due: **£2,200.00** (`[record:master_leases:ml-fict-01]`)
  - Authorised Deductions: **£0.00**
  - Net Payable (Subject to Owner Approval): **£2,200.00**

## 4. Missing Data (`INSUFFICIENT_DATA`)
- `INSUFFICIENT_DATA`: Bank payment reference string is not stored in `jm_letvest.rent_payments` for `pay-fict-301`. Please verify bank feed prior to approving `draft-msg-fict-301`.
