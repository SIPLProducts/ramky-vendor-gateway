## Changes

### 1. Rename "Created At" → "Created Date"
Only occurrence found in the codebase: `src/pages/Dashboard.tsx`
- Line 205: Excel export column header key `'Created At'` → `'Created Date'`
- Line 338: `<TableHead>Created At</TableHead>` → `<TableHead>Created Date</TableHead>`

(No other screen currently displays a "Created At" label — verified via ripgrep.)

### 2. Show vendor email in Dashboard email column
File: `src/pages/Dashboard.tsx`

Currently the Email cell renders only `v.primary_email`, which is empty until the vendor completes their profile. Fallback chain:
`primary_email` → `invited_by.email` (already loaded on the row) → `'—'`

Apply the same fallback to:
- Table cell render (line 380)
- Excel export `Email` column (line 203)

### 3. Update Invitations search placeholder
File: `src/pages/AdminInvitations.tsx` (line 947)
- `"Search by email, name or reference #..."` → `"Search by Name, Email or Phone Number"`

(No change to search logic — it already matches across those fields; if phone matching is missing we'll extend the filter to include `phone_number` in the same edit.)

### 4. Hide Preview button on all approval screens
File: `src/components/approvals/StageApprovalView.tsx` (shared by Buyer / SCM CO / SCM Head / Finance 1 / Finance 2 / CEO Office approvals)

Remove the two `<Button>…Preview</Button>` blocks at lines 254 and 348. Leave the `VendorSubmissionPreviewDialog` mount and state in place-but-unused so nothing else breaks; or remove them together if unreferenced after the button removal. Approvers will continue to open the vendor via the existing "Open" / row link.

## Out of scope
- No DB, RLS, or edge-function changes.
- No changes to email column on other pages (they either already show email in detail panes or use invitation email which is always populated).
