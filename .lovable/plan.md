## Goal
Make `strict_check_name` (and any other multipart extra fields) visible in the edge function logs with their actual values, so you can confirm in the Node/edge console log that the field is being forwarded to Surepass.

## Current behavior
The edge function already appends `strict_check_name=true` to the multipart form body and logs the **field names**:
```
[kyc-api-execute] multipart extraFields=strict_check_name
```
But the **values** are not logged, which is why it looks like "nothing is going" when inspecting the console.

## Change
In `supabase/functions/kyc-api-execute/index.ts` (multipart branch, around line 152-162), enhance logging to also print the key=value pairs being sent, plus log the full provider template once:

1. Before the loop, log: `[kyc-api-execute] multipart request_body_template=<JSON>` so we can see the configured template.
2. Inside the loop, collect `key=value` pairs into an array.
3. After the loop, log: `[kyc-api-execute] multipart extraFieldsResolved=strict_check_name=true,...` instead of only field names.

No behavioral change — purely additional logging. JSON-mode providers and non-multipart flows are untouched.

## Verification
1. Redeploy `kyc-api-execute`.
2. Re-upload a PAN card from the UI.
3. Open edge function logs and confirm you see:
   - `multipart request_body_template={"strict_check_name":"true"}`
   - `multipart extraFieldsResolved=strict_check_name=true`
4. This confirms the field is being forwarded to `https://kyc-api.surepass.app/api/v1/ocr/pan` in the multipart body.

## Note on browser DevTools
The field will still **not** appear in the browser Network tab — the browser only sends `{ providerName, input, fileBase64 }` to our edge function. `strict_check_name` is injected server-side from `api_providers.request_body_template` and forwarded to Surepass. The new logs are how you verify it in the middleware/edge console.