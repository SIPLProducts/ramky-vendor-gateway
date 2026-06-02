## Identified issue

Your console log shows the exact root cause:

```text
[pdfToImage] getDocument failed, sending original PDF
Setting up fake worker failed:
Failed to fetch dynamically imported module:
http://10.200.1.7/assets/pdf.worker.min-BZ_6UHJF.mjs
```

Because the PDF worker file is not loading on the self-hosted server, the browser cannot convert the uploaded PDF into JPG/JPEG. Then the app sends the original PDF to `GST_OCR`:

```text
fileMimeType: "application/pdf"
fileName: "Murali GST.pdf"
```

Surepass GST OCR expects an image for this endpoint, so it returns:

```text
message_code: "no_gstin_detected"
```

So the problem is not Surepass. It is the self-hosted frontend server failing to serve the PDF worker asset correctly.

## Why it works in Lovable / cloud but fails on your server

Lovable/Vite serves this file correctly:

```text
/assets/pdf.worker.min-xxxx.mjs
```

But on `http://10.200.1.7`, nginx is either:

1. returning 404 for that file,
2. serving `.mjs` with the wrong MIME type, usually `application/octet-stream`,
3. serving an old cached frontend build that references a worker file no longer present, or
4. blocking module/worker loading through CSP.

## Server-side fix

On the server, first check whether the worker file exists:

```bash
ls -l /opt/Ramky_Applications/DEV/VMS/frontend/dist/assets | grep 'pdf.worker.*\.mjs'
```

Then check the exact URL from the console:

```bash
curl -I http://10.200.1.7/assets/pdf.worker.min-BZ_6UHJF.mjs
```

Expected result:

```text
HTTP/1.1 200 OK
Content-Type: application/javascript
```

If it is `404`, the deployed `dist` is stale or incomplete. Rebuild and redeploy frontend.

If it is `application/octet-stream`, update nginx MIME config.

Add this inside the nginx `server {}` block, before `location /`:

```nginx
# Required for Vite/pdf.js module worker files
types {
    application/javascript  js mjs;
    application/wasm        wasm;
    text/css                css;
    image/svg+xml           svg svgz;
    application/manifest+json webmanifest;
}
default_type application/octet-stream;
```

Also keep this assets block:

```nginx
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}
```

Then reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Frontend code fix required

The current code has a dangerous fallback:

```text
PDF conversion failed → sending original PDF
```

That is why the API still receives `application/pdf`.

I will change the frontend so:

1. PDF conversion failure stops the OCR call.
2. The app shows a clear error instead of sending the original PDF.
3. `GST_OCR` is protected from receiving `application/pdf` even if another component calls it directly.

Files to update:

```text
src/lib/pdfToImage.ts
src/components/vendor/kyc/OcrUploadAndVerify.tsx
src/components/vendor/steps/DocumentVerificationStep.tsx
src/hooks/useConfiguredKycApi.tsx
```

## Final validation after fix

After code + nginx changes, upload the same PDF and check DevTools → Network → `kyc-api-execute` → Payload.

It must show:

```text
fileMimeType: "image/jpeg"
fileName: "Murali GST.jpg"
```

It must not show:

```text
fileMimeType: "application/pdf"
```

If it still shows PDF, then the browser is still using old cached JS. Clear site data / unregister service worker / hard refresh:

```text
Chrome DevTools → Application → Storage → Clear site data
Chrome DevTools → Application → Service Workers → Unregister
Ctrl + Shift + R
```

## Interim workaround

Until the server and frontend are fixed, ask users to upload GST certificate as JPG/PNG instead of PDF.