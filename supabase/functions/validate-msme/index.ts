import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MSMEValidationRequest {
  msmeNumber: string;
  enterpriseName?: string;
}

interface MSMEValidationResponse {
  valid: boolean;
  message: string;
  data?: {
    udyamNumber?: string;
    enterpriseName?: string;
    enterpriseType?: string;
    category?: string;
    classification?: string;
    registrationDate?: string;
    validUpto?: string;
    state?: string;
    district?: string;
    address?: string;
    nicCode?: string;
    nicDescription?: string;
    status?: string;
  };
}

// Udyam format validation (new format)
function isValidUdyamFormat(udyamNumber: string): boolean {
  const udyamRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
  return udyamRegex.test(udyamNumber);
}

// Old UAM format (still accepted)
function isValidUAMFormat(uamNumber: string): boolean {
  const uamRegex = /^[A-Z]{2}\d{2}[A-Z]\d{7}$/;
  return uamRegex.test(uamNumber);
}

// State code to state name mapping
const stateCodeMap: Record<string, string> = {
  'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh', 'AS': 'Assam',
  'BR': 'Bihar', 'CG': 'Chhattisgarh', 'GA': 'Goa', 'GJ': 'Gujarat',
  'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JK': 'Jammu & Kashmir',
  'JH': 'Jharkhand', 'KA': 'Karnataka', 'KL': 'Kerala', 'MP': 'Madhya Pradesh',
  'MH': 'Maharashtra', 'MN': 'Manipur', 'ML': 'Meghalaya', 'MZ': 'Mizoram',
  'NL': 'Nagaland', 'OD': 'Odisha', 'PB': 'Punjab', 'RJ': 'Rajasthan',
  'SK': 'Sikkim', 'TN': 'Tamil Nadu', 'TS': 'Telangana', 'TR': 'Tripura',
  'UK': 'Uttarakhand', 'UP': 'Uttar Pradesh', 'WB': 'West Bengal',
  'AN': 'Andaman & Nicobar', 'CH': 'Chandigarh', 'DN': 'Dadra & Nagar Haveli',
  'DD': 'Daman & Diu', 'DL': 'Delhi', 'LD': 'Lakshadweep', 'PY': 'Puducherry',
  'LA': 'Ladakh',
};

// Mock MSME database
const mockMSMEDatabase: Record<string, {
  enterpriseName: string;
  category: string;
  classification: string;
  registrationDate: string;
  state: string;
  district: string;
  nicCode: string;
  nicDescription: string;
  status: string;
}> = {
  'UDYAM-TG-01-0012345': {
    enterpriseName: 'ABC INFRASTRUCTURE PVT LTD',
    category: 'Small',
    classification: 'Manufacturing',
    registrationDate: '2021-07-15',
    state: 'Telangana',
    district: 'Hyderabad',
    nicCode: '41001',
    nicDescription: 'Construction of buildings',
    status: 'Active',
  },
  'UDYAM-TN-02-0054321': {
    enterpriseName: 'GREENWAY ENVIRONMENTAL SERVICES PVT LTD',
    category: 'Medium',
    classification: 'Services',
    registrationDate: '2021-02-28',
    state: 'Tamil Nadu',
    district: 'Chennai',
    nicCode: '38110',
    nicDescription: 'Collection of non-hazardous waste',
    status: 'Active',
  },
  'UDYAM-MH-03-0098765': {
    enterpriseName: 'TECHSERVE IT SOLUTIONS PVT LTD',
    category: 'Micro',
    classification: 'Services',
    registrationDate: '2022-01-10',
    state: 'Maharashtra',
    district: 'Pune',
    nicCode: '62013',
    nicDescription: 'IT consulting services',
    status: 'Active',
  },
  // Expired/Cancelled registration
  'UDYAM-DL-01-0011111': {
    enterpriseName: 'OLD ENTERPRISE',
    category: 'Small',
    classification: 'Trading',
    registrationDate: '2019-01-01',
    state: 'Delhi',
    district: 'New Delhi',
    nicCode: '46100',
    nicDescription: 'Wholesale trade',
    status: 'Cancelled',
  },
};

// Simulate API delay
function simulateApiDelay(): Promise<void> {
  const delay = Math.random() * 600 + 300; // 300-900ms
  return new Promise(resolve => setTimeout(resolve, delay));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { msmeNumber, enterpriseName }: MSMEValidationRequest = await req.json();
    console.log(`[MSME Validation] Validating: ${msmeNumber}`);

    if (!msmeNumber) {
      return new Response(
        JSON.stringify({ valid: false, message: 'MSME/Udyam number is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const cleanNumber = msmeNumber.toUpperCase().trim();
    const isUdyam = isValidUdyamFormat(cleanNumber);
    const isUAM = isValidUAMFormat(cleanNumber);

    if (!isUdyam && !isUAM) {
      console.log(`[MSME Validation] Invalid format: ${cleanNumber}`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Invalid MSME/Udyam format. Expected: UDYAM-XX-00-0000000' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Simulate API delay
    await simulateApiDelay();

    // Check mock database
    const mockData = mockMSMEDatabase[cleanNumber];
    
    if (mockData) {
      const isActive = mockData.status === 'Active';
      console.log(`[MSME Validation] Found: ${cleanNumber} - Status: ${mockData.status}`);
      
      return new Response(
        JSON.stringify({
          valid: isActive,
          message: isActive 
            ? `MSME certificate verified - ${mockData.category} Enterprise` 
            : `MSME registration ${mockData.status.toLowerCase()}`,
          data: {
            udyamNumber: cleanNumber,
            enterpriseName: mockData.enterpriseName,
            enterpriseType: mockData.classification,
            category: mockData.category,
            classification: mockData.classification,
            registrationDate: mockData.registrationDate,
            validUpto: '2026-12-31', // 5 years validity
            state: mockData.state,
            district: mockData.district,
            nicCode: mockData.nicCode,
            nicDescription: mockData.nicDescription,
            status: mockData.status,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // For unknown numbers, simulate based on state code pattern
    let stateCode = '';
    if (isUdyam) {
      stateCode = cleanNumber.substring(6, 8);
    }
    
    // 15% failure rate for unknown numbers
    const serialNumber = isUdyam ? parseInt(cleanNumber.substring(12)) : 0;
    const simulateFailure = serialNumber % 7 === 0;

    if (simulateFailure || !stateCodeMap[stateCode]) {
      console.log(`[MSME Validation] Not found: ${cleanNumber}`);
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'MSME registration not found in Udyam portal. Please verify the registration number.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Generate mock successful response
    const categories = ['Micro', 'Small', 'Medium'];
    const classifications = ['Manufacturing', 'Services', 'Trading'];
    const randomCategory = categories[serialNumber % 3];
    const randomClassification = classifications[serialNumber % 3];

    const response: MSMEValidationResponse = {
      valid: true,
      message: `MSME certificate verified - ${randomCategory} Enterprise`,
      data: {
        udyamNumber: cleanNumber,
        enterpriseName: enterpriseName?.toUpperCase() || 'REGISTERED ENTERPRISE NAME',
        enterpriseType: randomClassification,
        category: randomCategory,
        classification: randomClassification,
        registrationDate: '2021-07-01',
        validUpto: '2026-06-30',
        state: stateCodeMap[stateCode] || 'Unknown State',
        district: 'District',
        nicCode: '41001',
        nicDescription: 'Construction and allied activities',
        status: 'Active',
      },
    };

    console.log(`[MSME Validation] SUCCESS: ${cleanNumber}`);
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[MSME Validation] Error:', error);
    return new Response(
      JSON.stringify({ valid: false, message: 'MSME validation service error. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
