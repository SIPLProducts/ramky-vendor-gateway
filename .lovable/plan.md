## Goal

Make the buyer-notification-on-vendor-submission flow fully dynamic for every vendor, with zero hardcoding. Whoever sent the invitation automatically receives the No-Reply email when that vendor submits — no per-vendor patching, ever.

## What's already in place (from previous turn)

- DB migration sets `vendor_invitations.created_by` default to `auth.uid()` and adds a `BEFORE INSERT` trigger that auto-fills it if missing.
- `AdminInvitations.tsx` blocks insert if `user?.id` is falsy (no more ghost invitations).
- `notify-vendor-submission` reads `invite.created_by` → looks up that buyer's email → sends notification.
- `send-smtp-email` honors multi-value `Reply-To` from `portal_config.smtp_reply_to`.
- `NoReplyEmailConfig.tsx` exposes the multi-email Reply-To chips UI.

That stack is already dynamic for **every new invitation going forward**. The only non-dynamic piece is **historical invitations** that were created before the trigger existed and still have `created_by = NULL` — those can never auto-resolve a buyer because the information was never recorded.

## Plan (no hardcoding, no per-vendor patches)

### 1. Verify the dynamic path end-to-end

Read `notify-vendor-submission/index.ts` and `useVendorRegistration.tsx` to confirm:
- On every vendor submit, the function is invoked with the vendor id.
- The function resolves invitation → `created_by` → buyer profile email purely from DB lookups (no hardcoded ids/emails anywhere).
- Email body is built from the vendor row dynamically (Vendor Name, Email, Reference, Vendor ID, Submitted At).

If any hardcoded id, email, or tenant slipped in, remove it.

### 2. Handle legacy NULL `created_by` invitations generically

For invitations created before the trigger (where `created_by IS NULL`), the function currently logs `skipped: no_inviter` and silently drops the email. Two generic, non-hardcoded fallbacks:

a. **Tenant-admin fallback (preferred):** If `invite.created_by` is NULL, look up all `customer_admin` users in the invitation's `tenant_id` (via `user_tenants` + `user_roles`) and notify them instead. This works for any tenant, any vendor.

b. **Audit-log backfill (one-time, generic):** Run a single SQL pass that, for every `vendor_invitations` row with `created_by IS NULL`, tries to recover the inviter from `audit_logs` where `action = 'invitation_created'` and `details->>'invitation_id'` matches. If found → set `created_by`. This is a generic backfill, not vendor-specific.

### 3. Surface failures instead of swallowing them

In `notify-vendor-submission`, when no recipient can be resolved (no `created_by` and no tenant admin), insert an `audit_logs` row (`action = 'buyer_notification_failed'`) with the vendor id and reason. Admins can see why an email didn't go out — no silent skips.

### 4. Out of scope

- No changes to email template content.
- No changes to SMTP/Reply-To logic (already done last turn).
- No per-vendor SQL patches.

## Open question

For step 2a, confirm: when `created_by` is missing, do you want to notify **all `customer_admin` users of that tenant**, or only a specific designated role (e.g. SCM manager mapped to that vendor's category)? Default if you don't answer: notify all `customer_admin`s of the tenant.