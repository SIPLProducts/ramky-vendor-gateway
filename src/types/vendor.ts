// Vendor Portal Types

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

export interface OrganizationDetails {
  legalName: string;
  tradeName: string;
  registeredAddress: string;
  registeredCity: string;
  registeredState: string;
  registeredPincode: string;
  communicationAddress: string;
  communicationCity: string;
  communicationState: string;
  communicationPincode: string;
  sameAsRegistered: boolean;
  industryType: string;
  productCategories: string[];
}

export interface ContactDetails {
  primaryContactName: string;
  primaryDesignation: string;
  primaryEmail: string;
  primaryPhone: string;
  secondaryContactName: string;
  secondaryDesignation: string;
  secondaryEmail: string;
  secondaryPhone: string;
}

export interface StatutoryDetails {
  gstin: string;
  pan: string;
  msmeNumber: string;
  msmeCategory: 'micro' | 'small' | 'medium' | '';
  entityType: string;
  gstCertificateFile: File | null;
  panCardFile: File | null;
  msmeCertificateFile: File | null;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: 'current' | 'savings';
  cancelledChequeFile: File | null;
}

export interface FinancialDetails {
  turnoverYear1: string;
  turnoverYear2: string;
  turnoverYear3: string;
  creditPeriodExpected: string;
  financialDocsFile: File | null;
}

export interface VendorFormData {
  organization: OrganizationDetails;
  contact: ContactDetails;
  statutory: StatutoryDetails;
  bank: BankDetails;
  financial: FinancialDetails;
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

export const INDUSTRY_TYPES = [
  'Construction & Infrastructure',
  'Manufacturing',
  'Engineering Services',
  'Transportation & Logistics',
  'Raw Materials & Mining',
  'Environmental Services',
  'IT & Software',
  'Consulting & Professional Services',
  'Equipment & Machinery',
  'Other',
] as const;

export const PRODUCT_CATEGORIES = [
  'Civil Construction',
  'Electrical Works',
  'Mechanical Works',
  'HVAC Systems',
  'Plumbing & Sanitation',
  'Road & Highway',
  'Bridge & Flyover',
  'Water Treatment',
  'Waste Management',
  'Heavy Equipment',
  'Building Materials',
  'Steel & Metal',
  'Cement & Concrete',
  'Safety Equipment',
  'IT Services',
  'Consulting',
  'Manpower Services',
  'Transportation',
  'Other',
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
