import { describe, expect, test } from 'bun:test';
import { isValidBankAccount, normalizeBankAccount } from './bankAccount.ts';

describe('bank account number', () => {
  test('accepts alphanumeric account SBLNSTN15506', () => expect(isValidBankAccount('SBLNSTN15506')).toBe(true));
  test('accepts numeric account', () => expect(isValidBankAccount('123456789012')).toBe(true));
  test('rejects fewer than 8 characters', () => expect(isValidBankAccount('ab12')).toBe(false));
  test('rejects symbols', () => expect(isValidBankAccount('ABC-123456')).toBe(false));
  test('uppercases and strips spaces', () => expect(normalizeBankAccount('sbln stn15506')).toBe('SBLNSTN15506'));
});
