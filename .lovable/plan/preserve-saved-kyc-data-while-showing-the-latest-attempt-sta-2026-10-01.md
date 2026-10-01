# Preserve Saved KYC Data While Showing the Latest Attempt Status

## Goal
For GST, PAN, MSME, and Bank replacements, keep the last accepted file and saved fields unchanged after any failed upload or verification. Show only the latest failed/error state and its message until a later replacement succeeds.

## Plan
1. **Separate accepted data from attempt status**
   - Keep the previously verified document and extracted values as the accepted snapshot.
   - Track the latest replacement result independently, so a failed attempt can mark the tab as Failed without changing the accepted snapshot.
   - Apply the same rule to OCR, provider, format, cross-check, and dependent validation failures.

2. **Make failure status take visual precedence**
   - When an accepted document has a current failure message, render the file row, tab indicator, stage indicator, and progress state as Failed/Error rather than Verified.
   - Continue displaying the accepted filename and saved fields, but suppress green success/verified badges and field success indicators while the failure is active.
   - Display one clear error message for the latest failed attempt and keep Continue blocked.

3. **Persist and restore the failure without replacing saved data**
   - Save the failed-attempt outcome in validation history while leaving the vendor columns, accepted document metadata, and stored file untouched.
   - On refresh or reopen, hydrate the accepted data/file and overlay the latest failed status and message.
   - Do not delete accepted storage objects or clear tab columns for replacement failures.

4. **Commit only successful replacements**
   - After a successful verification, replace only that tab’s accepted file and fields.
   - Clear its prior failure state, save a successful validation result, and restore the single Verified/Success presentation.
   - Preserve all unrelated tabs and rerun only the existing dependent checks.

5. **Regression verification**
   - Test GST, PAN, MSME, and Bank with: accepted document → incorrect replacement → save/refresh/reopen → correct replacement.
   - Confirm the failed file is never stored, accepted data survives reload, only Failed appears after failure, only Verified appears after success, and unrelated tabs remain unchanged.

## Technical Notes
- The current document state retains `status: "verified"` and adds `errorMessage` after a failed replacement. This preserves data but allows verified styling and error styling to appear together.
- The correction will derive one effective display status with failure precedence, while keeping accepted document state separate from the latest attempt outcome.
- Existing registration, rejection/resubmission, KYC provider calls, and successful replacement behavior remain otherwise unchanged.
