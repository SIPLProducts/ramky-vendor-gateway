# Standardize date display to dd-mm-yyyy

All user-visible dates should render via the existing `formatDate` / `formatDateTime` helpers in `src/lib/dateFormat.ts` (already outputs `dd-MM-yyyy` / `dd-MM-yyyy HH:mm`). Replace ad-hoc `toLocaleDateString`, `toLocaleString('en-IN')`, and `date-fns` calls that produce other formats.

## Files to update

**1. `src/components/sap/ApprovalCommentsDialog.tsx`** (Approval Comments History dialog — screenshot 1)
- Replace the custom `formatIst` helper. Use `formatDateTime(iso, '—')` from `@/lib/dateFormat` so the Date & Time column shows `dd-mm-yyyy HH:mm` instead of `17 Jul 2026, 11:28 IST`.

**2. `src/components/vendor/VendorDocuments.tsx`** (Documents tab — screenshot 2)
- Line 255: replace `new Date(doc.uploaded_at).toLocaleDateString('en-IN')` with `formatDate(doc.uploaded_at)`.

**3. `src/components/vendor/VendorReviewDialog.tsx`** (GST Compliance Report — Registration Date)
- Line 679: wrap `gstReport.registrationDate` in `formatDate(...)` so the Registration Date renders `dd-mm-yyyy` regardless of API-returned format (fall back to raw string if parse fails).
- Lines 639, 650: replace `toLocaleDateString('en-IN')` with `formatDate(...)`.

**4. `src/pages/GstCompliance.tsx`** (mock GST filing rows)
- Lines 212–214: change `format(..., 'dd/MM/yyyy')` → `format(..., 'dd-MM-yyyy')` (or use `formatDate`). Leave `'MMM yyyy'` period labels as-is (that's a period label, not a date).

**5. `src/pages/FinanceReview.tsx`**
- Line 269: `toLocaleDateString('en-IN')` → `formatDate(vendor.submitted_at, '-')`.
- Line 483: `toLocaleString('en-IN')` → `formatDateTime(row.acted_at)`.

**6. `src/pages/DocumentVerification.tsx`**
- Lines 636 and 950: replace `toLocaleDateString('en-IN')` with `formatDate(...)`.

## Out of scope
- `src/components/pwa/ConnectionStatus.tsx` line 140 (relative "last online" indicator, not a formal date).
- Currency `toLocaleString('en-IN')` calls (numeric formatting, unrelated).
- Date input fields (`<input type="date">`) which use ISO natively.
- MSME `Registration Date` label at `ComplianceStep.tsx:582` is a form input label, no display change needed.

## Verification
- Open Approval Comments History → Date & Time shows `dd-mm-yyyy HH:mm`.
- Open vendor Documents tab → upload dates show `dd-mm-yyyy`.
- Open GST Compliance Report → Registration Date shows `dd-mm-yyyy`.
- Build passes.
