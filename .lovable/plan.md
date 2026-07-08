## Problem

After submitting a vendor application via an invitation link, the network tab shows:

```
PATCH /rest/v1/vendors?id=eq.<uuid>&select=*  → 406
PGRST116: The result contains 0 rows
Cannot coerce the result to a single JSON object
```

## Root cause

In `src/hooks/useVendorRegistration.tsx` the save/update calls use:

```ts
supabase.from('vendors').update(payload).eq('id', vendorId).select().single()
```

`.select().single()` runs a `RETURNING *` and re-applies the `SELECT` RLS policies on `vendors`. The update itself succeeds (the UPDATE policy `WITH CHECK` permits transitioning to `scm_manager_review`, `submitted`, etc.), but the returning SELECT is filtered to 0 rows in cases where the caller cannot re-read the row under any SELECT policy after the status transition. This happens most reliably in the "on-behalf" invitation flow (the buyer is the acting user, `vendors.user_id` is the vendor's user, and the buyer sees the row only via `vendor_invitations.vendor_id`, which may not yet be linked at the exact moment of insert/first update).

The update wrote correctly — only the returning row is empty — so `.single()` throws PGRST116 and the UI surfaces the 406.

## Fix (minimal, targeted)

Do not change any RLS, business logic, or submission flow. Only make the "read back after write" tolerant of an empty RETURNING result, because we already know the vendor id we just wrote to.

Edit `src/hooks/useVendorRegistration.tsx`:

1. Replace the three `.select().single()` calls used inside `writeVendorWithPanFallback` (lines ~963–968, ~980–984, ~1356–1361) with `.select().maybeSingle()`.

2. After each call, if `data` is null and there is no error, fall back to a fresh read of the row by id so downstream code (`uploadAllDocuments(formData, data.id)`, `setVendorId(data.id)`, resubmit return value) keeps working:

   - For the UPDATE branches (existing vendor): reuse the known `vendorId` — synthesize `{ id: vendorId }` (all downstream code only needs `.id`), or issue a follow-up `select('*').eq('id', vendorId).maybeSingle()` under the same client. Prefer the follow-up read; if it also returns null (RLS truly blocks), fall back to `{ id: vendorId }`.
   - For the INSERT branch: if `data` is null we cannot know the new id, so keep `.single()` behavior there but wrap with a clearer error message. In practice self-registration inserts satisfy the SELECT policy (`user_id = auth.uid()`), so this path already works; only the on-behalf INSERT is at risk and it already uses a different code path.

3. No changes to `submitFormMutation` (line 1168) — it already avoids `.select().single()`.

## Files touched

- `src/hooks/useVendorRegistration.tsx` — swap `.single()` → `.maybeSingle()` and add null-guard fallbacks at the three write sites listed above.

## Out of scope

- RLS policies on `vendors` (unchanged).
- Submission status transitions and approval routing (unchanged).
- Any other page or hook.

## Verification

- Submit a normal (self) invitation flow → no 406, submission succeeds, success dialog shows.
- Submit an on-behalf invitation flow → no 406, vendor row created and routed to SCM CO as before.
- Resubmit after "returned to vendor" → no 406, resubmission succeeds.
