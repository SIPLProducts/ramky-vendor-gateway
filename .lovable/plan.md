## KYC tabs — inline verify/info adornments cleanup

All changes are in `src/components/vendor/steps/DocumentVerificationStep.tsx`. Presentation only, no verification logic changes.

### 1) GST — Jurisdiction as 2 equal columns
`GstVerifiedDetails` currently renders Centre/State Jurisdiction inside `grid md:grid-cols-4 gap-3` (line 3620). Change to `grid md:grid-cols-2 gap-3` so each occupies 6/12.

### 2) Move all "Match details" pills into an info icon inside the related input

Delete the standalone `<CrossCheckStrip … />` blocks currently rendered below the fields:
- GST tab (line 2260-2265): name-match-score strip below GST verified block.
- PAN tab (lines 2482-2500): 4 strips (panCrossCheckError, panMatchMessage, nameMatchMessage, fallback "PAN Number verified with GST PAN Number.", and the score strip).

Replace them with a trailing info icon rendered inside the corresponding input:
- GST tab → info icon inside **Legal Name** input; message = "Name match score: N%" (or existing GST message). Color reflects pass/fail.
- PAN tab → info icon inside **PAN Holder Name** input; concatenated message combining panMatchMessage + nameMatchMessage (or panCrossCheckError when failure). One icon per input; error state shown in destructive/orange color.

Implementation: extend `EditableOcrField` with an optional `trailingInfo?: { message: string; ok: boolean }` prop. When present, position an absolute `<NameMatchInfo />` (existing helper) at the right edge of the `<Input>` (input gets `pr-9`). Wire the GST Legal Name and PAN Holder Name fields to pass the appropriate props. The `CrossCheckStrip` helper (lines 3694-3722) becomes unused and is removed.

### 3) Bank tab — remove "Auto-filled from IFSC — please verify" line
Delete the two `<p>` blocks (lines 2840-2844 and 2979-2983) that show the Sparkles + "Auto-filled from IFSC — please verify" hint under Branch. IFSC-based auto-fill still happens; just no explanatory line.

### 4) Bank tab — show verified tick inside the input (reference screenshots 2 & 3)

Today, verified fields show a green tick + "…is verified" sentence *below* the input. Move that into a trailing tick badge inside the input (matching the uploaded Bank Details screenshots — green sealed-check badge at the right edge, with an orange/amber variant when the field is edited or doesn't match registry).

In `EditableOcrField`:
- Add a trailing status badge inside the `<Input>` wrapper (input gets `pr-9`):
  - `matchesApi` → green `BadgeCheck` icon (uses `text-success` on `bg-success/10`).
  - `mismatchApi` or `isEdited` → orange/amber icon (`text-warning` on `bg-warning/10`) with tooltip explaining mismatch / Edited.
  - Nothing when neither state applies.
- Remove the standalone "is verified" text row (lines 3838-3843). Keep the mismatch helper row (lines 3844-3859) since it also carries the "Use registry value" action — but demote it to appear only when `mismatchApi`, and keep it concise.

The existing bank Account Holder Name `NameMatchInfo` popover (lines 2858-2862 and 2997-3001) stays — but re-position it as the trailing info icon inside the input via the new `trailingInfo` prop, and drop the sibling wrapper `<div className="pt-6">…</div>`.

### Technical notes
- No changes to verification logic, state, or persisted data.
- Only file touched: `src/components/vendor/steps/DocumentVerificationStep.tsx`.
- Color palette: green = existing `--success` tokens; orange = existing `--warning` tokens (matches the app's Fiori-inspired scheme).
- Verify build after edits.
