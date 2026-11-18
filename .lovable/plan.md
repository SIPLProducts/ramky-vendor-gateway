# Loading Spinner For Logged-In User Screens

## What The User Will See
Logged-in users include Admin, Sharvi Admin, Buyer, SCM, Finance, CEO Office and SAP Team. On their screens (Dashboard, All Vendors, User Management, Audit Logs, User Audit Report, Approvals, SAP Sync and the others), loading will look like this:

- **Page or table loading:** a centered loader in the table area, with a blue spinning ring, a soft pulse and the text "Loading Vendors…", "Loading Users…" and so on. Headers and filters stay visible.
- **Refresh, Search and Export Excel/PDF buttons:** the button's icon turns into a small spinner and the button is disabled until the response arrives, so it can't be double-clicked.
- **Actions** (Approve, Reject, Return, SAP Sync, DMS Sync, Send Invite, Save User, Reassign and similar): the button spinner shows "Processing…", and the dialog stays locked until the result comes back.
- **View Details popup:** the same loader shows while vendor details and documents load.
- **Login and sign-in:** a spinner on the Sign In button while signing in.

The spinner always stops when the API finishes:
- **Success:** the data fades in, or a success message appears.
- **Failure:** the exact API error is shown prominently, with small, normal guidance text below it. Nothing is retried automatically; the existing Refresh button lets the user try again manually.

## Not Changed
- Data, permissions, API calls and business logic stay the same. Only the loading display changes.
- The vendor registration screens are not part of this change. The GST filing loader can be done separately if you want it.

## Technical Details
- New shared `src/components/common/ApiLoader.tsx` with three variants:
  - `panel`: centered spinner and label for tables and cards
  - `button`: `Loader2` with `animate-spin`, for inline button use
  - `overlay`: for dialogs
- The loader uses semantic tokens (`border-primary`, `text-muted-foreground`), Tailwind `animate-spin`/`animate-ping`, `motion-reduce` support and `aria-busy`/`role="status"`.
- New `LoadingButton` wrapper that takes a `loading` prop: it disables the button and swaps the icon for the spinner.
- Apply it to the pages under `src/pages` and `src/pages/approvals` (including Dashboard, VendorList, UserManagement, AuditLogs, UserAuditReport, SAPSync, AdminInvitations, SharviAdminConsole, Kyc/Sap settings, RolePermissions, CustomRoles, Reports, Auth/VendorLogin) and to `VendorReviewDialog`, using their existing `isLoading`/`loading`/mutation `isPending` flags.
- Show error text from `error.message` or the function response message instead of a generic message.
- Self-hosted deployment needs a frontend build only.
