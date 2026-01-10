import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BankValidationRequest {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
}

// IFSC code format validation
function isValidIFSCFormat(ifsc: string): boolean {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc);
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

// Levenshtein distance for name matching
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
      }
    }
  }
  return dp[m][n];
}

// Calculate name match score
function calculateNameMatchScore(vendorName: string, bankAccountName: string): number {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(pvt|private|ltd|limited|llp|inc|corp|co|company)/g, '')
    .trim();

  const n1 = normalize(vendorName);
  const n2 = normalize(bankAccountName);
  
  if (n1 === n2) return 100;
  if (!n1 || !n2) return 0;

  if (n1.includes(n2) || n2.includes(n1)) {
    const shorter = Math.min(n1.length, n2.length);
    const longer = Math.max(n1.length, n2.length);
    return Math.round(70 + (shorter / longer) * 30);
  }

  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const similarity = ((maxLen - distance) / maxLen) * 100;
  
  return Math.round(Math.max(0, similarity));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountNumber, ifscCode, accountHolderName }: BankValidationRequest = await req.json();
    console.log(`[Bank Validation] Validating account: ****${accountNumber?.slice(-4)} at ${ifscCode}`);

    if (!accountNumber || !ifscCode) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Account number and IFSC code are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const upperIFSC = ifscCode.toUpperCase().trim();
    const cleanAccountNumber = accountNumber.replace(/\s/g, '');
    
    // IFSC format validation
    if (!isValidIFSCFormat(upperIFSC)) {
      console.log(`[Bank Validation] Invalid IFSC format: ${upperIFSC}`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Invalid IFSC code format. Expected format: ABCD0XXXXXX' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Account number length validation
    if (cleanAccountNumber.length < 9 || cleanAccountNumber.length > 18) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Account number must be between 9-18 digits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Call Cashfree Bank Account Verification API (Penny Drop)
    const token = await getCashfreeToken();
    
    const verifyResponse = await fetch('https://api.cashfree.com/verification/bank-account/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bank_account: cleanAccountNumber,
        ifsc: upperIFSC,
        name: accountHolderName,
      }),
    });

    const verifyData = await verifyResponse.json();
    console.log(`[Bank Validation] API Response:`, JSON.stringify(verifyData));

    if (!verifyResponse.ok) {
      console.error(`[Bank Validation] API Error:`, verifyData);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: verifyData.message || 'Bank verification failed',
          data: {
            pennyDropStatus: 'Failed',
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Process response
    const bankData = verifyData.data || verifyData;
    const accountExists = bankData.account_status === 'VALID' || verifyData.status === 'SUCCESS';
    const bankAccountName = bankData.name_at_bank || bankData.registered_name || '';
    
    // Calculate name match score
    const nameMatchScore = bankAccountName 
      ? calculateNameMatchScore(accountHolderName || '', bankAccountName)
      : 0;
    
    const isValid = accountExists && nameMatchScore >= 80;
    
    const response = {
      valid: isValid,
      message: isValid 
        ? `Bank account verified via ₹1 penny drop. Name match: ${nameMatchScore}%`
        : accountExists 
          ? `Account verified but name mismatch (${nameMatchScore}% match)`
          : 'Bank account verification failed',
      data: {
        accountHolderName: bankAccountName,
        accountNumber: `XXXX${cleanAccountNumber.slice(-4)}`,
        bankName: bankData.bank || 'Unknown Bank',
        branchName: bankData.branch || 'Unknown Branch',
        branchCity: bankData.city || '',
        ifscCode: upperIFSC,
        accountType: bankData.account_type || 'Unknown',
        nameMatchScore,
        pennyDropStatus: accountExists ? 'Success' : 'Failed',
        pennyDropAmount: '₹1.00',
        transactionId: bankData.utr || bankData.ref_id || `TXN${Date.now()}`,
      },
    };

    console.log(`[Bank Validation] ${isValid ? 'SUCCESS' : 'FAILED'}: Score ${nameMatchScore}%`);
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[Bank Validation] Error:', error);
    return new Response(
      JSON.stringify({ valid: false, message: 'Bank validation service error. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
