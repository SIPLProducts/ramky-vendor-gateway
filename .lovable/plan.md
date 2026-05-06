## Why it isn't showing

The "Current Year" field was only added to the **MSME tab in the Compliance step** (`ComplianceStep.tsx`). The screenshot you shared is the **Document Verification step** (`DocumentVerificationStep.tsx`), which has its own MSME review UI and doesn't yet read or render `classification_year`.

The edge function (`kyc-api-execute`) already flattens `classification_year` from `data.main_details.enterprise_type_list[0]`, so the value is available — the UI just doesn't display it here.

## Changes

**`src/components/vendor/steps/DocumentVerificationStep.tsx`**

1. In the Udyam manual-verify branch (around line 832, `ocrShape`) and the merge/normalized objects (lines 478–492 and 634+), add:
   - `classification_year: pickValue(d.classification_year)` (manual)
   - `classification_year: pickStr(registry.classification_year) || ocr.classification_year` (normalized merge)

2. In **both** MSME verified-fields panels (manual block ~line 1535 and upload block ~line 1684), add a new `EditableOcrField` for **Current Year** placed right after **Enterprise Type**, inside the same `md:grid-cols-2` row:
   ```
   <EditableOcrField
     label="Current Year"
     value={msmeDoc.ocrData?.classification_year}
     originalValue={msmeDoc.originalOcrData?.classification_year}
     onChange={(v) => setOcrField(setMsmeDoc, "classification_year", v)}
     placeholder="e.g. 2026-27"
     verifiedValue={m.classification_year}
     verifiedLabel="Verified from registry"
   />
   ```
   Move **Major Activity** to a new row so the layout stays balanced (Enterprise Type + Current Year on row 1; Major Activity + Organization Type on row 2 in the manual block; Major Activity alone or paired in the upload block).

No DB or edge function changes needed — the value is already returned by `kyc-api-execute`.