import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DocType = "pan" | "gst" | "msme" | "cheque";

const SCHEMAS: Record<DocType, { name: string; description: string; parameters: any }> = {
  pan: {
    name: "extract_pan",
    description: "Extract fields from an Indian PAN card image.",
    parameters: {
      type: "object",
      properties: {
        pan_number: { type: "string", description: "10-character PAN, e.g. ABCDE1234F" },
        holder_name: { type: "string", description: "Name printed on the card" },
        father_name: { type: "string" },
        date_of_birth: { type: "string", description: "DD/MM/YYYY if visible" },
        confidence: { type: "number", description: "0 to 1 confidence" },
      },
      required: ["pan_number", "holder_name", "confidence"],
      additionalProperties: false,
    },
  },
  gst: {
    name: "extract_gst",
    description: "Extract fields from an Indian GST registration certificate.",
    parameters: {
      type: "object",
      properties: {
        gstin: { type: "string", description: "15-character GSTIN" },
        legal_name: { type: "string" },
        trade_name: { type: "string" },
        constitution_of_business: { type: "string", description: "e.g. Private Limited Company, LLP, Partnership, Proprietorship" },
        principal_place_of_business: { type: "string", description: "Full principal address from certificate" },
        additional_places: { type: "array", items: { type: "string" }, description: "Additional places of business if listed" },
        registration_date: { type: "string", description: "Date of registration (YYYY-MM-DD if possible)" },
        gst_status: { type: "string", description: "Active / Cancelled / Suspended" },
        taxpayer_type: { type: "string", description: "Regular / Composition / SEZ / Casual" },
        business_nature: { type: "array", items: { type: "string" }, description: "Nature of business activities" },
        jurisdiction_centre: { type: "string" },
        jurisdiction_state: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["gstin", "legal_name", "confidence"],
      additionalProperties: false,
    },
  },
  msme: {
    name: "extract_msme",
    description: "Extract fields from an Indian MSME / Udyam registration certificate.",
    parameters: {
      type: "object",
      properties: {
        udyam_number: { type: "string", description: "UDYAM-XX-00-0000000 format" },
        enterprise_name: { type: "string" },
        enterprise_type: { type: "string", description: "Micro, Small, or Medium" },
        registration_date: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["udyam_number", "enterprise_name", "confidence"],
      additionalProperties: false,
    },
  },
  cheque: {
    name: "extract_cheque",
    description: "Extract fields from a cancelled bank cheque image.",
    parameters: {
      type: "object",
      properties: {
        account_number: { type: "string" },
        ifsc_code: { type: "string", description: "11-character IFSC" },
        bank_name: { type: "string" },
        branch_name: { type: "string" },
        account_holder_name: { type: "string" },
        micr_code: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["account_number", "ifsc_code", "bank_name", "confidence"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI gateway not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { fileBase64, mimeType, documentType, vendorId } = await req.json() as {
      fileBase64: string;
      mimeType: string;
      documentType: DocType;
      vendorId?: string;
    };

    if (!fileBase64 || !mimeType || !documentType) {
      return new Response(
        JSON.stringify({ success: false, error: "fileBase64, mimeType, documentType required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const schema = SCHEMAS[documentType];
    if (!schema) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown documentType: ${documentType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;

    const OCR_MODEL = "google/gemini-2.5-flash";
    console.log(`[ocr-extract] Calling AI gateway for ${documentType} with ${OCR_MODEL}`);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an OCR engine for Indian business registration documents. Extract the requested fields exactly as printed. Return UPPERCASE for PAN, GSTIN, IFSC, and Udyam numbers. If a field is not legible, omit it. Provide an honest confidence score from 0 to 1.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract the structured data from this ${documentType.toUpperCase()} document.` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [{ type: "function", function: schema }],
        tool_choice: { type: "function", function: { name: schema.name } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`[ocr-extract] AI gateway error ${aiResp.status}: ${errText}`);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: `OCR service error (${aiResp.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("[ocr-extract] No tool call in AI response", JSON.stringify(aiJson));
      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not read the document. Please upload a clearer scan.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("[ocr-extract] JSON parse failed", e);
      return new Response(
        JSON.stringify({ success: false, error: "Could not parse document fields." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const confidence = typeof extracted.confidence === "number" ? extracted.confidence : 0.7;

    // Audit log (best-effort, ignore errors)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceKey);

      // Try to derive user_id from caller JWT
      let userId: string | null = null;
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const { data } = await sb.auth.getUser(token);
        userId = data.user?.id ?? null;
      }

      await sb.from("ocr_extractions").insert({
        vendor_id: vendorId ?? null,
        user_id: userId,
        document_type: documentType,
        extracted_data: extracted,
        confidence,
      });
    } catch (logErr) {
      console.warn("[ocr-extract] audit log failed", logErr);
    }

    return new Response(
      JSON.stringify({ success: true, extracted, confidence }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[ocr-extract] fatal", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
