# Acquisition Pipeline & Deal Analyser Report — 2026-11-09

**Role**: Landlord Acquisition Scout (`jm-landlord-acquisition-scout`)
**Status**: `awaiting_approval` (1 Draft Landlord Follow-Up Queued)
**Solicitor Check Required**: `true` — `[CHECK WITH A SOLICITOR]` (Subject-to-contract guaranteed rent proposal & head-lease terms require owner and solicitor review)

## 1. Pipeline Deal Evaluation (`SOP-04`)
| Deal ID | Property Address | Rooms | Stage | Baseline Spread / Mo | Spread / Room | Stress Test (12% Void + 15% Bills) | Verdict | Citations |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| `deal-fict-09` | 88 Clarendon Road, M16 8AA | 6 | `2` (Viewing & Inspection) | £980.00 | £163.33 | +£565.00/mo | **PASS** (`>= £150/room/mo`) | `[record:deals:deal-fict-09]`, `[source:sop-jm-letvest-core-v1@v1]` |
| `deal-fict-10` | 5 Beechwood Grove, M19 2QP | 4 | `1` (Initial Contact) | £440.00 | £110.00 | +£85.00/mo | **BELOW TARGET** (`< £150/room/mo`) | `[record:deals:deal-fict-10]`, `[source:sop-jm-letvest-core-v1@v1]` |

## 2. Draft Landlord Follow-Up Queued (`[CHECK WITH A SOLICITOR]`)
- **Draft Message `draft-msg-fict-deal-09`**:
  - Deal: `88 Clarendon Road` (`[record:deals:deal-fict-09]`, Contact Ref `[CONTACT:c-fict-401]`)
  - Action: Post-viewing follow-up requesting confirmation of current Mandatory HMO Licence expiry and utilities bills so the Owner can finalise a subject-to-contract guaranteed rent proposal (`requiresApproval: true`, `check_with_solicitor: true`).

## 3. Missing Data (`INSUFFICIENT_DATA`)
- `INSUFFICIENT_DATA`: Deal `deal-fict-10` (`5 Beechwood Grove`) does not have room-by-room floor area measurements or council selective licensing fee recorded in `jm_letvest.deals`. Cannot issue a commercial offer draft until verified.
