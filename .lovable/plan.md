# Existing Vendor KYC Revalidation — Reviewed Solution Document (.docx)

## Deliverable
A new Word file `Existing_Vendor_KYC_Revalidation_Solution_Design_v2.docx` in Files, keeping your document's structure and Sharvi/Ramky styling. It adds review notes, a feasibility and gap analysis, updated APIs including DMS sync, and an approximate build-credit estimate. Your original file stays unchanged.

## 1. Review and Suggestions (added as a new section and inline notes)
- **Overall verdict:** Feasible on the current portal. About 60–65% can reuse what already works today: GST/PAN/MSME/Bank checks, OCR, penny drop, invitation links, the approval engine, email, audit logs, SAP connection and DMS sync.
- **Corrections to the draft:**
  - Section 3, Step 3 says the URL "carries vendor code or personal data", but FR-04 forbids this. Reword it to use only a random token.
  - The Client should be Ramky Group, with Sharvi Infotech as the implementation partner.
  - Section numbering skips from 6 to 9, and Sections 4, 7 and 8 are missing. Renumber, and add short sections for Data Model, Security, and Rollout.
  - Step 7 (approval) is cut off mid-sentence. Complete it to match FR-08.
- **Suggestions:**
  - Pilot 100 vendors before sending invitations in bulk to all ~3,700.
  - Send invitations in batches (for example 200 per day) to avoid email limits.
  - Reuse the existing Buyer / Finance / SCM CO approval matrix, not a new 5-level engine. Make Level 1 (Vendor Management) optional.
  - Start with Manual SAP sync plus re-read verification. Enable API sync for bank fields only after SAP approves the field allowlist.
  - Keep Udyam "Not Registered" with a declaration as a valid outcome, not a failure.
  - The OTP should go by email (current SMTP). SMS OTP needs a new provider, so mark it optional.
  - Store raw KYC responses in the existing validation history, not a new store.

## 2. Feasibility / Gap Matrix (new table)
Columns: Requirement | Exists Today | Gap | Effort (Low/Med/High).
- FR-01 SAP master sync (3,700 + incremental): partial today through SAP master fetch. **Gap:** a bulk Business Partner pull, staging table, history and retry. High.
- FR-02 Search: vendor list exists. **Gap:** an existing-vendor directory with a duplicate-request guard. Medium.
- FR-03 Read-only SAP view: **Gap:** a snapshot view kept separate from vendor input. Medium.
- FR-04 Invitation + OTP: invitations exist. **Gap:** an email OTP step, revoke, and token-hash lifecycle. Medium.
- FR-05 Self-service KYC: reuse the 4 KYC tabs. **Gap:** a slimmer 4-section form and the MSME declaration. Medium.
- FR-06 Verification engine: exists. **Gap:** a RETRY_REQUIRED status. Low.
- FR-07 Three-way comparison: **Gap:** new engine and screen. Medium.
- FR-08 Approval: exists. **Gap:** an "Existing Vendor" flow type, plus send-back and hold. Medium.
- FR-09 Reconciliation workbench with maker-checker: **Gap:** new. High.
- FR-10 Manual/API sync with re-read verification: SAP connection exists. **Gap:** a Business Partner update (PATCH) with field allowlist, re-read and compare. A guard blocks any create call. High.
- **DMS sync for revalidated documents:** DMS sync exists with all-success confirmation. **Gap:** push the new KYC documents against the existing SAP vendor code. This replaces documents only after SAP confirms success. Medium.
- Dashboard, reports, audit: partial. **Gap:** existing-vendor metrics. Medium.

## 3. API Section — Updated (replaces Section 6 table)
Keep the existing endpoints and add:
- `POST /api/sap-reconciliation/:id/dms-sync`: pushes approved revalidation documents to SAP DMS for the existing vendor code. It replaces older DMS documents only after explicit all-success SAP message rows.
- `GET /api/sap-reconciliation/:id/dms-status`: shows DMS sync status and history.
- `POST /api/existing-vendors/sap-sync` and `GET /api/existing-vendors/sap-sync/history`: start a bulk or incremental master sync and view its history.
- `POST /api/vendor-kyc/invitations/:id/revoke` and `.../resend`.
- Update the fixed backend sequence: "... validate reconciliation → **DMS document sync (replace) → DMS confirmation** → complete the request".
- Add a mapping column that names the current portal service each endpoint reuses (for example validate-gst, sync-vendor-to-dms, sap-master-fetch).

## 4. Approximate Build Credits (new section, clearly labelled as an estimate)
Assumes the existing portal is reused and the work is done in phases. Actual use depends on revisions and testing rounds.

| Phase | Scope | Approx. credits |
|---|---|---|
| 1 | Data model, SAP bulk + incremental sync screen | 60–90 |
| 2 | Directory, invitation + email OTP, revoke/resend | 50–70 |
| 3 | Vendor self-service 4-section form, MSME declaration | 50–70 |
| 4 | Three-way comparison + verification workbench | 40–60 |
| 5 | Approval flow type, send-back/hold | 30–50 |
| 6 | Reconciliation workbench, maker-checker, manual + API BP update, re-read verify | 80–120 |
| 7 | DMS replace sync for existing vendors | 25–40 |
| 8 | Dashboard, reports, audit, testing and fixes | 50–80 |
| **Total** | | **~385–580 credits** |

## Technical notes
- Generate with docx-js (US-Letter/A4 as in the original), using tables with fixed widths and real bullet lists.
- Check the output: run validation, convert to PDF, and inspect every page as an image before delivery.
