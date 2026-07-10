
## Screen Configuration — Phase 1 (Reports)

Add a new **Screen Configuration** tab in Admin Configuration that controls the visibility of tabs, filters, and action buttons on the Reports screen. Saved settings take effect immediately; report generation logic is untouched.

### 1. Storage

Reuse the existing `portal_config` table (key/value) — no schema changes. Store a single JSON entry:

- `config_key = "screen_config_reports"`
- `config_value` = JSON of booleans, all default `true`:
  ```
  {
    "report_type_vendor": true,
    "report_type_approval": true,
    "report_type_both": true,
    "scope_single": true,
    "scope_all": true,
    "filter_from_date": true,
    "filter_to_date": true,
    "filter_vendor_status": true,
    "action_run": true,
    "action_reset": true,
    "action_excel": true,
    "action_pdf": true
  }
  ```

### 2. New hook — `src/hooks/useScreenConfig.tsx`

- `useReportsScreenConfig()` — React Query fetch of the row above, returns the parsed object (with all-true defaults if missing). Enables realtime effect via short `staleTime` + query invalidation on save.
- `useSaveReportsScreenConfig()` — upserts the row and invalidates the query.

### 3. Admin UI — new tab

In `src/pages/AdminConfiguration.tsx`:
- Add a 6th `TabsTrigger` **Screen Configuration** (`Eye` icon), update `grid-cols-5` → `grid-cols-6`.
- New `<TabsContent value="screen">` renders `<ReportsScreenConfigCard />`.

New component `src/components/admin/ReportsScreenConfigCard.tsx`:
- Card titled **Reports Configuration** with grouped Switch rows:
  - **Report Type**: Vendor Report, Approval Flow Report, Both
  - **Scope**: Single Vendor (Reference Number), All Vendors
  - **Filters**: From Date, To Date, Vendor Status
  - **Action Buttons**: Run Report, Reset, Export to Excel, Export to PDF
- Local dirty state + Save button that calls the save mutation and toasts.

### 4. Reports screen wiring — `src/pages/Reports.tsx`

Read config via `useReportsScreenConfig()` and conditionally render:
- Each `RadioGroupItem` under Report Type / Scope wrapped in `cfg.report_type_*` / `cfg.scope_*`.
- From/To date inputs and Vendor Status MultiSelect wrapped in their filter flags.
- Each action Button (Run, Reset, Excel, PDF) wrapped in its action flag; also applied to the single-vendor Excel/PDF toolbar card.
- If the currently selected `reportType` / `mode` becomes hidden, fall back to the first still-visible option (in a `useEffect`).
- All existing data-loading logic (`run`, `reset`, exports, tables) unchanged.

### Technical notes

- No new tables, no RLS changes — `portal_config` already has admin RLS.
- Realtime effect: after Save, invalidating the query re-renders Reports immediately for anyone with the page open (their next focus/refetch picks it up); no realtime subscription needed for phase 1.
- Hidden filters simply don't render; their state values remain at defaults so `run()` still works.
