## Issue

The previous prompt built a 4-tab KYC capture UI (GST / PAN / MSME / Bank) with manual entry and OCR upload + automatic API verification. That UI was wired only into the **vendor registration** form (`ComplianceStep.tsx`). On the page you're currently viewing — `/admin/kyc-api-settings` — only the configuration list (URL / payload / headers) is shown, with no way to actually exercise the manual-vs-OCR flow against the configured APIs.

This plan replicates the same 4-tab capture & validate experience inside the admin settings page as a **Live Test** panel, so admins can configure an API and immediately test it end-to-end the way vendors will.

## What to build

### 1. New "Live Test" tab on `/admin/kyc-api-settings`
Add a third top-level tab next to **OCR APIs** and **Validation APIs**:

```text
[ OCR APIs ] [ Validation APIs ] [ Live Test ]
```

Selecting **Live Test** renders the same 4 sub-tabs the vendor sees:

```text
┌─ Live Test (uses configured APIs) ────────────────────────┐
│ [ GST ] [ PAN ] [ MSME ] [ Bank ]                          │
├────────────────────────────────────────────────────────────┤
│ Per tab:                                                   │
│   GST  : Manual GSTIN + Verify  |  Upload GST cert + OCR   │
│   PAN  : Upload PAN card + OCR (manual disabled)           │
│   MSME : Manual Udyam + Verify  |  Upload cert + OCR       │
│   Bank : Upload cancelled cheque + OCR (manual disabled)   │
└────────────────────────────────────────────────────────────┘
```

This reuses the existing components verbatim:
- `KycTabs`, `GstKycTab`, `PanKycTab`, `MsmeKycTab`, `BankKycTab`
- `OcrUploadAndVerify`, `ManualEntryAndVerify`, `OcrComparisonCard`

So whatever the admin tests on this screen is exactly what the vendor will experience.

### 2. Light "scratch state" wrapper
Create `src/components/admin/KycLiveTestPanel.tsx` that holds local state for:
- `gstin`, `pan`, `msmeNumber`, `isGstRegistered`, `isMsmeRegistered`
- file slots: `gstCertFile`, `panCardFile`, `msmeCertFile`, `cancelledChequeFile`
- per-tab `KycStatus` map
- a top input for **Test Legal Name** (used by name-match checks in PAN / GST / MSME / Bank)

It renders `<KycTabs ... />` with the four tab components, identical wiring to `ComplianceStep.tsx` but without the form/submit logic.

### 3. Status banner under the panel
Show a compact result strip per tab after each verification:
- last response status (HTTP code + latency from `kyc-api-test` or the validate-* function)
- any extracted OCR fields and the API comparison rows (already provided by `OcrComparisonCard`)
- a "Clear" button to reset that tab

### 4. Verify the vendor-side already works
Quick sanity pass on `/vendor-registration` → Statutory & Compliance step to confirm `KycTabs` is mounted (it already is per the current `ComplianceStep.tsx`). No code changes needed there if it renders.

## Files

**New**
- `src/components/admin/KycLiveTestPanel.tsx`

**Edited**
- `src/pages/KycApiSettings.tsx` — add the third `Live Test` tab and render `<KycLiveTestPanel />` inside it.

No backend / migration / edge-function changes — the panel calls the existing `validate-gst`, `verify-pan`, `validate-msme`, `validate-bank`, and `ocr-extract` functions through the components that already invoke them.

## Out of scope

- Changes to admin CRUD of API endpoints (URL / headers / payload editor) — already working.
- Changes to vendor-side Compliance step layout — already wired to the 4 tabs.
- Persisting test runs to the database (kept as ephemeral scratch state).
