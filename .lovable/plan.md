## Reorder duplicate vendor email sections

In the "Vendor Closed — Duplicate detected in SAP" email, swap the section order so **Existing Vendor Details** appears first, followed by the current vendor's details table (Vendor Name, Reference Number, Closed By, Stage, Reason, Remarks, Closed Date & Time).

### File to change
- `supabase/functions/sap-team-reject-vendor/index.ts` — move the `existingBlock` HTML above the main vendor details `<table>` in the email body. No other content/logic changes.

### Validation
- Trigger a duplicate SAP sync and confirm the email renders Existing Vendor Details table first, then the vendor summary table below it. All other emails and flows unchanged.