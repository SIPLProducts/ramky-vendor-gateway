## Scope
Global spacing cleanup, full mobile responsiveness pass across portal + vendor screens, and a logout fix.

## 1. Fix Logout (root cause)

`AppLayout.handleLogout` calls `supabase.auth.signOut()` then `window.location.href = '/auth'`. On self-host, the `/auth/` path is intercepted by nginx (proxied to GoTrue) — the browser hits GoTrue's `/auth/` instead of the React `/auth` route, causing the basic-auth prompt / stuck screen the user has been seeing.

Fix:
- Use React Router `navigate('/auth', { replace: true })` instead of `window.location.href` in both `AppLayout.handleLogout` and `Header.handleLogout`.
- Fall back to `window.location.replace('/auth')` only if navigate is unavailable.
- Ensure `signOut` clears local state (already does) and Auth page renders correctly when session is gone.
- Verify: click Logout from Sidebar, MobileHeader, and dropdown → lands on `/auth` login form, no basic-auth prompt, no refresh loop.

## 2. Reduce Excessive Padding (global sweep)

Introduce a compact spacing scale and apply it consistently instead of hand-tuning every screen.

**Global tokens (`src/index.css`):**
- Tighten `.app-screen` padding (currently generous) to `p-4 md:p-6` desktop / `p-3` mobile.
- Add utility classes: `.card-tight` (`p-4 md:p-5`), `.section-tight` (`space-y-3 md:space-y-4`), `.header-tight` (`py-2 md:py-3`).

**Vendor Registration (`VendorRegistration.tsx` + steps):**
- Remove the tall gap above "All required checks passed" — trim the step indicator wrapper top padding and drop the empty white card shell above the verification banner.
- Reduce `CardHeader`/`CardContent` padding in `DocumentVerificationStep`, `OrganizationStep`, `AddressStep`, `FinancialStep`, `ReviewStep` from default `p-6` to `p-4 md:p-5`.
- Tighten GST/PAN/MSME/Bank tab wrapper and the inner form grids (`gap-6` → `gap-4`).

**Portal screens (Dashboard, VendorList, SAPSync, Approval pages, UserManagement, Admin config):**
- Wrap main content in the same `.app-screen` tight padding.
- Reduce `Card`/`CardContent` default padding via a shared wrapper.
- Trim `space-y-6` blocks to `space-y-4`.

**Approval dialogs (`StageApprovalView`, `VendorReviewDialog`, `ApprovalCommentsDialog`):**
- Reduce dialog inner padding, section gaps, and header vertical rhythm.

## 3. Mobile Responsiveness Pass (entire portal + vendor)

**Cards** — All Card components: `w-full`, remove any hard `min-w` values, ensure `overflow-hidden` where needed. Add `.card-tight` mobile padding.

**Forms** — Grid layouts converted to `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` where currently fixed. Inputs already `w-full`; ensure labels use `text-sm md:text-base`.

**Tables** (per user: "decrease the font size and padding") — Global table adjustments in `src/index.css` and shadcn table primitives (`src/components/ui/table.tsx`):
- Mobile (`<768px`): `text-xs`, cell padding `px-2 py-1.5` (from default `p-4`), header padding `px-2 py-2`.
- Wrap every table in the app with a horizontally scrollable container (`overflow-x-auto -mx-3 md:mx-0`) as a safety net.
- Update `Table`, `TableHead`, `TableCell` primitives once — cascades to VendorList, SAPSync, UserManagement, Invitations, AuditLogs, Dashboard action table, Approval pending lists.

**Tabs** — shadcn `TabsList` on mobile: allow horizontal scroll (`overflow-x-auto flex-nowrap`), reduce trigger padding to `px-3 py-1.5 text-xs md:text-sm`. Fixes GST/PAN/MSME/Bank tab strip and admin config tabs.

**Buttons** — Sticky action bars (`StickyActionBar`, registration footer, approval dialog footer): stack `flex-col md:flex-row`, `w-full md:w-auto` for each button under 640px; reduce mobile height to `h-10`.

**Titles & labels** — Page headers (`PageHeader`, section h1/h2): responsive text `text-lg md:text-2xl` for page titles, `text-base md:text-lg` for card titles, `text-sm` for field labels.

**Dashboard status tiles** — Convert current row to `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` so 5 tiles wrap gracefully on phones.

**Step indicator** — `EnterpriseStepIndicator` / `HorizontalStepIndicator`: on mobile show a compact "Step X of N — {label}" bar with progress dots; hide labels under 640px to prevent overflow.

**MobileHeader/Sidebar** — Already exists; verify the tenant switcher, notification bell, avatar don't overflow at 320px width.

## Technical Details

Files modified:
- `src/components/layout/AppLayout.tsx`, `src/components/layout/Header.tsx` — navigate() for logout.
- `src/index.css` — spacing tokens, responsive table + tabs rules, `.app-screen` tightening.
- `src/components/ui/table.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/card.tsx`, `src/components/ui/dialog.tsx` — responsive primitives.
- `src/pages/VendorRegistration.tsx` + `src/components/vendor/steps/*` — trim top padding, tab/grid gaps.
- `src/pages/Dashboard.tsx`, `VendorList.tsx`, `SAPSync.tsx`, `UserManagement.tsx`, `AdminInvitations.tsx`, `AuditLogs.tsx`, `approvals/*.tsx` — apply tight spacing + wrap tables in scroll container.
- `src/components/vendor/EnterpriseStepIndicator.tsx` / `HorizontalStepIndicator.tsx` — mobile compact mode.
- `src/components/approvals/StageApprovalView.tsx`, `src/components/vendor/VendorReviewDialog.tsx`, `src/components/vendor/StickyActionBar.tsx` — mobile stack + tighter padding.

## Verification
- Playwright at 375×812 (mobile) and 1280×800 (desktop): open Vendor Registration, Dashboard, VendorList, SAP Sync, an Approval screen, and UserManagement. Confirm no horizontal page scroll, tables scroll internally, tabs don't clip, buttons don't overlap.
- Click Logout from desktop Sidebar and MobileHeader → both land on `/auth` with the login form visible.
- Confirm no regressions in existing flows (invitation, submit, approve, SAP sync).

## Out of scope
No business-logic, backend, RLS, or edge-function changes. Presentation and routing only.