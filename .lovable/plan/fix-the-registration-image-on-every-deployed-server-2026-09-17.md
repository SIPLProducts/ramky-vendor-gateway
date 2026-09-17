# Fix the registration image on every deployed server

## Confirmed cause
The registration page imports `ramky-registration-collage.jpeg.asset.json`, which resolves to a `/_​_l5e/assets-v1/...` Lovable-hosted path. The self-hosted Nginx server does not provide that path, so it returns no image and the browser displays the alt text shown in the screenshot.

The frontend deployment already copies the complete Vite `dist/` folder correctly. The missing image is therefore an asset-location issue, not a deployment-copy issue.

## Fix
1. Add the supplied Ramky collage as a local bundled frontend image.
2. Import that image directly in the vendor registration page instead of using the Lovable asset pointer.
3. Let Vite produce a hashed image inside `dist/assets/`, so the existing deployment script automatically copies it to DEV, Quality, and Production.
4. Keep the current split-screen layout, image crop, vendor choices, and registration behavior unchanged.

## Verification
- Confirm the production build contains the hashed collage file and references it from the generated frontend bundle.
- Open the vendor-type screen and verify the image loads rather than showing alt text.
- Check desktop and mobile layouts and confirm both vendor choices still work.
- Confirm the latest build has no errors.

## Deployment result
After rebuilding and deploying the frontend normally, the image will be served by each environment's own Nginx server. It will no longer depend on the Lovable asset path.
