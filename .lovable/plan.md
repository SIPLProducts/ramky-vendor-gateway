

## Polish Document Verification into an enterprise-grade inline form

### Goal
Transform Step 1 (Document Verification) from the current stacked "upload tile + status block" layout into a compact, inline, enterprise-grade form — same tabbed shell, but each stage reads like a professional data-entry section instead of a demo widget.

### Visual + layout changes (per tab)

Each of the 4 tabs (GST, PAN, MSME, Bank) gets the same consistent inline structure:

```text
┌─ Stage header ──────────────────────────────────────────────┐
│ [icon] GST Verification        [status pill: Verified ✓]    │
│ Short helper line in muted text                             │
├─────────────────────────────────────────────────────────────┤
│ Row 1 (gates, where applicable):                            │
│   [ Are you GST registered? ]   ( ) Yes  ( ) No             │
│                                                             │
│ Row 2 — Document + extracted fields, side-by-side:          │
│ ┌──────────────┐  ┌────────────────────────────────────┐    │
│ │  Upload box  │  │ Legal Name        [readonly input] │    │
│ │  (compact,   │  │ Trade Name        [readonly input] │    │
│ │   80px tall, │  │ GSTIN             [readonly input] │    │
│ │   filename + │  │ Constitution      [readonly input] │    │
│ │   re-upload) │  │ Principal Place   [editable text]  │    │
│ └──────────────┘  └────────────────────────────────────┘    │
│                                                             │
│ Row 3 — Inline action bar (right-aligned):                  │
│   [ Re-upload ]  [ Verify ▸ ]   • last verified 2s ago      │
└─────────────────────────────────────────────────────────────┘
```

Key principles:
- **Two-column grid (`md:grid-cols-2`)** for label/value pairs — no more single long stack.
- **Compact upload control** (single row with filename, size, replace link) instead of the large dropzone tile once a file is chosen.
- **Read-only verified fields** rendered as proper `Input` controls with a lock icon + "Verified" hint, not as plain text rows — keeps the form-grade look.
- **Status pill** in the stage header (Pending / Uploading / Extracting / Verifying / Verified / Failed) using the existing `status-badge` tokens from `index.css`.
- **Inline cross-check messages** (e.g. "PAN matches GSTIN ✓", "Name match 96%") shown as a slim alert strip under the grid, not as a separate card.
- **Sticky stage footer** inside each tab with the action buttons aligned to the right (`Re-upload`, `Verify`, `Continue` once done) — matches the enterprise pattern used elsewhere.

### Stage-specific tweaks

- **GST – No path**: when "No" is selected, the upload box collapses to a single-line "Download declaration → Upload signed copy" strip, and the manual fields (Legal Name, Address, City, State, Pincode) appear in the same 2-column grid below.
- **PAN**: 2 fields only (PAN, Holder Name) → use a tighter `md:grid-cols-3` so the row fills nicely; cross-check chip ("Matches GSTIN PAN") sits inline next to the PAN field.
- **MSME – No path**: shows a single muted info strip "Skipped — not MSME registered" and auto-marks the stage done.
- **Bank**: Account No, IFSC, Bank, Branch, Holder Name in `md:grid-cols-2`; penny-drop result chip ("Account active ✓") in the header status pill.

### Shell polish (applies to the whole step)

- Card padding tightened to `p-5`, section dividers use `border-border/60`.
- Tab triggers get fixed min-width and an inline status dot (existing chip logic kept).
- Footer summary above the global Continue button: `4 of 4 stages verified` with a thin progress bar — replaces the current ad-hoc text.
- Subtle `shadow-enterprise-sm` on each stage panel; consistent `rounded-lg`.

### Files

- **Edited** `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - Rewrite the body of each `TabsContent` to use the 2-column inline grid described above.
  - Introduce a small local `StageShell` helper inside the file (header + body + footer) so the 4 stages stay visually identical.
  - Replace the large upload tile with a compact `FilePill` (filename, size, replace) once a file is uploaded; keep the original dropzone only when no file yet.
  - Render verified values inside `<Input readOnly />` with a lock icon adornment instead of plain `<p>` tags.
  - Move action buttons (Verify / Re-upload) into a right-aligned inline footer per stage.

- **Edited** `src/components/vendor/steps/DocumentVerificationStep.tsx` only — no other components need changes; `OcrComparisonCard` is reused inline as the cross-check strip.

### Out of scope
- No changes to OCR logic, the dummy verifyApi, gating math, or auto-advance behaviour.
- No new design tokens — reuses existing `--primary`, `--success`, `--warning`, `--destructive`, and the `.status-badge` / `.shadow-enterprise-sm` utilities already in `src/index.css`.
- No changes to other registration steps (2–8) or the horizontal stepper.

