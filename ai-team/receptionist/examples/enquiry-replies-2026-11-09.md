# First-Line Enquiry Draft Replies — 2026-11-09

**Role**: Receptionist (`jm-receptionist`)
**Status**: `awaiting_approval` (2 SOP-Backed Draft Replies Queued; 1 Escalated Refusal)
**Solicitor Check Required**: `true` — `[CHECK WITH A SOLICITOR]` (Enquiry #3 involves early tenancy surrender & deposit return rules)

## 1. Enquiry #1 — Prospective Room Applicant (Covered by `SOP-05`)
- **Enquiry**: "Do you have any en-suite or double rooms available in Salford this month?"
- **Draft Reply (`draft-msg-fict-rec-01`)**:
  - "Thank you for contacting JM Letvest. We currently have **Room 6 at 22 Victoria Avenue, Salford M6 5PL** available at an advertised rent of **£625.00 per calendar month** (`[record:rooms:rm-fict-06]`). All viewings and applications are subject to standard referencing and inventory scheduling (`[source:sop-jm-letvest-core-v1@v1]`). Would you like our team to contact you to arrange a viewing?"
  - **Approval Gate**: `requiresApproval: true` (Held in approval queue).

## 2. Enquiry #2 — Landlord Guaranteed Rent Enquiry (Covered by `SOP-05`)
- **Enquiry**: "I own a 5-bed house in Manchester M14 and want to know how your guaranteed rent scheme works."
- **Draft Reply (`draft-msg-fict-rec-02`)**:
  - "Thank you for getting in touch with JM Letvest. Under our guaranteed rent model, we agree a fixed monthly head-lease rent with no letting fees, and our team handles internal cosmetic refurbishment, room management, and statutory HMO compliance (`[source:sop-jm-letvest-core-v1@v1]`). We never quote a guaranteed rent figure before inspecting the property (`[source:sop-jm-letvest-core-v1@v1]`). Could you share the full postcode, bathroom count, and current HMO licensing status so our Owner can arrange a property assessment?"
  - **Approval Gate**: `requiresApproval: true` (Held in approval queue).

## 3. Enquiry #3 — Occupant Requesting Early Surrender & Deposit Deduction Waiver (Refused — Outside SOP)
- **Enquiry**: "I want to end my room agreement 4 months early and use my DPS deposit for this month's rent."
- **Verdict**: `INSUFFICIENT_DATA: Enquiry outside approved SOP scope — escalated for Owner review` (`[source:sop-jm-letvest-core-v1@v1]`).
- **Solicitor Flag**: `[CHECK WITH A SOLICITOR]` (`check_with_solicitor: true` — touches tenancy surrender wording, rent arrears, and DPS deposit rules). No reply drafted without Owner and legal instruction.
