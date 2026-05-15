/**
 * Shared fuzzy name matcher used across KYC tabs (PAN, MSME, Bank) to compare
 * names returned by different registries. We strip everything that isn't a
 * letter/number/space, lowercase both sides, then check token overlap so
 * "M/s ACME PRIVATE LIMITED" still matches "Acme Pvt Ltd".
 */
function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE_TOKENS = new Set([
  'pvt', 'private', 'ltd', 'limited', 'llp', 'inc', 'incorporated', 'co',
  'company', 'corp', 'corporation', 'm', 's', 'ms', 'the', 'and', 'of',
]);

function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 1 && !NOISE_TOKENS.has(t));
}

/**
 * True if the two names share at least one significant token, OR one is
 * a substring of the other after normalisation. Intentionally lenient —
 * official records often differ in suffixes/initials.
 */
export function fuzzyNameMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const setB = new Set(tb);
  return ta.some((t) => setB.has(t));
}

export function panMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return String(a).toUpperCase().trim() === String(b).toUpperCase().trim();
}

/**
 * Returns a 0-100 similarity score between two names. Uses normalized
 * significant-token overlap (Jaccard-like, divided by the larger token set so
 * that "ACME" vs "ACME PVT LTD" still scores high after noise-token filtering).
 * If either side has no significant tokens, falls back to substring match
 * (100 if one contains the other, 0 otherwise).
 */
export function nameMatchPercentage(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) {
    return na.includes(nb) || nb.includes(na) ? 100 : 0;
  }
  const setB = new Set(tb);
  let common = 0;
  for (const t of ta) if (setB.has(t)) common += 1;
  const denom = Math.max(ta.length, tb.length);
  let score = Math.round((common / denom) * 100);
  // Substring boost — full containment is a strong signal.
  if (na.includes(nb) || nb.includes(na)) score = Math.max(score, 60);
  return score;
}

/**
 * Cross-field name match policy used by the KYC tabs (GST / PAN / MSME / Bank).
 * Any score >= 20 against any reference is treated as a pass; the score is
 * classified into Low / Medium / Strong tiers for messaging.
 */
export const NAME_MATCH_MIN_PASS = 20;

export type MatchLevel = 'low' | 'medium' | 'strong' | 'fail';

export function classifyNameMatch(score: number): MatchLevel {
  if (score >= 70) return 'strong';
  if (score >= 50) return 'medium';
  if (score >= NAME_MATCH_MIN_PASS) return 'low';
  return 'fail';
}

export function matchLevelLabel(level: MatchLevel): string {
  switch (level) {
    case 'strong': return 'Strong Match';
    case 'medium': return 'Medium Match';
    case 'low': return 'Low Match';
    default: return 'No Match';
  }
}

export interface CrossNameReference {
  field: string;                 // e.g. "PAN Holder Name"
  value?: string | null;
}

export interface CrossNameMatchResult {
  /** True when there is at least one reference and best score >= 20. */
  passed: boolean;
  /** True when there were no usable references to compare against. */
  skipped: boolean;
  bestScore: number;
  matches: { field: string; score: number; level: MatchLevel }[];
  best: { field: string; score: number; level: MatchLevel } | null;
}

export function evaluateCrossNameMatch(
  candidate: string | null | undefined,
  references: CrossNameReference[],
): CrossNameMatchResult {
  const usable = (references || []).filter((r) => r && r.value && String(r.value).trim());
  if (!candidate || !candidate.trim() || usable.length === 0) {
    return { passed: false, skipped: true, bestScore: 0, matches: [], best: null };
  }

  const scored = usable.map((r) => {
    const score = nameMatchPercentage(candidate, r.value);
    return { field: r.field, score, level: classifyNameMatch(score) };
  });

  const best = scored.reduce((acc, cur) => (cur.score > acc.score ? cur : acc), scored[0]);
  const matches = scored.filter((s) => s.score >= NAME_MATCH_MIN_PASS);
  return {
    passed: best.score >= NAME_MATCH_MIN_PASS,
    skipped: false,
    bestScore: best.score,
    matches,
    best,
  };
}

/** Format a list of passing matches for a success banner. */
export function formatCrossMatchSuccess(
  candidateLabel: string,
  matches: { field: string; score: number; level: MatchLevel }[],
): string {
  if (!matches.length) return `${candidateLabel} verified.`;
  const parts = matches.map((m) => `${m.field} (${m.score}% — ${matchLevelLabel(m.level)})`);
  return `${candidateLabel} matched with ${parts.join(' and ')}.`;
}

/** Format a failure message when best score is below the gate. */
export function formatCrossMatchFailure(
  candidateLabel: string,
  best: { field: string; score: number } | null,
): string {
  if (!best) return `${candidateLabel} could not be matched against any verified name.`;
  return `${candidateLabel} does not match any of the verified names (best ${best.score}% with ${best.field}). Minimum required is ${NAME_MATCH_MIN_PASS}%.`;
}

