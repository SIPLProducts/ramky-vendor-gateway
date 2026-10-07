import { describe, expect, test } from 'bun:test';
import { assessDmsResponse } from './response';

const success = { BP_LIFNR: '0001017577', MSGTYP: 'S', MSGNR: '201', MSG: '400017013 Document Created' };
describe('SAP DMS confirmation', () => {
  test('accepts explicit document creation, directly or through middleware', () => {
    expect(assessDmsResponse(JSON.stringify([success]), 200).confirmed).toBe(true);
    expect(assessDmsResponse(JSON.stringify({ ok: true, sapStatus: 200, sapResponse: [success] }), 200).confirmed).toBe(true);
  });
  test('rejects empty and malformed responses even with HTTP 200', () => {
    for (const body of ['', '[]', 'null', '{}', '<html>OK</html>', '[null]', JSON.stringify({ ok: true, sapStatus: 200, sapResponse: null })]) {
      expect(assessDmsResponse(body, 200).confirmed).toBe(false);
    }
  });
  test('preserves SAP internal error text in plain and wrapped responses', () => {
    const error = 'Action failed. An internal error occurred.';
    for (const body of [error, JSON.stringify(error), JSON.stringify({ ok: true, sapStatus: 200, sapResponse: error })]) {
      const result = assessDmsResponse(body, 200);
      expect(result.confirmed).toBe(false);
      expect(result.message).toBe(error);
    }
  });
  test('HTTP failures and mixed rows never confirm a whole batch', () => {
    expect(assessDmsResponse(JSON.stringify([success]), 500).confirmed).toBe(false);
    expect(assessDmsResponse(JSON.stringify({ ok: true, sapStatus: 500, sapResponse: [success] }), 200).confirmed).toBe(false);
    expect(assessDmsResponse(JSON.stringify({ ok: false, sapStatus: 200, sapResponse: [success] }), 200).confirmed).toBe(false);
    const mixed = assessDmsResponse(JSON.stringify([success, { MSGTYP: 'E', MSG: 'Document not saved' }]), 200);
    expect(mixed.confirmed).toBe(false);
    expect(mixed.message).toBe('Document not saved');
  });
  test('rejects the previously misleading application success envelope', () => {
    expect(assessDmsResponse(JSON.stringify({ success: true, message: '1/1 vendor(s) uploaded to DMS', results: [{ success: true, sap: null, sapRows: [] }] }), 200).confirmed).toBe(false);
  });
});