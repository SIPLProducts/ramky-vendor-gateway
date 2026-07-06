## Prevent negative turnover values in Financial step

**File:** `src/components/vendor/steps/FinancialStep.tsx`

### Problem
Even though `type="number"` has `min={0}` and `-`/`+`/`e` keys are blocked, users can still paste negative values or use browser spinner in some cases, and the current sanitizer (`sanitizeNonNegNumeric`) only strips non-digit/dot characters — it silently drops the `-` sign but the raw form value can still hold negatives via other paths. No visible error appears; the field just accepts `-20000`.

### Changes

1. **Harden the sanitizer** — `sanitizeNonNegNumeric` will also strip leading `-` explicitly and clamp any parsed negative to empty string, guaranteeing the stored value is always `""` or `>= 0`.

2. **Add per-field validation state** — track a `turnoverErrors` object (`{ turnoverYear1?: string; turnoverYear2?: string; turnoverYear3?: string }`) in `useState`.

3. **Detect negative input attempts** — in `numericFieldProps.onChange`, if the raw input string starts with `-` or parses to a negative number, set the error message for that field:
   > "Please enter a valid amount. You can enter the amount either in Lakhs (e.g., 0.9) or in Rupees (e.g., 90000). Negative values are not allowed."
   
   Clear the error as soon as a valid non-negative value is entered.

4. **Render inline error** — below each of the 3 turnover inputs (and the lakhs preview), show the error in `text-destructive text-xs` when present. Preview and error are mutually exclusive (error takes priority).

5. **Also apply to `creditPeriodExpected`** — same negative guard (it's already numeric non-negative).

6. **Schema** — tighten `nonNegNumericString` to also reject a leading `-` explicitly (belt-and-suspenders); the regex already does but we'll add a `.refine` to reject `Number(v) < 0` for defensive parsing.

### No changes to
- Field labels, placeholders, lakhs preview helper, backend, or other steps.
