## Plan

1. **Fix registration Review & Submit preview**
   - Update the Review screen’s **Financial Information** card to display all saved financial fields:
     - Turnover for the last 3 completed financial years
     - Expected Credit Period
     - Major Customer 1/2/3 where available
   - Use the same financial-year labels already used in the financial form.

2. **Make financial display consistent in all View/Preview popups**
   - Review the shared preview dialogs used by All Vendors, Approval screens, Reports, SAP Sync, and related modules.
   - Ensure all preview surfaces show:
     - Financial Information with Turnover and Expected Credit Period
     - Classification Details after Bank Details
     - Other saved vendor details
   - Keep Classification Details sourced from the saved vendor columns mapped from `Vendor_Details` and `Vendor_CFSTMT`.

3. **Correct validation timing for turnover and credit period fields**
   - Remove validation-error initialization on page load for financial fields.
   - Show inline validation only after the user interacts with a field or pastes an invalid value.
   - Keep invalid negative values blocked/cleared, but do not show errors just because the form or step loaded.
   - Keep the Expected Credit Period message as only: `Negative values are not allowed.`

4. **Verify the affected flow**
   - Check the Review & Submit preview with saved turnover and credit period values.
   - Check that validation errors do not appear on initial load/focus, and only appear after invalid input.
   - Confirm existing shared preview dialogs still render Financial Information and Classification Details consistently.