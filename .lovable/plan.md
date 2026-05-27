## Point 1 — Review & Submit "Edit" must open the right tab (GST / PAN / MSME / Bank)

Wiring is already in place (`onEditStep(step, tab)` → `setPendingDocTab(tab)` → `setCurrentStep(1)` → `DocumentVerificationStep initialTab`), but it is being overridden immediately after mount by the auto-advance effect in `DocumentVerificationStep.tsx` (lines 1630–1637). On a vendor whose stages are already verified, that effect runs once on mount and bumps `activeTab` from "gst"/"pan"/"msme" to the next tab, which is exactly what the user is seeing.

Fix in `src/components/vendor/steps/DocumentVerificationStep.tsx`:

1. Delete the entire auto-advance block (lines 1629–1637): the `prevDoneRef` useRef and the `useEffect` that calls `setActiveTab("pan" | "msme" | "bank")` based on `stage1Done / stage2Done / stage3Done`.
2. Keep the existing `useEffect` (lines 1624–1627) that syncs `activeTab` from `initialTab` — this preserves Edit-deep-link behavior.
3. Also guard `handleEditStep` in `src/pages/VendorRegistration.tsx` so that re-clicking Edit on the same tab still re-applies it. Update line 651 area to force a re-sync by clearing then setting:
   ```ts
   const handleEditStep = (step: number, tab?: 'gst' | 'pan' | 'msme' | 'bank') => {
     if (step === 1) setPendingDocTab(tab);   // always update, even if same value
     setCurrentStep(step);
   };
   ```
   And in `DocumentVerificationStep.tsx`, change the sync effect to react every time the prop changes (even if the same string is passed twice in a row) by also depending on a render key — simplest is to keep behavior as-is since `setPendingDocTab` triggers a state change that re-passes the prop and the effect refires.

## Point 2 — Don't auto-jump to next tab after a successful validation

This is the same auto-advance effect removed in Point 1 (lines 1631–1637). After removing it:

- Tabs remain unlocked as soon as their stage is done (`tabUnlock` map at lines 1639–1644 is unchanged).
- The vendor must click the next tab themselves (or the existing Continue button at the bottom of the step to move to step 2).

No other auto-`setActiveTab` calls need to be touched — the remaining ones (lines 912, 919, 1173) only fire on FAILURE to keep the user on the failing tab, which is correct.

The existing footer "Continue" button on the Document Verification step is already enabled when all 4 stages are done and moves to step 2 — that behavior is kept as-is.

## Point 3 — Remove the "57% complete / Saved X mins ago" badge in the top-right of the registration header

In `src/pages/VendorRegistration.tsx`:

- Desktop stepper bar (lines 1079–1085): delete the entire right-side `<div className="flex flex-col items-end gap-1 shrink-0 pl-4 border-l min-w-[120px]">…</div>` block (percentage + AutoSaveIndicator). The stepper itself stays full-width.
- Mobile bar (lines 1089–1108): remove the percentage `<span>{completeness.overall}%</span>` (line 1099) and the progress bar `<div className="h-1 w-full bg-muted rounded-full overflow-hidden">…</div>` (lines 1101–1106). Keep "Step X of N" + step title + the AutoSaveIndicator below.
- Top header (line 1028) already shows `<AutoSaveIndicator>` — that is the only "Saved … ago" indicator we keep, so the user still sees autosave status but no completion percentage anywhere.
- Drop the now-unused `CompletenessRing` import (line 33) and the `completeness` const (line 502) only if no other reference remains; otherwise leave the hook call (used by step navigation gates elsewhere — verify with a grep before deleting).

## Out of scope / unchanged

- International flow, SAP Sync, approval workflow, edge functions, DB schema.
- Per-tab verification logic, OCR, KYC orchestrator, validation rules.
- AutoSaveIndicator behavior in the top header.

## Files to edit

1. `src/components/vendor/steps/DocumentVerificationStep.tsx` — delete the auto-advance `useEffect` + `prevDoneRef` (lines 1629–1637).
2. `src/pages/VendorRegistration.tsx` — remove the completeness % UI (desktop block lines 1079–1085; mobile % span line 1099 and progress bar lines 1101–1106); ensure `handleEditStep` always sets `pendingDocTab` for step 1; drop the `completeness` import/hook only if no other usage remains.
