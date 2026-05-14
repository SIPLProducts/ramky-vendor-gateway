## Problem
The app sends the cheque image to the configured BANK_OCR provider as multipart form-data, but the backend appends the file with the filename `upload` and no extension:

```ts
fd.append(provider.file_field_name || "file", blob, "upload")
```

Surepass cheque OCR validates the multipart filename extension, so even though the image content and MIME type are correct (`image/jpeg`), it rejects the request with `File extension not allowed.` Postman works because it sends a real filename like `...jpg`.

## Plan
1. Update the KYC provider client to include the original uploaded filename when invoking the backend function.
2. Update `kyc-api-execute` multipart handling to:
   - sanitize/clean base64 input defensively,
   - choose a valid filename with extension from the original file name or MIME type,
   - append the multipart file as `file` with a name like `cheque.jpg` instead of extensionless `upload`,
   - keep removing manual `Content-Type` so the multipart boundary is still generated correctly.
3. Apply the same filename fix to the KYC API Settings test function (`kyc-api-test`) and test request path, so admin “Test” behaves the same as vendor registration.
4. Add focused logs around multipart filename/MIME/provider URL without logging API tokens or file contents.

## Files to change
- `src/hooks/useConfiguredKycApi.tsx`
- `src/pages/KycApiConfigEdit.tsx`
- `src/hooks/useKycApiConfigs.tsx`
- `supabase/functions/kyc-api-execute/index.ts`
- `supabase/functions/kyc-api-test/index.ts`

## Expected result
BANK_OCR requests from the application will match Postman/Surepass behavior: multipart field `file`, actual image bytes, MIME `image/jpeg`, and filename ending in `.jpg`/`.jpeg`, so Surepass should stop returning `File extension not allowed.`