import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyFinanceRequest {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  validationResults: {
    gst: { status: string; message: string };
    pan: { status: string; message: string };
    bank: { status: string; message: string };
    msme?: { status: string; message: string };
  };
}

// Generate OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vendorId, vendorName, vendorEmail, validationResults }: NotifyFinanceRequest = await req.json();
    console.log(`[Finance Notification] Processing for vendor: ${vendorId} - ${vendorName}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if all validations passed
    const allValidationsPassed = 
      validationResults.gst?.status === 'passed' &&
      validationResults.pan?.status === 'passed' &&
      validationResults.bank?.status === 'passed';

    if (!allValidationsPassed) {
      console.log(`[Finance Notification] Validations not complete, skipping notification`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'All validations must pass before notifying finance',
          validationStatus: validationResults,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Update vendor status to finance_review
    const { error: updateError } = await supabase
      .from('vendors')
      .update({ 
        status: 'finance_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId);

    if (updateError) {
      console.error(`[Finance Notification] Error updating vendor status:`, updateError);
      throw updateError;
    }

    // Generate OTP for Finance approval
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiry

    // Log the approval request
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        vendor_id: vendorId,
        action: 'finance_approval_requested',
        details: {
          vendor_name: vendorName,
          vendor_email: vendorEmail,
          validation_results: validationResults,
          otp_generated: true,
          otp_expiry: otpExpiry.toISOString(),
          simulated_otp: otp, // In production, this would be sent via email/SMS
        },
      });

    if (logError) {
      console.error(`[Finance Notification] Error logging audit:`, logError);
    }

    // Simulate sending notification to Finance team
    console.log(`[Finance Notification] =========================================`);
    console.log(`[Finance Notification] FINANCE APPROVAL REQUEST`);
    console.log(`[Finance Notification] Vendor: ${vendorName} (${vendorId})`);
    console.log(`[Finance Notification] Email: ${vendorEmail}`);
    console.log(`[Finance Notification] OTP for Approval: ${otp}`);
    console.log(`[Finance Notification] OTP Expiry: ${otpExpiry.toISOString()}`);
    console.log(`[Finance Notification] Validation Results:`);
    console.log(`[Finance Notification]   - GST: ${validationResults.gst?.status} - ${validationResults.gst?.message}`);
    console.log(`[Finance Notification]   - PAN: ${validationResults.pan?.status} - ${validationResults.pan?.message}`);
    console.log(`[Finance Notification]   - Bank: ${validationResults.bank?.status} - ${validationResults.bank?.message}`);
    if (validationResults.msme) {
      console.log(`[Finance Notification]   - MSME: ${validationResults.msme?.status} - ${validationResults.msme?.message}`);
    }
    console.log(`[Finance Notification] =========================================`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Finance team has been notified for approval',
        data: {
          vendorId,
          vendorName,
          status: 'finance_review',
          otpSent: true,
          otpExpiry: otpExpiry.toISOString(),
          validationSummary: {
            gst: validationResults.gst?.status === 'passed' ? '✓ Verified' : '✗ Failed',
            pan: validationResults.pan?.status === 'passed' ? '✓ Verified' : '✗ Failed',
            bank: validationResults.bank?.status === 'passed' ? '✓ Verified' : '✗ Failed',
            msme: validationResults.msme?.status === 'passed' ? '✓ Verified' : 'N/A',
          },
        },
        // In demo mode, include the OTP for testing
        demoOtp: otp,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[Finance Notification] Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Failed to notify finance team' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
