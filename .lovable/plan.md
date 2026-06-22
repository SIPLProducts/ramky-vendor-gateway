## Changes

### 1) Udyam Certificate becomes mandatory when MSME = Yes
**File:** `src/components/vendor/steps/DocumentVerificationStep.tsx`
- Update the FileUpload label on line 2426 from "Upload Udyam Certificate (optional)" to "Upload Udyam Certificate" with a required asterisk.
- Update `stage3Done` (line 1621–1623): when `isMsmeRegistered === true`, require BOTH `msmeDoc.status === "verified"` AND `msmeDoc.file` to be present. This blocks moving to the Bank tab / completing Step 1 until the certificate is uploaded.
- Show a small inline hint under the upload when MSME=Yes and no file is present yet.

### 2) MSME (Minority Indicator) value sent to SAP
**File:** `src/components/sap/SapFieldsDialog.tsx`
- Replace the current MSME dropdown options `[['', 'None'], ['MIC', 'MIC']]` with the full set:
  - `MIC` — Micro
  - `SML` — Small
  - `MED` — Medium
  - `ZNA` — Not Applicable / Not MSME
- Update `buildDefaults` (line 284–294):
  - If vendor is MSME (`isMsme(vendor) === true`), read `(vendor as any).msme_enterprise_type` and map: `Micro → MIC`, `Small → SML`, `Medium → MED`. Fallback to `MIC` if the string is unrecognized.
  - If vendor is NOT MSME, default `msme` to `'ZNA'` (instead of empty).
- `idtype`/`idnum` logic stays the same (ZMSMEN + udyam number only when MSME).

### 3) Registered / Corporate Office Address card editable in SAP popup
**File:** `src/components/sap/SapFieldsDialog.tsx`
- Add the following keys to the `SapFieldOverrides` form state (initialized from the vendor record in `buildDefaults`):
  `reg_addr1, reg_addr2, reg_addr3, reg_addr4, reg_city, reg_state, reg_pincode, reg_contact1, reg_contact2, reg_email1, reg_email2`.
- In the Registered / Corporate Office Address section (lines 160–173), swap every `ReadOnlyField` for an editable `TextField` (State remains a free-text field for now; can be a dropdown later if needed) bound to the new form keys.
- On Sync, these edited values are included in the override payload sent to the SAP sync handler — vendor row in DB is not mutated here (sync-time edit only), matching the existing pattern for other SAP overrides.

### Verification
- Open Step 1 → MSME = Yes → validate Udyam number → confirm "Next: Bank" is disabled until a Udyam Certificate file is uploaded.
- Open SAP popup for an MSME=Yes vendor (Small enterprise) → MSME field pre-selects `SML`. For a non-MSME vendor → pre-selects `ZNA`.
- In SAP popup → Address fields are editable; edited values appear in the submitted SAP payload.

### Out of scope
- No DB schema changes, no edge function changes, no changes to other screens' address rendering.
