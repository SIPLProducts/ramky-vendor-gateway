## Problem

The SAP Field Confirmation popup lets the user edit Address 1-4, City, State, Pincode, Contact 1/2, Email 1/2 — but those edits never reach the SAP payload. The template only references `vendor.registered_address`, `vendor.secondary_phone_value`, `vendor.secondary_email_value`, etc., which are read straight from the saved vendor row. The `reg_*` keys on `SapFieldOverrides` are passed to `buildSapPayload` but ignored.

Net effect: editing Contact 2 / Email 2 / Address in the popup has no impact on the JSON sent to SAP.

## Fix

In `src/lib/sapPayloadBuilder.ts`, before building the resolver context, apply popup overrides onto a **shallow copy of the vendor object** so the existing `{{vendor.*}}` placeholders pick up the edited values. No template changes needed.

Mapping (override key → vendor field used by template):

| Popup field        | Override key     | Vendor field overwritten              |
|--------------------|------------------|----------------------------------------|
| Address Line 1     | `reg_addr1`      | `registered_address`                   |
| Address Line 2     | `reg_addr2`      | `registered_address_line2`             |
| Address Line 3     | `reg_addr3`      | `registered_address_line3`             |
| Address Line 4     | `reg_addr4`      | `registered_address_line4`             |
| City               | `reg_city`       | `registered_city`                      |
| State              | `reg_state`      | `registered_state`                     |
| Pincode            | `reg_pincode`    | `registered_pincode`                   |
| Contact 1          | `reg_contact1`   | `registered_contact_1`, `primary_phone`|
| Contact 2          | `reg_contact2`   | `registered_contact_2`, `secondary_phone` |
| Email 1            | `reg_email1`     | `registered_email`, `primary_email`    |
| Email 2            | `reg_email2`     | `registered_email_2`, `secondary_email`|

Rules:
- Only apply a key when the override value is a non-empty string (preserves saved value when the user clears a field? — use "override wins as long as the field was rendered", i.e. when the key is present on the overrides object — popup always sends all keys, so empty string from popup is an intentional clear and should be respected; pick **"present key wins, including empty"**, matching the WYSIWYG behavior the user expects).
- For State, also recompute the region check against the override value so the existing "state not mapped" guard runs on what's actually being sent.
- Do not mutate the original vendor object returned by Supabase; clone it (`{ ...vendor }`).

Out of scope:
- No template edits, no schema changes, no UI changes.
- Bulk sync (`sync-vendors-to-sap-bulk` edge function) is server-side and uses a different code path; the user's report is about the per-vendor popup, so leave the bulk path untouched unless they ask.
- We are NOT writing the popup edits back to the `vendors` table — they apply only to this SAP push.

## Files

1. `src/lib/sapPayloadBuilder.ts` — inside `buildSapPayload`, after loading `vendor` and before building `ctx`, build `vendorForPayload = { ...vendor }` and copy each present `overrides.reg_*` key into the matching vendor field(s) above. Use `vendorForPayload` in the `ResolverCtx` and in the region pre-check.
