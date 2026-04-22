

## Make OCR-extracted fields editable for manual corrections

### What you'll get

Today, after each document is OCR'd (PAN, GST, MSME, Bank cheque), the extracted fields are shown as **locked, read-only boxes**. If Gemini reads "RAJESH" instead of "RAJESH KUMAR", or misses one digit of an account number, there's no way to fix it — you'd have to re-upload a clearer scan and hope for the best.

This change unlocks every extracted field so you can review what the OCR captured and **type a correction inline** before continuing. The corrected values are what flow into the rest of the registration (Save Draft, Continue, downstream steps, and final submit).

### Behaviour after the change

For each of the 4 documents, once the green "Verified" panel appears:

- **PAN panel** — PAN Number, Holder Name → editable.
- **GST panel** — Legal Name, Trade Name, GSTIN, Constitution, Registration Date, Taxpayer Type, Centre/State Jurisdiction → editable. Status pill (Active/Cancelled/Suspended) stays as a badge — not user-editable. Business Nature and Additional Places (chip lists) stay read-only in this pass; they're rarely wrong and editing arrays needs a different UI. Principal Place of Business is already editable today — unchanged.
- **MSME panel** — Udyam Number, Enterprise Name, Enterprise Type → editable.
- **Bank panel** — Account Number, IFSC, Bank Name, Branch, Account Holder Name → editable.

Visual cues:
- Each field gets a subtle "Edited" pill next to its label the moment the user changes the OCR'd value, so reviewers can see what was manually overridden.
- A small one-line helper appears at the top of each verified panel: **"Review the extracted details. Click any field to correct it if the document was misread."**
- A "Reset to OCR" link per field restores Gemini's original value with one click.
- The lock icon is removed (it implies you can't edit). Background stays the muted style so OCR-filled fields still look distinct from blank inputs.

### Data flow

- Edits update the same `ocrData` object the component already holds, so `buildOutput()` automatically forwards the corrected values to `VendorRegistration` via the existing `onStageChange` / `onComplete` callbacks. No change to the parent or to `applyVerifiedDataToForm`.
- "Save Draft" and "Continue" continue to work exactly as today — they just see the edited values now.
- Cross-checks that depend on these fields (PAN-from-GSTIN match, name-match score) **re-run automatically** when the corrected value changes, so the score and any error banner stay accurate.
- Each manual edit is tracked locally as `edited: true` so the UI can show the "Edited" badge. (Not persisted as a separate column — the corrected value itself is the source of truth.)

### Files to touch

- `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - Replace the `ReadOnlyField` component used inside the verified panels with a new `EditableOcrField` that:
    - Accepts `value`, `originalValue`, `onChange`, `mono`, `label`.
    - Shows an "Edited" pill when `value !== originalValue`.
    - Shows a "Reset" link to revert to `originalValue`.
  - Add small helpers: `setOcrField(setDoc, key, value)` to mutate a single field on `gstDoc.ocrData` / `panDoc.ocrData` / etc.
  - Wire all four verified-panel grids (GST, PAN, MSME, Bank) to the new editable field.
  - Recompute `nameMatchScore` and the PAN-vs-GSTIN cross-check whenever the relevant edited values change (move both into `useEffect`s keyed on the OCR fields, instead of being set only at verify-time).
  - Add the one-line helper banner inside each `verifiedFields` block.

### Out of scope

- Business Nature and Additional Places chip arrays — read-only in this pass.
- GST Status badge — read-only (status comes from registry, not user-editable).
- The "self-declaration" flow (when user picks "Not GST registered") — already fully editable, no change.
- No DB migrations, no edge-function changes, no change to gating, tab auto-advance, Continue/Save Draft mechanics, or any other step.

