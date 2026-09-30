# Add SAP Vendor Code to Dashboard

## Goal
Show each vendor’s SAP Vendor Code directly beside the Reference Number in the Dashboard vendor list.

## Confirmed current behavior
- Successful SAP Sync saves the returned SAP vendor number in `vendors.sap_vendor_code`.
- The SAP Sync screen already reads and displays that same saved value.
- The Dashboard currently does not request or display `sap_vendor_code`.

## Changes
1. Include `sap_vendor_code` when the Dashboard loads vendor records.
2. Add a **SAP Vendor Code** column immediately after **Reference Number**.
3. Display the saved code, or `—` when SAP Sync has not yet produced one.
4. Add the same field to the Dashboard Excel export so the downloaded report matches the table.
5. Update loading and empty-table column spans to keep the table aligned.
6. Verify the Dashboard renders correctly and the project remains error-free.

## Technical details
- Frontend-only change in the Dashboard page.
- No database migration or SAP Sync function change is required because the field already exists and is populated by the current SAP Sync flow.
