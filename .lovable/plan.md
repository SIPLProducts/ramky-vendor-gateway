# Per-tab Continue buttons on Document Verification

## Problem

Currently the bottom **Continue** button only enables when **all four** stages (GST + PAN + MSME + Bank) are verified. You want each tab to have its own Continue button that:

- Is **disabled** until that tab's verification succeeds
- **Enables** as soon as that tab is verified
- **Advances** to the next tab (GST → PAN → MSME → Bank → Step 2)

## Changes

### `src/components/vendor/steps/DocumentVerificationStep.tsx`

Re-introduce four per-tab Continue buttons inside each `TabsContent`, placed at the bottom-right of the tab body (above the outer sticky bar):

| Tab | Button label | Enabled when | On click |
|------|--------------|--------------|----------|
| GST | `Continue to PAN` | `stage1Done` | `setActiveTab('pan')` |
| PAN | `Continue to MSME` | `stage2Done` | `setActiveTab('msme')` |
| MSME | `Continue to Bank` | `stage3Done` | `setActiveTab('bank')` |
| Bank | `Continue` | `stage4Done` | `handleContinue()` (advances to Step 2) |

Each button uses the existing `stageXDone` flags already computed at lines 1496–1509, so no new validation logic is needed.

### Outer sticky `Continue` button

Keep the existing bottom **Continue** (gated by `allDone`) as a safety net so the user can also jump straight to Step 2 once everything is green. Update the helper banner from "Complete each stage in order: GST → PAN → MSME → Bank" to a shorter "Verify each stage to continue".

### Other steps (Organization, Address, Contact, Financial)

These steps already use the outer **Continue** in `StickyActionBar`, gated by their own form validity (`useFormCompleteness` / step schemas). The user asked for "the same flow" — which is already in place: Continue is disabled until the step's required fields are valid. No code change needed there unless you want per-section gating inside those steps too (let me know if so).

## Out of scope

- No changes to verification API calls, OCR, RLS, or autosave logic.
- No DB migrations.
- No new buttons on Organization/Address/Contact/Financial steps — their existing Continue gating already matches the requested pattern.

## Files touched

- `src/components/vendor/steps/DocumentVerificationStep.tsx` — add 4 per-tab Continue buttons + tweak helper banner copy.
