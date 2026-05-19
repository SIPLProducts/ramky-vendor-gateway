## Root cause

In `supabase/functions/sync-vendor-to-dms/index.ts`, the audit log insert references `auth.user.id`:

```ts
await supabase.from("audit_logs").insert({
  vendor_id: vendor.id,
  user_id: auth.user.id,   // ❌ auth.user is undefined
  ...
});
```

But the shared helper `requireAuthenticatedUser` (in `supabase/functions/_shared/auth.ts`) returns:

```ts
{ ok: true, userId: string, email: string | null, roles: string[] }
```

There is no `auth.user` object — only `auth.userId`. So as soon as a DMS upload succeeds against SAP and we reach the audit log write, the function throws `Cannot read properties of undefined (reading 'id')`, the outer catch returns `{ success: false, message: "...", results: [] }`, and nothing is dynamic — the SAP response is actually being discarded.

The "DMS Synced" badge you see in the UI is the vendor's previously persisted `status` from an earlier successful run, not a fresh confirmation.

## Plan

1. **Fix the auth field reference** in `supabase/functions/sync-vendor-to-dms/index.ts`:
   - Replace `auth.user.id` with `auth.userId` in the `audit_logs` insert.

2. **Verify no other stale references** in the same file (search for `auth.user`, `auth.email`) and align them with the helper's actual shape (`auth.userId`, `auth.email`, `auth.roles`).

3. **Redeploy** only `sync-vendor-to-dms`.

4. **Expected result after fix**:
   - The function will return SAP's real dynamic response in `results[].sap` and `results[].sapRows` (e.g. `MSGTYP: "S"`, `MSG: "File(s) Uploaded Successfully"`, `ERDAT`, `UZEIT`, `UNAME`) exactly as SAP sends it per call — nothing hardcoded.
   - Top-level `success` will reflect the actual SAP outcome, and the audit log row will be written under the real authenticated user id.

No other files need to change.
