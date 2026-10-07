# Roadmap

- [ ] Display responsible names for all dashboard approval stages and SAP Team, with clear missing-assignment/lookup messages.

- [x] Require explicit SAP DMS success confirmation; reject empty/error responses without changing documents or marking vendors synced.
- [x] Verify DMS confirmation regressions and the uploaded response; document self-hosted rollout and deploy the function to the connected backend.
- [ ] Verify DMS confirmation with live Quality SAP and deploy to self-hosted Quality/Production; blocked by unavailable test destination/server access.

- [x] Send empty SAP location in single/bulk payloads without changing State, region, or address lines.
- [x] Show routed approver names beneath dashboard Status, including search/export; verified with an existing SCM CO application in the signed-in UI.
- [x] Correct rejection notification application references and validate the changes with focused tests; updated functions deployed to the connected preview backend.
- [ ] Verify real rejection-email delivery and single/bulk SAP requests in Quality; blocked by unavailable test mailbox/SAP destination, and no real rejection or SAP transaction was performed.

- [x] Make password-reset email links stay on the requesting DEV, QA, or PROD portal.
- [x] Verify recovery tokens inside the Reset Password page.
- [x] Validate the updated flow and document the required self-host deployment.
- [x] Remove the legacy authentication-host fallback from password-reset emails.
- [x] Support older self-hosted authentication responses without exposing their configured hostname.
- [x] Stop deployments when the current direct-portal password-reset function is missing.
- [x] Match the vendor registration opening screen to the supplied split-screen reference and use the uploaded Ramky collage.
- [x] Add CEO Office skip functionality to the Approval Matrix and approval routing.
- [x] Add a safe Production database-authentication repair and deployment drift protection.
- [x] Add and enforce the missing self-hosted CEO Office skip migration.
- [x] Remove Credit Period Expected and standardize Material Group/Vendor Category requirements.
- [x] Stop vendor emails on registration submission and SAP Sync while preserving buyer notifications.
- [x] Restore buyer registration and downstream rejection emails, and preserve buyer-rejection emails to vendors.
- [x] Permanently preserve KYC provider grants, expose safe lookup failures, and add self-hosted OCR readiness checks.
- [x] Restore GST filing history and saved self-declarations when reopening vendor registration for editing.
- [x] Persist PAN–Aadhaar linkage as a definite boolean after every successful PAN Comprehensive response.
- [x] Isolate GST, PAN, MSME, and Bank replacements while preserving other tabs and re-running non-destructive cross-checks.
- [x] Preserve the previously accepted GST, PAN, MSME, or Bank PDF and tab fields when a replacement fails, showing the attempt error without saving the rejected file.
- [x] Use the latest saved Organization & Contact address in SAP confirmation, normalize only its State, and save confirmed address edits before sync.
- [x] Validate SAP address/state regression cases and document self-hosted deployment requirements.
- [ ] Verify authenticated SAP address save and sync end-to-end in Quality; blocked because the requesting preview account cannot access SAP Sync, and no Quality/test SAP destination is available here.
