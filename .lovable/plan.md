## Plan: Fix negative amount validation in the actual rendered form

I found the issue: the screen in your screenshot is not using the already-edited `FinancialStep.tsx`. It is rendering `FinancialInfrastructureStep.tsx`, which still has plain `type="number"` fields and therefore still accepts `-20000` and `-2`.

### Changes

1. **Update the active component**
   - Apply the fix in `src/components/vendor/steps/FinancialInfrastructureStep.tsx`.
   - Keep the existing layout and labels shown in your screenshot.

2. **Block negative turnover values**
   - Replace fragile `type="number"` amount inputs with controlled decimal text inputs.
   - Prevent typing `-`, `+`, `e`, and `E`.
   - Reject pasted or programmatic negative values.
   - Keep minimum allowed value as `0`.

3. **Show the exact validation message**
   - Display this below the affected turnover amount field whenever a negative value is attempted:

   `Please enter a valid amount. You can enter the amount either in Lakhs (e.g., 0.9) or in Rupees (e.g., 90000). Negative values are not allowed.`

4. **Fix Expected Credit Period too**
   - Prevent values less than `0` for `Expected Credit Period (Days)`.
   - Show the same validation message when a negative value is entered there, matching the issue in your screenshot.

5. **Preserve valid inputs**
   - Allow `0`, decimal lakhs such as `0.9`, and rupee amounts such as `90000`.
   - Do not change submit behavior, file upload, or other financial/infrastructure fields.

6. **Verify in the browser**
   - Test the actual `/vendor/registration` form.
   - Confirm `-20000` and `-2` cannot remain in the fields.
   - Confirm the validation message appears when negatives are attempted.
   - Confirm valid values like `0.9` and `90000` still work.