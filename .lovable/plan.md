## No code changes

Based on your answers:

1. **Missing storage files (screenshot 1):** Keep current behavior. The "Preview unavailable — Document file is missing in storage" toast is correct — the `vendor_documents` row exists but the actual binary was never uploaded (or was removed) from the `vendor-documents` storage bucket. Frontend cannot serve a file that isn't there. To make View/Download work for those specific vendors, the underlying file must be re-uploaded through the registration / document-upload flow. The button + toast pair already handle this correctly.

2. **Validations tab (screenshot 2):** Keep as-is. The Passed / Failed / Skipped / Pending counters summarise the automated verification checks (GST, PAN, Name Match, Bank Account, etc.) that run during vendor onboarding. Approvers rely on this view before pushing the vendor to SAP, so it stays.

## If you want a different outcome later
- Re-upload the missing source files for the affected vendors, or
- Tell me to hide the View/Download buttons when the storage object is missing, or
- Tell me to remove/simplify the Validations tab.
