## Issue
Final **Submit Application** is showing “Contact Details is incomplete” even after the user already passed the Contact Details tab with **Continue**.

## Root cause
There are two different validation rules:

```text
Contact tab Continue validation: CEO/MD fields are optional
Final Submit validation: CEO/MD name + email/phone are required
```

So the tab allows the user to proceed, but final submit blocks them later.

## Fix plan
1. Update `src/pages/VendorRegistration.tsx` so final submit validation no longer requires Contact Details fields that the Contact tab itself treats as optional.
2. Keep Contact tab format validation unchanged, so if the user enters an invalid email or phone, **Continue** still blocks it there.
3. Keep other submit checks unchanged:
   - Document Verification still required
   - Organization and Address validation unchanged
   - Declaration checkboxes still required before submit
4. Verify from the Review step that **Submit Application** no longer redirects back to Contact Details with the red error toast.

## Scope
Frontend validation fix only. No backend/database changes.