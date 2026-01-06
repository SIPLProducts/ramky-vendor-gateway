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
    panTypeDescription?: string;
    status?: string;
    lastUpdated?: string;
    aadhaarLinked?: boolean;
  };
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

// Mock database of test PANs
const mockPANDatabase: Record<string, { name: string; status: string; aadhaarLinked: boolean }> = {
  'AABCU9603R': { name: 'ABC INFRASTRUCTURE PVT LTD', status: 'Active', aadhaarLinked: true },
  'AABCT3456R': { name: 'TECHSERVE IT SOLUTIONS PVT LTD', status: 'Active', aadhaarLinked: true },
  'AABCM9012R': { name: 'METRO CONSTRUCTIONS LIMITED', status: 'Active', aadhaarLinked: true },
  'AABCG5678R': { name: 'GREENWAY ENVIRONMENTAL SERVICES PVT LTD', status: 'Active', aadhaarLinked: false },
  'AABCX1234R': { name: 'XYZ STEEL CORPORATION', status: 'Active', aadhaarLinked: true },
  'AABCP7890R': { name: 'PREMIUM ELECTRICALS PVT LTD', status: 'Active', aadhaarLinked: true },
  'AABCQ1234R': { name: 'QUICKBUILD CONTRACTORS', status: 'Active', aadhaarLinked: false },
  // Invalid/Fake PAN
  'ZZZZZ9999Z': { name: '', status: 'Invalid', aadhaarLinked: false },
  // Inactive PAN
  'BBBBC1234D': { name: 'OLD INACTIVE COMPANY', status: 'Inactive', aadhaarLinked: false },
};

// Simulate API delay
function simulateApiDelay(): Promise<void> {
  const delay = Math.random() * 400 + 150; // 150-550ms
  return new Promise(resolve => setTimeout(resolve, delay));
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
          message: 'Invalid PAN format. Expected format: AAAAA0000A (5 letters + 4 digits + 1 letter)' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const panTypeInfo = getPANTypeInfo(upperPAN);

    // Simulate API delay
    await simulateApiDelay();

    // Check mock database
    const mockData = mockPANDatabase[upperPAN];
    
    if (mockData) {
      const isValid = mockData.status === 'Active';
      console.log(`[PAN Validation] Found in mock DB: ${upperPAN} - Status: ${mockData.status}`);
      
      return new Response(
        JSON.stringify({
          valid: isValid,
          message: isValid 
            ? `PAN verified successfully - ${mockData.name}` 
            : `PAN verification failed - Status: ${mockData.status}`,
          data: {
            name: mockData.name || 'N/A',
            panType: panTypeInfo.code,
            panTypeDescription: panTypeInfo.description,
            status: mockData.status,
            lastUpdated: new Date().toISOString().split('T')[0],
            aadhaarLinked: mockData.aadhaarLinked,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // For unknown PANs, simulate based on last character
    const lastChar = upperPAN.charAt(9);
    const simulateFailure = ['Z', 'Y'].includes(lastChar); // ~7.7% failure rate

    if (simulateFailure) {
      console.log(`[PAN Validation] Simulated not found: ${upperPAN}`);
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'PAN not found in Income Tax records. Please verify and re-enter.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Generate mock successful response
    const response: PANValidationResponse = {
      valid: true,
      message: 'PAN verified successfully',
      data: {
        name: name?.toUpperCase() || 'PAN HOLDER NAME',
        panType: panTypeInfo.code,
        panTypeDescription: panTypeInfo.description,
        status: 'Active',
        lastUpdated: new Date().toISOString().split('T')[0],
        aadhaarLinked: Math.random() > 0.2, // 80% have Aadhaar linked
      },
    };

    console.log(`[PAN Validation] SUCCESS: ${upperPAN}`);
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
