## Confirmed issue

Your SAP API screen shows the Classification config as:

```text
http://10.200.1.7
```

But the registration page error is still using:

```text
http;//10.200.1.7/sap/proxy
```

So the failure is **not SAP**, **not Docker**, and **not tenant API**. The classification function is still seeing or constructing a malformed middleware URL. This needs to be fixed defensively in code so it works dynamically in both Lovable Cloud and self-hosted deployments, even if a URL was previously saved with a typo.

## Plan to fix without disturbing other functionality

1. **Fix URL normalization in the classification edge function**
   - Update `supabase/functions/sap-master-fetch/index.ts` only for SAP master/classification fetching.
   - Normalize common middleware URL mistakes before calling middleware:
     - `http;//10.200.1.7` → `http://10.200.1.7`
     - `https;//...` → `https://...`
     - `http:/10.200.1.7` → `http://10.200.1.7`
     - remove accidental `/sap/proxy`, `/api/sap/proxy`, `/sap/bp/create`, `/health` suffixes.
   - Validate the final proxy URL before fetch so the user gets a clear message if the config is still invalid.

2. **Keep it dynamic, not hardcoded**
   - Do not hardcode `10.200.1.7`.
   - Continue using the `middleware_url` saved in SAP API Settings for each config row.
   - Classification will use the saved `Classification F4s` config; tenant will continue using `Tenants From SAP`.

3. **Prevent the typo from being saved again**
   - Update `src/hooks/useSapApiConfigs.tsx` so SAP API Settings auto-corrects the same URL typos whenever admins create/update SAP configs.
   - This protects all SAP config rows going forward but does not change their behavior.

4. **Support both middleware path styles safely**
   - In `sap-master-fetch`, try `${middlewareBase}/sap/proxy` first.
   - If that route returns 404/HTML from a reverse proxy, retry `${middlewareBase}/api/sap/proxy`.
   - This makes the same config work across Lovable Cloud/ngrok and self-hosted server routing.

5. **Improve classification error output**
   - Include the config name and the URLs attempted in the error.
   - This avoids the current misleading generic message.

6. **Deployment after implementation**
   - Lovable Cloud deploys automatically.
   - On your `10.200.1.7` server, redeploy/copy the updated `sap-master-fetch` function and restart `supabase-edge-functions`.
   - No database schema, tenant API, registration fields, upload, KYC, or vendor sync flow will be changed.

## Additional security note

You pasted server secrets/passwords in the chat. After the fix is deployed, rotate the middleware/shared secrets and SAP password on your server because they are now exposed in the conversation.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>