## Goal

Inside Step 1 (Document Verification), each stage tab — **GST → PAN → MSME → Bank** — currently has no per-tab Continue button. The user must click the next tab manually. Add a per-tab **Continue** button at the bottom of each tab that:

- Stays **disabled** while that tab's verification is incomplete.
- **Enables** as soon as that tab's stage is done (GST verified + filing OK / declaration, PAN verified, MSME verified or declaration, Bank verified).
- On click, switches the active tab to the next stage (Bank's button advances the whole Step 1, same behavior as the outer Continue).

## Behavior per tab

| Tab | Enable when | Action |
|---|---|---|
| GST | `stage1Done` is true | `setActiveTab("pan")` |
| PAN | `stage2Done` is true | `setActiveTab("msme")` |
| MSME | `stage3Done` is true | `setActiveTab("bank")` |
| Bank | `stage4Done` is true (and overall `allDone`) | Call existing `handleContinue()` to advance to Step 2 |

Tabs that come after the current one remain locked until their own stage prerequisites are met (the existing `tabUnlock` logic stays untouched).

## Technical change (frontend only)

File: `src/components/vendor/steps/DocumentVerificationStep.tsx`

1. Add a small reusable row inside each `TabsContent` (just before its closing tag) at lines ~1908, ~2021, ~2377, ~2633:
   ```tsx
   <div className="mt-6 flex justify-end">
     <Button
       type="button"
       onClick={() => setActiveTab("pan")}        // or next stage / handleContinue
       disabled={!stage1Done}                      // or stage2Done / stage3Done / allDone
     >
       Continue
     </Button>
   </div>
   ```
2. Bank tab's button calls `handleContinue()` (already defined at line 1617) and is disabled unless `allDone`.
3. No change to the outer Step-1 Continue at the bottom of the page — it stays as-is.

## Out of scope

- No change to verification API logic, gating math, or backend.
- No DB / edge function / SAP changes.
- No styling system changes — uses existing `Button` component and design tokens.

After approval the change must be rebuilt and redeployed on the self-hosted server (`scripts/lib/60-frontend.sh`).