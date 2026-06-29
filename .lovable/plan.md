## Issue

Bank API returned `full_name = "MURALI CONTRACTOR"`. PAN holder name is `"Bade Murali Krishna"`.

Using the project's name matcher (`src/lib/nameMatch.ts`):
- Tokens of bank: `[murali, contractor]`
- Tokens of PAN:  `[bade, murali, krishna]`
- Common tokens: `murali` (1 of 3) → **33% match**, classified as **Low Match**

There are two name-match gates in the codebase:

| Location | minPass | requireWordOverlap | Result for 33% |
|---|---|---|---|
| `src/components/vendor/kyc/BankKycTab.tsx` (line 92) | 20 (default) | false | passes |
| `src/components/vendor/steps/DocumentVerificationStep.tsx` (lines 929, 1522) | **50** | **true** | **fails** ← this is what's rejecting your case |

The Document Verification screen (where you uploaded the cheque) uses a stricter 50% threshold, so 33% is rejected with "Account Holder Name does not match any of the verified names…".

## What to change

Align the Document Verification bank holder gate with the rest of the app so partial first-name / surname matches like "Murali" are accepted.

**File:** `src/components/vendor/steps/DocumentVerificationStep.tsx`

- Line **929**: change `{ minPass: 50, requireWordOverlap: true }` → `{ minPass: 20, requireWordOverlap: true }`
- Line **1522**: same change

`requireWordOverlap: true` is kept so a pure single-letter / initial coincidence (e.g. "K MURUGAN" vs "KRISH") is still rejected. The shared word "MURALI" is a real word, so this case now passes as a **Low Match** (33%).

## Effect after the change

- `"MURALI CONTRACTOR"` vs `"Bade Murali Krishna"` → 33% → **passes** with "Low Match" badge.
- `"M CONTRACTOR"` vs `"Bade Murali Krishna"` → only initial-letter overlap → still **fails** (word-overlap rule).
- No other screens change. The Compliance step (BankKycTab) already used 20%, so behaviour there is unchanged.

## Verification

1. Re-run the cheque upload / bank verification on the Document Verification page for this vendor.
2. Confirm Account Holder check shows a green "Low Match (33%) with PAN Holder Name" message instead of a rejection.
3. Spot-check that an unrelated name (e.g. `"RAJESH KUMAR"` vs `"Bade Murali Krishna"`, 0% common words) still fails.
