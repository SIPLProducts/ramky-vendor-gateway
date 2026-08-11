# Keep Every Tab's Entered Data When You Leave and Come Back

## What happens today

Most of what you type is already saved: the form auto-saves the draft ~2.5s after each change, "Save Draft" saves immediately, and uploaded GST/PAN/MSME/Bank documents are stored and re-attached when you reopen the registration. But three real gaps make it *look* like data was lost:

1. **Partial KYC progress on the Documents & Verification tab is not restored.** The restore logic only rebuilds the verified GST/PAN/MSME/Bank block when *both* PAN and a bank account number are present. If you finished only GST, or GST + PAN, and left, the tab reopens blank and you re-do the OCR and verification.
2. **Data entered in admin-defined custom tabs is never saved.** Those values are held in a separate piece of state (`customFieldValues`) that is not passed into any save call, so they never reach the database — even though the screen knows how to read them back.
3. **Verification badges / tab statuses are recomputed rather than remembered**, so tabs already marked Verified can show as unverified until re-checked, even when the underlying values were saved.

## What will change

- **Restore partial KYC.** Rebuild the Step 1 verified snapshot whenever *any* of GST, PAN, MSME or Bank data exists in the draft, instead of requiring PAN + bank together. Each block (GST, PAN, MSME, Bank, secondary bank, declaration files/reasons) is restored independently, so half-finished verification comes back exactly as left.
- **Save custom tab values.** Include `customFieldValues` in the payload for auto-save, Save Draft, submit and resubmit, so admin-defined tabs persist and reload like the built-in ones. The database column and the read-back logic already exist.
- **Remember verified status per KYC section.** Persist the existing per-section verification status columns on every draft save (not only at submit) and use them to re-mark the GST / PAN / MSME / Bank tabs as Verified on reopen, so you don't re-verify what already passed.
- **Return to the tab you left.** On reopening a draft, land on the first incomplete tab as it does now, but count partially verified Step 1 correctly so it doesn't push you backwards.
- **No change to reset behaviour.** Data is only cleared when you go Back to Main Screen / cancel, exactly as you asked.

## Technical notes

- `src/pages/VendorRegistration.tsx`
  - Hydration effect (~line 780-905): replace the `pan && bank.accountNumber` gate with per-block conditionals when building `step1Seed`; keep `setVerifiedData` called whenever the seed is non-empty.
  - Auto-save effect (~line 956), `handleSaveAsDraft` (~line 1395), submit and resubmit paths: pass `{ ...payload, customFieldValues }` to `saveVendor` / `submitVendor` / `resubmitVendor`; add `customFieldValues` to the auto-save dirty hash so edits in custom tabs trigger a save.
  - Seed KYC tab statuses from the vendor's `*_verification_status` columns on hydrate.
- `src/hooks/useVendorRegistration.tsx`
  - `formDataToVendorRecord` already maps `customFieldValues` -> `custom_field_values` (line 617); no change needed there.
  - Write the `gst_/pan_/bank_/msme_/name_match_verification_status` values on draft saves too (currently only computed in the submit path, ~line 1191).
- No database migration required — `vendors.custom_field_values` and the verification status columns already exist.

## Verification

Fill only GST on Step 1, save draft, leave the screen and come back: GST stays verified with its documents and the other sections stay open for completion. Repeat with a custom tab filled in, and with all four KYC sections done.
