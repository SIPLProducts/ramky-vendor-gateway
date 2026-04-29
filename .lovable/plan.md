I found the actual cause of the SAP Sync failure shown in your screenshot.

The middleware is running correctly and is reachable at:

```text
https://donation-pantyhose-starter.ngrok-free.dev/sap/bp/create
```

But the saved SAP API configuration currently has no proxy secret saved:

```text
SAP API Config: Create vendor in Sap
Connection mode: proxy
Middleware URL: configured
Proxy Secret / Password: missing
```

Because of that, the backend function calls your middleware without the required `x-middleware-key` header, and the middleware correctly returns:

```text
401 Unauthorized
{"ok":false,"error":"Unauthorized"}
```

## Plan to fix it

1. **Add a guard before SAP sync**
   - Update `sync-vendor-to-sap` so that if proxy mode is selected and `Proxy Secret / Password` is empty, it stops before calling middleware.
   - The user will see a clear setup message instead of a generic SAP failure.

2. **Improve SAP API Settings validation**
   - Update the SAP API edit screen so `Proxy Secret / Password` becomes required when `Connection Mode = Via Proxy Server`.
   - Add helper text explaining that it must exactly match `MIDDLEWARE_SHARED_SECRET` from `middleware/.env`.
   - Prevent saving an invalid proxy configuration with a blank secret.

3. **Improve Test SAP Connection**
   - In proxy mode, the test should validate both:
     - middleware is reachable at `/health`
     - proxy secret is configured before allowing sync
   - This will catch the issue from the settings screen before users click Sync.

4. **Fix the existing saved configuration**
   - Update the current SAP API configuration so the `proxy_secret` field is populated.
   - Important: I will not expose or print the secret value. It must be the same value you have in `middleware/.env` as `MIDDLEWARE_SHARED_SECRET`.

## What you need to verify locally

On your middleware machine, your `.env` must contain a real shared secret, for example:

```text
MIDDLEWARE_SHARED_SECRET=<same value saved in SAP API Settings Proxy Secret / Password>
```

Then restart the middleware:

```text
node server.js
```

After the fix, the sync flow will be:

```text
SAP Sync button
  -> backend sync function
  -> sends x-middleware-key from saved Proxy Secret / Password
  -> Node.js middleware accepts request
  -> middleware forwards vendor payload to SAP
```

## Files to update

- `supabase/functions/sync-vendor-to-sap/index.ts`
- `supabase/functions/sap-api-test-connection/index.ts`
- `src/pages/SapApiConfigEdit.tsx`
- `src/hooks/useSapApiConfigs.tsx`
- optionally `src/components/sap/SapConnectivityGuide.tsx` for clearer instructions

Once approved, I’ll apply these changes and also correct the current saved SAP API configuration so the sync button no longer fails with 401.

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>