### Plan

1. **Search input placeholder and icon cleanup**
   - In `src/pages/VendorList.tsx` (All Vendors filter input):
     - Change placeholder from `"Search by Buyer Company, Invited By, Vendor, GSTIN, Location, SAP Code"` to `"Search"`.
     - Remove the leading `Search` icon and switch the wrapper from `relative` to a plain flex container.
   - In `src/pages/Dashboard.tsx` (Vendor Applications table search input):
     - Change placeholder from `"Search table..."` to `"Search"`.
     - Remove the leading `Search` icon.
     - Remove the unused `Search` import from the `lucide-react` import block.

2. **Vendor Status back navigation**
   - In `src/pages/VendorStatus.tsx`:
     - Change the button label from `"Back to Dashboard"` to `"Back"`.
     - Change the navigation target from `/dashboard` to `/vendors` so users return to the All Vendors screen after tracking by reference number.

No other logic or behavior changes.