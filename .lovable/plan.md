## Fix "Vendor's Registered State (empty)" error in Multiple SAP Sync

### Root cause
`MultipleSapSyncDialog` sends a common-fields object where every per-vendor key (`reg_state`, `reg_city`, `reg_pincode`, `reg_addr1..4`, `reg_contact1/2`, `reg_email1/2`, `reg_is_msme`, `reg_msme_*`, `msme`, `idtype`, `idnum`) is present as an empty string.

`src/lib/sapPayloadBuilder.ts` uses `hasOwnProperty` to decide whether to overwrite the vendor's DB value:
```
if (hasKey('reg_state')) vendorForPayload.registered_state = ov.reg_state ?? '';
```
Because the key exists (as `''`), each vendor's real `registered_state` is wiped → `resolveRegion('')` fails → guard throws `Vendor's Registered State "(empty)" is not mapped to an SAP region code for IN.`

The single-vendor `SapFieldsDialog` doesn't hit this because it pre-fills those fields from the vendor.

### Fix (single file: `src/components/sap/MultipleSapSyncDialog.tsx`)

The bulk dialog is documented as "common header fields only — vendor-specific data is derived per vendor automatically." So in the confirm handler, delete the per-vendor keys from the payload before calling `onConfirm`, so `hasKey(...)` returns false and vendor DB values are preserved.

Keys stripped only in bulk dialog:
- `reg_addr1/2/3/4`, `reg_city`, `reg_state`, `reg_pincode`
- `reg_contact1/2`, `reg_email1/2`
- `reg_is_msme`, `reg_msme_no`, `reg_msme_cat`, `reg_msme_act`
- `msme`, `idtype`, `idnum`

```ts
const stripKeys = [
  'reg_addr1','reg_addr2','reg_addr3','reg_addr4',
  'reg_city','reg_state','reg_pincode',
  'reg_contact1','reg_contact2','reg_email1','reg_email2',
  'reg_is_msme','reg_msme_no','reg_msme_cat','reg_msme_act',
  'msme','idtype','idnum',
];
const cleaned: any = { ...form, classify: finalClassify };
for (const k of stripKeys) delete cleaned[k];
onConfirm(cleaned);
```

### Preserved (unchanged)
- Single-vendor `SapFieldsDialog` flow (still sends `reg_*` for that vendor).
- All common header fields from bulk dialog (partn_grp, bukrs, akont, fdgrv, vkorg, waers, title, taxtype, kalsk, webre, lebre, cdi, ven_class).
- New Withholding Tax + Classification cards still flow through.
- `sapPayloadBuilder.ts`, edge functions, DB, and RLS untouched.

### Verification
- Select ≥2 vendors with valid states → Multiple Sync → succeeds with correct region code per vendor.
- Single-vendor sync path unchanged.
- `bunx tsgo --noEmit` clean.
