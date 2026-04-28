## Add "Major Activity" to MSME Document Verification

Udyam/MSME certificates print a "Major Activity" line (e.g. "Manufacturing" / "Services / Trading"). Today we extract Udyam Number, Enterprise Name, and Enterprise Type. We will add Major Activity, OCR it from the uploaded certificate, and show it beside Enterprise Type — editable like the other OCR fields.

### What changes

1. **OCR schema** — `supabase/functions/ocr-extract/index.ts`
   - In the `msme` extraction tool schema, add a new property:
     - `major_activity` — string, description: "Major Activity printed on the certificate, e.g. Manufacturing, Services, Trading"
   - Keep it optional (not in `required`) so older/poor-quality scans still pass.

2. **Document Verification UI** — `src/components/vendor/steps/DocumentVerificationStep.tsx`
   - In the MSME tab's `verifiedFields` grid (currently Udyam Number, Enterprise Name, Enterprise Type), add a fourth `EditableOcrField`:
     - Label: "Major Activity"
     - Value bound to `msmeDoc.ocrData?.major_activity` with `setOcrField(setMsmeDoc, "major_activity", v)`.
   - Extend the local `msme` initial-data hydration (around line 202–214) and the `out.msme = { ... }` writer (around line 456–462) to round-trip `majorActivity`.
   - Update the inline `msme?` type at the top of the file (line 38) to include `majorActivity?: string`.

3. **No DB schema change** required for this step
   - The Document Verification screen stores the verified MSME object on the in-memory form snapshot it returns to the parent. Major Activity will flow alongside Enterprise Type in that same payload.
   - If/when we want to persist it to the `vendors` table or display it on Finance/Purchase review, that's a follow-up — out of scope here per the request ("add that field … beside the enterprise type").

### Files touched

- `supabase/functions/ocr-extract/index.ts` — add `major_activity` to MSME schema
- `src/components/vendor/steps/DocumentVerificationStep.tsx` — add field + hydrate/serialize

### Out of scope

- Adding a column to `vendors` for `msme_major_activity` (can be added later if you want it surfaced in Finance Review / SAP Sync).
- Changes to ComplianceStep or ReviewStep.
