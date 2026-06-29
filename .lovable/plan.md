# Reference # search should also find email-invited vendors

## Problem

On **Buyer → Vendor Invitations**, the "Enter Reference Number → Search" box only resolves to a Vendor Status page for **on-behalf** vendors. When a buyer invited a vendor by email, and the vendor later registered and submitted, entering that vendor's Reference # returns "Not found" — even though the buyer is the invitation creator and is allowed to see that vendor's progress.

Result: buyers can't track email-invited vendors through the same Reference # search, only on-behalf ones.

## Root cause

In `src/pages/AdminInvitations.tsx → handleTrackByReference`, the non-admin branch joins `vendor_invitations → vendors!inner` filtered by `created_by IN creatorIds` AND `vendors.reference_number = ref`. For email-invited vendors, `vendor_invitations.vendor_id` is often not back-linked after the vendor self-registers, so the inner join drops the row and the lookup fails. The vendor itself IS readable to the buyer via the existing RLS policy `user_can_see_vendor` (covers buyer-created invitations, on-behalf, approver and SCM-manager mappings).

## Fix (single file, search-only)

In `src/pages/AdminInvitations.tsx`, simplify `handleTrackByReference`:

1. For **all roles** (admin and non-admin), query `public.vendors` directly:
   ```ts
   const { data } = await supabase
     .from('vendors')
     .select('id')
     .eq('reference_number', ref)
     .maybeSingle();
   ```
2. RLS (`user_can_see_vendor`) automatically enforces who can see what — admin/SAP team see all; buyers see their own invitations + on-behalf; SCM/approvers see their mapped vendors. No app-side scoping needed.
3. If a row comes back → `navigate('/vendor-status/' + id)` (existing behavior — that page already renders the full Vendor Details + Application Progress + Approval Progress timeline shown in the screenshot, including Submitted → Document Verification → Buyer Approval → SCM Manager → SCM Head → Finance 1 → Finance 2 → SAP Sync).
4. If no row → keep the existing "Not found / no access" toast.

Delete the now-unused `creatorIds` / `buyer_approval_flows` / `buyer_scm_mappings` lookup block inside this function (it was only used to scope the invitations join; RLS replaces it).

## Vendor-side visibility

The vendor already lands on `/vendor-status/:id` after submitting (existing route, same page). No change needed for the vendor experience — they see the same full timeline.

## Verification

- As a buyer who invited a vendor by **email**, after the vendor submits: enter Reference # → lands on `/vendor-status/:id` showing Vendor Details + Application Progress + Approval Progress.
- As a buyer who created an **on-behalf** vendor: existing flow still works.
- Reference # for a vendor the buyer is NOT entitled to see still shows "Not found" (RLS blocks).
- Admin / SAP team can search any Reference # (already true, unchanged).
- Inline "Search by email, name or reference #" table filter, the invitations table rendering, on-behalf Resume button, and the `/vendor-status` page itself remain untouched.

## Out of scope

No DB migrations, no edge function changes, no UI redesign of `/vendor-status`, no change to the invitations table, on-behalf flow, or RLS policies.
