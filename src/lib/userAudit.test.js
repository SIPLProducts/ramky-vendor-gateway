import { describe, expect, test } from 'bun:test';
import { countByType, avgHours, byMonth } from './userAudit.ts';

describe('user audit aggregation', () => {
  test('counts approvals, rejections and returns', () => {
    const r = countByType([{ action: 'approved', acted_at: '' }, { action: 'rejected', acted_at: '' }, { action: 'returned_to_vendor', acted_at: '' }, { action: 'approve', acted_at: '' }]);
    expect(r).toEqual({ Approved: 2, Rejected: 1, Returned: 1, Other: 0 });
  });
  test('average approval time in hours', () => {
    expect(avgHours([
      { action: 'approved', started_at: '2026-01-01T00:00:00Z', acted_at: '2026-01-01T10:00:00Z' },
      { action: 'approved', started_at: '2026-01-01T00:00:00Z', acted_at: '2026-01-01T20:00:00Z' },
      { action: 'approved', acted_at: '2026-01-01T20:00:00Z' },
    ])).toBe(15);
    expect(avgHours([])).toBeNull();
  });
  test('groups by month in date order', () => {
    expect(byMonth(['2026-02-03', '2026-01-05', '2026-02-10'])).toEqual([{ month: '01-2026', count: 1 }, { month: '02-2026', count: 2 }]);
  });
});
