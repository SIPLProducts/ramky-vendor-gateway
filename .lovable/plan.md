## Problem

The Vendor Invitations table (`src/pages/AdminInvitations.tsx`) currently only knows three states — Pending, Used, Expired — derived purely from `used_at` / `expires_at`. It doesn't distinguish "vendor opened the link but hasn't started filling" from "vendor is mid-form (draft)" from "vendor already submitted". Submitted vendors keep showing in the invitations list, and Resend Email is only offered when `!used_at`, so a buyer can't nudge a vendor who opened the link or started a draft. On-behalf rows only show Resume, never a status that matches the invitation lifecycle.

The vendor row (already joined as `vendor:vendors(id, reference_number, status)`) tells us exactly what happened after the link was opened — `status = 'draft'` means resume-able, anything else means submitted/in workflow.

## Fix (frontend-only, `src/pages/AdminInvitations.tsx`)

### 1. Compute a richer status

Replace `getInvitationStatus` with a five-state resolver:

```
type InviteStatus = 'pending' | 'used' | 'draft' | 'expired' | 'submitted';
```

Rules, evaluated in order:

1. If `invitation.vendor?.status` exists and is NOT `'draft'` → `submitted` (row will be filtered out of the table).
2. If `invitation.vendor?.status === 'draft'` → `draft` (In Progress).
3. If `used_at` is set → `used`.
4. If `expires_at < now` → `expired`.
5. Otherwise → `pending`.

Notes:
- On-behalf rows never get `used_at` today; step 1/2 still classifies them correctly via the linked vendor row (draft vs submitted). If neither exists yet, they fall into `pending`, which matches the "buyer created but hasn't started" state.

### 2. Hide submitted invitations from the table

In the `filteredInvitations` pipeline, drop any row where the resolved status is `submitted` BEFORE search/status/pagination filters run. Keep the row in the DB (untouched) so it still powers Dashboard / All Vendors / Approval screens.

### 3. Status column badges

Extend `getStatusBadge` to render:

| Status | Variant | Icon | Label |
| --- | --- | --- | --- |
| pending | secondary | Clock | Pending |
| used | default (bg-info/blue) | Mail | Used |
| draft | default (bg-warning/amber) | Loader2 (static) | In Progress |
| expired | destructive | XCircle | Expired |

(`submitted` never renders because it's filtered out.)

### 4. Status filter dropdown

Update the Filter select options to: All Status, Pending, Used, In Progress (draft), Expired. Remove nothing else.

### 5. Resend Email availability

Replace the current `!isOnBehalf && !invitation.used_at && expires>now` guard on the Send Email button with:

- Show **Send Email** (label) when status is `pending`.
- Show **Resend Email** when status is `used` or `draft` (same underlying mutation; button label switches).
- Show **Resend Invitation** when status is `expired` — same `sendEmailInvitation.mutate` call. The edge function already accepts the existing invitation id; we additionally extend the row's `expires_at` before invoking:
  - On expired resend: `await supabase.from('vendor_invitations').update({ expires_at: new Date(Date.now() + 14*24*3600*1000).toISOString() }).eq('id', invitation.id)` then invalidate and call the mutation.
- Hide the Send/Resend button entirely for `submitted` (n/a — filtered out anyway).

Keep the existing **Resume** button (for on-behalf rows with no `used_at`) as-is; also show Resume for on-behalf `draft` rows (the current `!invitation.used_at` check already covers this since on-behalf rows never set `used_at`).

### 6. Scope guardrails

- No DB schema change, no RLS change, no edge function change.
- `sendEmailInvitation` mutation body stays the same; only the trigger conditions and button label change. For expired, we do a lightweight `update({ expires_at })` inline before invoking.
- Query key and select shape unchanged (`vendor:vendors(id, reference_number, status)` is already fetched).
- Dashboard / All Vendors / Approval screens are unaffected — they read `vendors`, not `vendor_invitations`.

## Verification

- `bun run build` passes.
- Playwright as buyer on `/admin/invitations`:
  1. Row with no vendor + not expired → Status "Pending", button "Send Email".
  2. Row with `used_at` set, no vendor → Status "Used", button "Resend Email".
  3. Row where `vendor.status === 'draft'` → Status "In Progress", button "Resend Email" (and Resume for on-behalf).
  4. Row with `expires_at < now`, no submitted vendor → Status "Expired", button "Resend Invitation" (extends expiry then sends).
  5. Row where `vendor.status !== 'draft'` (e.g. `buyer_review`) → row is absent from the table; vendor still appears in All Vendors.