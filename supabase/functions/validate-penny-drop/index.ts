import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PennyDropRequest {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  vendorName: string;
  amount?: number; // Usually ₹1
}

interface PennyDropResponse {
  success: boolean;
  verified: boolean;
  message: string;
  data?: {
    transactionId: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branchName: string;
    accountHolderName: string;
    nameMatchScore: number;
    nameMatchStatus: 'exact' | 'partial' | 'mismatch';
    accountStatus: 'active' | 'inactive' | 'closed' | 'dormant';
    accountType: string;
    transferAmount: number;
    transferStatus: 'success' | 'failed' | 'pending';
    transferTimestamp: string;
    utrNumber: string;
    responseTime: number;
  };
  stages?: {
    stage: string;
    status: 'completed' | 'in_progress' | 'pending' | 'failed';
    message: string;
    timestamp: string;
  }[];
}

// Bank code mapping
const bankCodeMap: Record<string, string> = {
  'HDFC': 'HDFC Bank',
  'ICIC': 'ICICI Bank',
  'SBIN': 'State Bank of India',
  'AXIS': 'Axis Bank',
  'KKBK': 'Kotak Mahindra Bank',
  'UTIB': 'Axis Bank',
  'PUNB': 'Punjab National Bank',
  'BARB': 'Bank of Baroda',
  'CNRB': 'Canara Bank',
  'UBIN': 'Union Bank of India',
  'IDFB': 'IDFC First Bank',
  'YESB': 'Yes Bank',
  'INDB': 'IndusInd Bank',
  'FDRL': 'Federal Bank',
};

// Mock IFSC database
const mockIFSCDatabase: Record<string, { branch: string; city: string; state: string }> = {
  'HDFC0001234': { branch: 'Andheri West', city: 'Mumbai', state: 'Maharashtra' },
  'ICIC0002345': { branch: 'MG Road', city: 'Bangalore', state: 'Karnataka' },
  'SBIN0003456': { branch: 'Connaught Place', city: 'New Delhi', state: 'Delhi' },
  'AXIS0004567': { branch: 'Gurgaon Main', city: 'Gurgaon', state: 'Haryana' },
  'KKBK0005678': { branch: 'Bandra Kurla Complex', city: 'Mumbai', state: 'Maharashtra' },
};

function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `PD${timestamp}${random}`.toUpperCase();
}

function generateUTR(): string {
  const bankCode = 'HDFC';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  return `${bankCode}${date}${random}`;
}

function calculateNameMatchScore(name1: string, name2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  if (n1 === n2) return 100;
  
  const words1 = n1.split(/\s+/);
  const words2 = n2.split(/\s+/);
  
  let matchCount = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
        matchCount++;
        break;
      }
    }
  }
  
  return Math.round((matchCount / Math.max(words1.length, words2.length)) * 100);
}

function getNameMatchStatus(score: number): 'exact' | 'partial' | 'mismatch' {
  if (score >= 95) return 'exact';
  if (score >= 70) return 'partial';
  return 'mismatch';
}

async function simulatePennyDropProcess(
  accountNumber: string,
  ifscCode: string,
  accountHolderName: string,
  vendorName: string,
  amount: number
): Promise<PennyDropResponse> {
  const stages: PennyDropResponse['stages'] = [];
  const transactionId = generateTransactionId();
  const bankCode = ifscCode.substring(0, 4);
  const bankName = bankCodeMap[bankCode] || 'Unknown Bank';
  const branchInfo = mockIFSCDatabase[ifscCode] || { branch: 'Main Branch', city: 'City', state: 'State' };
  
  // Stage 1: IFSC Validation
  await new Promise(resolve => setTimeout(resolve, 300));
  stages.push({
    stage: 'IFSC Validation',
    status: 'completed',
    message: `IFSC ${ifscCode} validated - ${bankName}, ${branchInfo.branch}`,
    timestamp: new Date().toISOString(),
  });

  // Stage 2: Account Lookup
  await new Promise(resolve => setTimeout(resolve, 400));
  stages.push({
    stage: 'Account Lookup',
    status: 'completed',
    message: `Account ${accountNumber.slice(0, 4)}****${accountNumber.slice(-4)} found in bank records`,
    timestamp: new Date().toISOString(),
  });

  // Stage 3: IMPS Transfer Initiation
  await new Promise(resolve => setTimeout(resolve, 500));
  stages.push({
    stage: 'IMPS Transfer',
    status: 'completed',
    message: `₹${amount.toFixed(2)} transfer initiated via IMPS`,
    timestamp: new Date().toISOString(),
  });

  // Simulate occasional failures for demo
  const lastDigit = parseInt(accountNumber.slice(-1));
  if (lastDigit === 9) {
    stages.push({
      stage: 'Transfer Confirmation',
      status: 'failed',
      message: 'Account is inactive or closed. Transfer failed.',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      verified: false,
      message: 'Penny drop verification failed - Account appears to be inactive',
      stages,
    };
  }

  // Stage 4: Transfer Confirmation
  await new Promise(resolve => setTimeout(resolve, 600));
  const utrNumber = generateUTR();
  stages.push({
    stage: 'Transfer Confirmation',
    status: 'completed',
    message: `Transfer successful. UTR: ${utrNumber}`,
    timestamp: new Date().toISOString(),
  });

  // Stage 5: Name Matching
  await new Promise(resolve => setTimeout(resolve, 300));
  const nameMatchScore = calculateNameMatchScore(vendorName, accountHolderName);
  const nameMatchStatus = getNameMatchStatus(nameMatchScore);
  stages.push({
    stage: 'Name Verification',
    status: nameMatchScore >= 70 ? 'completed' : 'failed',
    message: `Name match score: ${nameMatchScore}% (${nameMatchStatus})`,
    timestamp: new Date().toISOString(),
  });

  const verified = nameMatchScore >= 70;

  return {
    success: true,
    verified,
    message: verified 
      ? 'Penny drop verification completed successfully' 
      : 'Penny drop completed but name mismatch detected',
    data: {
      transactionId,
      accountNumber: `${accountNumber.slice(0, 4)}****${accountNumber.slice(-4)}`,
      ifscCode,
      bankName,
      branchName: branchInfo.branch,
      accountHolderName: accountHolderName.toUpperCase(),
      nameMatchScore,
      nameMatchStatus,
      accountStatus: 'active',
      accountType: 'Current Account',
      transferAmount: amount,
      transferStatus: 'success',
      transferTimestamp: new Date().toISOString(),
      utrNumber,
      responseTime: 2100, // Total simulated time in ms
    },
    stages,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      accountNumber, 
      ifscCode, 
      accountHolderName, 
      vendorName,
      amount = 1 
    }: PennyDropRequest = await req.json();

    console.log(`[Penny Drop] Starting verification for account: ${accountNumber}`);

    if (!accountNumber || !ifscCode || !accountHolderName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          verified: false,
          message: 'Missing required fields: accountNumber, ifscCode, accountHolderName' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate IFSC format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscCode.toUpperCase())) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          verified: false,
          message: 'Invalid IFSC code format' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Validate account number (9-18 digits)
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          verified: false,
          message: 'Invalid account number format (should be 9-18 digits)' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Run simulation
    const result = await simulatePennyDropProcess(
      accountNumber,
      ifscCode.toUpperCase(),
      accountHolderName,
      vendorName || accountHolderName,
      amount
    );

    console.log(`[Penny Drop] Verification complete: ${result.verified ? 'SUCCESS' : 'FAILED'}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Penny Drop] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        verified: false,
        message: 'Penny drop service error. Please try again.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
