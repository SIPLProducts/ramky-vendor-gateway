

## Configurable Vendor Registration Form (Admin-driven)

Let customer admins add/edit tabs (steps), fields, field types, mandatory/visible flags, and option lists from a new admin screen — and have the vendor registration form render those changes automatically on save, without code changes.

### What you'll get

A new admin screen **"Form Builder"** (under Sharvi Admin Console → Form Builder tab, also exposed to `customer_admin` for their own tenant) where admins can:

- Add / rename / reorder / disable **tabs (steps)** beyond the 6 built-in ones (e.g. "QHSE", "Sustainability", "Insurance Details").
- For each tab, add / edit / reorder / delete **fields**.
- Per field, configure: label, field key, type (text, number, email, phone, date, select, multi-select, textarea, file, checkbox), placeholder, help text, default value, mandatory, visible, editable, validation regex, validation message, and options list (for selects).
- **Save** — the vendor registration form picks up the changes immediately on next load, no deploy.

Vendor side:
- The 6 core steps (Doc Verify, Org, Address, Contact, Fin/Infra, Review) stay as-is and continue to drive verification/gating.
- Any **custom tabs** added by admin appear as additional steps between Step 5 (Fin/Infra) and Step 6 (Review).
- Custom field values are saved as a JSON blob on the vendor record, surfaced in Review, and visible to finance/purchase reviewers.

### Screens

**1. Form Builder (admin)** — `/admin/form-builder`

```text
┌─────────────────────────────────────────────────────────────┐
│ Form Builder                          Tenant: Ramky ▼ [Save]│
├──────────────┬──────────────────────────────────────────────┤
│ TABS         │  Tab: QHSE Compliance                        │
│ ─────────────│  ─────────────────────────────────────────── │
│ 1 Doc Verify │  Tab Label  [QHSE Compliance        ]        │
│ 2 Org        │  Visible    [✓]   Order [7]                  │
│ 3 Address    │                                              │
│ 4 Contact    │  FIELDS                          [+ Add Field]│
│ 5 Fin/Infra  │  ┌──────────────────────────────────────┐    │
│ 6 QHSE  ✎    │  │ ⋮ ISO 9001 Cert No  text  Req  ✎ ⌫ │    │
│ 7 Review     │  │ ⋮ Last Audit Date   date  Opt  ✎ ⌫ │    │
│ [+ Add Tab]  │  │ ⋮ Safety Policy     file  Req  ✎ ⌫ │    │
│              │  │ ⋮ Industry Sector   select Req ✎ ⌫ │    │
│              │  └──────────────────────────────────────┘    │
└──────────────┴──────────────────────────────────────────────┘
```

**2. Field Editor (drawer)** — opens on field row click

```text
Field Key:       iso_9001_cert_no   (lowercase, underscores)
Display Label:   ISO 9001 Cert No
Field Type:      [ Text ▼ ]
Placeholder:     e.g. ISO-2024-1234
Help Text:       Enter your ISO 9001 certificate number
Default Value:   
Mandatory:       [✓]   Visible: [✓]   Editable: [✓]
Validation Regex: ^ISO-\d{4}-\d+$
Validation Msg:  Format: ISO-YYYY-NNNN
Options (select only):
  + Add option
                                              [Cancel] [Save]
```

**3. Vendor Registration form (auto-updated)**

The renderer reads the tab + field config at mount; any custom tab shows up as an extra step. Validation, mandatory checks, and Continue gating use the same rules as built-in steps.

### Data model (uses existing tables, adds one)

- `form_field_configs` already exists — reuse for **field-level** config (already supports `tenant_id`, `step_name`, `field_name`, `display_label`, `field_type`, `is_visible`, `is_mandatory`, `is_editable`, `display_order`, `placeholder`, `help_text`, `validation_regex`, `validation_message`, `options`, `default_value`).
- New table `form_step_configs` — for **tab/step** definitions:
  - `id`, `tenant_id`, `step_key` (e.g. `qhse_compliance`), `step_label`, `step_order`, `is_visible`, `is_built_in` (true for the 6 core steps so they can't be deleted), `created_at`, `updated_at`.
  - RLS: `sharvi_admin` manages all; `customer_admin` manages own tenant rows; everyone authenticated can read their tenant's rows.
- New column on `vendors`: `custom_field_values jsonb default '{}'::jsonb` — stores values for admin-defined fields keyed by `step_key.field_name`.

### Implementation outline

**Backend (migration only, no edge fns):**
1. Create `form_step_configs` + RLS policies.
2. Add `vendors.custom_field_values jsonb`.
3. Seed `form_step_configs` for the 6 built-in steps per tenant on first read (or lazy-seed in the hook).

**Hook layer:**
4. `src/hooks/useFormBuilder.tsx` — CRUD for steps and fields (admin side).
5. `src/hooks/useDynamicFormSchema.tsx` — vendor side: returns `{ steps: StepConfig[], fieldsByStep: Record<string, FieldConfig[]> }` for the active tenant, merged with built-in step metadata.

**Admin UI:**
6. `src/pages/FormBuilder.tsx` — the screen above (left rail = tabs list with drag-reorder; right pane = field grid with drag-reorder + add/edit drawer).
7. `src/components/admin/FieldEditorDrawer.tsx` — field config form.
8. Add a route `/admin/form-builder` and a Form Builder tab inside `SharviAdminConsole.tsx`.
9. Sidebar entry under "Administration" gated to `sharvi_admin` and `customer_admin`.

**Vendor renderer:**
10. `src/components/vendor/DynamicStep.tsx` — generic renderer that takes a list of `FieldConfig` and renders the right input per type, writes into `formData.customFieldValues[stepKey]`.
11. `src/pages/VendorRegistration.tsx`:
    - Load dynamic schema on mount via `useDynamicFormSchema`.
    - Build `registrationSteps` = built-in 6 + dynamic custom steps inserted before Review.
    - In `renderStep()`, route any custom step id to `<DynamicStep stepKey=... />`.
    - Extend `canProceedFromCurrentStep()` to validate custom-step fields (mandatory + regex) using the same rules engine.
    - Persist `custom_field_values` in `saveVendor` and load it back on draft resume.

**Review + reviewers:**
12. `ReviewStep.tsx` — render a section per custom step listing its fields/values.
13. `FinanceReview.tsx` / `PurchaseApproval.tsx` — show `custom_field_values` read-only.

### Permissions

- `sharvi_admin`: full access, all tenants.
- `customer_admin`: full access, own tenant only.
- Other roles: read-only via the vendor form rendering.

### Out of scope (for this pass)

- Conditional show/hide rules (e.g. "show field B if A == 'Yes'") — can be added later via a `visibility_condition` JSON column on `form_field_configs`.
- Per-field role-based visibility.
- Cross-step dependencies / lookups.
- Migrating already-saved drafts to a renamed field key (we keep the old key's value in `custom_field_values`).
- OCR auto-fill for custom fields.

### Result

Customer admins can extend the vendor registration form with new tabs and fields from the UI, save once, and vendors immediately see and fill them — with mandatory/regex validation, draft save, review summary and reviewer visibility all working out of the box.

