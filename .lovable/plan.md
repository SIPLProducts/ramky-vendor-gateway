## Problem

**1. Address fields wrong in SAP**
Current active SAP payload template maps:
- `street` ← `registered_address` (line 1) ✅
- `house_no` ← `registered_address_line2` ❌ (line 2 goes into House No box)
- `str_suppl1` ← line3 or line2
- `str_suppl2`, `str_suppl3` ← empty
- `location` ← `registered_city` ❌ (duplicated with city, fills "Street 5")
- `district` ← `registered_city` ❌ (duplicated, fills District)

Result in SAP: address line 2 lands in House Number, city gets repeated into Street 5 and District. That matches the screenshot (Street 2 = "chebrolle", Street 5 = "guntur").

Required mapping (per the sample payload you shared):
- `street` ← line 1, `house_no` ← `""`
- `str_suppl1` ← line 2
- `str_suppl2` ← line 3
- `str_suppl3` ← line 4
- `location` ← `""`, `district` ← `""`
- `city` ← `registered_city`, `region` ← state code, `postl_cod1` ← pincode

**2. `+91 XXXXX XXXXX` placeholder shown on every phone field**
Found in 6 files: `ContactStep.tsx`, `VendorRegistration.tsx`, `AdminInvitations.tsx`, `BrandingConfig.tsx`, `EnterpriseHeader.tsx`, `SupportHelp.tsx`.

## Plan

### Step 1 — Migration: fix default SAP payload template
Update the active row(s) in `sap_payload_templates` so both the root object and the `vendors[0]` object use the corrected address mapping above. Done as a SQL `UPDATE` using `jsonb_set` on every active template (tenant-scoped + global default).

Pseudo:
```sql
UPDATE sap_payload_templates
SET template = template
  || jsonb_build_object(
       'street',     '{{vendor.registered_address|trunc:60}}',
       'house_no',   '',
       'str_suppl1', '{{vendor.registered_address_line2|trunc:40}}',
       'str_suppl2', '{{vendor.registered_address_line3|trunc:40}}',
       'str_suppl3', '{{vendor.registered_address_line4|trunc:40}}',
       'location',   '',
       'district',   ''
     ),
    template['vendors'] = ... -- same overrides for vendors[0]
WHERE is_active = true;
```
(Real SQL will use `jsonb_set` on the nested `vendors` array.)

No code change is needed in `sapPayloadBuilder.ts` / `sync-vendor-to-sap/index.ts` — they already read `registered_address_line2/3/4` from the vendor row, the resolver supports them; only the template wiring is wrong.

### Step 2 — Remove `+91 XXXXX XXXXX` placeholders
Replace placeholder text on phone `<Input>` fields with a neutral hint. Files & changes:

- `src/components/vendor/steps/ContactStep.tsx` — `placeholder="+91 XXXXX XXXXX"` → `placeholder="10-digit mobile number"` (and the optional variants → `"10-digit mobile number (optional)"`).
- `src/pages/VendorRegistration.tsx` — same swap on its phone inputs.
- `src/pages/AdminInvitations.tsx` — same swap.
- `src/components/admin/BrandingConfig.tsx` — support phone field, swap to `"10-digit number"`.
- `src/components/layout/EnterpriseHeader.tsx` — display label / placeholder, swap to neutral text.
- `src/pages/SupportHelp.tsx` — contact display, swap to neutral text.

No validation / regex changes (still 10-digit numeric only).

### Step 3 — Verify
- Re-run a test SAP sync from a vendor with 4 address lines and confirm the generated payload matches the spec (street, str_suppl1/2/3 populated; house_no/location/district empty).
- Visually confirm phone inputs no longer show `+91`.

## Out of scope
- No change to the address-capture form schema (it already stores 4 address lines).
- No edge-function logic change.
- No change to phone validation rules.
