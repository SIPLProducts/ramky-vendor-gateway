

## Make registration progress horizontal + add tabs to Document Verification

### What changes

**1. Horizontal step indicator at the top**
- Remove the left vertical sidebar (`<aside>`) that holds `EnterpriseStepIndicator` + `CompletenessRing` + `AutoSaveIndicator`.
- Add a new `HorizontalStepIndicator` rendered as a sticky bar **above** the form card, spanning full width, that shows all 8 steps in a single row:
  - Numbered circles (Check icon when completed) connected by a progress line.
  - Step title under each circle (description hidden on `<lg`, shown on `xl`).
  - Click-to-jump for completed/visited steps (same `handleStepClick` used today).
  - Completeness % and `AutoSaveIndicator` move to the right edge of the same bar.
- On mobile (`<md`): collapses to a compact "Step X of 8 — {Title}" pill plus a thin progress bar.

**2. Tabs inside Step 1 (Document Verification)**
- Replace the current vertical stack of 4 `StageCard` blocks with a `Tabs` component (existing `@/components/ui/tabs`) at the top of the step. Tab labels:
  - `GST` · `PAN` · `MSME` · `Bank`
- Each tab shows a small status chip beside the label: pending / in-progress / verified / failed (driven by existing `stage1Done…stage4Done` flags).
- Tabs are gated: the next tab unlocks only after the previous stage is `done` (clicking a locked tab is disabled with a tooltip "Complete the previous step first"). The current "Continue" button on the page stays disabled until all 4 are done — same logic as today.
- Auto-advance: when a stage finishes successfully, the active tab moves to the next pending one.

**3. Files**
- New: `src/components/vendor/HorizontalStepIndicator.tsx`
- Edited: 
  - `src/pages/VendorRegistration.tsx` — drop the left aside, mount the horizontal indicator above the form card, keep all existing handlers.
  - `src/components/vendor/steps/DocumentVerificationStep.tsx` — wrap the 4 stage sections in `Tabs`/`TabsList`/`TabsContent`, add status chips, gate locked tabs, auto-advance on completion.

### Out of scope
- No changes to OCR / API logic, validation rules, or stage gating math (reused as-is).
- Other steps (2–8) keep their current single-form layout.

