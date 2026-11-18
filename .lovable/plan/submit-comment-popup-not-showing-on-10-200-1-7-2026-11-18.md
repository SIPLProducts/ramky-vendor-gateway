# Submit Comment Popup Not Showing on 10.200.1.7

## Finding
In the current code, every Submit button on the Review & Submit page (both the bottom Submit button and the review step's submit) opens the optional "Comments" popup first, then submits. No code path skips it.

The screenshot is from the self-hosted server (10.200.1.7), which is still running an older frontend build made before the comment popup was added. That is why it submits directly.

## Steps (no code change needed)
1. Database (Quality / Production backend), run once:
   `ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS vendor_submit_comments text;`
   Without this column, submit with a comment would fail to save.
2. Pull the latest code on your local machine, run `npm install` then `npm run build`.
3. Copy the new `dist` folder to the server's web folder for that environment and reload Nginx.
4. In the browser, hard refresh (Ctrl + Shift + R) or clear site data — the app is a PWA and may serve the old cached version until refreshed.
5. Test: open a registration, go to Review & Submit, click Submit — the Comments popup should appear (comment optional), then "Submit Application".
6. Approver opens View Details — the comment shows under Review Comments.

## Optional
If after deploying and hard refresh it still submits directly, send a screenshot of the browser console and I will investigate further.
