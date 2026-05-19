## Goal

When syncing an **International** vendor to SAP, the payload row must use the International form data (Company, Bank, Classification, Documents) while mapping to the same SAP key names that the Domestic flow already produces. Domestic flow stays untouched. Also introduce the new bank keys `swift_code`, `iban`, `iban2` on the payload, and switch `partn_grp` / `taxtype` defaults appropriately for International.

## Where the change lives

Single file: `src/lib/sapPayloadBuilder.ts`.

No DB template change is needed — the existing template already emits all the SAP keys the user listed; we only override values post-resolution when the vendor is International. New bank keys (`swift_code`, `iban`, `iban2`) are simply set onto the resolved row regardless (empty string for Domestic, populated for International) so the SAP contract carries them in both cases without disturbing existing Domestic mappings.

## International field mapping (applied only when `vendor.vendor_type === 'international'`)

Source: `vendor.international_data` JSONB (already persisted by `useVendorRegistration` save flow).

| SAP key             | Source                                        |
|---------------------|-----------------------------------------------|
| `name1` / `sterm1`  | `intl.company.companyName` (trunc 40 / 20)    |
| `sterm2`            | `""`                                          |
| `street`            | `intl.company.companyAddress` (trunc 60)      |
| `str_suppl1`        | `intl.company.companyAddress` (trunc 40)      |
| `str_suppl2/3`      | `""`                                          |
| `postl_cod1`        | `intl.company.pincode` (trunc 10)             |
| `city`              | `""` (no city captured in intl form)          |
| `country`           | `intl.company.country` (raw SAP code)         |
| `region`            | `intl.company.region` (raw SAP code; bypass `region(vendor.registered_state)` resolver) |
| `mob_number`        | `intl.company.contact1`                       |
| `tel_number`        | `intl.company.contact2 \|\| ""`               |
| `smtp_addr`         | `intl.company.email1`                         |
| `bank_acct`         | `intl.bank.accountNumber`                     |
| `swift_code` (new)  | `intl.bank.swiftCode`                         |
| `iban` (new)        | `intl.bank.ibanNumber`                        |
| `iban2` (new)       | `""`                                          |
| `bank_key`          | `""`                                          |
| `bank_ctry`         | `intl.bank.bankCountry \|\| intl.company.country` |
| `accountholder`     | `intl.bank.companyName`                       |
| `bankaccountname`   | `intl.bank.bankName`                          |
| `partn_grp`         | `"ZIMP"` (override default `ZDOM`)            |
| `taxtype`           | `"IN5"` (Import) — overrides Domestic `IN3`   |
| `taxnumxl`, `j_1ipanno`, `gstin`-derived | `""`                     |
| `msme`, `idnum2`    | `""`                                          |
| `CLASSIFY.*`        | unchanged — already pulls from `vendor.material_group_vendors / vendor_categories / vendor_locations / identification_sources` which the save flow already populates from `intl.classification` |

Identical overrides are also applied to the nested `vendors[0]` block.

For Domestic: behavior is unchanged. We only ensure the keys `swift_code`, `iban`, `iban2` are emitted as `""` on the row (additive, doesn't break SAP).

## Skip-region validation

`buildSapPayload` currently throws if `vendor.registered_state` is not mapped to an Indian region code. That check is Domestic-only and must be **skipped** when `vendor_type === 'international'` (region comes from the intl form, not from the IN mapping table).

## Documents

International documents (`registration_copy`, `swift_iban_details`) already upload through the same `FileUpload` + `vendor_documents` path as Domestic — confirmed in `useVendorRegistration.uploadDocument` and `IntlDocumentsStep`. No changes needed.

`buildUploads` remains a no-op (`UPLOAD: []`) as it is today — SAP doc upload is intentionally disabled regardless of vendor type.

## Implementation outline

```text
buildSapPayload()
  ├─ load vendor                                                   (unchanged)
  ├─ if vendor.vendor_type !== 'international':
  │     existing region-state guard
  ├─ merge tenant defaults                                          (unchanged)
  ├─ classifyArrays                                                  (unchanged — already covers intl)
  ├─ load template, resolveTemplate(...)                            (unchanged)
  ├─ row.CLASSIFY expansion                                          (unchanged)
  ├─ if vendor.vendor_type === 'international':
  │     const intl = vendor.international_data ?? {}
  │     apply intl overrides to row.* and row.vendors[0].*
  │     row.partn_grp = 'ZIMP'; row.taxtype = 'IN5'
  ├─ row.swift_code ??= ''; row.iban ??= ''; row.iban2 ??= ''
  └─ return [row]
```

## Out of scope

- No changes to Domestic field mapping, validation, KYC, or approval flow.
- No DB schema or template migration.
- No edge-function changes.
- No new UI work; all International form fields already exist.
