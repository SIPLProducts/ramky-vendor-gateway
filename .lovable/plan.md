## Goal
Wipe all rows from `vendor_invitations` so you can re-issue fresh invitations from the Vendor Invitations screen. Existing vendors, users, SMTP configs, approval setup, branding, and all other data stay untouched.

## Scope
- **Delete:** all 110 rows in `public.vendor_invitations`.
- **Also delete (dependent, safe):** all rows in `public.invitation_email_events` (currently 0 — Resend webhook events tied to invitations). This avoids orphan rows.
- **Do NOT touch:** `vendors` (25 rows), `profiles`, `user_roles`, `user_tenants`, `smtp_email_configs`, `tenant_branding`, `approval_matrix_*`, `audit_logs`, `sap_*`, or any other table.

## Will it work after clearing?
Yes — full re-invite + vendor submission flow will continue to work on both preview and `vms.siplproducts.com`:
1. Buyer opens Vendor Invitations → "Invite Vendor" → enters email → invitation row is created with a fresh token, `created_by` set to buyer, and `send-vendor-invitation` edge function emails the link via the buyer's SMTP config.
2. Vendor clicks link → `/vendor/invite?token=...` → `record_invitation_access` + `claim_invitation` work because they look up by token (which is unique per new row).
3. Vendor fills the 7-step form, submits → `notify-vendor-submission` finds `created_by` on the new invitation and notifies the buyer + CC list.

No code, RLS, edge function, or schema change is required. The recent fix that backfills `created_by` on send remains in place, so new invitations will always carry the buyer link.

## Caveats
- Any vendor who already received an old invitation link will get "Invitation not found" if they click it after the wipe. They must be re-invited.
- The 25 existing `vendors` rows remain. If a vendor was invited before, completed registration, and you re-invite the same email, they can still register again (a new invite + new submission path); existing vendor records are not affected.
- This runs against the **same Lovable Cloud database** used by both preview and `vms.siplproducts.com` (single backend). The clear applies to both immediately — that is expected and is what you asked for.

## Execution (after you approve)
Two `DELETE` statements via the data tool:
```sql
DELETE FROM public.invitation_email_events;
DELETE FROM public.vendor_invitations;
```
Then a quick `SELECT COUNT(*)` to confirm both are 0. No file edits, no migration, no edge function redeploy.
