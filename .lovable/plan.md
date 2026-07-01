Fix only the PAN OCR → PAN Comprehensive Validation behavior.

Plan:
1. Update the current Document Verification PAN flow so after PAN OCR reads a valid PAN number, it always calls the configured `PAN` / `PAN Comprehensive Validation` API, even when GST is already verified.
2. Keep existing PAN vs GST cross-check exactly as-is: GST mismatch/name mismatch will still fail the PAN tab; this change only adds the comprehensive call and fields.
3. Map the comprehensive response fields into the PAN tab:
   - `status` / `pan_status` → show as `PAN Status` (`Valid` / `Invalid`)
   - `aadhaar_linked` / `aadhaarLinked` / `aadhaar_linked_with_pan` → show as `Is Aadhaar Linked` (`Aadhaar Linked with PAN` / `Aadhaar Not Linked with PAN`)
4. Store those two values in Step 1 output so draft/save/submit persists them to the existing vendor fields: `pan_status`, `pan_aadhaar_linked`, `pan_comprehensive_verified_at`.
5. When loading an existing draft/vendor, prefill those two values back into the PAN tab so they remain visible after Back, refresh, and View.

No changes to GST, MSME, Bank, Back, Refresh, final submit, OCR validation rules, or tab order.