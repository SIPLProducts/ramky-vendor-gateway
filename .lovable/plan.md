## Changes

### 1. MSME — move cross-match message into info popover
`src/components/vendor/steps/DocumentVerificationStep.tsx` (~line 2623-2638)

Instead of rendering `msmeDoc.apiData.enterpriseNameMessage` as a green paragraph below the Enterprise Name field, pass it as `trailingInfo` to `EditableOcrField` so the message shows in the inline info-icon popover (same pattern already used for GST Legal Name, PAN Holder Name, Bank Account Holder Name at lines 2857 / 2988 / 3488).

- Compute `enterpriseInfo = msmeDoc.apiData?.enterpriseNameMessage ? { message, ok: true } : null`.
- Remove the standalone `<p>` block with the CheckCircle2.
- Add `trailingInfo={enterpriseInfo}` to the Enterprise Name `EditableOcrField`.

### 2. Renumber built-in wizard steps to 1..5 (currently 1,2,3,5)
`src/pages/VendorRegistration.tsx`

The legacy Contact Details tab was hidden by giving it id `4` and skipping it, so the header renders "1 2 3 5 6". Renumber sequentially:

- `builtInSteps` array (line 44): change ids to `1, 2, 3, 4` (Doc Verification, Organization Profile, Contact Details, Financial & Infrastructure). Review is appended dynamically.
- Update every hardcoded step id reference: `handleStepComplete(3, ...)` → keep as 3, `handleStepComplete(4, ...)` for AddressStep completion where it currently uses 3 for AddressStep; audit calls at lines 1493-1495 and 1193/1217 (legacy skip logic — remove those skips since step 4 no longer exists).
- Update `renderStep` switch: AddressStep now returns for step 3 → renumber so ContactStep/legacy no longer occupies a slot; remove the `case 4: return null` branch.
- Remove the "jump over 4" navigation logic in `handleNext`/`handleBack` (lines ~1193, 1217).

### 3. Contact Details — enforce 3-column layout in every card
`src/components/vendor/steps/AddressStep.tsx`

Grids are already `md:grid-cols-3`, but several rows only contain 1-2 fields and visually collapse. Confirm and, where needed, wrap short rows so remaining fields still occupy a third-width column (no `col-span-*` overrides that force half/full widths):

- Registered Office: Office Phone + Fax (row at line 353), Website + Email 1 (line 376), Contact 1 + Contact 2 (line 400), Email 2 alone (line 427) — verify each keeps `md:grid-cols-3` with no `col-span` widening.
- Manufacturing Unit block (line 486+) and Branch Details block (line 621+): same audit; ensure all inner grids are `md:grid-cols-3` (they already are per current file).
- Address Line 1 currently sits outside a grid (full-width). Move it into a `md:grid-cols-3` row where it spans `md:col-span-3` so alignment is consistent, but the other 3-col rows below remain 3-col.

No schema / validation / business-logic changes.

## Files touched

- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- `src/pages/VendorRegistration.tsx`
- `src/components/vendor/steps/AddressStep.tsx`
