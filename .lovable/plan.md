## Plan: Block negative Amount values correctly

I will update the Financial step amount inputs so negative values cannot remain in the field and the exact validation message is shown whenever a negative entry is attempted.

### Changes

1. **Use controlled text/decimal inputs instead of fragile browser number behavior**
   - Keep `min={0}` and decimal support.
   - Avoid relying only on `type="number"`, because browsers can still allow temporary negative states through paste, spinner behavior, or programmatic input.

2. **Strictly sanitize Amount values before storing**
   - Allow only digits and one decimal point.
   - Allow `0` and any value greater than `0`.
   - If input starts with `-` or parses below `0`, immediately clear/prevent the invalid value from being stored.

3. **Show the exact validation message inline**
   - Message:
     `Please enter a valid amount. You can enter the amount either in Lakhs (e.g., 0.9) or in Rupees (e.g., 90000). Negative values are not allowed.`
   - Show it below the affected Amount field when a negative value is typed, pasted, or otherwise entered.

4. **Preserve existing rupee input + live lakhs preview**
   - Valid examples remain accepted: `0`, `0.1`, `0.9`, `1.5`, `90000`, `100000`, `1500000`.
   - Lakhs preview stays visible only for valid positive amounts.

5. **Apply the same non-negative guard to Expected Credit Period**
   - Prevent values below `0` there as well, using the same validation behavior currently planned.

### Technical notes

- Update only `src/components/vendor/steps/FinancialStep.tsx`.
- Use the existing zod schema plus field-level input handling.
- Ensure form state never contains a negative value for these numeric fields.