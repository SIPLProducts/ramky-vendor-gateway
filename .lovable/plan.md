## Plan

1. **Fix the domestic submit validation mismatch**
   - Update the final submit-gate in `VendorRegistration` so Address Information checks the actual visible fields used by `AddressStep`:
     - `registeredEmail`
     - `registeredContact1`
   - Remove the stale checks for hidden/nonexistent fields:
     - `contactEmail1`
     - `contactPhone1`
   - This is why you are seeing “Address Information is incomplete” even after filling mandatory fields: the submit validation is checking old field names that are not on the form anymore.

2. **Keep international registration protected from this issue**
   - Leave the existing international branch separate from domestic validation.
   - Confirm the domestic-only submit gate does not run for international vendors.

3. **Remove “Powering Progress”**
   - Remove the “Powering Progress” tagline from the sidebar header.
   - Keep the logo and “Vendor Portal” text unchanged.

4. **Verify**
   - Run a TypeScript check after the changes.
   - Confirm the registration submit validation no longer blocks on Address Information when visible mandatory address fields are completed.