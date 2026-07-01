Plan:

1. Registration Back button behavior
   - On the registration form, when the user clicks the small Back button near “Vendor Type”, show a confirmation dialog:
     - Title: “Go back to main screen?”
     - Message: “If you go back, the data entered will be cleared.”
     - Buttons: “Yes” and “No”
   - If the user clicks “Yes”, clear the current registration data and return to the Domestic / International selection screen.
   - If the user clicks “No”, keep the user on the current registration form with no data changes.

2. Keep normal step navigation unchanged
   - The “Previous” button inside the form should continue to move between registration steps.
   - Only the main Back button that returns to vendor type selection will show the confirmation.

3. Vendor invitation URL protection
   - Prevent `/vendor/registration` from becoming a valid vendor login/registration screen when the required invitation context is missing.
   - If a vendor removes `?token=...` from the registration URL, show Access Denied instead of sending them to the login/registration flow.
   - Keep valid invited links like `/vendor/registration?token=...` working normally.
   - Keep buyer on-behalf links like `/vendor/registration?onBehalfOf=...` working normally.

4. Validation
   - Check the registration page behavior for:
     - Valid token URL.
     - Token removed from URL.
     - Back → Yes.
     - Back → No.
   - Run a TypeScript check after implementation.