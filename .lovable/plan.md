## Show "Major Activity" beside Enterprise Type in MSME details

### Current state
The "Major Activity" field is already wired into the MSME OCR schema and rendered in `DocumentVerificationStep.tsx` inside a 2-column grid right after "Enterprise Type", so on a fresh MSME upload it appears beside it and is auto-filled from the Udyam certificate.

In your screenshot the field is missing because that MSME certificate was extracted **before** `major_activity` was added to the OCR schema. The saved draft holds the old OCR JSON (no `major_activity` key), so the input renders blank — and the layout currently hides it on this row because the prior row already filled both columns. Visually, Enterprise Type ends up alone on its row.

### What this plan changes

1. **Force Major Activity to always render beside Enterprise Type**
   - In `src/components/vendor/steps/DocumentVerificationStep.tsx`, regroup the MSME `verifiedFields` so each logical row is its own grid:
     - Row 1: Udyam Number | Enterprise Name
     - Row 2: Enterprise Type | Major Activity
   - This guarantees Major Activity is visually adjacent to Enterprise Type even when its value is empty, and matches your screenshot intent.

2. **Auto-backfill `major_activity` for already-uploaded MSME docs**
   - When the step mounts and `msmeDoc.status === "verified"` but `ocrData.major_activity` is missing, re-run OCR on the stored MSME file in the background (silent, no UI disruption) and merge `major_activity` into both `ocrData` and `originalOcrData`.
   - If the file is no longer in memory (only saved as a storage path), skip the re-OCR and just leave the field editable with placeholder "—" so the vendor can type it. A small inline hint "Couldn't read Major Activity from the certificate — please enter manually" will appear under the field in this case.
   - The OCR extract path already exists (`useOcrExtraction` → `ocr-extract` edge function) and `major_activity` is already in the MSME schema, so no edge function or DB changes are needed.

3. **Persist Major Activity into the form payload**
   - Already handled (lines 208 and 510 read/write `majorActivity`), so no extra wiring is required — only confirm the value flows into the saved draft after backfill.

### Out of scope
- Changing the OCR model or schema.
- Backfilling Major Activity for vendors who have already submitted (final) registrations.
- Adding Major Activity as a manual field outside the MSME card.

### Files touched
- `src/components/vendor/steps/DocumentVerificationStep.tsx` (regroup MSME grid into two rows + add silent re-OCR effect for missing `major_activity`)
