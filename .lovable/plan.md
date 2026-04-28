## Auto-fill Branch Name in Bank Details

Today the Branch field in the Bank Details tab is populated only from cheque OCR (`branch_name`). On many cheques the branch line is faint, cropped or not printed at all, so the field stays empty and the vendor has to type it.

We'll keep the current cheque-OCR behavior, and add an **IFSC fallback**: whenever the IFSC code is present but Branch (and/or Bank Name) is empty, we look the IFSC up and auto-fill Branch — and Bank Name and Bank Address if those are blank too.

### What changes

1. **New tiny helper** — `src/lib/ifscLookup.ts`
   - Calls the public Razorpay IFSC API: `https://ifsc.razorpay.com/<IFSC>`.
   - Returns `{ bank, branch, address, city, state }` or `null` on failure.
   - Validates IFSC format (`^[A-Z]{4}0[A-Z0-9]{6}$`) before calling.
   - In-memory cache so the same IFSC isn't re-fetched.

2. **Document Verification step** — `src/components/vendor/steps/DocumentVerificationStep.tsx`
   - After cheque OCR completes (in `runDocFlow` for the `cheque` branch, near line 267), if `ifsc_code` is valid AND `branch_name` is empty, call the IFSC helper and patch:
     - `branch_name` ← API `branch`
     - `bank_name` ← API `bank` (only if cheque OCR didn't return one)
     - `bankBranchAddress` state ← API `address` (only if user hasn't typed one)
   - Also trigger the same lookup whenever the user **edits the IFSC field manually** and Branch is empty — debounced, so it fires once they stop typing.
   - Show a subtle inline hint under the Branch field when it was filled from IFSC (e.g. "Auto-filled from IFSC"), so the vendor knows to verify.

3. **No DB or edge-function changes** — Razorpay's IFSC endpoint is public, free, no key required, and CORS-enabled, so it can be called straight from the browser.

### Out of scope
- Server-side caching of IFSC lookups.
- Changing how `validate-bank` derives branch (it already uses its own IFSC mapping during penny-drop).
- Backfilling branch for vendors already submitted.

### Files touched
- `src/lib/ifscLookup.ts` (new)
- `src/components/vendor/steps/DocumentVerificationStep.tsx` (cheque post-OCR hook + IFSC onChange hook + small "Auto-filled from IFSC" hint)
