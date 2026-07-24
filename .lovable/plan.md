## Goal

Make Production behave exactly like Development for these two Edge Functions:

- `upload-vendor-document`
- `log-login-attempt`

No new diagnostic scripts. No KYC changes. No frontend/database changes.

## Why they fail in Production

`InvalidWorkerCreation: could not find an appropriate entrypoint` means the Production self-host functions container cannot see `index.ts` for these functions inside its mounted volume `backend/volumes/functions/<name>/index.ts`. Development works because the deploy on DEV copied both folders and the functions container was recreated after the copy. PROD is missing that step for these two functions.

This is purely a deployment sync issue on the Production server, not a code or KYC configuration issue.

## Fix (Production, no new scripts)

Run the existing deploy path on the Production server so the two function folders get copied into the functions volume and the functions container reloads them — same command DEV already uses.

```bash
cd /path/to/latest/repo/on/prod
sudo APP_ROOT=/opt/Ramky_Applications/PROD/VMS \
  bash scripts/selfhost/deploy-latest.sh \
  --skip-build --skip-migrations --skip-frontend
```

That single command:
1. rsyncs `supabase/functions/` (including `upload-vendor-document` and `log-login-attempt`) into `backend/volumes/functions/`
2. Preserves the `main` router (already handled by the existing script)
3. Recreates the `functions` container so edge-runtime picks up the new folders

After it finishes, both URLs will stop returning `InvalidWorkerCreation` and behave the same as DEV.

## Small script change (only if you want the deploy to also verify `log-login-attempt`)

Optional, safe one-line addition to the existing `scripts/selfhost/deploy-latest.sh` and `scripts/lib/40-functions.sh` to also verify `log-login-attempt/index.ts` was copied, matching how they already verify `upload-vendor-document` and `kyc-api-execute`. No new files, no new diagnostic scripts.

If you don't want even this, we can skip it and just run the deploy command above — that alone will fix Production.