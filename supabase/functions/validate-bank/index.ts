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

interface BankValidationResponse {
  valid: boolean;
  message: string;
  data?: {
    accountHolderName?: string;
    accountNumber?: string;
    bankName?: string;
    branchName?: string;
    branchCity?: string;
    ifscCode?: string;
    accountType?: string;
    nameMatchScore?: number;
    pennyDropStatus?: string;
    pennyDropAmount?: string;
    transactionId?: string;
  };
}

// IFSC code format validation
function isValidIFSCFormat(ifsc: string): boolean {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc);
}

// Bank code mapping (first 4 chars of IFSC)
const bankCodeMap: Record<string, { name: string; fullName: string }> = {
  'SBIN': { name: 'SBI', fullName: 'State Bank of India' },
  'HDFC': { name: 'HDFC', fullName: 'HDFC Bank Ltd' },
  'ICIC': { name: 'ICICI', fullName: 'ICICI Bank Ltd' },
  'AXIS': { name: 'Axis', fullName: 'Axis Bank Ltd' },
  'KKBK': { name: 'Kotak', fullName: 'Kotak Mahindra Bank Ltd' },
  'PUNB': { name: 'PNB', fullName: 'Punjab National Bank' },
  'BARB': { name: 'BOB', fullName: 'Bank of Baroda' },
  'CNRB': { name: 'Canara', fullName: 'Canara Bank' },
  'UBIN': { name: 'Union', fullName: 'Union Bank of India' },
  'INDB': { name: 'IndusInd', fullName: 'IndusInd Bank Ltd' },
  'YESB': { name: 'Yes', fullName: 'Yes Bank Ltd' },
  'IBKL': { name: 'IDBI', fullName: 'IDBI Bank Ltd' },
  'FDRL': { name: 'Federal', fullName: 'Federal Bank Ltd' },
  'UTIB': { name: 'Axis', fullName: 'Axis Bank Ltd' },
  'BKID': { name: 'BOI', fullName: 'Bank of India' },
  'IOBA': { name: 'IOB', fullName: 'Indian Overseas Bank' },
  'CBIN': { name: 'Central', fullName: 'Central Bank of India' },
  'UCBA': { name: 'UCO', fullName: 'UCO Bank' },
  'KSBL': { name: 'Kotak', fullName: 'Kotak Mahindra Bank Ltd' },
};

// Mock IFSC database with branch details
const mockIFSCDatabase: Record<string, { branch: string; city: string; state: string }> = {
  'HDFC0001234': { branch: 'Jubilee Hills', city: 'Hyderabad', state: 'Telangana' },
  'ICIC0001234': { branch: 'Steel City', city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  'SBIN0001234': { branch: 'Anna Nagar', city: 'Chennai', state: 'Tamil Nadu' },
  'UTIB0001234': { branch: 'MG Road', city: 'Bangalore', state: 'Karnataka' },
  'KKBK0001234': { branch: 'Hinjewadi', city: 'Pune', state: 'Maharashtra' },
  'YESB0001234': { branch: 'Fort', city: 'Mumbai', state: 'Maharashtra' },
  'PUNB0001234': { branch: 'DLF Phase 1', city: 'Gurgaon', state: 'Haryana' },
};

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

  // Substring match bonus
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

// Simulate API delay
function simulateApiDelay(): Promise<void> {
  const delay = Math.random() * 800 + 500; // 500-1300ms (bank APIs are slower)
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Generate mock transaction ID
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN${timestamp}${random}`;
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

    // Get bank info
    const bankCode = upperIFSC.substring(0, 4);
    const bankInfo = bankCodeMap[bankCode] || { name: 'Unknown Bank', fullName: 'Unknown Bank' };
    const branchInfo = mockIFSCDatabase[upperIFSC] || { branch: 'Main Branch', city: 'Unknown', state: 'Unknown' };

    // Simulate API delay (penny drop takes time)
    await simulateApiDelay();

    // Simulate various scenarios based on account number patterns
    const lastDigit = parseInt(cleanAccountNumber.slice(-1));
    
    // Scenario 1: Invalid account (ends with 0)
    if (lastDigit === 0) {
      console.log(`[Bank Validation] Account not found: ****${cleanAccountNumber.slice(-4)}`);
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'Bank account not found. Please verify account number and IFSC code.',
          data: {
            bankName: bankInfo.fullName,
            branchName: branchInfo.branch,
            ifscCode: upperIFSC,
            pennyDropStatus: 'Failed',
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Scenario 2: Account found but name mismatch (ends with 1 or 2)
    if (lastDigit === 1 || lastDigit === 2) {
      const bankAccountName = 'DIFFERENT NAME PVT LTD';
      const nameMatchScore = calculateNameMatchScore(accountHolderName || '', bankAccountName);
      
      console.log(`[Bank Validation] Name mismatch: ${nameMatchScore}%`);
      return new Response(
        JSON.stringify({
          valid: false,
          message: `Account verified but name mismatch (${nameMatchScore}% match). Bank records show different name.`,
          data: {
            accountHolderName: bankAccountName,
            accountNumber: `XXXX${cleanAccountNumber.slice(-4)}`,
            bankName: bankInfo.fullName,
            branchName: branchInfo.branch,
            branchCity: branchInfo.city,
            ifscCode: upperIFSC,
            accountType: 'Current',
            nameMatchScore,
            pennyDropStatus: 'Success',
            pennyDropAmount: '₹1.00',
            transactionId: generateTransactionId(),
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Scenario 3: Successful verification
    const mockBankAccountName = accountHolderName?.toUpperCase() || 'ACCOUNT HOLDER NAME';
    const nameMatchScore = calculateNameMatchScore(accountHolderName || '', mockBankAccountName);
    const isValid = nameMatchScore >= 80;
    const transactionId = generateTransactionId();

    console.log(`[Bank Validation] ${isValid ? 'SUCCESS' : 'FAILED'}: Score ${nameMatchScore}%, TxnID: ${transactionId}`);

    const response: BankValidationResponse = {
      valid: isValid,
      message: isValid 
        ? `Bank account verified via ₹1 penny drop. Name match: ${nameMatchScore}%`
        : `Name match score (${nameMatchScore}%) is below the required threshold (80%)`,
      data: {
        accountHolderName: mockBankAccountName,
        accountNumber: `XXXX${cleanAccountNumber.slice(-4)}`,
        bankName: bankInfo.fullName,
        branchName: branchInfo.branch,
        branchCity: branchInfo.city,
        ifscCode: upperIFSC,
        accountType: cleanAccountNumber.length <= 11 ? 'Savings' : 'Current',
        nameMatchScore,
        pennyDropStatus: 'Success',
        pennyDropAmount: '₹1.00',
        transactionId,
      },
    };

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
