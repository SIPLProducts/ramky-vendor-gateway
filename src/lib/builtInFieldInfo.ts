/**
 * Admin-facing usage / importance copy for every built-in vendor-registration
 * field. Surfaced in the Form Builder's info popover (ⓘ) so admins understand
 * what each field captures and what breaks if they hide it.
 *
 * Keyed by `field_name`. Anything not listed falls back to a generic note.
 */

export interface BuiltInFieldInfo {
  usage: string;
  importance: string[];
}

const GENERIC_PROFILE: BuiltInFieldInfo = {
  usage: 'Profile information shown on the vendor master record.',
  importance: ['Display-only — safe to hide if not needed by your tenant'],
};

const ADDR_LINE: BuiltInFieldInfo = {
  usage: 'Additional line for a multi-line postal address.',
  importance: ['Optional — used only when the address spans multiple lines'],
};

export const BUILT_IN_FIELD_INFO: Record<string, BuiltInFieldInfo> = {
  // ---------- GST ----------
  is_gst_registered: {
    usage: 'Indicates whether the vendor holds an active GSTIN.',
    importance: [
      'Drives whether GSTIN / GST certificate fields are required',
      'Triggers self-declaration upload path when unticked',
    ],
  },
  gst_certificate: {
    usage: 'Scanned copy of the GST registration certificate issued by GSTN.',
    importance: [
      'OCR-extracted to auto-fill GSTIN, legal name and principal place',
      'Required document for SAP vendor master creation',
    ],
  },
  gstin: {
    usage: '15-character GST Identification Number issued by the GST portal.',
    importance: [
      'Verified live against the GST portal — hiding disables auto-fill of legal name & address',
      'Required by SAP master-data for tax computation',
      'Mandatory for B2B invoicing in India',
    ],
  },
  legal_name_gst: {
    usage: 'Registered legal name of the entity exactly as it appears on the GST certificate.',
    importance: [
      'Auto-filled from GSTIN verification; mismatch blocks approval',
      'Used as the primary legal name in SAP',
    ],
  },
  trade_name: {
    usage: 'Brand or trade name the vendor operates under, if different from legal name.',
    importance: ['Shown on POs and communications when present'],
  },
  principal_place: {
    usage: 'Principal place of business as registered on the GST certificate.',
    importance: [
      'Determines GST place-of-supply',
      'Compared against registered office address during review',
    ],
  },
  gst_self_declaration: {
    usage: 'Vendor declaration confirming non-GST-registered status.',
    importance: [
      'Required only when vendor is not GST-registered',
      'Replaces GSTIN for compliance audit trail',
    ],
  },

  // ---------- PAN ----------
  pan_card: {
    usage: 'Scanned copy of the Income Tax PAN card.',
    importance: [
      'OCR-extracted to auto-fill PAN number and holder name',
      'Mandatory KYC document for any Indian vendor',
    ],
  },
  pan_number: {
    usage: '10-character Permanent Account Number issued by Income Tax Dept.',
    importance: [
      'Verified against Income Tax records',
      'Used for TDS deduction and 26AS reconciliation',
      'Required field in SAP vendor master',
    ],
  },
  pan_holder_name: {
    usage: 'Name of the entity / individual exactly as printed on the PAN card.',
    importance: [
      'Cross-checked with GST legal name during approval',
      'Mismatch flagged for compliance review',
    ],
  },

  // ---------- MSME ----------
  is_msme_registered: {
    usage: 'Indicates whether the vendor holds a Udyam / MSME certificate.',
    importance: [
      'Toggles requirement of MSME certificate and Udyam number',
      'Drives MSME priority-payment SLA (45 days under MSMED Act)',
    ],
  },
  msme_certificate: {
    usage: 'Udyam / MSME registration certificate.',
    importance: ['Evidence for MSME-priority payment terms', 'Audit document for MSME compliance'],
  },
  udyam_number: {
    usage: 'Udyam Registration Number issued by the MSME ministry.',
    importance: ['Used to verify MSME status on the Udyam portal'],
  },
  enterprise_name: {
    usage: 'Enterprise name as recorded on the Udyam certificate.',
    importance: ['Cross-checked with PAN / GST legal name'],
  },

  // ---------- Bank ----------
  cancelled_cheque: {
    usage: 'Image of a cancelled cheque from the vendor\'s payout bank account.',
    importance: [
      'OCR extracts account number, IFSC and account holder name',
      'Mandatory KYC document for setting up payments',
    ],
  },
  bank_account_number: {
    usage: 'Bank account number where vendor payments will be remitted.',
    importance: [
      'Validated by ₹1 penny-drop to confirm beneficiary name',
      'Used as payment account in SAP — required for any payout',
    ],
  },
  bank_ifsc: {
    usage: '11-character IFSC of the vendor\'s bank branch.',
    importance: [
      'Validated against RBI IFSC directory',
      'Auto-fills bank name, branch and branch address',
    ],
  },
  bank_name: {
    usage: 'Name of the vendor\'s bank.',
    importance: ['Auto-filled from IFSC; used on payment advice'],
  },
  bank_branch: {
    usage: 'Branch name of the vendor\'s bank.',
    importance: ['Auto-filled from IFSC; required for cheque clearing'],
  },
  bank_account_holder: {
    usage: 'Name of the account holder as per bank records.',
    importance: [
      'Compared with penny-drop response to detect mismatch / fraud',
      'Must match legal name for approval',
    ],
  },
  bank_account_type: {
    usage: 'Account category (Current, Savings, Cash Credit, etc.).',
    importance: ['Used by Finance to classify the payout route'],
  },
  bank_branch_address: {
    usage: 'Postal address of the bank branch.',
    importance: ['Optional — auto-filled from IFSC where available'],
  },

  // ---------- Organization ----------
  buyerCompanyId: {
    usage: 'The Ramky group entity that is onboarding this vendor.',
    importance: [
      'Determines approval routing and SAP company code',
      'Mandatory — vendor cannot be linked to multiple buyer entities at registration',
    ],
  },
  legalName: {
    usage: 'Legal name of the vendor organization.',
    importance: ['Primary identity field — used everywhere downstream'],
  },
  tradeName: {
    usage: 'Brand / trade name if different from legal name.',
    importance: ['Optional — shown on communications when present'],
  },
  industryType: {
    usage: 'Industry sector the vendor operates in.',
    importance: ['Used for vendor categorization and reporting'],
  },
  organizationType: {
    usage: 'Type of organization (e.g. Pvt Ltd, LLP, Partnership).',
    importance: ['Drives statutory document requirements'],
  },
  ownershipType: {
    usage: 'Ownership structure (Indian / Foreign / JV).',
    importance: ['Affects FEMA / RBI compliance checks'],
  },
  productCategories: {
    usage: 'Categories of products / services the vendor supplies.',
    importance: [
      'Drives buyer-side category routing and RFQ matching',
      'Used in vendor search and analytics',
    ],
  },
  state: {
    usage: 'State of operation.',
    importance: ['Used for GST place-of-supply and regional reporting'],
  },
  entityType: {
    usage: 'Statutory entity type as per ROC / MCA records.',
    importance: ['Determines applicable statutory documents'],
  },
  firmRegistrationNo: {
    usage: 'Firm registration number issued by ROC / Registrar.',
    importance: ['Compliance evidence for partnerships and firms'],
  },
  pfNumber: {
    usage: 'Provident Fund establishment code.',
    importance: ['Required for vendors deploying labour on site'],
  },
  esiNumber: {
    usage: 'ESI establishment code.',
    importance: ['Required for vendors with workforce > 10 employees'],
  },
  labourPermitNo: {
    usage: 'Labour licence / permit number.',
    importance: ['Mandatory for contract-labour vendors'],
  },
  iecNo: {
    usage: 'Importer-Exporter Code issued by DGFT.',
    importance: [
      'Required for any cross-border transaction',
      'Hide if you onboard only domestic vendors',
    ],
  },
  swiftIbanCode: {
    usage: 'SWIFT / IBAN code for international wire transfers.',
    importance: ['Mandatory for foreign vendors receiving forex payments'],
  },
  iecCertificateFile: {
    usage: 'IEC certificate document.',
    importance: ['Audit evidence for import / export operations'],
  },
  swiftIbanProofFile: {
    usage: 'Bank document evidencing SWIFT / IBAN.',
    importance: ['KYC document for forex payouts'],
  },
  operationalNetwork: {
    usage: 'Geographic scope of operations (Local / Regional / National / International).',
    importance: ['Used for sourcing decisions and logistics planning'],
  },
  memberships: {
    usage: 'Industry body memberships (CII, FICCI, NHAI, etc.).',
    importance: ['Indicator of industry credibility — used during evaluation'],
  },
  enlistments: {
    usage: 'Enlistments with PSU / government bodies.',
    importance: ['Adds credibility for govt-tendered work'],
  },
  certifications: {
    usage: 'Quality / safety / environmental certifications (ISO, OHSAS, etc.).',
    importance: [
      'Mandatory for certain product categories (e.g. infra contractors)',
      'Drives QHSE evaluation score',
    ],
  },

  // ---------- Address: Registered ----------
  registeredAddress: {
    usage: 'Primary line of the registered office address.',
    importance: ['Legal address used on POs, contracts and tax invoices'],
  },
  registeredCity: { usage: 'City of the registered office.', importance: ['Used for tax jurisdiction'] },
  registeredState: {
    usage: 'State of the registered office.',
    importance: ['Determines GST place-of-supply', 'Used for state-wise vendor analytics'],
  },
  registeredPincode: {
    usage: 'PIN code of the registered office.',
    importance: ['Determines GST place-of-supply', 'Used in vendor geographic reports'],
  },
  registeredPhone: { usage: 'Office landline of the registered address.', importance: ['Backup contact during onboarding'] },
  registeredFax: { usage: 'Fax number of the registered office.', importance: ['Legacy field — safe to hide for most tenants'] },
  registeredWebsite: { usage: 'Public website of the vendor.', importance: ['Used for due-diligence checks'] },
  registeredEmail: {
    usage: 'Official email of the registered office.',
    importance: ['Receives statutory communications and PO copies'],
  },
  // ---------- Address: Manufacturing ----------
  sameAsRegistered: {
    usage: 'When ticked, copies registered address to manufacturing address.',
    importance: ['Convenience toggle — does not store separate manufacturing data'],
  },
  manufacturingAddress: { usage: 'Primary line of the manufacturing facility address.', importance: ['Used for inspection visits and logistics'] },
  manufacturingCity: { usage: 'City of the manufacturing facility.', importance: ['Used for logistics planning'] },
  manufacturingState: { usage: 'State of the manufacturing facility.', importance: ['GST jurisdiction for goods dispatch'] },
  manufacturingPincode: { usage: 'PIN code of the manufacturing facility.', importance: ['Logistics & GST routing'] },
  manufacturingPhone: { usage: 'Phone of the manufacturing facility.', importance: ['On-site contact for despatch coordination'] },
  manufacturingFax: { usage: 'Fax of the manufacturing facility.', importance: ['Legacy — safe to hide'] },
  manufacturingEmail: { usage: 'Email of the manufacturing facility.', importance: ['Despatch & coordination email'] },

  // ---------- Address: Branch ----------
  branchName: { usage: 'Name / identifier of an additional branch office.', importance: ['Optional — used only by multi-branch vendors'] },
  branchEmail: { usage: 'Email of the branch.', importance: ['Branch-level contact'] },
  branchWebsite: { usage: 'Website of the branch (if separate).', importance: ['Optional reference'] },
  branchAddress: { usage: 'Branch address line 1.', importance: ['Used for branch-level POs'] },
  branchCity: { usage: 'Branch city.', importance: ['Logistics & jurisdiction'] },
  branchState: { usage: 'Branch state.', importance: ['Tax jurisdiction'] },
  branchPincode: { usage: 'Branch PIN code.', importance: ['Logistics routing'] },
  branchCountry: { usage: 'Country of the branch.', importance: ['Distinguishes domestic vs foreign branches'] },
  branchContactName: { usage: 'Branch contact person name.', importance: ['Day-to-day branch SPOC'] },
  branchContactDesignation: { usage: 'Designation of the branch contact.', importance: ['Reference only'] },
  branchContactEmail: { usage: 'Email of the branch contact.', importance: ['Used for branch-level communications'] },
  branchContactPhone: { usage: 'Phone of the branch contact.', importance: ['Day-to-day reachability'] },
  branchContactFax: { usage: 'Fax of the branch contact.', importance: ['Legacy — safe to hide'] },

  // ---------- Contact: CEO ----------
  ceoName: {
    usage: 'Name of the CEO / Managing Director.',
    importance: ['Primary signing authority on the vendor side', 'Shown on contracts'],
  },
  ceoDesignation: { usage: 'Designation of the top authority contact.', importance: ['Reference only'] },
  ceoPhone: {
    usage: 'Primary phone of the CEO / MD.',
    importance: ['Escalation contact for approvals and disputes'],
  },
  ceoEmail: {
    usage: 'Primary email of the CEO / MD.',
    importance: [
      'Receives onboarding & approval notifications',
      'Used as fallback authority contact',
    ],
  },
  ceoPhone2: { usage: 'Secondary phone of the CEO / MD.', importance: ['Backup contact'] },
  ceoEmail2: { usage: 'Secondary email of the CEO / MD.', importance: ['Backup contact'] },

  // ---------- Contact: Marketing ----------
  marketingName: { usage: 'Marketing / Sales SPOC name.', importance: ['Day-to-day commercial contact'] },
  marketingDesignation: { usage: 'Designation of marketing SPOC.', importance: ['Reference only'] },
  marketingPhone: { usage: 'Phone of marketing SPOC.', importance: ['Used for RFQs and quotations'] },
  marketingEmail: { usage: 'Email of marketing SPOC.', importance: ['RFQ and quotation correspondence'] },

  // ---------- Contact: Production ----------
  productionName: { usage: 'Production / Operations SPOC name.', importance: ['Coordination on dispatch and delivery'] },
  productionDesignation: { usage: 'Designation of production SPOC.', importance: ['Reference only'] },
  productionPhone: { usage: 'Phone of production SPOC.', importance: ['Used for dispatch coordination'] },
  productionEmail: { usage: 'Email of production SPOC.', importance: ['Dispatch & production updates'] },

  // ---------- Contact: Customer Service ----------
  customerServiceName: { usage: 'Customer-service SPOC name.', importance: ['Post-sales support contact'] },
  customerServiceDesignation: { usage: 'Designation of customer-service SPOC.', importance: ['Reference only'] },
  customerServicePhone: { usage: 'Phone of customer-service SPOC.', importance: ['Used for complaints / warranty calls'] },
  customerServiceEmail: { usage: 'Email of customer-service SPOC.', importance: ['Complaint and warranty correspondence'] },

  // ---------- Financial ----------
  turnoverYear1: {
    usage: 'Annual turnover for the most recent financial year.',
    importance: [
      'Used for vendor financial-strength scoring',
      'Drives credit-limit recommendation',
    ],
  },
  turnoverYear2: { usage: 'Annual turnover — previous year.', importance: ['Trend analysis for financial scoring'] },
  turnoverYear3: { usage: 'Annual turnover — 3 years prior.', importance: ['Trend analysis for financial scoring'] },
  creditPeriodExpected: {
    usage: 'Credit period the vendor expects (in days).',
    importance: ['Negotiation input for procurement', 'Compared against MSME 45-day rule'],
  },
  financialDocsFile: {
    usage: 'Audited financial statements (last 3 years).',
    importance: ['Evidence for financial-strength scoring', 'Required above turnover thresholds'],
  },
  majorCustomer1: { usage: 'Name of a key existing customer of the vendor.', importance: ['Reputation & reference check'] },
  majorCustomer2: { usage: 'Additional key customer reference.', importance: ['Reputation & reference check'] },
  majorCustomer3: { usage: 'Additional key customer reference.', importance: ['Reputation & reference check'] },
  authorizedDistributorName: { usage: 'Name of OEM / principal that has authorized this vendor as distributor.', importance: ['Validates trader / distributor claims'] },
  authorizedDistributorAddress: { usage: 'Address of the OEM / principal.', importance: ['Reference for authorization verification'] },
  dealershipCertificateFile: { usage: 'Dealership / authorization certificate from the OEM.', importance: ['Evidence required for authorized-dealer category'] },

  rawMaterialsUsed: { usage: 'Key raw materials consumed in production.', importance: ['Capability assessment for technical evaluation'] },
  machineryAvailability: { usage: 'List of available machinery.', importance: ['Capacity and capability assessment'] },
  equipmentAvailability: { usage: 'List of available equipment.', importance: ['Capacity and capability assessment'] },
  powerSupply: { usage: 'Sanctioned power load at the facility (KV / MW).', importance: ['Indicator of production capacity'] },
  waterSupply: { usage: 'Source / availability of water at the facility.', importance: ['QHSE & continuity-of-operations check'] },
  dgCapacity: { usage: 'Diesel generator backup capacity.', importance: ['Continuity-of-operations indicator'] },
  productionCapacity: { usage: 'Maximum production capacity (units / period).', importance: ['Used to size POs and delivery commitments'] },
  storeCapacity: { usage: 'Warehouse / store capacity.', importance: ['Used for inventory planning'] },
  supplyCapacity: { usage: 'Maximum supply capacity (units / period).', importance: ['Used for delivery scheduling'] },
  manpower: { usage: 'Total workforce strength.', importance: ['Capacity and capability assessment'] },
  inspectionTesting: { usage: 'In-house inspection & testing capability.', importance: ['Quality assurance evaluation'] },

  nearestRailway: { usage: 'Nearest railway station for goods dispatch.', importance: ['Logistics planning'] },
  nearestBusStation: { usage: 'Nearest bus station.', importance: ['Workforce mobility / site visits'] },
  nearestAirport: { usage: 'Nearest airport.', importance: ['Logistics for time-critical / international shipments'] },
  nearestPort: { usage: 'Nearest sea / inland port.', importance: ['Logistics for export-import shipments'] },

  productTypes: { usage: 'Specific product types offered.', importance: ['Used for catalog matching during sourcing'] },
  productionFacilities: { usage: 'Production facilities the vendor operates.', importance: ['Capacity assessment'] },
  leadTimeRequired: { usage: 'Typical lead time required for delivery.', importance: ['Procurement planning input'] },

  qualityIssues: { usage: 'Past quality incidents and resolutions.', importance: ['QHSE risk assessment'] },
  healthIssues: { usage: 'Past health incidents and resolutions.', importance: ['QHSE risk assessment'] },
  environmentalIssues: { usage: 'Past environmental incidents.', importance: ['QHSE risk assessment'] },
  safetyIssues: { usage: 'Past safety incidents and resolutions.', importance: ['QHSE risk assessment'] },
};

// Address-line 2/3/4 share generic copy
[
  'registeredAddressLine2', 'registeredAddressLine3', 'registeredAddressLine4',
  'manufacturingAddressLine2', 'manufacturingAddressLine3', 'manufacturingAddressLine4',
  'branchAddressLine2', 'branchAddressLine3', 'branchAddressLine4',
].forEach((k) => { BUILT_IN_FIELD_INFO[k] = ADDR_LINE; });

export function getBuiltInFieldInfo(fieldName: string): BuiltInFieldInfo {
  return BUILT_IN_FIELD_INFO[fieldName] || GENERIC_PROFILE;
}
