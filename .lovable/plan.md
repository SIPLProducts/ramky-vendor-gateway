## Make International Classification fields optional

Update `src/components/vendor/steps/international/IntlClassificationStep.tsx`:

- Change the Zod schema so `materialGroupVendor` and `vendorLocation` are `z.array(z.string()).optional().default([])` (matching the already-optional `vendorCategory` and `identificationSource`).
- Remove the required asterisk from the Material Group for Vendors and Vendor Location fields by passing `required={false}` in the `renderTextField` calls.

No other files or behavior change. Submission will succeed with all four classification fields empty.