## Problem

In **User Management → Approval Matrix → Configured Buyers**, cells like `dfd020d9`, `fdef7d40`, `2b0d11f8` appear. These aren't stored numbers — they're the first 8 chars of an approver UUID that the client can't resolve to a profile, produced by `buyerLabel`'s fallback `id.slice(0, 8)`.

Also confirmed: any approver stage that was **not selected** must display **"Skipped"** — same treatment as an explicitly skipped stage.

## Fix (display only, in `src/components/admin/ApprovalMatrixConfig.tsx`)

1. Add a `resolveApprover(uid)` helper returning the profile name/email if found in `profileById`, else `null`.
2. Rewrite the Configured Buyers table `cell(uid, skipped)`:
   - `skipped === true` → **Skipped**
   - `uid` is null/empty (not selected) → **Skipped**
   - `resolveApprover(uid)` returns null (user missing/deleted) → **Skipped**
   - otherwise → resolved name
   - Apply to all 5 columns: SCM Mgr, SCM Head, Finance 1, Finance 2, CEO Office (CEO Office currently shows "—" when unset — switch to **Skipped**).
3. Apply the same rule to the chain preview badges shown while editing a buyer, so unresolved/unset stages show **Skipped** instead of a UUID fragment or "not set".
4. Leave the Buyer column alone (row key; keep existing name/email fallback — never show "Skipped" for the buyer themselves).
5. Do **not** change the save payload, database schema, RLS, edge functions, or approval workflow. This is a pure rendering fix; stored approver IDs remain untouched.

## Verification

- `bunx tsgo --noEmit`.
- Reload `/admin/users` → Approval Matrix → Configured Buyers and confirm previously hex-looking cells now read **Skipped**, while correctly-assigned approvers still show their names.
