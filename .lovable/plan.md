# Fix: SAP Sync fails for International vendors

## Root cause

`supabase/functions/sync-vendor-to-sap/index.ts` is hard-wired for domestic (India) vendors:

1. Line 234 rejects the request when `vendor.registered_state` cannot be matched against the Indian `stateToRegion` map.
2. The default SAP payload template has `"country": "IN"` (and `"bank_ctry": "IN"`) hardcoded and resolves region via `region(vendor.registered_state)` → Indian T005S code.

For international vendors `registered_state` already stores the SAP region code chosen from SAP master (e.g. `"NT"` for Australia) and `vendor.branch_country` stores the SAP country code (e.g. `"AU"`). Running them through the Indian map produces the *"State NT is not mapped to an SAP region code for country IN"* error.

## Fix (edge function only — `supabase/functions/sync-vendor-to-sap/index.ts`)

1. **Detect international vendors** once after loading the vendor row:
   ```ts
   const isIntl = String(vendor.vendor_type || '').toLowerCase() === 'international';
   const intlCountry = String(vendor.branch_country || '').trim().toUpperCase();
   ```

2. **Skip the Indian-state validation** for international vendors:
   - Replace the current `if (!vendor.registered_state || !resolveRegion(...))` block with:
     - Domestic: unchanged validation/message.
     - International: require `intlCountry` and `vendor.registered_state` to be present; fail with a clear message if either is missing. Do **not** call `resolveRegion`.

3. **Region resolver in template**: in `resolveExpr`, when `fn === "region"`, return the raw input value (uppercased) if `ctx.isIntl` is true; otherwise call `resolveRegion(inner)` as today. Add `isIntl` (and `intlCountry`) to `ResolverCtx` and pass them in when building the context.

4. **Country override**: after `resolveTemplate(...)` produces the payload, if `isIntl` walk the resolved object and replace any `country: "IN"` and `bank_ctry: "IN"` with `intlCountry` (top level, inside `vendors[*]`, and bank section). Implemented as a small `applyIntlCountry(payload, intlCountry)` helper that only touches those three keys — no other fields are mutated.

5. No other logic changes: domestic flow, overrides, classifications, document upload pipeline, middleware/direct routing, audit logging all untouched.

## Out of scope

- No DB migration, no schema change, no front-end change.
- No edits to the `sap_payload_templates` table or any other edge function.
- Domestic vendor sync behavior is unchanged.

## Verification

- Domestic vendor with valid Indian state → sync still succeeds (country `IN`, region from `stateToRegion`).
- Domestic vendor with unmapped state → same error as today.
- International vendor with `branch_country = "AU"`, `registered_state = "NT"` → no Indian-region validation; resolved payload contains `country: "AU"`, `vendors[0].country: "AU"`, `bank_ctry: "AU"`, `region: "NT"`; SAP call proceeds.
- International vendor missing `branch_country` or `registered_state` → fails fast with a clear message before calling SAP.
