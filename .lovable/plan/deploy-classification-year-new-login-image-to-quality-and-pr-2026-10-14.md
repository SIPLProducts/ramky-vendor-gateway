# Deploy Classification Year + New Login Image to Quality and Production

## Answers to your questions

1. **Migration for Classification Year — yes, it exists.** `drizzle/migrations/0003_add_msme_classification_year.sql` adds the `msme_classification_year` column to the vendors table. This must be run on the Quality and Production databases, otherwise saving/viewing Classification Year will fail there.

2. **New login image — no extra step needed.** The image is bundled inside the app build (`src/assets/ramky-group-overview.jpeg`), not on a separate CDN. When you build and copy the new `dist` files to Quality or Production, the image comes along automatically. Nothing else to upload.

## Deployment steps

### Quality
1. Run the migration on the Quality database:
   ```sql
   ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS msme_classification_year TEXT;
   ```
   (or run `scripts/selfhost/run-migrations.sh` which applies pending migrations safely)
2. Build the frontend and copy `dist` to the Quality web folder.
3. Reload Nginx (`sudo nginx -t && sudo systemctl reload nginx`).
4. Verify: login page shows the new Ramky Group image; an MSME-registered vendor's View Details shows Classification Year beside MSME Major Activity.

### Production (only after Quality passes, with your approval)
1. Same migration on the Production database.
2. Same frontend build/copy and Nginx reload.
3. Same two checks.

## Technical notes
- No Edge Function changes are included in this round — frontend + one column only.
- The migration is additive and safe (nullable column, `IF NOT EXISTS`); it does not touch existing data.
- Production configuration (keys, URLs, Nginx upstreams) stays unchanged.
