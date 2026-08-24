// Vyapaar Portal Types - Enterprise Vendor Registration

export type VendorStatus =
  | 'draft'
  | 'submitted'
  | 'validation_pending'
  | 'validation_failed'
  | 'finance_review'
  | 'finance_approved'
  | 'finance_rejected'
  | 'purchase_review'
  | 'purchase_approved'
  | 'purchase_rejected'
  | 'scm_manager_review'
  | 'scm_manager_rejected'
  | 'scm_head_review'
  | 'scm_head_rejected'
  | 'finance_1_review'
  | 'finance_1_rejected'
  | 'finance_2_review'
  | 'finance_2_rejected'
  | 'ceo_office_review'
  | 'ceo_office_rejected'
  | 'pending_sap_sync'
  | 'returned_to_buyer'
  | 'returned_to_vendor'
  | 'sap_synced'
  | 'sap_team_rejected'
  | 'sap_team_closed';



export type ValidationStatus = 'pending' | 'passed' | 'failed' | 'skipped';

export interface ValidationResult {
  type: 'gst' | 'pan' | 'bank' | 'msme' | 'name_match';
  status: ValidationStatus;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

// Step 1: Organization Profile
export interface OrganizationDetails {
  buyerCompanyId: string;
  legalName: string;
  tradeName: string;
  industryType: string;
  organizationType: string;
  ownershipType: string;
  productCategories: string[];
  productCategoriesOther?: string;
  state: string;
  accountingGroup?: 'Import' | 'Domestic' | '';
  // SAP Classification (multi-select)
  materialGroupVendor?: string[];
  vendorCategory?: string[];
  vendorLocation?: string[];
  identificationSource?: string[];
}

export const ACCOUNTING_GROUPS = ['Import', 'Domestic'] as const;

export const VENDOR_CATEGORIES = [
  'TRADER',
  'MANUFACTURER',
  'SERVICE PROVIDER',
  'DISTRIBUTOR',
  'CONTRACTOR',
] as const;

export const IDENTIFICATION_SOURCES = [
  'PRINT MEDIA',
  'ONLINE',
  'REFERENCE',
  'TRADE FAIR',
  'EXISTING VENDOR',
  'OTHER',
] as const;

// Step 2: Contact Details (Address Information renamed)
export interface AddressDetails {
  registeredAddress: string;
  registeredAddressLine2: string;
  registeredAddressLine3: string;
  registeredAddressLine4: string;
  registeredCity: string;
  registeredState: string;
  registeredPincode: string;
  registeredPhone: string;
  registeredFax: string;
  registeredWebsite: string;
  registeredEmail: string;
  registeredContact1: string;
  registeredContact2: string;
  registeredEmail2: string;
  
  manufacturingAddress: string;
  manufacturingAddressLine2: string;
  manufacturingAddressLine3: string;
  manufacturingAddressLine4: string;
  manufacturingCity: string;
  manufacturingState: string;
  manufacturingPincode: string;
  manufacturingPhone: string;
  manufacturingFax: string;
  manufacturingEmail: string;
  sameAsRegistered: boolean;
  
  branchName: string;
  branchAddress: string;
  branchAddressLine2: string;
  branchAddressLine3: string;
  branchAddressLine4: string;
  branchCity: string;
  branchState: string;
  branchPincode: string;
  branchCountry: string;
  branchWebsite: string;
  branchEmail: string;
  branchContactName: string;
  branchContactDesignation: string;
  branchContactEmail: string;
  branchContactPhone: string;
  branchContactFax: string;
}

// Step 3: Contact Information
export interface ContactDetails {
  // CEO/MD Contact
  ceoName: string;
  ceoDesignation: string;
  ceoPhone: string;
  ceoEmail: string;
  ceoPhone2?: string;
  ceoEmail2?: string;
  
  // Marketing/Sales Contact
  marketingName: string;
  marketingDesignation: string;
  marketingPhone: string;
  marketingEmail: string;
  
  // Production Contact
  productionName: string;
  productionDesignation: string;
  productionPhone: string;
  productionEmail: string;
  
  // Customer Service Contact
  customerServiceName: string;
  customerServiceDesignation: string;
  customerServicePhone: string;
  customerServiceEmail: string;
}

// Step 4: Compliance & Statutory
export interface StatutoryDetails {
  firmRegistrationNo: string;
  pan: string;
  pfNumber: string;
  esiNumber: string;
  // GST registration flag + conditional fields
  isGstRegistered: boolean;
  gstin: string;
  gstDeclarationReason: string;
  gstSelfDeclarationFile: File | null;
  // Extended GST certificate fields (auto-populated from OCR/API)
  gstConstitutionOfBusiness: string;
  gstPrincipalPlaceOfBusiness: string;
  gstAdditionalPlaces: string[];
  gstRegistrationDate: string;
  gstStatus: string;
  gstTaxpayerType: string;
  gstBusinessNature: string[];
  gstJurisdictionCentre: string;
  gstJurisdictionState: string;
  // GST filing-status response captured during Step 1 verification.
  // Persisted into vendor_validations on save so the Approval View can render
  // the same table the vendor saw during registration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gstFilingStatus?: any[];
  // MSME registration flag + conditional fields
  isMsmeRegistered: boolean;
  msmeNumber: string;
  msmeCategory: 'micro' | 'small' | 'medium' | '';
  /** Enterprise name as printed on the Udyam certificate (auto-filled from OCR). */
  msmeEnterpriseName?: string;
  /** Major activity (Manufacturing / Services) from the Udyam certificate. */
  msmeMajorActivity?: string;
  msmeDeclarationReason?: string;
  msmeSelfDeclarationFile?: File | null;
  labourPermitNo: string;
  iecNo: string;
  swiftIbanCode: string;
  entityType: string;

  memberships: string[];
  enlistments: string[];
  certifications: string[];
  operationalNetwork: string;

  gstCertificateFile: File | null;
  panCardFile: File | null;
  msmeCertificateFile: File | null;
  iecCertificateFile: File | null;
  swiftIbanProofFile: File | null;

  /** From PAN Comprehensive API — raw `status` value (e.g. "valid"). */
  panStatus?: string | null;
  /** From PAN Comprehensive API — raw `aadhaar_linked` boolean. */
  panAadhaarLinked?: boolean | null;
  /** ISO timestamp of the last PAN Comprehensive API call. */
  panComprehensiveVerifiedAt?: string | null;
  /** Name registered against this PAN (from OCR + PAN Comprehensive API). */
  panHolderName?: string | null;
}

// Step 5: Bank Details
export interface SecondaryBankDetails {
  enabled: boolean;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountType: 'current' | 'savings' | 'cash_credit' | 'others';
  ifscCode: string;
  micrCode: string;
  bankAddress: string;
  accountHolderName: string;
  cancelledChequeFile: File | null;
}

export interface BankDetails {
  bankName: string;
  branchName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  accountType: 'current' | 'savings' | 'cash_credit' | 'others';
  accountTypeOther: string;
  ifscCode: string;
  micrCode: string;
  bankAddress: string;
  /** Account holder name (auto-filled from the cancelled cheque OCR). */
  accountHolderName?: string;
  cancelledChequeFile: File | null;
  /** Optional secondary bank account — same verification flow */
  secondary?: SecondaryBankDetails;
}

// Step 6: Financial Information
export interface FinancialDetails {
  turnoverYear1: string;
  turnoverYear2: string;
  turnoverYear3: string;
  creditPeriodExpected: string;
  
  majorCustomer1: string;
  majorCustomer2: string;
  majorCustomer3: string;
  
  authorizedDistributorName: string;
  authorizedDistributorAddress: string;
  dealershipCertificateFile: File | null;
  financialDocsFile: File | null;
}

// Step 7: Infrastructure & Manufacturing
export interface InfrastructureDetails {
  rawMaterialsUsed: string;
  machineryAvailability: string;
  equipmentAvailability: string;
  powerSupply: string;
  waterSupply: string;
  dgCapacity: string;
  productionCapacity: string;
  storeCapacity: string;
  supplyCapacity: string;
  manpower: string;
  inspectionTesting: string;
  
  nearestRailway: string;
  nearestBusStation: string;
  nearestAirport: string;
  nearestPort: string;
  
  productTypes: string[];
  productTypesOther: string;
  
  productionFacilities: string[];
  leadTimeRequired: string;
}

// Step 8: QHSE (Quality, Health, Safety, Environment)
export interface QHSEDetails {
  qualityIssues: string;
  healthIssues: string;
  environmentalIssues: string;
  safetyIssues: string;
}

export type VendorOriginType = 'domestic' | 'international';

export interface InternationalDocuments {
  registrationCopyFile: File | null;
  swiftIbanFile: File | null;
}

export interface InternationalCompanyDetails {
  companyName: string;
  // Address block (mirrors domestic Registered Address structure)
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  city: string;
  pincode: string;
  officePhone: string;
  fax: string;
  // Legacy single-line address kept for backward compatibility with older
  // saved records; new code writes the joined value here and reads from
  // addressLine1..4 first.
  companyAddress: string;
  country: string;
  region: string;
  contact1: string;
  contact2: string;
  email1: string;
  email2: string;
}

export interface InternationalBankDetails {
  accountNumber: string;
  swiftCode: string;
  companyName: string;
  bankName: string;
  bankBranch: string;
  ibanNumber: string;
  bankCountry?: string;
}

export interface InternationalClassification {
  materialGroupVendor: string[];
  vendorCategory: string[];
  vendorLocation: string[];
  identificationSource: string[];
}

export interface InternationalData {
  documents: InternationalDocuments;
  company: InternationalCompanyDetails;
  bank: InternationalBankDetails;
  classification: InternationalClassification;
}

export const EMPTY_INTERNATIONAL_DATA: InternationalData = {
  documents: { registrationCopyFile: null, swiftIbanFile: null },
  company: {
    companyName: '',
    addressLine1: '', addressLine2: '', addressLine3: '', addressLine4: '',
    city: '', pincode: '', officePhone: '', fax: '',
    companyAddress: '', country: '', region: '',
    contact1: '', contact2: '', email1: '', email2: '',
  },
  bank: {
    accountNumber: '', swiftCode: '', companyName: '',
    bankName: '', bankBranch: '', ibanNumber: '',
  },
  classification: {
    materialGroupVendor: [], vendorCategory: [], vendorLocation: [], identificationSource: [],
  },
};

export interface VendorFormData {
  vendorType: VendorOriginType;
  organization: OrganizationDetails;
  address: AddressDetails;
  contact: ContactDetails;
  statutory: StatutoryDetails;
  bank: BankDetails;
  financial: FinancialDetails;
  infrastructure: InfrastructureDetails;
  qhse: QHSEDetails;
  international?: InternationalData;
  declaration: {
    selfDeclared: boolean;
    termsAccepted: boolean;
  };
}

export interface Vendor {
  id: string;
  formData: VendorFormData;
  status: VendorStatus;
  validations: ValidationResult[];
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  linkExpiry: string;
  financeReviewedBy: string | null;
  financeReviewedAt: string | null;
  financeComments: string | null;
  purchaseReviewedBy: string | null;
  purchaseReviewedAt: string | null;
  purchaseComments: string | null;
  sapVendorCode: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'vendor' | 'finance' | 'purchase' | 'admin';
}

// Constants from PDF form
export const INDUSTRY_TYPES = [
  'Manufacturer',
  'Distributor',
  'OEM',
  'C & F Agent',
  'Trading',
  'Service Provider',
  'Consultant',
  'Other',
] as const;

export const ORGANIZATION_TYPES = [
  'Individual',
  'SSI (Small Scale Industry)',
  'MSI (Medium Scale Industry)',
  'Private Limited',
  'Public Limited',
  'State Government',
  'Central Government',
  'PSU (Public Sector Undertaking)',
] as const;

export const OWNERSHIP_TYPES = [
  'Sole Proprietor',
  'Partnership',
  'Board of Directors',
  'Government',
  'Joint Venture',
] as const;

export const PRODUCT_CATEGORIES = [
  'Aggregates',
  'Bearings',
  'Cables & Wires',
  'Castings & Forgings',
  'Cement',
  'Clearing & Forwarding Agent',
  'Conductors',
  'Construction Chemicals',
  'Construction Equipment',
  'Doors & Windows',
  'Electrical Items',
  'Electrical Equipment',
  'Equipment',
  'Fabrication',
  'Floorings & Roofing',
  'Hardware',
  'HVAC',
  'Instruments',
  'Lab Equipment',
  'Material Handling Equipment',
  'Office Equipment & Stationery',
  'Oils & Lubricants',
  'Paints',
  'Pipes',
  'Power Tools',
  'Pumps',
  'PVC, HDPE, Rubber Products',
  'RCC/Hume Pipes',
  'Safety Items',
  'Scrap Dealer',
  'Service Provider',
  'Spares',
  'Steel',
  'Timber & Plywood',
  'Transporter',
  'Tyres',
  'Valves & Pipe Fittings',
  'Welding & Welding Accessories',
  'Wireropes & PC Strands',
  'Others',
] as const;

export const PRODUCT_TYPES = [
  'Civil',
  'Electrical',
  'WTP (Water Treatment Plant)',
  'STP (Sewage Treatment Plant)',
  'P & M (Plant & Machinery)',
  'Petroleum',
  'Pharmaceutical',
  'Others',
] as const;

export const PRODUCTION_FACILITIES = [
  'Manufacturing Only',
  'Spares',
  'O & M (Operations & Maintenance)',
  'Design',
  'Installation',
  'Commissioning',
  'Third Party Inspection',
  'Transportation',
  'Others',
] as const;

export const MEMBERSHIP_OPTIONS = [
  'FICCI',
  'ASSOCHAM',
  'CII',
  'Others',
] as const;

export const ENLISTMENT_OPTIONS = [
  'State Government',
  'Central Government',
  'Defence',
  'PSU',
  'Others',
] as const;

export const CERTIFICATION_OPTIONS = [
  'ISO QMS 9001',
  'EMS 14001',
  'OHSAS 18001',
  'SA 8000',
  'Others',
] as const;

export const OPERATIONAL_NETWORKS = [
  'State-wide',
  'Nation-wide',
  'Zone-wise',
  'International',
] as const;

export const WATER_SUPPLY_TYPES = [
  'Municipal',
  'Ground',
  'Well',
  'River',
] as const;

export const INSPECTION_TYPES = [
  'In-house',
  'Second Party',
  'Third Party',
] as const;

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

// Official GSTN state codes (first 2 digits of GSTIN) → canonical state/UT name.
// Use this to deterministically resolve a vendor's registered state from their
// GSTIN; never infer state from free-form address text.
export const GST_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Dadra and Nagar Haveli and Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export const ENTITY_TYPES = [
  'Private Limited Company',
  'Public Limited Company',
  'Limited Liability Partnership (LLP)',
  'Partnership Firm',
  'Sole Proprietorship',
  'Hindu Undivided Family (HUF)',
  'Trust',
  'Society',
  'Government Entity',
  'Foreign Company',
] as const;
