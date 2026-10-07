# DMS confirmation correction

Deploy these files together to the self-hosted function directory:

- `supabase/functions/sync-vendor-to-dms/index.ts`
- `supabase/functions/sync-vendor-to-dms/response.ts`

This change requires updated function source, not only a frontend `dist` deployment. Use the existing self-hosted function deployment process and restart the correct environment's functions service. No database migration or middleware change is required.

## Acceptance checks in Quality

- SAP HTTP 200 with a nonempty response containing only `MSGTYP: "S"` rows confirms document creation, including a single aggregate row for multiple documents.
- HTTP 200 with an empty body, `[]`, `null`, malformed data, or no SAP message type must report failure and must not set `dms_synced` or `dms_synced_at`.
- `Action failed. An internal error occurred.` must appear as the failure message, including when wrapped inside middleware `sapResponse`.
- HTTP errors, middleware failure, mixed SAP success/error rows, and missing DMS configuration must never mark the whole vendor synced.
- Documents remain untouched on failure. Confirmed SAP creation followed by a portal status-save failure must warn to check SAP before retrying to avoid duplicate creation.

Existing records previously marked synced are not reset automatically. Reconcile them with SAP before changing status or retrying.

The response regression tests and the uploaded false-success example were checked locally. The updated function was deployed to the connected Lovable Cloud environment. Live SAP transactions and self-hosted Quality/Production rollout were not performed.