import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NameMatchValidationRequest {
  vendorName: string;
  gstLegalName: string;
  threshold?: number;
}

interface NameMatchValidationResponse {
  valid: boolean;
  message: string;
  data?: {
    vendorName: string;
    gstLegalName: string;
    matchScore: number;
    threshold: number;
  };
}

// Normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim();
}

// Calculate Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create 2D array
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

// Calculate similarity percentage
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);
  
  // Exact match
  if (normalized1 === normalized2) return 100;
  
  // Empty string check
  if (!normalized1 || !normalized2) return 0;
  
  // Substring check (one contains the other)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const shorter = Math.min(normalized1.length, normalized2.length);
    const longer = Math.max(normalized1.length, normalized2.length);
    return Math.round((shorter / longer) * 100);
  }
  
  // Word-based matching
  const words1 = normalized1.split(' ').filter(w => w.length > 1);
  const words2 = normalized2.split(' ').filter(w => w.length > 1);
  
  let matchingWords = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchingWords++;
        break;
      }
    }
  }
  
  const wordMatchScore = (matchingWords / Math.max(words1.length, words2.length)) * 50;
  
  // Levenshtein-based similarity
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLen = Math.max(normalized1.length, normalized2.length);
  const levenshteinScore = ((maxLen - distance) / maxLen) * 50;
  
  return Math.round(wordMatchScore + levenshteinScore);
}

// Remove common business suffixes for better matching
function removeBusinessSuffixes(name: string): string {
  const suffixes = [
    'private limited', 'pvt ltd', 'pvt. ltd.', 'pvt. ltd', 'pvt ltd.',
    'limited', 'ltd', 'ltd.',
    'llp', 'l.l.p', 'l.l.p.',
    'incorporated', 'inc', 'inc.',
    'corporation', 'corp', 'corp.',
    'company', 'co', 'co.',
    'partnership', 'proprietorship',
    '& co', '& company',
  ];
  
  let result = name.toLowerCase();
  for (const suffix of suffixes) {
    result = result.replace(new RegExp(`\\s*${suffix.replace(/\./g, '\\.')}\\s*$`, 'i'), '');
  }
  
  return result.trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vendorName, gstLegalName, threshold = 80 }: NameMatchValidationRequest = await req.json();

    if (!vendorName || !gstLegalName) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Both vendor name and GST legal name are required' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Calculate similarity with and without business suffixes
    const directScore = calculateSimilarity(vendorName, gstLegalName);
    const strippedScore = calculateSimilarity(
      removeBusinessSuffixes(vendorName),
      removeBusinessSuffixes(gstLegalName)
    );
    
    // Use the higher score
    const matchScore = Math.max(directScore, strippedScore);
    const isValid = matchScore >= threshold;

    const response: NameMatchValidationResponse = {
      valid: isValid,
      message: isValid 
        ? `Name match score: ${matchScore}% (Above threshold)` 
        : `Name match score: ${matchScore}% (Below ${threshold}% threshold)`,
      data: {
        vendorName,
        gstLegalName,
        matchScore,
        threshold,
      },
    };

    console.log(`Name Match Validation: "${vendorName}" vs "${gstLegalName}" = ${matchScore}%`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Name Match Validation Error:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: 'Name match validation service error. Please try again.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});