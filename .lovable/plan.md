# Fix: GST Filing Status Not Saved When Vendor Clicks Continue Early

## What the code does today (confirmed)
- After the GST certificate is verified, the portal calls the **GST** API (~2 s), then the **GST_FILING** API separately. In your log GST_FILING took **9.2 s**.
- Continue is **not blocked** while GST_FILING is still running. If the vendor clicks Continue during those seconds, the form is saved with no filing rows.
- The filing rows are saved only when the screen already has them. The final save also skips the filing step when the list is empty, so nothing is written.
- The fallback to the filing rows from the first GST response does not work, because those rows are dropped when the GST response is read.
- The filing-status save after GST_FILING needs an existing vendor record. On a brand-new invitation draft there may be none yet, so the save is skipped quietly. Save errors are not checked either.
- Both responses you shared hold real data. GST returns a flat list of 13 rows. GST_FILING returns a nested `[[...]]` list of 29 rows. The table code already reads both shapes, so the data itself is fine. Quality probably works because vendors there wait for the table before clicking Continue.

## Changes
All current features keep working the same way. Only the GST filing step gets new behaviour.
1. **Ask before continuing without filing data**
   - If the vendor clicks Continue while the filing check is still running, or after it returned no rows, a popup appears: "GST Filing Data Not Received. Continue Without GST Filing Data?"
   - **Yes:** move to the next tab. Filing data is still saved later if it arrives.
   - **No:** stay on the GST tab and call the GST_FILING API again straight away. A **Refresh Filing Status** button in the GST filing card does the same.
   - Works the same for email invitation links and returned applications.
   - When filing rows are present, Continue works as it does now, with no popup.
2. **Keep the filing rows from the first GST response**
   - Keep `filing_status` when the GST response is read, so it can serve as the fallback.
   - Show those rows straight away, then replace them with the fuller GST_FILING list when it arrives.
3. **Choose the best result**
   - Use the GST_FILING rows when present.
   - Use the GST rows when GST_FILING is empty, fails or times out.
   - Never replace saved rows with an empty list.
4. **Make sure the rows are saved**
   - Always pass the rows into the form data, under Statutory → GST Filing Status.
   - The final save writes them to the GST validation record once the vendor record exists, including on first-time drafts.
   - Replace the risky "delete then insert" with "update the latest GST row, or insert one", and check for errors.
5. **Clear on-screen status in the GST tab**
   - "Filing Status Received (N Returns)" in green.
   - "No Filing Data Returned By GSTN" in amber when both APIs return `[]`.
   - Keep the existing "Check Filing Status" retry button.
6. **Console logs** (same style as the OCR logs): `[GST_FILING] request`, `response rows=N source=GST_FILING|GST`, `persisted vendor=<id> rows=N`, or the error.

## Existing Data Stays Untouched
- No change to any existing vendor, validation record or document. No bulk update and no database change.
- View Details keeps working as it does today. It shows the live fetch when nothing is saved, and does not save that fetch.
- The new saving rules apply only to GST checks done from now on.

## Technical details
- Files: `DocumentVerificationStep.tsx` (`runGstFilingStatusCheck`, the GST response reading that maps `filing_status` into ocrData, Continue gating via `gstFilingChecking`, timeout), `useVendorRegistration.tsx` (filing-row save at about line 1234), `GstKycTab.tsx` (same fallback rules).
- Add a small `pickFilingRows(filingResp, gstResp)` helper with tests: nested GST_FILING wins; empty GST_FILING falls back to the flat GST list; both empty gives `[]` and leaves saved rows alone.
- Self-hosted Production needs the new frontend build deployed. No database change.
