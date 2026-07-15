# SAP diagram label + vendor email display

## 1. Diagram SAP step: show sub-status text (matches badge)

File: `src/components/vendor/RegistrationStatusTracker.tsx` — SAP-step description mapping only.

Update the small line under the SAP icon so it mirrors the "SAP Sync Status" badge in Vendor Details:

| Vendor state | Diagram SAP step description | Step visual |
|---|---|---|
| `sap_team_rejected` / `sap_team_closed` | `Duplicate & Closed` | failed (red) |
| `sap_synced` / `dms_synced` | `SAP Synced · <code>` (or `SAP Synced` if no code) | completed |
| `dms_sync_pending` | `DMS Pending · <code>` | active |
| `pending_sap_sync` + `sap_vendor_code` | `DMS Pending · <code>` | active |
| `pending_sap_sync`, no code | `SAP Sync Pending` | active |
| all approvals done, no SAP state yet | `SAP Sync Pending` | active |
| otherwise | `Awaiting SAP sync` | pending |

Only the failed-branch label changes from generic "Action required" to explicit "Duplicate & Closed". Icon/color stay as-is.

## 2. Vendor Email not showing in Vendor Details card

File: `src/pages/VendorStatus.tsx`

The Email field currently reads only `vendor.primary_email`, which is null for older / buyer-invited vendors that store the address in another column. Fix by:

- Extending the vendor `select` to also fetch `contact_email` and pulling the invitation email as a final fallback.
- Rendering the first non-empty of: `primary_email` → `contact_email` → `vendor_invitations.email` (for this vendor, most recent) → `—`.

Implementation:

1. Add `contact_email` to the `.select(...)` on `vendors`.
2. Add a second query after the vendor loads: `supabase.from('vendor_invitations').select('email').eq('vendor_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()` and keep the result in a `inviteEmail` state.
3. Update the Email `<Field>` to display `vendor.primary_email || vendor.contact_email || inviteEmail || '—'`.

No changes to schema, RLS, or other pages. Only the Vendor Details Email cell and the SAP diagram label are affected.

## Out of scope

Backend, workflow, approval logic, and other pages remain untouched.
