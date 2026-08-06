# Fix the fetch-tenants-from-sap boot error

## What's wrong

The worker boot error is a plain syntax error in `supabase/functions/fetch-tenants-from-sap/index.ts`, introduced by the last diagnostics edit. In the proxy branch:

- Line 292 opens `if (!res.ok) {`
- Line 301 closes that block with `}`
- Line 302 then starts `} else {` — one closing brace too many

So the file never parses, the edge runtime can't boot the worker, and every call returns `InvalidWorkerCreation`. Nothing else in the function is broken.

## The fix

Replace lines 301-302 (`}` followed by `} else {`) with a single `} else {`, so the structure reads:

```text
if (!res.ok) {
  ...error hints...
} else {
  ...parse middleware wrapper...
}
```

No logic changes, no other files touched.

## About "are edge functions required?"

Yes. On the self-hosted server the app calls `/supabase/functions/v1/<name>` for tenants fetch, SAP sync, invites, KYC, email, etc. They must exist under `backend/volumes/functions/` and the `functions` container must be running. A parse error in any one function only breaks that function — the others keep working.

## After approval

1. Apply the brace fix in this repo.
2. On the DEV server, re-sync functions and recreate the container:
   `sudo bash scripts/selfhost/deploy-latest.sh --skip-build --skip-migrations --skip-frontend`
3. Re-test the endpoint; it should now return either tenants or the new granular error (timeout / refused / 401 secret mismatch) with the attempted URL.
