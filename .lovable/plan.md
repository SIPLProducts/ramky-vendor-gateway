## Goal
A buyer can only be mapped to ONE SCM Manager per tenant. Saving the same buyer with a different SCM Manager must be blocked.

## Changes

### 1. Database migration
- Drop existing unique constraint on `buyer_scm_mappings(buyer_user_id, scm_manager_user_id)` if present.
- Add new unique constraint: `UNIQUE (tenant_id, buyer_user_id)`.
- This enforces "one SCM per buyer per tenant" at the DB level.

### 2. UI guard in `src/components/admin/BuyerScmMapping.tsx`
In `handleSave`, before insert:
- Check `mappings` for any existing row with the same `buyer_user_id`.
- If found, show toast: "This buyer is already mapped to {scmName}. Remove the existing mapping first." and abort.
- Keep the existing `23505` (unique violation) fallback toast for race conditions, with the new clearer message.

### 3. No other flow changes
- Domestic / International vendor flow: untouched.
- Approval flow logic, `include_scm_stages`, edge functions: untouched.
- Buyer dropdown remains showing all buyers (don't filter out mapped ones — admin may want to see them; the validation blocks the save).

## Out of scope
- Bulk reassignment UI
- Changing scm_manager on an existing mapping inline (admin deletes + re-adds)
