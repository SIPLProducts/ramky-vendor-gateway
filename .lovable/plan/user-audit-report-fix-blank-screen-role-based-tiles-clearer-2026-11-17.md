# User Audit Report: Fix Blank Screen, Role-Based Tiles, Clearer Charts

## 1. Fix the blank screen (confirmed cause)
When a user with records is selected (for example Grandhi Srinivas), the page goes blank. The error is "Cannot access 'fmtWait' before initialization": the new combined table uses two small time helpers before they are defined. Move those helpers above the table logic. Users with no records (like Bala) only worked because the table was empty.

## 2. Tiles based on the selected user's role
Show only the tiles that make sense for that user:
- **Buyer:** Vendors Invited, Created On Behalf, Pending In Queue, SAP Synced Vendors, plus Approvals / Rejections / Returns if they acted on any.
- **Approvers (SCM CO, SCM Head, Finance 1/2, CEO Office):** Approvals, Rejections, Returns / Clarifications, Pending In Queue, Avg Approval Time.
- **SAP Team:** SAP Synced Vendors, Pending In Queue, Approvals, Avg Approval Time.
- **Admin and other roles:** Activity count and Vendors Linked, plus any tile above with a value greater than 0.
- A user with several roles sees the combined set. Tiles stretch to fill a single row.

## 3. Clearer charts
- Chart cards become taller (about 240px), and charts show 2 per row instead of 4, so labels are readable.
- Bars and pie slices use solid gradient colours (top 100% to bottom 70% opacity, instead of fading out). Value labels sit on bars, and the pie shows counts and percentages.
- Larger axis and legend text (11px). Stage names no longer overlap.
- Charts with no data for this user are hidden instead of showing an empty "No Data" box. If every chart is empty, one small message is shown.

## Technical details
- `src/pages/UserAuditReport.tsx` only.
- Move the `hoursSince` and `fmtWait` definitions above the `combined` useMemo.
- Derive the tile list from `rolesBy[userId]` (buyer, scm_manager, scm_head, finance_1, finance_2, ceo_office, sap_team) and filter it. Use `grid-cols-[repeat(auto-fit,minmax(150px,1fr))]`.
- Charts: `md:grid-cols-2`, `h-60`, recharts `LabelList` on bars, and gradient stops with opacity 1 to 0.7.
- Verify in the browser by selecting Grandhi Srinivas (approver) and a buyer.

## 4. Smaller fonts to fit on one screen
- Shrink text across the whole report: title 15px, labels 10–11px, tile numbers 16px, table 11px, filters and buttons 11px with 28px height.
- Tighter tiles, card padding and gaps, so the user card, tiles, charts and the top of the table fit in one screen on a laptop.
- The page's global font rules currently override these sizes, so the report uses forced sizes.
