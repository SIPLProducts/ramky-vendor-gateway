## Why some fields don't show "Remove"

In `src/lib/builtInFields.ts` every field on the **Document Verification** tab and the first two fields on **Organization Profile** (`buyerCompanyId`, `legalName`) are flagged `locked: true`. In `FormBuilder.tsx` the Remove button is rendered as `disabled={bf.locked || ...}`, so those rows show only the gray "Verification" pill with no working Remove action. That's why fields like GSTIN, PAN, IFSC, Buyer Company, Legal Name look un-removable while Trade Name etc. can be removed fine.

You also asked for an **Edit** option on built-in fields (today only custom fields have one) and a **nicer visual design** for the whole fields panel.

## What I'll change

### 1. Make every built-in field removable (with a clear warning)

- Remove the hard `disabled` on locked rows. Locked fields will still show the **"Verification"** pill so admins know hiding them disables OCR/API verification for that block, and clicking Remove on a locked field opens a small confirm dialog:
  > "GSTIN drives GST verification. Hiding it will disable GST OCR + GSTIN lookup for this tenant. Continue?"
- Non-locked fields keep today's one-click Remove.
- Restore Default keeps working the same way (deletes the override row).

### 2. Add Edit on built-in fields

- New **Edit** button on every built-in row (pencil icon, same look as custom rows).
- Clicking it opens an inline editor (reuses `InlineFieldEditor` in a new `builtInMode`) where the admin can change:
  - Display label
  - Placeholder
  - Help text
  - Required toggle
- `field_name` and `field_type` stay locked (changing them would break DB columns + verification).
- Saving writes/updates the same override row in `form_field_configs` (with `default_value = '__builtin_override__'`). The vendor steps already read these via `useBuiltInFieldOverrides` so the new label/required will reflect on the vendor form automatically.

### 3. Redesign the fields panel

Goal: enterprise-clean, scannable, grouped — matches the rest of the SAP Fiori-inspired UI.

```text
┌─ Document Verification  [Built-in]  PAN / GST / MSME / Bank — OCR + API verified ─┐
│                                                                                    │
│  ┌─ GST ────────────────────────────────────────── 6 fields ─┐                    │
│  │ ▸ GST Registered?   checkbox · Required · Verification    [Edit] [Remove]      │
│  │   is_gst_registered                                                            │
│  ├──────────────────────────────────────────────────────────┤                    │
│  │ ▸ GSTIN             text · Required · Verification        [Edit] [Remove]      │
│  │   gstin                                                                        │
│  └──────────────────────────────────────────────────────────┘                    │
│                                                                                    │
│  ┌─ PAN ────────────────────────────────────────── 3 fields ─┐                    │
│  │ ...                                                                            │
│  └──────────────────────────────────────────────────────────┘                    │
│                                                                                    │
│  ── Custom Fields (2) ──────────────────────────── [+ Add Field] [Templates] ──   │
│  ┌────────────────────────────────────────────────────────────┐                  │
│  │ ⋮ Preferred Delivery Slot   select                  [Edit] [Delete]            │
│  └────────────────────────────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Concrete UI changes inside `src/pages/FormBuilder.tsx`:

- Group built-in fields by their `group` property into **collapsible group cards** (rounded card per group with a sticky header showing group name + field count). Replaces the current flat divided list with a small "GST", "PAN", "MSME", "Bank" header strip.
- Add small colored **icon chips** for field type (text / file / checkbox / select) instead of plain outline badges, using the existing `Badge` variants and tone matching the rest of the app (blue = built-in, amber = verification, green = required).
- Hidden rows render with a subtle striped background + an inline "Hidden — vendors won't see this" caption and a prominent **Restore Default** button (so it's obvious how to bring it back).
- Action buttons move to a right-aligned cluster: `[Edit]` (ghost) + `[Remove]` (destructive ghost) or `[Restore Default]` (primary ghost) when hidden.
- Same visual rhythm applied to the Custom Fields list (group divider, hover highlight, drag handle on the left) so both lists feel like one panel.
- Keep the existing top alert; rephrase to: "Built-in steps are locked. You can hide, edit labels, or restore any built-in field — verification-critical fields will warn before hiding."

### 4. Confirm dialog component

Add a tiny `ConfirmDialog` (reusing shadcn `AlertDialog`) for the "this field powers verification" warning so we don't rely on the browser `confirm()` for destructive built-in actions.

## Files touched

- `src/pages/FormBuilder.tsx` — group rendering, new Edit/Remove on built-ins, redesigned card layout.
- `src/components/admin/InlineFieldEditor.tsx` — accept a `builtInMode` prop that locks `field_name` + `field_type` inputs and writes the row with `default_value = '__builtin_override__'`.
- `src/lib/builtInFields.ts` — keep `locked` flag (used only for the warning copy, no longer disables the button).
- (optional) `src/components/ui/confirm-dialog.tsx` — small wrapper around `AlertDialog` for the verification-warning prompt.

## Out of scope

- Reordering built-in fields against each other (still natural order from the catalog).
- Changing `field_type` of built-ins (would break vendor form + DB columns).
- Touching the Review tab.

Approve and I'll implement.