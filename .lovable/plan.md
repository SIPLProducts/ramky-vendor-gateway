Change the default status filter label on the All Vendors screen from "All Statuses" to "All Status".

File to edit: `src/pages/VendorList.tsx`.
Change: line 364 `<SelectItem value="all">All Statuses</SelectItem>` → `<SelectItem value="all">All Status</SelectItem>`.

No other labels, filter logic, or functionality changes.