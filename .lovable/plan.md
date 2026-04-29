
## SAP Module — SAP API Settings

Your message was cut off after "API Configurations and i want", so I'm proceeding with the most complete interpretation of the four screenshots you uploaded: build the full **SAP API Settings** screen plus its detailed **Edit API Configuration** page, persisted in the database. We can trim scope after you review.

### 1. Navigation — new "SAP" module group

In `src/components/layout/Sidebar.tsx`, group SAP entries under a "SAP" section:

- `SAP Sync` (existing) → `/sap/sync`
- **`SAP API Settings`** (new) → `/sap/api-settings` — icon `Settings2`, screenKey `sap_api_settings`, restricted to **System Admin** (`admin` / `sharvi_admin`).

Register the new routes in `src/App.tsx`:
- `/sap/api-settings` → `SapApiSettings` page
- `/sap/api-settings/:configId` → `SapApiConfigEdit` page

### 2. Database — new tables (Lovable Cloud)

```text
sap_api_configs
├─ id (uuid, pk)
├─ name (text, required)
├─ description (text)
├─ base_url (text, required)
├─ endpoint_path (text, required)
├─ http_method (text: GET|POST|PUT|PATCH|DELETE)
├─ auth_type (text: Basic|Bearer|None)
├─ sap_client (text, e.g. "100")
├─ timeout_ms (int, default 30000)
├─ connection_mode (text: proxy|direct)
├─ deployment_mode (text: cloud|self_hosted)
├─ middleware_url (text)
├─ middleware_port (int)
├─ proxy_secret (text, nullable)
├─ list_endpoint (text), create_endpoint (text)
├─ update_endpoint (text), update_method (text)
├─ key_field (text)
├─ api_type (text: sync|fetch)
├─ auto_sync_enabled (bool, default false)
├─ schedule_cron (text, nullable)
├─ last_synced_at (timestamptz), next_sync_at (timestamptz)
├─ is_active (bool, default true)
├─ created_at, updated_at, created_by (uuid)

sap_api_request_fields   — id, config_id (fk), field_name, source, default_value, required, order_index
sap_api_response_fields  — id, config_id (fk), field_name, target_column, order_index
sap_api_credentials      — id, config_id (fk, unique), username, password_encrypted, extra_headers (jsonb)
```

- RLS enabled on all four tables.
- Policies: `SELECT/INSERT/UPDATE/DELETE` allowed only when `has_role(auth.uid(), 'admin')` OR `has_role(auth.uid(), 'sharvi_admin')`.
- `update_updated_at_column` trigger on each table.

### 3. SAP API Settings list page (`src/pages/SapApiSettings.tsx`)

Matches screenshots 1 & 2:

- Page header: **"SAP API Settings"** + subtitle, **System Admin** badge (top-right).
- Tabs: `API Configurations` | `SAP Connectivity Guide`.
- Top-right actions: `Test SAP connection`, `Download PDF`.
- Info banner card "How SAP Connection Works" with the two side-by-side cards (Lovable Cloud Preview / Self-Hosted) — static copy taken verbatim from screenshot 1.
- Toolbar above table: `Export APIs`, `Import APIs`, `+ Add API Configuration` (primary green).
- Table columns: Name (with "Proxy" badge), Endpoint (mono, truncated), HTTP Method, Auth, Last Sync, Next Sync, Actions (Edit / Delete / Toggle Active).
- Empty state and loading skeletons.
- Data via a new `useSapApiConfigs` hook (`@tanstack/react-query`).

### 4. Quick "Add API Configuration" dialog (screenshot 4)

Component `AddSapApiConfigDialog.tsx` — small modal with:
Name*, Description, Base URL, Endpoint Path*, HTTP Method, Auth Type, Connection (Proxy/Direct), API Type (Sync/Fetch), `Enable Auto-Sync` toggle, footer link **"Save & open advanced editor →"** (saves + navigates to the edit page) and `Save API` button.

Uses `react-hook-form` + zod validation.

### 5. Advanced edit page (`src/pages/SapApiConfigEdit.tsx`) — screenshot 3

Header: `← Back` + `Edit API Configuration`. Six tabs:

1. **API Details** — full form: Name, Description, Base URL, Endpoint Path, List Endpoint, Create Endpoint, Update Endpoint, Update Method, Key Field, HTTP Method, Auth Type, SAP Client, Timeout, Connection Mode, Deployment Mode, Middleware Port, Node.js Middleware URL, Proxy Secret. Sticky footer with `Cancel` / `Save API Details`.
2. **Request Fields** — editable table (Field Name, Source, Default Value, Required) with add/remove row.
3. **Response Fields** — editable table (Field Name, Target Column) with add/remove row.
4. **Scheduler** — auto-sync toggle, cron input + presets (Every 5 min / Hourly / Daily), next/last run readouts.
5. **Credentials** — Username, Password (masked), extra headers JSON editor. Password stored via edge function (never round-tripped to client after save).
6. **Settings** — Active toggle, danger zone (Delete configuration with confirm).

### 6. Import / Export

- **Export APIs** → downloads JSON of all configs (excluding password fields).
- **Import APIs** → file input accepts the same JSON, validates with zod, upserts rows.

### 7. "Test SAP connection" action

New edge function **`sap-api-test-connection`**:
- Input: `configId`.
- Loads config + credentials, performs a `HEAD`/`GET` against `base_url + endpoint_path` (or middleware URL if proxy mode) with Basic/Bearer auth.
- Returns `{ ok, status, latency_ms, message }`.
- UI shows result in a toast + a small results dialog.

### 8. Files added / changed

**New**
- `src/pages/SapApiSettings.tsx`
- `src/pages/SapApiConfigEdit.tsx`
- `src/components/sap/AddSapApiConfigDialog.tsx`
- `src/components/sap/SapConnectivityGuide.tsx`
- `src/components/sap/RequestFieldsEditor.tsx`
- `src/components/sap/ResponseFieldsEditor.tsx`
- `src/hooks/useSapApiConfigs.tsx`
- `supabase/functions/sap-api-test-connection/index.ts`
- One migration creating the four tables + RLS + triggers.

**Edited**
- `src/App.tsx` — register the two new routes.
- `src/components/layout/Sidebar.tsx` — add "SAP API Settings" entry, restrict to admin roles.
- `src/hooks/useScreenPermissions.tsx` — register the new `sap_api_settings` screen key (if it gates by key).

### Defaults I'm assuming (since you skipped the questions)

- **Scope**: full screen matching all four mockups (list + quick add + advanced edit).
- **Persistence**: real DB tables in Lovable Cloud (so configs survive across sessions / users).
- **Access**: `admin` and `sharvi_admin` roles only.

If any of these defaults are wrong — for example you only want the list + quick-add for now, or want it to be frontend-only mock data — tell me and I'll adjust before implementation.
