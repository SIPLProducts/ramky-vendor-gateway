# PAN–Aadhaar Link Display: N/A For Non-Individual PANs

## What changes
In **View Details → All Details**, the "Is Aadhaar Linked" value will depend on the 4th character of the PAN:
- 4th character `P` (e.g. BRXPM1752N): show the current status, unchanged.
- Any other 4th character (e.g. AALCV5456F): show **N/A**.
- PAN missing: keep today's display.

Display-only. No change to PAN verification, API calls, saved data, reports, exports, or other screens.

## Technical details
- `src/lib/panComprehensive.ts`: add `formatAadhaarLinkedForPan(pan, linked)` — trims/uppercases the PAN; if length ≥ 4 and 4th char ≠ `P`, returns `N/A`; otherwise returns `formatAadhaarLinked(linked)`.
- `src/components/vendor/VendorReviewDialog.tsx` (All Details tab, line ~563): use the new helper with `v.pan` instead of `formatAadhaarLinked`.
- Add small tests next to existing tests for: `P` PAN shows existing status, `C` PAN shows N/A.
