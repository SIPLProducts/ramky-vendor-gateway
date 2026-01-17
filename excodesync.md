js code that worked: 

const https = require('https');

// 1. Prepare Data
const payload = JSON.stringify([
    {
        "BPARTNER": "",
        "PARTN_CAT": "1",
        "PARTN_GRP": "S001",
        "TITLE": "0002",
        "NAME1": "Sharvi",
        "NAME2": "SIPL",
        "STERM1": "KJNKJLN",
        "STERM2": "NKLMLL",
        "STREET": "NLKMLKM",
        "HOUSE_NO": "HSN123",
        "STR_SUPPL1": "Atmakur",
        "LOCATION": "Atmakur",
        "DISTRICT": "Nellore",
        "POSTL_COD1": "524322",
        "CITY": "Nellore",
        "COUNTRY": "IN",
        "REGION": "AP",
        "LANGU": "E",
        "TEL_NUMBER": "223349",
        "MOB_NUMBER": "7887238330",
        "SMTP_ADDR": "sipl@gmail.com",
        "TAXNUMXL": "90878567768767",
        "BUKRS": "1710",
        "WITHT": "1710",
        "TAXKD07": "X"
    }
]);

// 2. Prepare Credentials
const username = 's23hana7';
const password = 'Sh@rv!123$5';
const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

// 3. Configure Options
const options = {
    hostname: '49.207.9.62',
    port: 44325,
    path: '/vendor/bp/create?sap-client=100',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        'Accept': 'application/json'
        // 'Content-Length' is calculated automatically by req.write
    },
    // This ignores the SSL error for the IP address
    rejectUnauthorized: false 
};

console.log("🚀 Sending request to SAP via https module...");

// 4. Send Request
const req = https.request(options, (res) => {
    let data = '';

    // A chunk of data has been received.
    res.on('data', (chunk) => {
        data += chunk;
    });

    // The whole response has been received.
    res.on('end', () => {
        console.log(`\n✅ Status Code: ${res.statusCode}`);
        console.log("📄 Response Body:");
        try {
            // Try to pretty-print JSON if possible
            console.log(JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', (e) => {
    console.error(`\n❌ Request Error: ${e.message}`);
});

// Write data to request body
req.write(payload);
req.end();

---

chatgpt given translation code in supabae edge function: 

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Create a custom HTTP client that ignores SSL errors
// This is the Deno equivalent of "rejectUnauthorized: false"
const insecureClient = Deno.createHttpClient({ verify: false });

serve(async (req) => {
  // 1. Setup API Details
  const url = 'https://49.207.9.62:44325/vendor/bp/create?sap-client=100';
  
  // New Credentials from your successful test
  const username = 's23hana7';
  const password = 'Sh@rv!123$5';
  const encodedCredentials = btoa(`${username}:${password}`);

  // 2. Prepare Payload (Exact match to your working script)
  const payload = [
    {
      "BPARTNER": "",
      "PARTN_CAT": "1",
      "PARTN_GRP": "S001",
      "TITLE": "0002",
      "NAME1": "Sharvi",
      "NAME2": "SIPL",
      "STERM1": "KJNKJLN",
      "STERM2": "NKLMLL",
      "STREET": "NLKMLKM",
      "HOUSE_NO": "HSN123",
      "STR_SUPPL1": "Atmakur",
      "LOCATION": "Atmakur",
      "DISTRICT": "Nellore",
      "POSTL_COD1": "524322",
      "CITY": "Nellore",
      "COUNTRY": "IN",
      "REGION": "AP",
      "LANGU": "E",
      "TEL_NUMBER": "223349",
      "MOB_NUMBER": "7887238330",
      "SMTP_ADDR": "sipl@gmail.com",
      "TAXNUMXL": "90878567768767",
      "BUKRS": "1710",
      "WITHT": "1710",
      "TAXKD07": "X"
    }
  ];

  try {
    console.log("🚀 Sending request to SAP from Edge Function...");

    // 3. Send Request using the custom insecure client
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedCredentials}`
      },
      body: JSON.stringify(payload),
      client: insecureClient, // <--- This is key for the IP address URL
    });

    const result = await response.json();
    
    console.log("✅ SAP Response:", result);

    // 4. Return success to your frontend/agent
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});