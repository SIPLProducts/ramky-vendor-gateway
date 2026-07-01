Implement a targeted fix in the Organization Profile step:

1. Detect when the vendor is GST registered and a GST-derived state is available.
2. For GST vendors, lock the Organization Profile `State` control so it cannot be changed manually.
3. Keep the existing automatic GST state population logic, but update it so GST-derived state remains authoritative instead of allowing later manual override.
4. For Non-GST vendors, leave the `State` field fully editable.
5. Verify the behavior in both paths:
   - GST vendor: State is populated from GST and disabled/read-only.
   - Non-GST vendor: State can still be selected manually.

Technical scope:
- Primary file: `src/components/vendor/steps/OrganizationStep.tsx`
- No database, backend, role, or unrelated label changes.