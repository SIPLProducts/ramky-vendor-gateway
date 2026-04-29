/**
 * Catalog of every field that today is HARDCODED inside the vendor
 * registration step components. The Form Builder uses this catalog to:
 *   1. Show admins the real list of fields that already exist on each
 *      built-in tab (Document Verification, Organization Profile, etc.).
 *   2. Let admins hide a built-in field (writes an override row in
 *      `form_field_configs` with is_visible=false) or restore a default
 *      (deletes the override row).
 *
 * The vendor step components read these overrides via
 * `useBuiltInFieldOverrides()` and skip rendering / loosen validation for
 * any field marked invisible.
 *
 * Marker on override rows: default_value === BUILTIN_OVERRIDE_MARK lets us
 * distinguish admin-edits-of-builtins from genuinely custom fields.
 */

export const BUILTIN_OVERRIDE_MARK = '__builtin_override__';

export interface BuiltInField {
  field_name: string;
  display_label: string;
  field_type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'multi-select' | 'checkbox' | 'file';
  is_mandatory: boolean;
  /** When true the vendor step depends on this field for verification / gating
   *  and we do NOT allow hiding it from the Form Builder. */
  locked?: boolean;
  group?: string;
  placeholder?: string;
  help_text?: string;
}

export const BUILT_IN_FIELDS: Record<string, BuiltInField[]> = {
  // ---------- Document Verification (locked — drives OCR + verification) ----------
  document_verification: [
    { field_name: 'is_gst_registered',  display_label: 'GST Registered?',           field_type: 'checkbox', is_mandatory: true,  locked: true, group: 'GST' },
    { field_name: 'gst_certificate',    display_label: 'GST Certificate',           field_type: 'file',     is_mandatory: true,  locked: true, group: 'GST' },
    { field_name: 'gstin',              display_label: 'GSTIN',                     field_type: 'text',     is_mandatory: true,  locked: true, group: 'GST' },
    { field_name: 'legal_name_gst',     display_label: 'Legal Name (per GST)',      field_type: 'text',     is_mandatory: true,  locked: true, group: 'GST' },
    { field_name: 'trade_name',         display_label: 'Trade Name',                field_type: 'text',     is_mandatory: false, locked: true, group: 'GST' },
    { field_name: 'principal_place',    display_label: 'Principal Place of Business', field_type: 'textarea', is_mandatory: true, locked: true, group: 'GST' },
    { field_name: 'gst_self_declaration', display_label: 'GST Self-Declaration (if not registered)', field_type: 'file', is_mandatory: false, locked: true, group: 'GST' },

    { field_name: 'pan_card',           display_label: 'PAN Card',                  field_type: 'file',     is_mandatory: true,  locked: true, group: 'PAN' },
    { field_name: 'pan_number',         display_label: 'PAN Number',                field_type: 'text',     is_mandatory: true,  locked: true, group: 'PAN' },
    { field_name: 'pan_holder_name',    display_label: 'PAN Holder Name',           field_type: 'text',     is_mandatory: true,  locked: true, group: 'PAN' },

    { field_name: 'is_msme_registered', display_label: 'MSME Registered?',          field_type: 'checkbox', is_mandatory: true,  locked: true, group: 'MSME' },
    { field_name: 'msme_certificate',   display_label: 'MSME / Udyam Certificate',  field_type: 'file',     is_mandatory: false, locked: true, group: 'MSME' },
    { field_name: 'udyam_number',       display_label: 'Udyam Number',              field_type: 'text',     is_mandatory: false, locked: true, group: 'MSME' },
    { field_name: 'enterprise_name',    display_label: 'Enterprise Name',           field_type: 'text',     is_mandatory: false, locked: true, group: 'MSME' },

    { field_name: 'cancelled_cheque',   display_label: 'Cancelled Cheque',          field_type: 'file',     is_mandatory: true,  locked: true, group: 'Bank' },
    { field_name: 'bank_account_number',display_label: 'Bank Account Number',       field_type: 'text',     is_mandatory: true,  locked: true, group: 'Bank' },
    { field_name: 'bank_ifsc',          display_label: 'IFSC Code',                 field_type: 'text',     is_mandatory: true,  locked: true, group: 'Bank' },
    { field_name: 'bank_name',          display_label: 'Bank Name',                 field_type: 'text',     is_mandatory: true,  locked: true, group: 'Bank' },
    { field_name: 'bank_branch',        display_label: 'Branch Name',               field_type: 'text',     is_mandatory: true,  locked: true, group: 'Bank' },
    { field_name: 'bank_account_holder',display_label: 'Account Holder Name',       field_type: 'text',     is_mandatory: true,  locked: true, group: 'Bank' },
    { field_name: 'bank_account_type',  display_label: 'Account Type',              field_type: 'select',   is_mandatory: true,  locked: true, group: 'Bank' },
    { field_name: 'bank_branch_address',display_label: 'Branch Address',            field_type: 'textarea', is_mandatory: false, locked: true, group: 'Bank' },
  ],

  // ---------- Organization Profile ----------
  organization: [
    { field_name: 'buyerCompanyId',     display_label: 'Buyer Company',             field_type: 'select',       is_mandatory: true,  locked: true, group: 'Organization' },
    { field_name: 'legalName',          display_label: 'Legal Name of Organization',field_type: 'text',         is_mandatory: true,  locked: true, group: 'Organization' },
    { field_name: 'tradeName',          display_label: 'Trade Name / Brand Name',   field_type: 'text',         is_mandatory: false, group: 'Organization' },
    { field_name: 'industryType',       display_label: 'Type of Industry',          field_type: 'select',       is_mandatory: true,  group: 'Organization' },
    { field_name: 'organizationType',   display_label: 'Type of Organization',      field_type: 'select',       is_mandatory: true,  group: 'Organization' },
    { field_name: 'ownershipType',      display_label: 'Type of Ownership',         field_type: 'select',       is_mandatory: true,  group: 'Organization' },
    { field_name: 'productCategories',  display_label: 'Product/Service Categories',field_type: 'multi-select', is_mandatory: true,  group: 'Organization' },
    { field_name: 'state',              display_label: 'State',                     field_type: 'select',       is_mandatory: true,  group: 'Organization' },

    { field_name: 'entityType',         display_label: 'Entity Type',               field_type: 'select', is_mandatory: true,  group: 'Statutory' },
    { field_name: 'firmRegistrationNo', display_label: 'Firm Registration No.',     field_type: 'text',   is_mandatory: false, group: 'Statutory' },
    { field_name: 'pfNumber',           display_label: 'PF Number',                 field_type: 'text',   is_mandatory: false, group: 'Statutory' },
    { field_name: 'esiNumber',          display_label: 'ESI Number',                field_type: 'text',   is_mandatory: false, group: 'Statutory' },
    { field_name: 'labourPermitNo',     display_label: 'Labour Permit No.',         field_type: 'text',   is_mandatory: false, group: 'Statutory' },
    { field_name: 'iecNo',              display_label: 'IEC No. (Import/Export)',   field_type: 'text',   is_mandatory: false, group: 'Statutory' },
    { field_name: 'swiftIbanCode',      display_label: 'SWIFT / IBAN Code',         field_type: 'text',   is_mandatory: false, group: 'Statutory' },
    { field_name: 'iecCertificateFile', display_label: 'IEC Certificate (file)',    field_type: 'file',   is_mandatory: false, group: 'Statutory' },
    { field_name: 'swiftIbanProofFile', display_label: 'SWIFT / IBAN Proof (file)', field_type: 'file',   is_mandatory: false, group: 'Statutory' },
    { field_name: 'operationalNetwork', display_label: 'Operational Network',       field_type: 'select', is_mandatory: false, group: 'Statutory' },

    { field_name: 'memberships',        display_label: 'Memberships',               field_type: 'multi-select', is_mandatory: false, group: 'Memberships' },
    { field_name: 'enlistments',        display_label: 'Enlistment With',           field_type: 'multi-select', is_mandatory: false, group: 'Memberships' },
    { field_name: 'certifications',     display_label: 'Certifications',            field_type: 'multi-select', is_mandatory: false, group: 'Memberships' },
  ],

  // ---------- Address Information ----------
  address: [
    { field_name: 'registeredAddress',       display_label: 'Registered: Address Line 1', field_type: 'text',   is_mandatory: true,  group: 'Registered Office' },
    { field_name: 'registeredAddressLine2',  display_label: 'Registered: Address Line 2', field_type: 'text',   is_mandatory: false, group: 'Registered Office' },
    { field_name: 'registeredAddressLine3',  display_label: 'Registered: Address Line 3', field_type: 'text',   is_mandatory: false, group: 'Registered Office' },
    { field_name: 'registeredAddressLine4',  display_label: 'Registered: Address Line 4', field_type: 'text',   is_mandatory: false, group: 'Registered Office' },
    { field_name: 'registeredCity',          display_label: 'Registered: City',           field_type: 'text',   is_mandatory: true,  group: 'Registered Office' },
    { field_name: 'registeredState',         display_label: 'Registered: State',          field_type: 'select', is_mandatory: true,  group: 'Registered Office' },
    { field_name: 'registeredPincode',       display_label: 'Registered: PIN Code',       field_type: 'text',   is_mandatory: true,  group: 'Registered Office' },
    { field_name: 'registeredPhone',         display_label: 'Registered: Office Phone',   field_type: 'phone',  is_mandatory: false, group: 'Registered Office' },
    { field_name: 'registeredFax',           display_label: 'Registered: Fax',            field_type: 'text',   is_mandatory: false, group: 'Registered Office' },
    { field_name: 'registeredWebsite',       display_label: 'Registered: Website',        field_type: 'text',   is_mandatory: false, group: 'Registered Office' },
    { field_name: 'registeredEmail',         display_label: 'Registered: Email',          field_type: 'email',  is_mandatory: true,  group: 'Registered Office' },

    { field_name: 'sameAsRegistered',        display_label: 'Manufacturing same as registered', field_type: 'checkbox', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingAddress',    display_label: 'Manufacturing: Address Line 1', field_type: 'text', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingAddressLine2', display_label: 'Manufacturing: Address Line 2', field_type: 'text', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingAddressLine3', display_label: 'Manufacturing: Address Line 3', field_type: 'text', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingAddressLine4', display_label: 'Manufacturing: Address Line 4', field_type: 'text', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingCity',       display_label: 'Manufacturing: City',           field_type: 'text', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingState',      display_label: 'Manufacturing: State',          field_type: 'select', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingPincode',    display_label: 'Manufacturing: PIN Code',       field_type: 'text', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingPhone',      display_label: 'Manufacturing: Office Phone',   field_type: 'phone', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingFax',        display_label: 'Manufacturing: Fax',            field_type: 'text', is_mandatory: false, group: 'Manufacturing' },
    { field_name: 'manufacturingEmail',      display_label: 'Manufacturing: Email',          field_type: 'email', is_mandatory: false, group: 'Manufacturing' },

    { field_name: 'branchName',              display_label: 'Branch: Name',                  field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchWebsite',           display_label: 'Branch: Website',               field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchEmail',             display_label: 'Branch: Email',                 field_type: 'email', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchAddress',           display_label: 'Branch: Address Line 1',        field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchAddressLine2',      display_label: 'Branch: Address Line 2',        field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchAddressLine3',      display_label: 'Branch: Address Line 3',        field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchAddressLine4',      display_label: 'Branch: Address Line 4',        field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchCity',              display_label: 'Branch: City',                  field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchState',             display_label: 'Branch: State',                 field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchPincode',           display_label: 'Branch: PIN Code',              field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchCountry',           display_label: 'Branch: Country',               field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchContactName',       display_label: 'Branch Contact: Name',          field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchContactDesignation',display_label: 'Branch Contact: Designation',   field_type: 'text', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchContactEmail',      display_label: 'Branch Contact: Email',         field_type: 'email', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchContactPhone',      display_label: 'Branch Contact: Phone',         field_type: 'phone', is_mandatory: false, group: 'Branch' },
    { field_name: 'branchContactFax',        display_label: 'Branch Contact: Fax',           field_type: 'text', is_mandatory: false, group: 'Branch' },
  ],

  // ---------- Contact Details ----------
  contact: [
    { field_name: 'ceoName',                 display_label: 'CEO / MD: Name',                field_type: 'text',  is_mandatory: true,  group: 'CEO / MD' },
    { field_name: 'ceoDesignation',          display_label: 'CEO / MD: Designation',         field_type: 'text',  is_mandatory: false, group: 'CEO / MD' },
    { field_name: 'ceoPhone',                display_label: 'CEO / MD: Contact Number 1',    field_type: 'phone', is_mandatory: true,  group: 'CEO / MD' },
    { field_name: 'ceoEmail',                display_label: 'CEO / MD: Email Address 1',     field_type: 'email', is_mandatory: true,  group: 'CEO / MD' },
    { field_name: 'ceoPhone2',               display_label: 'CEO / MD: Contact Number 2',    field_type: 'phone', is_mandatory: false, group: 'CEO / MD' },
    { field_name: 'ceoEmail2',               display_label: 'CEO / MD: Email Address 2',     field_type: 'email', is_mandatory: false, group: 'CEO / MD' },

    { field_name: 'marketingName',           display_label: 'Marketing: Name',               field_type: 'text',  is_mandatory: false, group: 'Marketing / Sales' },
    { field_name: 'marketingDesignation',    display_label: 'Marketing: Designation',        field_type: 'text',  is_mandatory: false, group: 'Marketing / Sales' },
    { field_name: 'marketingPhone',          display_label: 'Marketing: Contact Number',     field_type: 'phone', is_mandatory: false, group: 'Marketing / Sales' },
    { field_name: 'marketingEmail',          display_label: 'Marketing: Email',              field_type: 'email', is_mandatory: false, group: 'Marketing / Sales' },

    { field_name: 'productionName',          display_label: 'Production: Name',              field_type: 'text',  is_mandatory: false, group: 'Production' },
    { field_name: 'productionDesignation',   display_label: 'Production: Designation',       field_type: 'text',  is_mandatory: false, group: 'Production' },
    { field_name: 'productionPhone',         display_label: 'Production: Contact Number',    field_type: 'phone', is_mandatory: false, group: 'Production' },
    { field_name: 'productionEmail',         display_label: 'Production: Email',             field_type: 'email', is_mandatory: false, group: 'Production' },

    { field_name: 'customerServiceName',     display_label: 'Customer Service: Name',        field_type: 'text',  is_mandatory: false, group: 'Customer Service' },
    { field_name: 'customerServiceDesignation', display_label: 'Customer Service: Designation', field_type: 'text', is_mandatory: false, group: 'Customer Service' },
    { field_name: 'customerServicePhone',    display_label: 'Customer Service: Contact Number', field_type: 'phone', is_mandatory: false, group: 'Customer Service' },
    { field_name: 'customerServiceEmail',    display_label: 'Customer Service: Email',       field_type: 'email', is_mandatory: false, group: 'Customer Service' },
  ],

  // ---------- Financial & Infrastructure ----------
  financial: [
    { field_name: 'turnoverYear1',           display_label: 'Turnover (Year 1)',             field_type: 'number', is_mandatory: false, group: 'Financial' },
    { field_name: 'turnoverYear2',           display_label: 'Turnover (Year 2)',             field_type: 'number', is_mandatory: false, group: 'Financial' },
    { field_name: 'turnoverYear3',           display_label: 'Turnover (Year 3)',             field_type: 'number', is_mandatory: false, group: 'Financial' },
    { field_name: 'creditPeriodExpected',    display_label: 'Expected Credit Period (Days)', field_type: 'number', is_mandatory: false, group: 'Financial' },
    { field_name: 'financialDocsFile',       display_label: 'Audited Financial Statements (file)', field_type: 'file', is_mandatory: false, group: 'Financial' },
    { field_name: 'majorCustomer1',          display_label: 'Major Customer 1',              field_type: 'text', is_mandatory: false, group: 'Customers' },
    { field_name: 'majorCustomer2',          display_label: 'Major Customer 2',              field_type: 'text', is_mandatory: false, group: 'Customers' },
    { field_name: 'majorCustomer3',          display_label: 'Major Customer 3',              field_type: 'text', is_mandatory: false, group: 'Customers' },
    { field_name: 'authorizedDistributorName',    display_label: 'Authorized Distributor Name',    field_type: 'text', is_mandatory: false, group: 'Distributor' },
    { field_name: 'authorizedDistributorAddress', display_label: 'Authorized Distributor Address', field_type: 'text', is_mandatory: false, group: 'Distributor' },
    { field_name: 'dealershipCertificateFile',    display_label: 'Dealership Certificate (file)',  field_type: 'file', is_mandatory: false, group: 'Distributor' },

    { field_name: 'rawMaterialsUsed',        display_label: 'Raw Materials Used',            field_type: 'text', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'machineryAvailability',   display_label: 'Machinery Availability',        field_type: 'text', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'equipmentAvailability',   display_label: 'Equipment Availability',        field_type: 'text', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'powerSupply',             display_label: 'Power Supply (KV/MW)',          field_type: 'text', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'waterSupply',             display_label: 'Water Supply',                  field_type: 'select', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'dgCapacity',              display_label: 'DG Capacity (KV)',              field_type: 'text', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'productionCapacity',      display_label: 'Production Capacity',           field_type: 'text', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'storeCapacity',           display_label: 'Store Capacity',                field_type: 'text', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'supplyCapacity',          display_label: 'Supply Capacity',               field_type: 'text', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'manpower',                display_label: 'Manpower',                      field_type: 'text', is_mandatory: false, group: 'Manufacturing Facility' },
    { field_name: 'inspectionTesting',       display_label: 'Inspection & Testing',          field_type: 'select', is_mandatory: false, group: 'Manufacturing Facility' },

    { field_name: 'nearestRailway',          display_label: 'Nearest Railway Station',       field_type: 'text', is_mandatory: false, group: 'Connectivity' },
    { field_name: 'nearestBusStation',       display_label: 'Nearest Bus Station',           field_type: 'text', is_mandatory: false, group: 'Connectivity' },
    { field_name: 'nearestAirport',          display_label: 'Nearest Airport',               field_type: 'text', is_mandatory: false, group: 'Connectivity' },
    { field_name: 'nearestPort',             display_label: 'Nearest Port',                  field_type: 'text', is_mandatory: false, group: 'Connectivity' },

    { field_name: 'productTypes',            display_label: 'Type of Products',              field_type: 'multi-select', is_mandatory: false, group: 'Products' },
    { field_name: 'productionFacilities',    display_label: 'Production Facilities',         field_type: 'multi-select', is_mandatory: false, group: 'Products' },
    { field_name: 'leadTimeRequired',        display_label: 'Lead Time Required',            field_type: 'text', is_mandatory: false, group: 'Products' },

    { field_name: 'qualityIssues',           display_label: 'Quality Issues',                field_type: 'textarea', is_mandatory: false, group: 'QHSE' },
    { field_name: 'healthIssues',            display_label: 'Health Issues',                 field_type: 'textarea', is_mandatory: false, group: 'QHSE' },
    { field_name: 'environmentalIssues',     display_label: 'Environmental Issues',          field_type: 'textarea', is_mandatory: false, group: 'QHSE' },
    { field_name: 'safetyIssues',            display_label: 'Safety Issues',                 field_type: 'textarea', is_mandatory: false, group: 'QHSE' },
  ],
};

export function getBuiltInFields(stepKey: string): BuiltInField[] {
  return BUILT_IN_FIELDS[stepKey] || [];
}

export function isBuiltInField(stepKey: string, fieldName: string): boolean {
  return (BUILT_IN_FIELDS[stepKey] || []).some((f) => f.field_name === fieldName);
}
