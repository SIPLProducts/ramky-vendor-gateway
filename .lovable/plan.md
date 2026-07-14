## Text/Subtitle updates

**1. Approval stage page subtitles** (`src/pages/approvals/*.tsx`)

- `BuyerApproval.tsx` — change subtitle to: *"Review and verify vendor applications before they are forwarded to SCM CO."*
- `ScmManagerApproval.tsx` — remove subtitle (pass `subtitle=""` or drop prop)
- `ScmHeadApproval.tsx` — remove subtitle
- `Finance1Approval.tsx` — remove subtitle
- `Finance2Approval.tsx` — remove subtitle
- `CeoApproval.tsx` — remove subtitle

I'll first check `StageApprovalView` to confirm `subtitle` is optional; if required, I'll make it optional so the empty ones render cleanly.

**2. "Organization Details" → "Vendor Details"**

Global rename across all occurrences in the codebase (view details dialogs/pages, section headers, labels). I'll ripgrep for `Organization Details` and replace each match with `Vendor Details`.

No logic, routing, or backend changes.