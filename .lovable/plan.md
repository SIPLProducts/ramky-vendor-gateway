## Problem

On the self-hosted server, an on-behalf vendor submission stays visible on **Admin → Invitations**, even though the same flow correctly disappears in local/cloud. On local, the row is filtered out because `getInvitationStatus()` reads `invitation.vendor.status` (`scm_manager_review`) and returns `'submitted'`, which the list filter drops.

## Root cause

The invitations query joins vendors through the embedded relation:

```
vendor:vendors!vendors_invitation_id_fkey(id, reference_number, status)
```

This depends on `vendors.invitation_id` + a FK named `vendors_invitation_id_fkey` existing in the database. That column/FK is **not** defined in any migration under `supabase/migrations/`; it exists only on the managed cloud DB (added out-of-band). On the self-hosted Postgres the relation is missing, so PostgREST returns `vendor: null` for every row. With `vendor.status` undefined and `created_on_behalf = true`, `getInvitationStatus()` falls into the `'in_progress'` branch and the row is never filtered — it lingers on the Invitations page.

Meanwhile `useVendorRegistration` already writes `vendor_invitations.vendor_id` on submit (both normal and on-behalf paths), and that column/FK does exist. So the reliable link is invitation → vendor via `vendor_invitations.vendor_id`, not vendor → invitation via `vendors.invitation_id`.

## Fix

Stop relying on the fragile `vendors_invitation_id_fkey` relation. Resolve the linked vendor via `vendor_invitations.vendor_id` instead, which works on both cloud and self-host.

### 1. `src/pages/AdminInvitations.tsx` — invitations query

- Drop the embedded `vendor:vendors!vendors_invitation_id_fkey(...)` join from both the `seesAllInvitations` branch and the scoped branch. Keep the `tenants(id, name)` join.
- After fetching invitations, collect the non-null `vendor_id`s, run a single `supabase.from('vendors').select('id, reference_number, status').in('id', ids)` query, build an `id → vendor` map, and attach `row.vendor = map.get(row.vendor_id) ?? null` before returning.
- Remove the `r.vendor = Array.isArray(...) ? r.vendor[0] : r.vendor` normalization (no longer needed).
- No changes to `getInvitationStatus`, filtering, or UI — once `row.vendor.status` is populated for submitted on-behalf rows, they naturally resolve to `'submitted'` and drop off the list.

### 2. No other files change

- `useVendorRegistration.tsx` already sets `vendor_invitations.vendor_id` and `used_at` on submit; no change needed.
- Approval, dashboard, and status pages are unaffected.
- No DB migration is proposed here — the self-hosted DB is out of scope for a schema fix from this app, and the code change makes the UI robust regardless of whether `vendors.invitation_id` exists.

## Verification

- `bunx tsgo --noEmit` clean.
- Manual (self-host after deploy): submit an on-behalf vendor → row disappears from Invitations and shows up on Dashboard / approval queues.
- Manual (cloud): existing behavior unchanged; used/expired/pending still render correctly.
