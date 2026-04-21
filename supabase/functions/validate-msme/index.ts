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

// Simulation mode check
function shouldUseSimulation(): boolean {
  const useSimulation = Deno.env.get('USE_SIMULATION_MODE');
  const clientId = Deno.env.get('CASHFREE_CLIENT_ID');
  const clientSecret = Deno.env.get('CASHFREE_CLIENT_SECRET');
  
  // Use simulation if explicitly enabled OR if credentials are not configured
  return useSimulation === 'true' || !clientId || !clientSecret;
}

// Simulated MSME validation for development/testing
function simulateMSMEValidation(udyamNumber: string, enterpriseName?: string): { valid: boolean; message: string; data: any } {
  const stateCode = udyamNumber.substring(6, 8);
  
  // Simulate valid response for properly formatted Udyam numbers
  return {
    valid: true,
    message: 'MSME certificate verified - Micro Enterprise (Simulated)',
    data: {
      udyamNumber: udyamNumber,
      enterpriseName: enterpriseName || 'Simulated Enterprise Pvt Ltd',
      enterpriseType: 'Micro',
      category: 'Manufacturing',
      classification: 'Micro Enterprise',
      registrationDate: '2021-07-01',
      validUpto: '2026-12-31',
      state: stateCodeMap[stateCode] || 'Unknown',
      district: 'Simulated District',
      address: 'Simulated Address, India',
      nicCode: '26',
      nicDescription: 'Manufacture of computer, electronic and optical products',
      status: 'Active',
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { msmeNumber, enterpriseName }: MSMEValidationRequest = await req.json();
    const useSimulation = shouldUseSimulation();
    console.log(`[MSME Validation] Validating: ${msmeNumber}, simulation: ${useSimulation}`);

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

    // Use simulation mode if enabled or credentials not configured
    if (useSimulation) {
      console.log(`[MSME Validation] Using simulation mode for ${cleanNumber}`);
      const simulatedResult = simulateMSMEValidation(cleanNumber, enterpriseName);
      return new Response(
        JSON.stringify(simulatedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Extract state code
    const stateCode = cleanNumber.substring(6, 8);

    // Call Cashfree MSME/Udyam Verification API with header-based auth
    const clientId = Deno.env.get('CASHFREE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('CASHFREE_CLIENT_SECRET')!;
    
    const baseUrl = 'https://sandbox.cashfree.com/verification';
    console.log(`[MSME Validation] Calling Cashfree API at ${baseUrl}/udyam`);
    const verifyResponse = await fetch(`${baseUrl}/udyam`, {
      method: 'POST',
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
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
