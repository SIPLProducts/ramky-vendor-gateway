import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GSTValidationRequest {
  gstin: string;
  legalName: string;
}

// GST number format validation
function isValidGSTINFormat(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}

// Get Cashfree auth token
async function getCashfreeToken(): Promise<string> {
  const clientId = Deno.env.get('CASHFREE_CLIENT_ID');
  const clientSecret = Deno.env.get('CASHFREE_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Cashfree credentials not configured');
  }

  const response = await fetch('https://api.cashfree.com/verification/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId,
      clientSecret,
    }),
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

    // Call Cashfree GST Verification API
    const token = await getCashfreeToken();
    
    const verifyResponse = await fetch('https://api.cashfree.com/verification/gst', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gstin: upperGSTIN,
      }),
    });

    const verifyData = await verifyResponse.json();
    console.log(`[GST Validation] API Response:`, JSON.stringify(verifyData));

    if (!verifyResponse.ok) {
      console.error(`[GST Validation] API Error:`, verifyData);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: verifyData.message || 'GST verification failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if GST is valid and active
    const isActive = verifyData.status === 'VALID' || verifyData.gstStatus === 'Active';
    const gstData = verifyData.data || verifyData;
    
    const response = {
      valid: isActive,
      message: isActive 
        ? `GST verified successfully - ${gstData.gstStatus || 'Active'}` 
        : `GST verification failed - Status: ${gstData.gstStatus || 'Invalid'}`,
      data: {
        legalName: gstData.legalName || gstData.businessName,
        tradeName: gstData.tradeName || gstData.tradeNam,
        status: gstData.gstStatus || gstData.status,
        registrationDate: gstData.registrationDate || gstData.dateOfRegistration,
        stateCode: upperGSTIN.substring(0, 2),
        taxpayerType: gstData.taxpayerType || gstData.constitutionOfBusiness,
        businessNature: gstData.natureOfBusiness || gstData.principalPlaceOfBusinessNatureOfBusinessActivities,
        principalPlaceOfBusiness: gstData.principalPlaceOfBusiness || gstData.address,
      },
      tradeName: gstData.tradeName || gstData.legalName,
    };

    console.log(`[GST Validation] ${isActive ? 'SUCCESS' : 'FAILED'}: ${upperGSTIN}`);
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
