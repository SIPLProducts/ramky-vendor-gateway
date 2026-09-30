# Standardize Financial and Classification Fields

## Goal
- Remove **Credit Period Expected** from active application flows.
- Make **Material Group for Vendors** mandatory wherever classification is entered or approved.
- Keep **Vendor Category** available, but optional everywhere.

## Changes

### 1. Remove Credit Period Expected
- Remove the field from domestic financial forms, validation, form state, and save/load mappings.
- Remove it from vendor completeness scoring and built-in form configuration/help metadata.
- Remove it from finance review, vendor detail popups, review helpers, mock data, support guidance, and field-mapping documentation.
- Disable the existing database-configured Credit Period field so it cannot reappear through form settings.
- Preserve the legacy database column and any historical value already stored; the application will stop reading or writing it. This avoids a destructive database change.

### 2. Require Material Group for Vendors
- Require at least one Material Group in domestic registration whenever classification is shown.
- Require Material Group in international registration.
- Keep Material Group required in buyer approval and buyer re-approval.
- Add server-side checks to both buyer approval actions so a request cannot bypass the on-screen requirement.
- Require Material Group before SAP sync when the classification-details option is used, while preserving the existing cash-flow/tier alternative.

### 3. Make Vendor Category optional
- Remove required indicators and blocking checks from buyer approval and re-approval.
- Keep Vendor Category optional in domestic and international registration.
- Keep the field available for SAP mapping and saved values without requiring a selection.

### 4. Verification
- Confirm registration cannot continue with an empty Material Group where classification is displayed.
- Confirm Buyer approval and re-approval require Material Group but allow an empty Vendor Category.
- Confirm SAP sync applies the same classification rule.
- Confirm Credit Period no longer appears in forms, reviews, settings, help content, or completeness calculations.
- Check the application build and the central registration/approval flows on desktop and mobile.

## Technical details
- No destructive column removal or deletion of historical vendor data.
- Existing Material Group and Vendor Category database columns and SAP payload mappings remain unchanged.
- Update the buyer approval functions together with the interface so validation is enforced on both sides.

## Not included
- The separate PAN/Aadhaar-linked persistence and display issue shown in the screenshot is not part of this field-standardization change.
