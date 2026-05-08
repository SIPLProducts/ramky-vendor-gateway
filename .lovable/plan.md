## Changes in `src/components/vendor/steps/OrganizationStep.tsx`

1. **Line 374** — Change heading text from `SAP Classification` to `Classification`.
2. **Line 389** — Render Material Group dropdown options in uppercase:
   - Display: `{c.toUpperCase()}`
   - Keep underlying `value={c}` unchanged so existing saved data and validation remain intact.

No other files or business logic are touched.