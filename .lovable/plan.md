I found why it is still not hitting the GST verification API in the screen shown in your screenshot.

The visible upload flow is using `DocumentVerificationStep.tsx`, not the newer `GstKycTab.tsx` flow that was updated earlier. In `DocumentVerificationStep.tsx`, the GST upload currently calls the GST OCR provider, then goes into a local simulated verification function (`verifyApi`) instead of calling the configured GSTIN Validation API. That is why you see the OCR GSTIN extracted and the step marked verified, but there is no call to `/api/v1/corporate/gstin`.

Plan to fix it:

1. Replace simulated GST verification in the upload flow
   - In `DocumentVerificationStep.tsx`, after GST OCR extracts the GSTIN, immediately call the configured `GST` provider through `callProvider`.
   - Send this exact payload shape:
     ```json
     {
       "id_number": "37ABDCS6352G1Z7"
     }
     ```
   - Keep the existing endpoint configuration: `https://kyc-api.surepass.app/api/v1/corporate/gstin`.

2. Validate OCR GSTIN against API response
   - Read GSTIN from OCR result.
   - Read GSTIN from API response (`data.gstin`).
   - If both exist and match, mark the document verified and show success.
   - If they do not match, mark the document failed and show a clear mismatch message, for example:
     `GSTIN mismatch: OCR read 37... but registry shows 37...`
   - If OCR does not return a valid 15-character GSTIN, stop and show an error asking for a clearer GST certificate.

3. Auto-populate missing GST fields from the validation API
   - Merge OCR data with API data, with API values filling missing or more reliable fields.
   - Populate these fields from the API response where available:
     - GSTIN
     - PAN number
     - Legal Name
     - Trade/Business Name
     - Constitution of Business
     - GST Status
     - Taxpayer Type
     - Registration Date
     - Address / Principal Place of Business
     - Centre Jurisdiction
     - State Jurisdiction
     - Nature of Business / Core Business Activity

4. Fix field-name mismatches in the registration UI
   - The API mapping currently returns names like `gstin_status`, `date_of_registration`, `center_jurisdiction`.
   - The registration UI expects names like `gst_status`, `registration_date`, `jurisdiction_centre`.
   - I will normalize these aliases in the upload flow so the displayed fields are populated correctly.

5. Show clear verification status below the field/card
   - On success, show a green success indicator/message such as:
     `GSTIN is verified — SHARVI INFOTECH PRIVATE LIMITED`
   - On mismatch or API failure, show the error under the upload card.
   - The file chip should only show verified after the GST validation API passes, not immediately after OCR.

6. Optional backend configuration cleanup
   - The current GST provider config mostly looks correct, but I noticed the endpoint path has a trailing space in the database (`/api/v1/corporate/gstin `).
   - I will clean this up to `/api/v1/corporate/gstin` to avoid any inconsistent behavior.

Technical details:
- Main file to change: `src/components/vendor/steps/DocumentVerificationStep.tsx`
- Existing admin config/template to keep aligned if needed: `src/pages/KycApiSettings.tsx`
- Existing execution backend already supports JSON payload substitution with `request_body_template: { "id_number": "{{id_number}}" }`, so no new secret is needed.
- I will not change the generated backend client/types files.