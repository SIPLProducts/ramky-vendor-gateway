import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type FieldValidationType = 'gst' | 'pan' | 'bank' | 'msme';

export interface FieldValidationState {
  status: 'idle' | 'validating' | 'passed' | 'failed';
  message: string | null;
  data?: Record<string, unknown>;
}

// Utility function to normalize names for comparison
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\b(pvt|private|ltd|limited|llp|inc|corp|co|company|enterprises?|m\/s|ms)\b/g, '') // Remove common business suffixes
    .trim();
}

// Check if two names match (fuzzy matching)
function namesMatch(legalName: string, verifiedName: string): { matches: boolean; score: number } {
  if (!legalName || !verifiedName) {
    return { matches: false, score: 0 };
  }

  const normalized1 = normalizeName(legalName);
  const normalized2 = normalizeName(verifiedName);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return { matches: true, score: 100 };
  }

  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const shorter = Math.min(normalized1.length, normalized2.length);
    const longer = Math.max(normalized1.length, normalized2.length);
    const score = Math.round((shorter / longer) * 100);
    return { matches: score >= 70, score };
  }

  // Calculate similarity using word overlap
  const words1 = normalized1.split(' ').filter(w => w.length > 2);
  const words2 = normalized2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) {
    return { matches: false, score: 0 };
  }

  const commonWords = words1.filter(w => words2.includes(w));
  const score = Math.round((commonWords.length / Math.max(words1.length, words2.length)) * 100);
  
  return { matches: score >= 60, score };
}

interface NotifyFinanceParams {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
}

export function useFieldValidation(vendorId?: string) {
  const { toast } = useToast();
  const [validationStates, setValidationStates] = useState<Record<FieldValidationType, FieldValidationState>>({
    gst: { status: 'idle', message: null },
    pan: { status: 'idle', message: null },
    bank: { status: 'idle', message: null },
    msme: { status: 'idle', message: null },
  });

  const updateValidationState = useCallback((type: FieldValidationType, state: FieldValidationState) => {
    setValidationStates(prev => ({ ...prev, [type]: state }));
  }, []);

  // Save validation result to database
  const saveValidationToDatabase = useCallback(async (
    type: FieldValidationType,
    status: 'passed' | 'failed',
    message: string,
    details: Record<string, unknown>
  ) => {
    if (!vendorId) return; // Only save if we have a vendor ID

    try {
      await supabase.from('vendor_validations').insert([{
        vendor_id: vendorId,
        validation_type: type,
        status,
        message,
        details: details as any,
      }]);
      console.log(`[Validation] Saved ${type} validation to database`);
    } catch (error) {
      console.error(`[Validation] Failed to save ${type} validation:`, error);
    }
  }, [vendorId]);

  const validateGST = useCallback(async (gstin: string, legalName?: string): Promise<boolean> => {
    if (!gstin || gstin.length < 15) {
      updateValidationState('gst', { status: 'failed', message: 'Please enter a valid 15-character GSTIN' });
      return false;
    }

    updateValidationState('gst', { status: 'validating', message: 'Verifying GSTIN with Surepass API...' });

    try {
      const { data, error } = await supabase.functions.invoke('validate-gst', {
        body: { id_number: gstin.toUpperCase().trim() },
      });

      if (error) throw error;

      if (data?.success) {
        const verifiedName = data.data?.legal_name || data.data?.trade_name || 'Verified';
        
        // Check name matching if legalName is provided
        if (legalName) {
          const nameCheck = namesMatch(legalName, verifiedName);
          
          if (!nameCheck.matches) {
            updateValidationState('gst', { 
              status: 'failed', 
              message: `Name mismatch: GSTIN is registered to "${verifiedName}" but your organization name is "${legalName}" (${nameCheck.score}% match)`,
              data: {
                gstin: data.data?.gstin,
                legalName: data.data?.legal_name,
                tradeName: data.data?.trade_name,
                providedName: legalName,
                matchScore: nameCheck.score,
              },
            });
            return false;
          }
        }
        
        updateValidationState('gst', { 
          status: 'passed', 
          message: `GSTIN verified successfully - ${verifiedName}`,
          data: {
            gstin: data.data?.gstin,
            legalName: data.data?.legal_name,
            tradeName: data.data?.trade_name,
            status: data.data?.status,
            registrationDate: data.data?.registration_date,
            stateJurisdiction: data.data?.state_jurisdiction,
            taxpayerType: data.data?.taxpayer_type,
            address: data.data?.address,
          },
        });
        
        // Save to database
        await saveValidationToDatabase('gst', 'passed', `GSTIN verified successfully - ${verifiedName}`, data);
        
        return true;
      } else {
        updateValidationState('gst', { 
          status: 'failed', 
          message: data?.message || data?.error || 'GSTIN verification failed',
        });
        return false;
      }
    } catch (error) {
      updateValidationState('gst', { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'GSTIN verification service unavailable',
      });
      return false;
    }
  }, [updateValidationState]);

  const validatePAN = useCallback(async (pan: string, legalName?: string): Promise<boolean> => {
    if (!pan || pan.length !== 10) {
      updateValidationState('pan', { status: 'failed', message: 'Please enter a valid 10-character PAN' });
      return false;
    }

    updateValidationState('pan', { status: 'validating', message: 'Verifying PAN with Surepass API...' });

    try {
      const { data, error } = await supabase.functions.invoke('verify-pan', {
        body: { id_number: pan.toUpperCase().trim() },
      });

      if (error) throw error;

      if (data?.success) {
        const verifiedName = data.data?.full_name || 'Verified';
        
        // Check name matching if legalName is provided
        if (legalName) {
          const nameCheck = namesMatch(legalName, verifiedName);
          
          if (!nameCheck.matches) {
            updateValidationState('pan', { 
              status: 'failed', 
              message: `Name mismatch: PAN is registered to "${verifiedName}" but your organization name is "${legalName}" (${nameCheck.score}% match)`,
              data: {
                panNumber: data.data?.pan_number,
                fullName: data.data?.full_name,
                providedName: legalName,
                matchScore: nameCheck.score,
              },
            });
            return false;
          }
        }
        
        updateValidationState('pan', { 
          status: 'passed', 
          message: `PAN verified successfully - ${verifiedName}`,
          data: {
            panNumber: data.data?.pan_number,
            fullName: data.data?.full_name,
            category: data.data?.category,
            status: data.data?.status,
          },
        });
        
        // Save to database
        await saveValidationToDatabase('pan', 'passed', `PAN verified successfully - ${verifiedName}`, data);
        
        return true;
      } else {
        updateValidationState('pan', { 
          status: 'failed', 
          message: data?.message || data?.error || 'PAN verification failed',
        });
        return false;
      }
    } catch (error) {
      updateValidationState('pan', { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'PAN verification service unavailable',
      });
      return false;
    }
  }, [updateValidationState]);

  const validateBank = useCallback(async (accountNumber: string, ifscCode: string, legalName?: string): Promise<boolean> => {
    if (!accountNumber || accountNumber.length < 8) {
      updateValidationState('bank', { status: 'failed', message: 'Please enter a valid account number' });
      return false;
    }
    if (!ifscCode || ifscCode.length !== 11) {
      updateValidationState('bank', { status: 'failed', message: 'Please enter a valid 11-character IFSC code' });
      return false;
    }

    updateValidationState('bank', { status: 'validating', message: 'Verifying bank account with Surepass API...' });

    try {
      const { data, error } = await supabase.functions.invoke('validate-bank', {
        body: { 
          id_number: accountNumber.replace(/\s/g, ''),
          ifsc: ifscCode.toUpperCase().trim(),
        },
      });

      if (error) throw error;

      if (data?.success) {
        const nameAtBank = data.data?.name_at_bank || 'Verified';
        
        // Check name matching if legalName is provided
        if (legalName) {
          const nameCheck = namesMatch(legalName, nameAtBank);
          
          if (!nameCheck.matches) {
            updateValidationState('bank', { 
              status: 'failed', 
              message: `Name mismatch: Bank account is registered to "${nameAtBank}" but your organization name is "${legalName}" (${nameCheck.score}% match)`,
              data: {
                accountNumber: data.data?.account_number,
                ifscCode: data.data?.ifsc_code,
                nameAtBank: data.data?.name_at_bank,
                providedName: legalName,
                matchScore: nameCheck.score,
              },
            });
            return false;
          }
        }
        
        updateValidationState('bank', { 
          status: 'passed', 
          message: `Bank account verified successfully - ${nameAtBank}`,
          data: {
            accountNumber: data.data?.account_number,
            ifscCode: data.data?.ifsc_code,
            accountExists: data.data?.account_exists,
            nameAtBank: data.data?.name_at_bank,
            bankName: data.data?.bank_name,
            branchName: data.data?.branch_name,
            city: data.data?.city,
            state: data.data?.state,
            accountType: data.data?.account_type,
          },
        });
        
        // Save to database
        await saveValidationToDatabase('bank', 'passed', `Bank account verified successfully - ${nameAtBank}`, data);
        
        return true;
      } else {
        updateValidationState('bank', { 
          status: 'failed', 
          message: data?.message || data?.error || 'Bank verification failed',
        });
        return false;
      }
    } catch (error) {
      updateValidationState('bank', { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'Bank verification service unavailable',
      });
      return false;
    }
  }, [updateValidationState]);

  const validateMSME = useCallback(async (msmeNumber: string, legalName?: string): Promise<boolean> => {
    if (!msmeNumber) {
      updateValidationState('msme', { status: 'failed', message: 'Please enter MSME/Udyam number' });
      return false;
    }

    updateValidationState('msme', { status: 'validating', message: 'Verifying MSME with Surepass API...' });

    try {
      const { data, error } = await supabase.functions.invoke('validate-msme', {
        body: { id_number: msmeNumber.toUpperCase().trim() },
      });

      if (error) throw error;

      if (data?.success) {
        const verifiedName = data.data?.enterprise_name || 'Verified';
        const enterpriseType = data.data?.enterprise_type || 'Enterprise';
        
        // Check name matching if legalName is provided
        if (legalName) {
          const nameCheck = namesMatch(legalName, verifiedName);
          
          if (!nameCheck.matches) {
            updateValidationState('msme', { 
              status: 'failed', 
              message: `Name mismatch: MSME is registered to "${verifiedName}" but your organization name is "${legalName}" (${nameCheck.score}% match)`,
              data: {
                udyamNumber: data.data?.udyam_number,
                enterpriseName: data.data?.enterprise_name,
                providedName: legalName,
                matchScore: nameCheck.score,
              },
            });
            return false;
          }
        }
        
        updateValidationState('msme', { 
          status: 'passed', 
          message: `MSME verified successfully - ${verifiedName} (${enterpriseType})`,
          data: {
            udyamNumber: data.data?.udyam_number,
            enterpriseName: data.data?.enterprise_name,
            enterpriseType: data.data?.enterprise_type,
            majorActivity: data.data?.major_activity,
            socialCategory: data.data?.social_category,
            dateOfIncorporation: data.data?.date_of_incorporation,
            dateOfUdyamRegistration: data.data?.date_of_udyam_registration,
            state: data.data?.state,
            district: data.data?.district,
            officeAddress: data.data?.office_address,
            nicCode: data.data?.nic_2_digit_code,
            nicDescription: data.data?.nic_2_digit_description,
            status: data.data?.status,
          },
        });
        
        // Save to database
        await saveValidationToDatabase('msme', 'passed', `MSME verified successfully - ${verifiedName} (${enterpriseType})`, data);
        
        return true;
      } else {
        updateValidationState('msme', { 
          status: 'failed', 
          message: data?.message || data?.error || 'MSME verification failed',
        });
        return false;
      }
    } catch (error) {
      updateValidationState('msme', { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'MSME verification service unavailable',
      });
      return false;
    }
  }, [updateValidationState]);

  // Notify Finance team for approval when all validations pass
  const notifyFinanceForApproval = useCallback(async (params: NotifyFinanceParams): Promise<{ success: boolean; otp?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('notify-finance-approval', {
        body: {
          vendorId: params.vendorId,
          vendorName: params.vendorName,
          vendorEmail: params.vendorEmail,
          validationResults: {
            gst: { status: validationStates.gst.status, message: validationStates.gst.message || '' },
            pan: { status: validationStates.pan.status, message: validationStates.pan.message || '' },
            bank: { status: validationStates.bank.status, message: validationStates.bank.message || '' },
            msme: { status: validationStates.msme.status, message: validationStates.msme.message || '' },
          },
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: '🔔 Finance Team Notified',
          description: `OTP sent for approval. Vendor status updated to Finance Review.`,
        });
        return { success: true, otp: data.demoOtp };
      }

      return { success: false };
    } catch (error) {
      console.error('Failed to notify finance:', error);
      toast({
        title: 'Notification Failed',
        description: 'Could not notify finance team. Please try again.',
        variant: 'destructive',
      });
      return { success: false };
    }
  }, [validationStates, toast]);

  // Check if all required validations have passed
  const areAllValidationsPassed = useCallback((): boolean => {
    return (
      validationStates.gst.status === 'passed' &&
      validationStates.pan.status === 'passed' &&
      validationStates.bank.status === 'passed'
    );
  }, [validationStates]);

  const resetValidation = useCallback((type: FieldValidationType) => {
    updateValidationState(type, { status: 'idle', message: null });
  }, [updateValidationState]);

  const resetAllValidations = useCallback(() => {
    setValidationStates({
      gst: { status: 'idle', message: null },
      pan: { status: 'idle', message: null },
      bank: { status: 'idle', message: null },
      msme: { status: 'idle', message: null },
    });
  }, []);

  return {
    validationStates,
    validateGST,
    validatePAN,
    validateBank,
    validateMSME,
    resetValidation,
    resetAllValidations,
    notifyFinanceForApproval,
    areAllValidationsPassed,
  };
}
