/**
 * Indian Financial Year helpers.
 * Indian FY runs Apr 1 – Mar 31.
 */

export function getCurrentIndianFyStartYear(now: Date = new Date()): number {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0 = Jan
  return m < 3 ? y - 1 : y;
}

export function formatIndianFy(startYear: number): string {
  return `FY ${startYear}-${(startYear + 1).toString().slice(-2)}`;
}

/**
 * Returns the last three COMPLETED Indian financial year start years,
 * oldest first. e.g. on 02-Jul-2026 → [2023, 2024, 2025].
 */
export function getLastThreeCompletedIndianFyStartYears(now: Date = new Date()): [number, number, number] {
  const lastCompleted = getCurrentIndianFyStartYear(now) - 1;
  return [lastCompleted - 2, lastCompleted - 1, lastCompleted];
}
