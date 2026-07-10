1. **Reports screen: hide empty group labels** — In `src/pages/Reports.tsx`, conditionally render the Report Type, Scope, Filters, and Action Buttons group labels/sections only when at least one item in that group is visible. If all items are hidden via Screen Configuration, the label disappears too.

2. **Reports Filters card styling** — Add a green left accent border (`border-l-4 border-l-green-500`) to the Reports Filters card, and add a light gray bottom border to the Filters card header.

3. **User Management tab selected state** — Make the selected `TabsTrigger` in `src/pages/UserManagement.tsx` clearly highlighted (e.g., green bottom border, green text, and/or subtle background).

4. **User Management card header bottom border** — Add a green 1–2px bottom border to card headers on the User Management screen (e.g., the Users card, Custom Roles card, and Inactive Login Attempts card headers).