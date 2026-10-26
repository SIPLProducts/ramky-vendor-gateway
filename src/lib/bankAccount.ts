/** Bank account numbers may be alphanumeric (e.g. SBLNSTN15506): 8–18 letters/digits. */
export function normalizeBankAccount(v: string): string {
  return String(v ?? "").replace(/\s+/g, "").toUpperCase();
}

export function isValidBankAccount(v: string): boolean {
  return /^[A-Z0-9]{8,18}$/.test(normalizeBankAccount(v));
}

export const BANK_ACCOUNT_ERROR = "Enter a valid account number (8–18 letters or digits).";
