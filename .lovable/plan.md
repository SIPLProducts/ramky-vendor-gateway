## Goal
In the GST/PAN/MSME/Bank verified panels, remove the green success text that appears below each input (e.g. "Legal Name is verified", "Verified from registry", "Active per registry"). At the same time make the GST section headers (Identity, Registration, Place of Business, Jurisdiction) smaller and add an orange underline below each header.

## Changes

### 1. Update `SectionHeading` styling
File: `src/components/vendor/steps/DocumentVerificationStep.tsx`
- Reduce the header text size further (e.g. `text-[10px]` or `text-[11px]`).
- Add an orange bottom border (`border-b border-warning/70` or `border-orange-500`) under the header text.
- Keep uppercase, tracking-wide treatment so it still looks like a label.

### 2. Hide verified success messages below inputs
File: `src/components/vendor/steps/DocumentVerificationStep.tsx`
- In the `EditableOcrField` component, remove the `matchesApi && verifiedLabel` block that renders the green `<p>` text below the input.
- Keep the green border on the input and the success check icon inside the input (already present); only the text below is removed.
- Keep the mismatch warning block (`mismatchApi`) unchanged so registry mismatches still warn the user.

### 3. Remove additional GST verified messages
File: `src/components/vendor/steps/DocumentVerificationStep.tsx`
- Remove the "Matches registry address" success message below the Principal Place of Business input.
- Remove the `Active per registry` suffix from the GST Status pill in the Registration section.

### 4. Verify no side effects
- Run `tsgo` typecheck to confirm the component still compiles.
- The change will automatically apply to all verified panels because `EditableOcrField` is shared across GST, PAN, MSME, and Bank tabs.

## Result
All verified panels will show only the input with the green bottom border and the check icon inside the input; no extra green text below fields. GST section headers will appear smaller with an orange underline.