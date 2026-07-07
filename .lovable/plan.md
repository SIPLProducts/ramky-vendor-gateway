# Add full Address block to International Company Details

Bring the domestic Registered Address block (Address Line 1-4, City, State, PIN Code, Office Phone, Fax) into the International flow's **Company Details** tab, persist the values, map them to the SAP BP payload, and surface them wherever Company Details are shown.

## 1. Data model (types + defaults)

`src/types/vendor.ts` — extend `InternationalCompanyDetails`:

```ts
export interface InternationalCompanyDetails {
  companyName: string;
  // NEW address block
  addressLine1: string;   // required
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  city: string;           // required
  state: string;          // required (free text — no Indian state list for intl)
  pincode: string;        // required (already present)
  officePhone: string;    // optional (was contact1 role — see note)
  fax: string;
  // existing
  companyAddress: string; // keep for backward-compat with saved data
  country: string;
  region: string;
  contact1: string;
  contact2: string;
  email1: string;
  email2: string;
}
```

Update `EMPTY_INTERNATIONAL_DATA.company` with the new empty strings. Loader in `useVendorRegistration.tsx` (~line 796) gets the same default keys so old rows hydrate without `undefined`.

## 2. UI — `IntlCompanyDetailsStep.tsx`

Replace the single `companyAddress` textarea with the exact layout from the screenshot, inserted between the existing Company Name/Pincode row and the Country/Region row:

```
Address Line 1 *      (full width) + helper text
Address Line 2 | Address Line 3 | Address Line 4
City *         | State *         | PIN Code *
Office Phone   | Fax
```

- Reuse the same labels, placeholders and helper copy shown in the screenshot ("Text beyond 40 characters automatically flows into Address Line 2, 3 and 4.", "10-digit mobile number", "Fax number", "Additional detail (optional)").
- Keep existing Country/Region SAP F4 dropdowns, Contact 1/2, Email 1/2 as-is (those remain the company contact fields).
- Drop the old `companyAddress` textarea from the UI (the value stays in the type for backward compatibility but is no longer edited; on submit we also mirror the concatenated address into it so legacy readers still work).
- Extend the `zod` schema with:
  - `addressLine1`: trim, min 1 ("Address Line 1 is required"), max 40 recommended
  - `addressLine2/3/4`: optional strings
  - `city`: trim, min 1
  - `state`: trim, min 1
  - `pincode`: keep
  - `officePhone`: optional, `/^\d{10}$/` when non-empty
  - `fax`: optional string
- Auto-flow behaviour for Address Line 1 → 2/3/4: chunk any text over 40 chars into Lines 2, 3, 4 (same helper the domestic step uses; extract shared util if convenient, otherwise inline).

## 3. Persistence

`useVendorRegistration.tsx` `formDataToVendorRecord` (~line 341):

- International branch: keep writing full `international_data.company` (now includes the new fields — no schema change needed since it's JSONB).
- Also mirror the new fields onto the existing domestic columns so downstream SAP mapping and list/report queries work without special-casing:
  - `registered_address` ← addressLine1
  - `registered_address_line2/3/4` ← lines 2-4
  - `registered_city` ← city
  - `registered_state` ← state (was previously region — corrected)
  - `registered_pincode` ← pincode
  - `registered_phone` ← officePhone
  - `registered_fax` ← fax
  - Continue writing `state` (registration state proxy) ← country
- Also populate `international_data.company.companyAddress` with the joined `[addressLine1, line2, line3, line4].filter(Boolean).join(', ')` for backward compatibility with older readers.

No DB migration required (JSONB + reusing existing NOT NULL columns).

## 4. SAP payload mapping

`supabase/functions/sync-vendor-to-sap/index.ts` — the template resolver already pulls from `vendor.registered_*` columns, so mirroring in step 3 flows the values automatically. Confirm/adjust the intl branch so these keys land on the BP row per the SAP spec in `sync_sap.md`:

| Form field       | SAP key       |
| ---------------- | ------------- |
| Address Line 1   | `STREET`      |
| Address Line 2   | `STR_SUPPL1`  |
| Address Line 3   | `STR_SUPPL2`  |
| Address Line 4   | `STR_SUPPL3`  |
| City             | `CITY`        |
| State            | `LOCATION` (free text; SAP `REGION` still comes from SAP F4 Region dropdown) |
| PIN Code         | `POSTL_COD1`  |
| Office Phone     | `TEL_NUMBER`  |
| Fax              | `FAX_NUMBER`  |
| (existing) Contact 1 → `MOB_NUMBER`, Email 1 → `SMTP_ADDR`, Country → `COUNTRY`, Region → `REGION` |

Update `DEFAULT_SAP_PAYLOAD_TEMPLATE` (and any tenant template resolver defaults) to include `STR_SUPPL2`, `STR_SUPPL3`, `FAX_NUMBER` if missing, referencing `${vendor.registered_address_line3}`, `${vendor.registered_address_line4}`, `${vendor.registered_fax}`.

Keep the existing `overrideCountry` intl post-processor untouched.

## 5. Display everywhere

Update the "Company Details" section rendering for the international branch in each of these files to show the new fields (Address Line 1-4, City, State, PIN Code, Office Phone, Fax) — reading first from `international_data.company.*`, falling back to the mirrored `registered_*` columns:

- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` (registration preview)
- `src/components/vendor/VendorReviewDialog.tsx` (View Details / approvals / SAP Sync)
- `src/components/vendor/steps/ReviewStep.tsx` if it renders intl company details
- `src/pages/VendorList.tsx` View Details drawer
- `src/lib/reports/loadVendorReport.ts` + `exportExcel.ts` / `exportPdf.ts` — add columns for the new fields in the Company Details group (intl rows only, or unified with domestic since column names align)
- Any other place that iterates `international_data.company` — search for `international_data?.company` / `intl.company` and add the new keys

Formatter: render empty strings as "-".

## 6. Validation

Manual check after implementation:
1. Fill an international vendor with the new fields → save draft → reload → values persist in the form.
2. Submit → View Details, Preview, Reports all show the new values.
3. SAP Sync → inspect outgoing payload (SAP request trace) — confirms `STREET`, `STR_SUPPL1-3`, `CITY`, `LOCATION`, `POSTL_COD1`, `TEL_NUMBER`, `FAX_NUMBER` match the entered values.
4. Old international vendor (no new fields) still loads without console errors and shows "-" in the new columns.

## Technical notes

- No DB migration required; we reuse `registered_*` columns and `international_data` JSONB.
- Auto-flow util for Address Line 1: reuse whatever domestic `AddressDetailsStep` already implements. If it's inlined there, lift it into `src/lib/addressAutoflow.ts` and import from both steps.
- `state` for international vendors is a free-text input (no `INDIAN_STATES` list). SAP `REGION` continues to be populated from the SAP F4 Region dropdown, not this "State" text field.
