// Vendor Portal Types - Enterprise Vendor Registration

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
  | 'sap_synced';

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
}

// Step 2: Address Information
export interface AddressDetails {
  registeredAddress: string;
  registeredAddressLine2: string;
  registeredAddressLine3: string;
  registeredCity: string;
  registeredState: string;
  registeredPincode: string;
  registeredPhone: string;
  registeredFax: string;
  registeredWebsite: string;
  
  manufacturingAddress: string;
  manufacturingAddressLine2: string;
  manufacturingAddressLine3: string;
  manufacturingCity: string;
  manufacturingState: string;
  manufacturingPincode: string;
  manufacturingPhone: string;
  manufacturingFax: string;
  sameAsRegistered: boolean;
  
  branchName: string;
  branchAddress: string;
  branchCity: string;
  branchState: string;
  branchPincode: string;
  branchCountry: string;
  branchWebsite: string;
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
  // MSME registration flag + conditional fields
  isMsmeRegistered: boolean;
  msmeNumber: string;
  msmeCategory: 'micro' | 'small' | 'medium' | '';
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
}

// Step 5: Bank Details
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
  cancelledChequeFile: File | null;
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

export interface VendorFormData {
  organization: OrganizationDetails;
  address: AddressDetails;
  contact: ContactDetails;
  statutory: StatutoryDetails;
  bank: BankDetails;
  financial: FinancialDetails;
  infrastructure: InfrastructureDetails;
  qhse: QHSEDetails;
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
