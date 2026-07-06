## Update turnover amount fields in Financial step

**File:** `src/components/vendor/steps/FinancialStep.tsx`

### Changes
1. **Relabel** the three turnover fields from `Turnover FY YYYY-YY` to `Turnover FY YYYY-YY (₹)` and change placeholder from `Enter Amount in Lakhs` to `Enter Amount in Rupees` (e.g. 100000).
2. **Validation:** keep non-negative numeric; allow decimals and any magnitude ≥ 0 (already supported by `nonNegNumericString` — no schema change needed).
3. **Live lakhs preview:** below each turnover input, render small helper text `≈ ₹X.XX Lakhs` when a valid value > 0 is entered. Format with 2-decimal precision using `value / 100000`. Show nothing when empty/0.
4. Keep the `₹` prefix icon inside the input.
5. No change to `creditPeriodExpected` field.
6. No backend/schema change — the value is stored as-is (string) in `FinancialDetails`. Downstream consumers currently treat it as lakhs; since we're switching semantics to rupees, we will:
   - Leave the stored value as raw rupees (what the user typed).
   - Since these fields are informational-only (no calculations elsewhere), no other file needs updating.

### Preview format helper (inline)
```ts
const toLakhsPreview = (v?: string) => {
  const n = Number(v);
  if (!v || !isFinite(n) || n <= 0) return '';
  return `≈ ₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Lakhs`;
};
```

Rendered as `<p className="text-xs text-muted-foreground">{toLakhsPreview(watch('turnoverYear1'))}</p>` under each input.
