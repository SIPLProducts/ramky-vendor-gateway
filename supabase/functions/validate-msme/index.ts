import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MSMEValidationRequest {
  msmeNumber: string;
  enterpriseName?: string;
}

// Udyam format validation (new format)
function isValidUdyamFormat(udyamNumber: string): boolean {
  const udyamRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
  return udyamRegex.test(udyamNumber);
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
    const { msmeNumber, enterpriseName }: MSMEValidationRequest = await req.json();
    console.log(`[MSME Validation] Validating: ${msmeNumber}`);

    if (!msmeNumber) {
      return new Response(
        JSON.stringify({ valid: false, message: 'MSME/Udyam number is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const cleanNumber = msmeNumber.toUpperCase().trim();
    
    if (!isValidUdyamFormat(cleanNumber)) {
      console.log(`[MSME Validation] Invalid format: ${cleanNumber}`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Invalid Udyam format. Expected: UDYAM-XX-00-0000000' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Extract state code
    const stateCode = cleanNumber.substring(6, 8);

    // Call Cashfree MSME/Udyam Verification API
    const token = await getCashfreeToken();
    
    const verifyResponse = await fetch('https://api.cashfree.com/verification/udyam', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        udyam_number: cleanNumber,
      }),
    });

    const verifyData = await verifyResponse.json();
    console.log(`[MSME Validation] API Response:`, JSON.stringify(verifyData));

    if (!verifyResponse.ok) {
      console.error(`[MSME Validation] API Error:`, verifyData);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: verifyData.message || 'MSME verification failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Process response
    const msmeData = verifyData.data || verifyData;
    const isValid = verifyData.status === 'VALID' || verifyData.status === 'SUCCESS';
    
    const response = {
      valid: isValid,
      message: isValid 
        ? `MSME certificate verified - ${msmeData.enterprise_type || msmeData.category || 'Active'} Enterprise` 
        : `MSME registration not found or ${verifyData.message}`,
      data: {
        udyamNumber: cleanNumber,
        enterpriseName: msmeData.enterprise_name || msmeData.name || enterpriseName,
        enterpriseType: msmeData.enterprise_type || msmeData.type_of_enterprise,
        category: msmeData.major_activity || msmeData.category,
        classification: msmeData.classification,
        registrationDate: msmeData.date_of_incorporation || msmeData.registration_date,
        validUpto: msmeData.valid_upto || '2026-12-31',
        state: msmeData.state || stateCodeMap[stateCode] || 'Unknown',
        district: msmeData.district,
        address: msmeData.address || msmeData.official_address,
        nicCode: msmeData.nic_2_digit || msmeData.nic_code,
        nicDescription: msmeData.nic_2_digit_desc || msmeData.nic_description,
        status: isValid ? 'Active' : 'Invalid',
      },
    };

    console.log(`[MSME Validation] ${isValid ? 'SUCCESS' : 'FAILED'}: ${cleanNumber}`);
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
