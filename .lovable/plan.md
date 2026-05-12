## Point 1 — Gate "Submit Application" on declaration checkboxes

**File: `src/components/vendor/steps/ReviewStep.tsx`**
- Add an `onDeclarationChange?: (d: { selfDeclared: boolean; termsAccepted: boolean }) => void` prop.
- When either checkbox toggles, call `onDeclarationChange({ selfDeclared, termsAccepted })`.
- Disable the existing local Submit affordance when `!canSubmit` (already computed) — keep current behavior.

**File: `src/pages/VendorRegistration.tsx`**
- Pass `onDeclarationChange={(d) => setFormData(prev => ({ ...prev, declaration: d }))}` to `<ReviewStep />`.
- On the final-step Submit button (lines ~934–947), add a guard:
  - `const declarationsAccepted = !!formData.declaration?.selfDeclared && !!formData.declaration?.termsAccepted;`
  - `const isLastReviewStep = isLastStep;`
  - Set `disabled={isSubmitting || (isLastReviewStep && !declarationsAccepted)}`.
  - Apply muted styles when disabled (same opacity treatment used by Continue button).

No backend or schema changes.

## Point 2 — Add "Accounting Group" dropdown beside State (Organization Profile)

**File: `src/types/vendor.ts`**
- Add `accountingGroup?: 'Import' | 'Export'` to `OrganizationDetails`.
- Export constant `ACCOUNTING_GROUPS = ['Import', 'Export'] as const`.

**File: `src/components/vendor/steps/OrganizationStep.tsx`**
- Add `accountingGroup: z.enum(['Import', 'Export'], { required_error: 'Accounting group is required' })` to the Zod schema (mandatory; matches the State field).
- Add `accountingGroup` to `defaultValues` (`data?.accountingGroup || ''`).
- Wrap the existing State field in a `grid md:grid-cols-2 gap-5` so State + Accounting Group sit side-by-side.
- New Accounting Group field uses `Controller` + `Select` with options from `ACCOUNTING_GROUPS`.
- Include `accountingGroup: values.accountingGroup` in the `organization` object passed to `onNext`.

**File: `src/components/vendor/steps/ReviewStep.tsx`** (display only)
- Add `<DataRow label="Accounting Group" value={data.organization?.accountingGroup} />` under the existing State row in the Organization Details section.

No DB/SAP-mapping changes in this scope (purely a form field captured in `vendor.formData.organization`). If/when SAP mapping is needed for Accounting Group, that will be a follow-up.

## Out of scope
- No SAP sync/payload mapping changes.
- No edits to other steps, edge functions, or RLS.
