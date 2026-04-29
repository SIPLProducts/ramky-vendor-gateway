## Goal

Today the Form Builder shows built-in tabs (Document Verification, Organization Profile, Address, Contact, Financial) as **locked** with an empty fields list. You want each built-in tab to **list all real fields** that the vendor sees in that tab, so admins can:

- See every field already in the vendor form (PAN, GSTIN, Legal Name, CEO Name, Bank IFSC, Registered Address, etc.).
- Hide / remove a field they don't want to collect.
- Re-add a removed field later (restore default).
- Add brand-new custom fields below the built-in ones.

This applies to all built-in tabs: Document Verification, Organization Profile, Address Information, Contact Details, Financial & Infrastructure.

## Approach

### 1. Build a catalog of built-in fields

Create `src/lib/builtInFields.ts` exporting a typed list of every field currently hardcoded in the vendor step components, grouped by `step_key`. Each entry includes:

- `field_name` (e.g. `gstin`, `ceoName`, `registeredAddress`)
- `display_label`, `field_type`, `is_mandatory` (matching today's behavior)
- `placeholder` / `help_text` where useful
- `display_order` to preserve existing on-screen order

Source of truth comes from the existing files:

- `DocumentVerificationStep.tsx` — GST registration toggle, GSTIN, Legal Name (GST), Trade Name, PAN Number, PAN Holder Name, MSME toggle, Udyam Number, Enterprise Name, Bank Account Number, IFSC, Bank Name, Branch, Account Holder Name + 4 file uploads.
- `OrganizationStep.tsx` — Buyer Company, Legal Name, Trade Name, Industry Type, Organization Type, Ownership Type, Product Categories, State, Entity Type, Firm Reg #, PF, ESI, IEC, SWIFT/IBAN, Labour Permit, Memberships, Enlistments, Certifications, Operational Network.
- `AddressStep.tsx` — Registered / Manufacturing / Branch address blocks (full set of `register('...')` names already inventoried).
- `ContactStep.tsx` — CEO, Marketing, Production, Customer Service contacts (name / designation / phone / email).
- `FinancialInfrastructureStep.tsx` — Turnover Y1-Y3, credit period, major customers, distributor, raw materials, machinery, power, water, DG, capacities, manpower, transport, product types, lead time, QHSE issues.

### 2. Surface built-ins in the Form Builder UI

In `src/pages/FormBuilder.tsx` change the right-hand "Fields" pane so it shows:

```text
Fields (28)
├─ [Built-in] GSTIN              text   Required   [Hide] [Restore]
├─ [Built-in] Legal Name (GST)   text   Required   [Hide]
├─ [Built-in] PAN Number         text   Required   [Hide]
├─ ...
├─ ─── Custom fields ───
└─ Preferred Delivery Slot       select            [Edit] [Delete]
```

For each built-in field row:

- Show a small **"Built-in"** badge (reuse existing `Badge`).
- If the admin has not overridden it → show a **Remove** (eye-off) button. Clicking it inserts a row in `form_field_configs` with `is_visible = false` and a marker so we know it's a built-in override.
- If a built-in is currently hidden → show a **Restore default** button that deletes that override row.
- Allow editing of label / placeholder / required only (field_name and field_type stay locked for built-ins) by reusing `InlineFieldEditor` in a "built-in mode".

Custom fields keep today's full Edit / Delete / drag-reorder behavior and are listed below the built-ins.

The "Add Field" button still adds a new custom field appended to the bottom.

### 3. Make the vendor form respect the overrides

Add a tiny helper hook `useBuiltInFieldOverrides(tenantId, stepKey)` that returns a map `{ [field_name]: { is_visible, is_mandatory, display_label, placeholder } }` derived from `form_field_configs` rows whose `field_name` matches a known built-in.

In each step component (`DocumentVerificationStep`, `OrganizationStep`, `AddressStep`, `ContactStep`, `FinancialInfrastructureStep`) wrap each rendered field with:

```tsx
const cfg = overrides['gstin'];
if (cfg?.is_visible === false) return null;
// otherwise render as today, optionally using cfg.display_label / cfg.is_mandatory
```

Validation schemas (`zod`) are tweaked so a hidden field becomes optional — we don't want zod to block submit on a field the admin removed.

Custom fields configured by the admin continue to render through the existing `DynamicStep` mechanism on custom tabs; we are **not** changing how custom tabs work.

### 4. Storage convention

We piggy-back on the existing `form_field_configs` table (no schema change). Built-in overrides are normal rows where:

- `step_name` = the built-in `step_key`
- `field_name` matches the catalog entry
- `default_value = '__builtin_override__'` acts as the marker so the UI can tell them apart from custom fields

This keeps RLS, queries, and the existing hooks unchanged.

## Files touched

- **New:** `src/lib/builtInFields.ts` (catalog)
- **New:** `src/hooks/useBuiltInFieldOverrides.tsx`
- **Edit:** `src/pages/FormBuilder.tsx` (render built-ins + Hide/Restore actions)
- **Edit:** `src/components/admin/InlineFieldEditor.tsx` (lock `field_name` / `field_type` when editing a built-in)
- **Edit:** `DocumentVerificationStep.tsx`, `OrganizationStep.tsx`, `AddressStep.tsx`, `ContactStep.tsx`, `FinancialInfrastructureStep.tsx` (respect overrides; relax zod for hidden fields)

## Out of scope

- Reordering built-in fields against each other (they keep their natural order; only custom fields stay drag-reorderable).
- Changing field types of built-ins (would break verification + DB columns).
- Touching the `review` tab.

Approve and I'll implement it.