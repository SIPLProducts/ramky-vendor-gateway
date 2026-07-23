
## Goal

Change **only** the visibility and mandatory rules of the "Classification" card (Material Group for Vendors + Vendor Category). Do not touch how classification values are stored, sent to SAP, or read back.

## Behaviour matrix

| Flow | Where "Classification" appears | Mandatory? |
|---|---|---|
| Vendor registration via email invitation | Hidden in Organization step | No |
| On-behalf vendor creation (`?onBehalf=1` / `?onBehalfOf=...`) | Visible in Organization step (current behaviour) | No (unchanged) |
| Buyer Approval popup | New Classification section shown above Comments | Yes — Approve blocked until both values selected |
| SCM CO / SCM Head / Finance / CEO approval popups | Not shown | N/A |

## Changes

### 1. `src/components/vendor/steps/OrganizationStep.tsx`
- Add a prop `showClassification?: boolean` (default `true`).
- Wrap the existing `{/* SAP Classification (Domestic) … */}` block (lines ~446–484) in `{showClassification && ( … )}`. No other logic changes — schema fields stay optional, so hiding them does not affect validation.

### 2. `src/pages/VendorRegistration.tsx`
- Pass `showClassification={isOnBehalfMode}` when rendering `OrganizationStep` (line ~1479). The existing `isOnBehalfMode` flag (line ~274) already covers both the `?onBehalf=1` bootstrap and the persisted `?onBehalfOf=<id>` URL — so on-behalf keeps the card, email-invited vendors lose it.

### 3. `src/components/approvals/StageApprovalView.tsx` — Buyer-only Classification capture
- Add local state `buyerClassification` = `{ materialGroupVendor: string[]; vendorCategory: string[] }`, reset whenever `actionItem` opens or closes.
- When `isBuyer && actionItem?.action === 'approve'`, render a new panel **inside the existing approve/reject `Dialog`, above the Comments `Textarea`**:
  - Title "Classification" with the same `form-section` styling used elsewhere.
  - Two `ClassificationField` inputs (`material_group_vendor`, `vendor_category`) — reuse `@/components/vendor/ClassificationField`. Prefill from the vendor's current values by fetching `material_group_vendors, vendor_categories, material_group_vendor, vendor_category` from the `vendors` row when the dialog opens (small `supabase.from('vendors').select(...).eq('id', actionItem.item.vendorId).maybeSingle()`).
  - Both fields are mandatory: show `*` and a helper line "Required before approval."
- Disable the "Confirm approve" button when Buyer + approve + either classification array is empty (extend the existing `disabled={submitting || !comments.trim()}` check). Non-buyer stages and the reject flow are untouched.
- In `submit()`, when `isBuyer && actionItem.action === 'approve'`, first persist the selected classification to the vendor:
  ```
  await supabase.from('vendors').update({
    material_group_vendor: buyerClassification.materialGroupVendor[0] ?? null,
    material_group_vendors: buyerClassification.materialGroupVendor,
    vendor_category:        buyerClassification.vendorCategory[0] ?? null,
    vendor_categories:      buyerClassification.vendorCategory,
  }).eq('id', actionItem.item.vendorId);
  ```
  Then proceed with the existing `process-approval-action` invocation. Reject path, other stages, `extraPanel`, force-reject flow all remain unchanged.

## Out of scope (explicitly not touched)

- `IntlClassificationStep` and International flow — International vendors already capture classification in a dedicated step, unrelated to the Buyer stage.
- `useVendorRegistration` save/load, SAP payload builder, review dialogs, reports.
- Any other approval stage.
- Field-config / admin form-builder toggles.

## Technical notes for verification

- After changes, an email-invited vendor opens `Organization` and no Classification section appears; on-behalf creation still shows it.
- Buyer approval popup: "Confirm approve" stays disabled until both classification multi-selects have at least one value and comments are filled.
- Values chosen by the Buyer land on the `vendors` row before `process-approval-action` runs, so downstream SAP Sync sees them exactly as if the vendor had entered them.
