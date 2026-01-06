import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NameMatchValidationRequest {
  vendorName: string;
  gstLegalName: string;
  bankAccountName?: string;
  threshold?: number;
}

interface NameMatchValidationResponse {
  valid: boolean;
  message: string;
  data?: {
    vendorName: string;
    gstLegalName: string;
    bankAccountName?: string;
    gstMatchScore: number;
    bankMatchScore?: number;
    overallScore: number;
    threshold: number;
    matchDetails: {
      exactMatch: boolean;
      wordMatchCount: number;
      totalWords: number;
      suffixNormalized: boolean;
    };
  };
}

// Common business suffixes to normalize
const businessSuffixes = [
  'private limited', 'pvt ltd', 'pvt. ltd.', 'pvt. ltd', 'pvt ltd.',
  'limited', 'ltd', 'ltd.', 'llp', 'l.l.p', 'l.l.p.',
  'incorporated', 'inc', 'inc.', 'corporation', 'corp', 'corp.',
  'company', 'co', 'co.', 'partnership', 'proprietorship',
  '& co', '& company', 'and company', 'enterprises', 'enterprise',
  'industries', 'industry', 'solutions', 'services', 'consultants',
  'associates', 'group', 'holdings', 'india', 'international',
];

// Normalize text for comparison
function normalizeText(text: string): string {
  let normalized = text.toLowerCase().trim();
  
  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// Remove business suffixes for comparison
function removeBusinessSuffixes(text: string): string {
  let result = normalizeText(text);
  
  // Sort suffixes by length (longest first) to avoid partial replacements
  const sortedSuffixes = [...businessSuffixes].sort((a, b) => b.length - a.length);
  
  for (const suffix of sortedSuffixes) {
    const regex = new RegExp(`\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    result = result.replace(regex, '');
  }
  
  return result.trim();
}

// Calculate Levenshtein distance
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

// Word-based matching score
function wordMatchScore(str1: string, str2: string): { score: number; matchCount: number; totalWords: number } {
  const words1 = str1.split(' ').filter(w => w.length > 1);
  const words2 = str2.split(' ').filter(w => w.length > 1);
  
  if (words1.length === 0 || words2.length === 0) {
    return { score: 0, matchCount: 0, totalWords: 0 };
  }
  
  let matchCount = 0;
  const usedIndices = new Set<number>();
  
  for (const w1 of words1) {
    for (let i = 0; i < words2.length; i++) {
      if (usedIndices.has(i)) continue;
      
      const w2 = words2[i];
      
      // Exact match
      if (w1 === w2) {
        matchCount++;
        usedIndices.add(i);
        break;
      }
      
      // Substring match (for abbreviations)
      if (w1.length >= 3 && w2.length >= 3) {
        if (w1.includes(w2) || w2.includes(w1)) {
          matchCount += 0.8;
          usedIndices.add(i);
          break;
        }
      }
      
      // Fuzzy match (allow 1 character difference for long words)
      if (w1.length >= 5 && w2.length >= 5) {
        const distance = levenshteinDistance(w1, w2);
        if (distance <= 1) {
          matchCount += 0.9;
          usedIndices.add(i);
          break;
        }
      }
    }
  }
  
  const totalWords = Math.max(words1.length, words2.length);
  const score = (matchCount / totalWords) * 100;
  
  return { score: Math.round(score), matchCount: Math.round(matchCount), totalWords };
}

// Calculate overall similarity score
function calculateSimilarity(name1: string, name2: string): { 
  score: number; 
  exactMatch: boolean; 
  wordMatchCount: number; 
  totalWords: number; 
  suffixNormalized: boolean 
} {
  const normalized1 = normalizeText(name1);
  const normalized2 = normalizeText(name2);
  
  // Check for exact match
  if (normalized1 === normalized2) {
    return { 
      score: 100, 
      exactMatch: true, 
      wordMatchCount: normalized1.split(' ').length, 
      totalWords: normalized1.split(' ').length, 
      suffixNormalized: false 
    };
  }
  
  // Try without business suffixes
  const stripped1 = removeBusinessSuffixes(name1);
  const stripped2 = removeBusinessSuffixes(name2);
  const suffixNormalized = stripped1 !== normalized1 || stripped2 !== normalized2;
  
  if (stripped1 === stripped2) {
    return { 
      score: 98, 
      exactMatch: false, 
      wordMatchCount: stripped1.split(' ').length, 
      totalWords: stripped1.split(' ').length, 
      suffixNormalized: true 
    };
  }
  
  // Word-based matching (weighted 60%)
  const wordMatch = wordMatchScore(stripped1, stripped2);
  
  // Levenshtein-based similarity (weighted 40%)
  const distance = levenshteinDistance(stripped1, stripped2);
  const maxLen = Math.max(stripped1.length, stripped2.length);
  const levenshteinScore = maxLen > 0 ? ((maxLen - distance) / maxLen) * 100 : 0;
  
  // Combined score
  const combinedScore = Math.round(wordMatch.score * 0.6 + levenshteinScore * 0.4);
  
  return { 
    score: combinedScore, 
    exactMatch: false, 
    wordMatchCount: wordMatch.matchCount, 
    totalWords: wordMatch.totalWords, 
    suffixNormalized 
  };
}

// Simulate API delay
function simulateApiDelay(): Promise<void> {
  const delay = Math.random() * 200 + 100; // 100-300ms (fast local computation)
  return new Promise(resolve => setTimeout(resolve, delay));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vendorName, gstLegalName, bankAccountName, threshold = 80 }: NameMatchValidationRequest = await req.json();
    console.log(`[Name Match] Comparing: "${vendorName}" vs GST: "${gstLegalName}"${bankAccountName ? ` vs Bank: "${bankAccountName}"` : ''}`);

    if (!vendorName || !gstLegalName) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Both vendor name and GST legal name are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Simulate processing delay
    await simulateApiDelay();

    // Calculate GST name match
    const gstMatch = calculateSimilarity(vendorName, gstLegalName);
    
    // Calculate Bank name match if provided
    let bankMatch = null;
    if (bankAccountName) {
      bankMatch = calculateSimilarity(vendorName, bankAccountName);
    }
    
    // Calculate overall score (average if bank name provided)
    const overallScore = bankMatch 
      ? Math.round((gstMatch.score + bankMatch.score) / 2)
      : gstMatch.score;
    
    const isValid = overallScore >= threshold;
    
    console.log(`[Name Match] GST Score: ${gstMatch.score}%, Bank Score: ${bankMatch?.score || 'N/A'}%, Overall: ${overallScore}%, Valid: ${isValid}`);

    const response: NameMatchValidationResponse = {
      valid: isValid,
      message: isValid 
        ? `Name match verified: ${overallScore}% (Threshold: ${threshold}%)`
        : `Name match failed: ${overallScore}% is below ${threshold}% threshold`,
      data: {
        vendorName,
        gstLegalName,
        bankAccountName: bankAccountName || undefined,
        gstMatchScore: gstMatch.score,
        bankMatchScore: bankMatch?.score,
        overallScore,
        threshold,
        matchDetails: {
          exactMatch: gstMatch.exactMatch,
          wordMatchCount: gstMatch.wordMatchCount,
          totalWords: gstMatch.totalWords,
          suffixNormalized: gstMatch.suffixNormalized,
        },
      },
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[Name Match] Error:', error);
    return new Response(
      JSON.stringify({ valid: false, message: 'Name match validation service error. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
