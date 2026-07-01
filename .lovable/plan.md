Hide the "Vendor Location" and "Vendor Identification Source" fields from the Classification card in the domestic vendor registration form.

Scope and approach
- Target file: `src/components/vendor/steps/OrganizationStep.tsx`.
- Remove the JSX for the two fields inside the Classification card (the grid that currently shows Material Group, Vendor Category, Vendor Location, and Vendor Identification Source).
- Keep the form schema and default values for `vendorLocation` and `identificationSource` unchanged so the step still emits the same data shape.
- Keep the existing `useEffect` that auto-populates `vendorLocation` from the selected State, so SAP Sync continues to receive the location value even though the field is hidden.
- Clean up the now-unused SAP master-data queries for `vendor_location` and `identification_source` in the same component.
- Out of scope unless you confirm: the International vendor registration classification step (`IntlClassificationStep.tsx`) and the Review step read-only summary.