# Bottom-border validation styling for Organization / Contact / Financial tabs

Match the Document Verification tab's field aesthetic in the three built-in editable tabs, with a light gray input surface throughout:

- Input/select surface: **light gray background** (`bg-muted/40`), no top/left/right border, `rounded-none`.
- **Green** bottom border when the field has a value.
- **Orange** bottom border when the field is **mandatory and empty**.
- Neutral gray bottom border otherwise (optional + empty).
- **Read-only fields**: same light gray surface, cursor-default, green bottom border when a value is present, neutral otherwise.

## Approach

1. **Add a helper** `bbFieldClass({ hasValue, required, readOnly })` in `src/lib/utils.ts`:
   - Base: `border-0 border-b rounded-none bg-muted/40 px-3 focus-visible:ring-0 focus-visible:ring-offset-0`
   - `hasValue` → `border-b-2 border-b-success`
   - `required && !hasValue && !readOnly` → `border-b-2 border-b-warning`
   - else → `border-border/60`
   - `readOnly` → append `cursor-default text-muted-foreground`
   - Works for `<Input>`, `<Textarea>`, and shadcn `<SelectTrigger>`.

2. **Apply the helper** to every field's `className` in:
   - `src/components/vendor/steps/OrganizationStep.tsx`
   - `src/components/vendor/steps/AddressStep.tsx`
   - `src/components/vendor/steps/FinancialInfrastructureStep.tsx`

   For each field:
   - `hasValue` from live form value (`watch(name)` or destructured value).
   - `required` from whether the label currently ends with `*`.
   - `readOnly` from the existing `readOnly`/`disabled` prop.
   - Merge with any existing error class already applied.

## Out of scope

- Document Verification tab (already uses this style via `EditableOcrField`).
- International steps.
- Validation/behavior logic — presentation only.
- No changes to labels, layout, or field lists.
