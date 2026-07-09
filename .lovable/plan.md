# Vendor Invitations — Status Column + Draft Auto-Save

## Part A — Fix Vendor Invitations status column

### Root cause
The two rows showing "Used" are on-behalf registrations whose vendors are already at `pending_sap_sync` / `scm_manager_review` — they should be hidden. The query embed `vendor:vendors(...)` resolves the wrong direction (FK is `vendors.invitation_id → vendor_invitations.id`, one-to-many), so `invitation.vendor?.status` is `undefined` and the code falls through to "Used".

### Status definitions

| Status      | Meaning                                        | Detection                                                     |
| ----------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Pending     | Email sent, link not yet clicked               | `!used_at && !created_on_behalf && !expired`                  |
| Used        | Link clicked, no form data yet                 | `used_at` set, no vendor row                                  |
| In Progress | Draft — data partially filled / on-behalf draft | vendor row with `status = 'draft'`                            |
| Expired     | Link past `expires_at`, no draft/submission    | `expires_at < now()` and not In Progress/Submitted            |
| Submitted   | **Hidden** from this table                     | vendor row with `status != 'draft'`                           |

### Changes — `src/pages/AdminInvitations.tsx`

1. **Fix join** (~lines 139 & 178):
   ```ts
   .select('*, vendor:vendors!vendors_invitation_id_fkey(id, reference_number, status), tenants(id, name)')
   // normalize
   data.forEach((r: any) => { r.vendor = Array.isArray(r.vendor) ? r.vendor[0] ?? null : r.vendor; });
   ```

2. **Rewrite `getInvitationStatus`**:
   ```ts
   type InviteStatus = 'pending' | 'used' | 'in_progress' | 'expired' | 'submitted';
   const getInvitationStatus = (inv: any): InviteStatus => {
     const v = inv?.vendor?.status as string | undefined;
     if (v && v !== 'draft') return 'submitted';
     if (v === 'draft' || inv.created_on_behalf) return 'in_progress';
     if (inv.used_at) return 'used';
     if (new Date(inv.expires_at) < new Date()) return 'expired';
     return 'pending';
   };
   ```
   Keep existing `if (status === 'submitted') return false;` — it will now correctly hide those rows.

3. **Badges**: Pending (grey), Used (blue), In Progress (amber), Expired (red).

4. **Filter dropdown**: All Status / Pending / Used / In Progress / Expired.

5. **Action buttons**:
   - Pending → **Send Email**
   - Used → **Resend Email**
   - In Progress → **Resend Email**
   - Expired → **Resend Invitation** (existing `handleResend` extends expiry by 14 days first)
   - On-behalf Resume button unchanged.

## Part B — Auto-save drafts in Vendor Registration

Today the vendor form saves only when the user clicks Save/Next. If they close the tab mid-step, unsaved changes are lost and the invitation stays showing "Used" instead of moving to "In Progress".

### Changes — `src/pages/VendorRegistration.tsx`

1. **Debounced auto-save hook**: watch the form's data object. When it changes, wait 2 seconds of idle, then call the same upsert path that "Save Draft" already uses. Skip when nothing has changed vs the last saved snapshot.

2. **Trigger on step change**: fire an immediate save when the user navigates between steps (Next/Back/tab click), so the vendor row is created as soon as any real data exists.

3. **Save on unload**: `beforeunload` handler calls a synchronous best-effort flush (only if there are pending unsaved changes).

4. **First-write behaviour**: if no vendor row exists yet, the first auto-save creates it with `status = 'draft'` and `invitation_id` set — this is what flips the invitation from "Used" to "In Progress" without any user action.

5. **Silent by default**: no toast on auto-save (avoid noise). Keep the existing toast on explicit "Save Draft" click. Show a small "Saving…/Saved" indicator near the step header.

6. **Guard rails**:
   - Skip auto-save while a manual save is in-flight.
   - Skip if the vendor is already past draft (submitted / in workflow) — read `status` before writing.
   - Do not auto-save the OCR/verification transient state, only persisted form fields.

## Out of scope

- No DB / RLS / edge-function changes.
- No changes to `sendEmailInvitation` mutation body.
- No changes to Dashboard, All Vendors, Approvals, or the submitted-vendor flow.

## Verification

1. `bunx tsgo --noEmit` clean.
2. Vendor Invitations no longer lists rows whose vendors are in `pending_sap_sync` / `scm_manager_review` / `buyer_review` / etc.
3. On-behalf draft rows show **In Progress** with **Resend Email**.
4. Fresh email invite → **Pending / Send Email**. After vendor opens link → **Used / Resend Email**. After vendor types into any field and 2s pass (or navigates a step) → **In Progress / Resend Email**, with no manual save required.
5. Refresh mid-form: previously entered fields persist.
