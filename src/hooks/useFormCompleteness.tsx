import { useMemo } from 'react';
import type { VendorFormData } from '@/types/vendor';
import type { VerifiedDocumentData } from '@/components/vendor/steps/DocumentVerificationStep';

interface StepCompleteness {
  step: number;
  filled: number;
  total: number;
  percent: number;
}

/**
 * Lightweight per-step completeness scoring.
 * Counts how many of the "important" fields per step are non-empty.
 * Pure presentation — no validation semantics.
 */
export function useFormCompleteness(
  formData: VendorFormData,
  verifiedData?: VerifiedDocumentData,
) {
  return useMemo(() => {
    const isFilled = (v: unknown): boolean => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (typeof v === 'boolean') return true;
      if (typeof v === 'number') return true;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return false;
    };

    const score = (fields: unknown[]): { filled: number; total: number; percent: number } => {
      const total = fields.length;
      const filled = fields.filter(isFilled).length;
      const percent = total === 0 ? 0 : Math.round((filled / total) * 100);
      return { filled, total, percent };
    };

    const o = formData.organization;
    const a = formData.address;
    const c = formData.contact;
    const s = formData.statutory;
    const b = formData.bank;
    const f = formData.financial;
    const i = formData.infrastructure;

    const steps: StepCompleteness[] = [
      // Step 1 — Document Verification (3 mandatory verifications)
      {
        step: 1,
        ...score([verifiedData?.pan, verifiedData?.gst, verifiedData?.bank]),
      },
      // Step 2 — Organization
      {
        step: 2,
        ...score([o.legalName, o.tradeName, o.industryType, o.organizationType, o.productCategories]),
      },
      // Step 3 — Address
      {
        step: 3,
        ...score([a.registeredAddress, a.registeredCity, a.registeredState, a.registeredPincode]),
      },
      // Step 4 — Contact
      {
        step: 4,
        ...score([c.ceoName, c.ceoEmail, c.ceoPhone, c.marketingName || c.customerServiceName]),
      },
      // Step 5 — Commercial / Statutory
      {
        step: 5,
        ...score([
          s.pan,
          // GST handled either via gstin or self-declaration
          s.isGstRegistered ? s.gstin : s.gstSelfDeclarationFile || s.gstDeclarationReason,
          // MSME — answered if flag false, or filled if true
          s.isMsmeRegistered ? s.msmeNumber : true,
          s.entityType,
        ]),
      },
      // Step 6 — Bank
      {
        step: 6,
        ...score([b.bankName, b.accountNumber, b.ifscCode, b.accountType]),
      },
      // Step 7 — Financial & Infrastructure
      {
        step: 7,
        ...score([f.turnoverYear1, f.creditPeriodExpected, i.rawMaterialsUsed || i.productionCapacity]),
      },
      // Step 8 — Review (always 100% by definition once reached)
      { step: 8, filled: 1, total: 1, percent: 100 },
    ];

    const totalFilled = steps.slice(0, 7).reduce((acc, s) => acc + s.filled, 0);
    const totalFields = steps.slice(0, 7).reduce((acc, s) => acc + s.total, 0);
    const overall = totalFields === 0 ? 0 : Math.round((totalFilled / totalFields) * 100);

    return { steps, overall };
  }, [formData, verifiedData]);
}
