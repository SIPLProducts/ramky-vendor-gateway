import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type FieldValidationType = 'gst' | 'pan' | 'bank' | 'msme';

export interface FieldValidationState {
  status: 'idle' | 'validating' | 'passed' | 'failed';
  message: string | null;
  data?: Record<string, unknown>;
}

interface NotifyFinanceParams {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
}

export function useFieldValidation() {
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

  const validateGST = useCallback(async (gstin: string, legalName?: string): Promise<boolean> => {
    if (!gstin || gstin.length < 15) {
      updateValidationState('gst', { status: 'failed', message: 'Please enter a valid 15-character GSTIN' });
      return false;
    }

    updateValidationState('gst', { status: 'validating', message: 'Verifying GSTIN with government portal...' });

    try {
      const { data, error } = await supabase.functions.invoke('validate-gst', {
        body: { gstin: gstin.toUpperCase().trim(), legalName, simulationMode: true },
      });

      if (error) throw error;

      if (data?.valid) {
        updateValidationState('gst', { 
          status: 'passed', 
          message: data.message || 'GST verified successfully',
          data: data.data,
        });
        return true;
      } else {
        updateValidationState('gst', { 
          status: 'failed', 
          message: data?.message || 'GST verification failed',
        });
        return false;
      }
    } catch (error) {
      updateValidationState('gst', { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'GST verification service unavailable',
      });
      return false;
    }
  }, [updateValidationState]);

  const validatePAN = useCallback(async (pan: string, name?: string): Promise<boolean> => {
    if (!pan || pan.length !== 10) {
      updateValidationState('pan', { status: 'failed', message: 'Please enter a valid 10-character PAN' });
      return false;
    }

    updateValidationState('pan', { status: 'validating', message: 'Verifying PAN with government portal...' });

    try {
      const { data, error } = await supabase.functions.invoke('validate-pan', {
        body: { pan: pan.toUpperCase().trim(), name, simulationMode: true },
      });

      if (error) throw error;

      if (data?.valid) {
        updateValidationState('pan', { 
          status: 'passed', 
          message: data.message || 'PAN verified successfully',
          data: data.data,
        });
        return true;
      } else {
        updateValidationState('pan', { 
          status: 'failed', 
          message: data?.message || 'PAN verification failed',
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

  const validateBank = useCallback(async (accountNumber: string, ifscCode: string, accountHolderName?: string): Promise<boolean> => {
    if (!accountNumber || accountNumber.length < 8) {
      updateValidationState('bank', { status: 'failed', message: 'Please enter a valid account number' });
      return false;
    }
    if (!ifscCode || ifscCode.length !== 11) {
      updateValidationState('bank', { status: 'failed', message: 'Please enter a valid 11-character IFSC code' });
      return false;
    }

    updateValidationState('bank', { status: 'validating', message: 'Verifying bank account via penny drop...' });

    try {
      const { data, error } = await supabase.functions.invoke('validate-bank', {
        body: { 
          accountNumber, 
          ifscCode: ifscCode.toUpperCase().trim(),
          accountHolderName,
          simulationMode: true,
        },
      });

      if (error) throw error;

      if (data?.valid) {
        updateValidationState('bank', { 
          status: 'passed', 
          message: data.message || 'Bank account verified successfully',
          data: data.data,
        });
        return true;
      } else {
        updateValidationState('bank', { 
          status: 'failed', 
          message: data?.message || 'Bank verification failed',
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

  const validateMSME = useCallback(async (msmeNumber: string, enterpriseName?: string): Promise<boolean> => {
    if (!msmeNumber) {
      updateValidationState('msme', { status: 'failed', message: 'Please enter MSME/Udyam number' });
      return false;
    }

    updateValidationState('msme', { status: 'validating', message: 'Verifying MSME with Udyam portal...' });

    try {
      const { data, error } = await supabase.functions.invoke('validate-msme', {
        body: { msmeNumber, enterpriseName },
      });

      if (error) throw error;

      if (data?.valid) {
        updateValidationState('msme', { 
          status: 'passed', 
          message: data.message || 'MSME verified successfully',
          data: data.data,
        });
        return true;
      } else {
        updateValidationState('msme', { 
          status: 'failed', 
          message: data?.message || 'MSME verification failed',
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
