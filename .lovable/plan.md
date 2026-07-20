## Document Verification UI cleanup — round 2

### 1) Remove the "Document Verification" section header
On the vendor registration page, right below the "Invited Email: …" banner, remove the block that shows the shield icon + "Document Verification" title. Keep the "Document verification — X of 4 stages verified" progress card and the GST/PAN/MSME/Bank tab strip.

- File: `src/components/vendor/steps/DocumentVerificationStep.tsx` — locate the outer `StageShell` (or wrapper) that renders the "Document Verification" heading for the whole step and remove that header wrapper, leaving its children (progress bar + tabs) intact.

### 2) GST tab — Jurisdiction fields in 4 columns
In `src/components/vendor/kyc/GstKycTab.tsx`, change the grid that renders the jurisdiction-related fields (Centre Jurisdiction, State Jurisdiction, etc.) to `grid md:grid-cols-4 gap-4`.

### 3) Bank tab — make Account Type and Bank Address read-only
In `src/components/vendor/kyc/BankKycTab.tsx`:
- Add `readOnly` (with `bg-muted/40 cursor-not-allowed` styling) to the `Account Type *` input/select.
- Same treatment for the `Bank Address` input/textarea.
Values still populate from OCR/API but the vendor cannot edit them.

### 4) Move ALL cross-match messages into an (i) popover on the related name field
Any place in the KYC tabs (GST / PAN / MSME / Bank) currently rendering the long inline banner such as:

> "Account Holder Name matched with GST Legal Name (100% — Strong Match) and GST Trade Name (100% — Strong Match) and PAN Holder Name (100% — Strong Match)"

…is removed from inline display. Instead, a small `Info` (ⓘ) icon from `lucide-react` appears at the trailing edge of the corresponding name input. Clicking it opens a shadcn `Popover` showing the same message.

Mapping per tab:
- GST tab → info icon on **Legal Name** (and Trade Name if a separate message exists) → shows GST cross-match message.
- PAN tab → info icon on **PAN Holder Name** → shows PAN cross-match message.
- MSME tab → info icon on **Enterprise Name** → shows MSME `enterpriseCheckMessage`.
- Bank tab → info icon on **Account Holder Name** → shows bank cross-match message.

Implementation:
- Add a small reusable component `src/components/vendor/kyc/NameMatchInfo.tsx` — props: `{ message: string; status: 'passed'|'failed'|'skipped' }`. Renders a `lucide-react` `Info` icon inside a shadcn `Popover`. Icon color reflects status (success / destructive / muted). Returns `null` when `message` is empty.
- In each KYC tab, remove the existing inline banner JSX block that renders the match sentence, and mount `<NameMatchInfo />` next to the associated name input (as a trailing adornment or absolute inside the input wrapper).
- Keep the mismatch `AlertDialog` behavior unchanged — that still opens automatically on a failed verification.

### Technical notes
- Presentation-only. No changes to verification logic, validation state, or persisted data.
- Reuse existing state (e.g. `enterpriseCheckMessage`, equivalent variables in other tabs) — just re-route from banner JSX into the new popover.
- Verify build after edits.
