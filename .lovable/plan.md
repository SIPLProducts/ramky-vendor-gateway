## Goal

Replace the current per-tab single-reference name check (40% vs. one other name) with a **cross-field** policy that compares each tab's holder/legal name against **all other already-verified names** and gates on a single rule:

- **< 20%** with every available reference → fail and block progression
- **≥ 20%** with at least one reference → pass, show which field(s) matched and at what level

### Match levels (shown in the success banner)

| Score | Label |
|-------|-------|
| 20% – 49% | **Low Match** |
| 50% – 69% | **Medium Match** |
| 70% – 100% | **Strong Match** |

(The user-stated bands 25–40 / 50–70 / 70–100 leave gaps at 41–49 and 20–24; this plan keeps the gate at 20% and fills the bands contiguously: 20–49 = Low, 50–69 = Medium, 70+ = Strong. Confirm or override before implementation.)

## Scope

Only the four KYC tabs and the shared name-match helper. No DB / edge-function / SAP changes.

Files touched:
- `src/lib/nameMatch.ts` — add a shared `classifyNameMatch` + `evaluateCrossNameMatch` helper
- `src/components/vendor/kyc/GstKycTab.tsx` — currently does no cross-name check; add one against PAN/MSME/Bank names if any are already verified
- `src/components/vendor/kyc/PanKycTab.tsx` — replace strict `fuzzyNameMatch(name, gstLegalName)` with cross-field policy (GST + MSME + Bank)
- `src/components/vendor/kyc/MsmeKycTab.tsx` — replace single-ref PAN check with cross-field policy (GST + PAN + Bank)
- `src/components/vendor/kyc/BankKycTab.tsx` — already compares against GST + PAN; extend to also include MSME and switch to the tiered policy
- `src/components/admin/KycLiveTestPanel.tsx` — pass the four cross-tab names so the admin Live Test mirrors the same behavior

Each tab will receive the other three names via props (already partially wired today: `gstLegalName`, `panHolderName`). Two new props are added where missing: `msmeEnterpriseName`, `bankAccountHolderName`.

## Behavior per tab

After the tab's own API verification returns a name (e.g. `apiName`):

1. Build a list of candidate references that are non-empty: `{ field, value }` for the other three tabs' verified names.
2. If **no references** exist yet → skip cross-check (current behavior preserved; the tab passes on its own merit).
3. For each reference, compute `nameMatchPercentage(apiName, ref.value)`.
4. Take the **best** score.
   - Best ≥ 20 → tab passes. Show success banner: *"Account Holder Name matched with PAN Holder Name (78% — Strong Match) and GST Legal Name (54% — Medium Match)."* Listing every reference that scored ≥ 20.
   - Best < 20 → tab fails. Show destructive banner: *"<This field> does not match any of the verified names (best 12% with PAN Holder Name). Minimum required is 20%."* and (where applicable today) open the existing mismatch dialog.

Threshold constant `NAME_MATCH_THRESHOLD = 40` in MSME and Bank tabs is replaced by the shared `MIN_PASS = 20`.

## Shared helper API

```ts
// src/lib/nameMatch.ts
export type MatchLevel = 'low' | 'medium' | 'strong' | 'fail';

export function classifyNameMatch(score: number): MatchLevel {
  if (score >= 70) return 'strong';
  if (score >= 50) return 'medium';
  if (score >= 20) return 'low';
  return 'fail';
}

export function evaluateCrossNameMatch(
  candidate: string | null | undefined,
  references: { field: string; value?: string | null }[],
): {
  passed: boolean;
  bestScore: number;
  matches: { field: string; score: number; level: MatchLevel }[];   // only score >= 20
  best: { field: string; score: number; level: MatchLevel } | null; // for fail messages
};
```

The four tabs call this helper with the same `references` shape so the success/failure messaging is identical in tone across the form.

## Out of scope

- No change to OCR/verify provider calls or their inputs
- No change to gating order (GST → PAN → MSME → Bank)
- No change to Bank manual-popup flow — it just consumes the new helper for the name check
- No backend / migration / edge-function changes

## Open question (please confirm before implementation)

The bands you listed leave gaps (41–49 unlabeled; 20–24 unlabeled). Two options:

- **A (recommended, in plan above)** — contiguous: 20–49 Low, 50–69 Medium, 70–100 Strong.
- **B (literal)** — keep your exact bands (25–40, 50–70, 70–100); scores in 20–24 and 41–49 still pass the 20% gate but render as "Match" with no level label.

Default if you don't reply: **A**.
