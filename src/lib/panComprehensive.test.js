import { describe, expect, test } from 'bun:test';
import { formatAadhaarLinkedForPan } from './panComprehensive.ts';

describe('aadhaar link display by PAN 4th char', () => {
  test('P PAN shows existing status', () => expect(formatAadhaarLinkedForPan('BRXPM1752N', true)).toBe('Aadhaar Linked with PAN'));
  test('C PAN shows N/A', () => expect(formatAadhaarLinkedForPan('AALCV5456F', true)).toBe('N/A'));
});
