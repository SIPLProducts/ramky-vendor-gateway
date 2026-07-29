## Goal
Show classification dropdown options in **Proper Case** (no ALL-CAPS like `BRICKS — Bricks`, `DISTRIBUTOR — DISTRIBUTOR`, `CONSTRUCTION — CONSTRUCTION`) in every place these dropdowns appear:

1. **SAP Field Confirmation** dialog — `src/components/sap/SapFieldsDialog.tsx`
2. **Bulk SAP Sync** dialog — `src/components/sap/MultipleSapSyncDialog.tsx`
3. **Approval** screen classification (Buyer approval / re-approval) — `src/components/approvals/StageApprovalView.tsx` via `src/components/vendor/ClassificationField.tsx`

The raw code/description that is sent to SAP is unchanged — only the visible label (and the chip shown when the option is selected) is reformatted using the existing `toProperCase` helper from `@/lib/textCase` (keeps `LTD`, `PVT`, `LLP`, etc. uppercase).

## Changes

### 1. `src/components/sap/SapFieldsDialog.tsx` — `SapF4MultiSelectField`
- Add optional `properCaseLabels?: boolean` prop.
- When true, wrap **both** `code` and `desc` with `toProperCase(...)` when building `labelText` (so `CONSTRUCTION — CONSTRUCTION` becomes `Construction — Construction`, `BRICKS — Bricks` becomes `Bricks — Bricks`).
- Pass `properCaseLabels` on the four classification usages (~lines 404, 411, 421, 429): Material Group for Vendors, Vendor Category, Vendor Cash Flow, Tier Category.
- Non-classification F4 selects (Company Code, Currency, Rec-Account, etc.) are left as-is — those are true SAP technical codes.

### 2. `src/components/sap/MultipleSapSyncDialog.tsx`
- Pass `properCaseLabels` on the same four `SapF4MultiSelectField` usages (~lines 325, 332, 342, 350).

### 3. `src/components/vendor/ClassificationField.tsx`
- Replace the local `toProperCase` with the shared helper from `@/lib/textCase` for consistent behavior with the SAP dialogs and the allowlist tokens.
- No structural changes; the option label already only shows `description`, which will now be properly cased across the approval screens as well.

## Out of scope
- No changes to `sapPayloadBuilder`, edge functions, DB rows, or the values stored on the vendor. Only display strings change.
