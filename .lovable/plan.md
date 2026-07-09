## Dashboard Email column + prior changes

### Email column source of truth
For each vendor row, the Email column should show the address the invitation was sent to (the vendor's own email), and for on-behalf submissions it should show the vendor's Registered Email 1 that the buyer entered.

In `src/pages/Dashboard.tsx`:

1. Extend the `vendors` select to include `registered_email` (in addition to `primary_email`).
2. Extend `VendorRow` with `registered_email: string | null` and `display_email: string | null`.
3. In the invitations fetch (line 176-186), also select `created_on_behalf` and store it in the `latest` map alongside `email` and `created_by`.
4. When merging (line 200-207), compute `r.display_email` as:
   - if invitation `created_on_behalf` is true → `vendor.registered_email` (contact email 1); fall back to invitation email if registered_email is empty.
   - else → invitation email (the address the vendor was invited on); fall back to `vendor.primary_email` if invitation email is missing.
5. Email table cell (line 433) and CSV export `Email` value use `v.display_email ?? '—'` / `?? ''`.
6. Header `Company` → `Vendor Name` (line 387). CSV key `'Company Name'` → `'Vendor Name'`.

Nothing else in the Email pipeline changes; the "Invited By" column keeps showing the buyer's name/email.

### Vendor display name precedence (unchanged plan)
Rule: **Trade Name → Legal Name → PAN Account Holder Name → "—"** using existing `pickVendorDisplayName` from `src/lib/sapPayloadBuilder.ts`.

Apply in display-only spots (labels/titles/table cells), skipping fields explicitly labelled "Legal Name":
- `src/pages/Dashboard.tsx` — vendor name cell + CSV.
- `src/pages/VendorStatus.tsx` — "Company Name" field.
- `src/pages/VendorList.tsx` — card title, dialog title, return-target label.
- `src/pages/FinanceReview.tsx` — list heading + dialog title.
- `src/pages/SAPSync.tsx` — headings and toast description.
- `src/pages/GstCompliance.tsx` — vendor name cell.

### Buyer approval action buttons
In `src/components/approvals/StageApprovalView.tsx` pending-items row (lines 279–301):
- Rename the buyer branch label "Send Back to Vendor" → **Reject**; drop the `Undo2`/`XCircle` conditional so every stage uses `XCircle` + "Reject".
- Reorder so **Reject** renders above/before **Approve** (swap the two `<Button>` blocks).
- Update dialog title (line 465) and confirm button (line 508) so the buyer branch reads "Reject" instead of "Send back to vendor" / "Send Back to Vendor".
- Backend action key (`'reject'`) and edge-function calls are unchanged — label/order only.

### Verification
- `bunx tsgo --noEmit`
- On-behalf vendor invitations show the vendor's Registered Email 1; regular self-signup vendors show the invitation email.
- Vendor Name column filled via Trade → Legal → PAN-holder fallback.
- Buyer Approval action row shows Reject (red, XCircle) first, then Approve; dialog + confirm say "Reject".