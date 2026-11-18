import { describe, expect, test } from 'bun:test';
import { pickFilingRows } from './gstFiling.ts';

const row = (p) => ({ return_type: 'GSTR1', financial_year: '2026-2027', tax_period: p, date_of_filing: '2026-11-05', status: 'Filed' });

describe('GST filing row selection', () => {
  test('nested GST_FILING rows win over GST rows', () => {
    const r = pickFilingRows([[row('October'), row('September')]], [row('October')]);
    expect(r.source).toBe('GST_FILING');
    expect(r.rows.length).toBe(2);
  });
  test('empty GST_FILING falls back to flat GST rows', () => {
    const r = pickFilingRows([], [row('October')]);
    expect(r.source).toBe('GST');
    expect(r.rows.length).toBe(1);
  });
  test('both empty gives no rows', () => {
    const r = pickFilingRows(undefined, []);
    expect(r.source).toBe('none');
    expect(r.rows).toEqual([]);
  });
});
