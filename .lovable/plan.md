## Problem
On the "Application Submitted Successfully" screen the Reference Number shows `A078E81B` (a UUID slice), while the popup dialog shows the correct `YYYYMMDDNNN` value.

## Root cause
`SuccessScreen` in `src/pages/VendorRegistration.tsx` (line 1547) is passed `referenceNumber={(existingVendor as any)?.reference_number}`. After submit, `existingVendor` in state is not refreshed, so `reference_number` is `undefined` and `SuccessScreen` falls back to `vendorId.slice(0, 8).toUpperCase()` (that's the `A078E81B`). The dialog works because it reads the fresh `vendor` object returned from `submitVendor` / `resubmitVendor`.

## Fix (frontend only, no DB change)
In `src/pages/VendorRegistration.tsx`:

1. Add state `const [submittedReferenceNumber, setSubmittedReferenceNumber] = useState<string | null>(null);`
2. In `handleSubmit`, after receiving `vendor`, capture:
   `setSubmittedReferenceNumber((vendor as any)?.reference_number ?? null);`
3. Pass it to `SuccessScreen`:
   `referenceNumber={submittedReferenceNumber ?? (existingVendor as any)?.reference_number ?? undefined}`

## Not changed
- DB reference-number logic (already fixed in prior migration).
- `SuccessScreen` component itself — still uses `referenceNumber || vendorId.slice(0,8)` fallback, unchanged.
- Popup dialog — already correct.
