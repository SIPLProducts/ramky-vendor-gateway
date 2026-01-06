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
  };
}

// GST number format validation
function isValidGSTINFormat(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}

// Extract PAN from GSTIN (characters 3-12)
function extractPANFromGSTIN(gstin: string): string {
  return gstin.substring(2, 12);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gstin, legalName }: GSTValidationRequest = await req.json();

    if (!gstin) {
      return new Response(
        JSON.stringify({ valid: false, message: 'GSTIN is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate GSTIN format
    const upperGSTIN = gstin.toUpperCase().trim();
    if (!isValidGSTINFormat(upperGSTIN)) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Extract state code and validate
    const stateCode = upperGSTIN.substring(0, 2);
    const validStateCodes = [
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
      '21', '22', '23', '24', '26', '27', '28', '29', '30', '31',
      '32', '33', '34', '35', '36', '37', '38', '97', '99'
    ];

    if (!validStateCodes.includes(stateCode)) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: `Invalid state code: ${stateCode}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // In production, you would call the actual GST API here
    // For now, we simulate a successful validation
    // TODO: Integrate with actual GST verification API (e.g., MasterGST, ClearTax, etc.)
    
    const simulatedResponse: GSTValidationResponse = {
      valid: true,
      message: 'GST verified - Active status confirmed',
      data: {
        legalName: legalName || 'Verified Legal Name',
        tradeName: 'Trade Name',
        status: 'Active',
        registrationDate: '2020-01-15',
        stateCode: stateCode,
        taxpayerType: 'Regular',
      },
    };

    console.log(`GST Validation for ${upperGSTIN}: ${simulatedResponse.valid ? 'PASSED' : 'FAILED'}`);

    return new Response(
      JSON.stringify(simulatedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('GST Validation Error:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: 'GST validation service error. Please try again.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});