## Two fixes

### 1. Bank OCR fails on PDF — "Set use_pdf=True for PDF input"

Surepass's Bank cheque OCR endpoint accepts image uploads by default. When a PDF is uploaded, the provider requires an extra multipart field `use_pdf=true`; without it, it returns the error the vendor is seeing.

**Fix (edge function `supabase/functions/kyc-api-execute/index.ts`, multipart branch ~line 140–166):**
- After appending the file blob and the resolved `request_body_template` extras, detect whether the uploaded file is a PDF (`fileMimeType === "application/pdf"` or filename ends in `.pdf`).
- If yes, append `use_pdf=true` to the FormData — but only if the template didn't already set `use_pdf` (so admin config still wins).
- Log the injection so it's visible in edge function logs.

This is a generic fix for any multipart provider; it will only kick in when a PDF is sent, so image cheques are unaffected.

### 2. Buyer Company must not reset

Confirmed by reading the code: `mergeVerifiedDataIntoForm` in `src/pages/VendorRegistration.tsx` does not touch `organization.buyerCompanyId`, and the seeding effects (invitation load, existing vendor hydrate, on-behalf tenant) all use the `prev.organization.buyerCompanyId === X ? prev : {...}` guard so they never overwrite an already-set value.

However, `OrganizationStep.tsx` currently has this effect:

```ts
useEffect(() => {
  const next = tenantId || data?.buyerCompanyId || '';
  if (next && next !== currentBuyer) {
    setValue('buyerCompanyId', next, ...);
  }
}, [tenantId, data?.buyerCompanyId, currentBuyer, setValue]);
```

The `if (next && ...)` guard prevents clearing when tenantId/data become empty, so this is safe. But because `useForm` is instantiated with `defaultValues: { buyerCompanyId: v.buyerCompanyId || '' }` and no `values`/`resetOptions`, when parent data hydrates AFTER the form mounted with empty tenantId, the form value could be empty until that effect runs. That's the only edge case — and the effect does populate it.

**Plan for buyer company:**
- Verify by adding a one-line console.log inside that effect: `console.log('[Org] buyer sync', { tenantId, dataBuyer: data?.buyerCompanyId, currentBuyer, willSet: next })`. Ask the user to reproduce; if the log shows an unexpected empty overwrite, fix at that call site.
- No code change to the reset logic unless the log proves an actual reset happens — from the current reading, the buyer company is preserved across GST changes and re-uploads.

### Technical details

**File: `supabase/functions/kyc-api-execute/index.ts`**
Add after the `extraTpl` block (before `body = fd`):
```ts
const isPdf = (fileMimeType?.toLowerCase() === "application/pdf")
  || (uploadName?.toLowerCase().endsWith(".pdf") ?? false);
const templateHasUsePdf = extraTpl && typeof extraTpl === "object"
  && Object.keys(extraTpl as Record<string, any>).some(k => k.toLowerCase() === "use_pdf");
if (isPdf && !templateHasUsePdf) {
  fd.append("use_pdf", "true");
  console.log(`[kyc-api-execute] auto-injected use_pdf=true for PDF upload`);
}
```

**File: `src/components/vendor/steps/OrganizationStep.tsx`**
Add temporary diagnostic log (line ~150) inside the buyer sync effect. Remove after confirming behaviour.
