import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PANValidationRequest {
  pan: string;
  name?: string;
}

// PAN format validation
function isValidPANFormat(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
}

// Get PAN holder type from 4th character
function getPANTypeInfo(pan: string): { code: string; description: string } {
  const typeChar = pan.charAt(3);
  const typeMap: Record<string, { code: string; description: string }> = {
    'A': { code: 'AOP', description: 'Association of Persons' },
    'B': { code: 'BOI', description: 'Body of Individuals' },
    'C': { code: 'Company', description: 'Company (Private or Public)' },
    'F': { code: 'Firm', description: 'Firm / Limited Liability Partnership' },
    'G': { code: 'Government', description: 'Government Agency' },
    'H': { code: 'HUF', description: 'Hindu Undivided Family' },
    'L': { code: 'Local Authority', description: 'Local Authority' },
    'J': { code: 'AJP', description: 'Artificial Juridical Person' },
    'P': { code: 'Individual', description: 'Individual / Person' },
    'T': { code: 'Trust', description: 'Trust (AOP)' },
    'K': { code: 'Krishi', description: 'Krishi (Agricultural)' },
  };
  return typeMap[typeChar] || { code: 'Unknown', description: 'Unknown Entity Type' };
}

// Get Cashfree auth token
async function getCashfreeToken(): Promise<string> {
  const clientId = Deno.env.get('CASHFREE_CLIENT_ID');
  const clientSecret = Deno.env.get('CASHFREE_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Cashfree credentials not configured');
  }

  // Use sandbox URL for test credentials, production for live credentials
  const baseUrl = 'https://sandbox.cashfree.com';
  
  const response = await fetch(`${baseUrl}/verification/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
    },
  });

  if (!response.ok) {
    console.error('Cashfree token error:', await response.text());
    throw new Error('Failed to get Cashfree auth token');
  }

  const data = await response.json();
  return data.token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pan, name }: PANValidationRequest = await req.json();
    console.log(`[PAN Validation] Validating PAN: ${pan} for ${name}`);

    if (!pan) {
      return new Response(
        JSON.stringify({ valid: false, message: 'PAN is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const upperPAN = pan.toUpperCase().trim();
    
    if (!isValidPANFormat(upperPAN)) {
      console.log(`[PAN Validation] Invalid format: ${upperPAN}`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Invalid PAN format. Expected format: AAAAA0000A' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const panTypeInfo = getPANTypeInfo(upperPAN);

    // Call Cashfree PAN Verification API
    const token = await getCashfreeToken();
    const baseUrl = 'https://sandbox.cashfree.com';
    
    const verifyResponse = await fetch(`${baseUrl}/verification/pan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pan: upperPAN,
        name: name,
      }),
    });

    const verifyData = await verifyResponse.json();
    console.log(`[PAN Validation] API Response:`, JSON.stringify(verifyData));

    if (!verifyResponse.ok) {
      console.error(`[PAN Validation] API Error:`, verifyData);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: verifyData.message || 'PAN verification failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if PAN is valid
    const isValid = verifyData.status === 'VALID' || verifyData.valid === true;
    const panData = verifyData.data || verifyData;
    
    const response = {
      valid: isValid,
      message: isValid 
        ? `PAN verified successfully - ${panData.name || panData.registeredName || 'Verified'}` 
        : `PAN verification failed - ${verifyData.message || 'Invalid PAN'}`,
      data: {
        name: panData.name || panData.registeredName,
        panType: panTypeInfo.code,
        panTypeDescription: panTypeInfo.description,
        status: isValid ? 'Active' : 'Invalid',
        lastUpdated: new Date().toISOString().split('T')[0],
        aadhaarLinked: panData.aadhaarSeeding === 'Y' || panData.aadhaarLinked,
        nameMatchScore: panData.nameMatchScore || panData.name_match_score,
      },
    };

    console.log(`[PAN Validation] ${isValid ? 'SUCCESS' : 'FAILED'}: ${upperPAN}`);
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[PAN Validation] Error:', error);
    return new Response(
      JSON.stringify({ valid: false, message: 'PAN validation service error. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
