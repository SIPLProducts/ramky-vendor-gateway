## Goal
Make the two Classification groups in the SAP Field Confirmation dialog (`Vendor_Details` and `Vendor_CFSTMT`) mutually exclusive, so only one contributes values to the SAP payload at a time.

## Behavior
- Add a small selector at the top of the Classification section (radio group with two options: `Vendor_Details` and `Vendor_CFSTMT`). Default to `Vendor_Details`.
- When the user switches to `Vendor_Details`:
  - Clear `classify.CASH` and `classify.TIER` (so `CASHFLOW` and `VENCATEGORY` go out as `[]`).
  - Disable the Vendor_CFSTMT card (greyed out, dropdowns non-interactive) to visually indicate it is unchecked.
- When the user switches to `Vendor_CFSTMT`:
  - Clear `classify.MGV`, `classify.CATV`, and `classify.IDS` (so `MAT_GRP_VENDOR`, `CAT_VENDOR`, `IDENTIFICATION_SOURCE` go out as `[]`).
  - Disable the Vendor_Details card.
- Initial default when opening the dialog: pick `Vendor_CFSTMT` if the vendor already has cashflow/tier defaults but no material-group/category defaults; otherwise `Vendor_Details`.

## Technical details
- File: `src/components/sap/SapFieldsDialog.tsx`
  - Add local state `classifyMode: 'details' | 'cfstmt'`.
  - Add a `RadioGroup` (shadcn) above the two cards.
  - On mode change, call `setForm` to reset the arrays of the opposite side to `[]`.
  - Pass a `disabled` prop through to the `MultiSelect` used inside `SapF4MultiSelectField` on the inactive card (or wrap the card in a `pointer-events-none opacity-50` container as a lightweight approach).
  - Initial mode chosen inside the existing `useEffect` that builds defaults from the vendor, based on which side has any prefilled values.
- No changes to the backend edge functions: they already send whatever arrays the frontend supplies, so empty arrays will map to `[]` in the SAP payload for the disabled side.
- No changes to `sapPayloadBuilder.ts` needed — the dialog owns the final `classify` state passed to `onConfirm`.

## Out of scope
- No changes to `sync-vendor-to-sap` / `sync-vendors-to-sap-bulk` edge functions.
- No changes to registration-time capture of classification defaults.
