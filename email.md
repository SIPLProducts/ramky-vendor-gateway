Perfect 👍
Below is a complete, working solution using Supabase Edge Functions to send an email:

📤 From: dbk.mech04@gmail.com
📥 To: bala@sharviinfotech.com
📦 Triggered from your Vendor Portal

✅ Architecture (Simple)
Vendor Portal UI
   ↓
Supabase Edge Function
   ↓
Gmail SMTP (Nodemailer)
   ↓
Email Delivered

1️⃣ Prerequisites (One-time)
✅ Gmail Setup (VERY IMPORTANT)

Login to dbk.mech04@gmail.com

Enable 2-Step Verification

Create App Password

App → Mail

Device → Other (Vendor Portal)

Copy the 16-digit password

2️⃣ Create Supabase Edge Function
📁 Folder Structure
supabase/
 └── functions/
     └── send-email/
         └── index.ts

3️⃣ Supabase Edge Function Code (index.ts)
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import nodemailer from "npm:nodemailer";

serve(async (req) => {
  try {
    const { subject, message } = await req.json();

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: "dbk.mech04@gmail.com",
        pass: Deno.env.get("SMTP_PASS") // App Password
      }
    });

    await transporter.sendMail({
      from: '"Vendor Portal" <dbk.mech04@gmail.com>',
      to: "bala@sharviinfotech.com",
      subject: subject || "Message from Vendor Portal",
      html: `
        <p>Dear Bala,</p>
        <p>${message || "This email is sent from the Vendor Portal using Supabase."}</p>
        <p>Regards,<br/>Vendor Portal Team</p>
      `
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});

4️⃣ Set Environment Variable in Supabase

Run this in terminal:

supabase secrets set SMTP_PASS=xxxxxxxxxxxxxxxx


(Use Gmail App Password, NOT normal password)

5️⃣ Deploy Edge Function
supabase functions deploy send-email

6️⃣ Call Edge Function from Frontend (Lovable / React / JS)
await fetch(
  "https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-email",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      subject: "Vendor Portal Notification",
      message: "This email is sent successfully using Supabase Edge Function."
    })
  }
);

7️⃣ What You Get ✅

✔ Email sent securely
✔ No SMTP password exposed
✔ Works with Supabase
✔ Production-ready
✔ Easy to extend (vendor invite, alerts, approvals)

⚠️ Important Notes

Gmail free account → ~500 emails/day

For high volume → move to SendGrid / Amazon SES

Always keep SMTP secrets in Supabase secrets