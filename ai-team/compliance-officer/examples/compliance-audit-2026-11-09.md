# Statutory Compliance Audit — 2026-11-09

**Role**: Compliance Officer (`jm-compliance-officer`)
**Status**: `awaiting_approval` (2 Draft Renewal Bookings Queued)
**Solicitor Check Required**: `true` — `[CHECK WITH A SOLICITOR]` (Expired CP12 / HMO licensing impact requires legal & statutory compliance review)

## 1. Expired or Expiring Within 30 Days
| Property | Certificate | Expiry Date | Days Remaining | Status | Source Citation |
| :--- | :--- | :--- | :---: | :--- | :--- |
| 14 Albion Terrace, M14 5AA (`[record:properties:prop-fict-01]`) | `EICR` | `2026-11-18` | 9 days | `EXPIRING_WITHIN_30_DAYS` | `[record:certificates:cert-fict-102]`, `[source:sop-jm-letvest-core-v1@v1]` |
| 22 Victoria Avenue, M6 5PL (`[record:properties:prop-fict-02]`) | `CP12` | `2026-11-04` | -5 days | `EXPIRED` (`[CHECK WITH A SOLICITOR]`) | `[record:certificates:cert-fict-201]`, `[source:sop-jm-letvest-core-v1@v1]` |
| 22 Victoria Avenue, M6 5PL (`[record:properties:prop-fict-02]`) | `HMO Licence` | `2026-12-03` | 24 days | `EXPIRING_WITHIN_30_DAYS` (`[CHECK WITH A SOLICITOR]`) | `[record:certificates:cert-fict-205]`, `[source:sop-jm-letvest-core-v1@v1]` |

## 2. Draft Renewal Bookings Queued for Owner Approval
1. **Draft Job Request `draft-job-fict-01` (CP12 Renewal — 22 Victoria Avenue)**:
   - Proposed Contractor: Northern Gas Safe Services (`[record:contractors:con-fict-01]`, Gas Safe vetting ref `GS-998120`, insurance valid until `2027-06-30`).
   - Proposed Spend Cap: £95.00 (`requiresApproval: true`).
2. **Draft Job Request `draft-job-fict-02` (5-Year EICR Renewal — 14 Albion Terrace)**:
   - Proposed Contractor: Peak NICEIC Electrical Ltd (`[record:contractors:con-fict-02]`, vetting ref `NIC-441209`, insurance valid until `2027-04-15`).
   - Proposed Spend Cap: £240.00 (`requiresApproval: true`).

## 3. Missing Data (`INSUFFICIENT_DATA`)
- `INSUFFICIENT_DATA`: No `PAT` certificate row exists in `jm_letvest.certificates` for **22 Victoria Avenue** (`[record:properties:prop-fict-02]`). Cannot verify portable appliance compliance until a certificate record is added (`[source:sop-jm-letvest-core-v1@v1]`).
