## Goal

Persist **PAN Holder Name** (the name returned by the PAN Comprehensive / OCR APIs — the name as registered with Income Tax against that PAN) on the vendor row, and display it everywhere PAN Number / PAN Status / Aadhaar Linked are shown.

## Current state

- The name is captured during document verification (`DocumentVerificationStep.tsx` → `formData.pan.holderName`, populated from OCR + PAN Comprehensive API) and only used indirectly (to prefill CEO name / legal name).
- There is **no `pan_holder_name` column** on `public.vendors`. It is not saved to the vendor row and therefore cannot be shown on any approval / review screen.
- Reports & built-in field metadata already reference a label `"PAN Holder Name"` (`src/lib/builtInFields.ts`, `src/pages/Reports.tsx`) but the column doesn't exist, so the export is always blank.

## Changes

### 1. Database — add column

Migration on `public.vendors`:

```sql
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS pan_holder_name text;
```

(No RLS / grants changes needed — inherits existing policies.)

### 2. Save the value

- `src/types/vendor.ts` — add `panHolderName?: string | null` to `StatutoryDetails`.
- `src/hooks/useVendorRegistration.tsx`
  - Submit payload (~line 489): add `pan_holder_name: formData.statutory.panHolderName || null`.
  - Rehydration (~line 667): `panHolderName: (vendor as any).pan_holder_name || ''`.
- `src/components/vendor/steps/DocumentVerificationStep.tsx` — inside the two `runPanVerify` success branches where `pan_status` / `pan_aadhaar_linked` are already flushed to `vendors`, also set `pan_holder_name: holderName` in the same `supabase.from('vendors').update(...)` block, and mirror into form state via `updateFormData({ statutory: { ...formData.statutory, panHolderName: holderName } })`.

### 3. Show it wherever PAN is displayed

Add a **PAN Holder Name** row directly under the PAN Number row, using the same styling already used for PAN Status / Aadhaar Linked. Files:

- `src/components/vendor/VendorReviewDialog.tsx` (used by SAP Sync and every stage approval screen via `StageApprovalView`)
- `src/pages/PurchaseApproval.tsx` — Details tab
- `src/pages/FinanceReview.tsx`
- `src/pages/DocumentVerification.tsx`
- `src/pages/VendorList.tsx` — vendor detail view
- `src/components/vendor/steps/ReviewStep.tsx` — vendor's own review before submit
- `src/lib/reports/loadVendorReport.ts` — include `pan_holder_name` in the report select so the existing `Reports.tsx` label finally has data.

Render pattern (matches existing rows):

```
<div>
  <span className="text-muted-foreground">PAN Holder Name:</span>{' '}
  <span className="font-medium">{(vendor as any).pan_holder_name || '-'}</span>
</div>
```

No wording variants — single label "PAN Holder Name" everywhere.

## Verification

1. Register/verify a vendor via PAN → confirm `vendors.pan_holder_name` is populated (matches OCR/API name).
2. Open every screen listed above → "PAN Holder Name" row appears next to PAN Number with the correct value.
3. Export a report → PAN Holder Name column is filled.

## Files touched

- New migration adding `pan_holder_name` column.
- `src/types/vendor.ts`
- `src/hooks/useVendorRegistration.tsx`
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- `src/components/vendor/VendorReviewDialog.tsx`
- `src/pages/PurchaseApproval.tsx`
- `src/pages/FinanceReview.tsx`
- `src/pages/DocumentVerification.tsx`
- `src/pages/VendorList.tsx`
- `src/components/vendor/steps/ReviewStep.tsx`
- `src/lib/reports/loadVendorReport.ts`
