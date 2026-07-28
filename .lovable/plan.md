# Plan: Remove "Your application is now under review" from the post-submission success screen

## Current state
The phrase "Your application is now under review" is shown to the vendor after submission in the default/fallback status message in `src/components/vendor/SuccessScreen.tsx` (line 112). It appears after the title "Application Submitted Successfully". The same wording also exists in two email/notification Edge Functions:
- `supabase/functions/send-status-notification/index.ts`
- `supabase/functions/notify-vendor-submission/index.ts`

## Change
1. In `src/components/vendor/SuccessScreen.tsx`, update the default case `message` text so it no longer reads "Your application is now under review". Replace it with a neutral confirmation such as "Thank you for submitting your application." or simply remove the message entirely, depending on which is preferred. Keep the title and the rest of the screen unchanged.

2. Clarification needed: Should the same "under review" wording also be removed/changed in the two email/notification Edge Functions, or only from the on-screen success message?

## Files affected
- `src/components/vendor/SuccessScreen.tsx` (required)
- `supabase/functions/send-status-notification/index.ts` (optional, pending confirmation)
- `supabase/functions/notify-vendor-submission/index.ts` (optional, pending confirmation)

## Verification
- Search the codebase again to confirm no on-screen instance of "Your application is now under review" remains in `src/components/vendor/SuccessScreen.tsx`.
- Preview the success screen to confirm the updated message appears.