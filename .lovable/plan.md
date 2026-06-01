## Replace International Classification dropdowns with text inputs

Scope: UI-only change in `src/components/vendor/steps/international/IntlClassificationStep.tsx`. No other files touched.

### Changes

In `IntlClassificationStep.tsx`:
- Remove `ClassificationField` import; import `Input` and `Label` from `@/components/ui`.
- Keep the same four field keys (`materialGroupVendor`, `vendorLocation`, `vendorCategory`, `identificationSource`) so downstream save/review logic stays intact.
- Internally store values as single strings while the form-level type stays `string[]`: on change, write `[value]`; on render, show `value[0] || ''`.
- Replace each `<Controller>`/`ClassificationField` block with a plain `<Input>` + `<Label>` (required asterisk preserved for Material Group and Vendor Location).
- Keep the existing Zod validations (`min(1)` on required fields) — a non-empty typed string satisfies `[value]` length ≥ 1.
- Keep the "Values are sourced from SAP master data." helper line removed (no longer accurate) and replace with a neutral hint like "Enter classification details manually."

### Not changed

- `InternationalClassification` type, save payload shape, Review step rendering, SAP master data hooks, and the India variant (`IntlClassificationStep` is international-only).
- No DB or backend changes.

### Validation

- Open vendor registration as International vendor → Classification step shows 4 text inputs.
- Required fields block Continue when empty; typed values let the form submit.
- Review & Submit shows the entered text values.
