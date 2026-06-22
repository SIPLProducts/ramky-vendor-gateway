## Goals

1. Udyam certificate file persists end-to-end (Step 1 tab → Review → Approval dialog → DB/storage).
2. Review & Approval show the full Registered / Corporate Office Address card and a separate Communication Address sub-card.
3. SAP Sync popup: drop the standalone Contact Details section, surface email + phone inside the address card, move MSME (Minority Indicator) into Company Code Data, move Vendor Class into Vendor Information, remove Purchase Data card.

## 1. Udyam upload not reflecting

### Root cause
In `DocumentVerificationStep.tsx` `buildOutput()`:
```
out.msmeCertificateFile =
  isMsmeRegistered === true && msmeDoc.status === "verified" ? (msmeDoc.file ?? null) : null;
```
The file is dropped from the lifted form data unless OCR verification succeeds. If the user uploads but doesn't (or can't) verify, the file is silently discarded → it never appears in Review, Approval, or `vendor_documents`.

### Fix
- Change the condition to persist the file as soon as it's picked when MSME = Yes, independent of verification status:
  `out.msmeCertificateFile = isMsmeRegistered === true ? (msmeDoc.file ?? null) : null;`
- Apply the same loosened rule to the other certificates so the user's complaint doesn't recur for GST/PAN/bank: keep the file whenever one is selected for the relevant section.
- Verify in `useVendorRegistration.tsx` upload loop (already uploads `formData.statutory.msmeCertificateFile` to `vendor-documents` and inserts a `vendor_documents` row with type `msme_certificate`) — no change needed there.

### Review step display
- `ReviewStep.tsx` MSME section currently shows only the number/category. Add a `DataRow` "Udyam Certificate" → "Uploaded ✓" / "Pending upload" using `data.statutory?.msmeCertificateFile`. Mirror the GST/PAN/Bank rows that already exist for uploaded files.

### Approval dialog display
- `VendorReviewDialog.tsx` Statutory grid: add a "Udyam Certificate" row that reads from `vendor_documents` (look up `document_type = 'msme_certificate'` for this vendor) and renders a download link (re-use the existing document-link helper used for GST/PAN/Bank in this dialog). If the dialog already loads vendor_documents in a list, just ensure the MSME row links to it.

## 2. Address Information in Review & Approval

Show two sub-cards inside the "Address Information" / "Address Details" section:

**a. Registered / Corporate Office Address**  
Address Line 1, Address Line 2, Address Line 3, Address Line 4, City, State, PIN Code, Phone, Email.

**b. Communication Address**  
Address Line 1–4 (if captured), City, State, PIN Code, Phone, Email — fallback to "Same as Registered" tag when blank.

### Files
- `src/components/vendor/steps/ReviewStep.tsx` — replace the current single-line Address Information block with two sub-card layouts. Pull fields from `data.address.*` (registered + communication variants) and from `data.contact.ceoEmail` / `ceoPhone` if dedicated address phone/email aren't captured separately.
- `src/components/vendor/VendorReviewDialog.tsx` — replace lines ~504–522 (single "Address Details" grid) with the same two sub-cards. Data sources on the `vendor` row: `registered_address`, `registered_address_line2/3/4`, `registered_city`, `registered_state`, `registered_pincode`, `registered_phone`, `registered_email`; and `communication_address`, `communication_city`, `communication_state`, etc. Show phone/email rows under each sub-card. If communication fields are empty, render a single "Same as Registered Address" line instead of an empty grid.

No DB schema changes; all columns referenced already exist on `vendors`.

## 3. SAP Sync popup restructure

File: `src/components/sap/SapFieldsDialog.tsx`.

```text
Vendor Information        [unchanged + add Vendor Class read-only/editable text field]
Bank Details              [unchanged]
Registered / Corporate    [Address Line 1..4, City, State, Pincode, Phone, EMAIL ← new]
  Office Address
Vendor Header             [Vendor (Person/Org/Group), Vendor Account Group]    ← MSME removed
Company Code Data         [Company Code, Rec-Account, Sort Key, Planning Group,
                           Check Duplicate Invoice, MSME (Minority Indicator)] ← MSME added
Classification            [unchanged]
```

Concrete edits:
- **Remove** the entire `Section` titled "Contact Details" (current lines ~172–177).
- In the "Registered / Corporate Office Address" section, append `<ReadOnlyField label="Email" value={(vendor as any)?.registered_email || (vendor as any)?.primary_email} />` next to the existing Phone row.
- **Remove** `<SelectField label="MSME (Minority Indicator)" ... />` from the Vendor Header section.
- **Add** that same `SelectField` at the bottom of the Company Code Data section, with the same options and `form.msme` binding.
- **Remove** the entire "Purchase Data" `Section` (current lines ~203–213).
- **Move** the surviving Purchase Data inputs into Company Code Data (Purchase Org, Currency, Group for Calc Schema, GR-Based Invoice Verification, Service-Based Invoice Verification) — keeps the required Purchase Org + Currency validation rules intact (`REQUIRED_KEYS` unchanged).
- **Add** `<TextField label="Vendor Class" value={form.ven_class} onChange={v => set('ven_class', v)} />` to the Vendor Information section so the field is still editable; the underlying `ven_class` key on `SapFieldOverrides` is unchanged.

No changes to `SapFieldOverrides` shape, `buildDefaults`, required-keys list, or the edge function payload — only visual section placement changes.

## Out of scope
- No backend / SQL changes.
- No changes to international vendor flow.
- No changes to the MsmeKycTab component (not used in the active 6-step flow).
