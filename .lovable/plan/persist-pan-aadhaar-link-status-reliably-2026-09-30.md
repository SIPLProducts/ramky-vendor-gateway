# Persist PAN–Aadhaar Link Status Reliably

## Goal
Whenever PAN Comprehensive verification succeeds, save the API result in the vendor record and show the same result consistently in View Details.

## Confirmed current behavior
- API `aadhaar_linked: true` is mapped to `pan_aadhaar_linked: true`.
- API `aadhaar_linked: false` is mapped to `pan_aadhaar_linked: false`.
- API `aadhaar_linked: null` is currently omitted from database updates and final saves, so the database can remain empty or preserve an older value.
- View Details currently formats both `false` and an empty value as “Aadhaar Not Linked with PAN,” even though the stored values differ.

## Changes
1. Normalize a successful PAN Comprehensive response so only `true` remains true; `false` or `null` becomes false.
2. Apply that normalized value in both PAN verification screens and both immediate database-save paths.
3. Carry the same boolean into registration form state and final/draft vendor saves.
4. Keep the PAN verification timestamp and status behavior unchanged.
5. Keep View Details, approval screens, reports, and exports aligned with the saved boolean: true shows linked; false shows not linked.
6. Check database-update errors instead of silently treating a failed write as successful.

## Verification
- Test representative API results for `true`, `false`, and `null`.
- Confirm the saved vendor field is respectively `true`, `false`, and `false`.
- Confirm View Details displays “Aadhaar Linked with PAN” only for true and “Aadhaar Not Linked with PAN” for false/null-normalized results.
- Run type, formatting, and preview build checks.

## Scope
This changes new PAN verification and subsequent save behavior. Existing empty Production records will not be backfilled without verified provider evidence.
