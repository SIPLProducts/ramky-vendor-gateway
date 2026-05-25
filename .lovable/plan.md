## Goal
Eliminate the misleading "Edge Function returned a non-2xx status code" error in the Create User dialog when the selected role is `sharvi_admin` or `admin`, since tenants are not required for those roles.

## File
`src/components/admin/CreateUserDialog.tsx`

## Changes

1. **Guard `fetchSapTenants()`** — early-return when `tenantOptional` is true so the SAP lookup never fires for admin roles:
   ```ts
   const fetchSapTenants = async () => {
     if (tenantOptional) return;
     // ...existing body
   };
   ```

2. **Guard the email `onBlur` and `onKeyDown`** so they don't trigger SAP fetch for admin roles:
   ```tsx
   onKeyDown={(e) => { if (e.key === 'Enter' && !tenantOptional) { e.preventDefault(); fetchSapTenants(); } }}
   onBlur={() => { if (!tenantOptional && email.trim() && !sapFetched && !fetchingSap) fetchSapTenants(); }}
   ```

3. **Clear stale SAP state when role switches to an admin role.** Add a `useEffect` on `selectedRole`:
   ```ts
   useEffect(() => {
     if (tenantOptional) {
       setSapTenants([]); setSelectedCodes([]); setSapError(null); setSapFetched(false); setFetchingSap(false);
     }
   }, [selectedRole]);
   ```

4. **Replace the Tenants section with a simple info note when `tenantOptional`:**
   ```tsx
   {tenantOptional ? (
     <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
       Admin roles have global access — no tenant selection required.
     </div>
   ) : (
     /* existing Tenants label + list block unchanged */
   )}
   ```

5. **Update the email helper text** to hide the "Press Enter to load tenants" hint when `tenantOptional`.

## Out of scope
- No backend / edge function changes
- No changes to `handleSubmit` (already sends empty `sap_tenants` for admin roles)
- No changes to other roles or other dialogs

## Follow-up (separate)
If the `Create failed` toast still appears after these changes, the failure is inside the self-hosted `admin-create-user` edge function. Share `supabase functions logs admin-create-user` (or Docker logs for `supabase-edge-functions`) so we can debug — likely culprits: missing `SUPABASE_SERVICE_ROLE_KEY`, RLS rejecting `user_roles` / `audit_logs` inserts, or the `handle_new_user` trigger erroring.