## Goal

Add a **Country** field to the International → Company Bank Details step, sourced dynamically from SAP (same `country` master cache used by Company Details).

## Changes

### 1. `src/types/vendor.ts`
Add optional `bankCountry?: string` to `InternationalBankDetails`.

### 2. `src/components/vendor/steps/international/IntlBankDetailsStep.tsx`
- Import `useSapMasterData` + `Select` components + `Controller` from react-hook-form.
- Add a `Bank Country (From SAP)` `Select` bound to `bankCountry`, options from `useSapMasterData('country')`.
- Value = `LAND1` code, label = `LAND1 — LANDX`.
- Disabled with hint "No SAP values — sync SAP master data" when cache is empty.
- Field is optional (whole step is optional per existing copy).

### 3. No other changes
- No DB migration (field lives inside existing JSON form payload).
- No edge function changes — `country` master is already ingested.
- Domestic flow untouched.

## Out of scope

- No hardcoded fallback list.
- No changes to other bank fields.
