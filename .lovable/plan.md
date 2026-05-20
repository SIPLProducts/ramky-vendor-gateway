## Problem

The SAP endpoint `POST http://10.200.1.2:8000/vendor/bp/create?sap-client=300` expects:
```json
{ "UMAIL": "divyabharathi.dogga@ramky.com" }
```
…and returns a top-level array `[{ "BUKRS": "0001", "BUTXT": "SAP A.G." }, ...]`.

The current edge function sends `{ "email": "..." }`, which SAP doesn't recognize, so it returns an empty/non-JSON body → UI shows "SAP response not JSON:".

## Fix

**`supabase/functions/fetch-tenants-from-sap/index.ts`** — change the outgoing payload key from `email` to `UMAIL`:

```ts
const requestBody = { UMAIL: email };
```

No other changes needed:
- Response parser (`extractTenants`) already handles a top-level array and already maps `BUKRS → code`, `BUTXT → name`.
- `admin-create-user` already upserts `{code, name}` rows into `tenants` and assigns them to the user.
- Dialog UI already renders the checkbox list from `tenants[]`.

## Verification

After deploy, enter `divyabharathi.dogga@ramky.com` in Create User → press Enter → expect the 10 BUKRS/BUTXT rows to appear as checkboxes.
