## Make "Vendor Identification Source" optional in Domestic Classification

**File:** `src/components/vendor/steps/OrganizationStep.tsx`

1. Line 52 — change schema from required to optional:
   - From: `identificationSource: z.array(z.string()).min(1, 'Identification Source is required'),`
   - To: `identificationSource: z.array(z.string()).optional().default([]),`
2. Line 518 — remove the red asterisk from the label:
   - From: `<Label>Vendor Identification Source *</Label>`
   - To: `<Label>Vendor Identification Source</Label>`
3. Leave the MultiSelect, default values, and payload mapping unchanged so existing data still flows through.

No changes to international flow, types, or Review step.