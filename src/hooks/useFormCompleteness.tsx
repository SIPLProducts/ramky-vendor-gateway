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
    const f = formData.financial;
    const i = formData.infrastructure;

    // 6-step flow: 1 Doc Verify, 2 Org (+ statutory/memberships),
    // 3 Address, 4 Contact, 5 Fin/Infra, 6 Review.
    const steps: StepCompleteness[] = [
      // Step 1 — Document Verification (PAN, GST, MSME-or-skip, Bank)
      {
        step: 1,
        ...score([
          verifiedData?.pan,
          verifiedData?.gst || s.gstSelfDeclarationFile,
          verifiedData?.msme || verifiedData?.isMsmeRegistered === false,
          verifiedData?.bank,
        ]),
      },
      // Step 2 — Organization + Statutory & Memberships
      {
        step: 2,
        ...score([
          o.legalName,
          o.tradeName,
          o.industryType,
          o.organizationType,
          o.productCategories,
          s.entityType,
        ]),
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
      // Step 5 — Financial & Infrastructure
      {
        step: 5,
        ...score([f.turnoverYear1, f.creditPeriodExpected, i.rawMaterialsUsed || i.productionCapacity]),
      },
      // Step 6 — Review (always 100% by definition once reached)
      { step: 6, filled: 1, total: 1, percent: 100 },
    ];

    const totalFilled = steps.slice(0, 5).reduce((acc, s) => acc + s.filled, 0);
    const totalFields = steps.slice(0, 5).reduce((acc, s) => acc + s.total, 0);
    const overall = totalFields === 0 ? 0 : Math.round((totalFilled / totalFields) * 100);

    return { steps, overall };
  }, [formData, verifiedData]);
}
