The test email is failing because the saved No Reply SMTP username is `Sunil Kumar`, but Gmail requires the SMTP username to be the actual Gmail address. The backend then attempts to authenticate to Gmail with the name instead of `sunilakula1919@gmail.com`, causing `535 Username and Password not accepted`.

Plan:
1. Update the No Reply Email Configuration form so Gmail SMTP username is validated as an email address, not a display name.
2. Auto-normalize this specific bad saved state by using the From Email as the SMTP username when the host is Gmail and the username is not an email.
3. Save the corrected No Reply config value so future sends use the email address.
4. Harden `send-smtp-email` so it returns a clear user-friendly error for Gmail auth failures instead of only “Edge Function returned a non-2xx status code”.
5. Remove unsafe SMTP debug logging from the backend function so app-password/auth material is not printed in logs.
6. Deploy and test the email function after the fix.