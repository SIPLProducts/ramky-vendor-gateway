## Why the table is empty

The "GST Compliance Report" tab in the vendor review dialog (`src/components/vendor/VendorReviewDialog.tsx`) reads its rows from one place only:

```
vendor_validations.details.filing_status   (validation_type = 'gst')
```

For this vendor (`BRICKWORK RATINGS INDIA PRIVATE LIMITED`, GSTIN `29AADCB3136C1Z3`) there is **no `vendor_validations` row at all** — confirmed against the DB:

```
legal_name                                    status  filing_status length
BRICKWORK RATINGS INDIA PRIVATE LIMITED       NULL    0
Brickwork Ratings India Private Limited       NULL    0
```

So `gstReport.filingRows.length === 0` and the dialog renders the placeholder "No filing data captured for this vendor."

The header tiles (Compliance Score 70%, GST Status Active, Last Filed Return Apr 2026, etc.) look populated only because `buildGstComplianceReport` has hard‑coded fallbacks for those scalar fields — but it intentionally does not fabricate filing rows.

Why the registration GST tab shows a table while this dialog does not:
- During registration, `GstKycTab` calls the GST_FILING provider live and renders whatever the API returns — it does not depend on the DB.
- `GstKycTab.persistGstValidation` only writes the row when `props.vendorId` is set **and** the user actually clicks Verify in this session. Vendors that were seeded, imported, or whose KYC was run before the persistence step existed have no row, so the dialog can't find anything.

## Fix

Make the Compliance Report dialog self‑healing: if the persisted `filing_status` is empty, fetch it live (same provider the GST tab uses) and render the result.

### Changes (UI / presentation only)

1. **`src/components/vendor/VendorReviewDialog.tsx`**
   - After loading `gstValidation`, if `normalizeFilingStatus(details.filing_status)` is empty **and** `vendor.gstin` is present, call the configured provider:
     ```ts
     useConfiguredKycApi().callProvider({
       providerName: 'GST_FILING',
       input: { gstin: vendor.gstin, id_number: vendor.gstin },
     })
     ```
   - Hold the result in a new `liveFilingRows` state; pass it into `buildGstComplianceReport` as a third argument (or merge into a local `effectiveFilingStatus`).
   - Show a small inline "Fetching latest filing status…" placeholder while the call is in flight, and "No filing data returned by GSTN." only after the live call completes empty (so the message is accurate).
   - Best‑effort persist the fetched rows back into `vendor_validations` (insert a row with `validation_type='gst'`, `status='passed'`, `details: { filing_status: <rows> }`) so subsequent opens are instant. Guarded by `vendor.id`; failures logged, not surfaced.

2. **No changes to** `GstKycTab`, `GstFilingStatusTable`, `useConfiguredKycApi`, edge functions, schema, or approval logic. Scalar fallbacks (score, status, dates) stay as they are.

### Verification

- Open SAP Sync → BRICKWORK vendor → "GST Compliance Report" tab → should show 3 most recent returns from the live provider instead of the placeholder.
- Re‑open immediately: should render from the freshly persisted `vendor_validations` row without a second network call.
- Vendor with no GSTIN: still renders the placeholder (nothing to query).
- Vendor that already has `filing_status` persisted (e.g. just finished registration): behaviour unchanged — no extra API call.

### Out of scope

- Backfilling historical vendors in bulk.
- Changing how the registration step persists GST data.
- Compliance score / risk‑level computation.
