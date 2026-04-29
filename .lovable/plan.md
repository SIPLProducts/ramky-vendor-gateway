# Fix KYC API Settings — Headers Save Error + GST OCR Payload Mapping

## Problem 1 — "Invalid JSON" when saving Headers

In your screenshot the Headers textarea contains:

```
{
Content-Type:application/json,
Authorization:Bearer eyJhbGci...
}
```

This is not valid JSON (keys/values aren't quoted, uses `,` between lines, includes trailing token). `JSON.parse` rejects it, so Save aborts with the toast you saw.

Two issues compound this:
1. There is **no friendly editor** — admins must hand-write JSON, which is error-prone.
2. The `Authorization` header is **already added automatically** from the credential you save on the **Authentication** tab (`auth_header_name` + `auth_header_prefix` + the API token). Pasting it again here is wrong and will double up on the request.

## Problem 2 — GST OCR Request Payload mapping

For the GST OCR provider (Surepass `/api/v1/ocr/gst`), the API expects a **multipart/form-data** upload — the GST certificate file is sent under the field name `file`. There is **no JSON body** for OCR endpoints, so the "Request Payload" tab does not apply to it.

How the vendor → API flow works today:
1. Vendor opens GST tab → selects "Yes" for GST registered → switches to "Upload certificate".
2. `OcrUploadAndVerify` captures the file and calls `useConfiguredKycApi.callProvider({ providerName: 'GST_OCR', file })`.
3. The `kyc-api-execute` edge function looks up the `GST_OCR` provider, sees `request_mode = multipart`, builds a `FormData` with the file under `file_field_name` (default `file`), and POSTs to `base_url + endpoint_path`.
4. Surepass returns JSON like `{ success: true, data: { gstin, legal_name, business_name, pan_number, ... } }`.
5. The edge function applies `response_data_mapping` (e.g. `gstin → data.gstin`) to produce the normalized `data` object.
6. `GstKycTab.handleOcrVerify` reads the extracted `gstin` + `legal_name`, copies the GSTIN into the form, runs a name-match against the vendor's "Legal Name", and marks the tab Verified/Failed.

So for GST OCR you do **not** need a Request Payload — only:
- **Basic**: Request Mode = `multipart`, File Field Name = `file`, Method = `POST`.
- **Authentication**: Auth Type = `BEARER_TOKEN`, Header Name = `Authorization`, Prefix = `Bearer`, paste your Surepass token in **API Token / Credential**.
- **Headers**: leave `{}` (or only add non-auth extras).
- **Response Mapping**: already pre-filled by the template (gstin, legal_name, etc.).

## Plan

### 1. Make the Headers tab forgiving and self-correcting
File: `src/pages/KycApiConfigEdit.tsx`

- Add a **Key/Value editor** (rows of two inputs + add/remove buttons) as the primary UI for headers. Keep the JSON textarea as an "Advanced" toggle for power users.
- On save:
  - Preferred path: serialise from the key/value rows — never throws.
  - Advanced path: try `JSON.parse`; if it fails, attempt a **lenient parse** that accepts `Key: Value` lines (like a pasted HTTP headers block) and converts them to an object. Only show the toast when both fail.
- Strip a manually-entered `Authorization` header before saving and show a small inline note: *"Authorization is added automatically from the credential — removed from extras."* This prevents the duplicate-auth bug.
- Inline-validate as the admin types: show a green "Valid" / red "Invalid — line N" hint under the textarea instead of only at save time.
- Pre-fill new providers with `{}` instead of leaving an empty textarea so the first save always succeeds.

### 2. Clarify the Request Payload tab for OCR endpoints
File: `src/pages/KycApiConfigEdit.tsx`

- When `request_mode === "multipart"`, replace the textarea with an info card:

  > *"This endpoint receives the uploaded file as multipart form-data under field `file`. No JSON body is needed. The vendor's uploaded GST certificate is forwarded automatically."*

- Show the exact request shape that will be sent (read-only preview):
  ```
  POST {base_url}{endpoint_path}
  Authorization: Bearer ********
  Content-Type: multipart/form-data
  file: <vendor-uploaded GST certificate>
  ```

### 3. Add a small "How vendor data maps to this API" helper
File: `src/pages/KycApiConfigEdit.tsx` (Response Mapping tab, for OCR providers only)

Show a 2-column legend so admins understand the mapping isn't abstract:

| Form field on vendor screen | Comes from API path |
|---|---|
| GSTIN              | `data.gstin` |
| Legal Name         | `data.legal_name` |
| Business Name      | `data.business_name` |
| PAN                | `data.pan_number` |
| Status             | `data.gstin_status` |
| Registration Date  | `data.date_of_registration` |

Built from `response_data_mapping` automatically — same legend works for PAN_OCR / MSME_OCR / BANK_OCR.

### 4. Tiny safety fix in the edge function
File: `supabase/functions/kyc-api-execute/index.ts`

If, despite the UI guard, an admin still saves an `Authorization` key in `request_headers`, **let the credential-based one win** — currently the credential header overwrites it, which is correct, but assert this with a comment + small safeguard so future edits don't regress.

## Technical notes

- Lenient header parser handles three input shapes:
  1. `{}` — valid JSON object (current behaviour).
  2. Key/value rows from the new UI — always serialises cleanly.
  3. Pasted `Header-Name: value` lines — split on first `:`, trim, build object.
- The Headers payload column in the DB (`api_providers.request_headers`) stays a `jsonb` object — no schema change.
- No edge-function deployment is required for the UX fixes (steps 1–3). Step 4 is a one-line safety comment + redeploy of `kyc-api-execute`.

## Files to change

- `src/pages/KycApiConfigEdit.tsx` — key/value headers editor, lenient parser, multipart payload info card, response-mapping legend.
- `supabase/functions/kyc-api-execute/index.ts` — comment + guard ensuring credential auth header wins over any extras.

## What you should do in the GST OCR config right now

1. Open the **Authentication** tab → set Auth Type `BEARER_TOKEN`, Header Name `Authorization`, Prefix `Bearer`, paste your Surepass token in **API Token / Credential**, Save.
2. Open the **Headers** tab → clear the textarea down to just `{}` (the Authorization line you pasted is unnecessary and is what is breaking the save).
3. Leave **Request Payload** as `{}` — GST OCR is multipart, the vendor's uploaded certificate is sent automatically as the `file` field.
4. **Response Mapping** is pre-populated by the template; no change needed.
5. Save — then test from the **Live Test** tab by uploading a sample GST certificate.