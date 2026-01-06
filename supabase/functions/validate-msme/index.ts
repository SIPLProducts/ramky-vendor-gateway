import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MSMEValidationRequest {
  msmeNumber: string;
}

interface MSMEValidationResponse {
  valid: boolean;
  message: string;
  data?: {
    udyamNumber?: string;
    enterpriseName?: string;
    category?: string;
    registrationDate?: string;
    status?: string;
  };
}

// MSME/Udyam number format validation
function isValidUdyamFormat(udyamNumber: string): boolean {
  // Udyam format: UDYAM-XX-00-0000000 (State code + District code + 7 digit number)
  const udyamRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
  return udyamRegex.test(udyamNumber);
}

// Old MSME format (UAM number)
function isValidUAMFormat(uamNumber: string): boolean {
  const uamRegex = /^[A-Z]{2}\d{2}[A-Z]\d{7}$/;
  return uamRegex.test(uamNumber);
}

// Get state from Udyam number
function getStateFromUdyam(udyamNumber: string): string {
  const stateCode = udyamNumber.substring(6, 8);
  const stateMap: Record<string, string> = {
    'AP': 'Andhra Pradesh',
    'AR': 'Arunachal Pradesh',
    'AS': 'Assam',
    'BR': 'Bihar',
    'CG': 'Chhattisgarh',
    'GA': 'Goa',
    'GJ': 'Gujarat',
    'HR': 'Haryana',
    'HP': 'Himachal Pradesh',
    'JK': 'Jammu & Kashmir',
    'JH': 'Jharkhand',
    'KA': 'Karnataka',
    'KL': 'Kerala',
    'MP': 'Madhya Pradesh',
    'MH': 'Maharashtra',
    'MN': 'Manipur',
    'ML': 'Meghalaya',
    'MZ': 'Mizoram',
    'NL': 'Nagaland',
    'OD': 'Odisha',
    'PB': 'Punjab',
    'RJ': 'Rajasthan',
    'SK': 'Sikkim',
    'TN': 'Tamil Nadu',
    'TS': 'Telangana',
    'TR': 'Tripura',
    'UK': 'Uttarakhand',
    'UP': 'Uttar Pradesh',
    'WB': 'West Bengal',
    'AN': 'Andaman and Nicobar Islands',
    'CH': 'Chandigarh',
    'DN': 'Dadra and Nagar Haveli',
    'DD': 'Daman and Diu',
    'DL': 'Delhi',
    'LD': 'Lakshadweep',
    'PY': 'Puducherry',
  };
  return stateMap[stateCode] || 'Unknown State';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { msmeNumber }: MSMEValidationRequest = await req.json();

    if (!msmeNumber) {
      return new Response(
        JSON.stringify({ valid: false, message: 'MSME/Udyam number is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Clean and uppercase the number
    const cleanNumber = msmeNumber.toUpperCase().trim();

    // Check format
    const isUdyamFormat = isValidUdyamFormat(cleanNumber);
    const isUAMFormat = isValidUAMFormat(cleanNumber);

    if (!isUdyamFormat && !isUAMFormat) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Invalid MSME/Udyam number format. Expected: UDYAM-XX-00-0000000' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // In production, you would call the actual Udyam verification API here
    // TODO: Integrate with MSME Udyam verification API
    
    const simulatedResponse: MSMEValidationResponse = {
      valid: true,
      message: 'MSME certificate verified',
      data: {
        udyamNumber: cleanNumber,
        enterpriseName: 'Enterprise Name',
        category: isUdyamFormat ? 'Micro/Small/Medium' : 'Legacy Registration',
        registrationDate: '2021-07-01',
        status: 'Active',
      },
    };

    console.log(`MSME Validation for ${cleanNumber}: ${simulatedResponse.valid ? 'PASSED' : 'FAILED'}`);

    return new Response(
      JSON.stringify(simulatedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('MSME Validation Error:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: 'MSME validation service error. Please try again.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});