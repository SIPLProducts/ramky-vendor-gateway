import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    click?: {
      link: string;
      timestamp: string;
    };
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ResendWebhookPayload = await req.json();
    console.log("Received Resend webhook:", JSON.stringify(payload, null, 2));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const emailId = payload.data.email_id;
    const eventType = payload.type; // email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained

    // Find the invitation by resend_email_id
    const { data: invitation, error: findError } = await supabase
      .from("vendor_invitations")
      .select("id")
      .eq("resend_email_id", emailId)
      .single();

    if (findError || !invitation) {
      console.log("No invitation found for email_id:", emailId);
      // Still log the event even if we can't link it
      await supabase.from("invitation_email_events").insert({
        email_id: emailId,
        event_type: eventType.replace("email.", ""),
        event_data: payload.data,
      });
      return new Response(JSON.stringify({ success: true, message: "Event logged without invitation link" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Log the event
    const { error: logError } = await supabase.from("invitation_email_events").insert({
      invitation_id: invitation.id,
      email_id: emailId,
      event_type: eventType.replace("email.", ""),
      event_data: payload.data,
    });

    if (logError) {
      console.error("Failed to log email event:", logError);
    }

    // Update invitation tracking fields based on event type
    const updateData: Record<string, string> = {};
    const now = new Date().toISOString();

    switch (eventType) {
      case "email.sent":
      case "email.delivered":
        updateData.email_sent_at = now;
        break;
      case "email.opened":
        updateData.email_opened_at = now;
        break;
      case "email.clicked":
        updateData.email_clicked_at = now;
        break;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("vendor_invitations")
        .update(updateData)
        .eq("id", invitation.id);

      if (updateError) {
        console.error("Failed to update invitation:", updateError);
      }
    }

    console.log(`Processed ${eventType} event for invitation ${invitation.id}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
