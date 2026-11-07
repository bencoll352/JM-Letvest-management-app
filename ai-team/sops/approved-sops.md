# JM Letvest Approved Standard Operating Procedures (SOPs)

Document ID: `sop-jm-letvest-core-v1`
Scope: `business`
Status: `approved`

## SOP-01: Statutory Compliance & Certificate Renewal Lead Times
1. Every managed HMO property must hold valid, unexpired records for the five core statutory compliance categories:
   - **CP12** (Annual Gas Safety Record — Landlord and Tenant / Gas Safety (Installation and Use) Regulations 1998): Renew every 12 months. Flag at **30 days** before expiry.
   - **EICR** (Electrical Installation Condition Report — Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020): Renew at least every 5 years (or earlier if specified on the certificate). Flag at **30 days** before expiry.
   - **PAT** (Portable Appliance Testing for landlord/operator-supplied electrical appliances): Renew every 12 months. Flag at **30 days** before expiry.
   - **EPC** (Energy Performance Certificate): Minimum rating E (or higher if updated by statutory Minimum Energy Efficiency Standards). Renew every 10 years. Flag at **30 days** before expiry.
   - **HMO Licence** (Mandatory, Additional, or Selective Council Licence under Housing Act 2004 Parts 2 & 3): Flag at **30 days** (and escalate at 60 days in weekly owner review) before expiry.
2. When any certificate is expired or expires within 30 days, the Compliance Officer must draft a renewal booking request via `create_job_request` and `create_draft_message` using a vetted contractor whose public liability insurance (`insurance_expires_on`) is valid beyond the proposed inspection date.
3. No room may be newly marketed or let in a property with an expired CP12, EICR, or mandatory HMO Licence.

## SOP-02: Rent Collection, Arrears Chasing & Landlord Statements
1. Occupant room rent is due on the `due_on` date recorded in `jm_letvest.rent_payments`.
2. **Arrears Escalation Tiers (Draft Only — Owner Approval & Solicitor Check Required)**:
   - **Day 1–3 Overdue (Courtesy Reminder)**: Friendly factual reminder quoting the exact `due_on` date, `amount`, and room reference. Must include payment reference instructions from the approved tenancy record.
   - **Day 4–13 Overdue (Formal Arrears Follow-Up)**: Written payment schedule request asking the occupant to confirm payment date or report financial hardship so the owner can review options.
   - **Day 14+ Overdue (Owner & Solicitor Escalation)**: Escalate to the Owner with a full payment ledger statement. Any mention of statutory notices, guarantor claims, payment plans, or possession steps MUST carry `check_with_solicitor: true` (`[CHECK WITH A SOLICITOR]`) and may never be sent without explicit owner and legal sign-off.
3. **Monthly Landlord Head-Rent Statements**:
   - Guaranteed head rent is payable according to `jm_letvest.master_leases.monthly_rent`.
   - Any proposed deduction for landlord-liable structural repairs must cite the specific `master_leases` clause and resolved `maintenance_tickets` record, and requires `check_with_solicitor: true` plus owner approval.

## SOP-03: Maintenance Fault Triage & Contractor Dispatch
1. Fault reports (`jm_letvest.maintenance_tickets`) are classified into three priority levels:
   - **Emergency** (Target response: within 4 hours; make-safe within 24 hours): Uncontained water leak, total loss of heating/hot water in winter, suspected gas leak (instruct resident immediately to call National Gas Emergency Service on 0800 111 999 and ventilate), exposed live electrical wiring, fire alarm panel fault, or insecure external door/ground-floor window.
   - **Urgent** (Target response: within 24 hours; resolution target: 3–5 working days): Partial heating/appliance failure, blocked shower/drain where another facility exists, internal door lock fault, damp/mould inspection request.
   - **Routine** (Target response: within 48 hours; resolution target: 14 working days): Cosmetic repairs, minor joinery, dripping tap, furniture repair/replacement.
2. **Contractor Selection Rule**:
   - Only suggest or draft a job request (`create_job_request`) for a contractor in `jm_letvest.contractors` whose `trade` matches the fault category and whose `insurance_expires_on` date is strictly in the future (`insurance_expires_on > current_date`).
   - If no vetted contractor with valid insurance exists for the required trade, flag `INSUFFICIENT_DATA: No vetted insured contractor on file for trade` and escalate to the Owner.
3. **Overdue Job Chasing**:
   - Any ticket remaining in `Open` or `Assigned` past its target response window must be flagged in the daily briefing with a draft contractor chase message and a draft tenant status update.

## SOP-04: Landlord Acquisition & Deal Analyser Thresholds
1. Every Rent-to-Rent (R2R) lead in `jm_letvest.deals` progresses through stages:
   - `0`: Lead Identified
   - `1`: Initial Landlord Contact
   - `2`: Viewing & Property Inspection
   - `3`: Deal Analyser & Guaranteed Rent Offer Drafted
   - `4`: Head Lease Heads of Terms / Solicitor Review
2. **Deal Scoring Criteria**:
   - **Target Minimum Net Spread**: At least **£150 per lettable room per month** after deducting guaranteed head rent (`master_leases.monthly_rent`), modelled operating expenses (utilities, council tax, broadband, cleaning, HMO licence amortisation, maintenance reserve), and a **5% baseline void allowance**.
   - **Stress Test Requirement**: Every deal evaluation must run a downside stress test (12% void rate + 15% utility cost increase). Deals that turn cash-flow negative under the stress test must be flagged as `HIGH_RISK_NEGATIVE_STRESS_SPREAD`.
   - Every commercial offer letter or heads-of-terms draft requires `check_with_solicitor: true` and explicit Owner approval.

## SOP-05: Receptionist First-Line Enquiry Handling
1. **Permitted Scope**:
   - **Tenant Enquiries**: Acknowledge maintenance reports (quoting SOP-03 target response times), provide room availability summaries from `void_rooms`, and explain standard check-in/inventory scheduling rules.
   - **Landlord Enquiries**: Explain JM Letvest's guaranteed fixed monthly rent model, no-let-fee structure, internal cosmetic refurbishment & HMO compliance management, and request property postcode + bedroom/bathroom count to schedule an owner call.
2. **Hard Refusal Boundaries**:
   - Never quote a guaranteed rent figure for an unassessed property.
   - Never give legal, tenancy, deposit dispute, eviction, or tax advice.
   - Never disclose another occupant's personal details, contact information, or rent status.
   - If an enquiry falls outside SOP-01 through SOP-05, return `INSUFFICIENT_DATA: Enquiry outside approved SOP scope — escalated for Owner review`.
