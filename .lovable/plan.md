## Diagnosis

Your attached payload proves two things:

1. The **SAP Sync popup is saving withholding correctly** — `overrides.withholding` has both rows (W2/P2/CO/IN and W7/W8/OT/IN). Nothing is broken on the UI side.
2. The **client-built `sapPayload[0].WHOLDTAX` is empty** — because the built frontend on the server is still using the old builder / old stored SAP payload template that emits blank WHOLDTAX rows.

The current codebase in this repo already contains the correct server-side protection: `supabase/functions/sync-vendor-to-sap/index.ts` (lines 441–458 and 579–596) rebuilds `WHOLDTAX` from `overrides.withholding` and ignores the empty rows in the client payload before forwarding to the middleware/SAP.

So if the server were running the latest edge function code, the outgoing SAP request would contain your W2/W7 rows even though the client payload has blanks.

**Root cause on the server:** the edge function `sync-vendor-to-sap` on `206.1.23.95:9009` is running an older build. The fix is a deployment step, not a code change.

## What you need to do (no new code changes required)

### Step 1 — Redeploy edge functions on the self-hosted server

SSH into the server and run the existing deploy script from the latest checked-out repo:

```bash
cd /path/to/latest/repo   # the repo that contains this fixed code
sudo bash scripts/selfhost/deploy-latest.sh --skip-frontend --skip-migrations
```

This does exactly what's needed:
- `rsync` `supabase/functions/` → `/opt/Ramky_Applications/DEV/VMS/backend/volumes/functions/`
- `docker compose restart functions`

### Step 2 — Verify the deployed function actually contains the WHOLDTAX rebuild

```bash
grep -n "WHOLDTAX — always rebuild from overrides.withholding" \
  /opt/Ramky_Applications/DEV/VMS/backend/volumes/functions/sync-vendor-to-sap/index.ts
```

You should see **two matches** (lines ~441 and ~579). If you see zero matches, the rsync didn't pick up the new file — re-run Step 1 from the correct repo path.

### Step 3 — Confirm the container restarted with the new code

```bash
docker compose -f /opt/Ramky_Applications/DEV/VMS/backend/docker-compose.yml \
  restart functions
docker compose -f /opt/Ramky_Applications/DEV/VMS/backend/docker-compose.yml \
  logs --tail=50 functions
```

### Step 4 — Re-test SAP Sync from the server UI

Open the SAP Field Confirmation popup, add the same two withholding rows, click Sync to SAP, then check the function logs:

```bash
docker compose -f /opt/Ramky_Applications/DEV/VMS/backend/docker-compose.yml \
  logs -f functions | grep -i "WHOLDTAX rows"
```

You should see: `Using client-supplied SAP payload, topLevelKeys: XX WHOLDTAX rows: 2`

The outgoing SAP payload will now contain:

```json
"WHOLDTAX": [
  { "LIFNR": "", "WITHT": "W2", "WT_WITHCD": "P2", "WT_SUBJCT": "X", "QSREC": "CO", "QLAND": "IN" },
  { "LIFNR": "", "WITHT": "W7", "WT_WITHCD": "W8", "WT_SUBJCT": "X", "QSREC": "OT", "QLAND": "IN" }
]
```

### Step 5 (optional but recommended) — Rebuild & deploy the frontend too

To also fix the client-built payload shown in browser DevTools (so it's not misleading during future debugging):

```bash
cd /path/to/latest/repo
sudo bash scripts/selfhost/deploy-latest.sh --skip-migrations
```

This runs `npm run build` and copies `dist/` into nginx. The frontend is not required for the SAP fix (the backend already rebuilds WHOLDTAX), but it makes browser Network tab match what actually gets sent to SAP.

## Summary

- **No code changes needed** — this repo already has the fix.
- **The server is running old edge function code.** Redeploy edge functions and restart the `functions` container using `scripts/selfhost/deploy-latest.sh --skip-frontend --skip-migrations`.
- Verify with the `grep` + logs commands above.
- Optionally rebuild the frontend so the browser payload also shows the correct WHOLDTAX values.