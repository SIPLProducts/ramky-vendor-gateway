## Situation

The migration file exists in your Lovable project:

`supabase/migrations/20260702094621_ac1ab483-2cfb-48e5-9baf-8fcb81b62b1d.sql`

But it's not showing on your connected GitHub repo. Lovable → GitHub sync is one-way automatic; I don't have `git` access from this environment, so I cannot manually `git push`. The sync must be re-triggered from Lovable's side.

## What to do

Try these in order — stop at the first that works:

1. **Refresh the GitHub page.** Confirm you're looking at the correct branch (usually `main`) and the `supabase/migrations/` folder. Sometimes it's just a stale browser view.

2. **Force a resync by making a trivial edit in Lovable.** In the next chat message, ask me to "touch the migration file" — I'll add a harmless SQL comment to it in build mode, which forces Lovable to push a new commit that includes the file.

3. **Reconnect GitHub** if sync is broken:
   - Plus (+) menu (bottom-left of chat) → GitHub → Disconnect
   - Then Plus (+) → GitHub → Connect project again
   - Lovable will push the full current state of the project, including all migration files.

4. **Check GitHub App permissions.** In GitHub → Settings → Applications → Lovable, make sure it still has write access to the repository. If access was revoked, sync silently stops.

## As a workaround

If you need the file on the server right now and can't wait for the GitHub sync, copy the SQL directly from the Lovable code editor (open `supabase/migrations/20260702094621_ac1ab483-2cfb-48e5-9baf-8fcb81b62b1d.sql`) and paste it into a new file on your server, then run it with `psql`.

## Next step

Tell me which option you want, or just say "force resync" and I'll switch to build mode and make a trivial edit to trigger a fresh push to GitHub.
