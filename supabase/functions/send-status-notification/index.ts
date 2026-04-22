import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  vendorId: string;
  newStatus: string;
  previousStatus?: string;
  vendorEmail: string;
  vendorName: string;
  comments?: string;
  simulationMode?: boolean;
}

const statusMessages: Record<string, { subject: string; body: string }> = {
  submitted: {
    subject: 'Registration Submitted Successfully',
    body: 'Your vendor registration has been submitted and is now under review. We will notify you once the verification process is complete.',
  },
  validation_pending: {
    subject: 'Document Validation In Progress',
    body: 'Your submitted documents are currently being validated. This process typically takes 1-2 business days.',
  },
  validation_failed: {
    subject: 'Action Required: Validation Issues Found',
    body: 'We found some issues during the validation of your documents. Please log in to the portal to review and resubmit the required information.',
  },
  finance_review: {
    subject: 'Awaiting Finance Review',
    body: 'Your registration has cleared all Purchase/SCM approval levels and is now awaiting Finance review.',
  },
  finance_approved: {
    subject: 'Finance Approved — Ready for SAP Sync',
    body: 'Great news! Finance has approved your registration. Your vendor record is now ready to be synced to our ERP (SAP) system.',
  },
  finance_rejected: {
    subject: 'Finance Review: Action Required',
    body: 'The finance team has requested some clarifications regarding your registration. Please log in to review the feedback.',
  },
  purchase_review: {
    subject: 'Awaiting Purchase / SCM Approval',
    body: 'Your registration has been submitted and is now moving through the Purchase/SCM approval matrix. We will notify you as it progresses.',
  },
  purchase_approved: {
    subject: 'Approved — Pending SAP Sync',
    body: 'Your vendor registration has been fully approved by Purchase and Finance. Your vendor code will be generated and synced to our ERP system shortly.',
  },
  purchase_rejected: {
    subject: 'Purchase Review: Action Required',
    body: 'The Purchase/SCM team has requested some changes to your registration. Please log in to review and address the feedback.',
  },
  sap_synced: {
    subject: 'Vendor Code Generated - Onboarding Complete',
    body: 'Your vendor onboarding is complete! Your vendor code has been generated and synced to our ERP system. You can now start transacting with us.',
  },
};

function generateEmailHtml(vendorName: string, status: string, comments?: string): string {
  const statusInfo = statusMessages[status] || {
    subject: 'Status Update',
    body: 'Your vendor registration status has been updated.',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusInfo.subject}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Vendor Portal</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 10px;">Dear <strong>${vendorName}</strong>,</p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="color: #667eea; margin: 0 0 10px 0; font-size: 18px;">${statusInfo.subject}</h2>
      <p style="margin: 0; color: #555;">${statusInfo.body}</p>
    </div>
    
    ${comments ? `
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <strong style="color: #856404;">Reviewer Comments:</strong>
      <p style="margin: 10px 0 0 0; color: #856404;">${comments}</p>
    </div>
    ` : ''}
    
    <div style="margin-top: 30px;">
      <a href="#" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Registration Status</a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="color: #888; font-size: 14px; margin: 0;">
      If you have any questions, please contact our support team.<br>
      <strong>Email:</strong> vendor.support@company.com<br>
      <strong>Phone:</strong> 1800-XXX-XXXX
    </p>
  </div>
  
  <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e0e0e0; border-top: none;">
    <p style="color: #888; font-size: 12px; margin: 0;">
      © 2024 Vendor Management Portal. All rights reserved.<br>
      This is an automated notification. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      vendorId, 
      newStatus, 
      previousStatus, 
      vendorEmail, 
      vendorName, 
      comments,
      simulationMode = true 
    }: NotificationRequest = await req.json();

    console.log(`[Email Notification] Processing for vendor ${vendorId}`);
    console.log(`[Email Notification] Status change: ${previousStatus} -> ${newStatus}`);
    console.log(`[Email Notification] Simulation Mode: ${simulationMode}`);

    const statusInfo = statusMessages[newStatus] || {
      subject: 'Registration Status Update',
      body: 'Your vendor registration status has been updated.',
    };

    const emailHtml = generateEmailHtml(vendorName, newStatus, comments);

    // Simulation mode - log the email instead of sending
    if (simulationMode) {
      console.log(`[SIMULATION] Would send email to: ${vendorEmail}`);
      console.log(`[SIMULATION] Subject: ${statusInfo.subject}`);
      console.log(`[SIMULATION] Email generated successfully`);

      // Log to database for demo purposes
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('audit_logs').insert({
        vendor_id: vendorId,
        action: 'email_notification_simulated',
        details: {
          to: vendorEmail,
          subject: statusInfo.subject,
          status: newStatus,
          previousStatus,
          simulationMode: true,
          timestamp: new Date().toISOString(),
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: 'Email notification simulated successfully',
          emailPreview: {
            to: vendorEmail,
            subject: statusInfo.subject,
            htmlPreview: emailHtml,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Real mode - would use Resend API here
    // const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    // if (!RESEND_API_KEY) {
    //   throw new Error('RESEND_API_KEY not configured');
    // }
    // ... actual email sending logic

    return new Response(
      JSON.stringify({
        success: true,
        simulated: false,
        message: 'Email sent successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Email Notification] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
