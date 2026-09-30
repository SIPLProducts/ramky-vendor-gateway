# Fix PAN Tab Locked During Vendor Edit

## Goal
When an existing domestic vendor application is reopened for editing, restore the previously verified GST details and filing-status table so the PAN tab remains available without repeating GST verification.

## Confirmed cause
- PAN is unlocked only when the GST stage is complete.
- The GST stage requires both the saved GST verification and saved filing-status rows.
- Edit loading currently reads only the newest GST validation record. If that newer record contains GST verification data but no `filing_status`, the table is empty, GST is treated as incomplete, and PAN stays locked.

## Changes
1. Update the edit-data loader to examine the vendor's GST validation history and restore the newest valid filing-status data, rather than relying only on the newest row.
2. Merge that filing data with the current saved GST details without replacing newer verification fields.
3. Keep PAN locked for genuinely incomplete GST records; unlock it when the existing verified GST data and filing requirement are restored.
4. Preserve the current GST → PAN → MSME → Bank sequence and all fresh-registration behavior.
5. Add focused regression coverage for editing a vendor where the latest GST validation row lacks filing data but an earlier successful row contains it.

## Verification
- Open an existing returned/draft vendor with completed GST verification.
- Confirm the GST filing table appears immediately.
- Confirm GST shows verified and the PAN tab is enabled.
- Confirm incomplete GST applications still cannot open PAN.
- Check the application build and relevant tests.

## Scope
Frontend data hydration and edit-state restoration only. No Production data updates, provider settings, or unrelated registration behavior will be changed.
