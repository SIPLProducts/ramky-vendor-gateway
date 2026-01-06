import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GSTValidationRequest {
  gstin: string;
  legalName: string;
}

interface GSTValidationResponse {
  valid: boolean;
  message: string;
  data?: {
    legalName?: string;
    tradeName?: string;
    status?: string;
    registrationDate?: string;
    stateCode?: string;
    taxpayerType?: string;
    businessNature?: string;
    principalPlaceOfBusiness?: string;
  };
}

// GST number format validation
function isValidGSTINFormat(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}

// State code to state name mapping
const stateCodeMap: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction',
};

// Mock database of test GSTINs with different scenarios
const mockGSTDatabase: Record<string, { status: string; legalName: string; tradeName: string; taxpayerType: string; registrationDate: string; businessNature: string }> = {
  // Valid active GSTINs
  '36AABCU9603R1ZM': { status: 'Active', legalName: 'ABC INFRASTRUCTURE PVT LTD', tradeName: 'ABC INFRA', taxpayerType: 'Regular', registrationDate: '2019-07-01', businessNature: 'Construction Services' },
  '27AABCT3456R1Z4': { status: 'Active', legalName: 'TECHSERVE IT SOLUTIONS PVT LTD', tradeName: 'TECHSERVE', taxpayerType: 'Regular', registrationDate: '2020-04-15', businessNature: 'IT Services' },
  '29AABCM9012R1Z3': { status: 'Active', legalName: 'METRO CONSTRUCTIONS LIMITED', tradeName: 'METRO BUILD', taxpayerType: 'Regular', registrationDate: '2018-01-10', businessNature: 'Civil Construction' },
  '33AABCG5678R1Z2': { status: 'Active', legalName: 'GREENWAY ENVIRONMENTAL SERVICES PVT LTD', tradeName: 'GREENWAY ENV', taxpayerType: 'Composition', registrationDate: '2021-02-28', businessNature: 'Environmental Services' },
  // Cancelled GSTIN
  '22BBBCD1234E1ZF': { status: 'Cancelled', legalName: 'OLD COMPANY LTD', tradeName: 'OLD CO', taxpayerType: 'Regular', registrationDate: '2017-07-01', businessNature: 'Trading' },
  // Suspended GSTIN  
  '09CCCDE5678F1ZG': { status: 'Suspended', legalName: 'SUSPENDED TRADERS', tradeName: 'ST TRADERS', taxpayerType: 'Regular', registrationDate: '2019-01-15', businessNature: 'Trading' },
};

// Simulate API delay
function simulateApiDelay(): Promise<void> {
  const delay = Math.random() * 500 + 200; // 200-700ms
  return new Promise(resolve => setTimeout(resolve, delay));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gstin, legalName }: GSTValidationRequest = await req.json();
    console.log(`[GST Validation] Validating GSTIN: ${gstin} for ${legalName}`);

    if (!gstin) {
      return new Response(
        JSON.stringify({ valid: false, message: 'GSTIN is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const upperGSTIN = gstin.toUpperCase().trim();
    
    // Format validation
    if (!isValidGSTINFormat(upperGSTIN)) {
      console.log(`[GST Validation] Invalid format: ${upperGSTIN}`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const stateCode = upperGSTIN.substring(0, 2);
    if (!stateCodeMap[stateCode]) {
      return new Response(
        JSON.stringify({ valid: false, message: `Invalid state code: ${stateCode}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Simulate API call delay
    await simulateApiDelay();

    // Check mock database first
    const mockData = mockGSTDatabase[upperGSTIN];
    
    if (mockData) {
      const isActive = mockData.status === 'Active';
      console.log(`[GST Validation] Found in mock DB: ${upperGSTIN} - Status: ${mockData.status}`);
      
      return new Response(
        JSON.stringify({
          valid: isActive,
          message: isActive 
            ? `GST verified successfully - ${mockData.status}` 
            : `GST verification failed - Status: ${mockData.status}`,
          data: {
            legalName: mockData.legalName,
            tradeName: mockData.tradeName,
            status: mockData.status,
            registrationDate: mockData.registrationDate,
            stateCode: stateCode,
            taxpayerType: mockData.taxpayerType,
            businessNature: mockData.businessNature,
            principalPlaceOfBusiness: stateCodeMap[stateCode],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // For unknown GSTINs, simulate based on checksum (last digit)
    const lastChar = upperGSTIN.charAt(14);
    const simulateFailure = ['0', '1'].includes(lastChar); // ~13% failure rate for testing

    if (simulateFailure) {
      console.log(`[GST Validation] Simulated not found: ${upperGSTIN}`);
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'GSTIN not found in government records',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Generate mock successful response
    const response: GSTValidationResponse = {
      valid: true,
      message: 'GST verified successfully - Active',
      data: {
        legalName: legalName?.toUpperCase() || 'REGISTERED BUSINESS NAME',
        tradeName: legalName?.toUpperCase().split(' ')[0] || 'TRADE NAME',
        status: 'Active',
        registrationDate: '2020-01-15',
        stateCode: stateCode,
        taxpayerType: 'Regular',
        businessNature: 'Manufacturing & Trading',
        principalPlaceOfBusiness: stateCodeMap[stateCode],
      },
    };

    console.log(`[GST Validation] SUCCESS: ${upperGSTIN}`);
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[GST Validation] Error:', error);
    return new Response(
      JSON.stringify({ valid: false, message: 'GST validation service error. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
