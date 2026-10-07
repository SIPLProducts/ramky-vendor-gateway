# Correct SAP location, dashboard approver names, and rejection references

## 1. Send SAP location as empty
- Send `"location": ""` at the main payload level and inside each SAP vendor entry.
- Apply this consistently to single and bulk sync, including configured templates and the final outgoing request.
- Preserve the confirmed State and its SAP `region` mapping; leave all four address-line mappings unchanged.

## 2. Show the current approver below dashboard Status
- Keep the existing stage badge, such as SCM CO or SCM Head Review.
- Display the name of the person currently assigned to that stage beneath the badge, using the vendor’s actual buyer approval routing.
- Cover Buyer, SCM CO, SCM Head, Finance 1, Finance 2, and CEO Office. Do not show a previous approver or an arbitrary user for SAP/DMS or completed stages.
- Respect skipped stages, buyer/company assignment, and existing visibility permissions; show a dash when no assigned name can be resolved.
- Include approver names in dashboard search and Excel export without changing approvals or routing.

## 3. Use the real reference number in rejection emails
### Verified finding
The downstream rejection email currently queries `vendor_reference_number` and `vendor_code`, then falls back to the first eight characters of the vendor ID. The connected database has `reference_number`, not those two queried columns. This explains the code path that can produce a generic Vendor name and a short ID instead of the application reference.

The connected database contains reference `20260728001`; the exact Production email/vendor pairing has not been independently verified.

### Correction
- Read `reference_number` and the existing vendor naming fields, and check lookup errors rather than silently treating a failed lookup as missing data.
- Use the saved application reference in downstream rejection emails and verify the Buyer rejection and SAP return/closure notification paths use the same reference convention.
- Never display a shortened internal ID or SAP vendor code as “Vendor Reference Number.” If the reference is genuinely unavailable, show “Not Assigned” and record a safe diagnostic.
- Preserve recipients, rejection remarks, approval actions, and the currently disabled vendor registration/SAP-success emails.

## Technical scope
- SAP payload templates/builders and final single/bulk sync boundaries.
- Dashboard presentation and a permission-safe, batched current-approver lookup based on existing routing.
- Rejection notification functions, using the existing checked email invocation helper.
- Focused regression tests, architecture rules, and self-hosted deployment guidance; no destructive migration or unrelated workflow changes.

## Validation and deployment
- Verify empty SAP location at both payload levels while State, region, and address lines remain correct.
- Test dashboard names against actual routed approvers, including skipped stages and unassigned users.
- Verify rejection email content contains the saved reference and vendor name, with no short-ID fallback.
- Use an authorized account and Quality/test destinations for end-to-end checks; report any unavailable checks explicitly.
- Production requires the updated frontend and relevant function/shared files deployed together; replacing `dist` alone is insufficient.