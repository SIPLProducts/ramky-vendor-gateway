

## Sequential Document OCR Flow (Step 1 redesign)

### Goal

Replace the current "4-tile parallel grid" on Step 1 with a guided, sequential, conditional flow that mirrors how a vendor naturally fills the form. Each stage unlocks the next only after OCR + realtime API verification succeeds.

### New flow on Step 1

```text
Stage 1 — GST gate
  Q: "Are you GST registered?"  [Yes] / [No]
  ├─ Yes → Upload GST certificate
  │        OCR extracts → Legal Name, Trade Name,
  │        Constitution of Business, Principal Place of Business
  │        Realtime GST API verification (validate-gst)
  │        Show extracted fields; Address is editable, others read-only
  │        Carry Legal Name + GSTIN forward
  └─ No  → Download "GST Self-Declaration" template (existing public/templates/gst-self-declaration.html)
           Upload signed copy
           Manual entry: Legal Name, Address, City, State, Pincode (mandatory)
           No GST API call

Stage 2 — PAN gate (always required)
  Upload PAN card
  OCR extracts → PAN number, Holder Name
  Realtime PAN API verification (validate-pan)
  Cross-check PAN against the PAN derived from GSTIN (chars 3–12)
    - If GST path: must match → block Continue if mismatch with clear message
    - If No-GST path: skip cross-check
  Cross-check holder name vs Legal Name (fuzzy, threshold from validation_configs)

Stage 3 — MSME gate
  Q: "Are you MSME / Udyam registered?"  [Yes] / [No]
  ├─ Yes → Upload Udyam certificate
  │        OCR extracts → Udyam number, Enterprise name, Type
  │        Realtime MSME API verification (validate-msme)
  │        Cross-check Enterprise name vs Legal Name
  └─ No  → Skip, move on (no document needed)

Stage 4 — Bank verification (always required)
  Upload Cancelled Cheque
  OCR extracts → Account number, IFSC, Bank, Branch, Holder name
  Realtime Penny-drop verification (validate-penny-drop)
  Cross-check holder name vs Legal Name
```

Continue button on Step 1 stays disabled until: GST stage resolved (Yes-verified OR No-with-declaration uploaded) **AND** PAN verified **AND** MSME stage resolved **AND** Bank verified.

### Carry-forward into later steps

Once Step 1 is complete, the form auto-fills and locks where appropriate:

| Field on later step | Source | Editable? |
|---|---|---|
| Organization → Legal Name | GST OCR (or manual if No-GST) | No |
| Organization → Trade Name | GST OCR | Yes |
| Statutory → GSTIN, Constitution, Registration date, Status, Taxpayer type | GST API | No |
| Statutory → Principal Place of Business | GST OCR | **Yes** |
| Address → Registered Address (prefilled from Principal Place) | GST OCR | Yes |
| Statutory → PAN | PAN OCR | No |
| Statutory → MSME number, Category | MSME OCR | No |
| Bank → Account No, IFSC, Bank, Branch | Cheque OCR | No (re-upload to change) |
| Statutory → `is_gst_registered`, `gst_declaration_reason` | Stage 1 answer | — |
| Statutory → `is_msme_registered` | Stage 3 answer | — |

### Files to change

- **Rewrite** `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - Replace parallel grid with a vertical stepper of 4 stages.
  - Add Yes/No radio gates for GST and MSME.
  - Add download-link + upload widget for the GST self-declaration path with manual Legal Name + Address fields.
  - Implement PAN-from-GST cross-check (`gstin.slice(2,12) === pan`).
  - Show cross-name-match warnings inline (reusing existing `OcrComparisonCard`).
  - Expand `VerifiedDocumentData` to include: `isGstRegistered`, `gstDeclarationReason`, `manualLegalName`, `manualAddress` (city/state/pincode), `isMsmeRegistered`, GST `constitutionOfBusiness` and `principalPlaceOfBusiness`.

- **Update** `src/pages/VendorRegistration.tsx`
  - `handleStep1Complete` (the existing handler that receives `VerifiedDocumentData`) — populate `formData.statutory.isGstRegistered`, `gstDeclarationReason`, `gstConstitutionOfBusiness`, `gstPrincipalPlaceOfBusiness`, `isMsmeRegistered`, `pan`, `gstin`, `msmeNumber`, `organization.legalName`, `organization.tradeName`, `bank.accountNumber/ifsc/bankName/branchName`, and seed `address.registeredAddress` from the GST principal place.
  - Tighten `canProceedFromCurrentStep()` for step 1 to also accept the No-GST path (declaration file + manual legal name + address present).
  - Keep step 5 (Commercial) and step 6 (Bank) read-only for fields already verified upstream.

- **Update** `src/components/vendor/steps/CommercialStep.tsx` and `src/components/vendor/steps/BankDetailsStep.tsx`
  - Mark fields populated from Step 1 as read-only (with a small "Verified in Step 1" hint), except Principal Place of Business which stays editable.

### Out of scope

- No DB migration — all needed columns already exist on `vendors` (`is_gst_registered`, `gst_declaration_reason`, `gst_constitution_of_business`, `gst_principal_place_of_business`, `is_msme_registered`, etc.).
- No edge function changes — existing `ocr-extract`, `validate-gst`, `validate-pan`, `validate-msme`, `validate-penny-drop` already handle each call.
- GST self-declaration template at `public/templates/gst-self-declaration.html` is reused as-is.

