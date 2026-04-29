## Goal

The SAP Module and SAP API Settings screen already exist with a 6-tab editor (API Details, Request Fields, Response Fields, Scheduler, Credentials, Settings). The remaining ask is to make the **Request, Response, and Credentials** tabs more usable by letting the user **upload a sample payload** and auto-detecting the fields from it.

## Changes

### 1. Reusable Payload Auto-Detect utility
Create `src/lib/payloadAutoDetect.ts`:
- `parsePayload(text)` — accepts JSON or CSV text, returns a normalized object/array.
- `flattenFields(obj, prefix)` — walks nested JSON and returns flat dotted paths (e.g. `d.results[0].BPARTNER` → `BPARTNER`, plus full path).
- `detectRequestFields(payload)` → `[{ field_name, source, default_value, required }]` with sensible defaults (`required` inferred from non-null leaves, `default_value` from sample value).
- `detectResponseFields(payload)` → `[{ field_name, target_column }]` with `target_column` auto-suggested as `snake_case(field_name)`.
- Handles common SAP shapes: `{ d: { results: [...] } }`, OData v4 `{ value: [...] }`, raw arrays, single objects.

### 2. Payload upload component
Create `src/components/sap/PayloadUploader.tsx`:
- Drag-and-drop + file picker (`.json`, `.txt`, `.csv`) and a paste-JSON textarea (tabbed inside the dialog).
- "Auto-detect fields" button → runs the detector and previews detected fields in a small table with checkboxes (user can deselect any).
- Two modes via prop: `mode: "request" | "response"` — controls preview columns and what is emitted.
- Emits `onApply(rows)` with the chosen rows; parent appends or replaces existing rows (user choice via radio: **Replace all** / **Append new only**).

### 3. Wire uploader into editors
- `RequestFieldsEditor.tsx`: add an "Upload payload" button next to "Add field"; opens `PayloadUploader mode="request"`. On apply, merge into rows and call `onChange`.
- `ResponseFieldsEditor.tsx`: same, with `mode="response"`.
- `SapApiConfigEdit.tsx` Credentials tab: add an "Upload headers JSON" button that parses an uploaded JSON file into the **Extra Headers** textarea (auto-pretty-printed). If the file contains `username` / `password` / `token` keys, populate those fields too.

### 4. Small UX polish on the screen (matches uploaded mockup)
- `SapApiSettings.tsx`: confirm the page header shows "SAP API Settings" with a `System Admin` badge on the right (already exists — verify and keep).
- The Add API Configuration dialog stays as-is; no schema changes.

## Technical notes

- No database migrations needed — existing tables (`sap_api_request_fields`, `sap_api_response_fields`, `sap_api_credentials`) already cover the data shape.
- All parsing happens client-side; no edge function changes.
- File size guard: reject >2 MB uploads with a toast.
- CSV parsing: simple split (comma + newline, header row → field names). For complex CSVs, JSON is the recommended format (mention in helper text).

## Files

- New: `src/lib/payloadAutoDetect.ts`
- New: `src/components/sap/PayloadUploader.tsx`
- Edit: `src/components/sap/RequestFieldsEditor.tsx` (add Upload button)
- Edit: `src/components/sap/ResponseFieldsEditor.tsx` (add Upload button)
- Edit: `src/pages/SapApiConfigEdit.tsx` (Credentials tab: upload headers JSON)
