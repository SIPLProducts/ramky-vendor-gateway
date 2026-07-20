## Plan: Hide Udyam certificate upload until MSME validation succeeds

1. **Fix the active MSME section in Document Verification**
   - The visible upload area is coming from the MSME tab inside `DocumentVerificationStep`, not only from `MsmeKycTab`.
   - Move the `Upload Udyam Certificate *` block inside the existing `msmeDoc.status === "verified"` condition.
   - Result: after clicking **Yes**, only the **Udyam Number** input and **Validate** button show.

2. **Show upload only after successful validation**
   - Once the MSME/Udyam number validates successfully and `msmeDoc.status` becomes `verified`, show:
     - verified MSME details
     - re-validate button
     - `Upload Udyam Certificate *`

3. **Keep validation behavior unchanged**
   - The certificate remains required only after MSME is verified.
   - No database or backend changes.

4. **Quick verification**
   - Check that selecting **Are you MSME registered? → Yes** does not show the upload section before validation.
   - Check that after validation succeeds, the upload section appears.