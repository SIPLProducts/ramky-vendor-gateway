
## Goal

Collapse the "Country, Region & Contacts" card in the International Company Details step into the existing **Address** card, so all address, location, phone, fax, country/region, and contact/email fields render inside a single card.

## Changes

### `src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx`
- Remove the separate `<div className="form-section">` wrapper and heading for "Country, Region & Contacts".
- Move its contents (Country dropdown, Region dropdown, City, PIN Code, Contact 1/2, Email 1/2) into the Address card, appended after the Office Phone / Fax row.
- Final Address card order:
  1. Address Line 1 (full width)
  2. Address Line 2 / 3 / 4
  3. Office Phone / Fax
  4. Country (From SAP) / Region (From SAP)
  5. City / PIN Code
  6. Contact 1 / Email 1
  7. Contact 2 / Email 2
- Keep the Address card heading and MapPin icon as-is.

## Out of scope
- No schema, validation, persistence, or SAP-mapping changes.
- Domestic flow untouched.
