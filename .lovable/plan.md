## Problem

After replacing the Bank cheque with one whose Account Holder is `KRISH INFRA PROJECTS`, the system shows "Name matches bank record" with `33% — Low Match` against the current GST Trade Name (`K. MURUGAN`) and PAN Holder Name (`K Murugan`). It should instead show **No Match** and block verification.

### Root cause (verified)

Data is NOT stale — the GST/PAN/MSME values used by the validator are the latest "Murugan" entries. The false-pass is purely a scoring bug in `src/lib/nameMatch.ts`:

- `initialAwareScore("KRISH INFRA PROJECTS", "K MURUGAN")` pairs the single-letter token `K` with the word `KRISH` because they share the first letter, returning `1/3 ≈ 33%`.
- `evaluateCrossNameMatch` treats any score ≥ `NAME_MATCH_MIN_PASS = 20` as a pass — so "Low Match" wrongly passes.

The two names have **no shared word** ("KRISH" / "INFRA" / "PROJECTS" vs "MURUGAN"), yet the check still passes. That is what must be fixed.

## Changes

### 1. `src/lib/nameMatch.ts`
- Add a `hasWordOverlap(a, b)` helper that returns true only when the two names share at least one significant **word** token (ignoring single-letter initial pairings and noise tokens like `pvt`, `ltd`).
- Extend `evaluateCrossNameMatch` with an options bag:
  - `minPass?: number` — override the 20% default threshold.
  - `requireWordOverlap?: boolean` — when true, a pass also requires at least one reference to share a real word with the candidate.
- When `requireWordOverlap` rejects an otherwise-passing score, return `passed: false` and an empty `matches[]` so the success banner is not built from coincidental initial matches.

### 2. `src/components/vendor/steps/DocumentVerificationStep.tsx`
Two bank-validation call sites use `evaluateCrossNameMatch` for the Account Holder cross-check:
- The OCR/cheque-upload path (~lines 912–940).
- The manual bank verification path (~lines 1508–1533).

In both, call it with:
```ts
evaluateCrossNameMatch(nameAtBank, [...refs], {
  minPass: 50,            // Low Match (20–49) no longer passes; need Medium+
  requireWordOverlap: true, // KRISH vs K MURUGAN → fail
});
```
On failure the existing `formatCrossMatchFailure(...)` path already surfaces a "No Match" error and blocks the Bank step — no further changes needed there.

### 3. Scope
- GST / PAN / MSME tabs keep the existing lenient 20% threshold (legal vs trade name variants are intentionally lenient there).
- Only the **Bank Account Holder** cross-check is tightened, because it's the high-trust identity field the user flagged.
- No changes to the GST→PAN→MSME→Bank reset cascade.

## Expected result

For the reproduction in the screenshots:
- Bank verification fails with `No Match — best match: GST Trade Name 33% (Low Match)` (standard failure message).
- The green "Name matches bank record" / "matched with GST Trade Name (33%) and PAN Holder Name (33%)" banners no longer appear.
- The Continue button on the Bank step stays disabled until the cheque holder genuinely shares a word with GST / PAN / MSME names.
