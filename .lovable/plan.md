## What is actually causing the current error

The middleware server is now running correctly:

```text
Sharvi SAP middleware listening on :3002
SAP target: http://10.200.1.2:8000/vendor/bp/create?sap-client=300
```

The current failure is not from `server.js`. The app is reading the saved middleware URL as:

```text
https://donation-pantyhose-starter.ngrok-free.dev  /sap/bp/create
```

There are two problems in that saved value:

1. It contains extra spaces after `.dev`.
2. It already contains `/sap/bp/create`, but the backend function also appends `/sap/bp/create` automatically.

Because of the embedded spaces, the backend function creates an invalid URL and fails before it can call your middleware.

## Plan to fix it

### 1. Sanitize middleware URLs in the sync backend function
Update `supabase/functions/sync-vendor-to-sap/index.ts` so it safely normalizes the saved middleware URL before calling it.

It will:
- trim leading/trailing spaces
- remove all accidental whitespace inside the URL
- remove trailing `/sap/bp/create`, `/sap/proxy`, or extra slashes if the user pasted a full endpoint instead of the base URL
- validate that the final middleware URL starts with `http://` or `https://`
- produce a clear message if the URL is still invalid

Example normalization:

```text
Input:  https://donation-pantyhose-starter.ngrok-free.dev  /sap/bp/create
Output: https://donation-pantyhose-starter.ngrok-free.dev
Final call: https://donation-pantyhose-starter.ngrok-free.dev/sap/bp/create
```

### 2. Apply the same URL normalization to “Test SAP connection”
Update `supabase/functions/sap-api-test-connection/index.ts` so the test button behaves the same way as the sync button.

For proxy mode, the test function should call the middleware health endpoint instead of constructing a broken URL from `middleware_url + endpoint_path`.

It will call:

```text
GET {middleware_base_url}/health
```

This confirms the middleware is reachable before actual SAP sync.

### 3. Prevent bad values from being saved in the SAP API Settings UI
Update the SAP API config editor fields in:

- `src/pages/SapApiConfigEdit.tsx`
- `src/components/sap/AddSapApiConfigDialog.tsx` if needed

The UI will normalize the Node.js Middleware URL when saving/editing, so users can paste either:

```text
https://donation-pantyhose-starter.ngrok-free.dev
```

or accidentally paste:

```text
https://donation-pantyhose-starter.ngrok-free.dev/sap/bp/create
```

and the app will save only:

```text
https://donation-pantyhose-starter.ngrok-free.dev
```

### 4. Improve the displayed error message
Update the sync failure message so it explicitly says when the issue is an incorrectly saved middleware URL, instead of suggesting the middleware server is down.

### 5. Add a quick verification path
After implementation, the expected flow will be:

```text
SAP API Settings
  -> Node.js Middleware URL = https://donation-pantyhose-starter.ngrok-free.dev
  -> Proxy Secret / Password = same value as MIDDLEWARE_SHARED_SECRET
  -> Save
  -> Test SAP connection
  -> SAP Sync button
```

## Important note about your `.env`

Your middleware `.env` still has:

```text
MIDDLEWARE_SHARED_SECRET=replace-with-a-long-random-string
```

That can work only if the same exact value is saved in the app under **Proxy Secret / Password**. For security, I recommend replacing it with a real random string later, but the immediate sync failure shown in your screenshot is caused by the malformed saved URL, not by SAP credentials.