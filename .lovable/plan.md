I found why you still see the old MSME screen: the visible vendor registration page is using `DocumentVerificationStep.tsx` for Step 1, not the newer `MsmeKycTab.tsx` used elsewhere. The previous changes were applied to the other MSME tab/component and KYC settings, so the Step 1 registration UI kept showing only the old upload-only flow.

Plan to fix it immediately after approval:

1. Update the actual Step 1 MSME screen
   - In `src/components/vendor/steps/DocumentVerificationStep.tsx`, change the MSME section so when the user selects Yes, it shows two options:
     - Manual Entry
     - Upload
   - Keep Upload behaving like the existing current upload flow.
   - Make Manual Entry the default option so the new behavior is visible immediately.

2. Add manual Udyam validation in Step 1
   - Add a Udyam Number input with a Validate button.
   - On Validate, call the configured KYC API provider named `MSME`.
   - Send payload equivalent to:
     ```json
     { "id_number": "UDYAM-GJ-25-000000" }
     ```
     while also preserving the existing mapped `msme` variable compatibility.

3. Populate the MSME fields from the API response
   - Map the configured API response fields into the existing MSME verified panel:
     - Udyam Number
     - Enterprise Name
     - Enterprise Type
     - Major Activity
   - Also capture additional fields already configured in the KYC provider mapping where useful, without hardcoding any response values.
   - Mark MSME as verified after a successful response so the user can proceed to Bank.

4. Remove the old MSME OCR dependency from Step 1
   - Step 1 currently still maps MSME upload to `MSME_OCR`, even though MSME OCR was removed from KYC API settings.
   - I will update the upload path so it no longer fails because of the removed MSME OCR provider.
   - If Upload is used, it will keep the current UI behavior but route the Udyam verification through the manual MSME validation provider once a Udyam number is available.

5. Keep registration data saving consistent
   - Ensure the verified MSME data still flows into `VendorRegistration.tsx` and then into statutory details (`msmeNumber`, `msmeCategory`, certificate file).
   - Existing GST, PAN, and Bank flows will not be changed.

Technical files to edit:
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- Potentially `src/pages/VendorRegistration.tsx` only if additional MSME fields need to be persisted from Step 1

No database change should be required because the `MSME` provider and KYC API settings were already updated earlier.