## Goal

Keep the existing registration flow working exactly as before, and only add/support these two PAN details:

- **PAN Status**
- **Is Aadhaar Linked**

They should save and display in PAN/review/view screens, but must not break Back, Refresh, draft save, or final Submit.

## What is causing the current issue

The app is now trying to save these new database fields:

- `pan_status`
- `pan_aadhaar_linked`
- `pan_comprehensive_verified_at`

But your running server database does not have those columns yet, so every auto-save / Back / Submit request fails with:

`Could not find the 'pan_aadhaar_linked' column of 'vendors' in the schema cache`

This is not because GST/PAN/MSME/Bank data is being cleared. The save request is failing before it can complete.

## Plan

1. **Add the missing vendor columns through a backend migration**
   - Add `pan_status text`
   - Add `pan_aadhaar_linked boolean`
   - Add `pan_comprehensive_verified_at timestamptz`
   - Use `IF NOT EXISTS` so it is safe if already present.

2. **Make draft save / Back / Submit safe**
   - Update the vendor save logic so if a running/self-hosted database still reports a missing PAN column, the app retries once without only those new PAN fields.
   - This prevents the whole registration from failing if the server schema cache is behind.
   - Existing GST, PAN OCR, MSME, Bank, Review, Back, Refresh, and Submit logic will not be changed.

3. **Keep the PAN Comprehensive result mapping only**
   - `status === "valid"` displays **Valid**, otherwise **Invalid**.
   - `aadhaar_linked === true` displays **Aadhaar Linked with PAN**.
   - `false` or `null` displays **Aadhaar Not Linked with PAN**.

4. **Verify the affected path**
   - Confirm TypeScript/build passes.
   - Confirm the save payload no longer blocks existing registration data when the two PAN fields are involved.

## Not changing

- No change to existing OCR verification rules.
- No change to GST/PAN/MSME/Bank tab order.
- No change to refresh icon behavior except preventing save failure from these new fields.
- No change to existing data fields or approval flow.