## Goal

Apply strict PAN Comprehensive mappings, lock down auto-extracted fields as read-only across GST, PAN, MSME, and Bank tabs. Only the Udyam number input and its Validate button stay editable in MSME.

## Changes

### 1. PAN tab — `DocumentVerificationStep.tsx`
- **Mapping (exact rules):**
  - `Is Aadhaar Linked`:
    - `aadhaar_linked === true` → `"Aadhaar Linked with PAN"`
    - `false` / `null` / missing → `"Aadhaar Not Linked with PAN"`
  - `PAN Status`:
    - `status === "valid"` (case-insensitive) → `"Valid"`
    - anything else (invalid / null / missing) → `"Invalid"`
- Both fields render as **read-only** (no "Edited / Reset to OCR" chip, no manual typing).
- Values come only from the PAN Comprehensive API response (invoked right after PAN OCR, as already wired).

### 2. Read-only lockdown for auto-filled fields

Make every OCR/API-extracted field on these tabs read-only (disable inputs, remove "Edited / Reset to OCR" affordances):

- **GST tab** — GSTIN, Legal Name, Trade Name, Address, State, all registry fields.
- **PAN tab** — PAN Number, Holder Name, PAN Status, Is Aadhaar Linked.
- **Bank tab** — IFSC, Bank Name, Branch, Account Holder Name, Account Number (as extracted / verified).
- **MSME tab** — all extracted fields (Enterprise Name, Type, Registered On, etc.) read-only.
  - **Exception:** the `Udyam Number` input and its `Validate` button remain editable and clickable.

### 3. Review step
- Continues to show `PAN Status` and `Is Aadhaar Linked` using the same mapping helpers (already added), no format drift.

## Out of scope
- No changes to OCR calls, API providers, save/submit, Back/Refresh, tab order, or MSME Udyam validation logic.
- No DB / schema changes.
