export type ActionRow = { action: string; stage?: string | null; acted_at: string; started_at?: string | null };

export function classifyAction(action: string): 'Approved' | 'Rejected' | 'Returned' | 'Other' {
  const a = (action || '').toLowerCase();
  if (a.includes('reject')) return 'Rejected';
  if (a.includes('return') || a.includes('clarif')) return 'Returned';
  if (a.includes('approv')) return 'Approved';
  return 'Other';
}

export function countByType(rows: ActionRow[]) {
  const out = { Approved: 0, Rejected: 0, Returned: 0, Other: 0 };
  rows.forEach((r) => { out[classifyAction(r.action)]++; });
  return out;
}

/** Average hours between started_at and acted_at, ignoring rows without a start. Returns null when none. */
export function avgHours(rows: ActionRow[]): number | null {
  const d = rows
    .filter((r) => r.started_at && r.acted_at)
    .map((r) => (new Date(r.acted_at).getTime() - new Date(r.started_at as string).getTime()) / 36e5)
    .filter((h) => h >= 0);
  if (!d.length) return null;
  return Math.round((d.reduce((s, h) => s + h, 0) / d.length) * 10) / 10;
}

export function byMonth(dates: string[]) {
  const m = new Map<string, number>();
  dates.forEach((d) => {
    const dt = new Date(d); if (isNaN(dt.getTime())) return;
    const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, count]) => {
    const [y, mo] = k.split('-');
    return { month: `${mo}-${y}`, count };
  });
}

export function titleCase(s: string) {
  return (s || '').replace(/_/g, ' ').replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
