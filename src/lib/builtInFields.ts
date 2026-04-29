/**
 * Catalog of fields that are built into the hardcoded vendor registration step
 * components. The Form Builder seeds these into form_field_configs the first
 * time an admin opens a built-in tab for a tenant, so that admins can hide,
 * remove, reorder or re-label them — and add new ones — alongside the
 * existing ones.
 *
 * IMPORTANT: `field_name` must match the form field key used by the matching
 * vendor step component, otherwise the vendor form can't honour visibility
 * toggles. Adding a NEW key here is safe, removing/renaming one is not.
 */

export interface BuiltInFieldDef {
  field_name: string;
  display_label: string;
  field_type: string;
  is_mandatory: boolean;
  display_order: number;
  placeholder?: string;
}

export const BUILT_IN_FIELDS_CATALOG: Record<string, BuiltInFieldDef[]> = {
  document_verification: [
    { field_name: 'is_gst_registered',     display_label: 'Is GST Registered',           field_type: 'checkbox', is_mandatory: false, display_order: 1 },
    { field_name: 'gstin',                 display_label: 'GSTIN',                       field_type: 'text',     is_mandatory: true,  display_order: 2, placeholder: '15-digit GSTIN' },
    { field_name: 'gst_certificate',       display_label: 'GST Certificate (upload)',    field_type: 'file',     is_mandatory: false, display_order: 3 },
    { field_name: 'pan_number',            display_label: 'PAN Number',                  field_type: 'text',     is_mandatory: true,  display_order: 4, placeholder: '10-character PAN' },
    { field_name: 'pan_card',              display_label: 'PAN Card (upload)',           field_type: 'file',     is_mandatory: false, display_order: 5 },
    { field_name: 'is_msme_registered',    display_label: 'Is MSME Registered',          field_type: 'checkbox', is_mandatory: false, display_order: 6 },
    { field_name: 'udyam_number',          display_label: 'Udyam Number',                field_type: 'text',     is_mandatory: false, display_order: 7 },
    { field_name: 'msme_certificate',      display_label: 'MSME Certificate (upload)',   field_type: 'file',     is_mandatory: false, display_order: 8 },
    { field_name: 'bank_account_number',   display_label: 'Bank Account Number',         field_type: 'text',     is_mandatory: true,  display_order: 9 },
    { field_name: 'bank_ifsc',             display_label: 'IFSC Code',                   field_type: 'text',     is_mandatory: true,  display_order: 10 },
    { field_name: 'bank_name',             display_label: 'Bank Name',                   field_type: 'text',     is_mandatory: true,  display_order: 11 },
    { field_name: 'cancelled_cheque',      display_label: 'Cancelled Cheque (upload)',   field_type: 'file',     is_mandatory: false, display_order: 12 },
  ],

  organization: [
    { field_name: 'buyerCompanyId',        display_label: 'Buyer Company',               field_type: 'select',     is_mandatory: true,  display_order: 1 },
    { field_name: 'legalName',             display_label: 'Legal Name of Organization',  field_type: 'text',       is_mandatory: true,  display_order: 2, placeholder: 'Enter registered company name' },
    { field_name: 'tradeName',             display_label: 'Trade Name / Brand Name',     field_type: 'text',       is_mandatory: false, display_order: 3 },
    { field_name: 'industryType',          display_label: 'Type of Industry',            field_type: 'select',     is_mandatory: true,  display_order: 4 },
    { field_name: 'organizationType',      display_label: 'Type of Organization',        field_type: 'select',     is_mandatory: true,  display_order: 5 },
    { field_name: 'ownershipType',         display_label: 'Type of Ownership',           field_type: 'select',     is_mandatory: true,  display_order: 6 },
    { field_name: 'productCategories',     display_label: 'Product/Service Categories',  field_type: 'multi-select', is_mandatory: true, display_order: 7 },
    { field_name: 'productCategoriesOther', display_label: 'Other Product Categories',   field_type: 'text',       is_mandatory: false, display_order: 8 },
    { field_name: 'state',                 display_label: 'State',                       field_type: 'select',     is_mandatory: true,  display_order: 9 },
    { field_name: 'entityType',            display_label: 'Entity Type',                 field_type: 'select',     is_mandatory: true,  display_order: 10 },
    { field_name: 'firmRegistrationNo',    display_label: 'Firm Registration No.',       field_type: 'text',       is_mandatory: false, display_order: 11 },
    { field_name: 'pfNumber',              display_label: 'PF Number',                   field_type: 'text',       is_mandatory: false, display_order: 12 },
    { field_name: 'esiNumber',             display_label: 'ESI Number',                  field_type: 'text',       is_mandatory: false, display_order: 13 },
    { field_name: 'labourPermitNo',        display_label: 'Labour Permit No.',           field_type: 'text',       is_mandatory: false, display_order: 14 },
    { field_name: 'iecNo',                 display_label: 'IEC No. (Import/Export)',     field_type: 'text',       is_mandatory: false, display_order: 15 },
    { field_name: 'swiftIbanCode',         display_label: 'SWIFT / IBAN Code',           field_type: 'text',       is_mandatory: false, display_order: 16 },
    { field_name: 'operationalNetwork',    display_label: 'Operational Network',         field_type: 'select',     is_mandatory: false, display_order: 17 },
    { field_name: 'memberships',           display_label: 'Memberships',                 field_type: 'multi-select', is_mandatory: false, display_order: 18 },
    { field_name: 'enlistments',           display_label: 'Enlistment With',             field_type: 'multi-select', is_mandatory: false, display_order: 19 },
    { field_name: 'certifications',        display_label: 'Certifications',              field_type: 'multi-select', is_mandatory: false, display_order: 20 },
  ],

  address: [
    { field_name: 'registeredAddress',     display_label: 'Registered Address Line 1',   field_type: 'text',     is_mandatory: true,  display_order: 1 },
    { field_name: 'registeredAddressLine2', display_label: 'Registered Address Line 2',  field_type: 'text',     is_mandatory: false, display_order: 2 },
    { field_name: 'registeredAddressLine3', display_label: 'Registered Address Line 3',  field_type: 'text',     is_mandatory: false, display_order: 3 },
    { field_name: 'registeredAddressLine4', display_label: 'Registered Address Line 4',  field_type: 'text',     is_mandatory: false, display_order: 4 },
    { field_name: 'registeredCity',        display_label: 'Registered City',             field_type: 'text',     is_mandatory: true,  display_order: 5 },
    { field_name: 'registeredState',       display_label: 'Registered State',            field_type: 'select',   is_mandatory: true,  display_order: 6 },
    { field_name: 'registeredPincode',     display_label: 'Registered Pincode',          field_type: 'text',     is_mandatory: true,  display_order: 7 },
    { field_name: 'registeredPhone',       display_label: 'Registered Phone',            field_type: 'phone',    is_mandatory: false, display_order: 8 },
    { field_name: 'registeredFax',         display_label: 'Registered Fax',              field_type: 'text',     is_mandatory: false, display_order: 9 },
    { field_name: 'registeredWebsite',     display_label: 'Registered Website',          field_type: 'text',     is_mandatory: false, display_order: 10 },
    { field_name: 'registeredEmail',       display_label: 'Registered Email',            field_type: 'email',    is_mandatory: true,  display_order: 11 },
    { field_name: 'sameAsRegistered',      display_label: 'Manufacturing Same as Registered', field_type: 'checkbox', is_mandatory: false, display_order: 12 },
    { field_name: 'manufacturingAddress',  display_label: 'Manufacturing Address Line 1', field_type: 'text',    is_mandatory: false, display_order: 13 },
    { field_name: 'manufacturingCity',     display_label: 'Manufacturing City',          field_type: 'text',     is_mandatory: false, display_order: 14 },
    { field_name: 'manufacturingState',    display_label: 'Manufacturing State',         field_type: 'select',   is_mandatory: false, display_order: 15 },
    { field_name: 'manufacturingPincode',  display_label: 'Manufacturing Pincode',       field_type: 'text',     is_mandatory: false, display_order: 16 },
    { field_name: 'manufacturingPhone',    display_label: 'Manufacturing Phone',         field_type: 'phone',    is_mandatory: false, display_order: 17 },
    { field_name: 'manufacturingEmail',    display_label: 'Manufacturing Email',         field_type: 'email',    is_mandatory: false, display_order: 18 },
    { field_name: 'branchName',            display_label: 'Branch Name',                 field_type: 'text',     is_mandatory: false, display_order: 19 },
    { field_name: 'branchAddress',         display_label: 'Branch Address Line 1',       field_type: 'text',     is_mandatory: false, display_order: 20 },
    { field_name: 'branchCity',            display_label: 'Branch City',                 field_type: 'text',     is_mandatory: false, display_order: 21 },
    { field_name: 'branchState',           display_label: 'Branch State',                field_type: 'select',   is_mandatory: false, display_order: 22 },
    { field_name: 'branchPincode',         display_label: 'Branch Pincode',              field_type: 'text',     is_mandatory: false, display_order: 23 },
    { field_name: 'branchCountry',         display_label: 'Branch Country',              field_type: 'text',     is_mandatory: false, display_order: 24 },
    { field_name: 'branchEmail',           display_label: 'Branch Email',                field_type: 'email',    is_mandatory: false, display_order: 25 },
    { field_name: 'branchContactName',     display_label: 'Branch Contact Name',         field_type: 'text',     is_mandatory: false, display_order: 26 },
    { field_name: 'branchContactPhone',    display_label: 'Branch Contact Phone',        field_type: 'phone',    is_mandatory: false, display_order: 27 },
    { field_name: 'branchContactEmail',    display_label: 'Branch Contact Email',        field_type: 'email',    is_mandatory: false, display_order: 28 },
  ],

  contact: [
    { field_name: 'ceoName',                  display_label: 'CEO/MD Name',              field_type: 'text',  is_mandatory: true,  display_order: 1 },
    { field_name: 'ceoDesignation',           display_label: 'CEO/MD Designation',       field_type: 'text',  is_mandatory: false, display_order: 2 },
    { field_name: 'ceoPhone',                 display_label: 'CEO/MD Contact Number 1',  field_type: 'phone', is_mandatory: true,  display_order: 3 },
    { field_name: 'ceoEmail',                 display_label: 'CEO/MD Email Address 1',   field_type: 'email', is_mandatory: true,  display_order: 4 },
    { field_name: 'ceoPhone2',                display_label: 'CEO/MD Contact Number 2',  field_type: 'phone', is_mandatory: false, display_order: 5 },
    { field_name: 'ceoEmail2',                display_label: 'CEO/MD Email Address 2',   field_type: 'email', is_mandatory: false, display_order: 6 },
    { field_name: 'marketingName',            display_label: 'Marketing Contact Name',   field_type: 'text',  is_mandatory: false, display_order: 7 },
    { field_name: 'marketingDesignation',     display_label: 'Marketing Designation',    field_type: 'text',  is_mandatory: false, display_order: 8 },
    { field_name: 'marketingPhone',           display_label: 'Marketing Phone',          field_type: 'phone', is_mandatory: false, display_order: 9 },
    { field_name: 'marketingEmail',           display_label: 'Marketing Email',          field_type: 'email', is_mandatory: false, display_order: 10 },
    { field_name: 'productionName',           display_label: 'Production Contact Name',  field_type: 'text',  is_mandatory: false, display_order: 11 },
    { field_name: 'productionDesignation',    display_label: 'Production Designation',   field_type: 'text',  is_mandatory: false, display_order: 12 },
    { field_name: 'productionPhone',          display_label: 'Production Phone',         field_type: 'phone', is_mandatory: false, display_order: 13 },
    { field_name: 'productionEmail',          display_label: 'Production Email',         field_type: 'email', is_mandatory: false, display_order: 14 },
    { field_name: 'customerServiceName',      display_label: 'Customer Service Name',    field_type: 'text',  is_mandatory: false, display_order: 15 },
    { field_name: 'customerServiceDesignation', display_label: 'Customer Service Designation', field_type: 'text',  is_mandatory: false, display_order: 16 },
    { field_name: 'customerServicePhone',     display_label: 'Customer Service Phone',   field_type: 'phone', is_mandatory: false, display_order: 17 },
    { field_name: 'customerServiceEmail',     display_label: 'Customer Service Email',   field_type: 'email', is_mandatory: false, display_order: 18 },
  ],

  financial: [
    { field_name: 'annualTurnover',     display_label: 'Annual Turnover',          field_type: 'text',     is_mandatory: true,  display_order: 1 },
    { field_name: 'netWorth',           display_label: 'Net Worth',                field_type: 'text',     is_mandatory: false, display_order: 2 },
    { field_name: 'yearsInBusiness',    display_label: 'Years in Business',        field_type: 'number',   is_mandatory: false, display_order: 3 },
    { field_name: 'numberOfEmployees',  display_label: 'Number of Employees',      field_type: 'number',   is_mandatory: false, display_order: 4 },
    { field_name: 'facilitySize',       display_label: 'Facility Size (sq.ft)',    field_type: 'number',   is_mandatory: false, display_order: 5 },
    { field_name: 'productionCapacity', display_label: 'Production Capacity',      field_type: 'text',     is_mandatory: false, display_order: 6 },
    { field_name: 'qualityCertified',   display_label: 'Quality Certified',        field_type: 'checkbox', is_mandatory: false, display_order: 7 },
    { field_name: 'safetyCertified',    display_label: 'Safety Certified',         field_type: 'checkbox', is_mandatory: false, display_order: 8 },
    { field_name: 'environmentCertified', display_label: 'Environment Certified',  field_type: 'checkbox', is_mandatory: false, display_order: 9 },
  ],
};

/**
 * Marker stored in `default_value` so we can recognise auto-seeded built-in
 * field rows later (e.g. for the Built-in badge and "Restore defaults" button).
 */
export const BUILT_IN_FIELD_MARKER = '__builtin__';

export function isBuiltInField(field: { field_name: string; step_name: string; default_value?: string | null }): boolean {
  if (field.default_value === BUILT_IN_FIELD_MARKER) return true;
  const catalog = BUILT_IN_FIELDS_CATALOG[field.step_name];
  return !!catalog?.some((c) => c.field_name === field.field_name);
}
