import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PANValidationRequest {
  pan: string;
  name?: string;
}

interface PANValidationResponse {
  valid: boolean;
  message: string;
  data?: {
    name?: string;
    panType?: string;
    status?: string;
  };
}

// PAN format validation
function isValidPANFormat(pan: string): boolean {
  // PAN format: AAAAA0000A (5 letters + 4 digits + 1 letter)
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
}

// Get PAN holder type from 4th character
function getPANType(pan: string): string {
  const typeChar = pan.charAt(3);
  const typeMap: Record<string, string> = {
    'A': 'Association of Persons (AOP)',
    'B': 'Body of Individuals (BOI)',
    'C': 'Company',
    'F': 'Firm/Partnership',
    'G': 'Government',
    'H': 'Hindu Undivided Family (HUF)',
    'L': 'Local Authority',
    'J': 'Artificial Juridical Person',
    'P': 'Individual/Person',
    'T': 'Trust',
    'K': 'Krishi',
  };
  return typeMap[typeChar] || 'Unknown';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pan, name }: PANValidationRequest = await req.json();

    if (!pan) {
      return new Response(
        JSON.stringify({ valid: false, message: 'PAN is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate PAN format
    const upperPAN = pan.toUpperCase().trim();
    if (!isValidPANFormat(upperPAN)) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Invalid PAN format. Expected format: AAAAA0000A' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get PAN type
    const panType = getPANType(upperPAN);

    // In production, you would call the actual PAN verification API here
    // TODO: Integrate with NSDL/UTIITSL PAN verification API
    
    const simulatedResponse: PANValidationResponse = {
      valid: true,
      message: 'PAN verified successfully',
      data: {
        name: name || 'PAN Holder Name',
        panType: panType,
        status: 'Active',
      },
    };

    console.log(`PAN Validation for ${upperPAN}: ${simulatedResponse.valid ? 'PASSED' : 'FAILED'}`);

    return new Response(
      JSON.stringify(simulatedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('PAN Validation Error:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: 'PAN validation service error. Please try again.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});